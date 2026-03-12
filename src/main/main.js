const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  clipboard,
  nativeImage,
  ipcMain,
  screen,
  globalShortcut
} = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let mainWindow = null;
let settingsWindow = null;
let clipboardHistory = [];
let lastClipboardContent = '';
let lastImageHash = '';
let pollingInterval = null;
let hideTimeout = null;
let settings = loadSettings();
let trackingEnabled = settings.trackingEnabled !== false;

const POLL_MS = 800;
const DATA_DIR = path.join(app.getPath('userData'), 'clippy-data');
const MAIN_WINDOW_WIDTH = 980;
const MAIN_WINDOW_HEIGHT = 688;
const MAIN_WINDOW_MIN_WIDTH = 900;
const MAIN_WINDOW_MIN_HEIGHT = 620;
const IMAGE_PREVIEW_WIDTH = 280;
const IMAGE_FULL_WIDTH = 1400;

function loadSettings() {
  const settingsPath = path.join(app.getPath('userData'), 'clippy-settings.json');
  const defaults = {
    maxHistory: 50,
    theme: 'dark',
    language: 'en',
    launchAtStartup: true,
    shortcut: 'CommandOrControl+Shift+V',
    pollInterval: 800,
    trackingEnabled: true
  };

  try {
    if (fs.existsSync(settingsPath)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
    }
  } catch {}

  return defaults;
}

function saveSettings() {
  const settingsPath = path.join(app.getPath('userData'), 'clippy-settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function getMaxHistory() {
  return Math.max(10, Number(settings.maxHistory) || 50);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizeTags(tags) {
  const source = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : [];
  return [...new Set(
    source
      .map((tag) => String(tag).trim())
      .filter(Boolean)
  )];
}

function detectSnippet(text = '') {
  const sample = String(text).trim();
  if (sample.length < 16) {
    return false;
  }

  const lines = sample.split(/\r?\n/).filter(Boolean);
  const codeSignal =
    /(const |let |function |class |=>|<\/?[a-z][^>]*>|{|\}|;|#include|def |import |from |SELECT |INSERT |UPDATE |DELETE |git |npm |yarn |pnpm )/i;

  return lines.length >= 2 && codeSignal.test(sample);
}

function getItemText(item) {
  if (item.type === 'text') {
    return item.text || '';
  }

  if (item.type === 'html') {
    return item.textPreview || '';
  }

  return '';
}

function getBase64FromDataUrl(dataUrl = '') {
  const value = String(dataUrl);
  const marker = 'base64,';
  const markerIndex = value.indexOf(marker);

  if (markerIndex === -1) {
    return '';
  }

  return value.slice(markerIndex + marker.length);
}

function getDataUrlFromBase64(base64 = '') {
  return base64 ? `data:image/png;base64,${base64}` : '';
}

function imageToPngBase64(image, widthLimit) {
  const size = image.getSize();
  const nextWidth = widthLimit ? Math.min(size.width, widthLimit) : size.width;
  const nextImage = nextWidth > 0 && nextWidth !== size.width
    ? image.resize({ width: nextWidth })
    : image;

  return nextImage.toPNG().toString('base64');
}

function getNativeImageFromHistoryItem(item) {
  if (item.type !== 'image') {
    return nativeImage.createEmpty();
  }

  if (item.fullPngBase64) {
    return nativeImage.createFromBuffer(Buffer.from(item.fullPngBase64, 'base64'));
  }

  if (item.previewPngBase64) {
    return nativeImage.createFromBuffer(Buffer.from(item.previewPngBase64, 'base64'));
  }

  const dataUrl = item.fullDataUrl || item.previewDataUrl;
  return dataUrl ? nativeImage.createFromDataURL(dataUrl) : nativeImage.createEmpty();
}

function createImageHistoryItem(image) {
  const size = image.getSize();
  const previewPngBase64 = imageToPngBase64(image, IMAGE_PREVIEW_WIDTH);
  const fullPngBase64 = imageToPngBase64(image, IMAGE_FULL_WIDTH);

  return normalizeHistoryItem({
    id: generateId(),
    type: 'image',
    previewPngBase64,
    fullPngBase64,
    previewDataUrl: getDataUrlFromBase64(previewPngBase64),
    fullDataUrl: getDataUrlFromBase64(fullPngBase64),
    width: size.width,
    height: size.height,
    createdAt: Date.now(),
    pinned: false,
    tags: []
  });
}

function normalizeHistoryItem(item) {
  const textValue = getItemText(item);
  const normalizedItem = {
    ...item,
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    pinned: Boolean(item.pinned),
    tags: normalizeTags(item.tags)
  };

  if (item.type === 'image') {
    const previewPngBase64 = item.previewPngBase64 || getBase64FromDataUrl(item.previewDataUrl);
    const fullPngBase64 = item.fullPngBase64 || getBase64FromDataUrl(item.fullDataUrl) || previewPngBase64;

    return {
      ...normalizedItem,
      previewPngBase64,
      fullPngBase64,
      previewDataUrl: getDataUrlFromBase64(previewPngBase64),
      fullDataUrl: getDataUrlFromBase64(fullPngBase64),
      isSnippet: false
    };
  }

  return {
    ...normalizedItem,
    isSnippet: item.type === 'image' ? false : Boolean(item.isSnippet || detectSnippet(textValue))
  };
}

function saveHistory() {
  ensureDataDir();

  const saveable = clipboardHistory.map((item) => {
    const normalized = normalizeHistoryItem(item);

    if (normalized.type === 'image') {
      const {
        previewDataUrl,
        fullDataUrl,
        ...persistedImage
      } = normalized;

      return {
        ...persistedImage
      };
    }

    return normalized;
  });

  fs.writeFileSync(path.join(DATA_DIR, 'history.json'), JSON.stringify(saveable));
}

function loadHistory() {
  try {
    const historyPath = path.join(DATA_DIR, 'history.json');
    if (fs.existsSync(historyPath)) {
      const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      clipboardHistory = Array.isArray(parsed) ? parsed.map(normalizeHistoryItem) : [];
    }
  } catch {
    clipboardHistory = [];
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function simpleHash(str) {
  let hash = 0;

  for (let index = 0; index < Math.min(str.length, 1000); index += 1) {
    const char = str.charCodeAt(index);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  return hash.toString();
}

function broadcastHistory() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('history-updated', clipboardHistory);
  }
}

function broadcastTracking() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tracking-updated', trackingEnabled);
  }
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open CLIPPY', click: () => toggleWindow() },
    { label: 'Settings', click: () => createSettingsWindow() },
    { type: 'separator' },
    {
      label: trackingEnabled ? 'Pause Tracking' : 'Resume Tracking',
      click: () => setTrackingState(!trackingEnabled)
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        saveHistory();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function searchHistory(query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) {
    return clipboardHistory;
  }

  return clipboardHistory.filter((item) => {
    const haystack = [
      getItemText(item),
      ...(item.tags || []),
      item.type,
      item.isSnippet ? 'snippet code' : ''
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function trimHistory() {
  const pinned = clipboardHistory.filter((item) => item.pinned);
  const unpinned = clipboardHistory.filter((item) => !item.pinned);
  clipboardHistory = [...pinned, ...unpinned].slice(0, getMaxHistory());
}

function addToHistory(item) {
  const nextItem = normalizeHistoryItem(item);

  clipboardHistory = clipboardHistory.filter((existing) => {
    if (nextItem.type === 'image' || existing.type === 'image') {
      return true;
    }

    return getItemText(existing) !== getItemText(nextItem);
  });

  clipboardHistory.unshift(nextItem);
  trimHistory();
  saveHistory();
  broadcastHistory();
}

function checkClipboard() {
  if (!trackingEnabled) {
    return;
  }

  try {
    const image = clipboard.readImage();

    if (!image.isEmpty()) {
      const size = image.getSize();
      const bitmap = image.toBitmap();
      const imageHash = simpleHash(Buffer.from(bitmap).toString('base64').substring(0, 2000));

      if (imageHash !== lastImageHash) {
        lastImageHash = imageHash;
        lastClipboardContent = '';

        addToHistory(createImageHistoryItem(image));

        return;
      }
    }

    const html = clipboard.readHTML();
    const text = clipboard.readText();

    if (html && html.trim().length > 10 && html !== text) {
      if (text !== lastClipboardContent) {
        lastClipboardContent = text;
        lastImageHash = '';

        addToHistory({
          id: generateId(),
          type: 'html',
          html: html.substring(0, 10000),
          textPreview: text.substring(0, 5000),
          createdAt: Date.now(),
          pinned: false,
          tags: [],
          isSnippet: detectSnippet(text)
        });

        return;
      }
    }

    if (text && text.trim().length > 0 && text !== lastClipboardContent) {
      lastClipboardContent = text;
      lastImageHash = '';

      addToHistory({
        id: generateId(),
        type: 'text',
        text: text.substring(0, 50000),
        createdAt: Date.now(),
        pinned: false,
        tags: [],
        isSnippet: detectSnippet(text)
      });
    }
  } catch {
    // Clipboard can be locked by other apps. Ignore and try again next poll.
  }
}

function syncClipboardTrackingState() {
  try {
    const image = clipboard.readImage();

    if (!image.isEmpty()) {
      const bitmap = image.toBitmap();
      lastImageHash = simpleHash(Buffer.from(bitmap).toString('base64').substring(0, 2000));
      lastClipboardContent = '';
      return;
    }

    lastClipboardContent = clipboard.readText() || '';
    lastImageHash = '';
  } catch {
    lastClipboardContent = '';
    lastImageHash = '';
  }
}

function getPlainText(item) {
  if (item.type === 'image') {
    return '';
  }

  if (item.type === 'html') {
    return item.textPreview || '';
  }

  return item.text || '';
}

function findHistoryItem(id) {
  return clipboardHistory.find((item) => item.id === id);
}

function updateHistoryItem(id, updater) {
  const item = findHistoryItem(id);

  if (!item) {
    return clipboardHistory;
  }

  updater(item);
  trimHistory();
  saveHistory();
  broadcastHistory();
  return clipboardHistory;
}

function setTrackingState(enabled) {
  trackingEnabled = Boolean(enabled);
  settings.trackingEnabled = trackingEnabled;
  saveSettings();
  refreshTrayMenu();
  broadcastTracking();
  return trackingEnabled;
}

function createMainWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_HEIGHT,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    x: Math.max(16, screenWidth - MAIN_WINDOW_WIDTH - 20),
    y: Math.max(16, screenHeight - MAIN_WINDOW_HEIGHT - 20),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      hideTimeout = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.hide();
        }
      }, 150);
    }
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  let x;
  let y;

  if (mainWindow && !mainWindow.isDestroyed()) {
    const bounds = mainWindow.getBounds();
    x = bounds.x + 24;
    y = bounds.y + 24;
  }

  settingsWindow = new BrowserWindow({
    width: 430,
    height: 520,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  let y = Math.round(trayBounds.y - windowBounds.height - 8);

  if (x + windowBounds.width > screenWidth) {
    x = screenWidth - windowBounds.width - 16;
  }
  if (x < 16) {
    x = 16;
  }
  if (y < 16) {
    y = trayBounds.y + trayBounds.height + 8;
  }
  if (y + windowBounds.height > screenHeight) {
    y = Math.max(16, screenHeight - windowBounds.height - 16);
  }

  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  mainWindow.setPosition(x, y);
  mainWindow.show();
  mainWindow.focus();
  broadcastHistory();
  broadcastTracking();
}

function createTray() {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1;
  const iconSize = Math.max(16, Math.round(16 * scaleFactor));

  if (fs.existsSync(iconPath)) {
    const trayIcon = nativeImage.createFromPath(iconPath).resize({
      width: iconSize,
      height: iconSize,
      quality: 'best'
    });
    tray = new Tray(trayIcon);
  } else {
    const canvas = Buffer.alloc(iconSize * iconSize * 4);

    for (let index = 0; index < iconSize * iconSize; index += 1) {
      const x = index % iconSize;
      const y = Math.floor(index / iconSize);
      const offset = index * 4;
      const isBoard = x >= 2 && x <= 13 && y >= 3 && y <= 14;
      const isClip = x >= 5 && x <= 10 && y >= 1 && y <= 4;

      if (isBoard || isClip) {
        canvas[offset] = 79;
        canvas[offset + 1] = 125;
        canvas[offset + 2] = 255;
        canvas[offset + 3] = 255;
      } else {
        canvas[offset + 3] = 0;
      }
    }

    tray = new Tray(nativeImage.createFromBuffer(canvas, { width: iconSize, height: iconSize }));
  }

  tray.setToolTip('CLIPPY');
  tray.on('click', () => toggleWindow());
  refreshTrayMenu();
}

ipcMain.handle('get-history', () => clipboardHistory);
ipcMain.handle('get-settings', () => settings);
ipcMain.handle('get-tracking-state', () => trackingEnabled);
ipcMain.handle('search-history', (_, query) => searchHistory(query));

ipcMain.handle('save-settings', (_, newSettings) => {
  settings = { ...settings, ...newSettings };
  trackingEnabled = settings.trackingEnabled !== false;
  saveSettings();
  trimHistory();
  saveHistory();
  refreshTrayMenu();
  broadcastHistory();
  broadcastTracking();

  app.setLoginItemSettings({
    openAtLogin: settings.launchAtStartup,
    path: app.getPath('exe')
  });

  return settings;
});

ipcMain.handle('toggle-tracking', () => {
  return setTrackingState(!trackingEnabled);
});

ipcMain.handle('copy-item', (_, itemFromRenderer) => {
  try {
    const item = findHistoryItem(itemFromRenderer.id) || itemFromRenderer;

    if (item.type === 'text') {
      clipboard.writeText(item.text);
    } else if (item.type === 'html') {
      clipboard.writeHTML(item.html || '');
      clipboard.writeText(item.textPreview || '');
    } else if (item.type === 'image') {
      const image = getNativeImageFromHistoryItem(item);

      if (image.isEmpty()) {
        return false;
      }

      clipboard.writeImage(image);
    }

    lastClipboardContent = clipboard.readText() || '';

    if (item.type === 'image') {
      const image = clipboard.readImage();
      if (!image.isEmpty()) {
        const bitmap = image.toBitmap();
        lastImageHash = simpleHash(Buffer.from(bitmap).toString('base64').substring(0, 2000));
      }
    }

    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  }
});

ipcMain.handle('copy-item-plain', (_, itemFromRenderer) => {
  try {
    const item = findHistoryItem(itemFromRenderer.id) || itemFromRenderer;
    const plainText = getPlainText(item);

    if (!plainText) {
      return false;
    }

    clipboard.writeText(plainText);
    lastClipboardContent = plainText;
    lastImageHash = '';
    return true;
  } catch (error) {
    console.error('Plain text copy failed:', error);
    return false;
  }
});

ipcMain.handle('delete-item', (_, id) => {
  clipboardHistory = clipboardHistory.filter((item) => item.id !== id);
  saveHistory();
  broadcastHistory();
  return clipboardHistory;
});

ipcMain.handle('pin-item', (_, id) => {
  return updateHistoryItem(id, (item) => {
    item.pinned = !item.pinned;
  });
});

ipcMain.handle('set-item-tags', (_, id, tags) => {
  return updateHistoryItem(id, (item) => {
    item.tags = normalizeTags(tags);
  });
});

ipcMain.handle('toggle-snippet', (_, id) => {
  return updateHistoryItem(id, (item) => {
    if (item.type !== 'image') {
      item.isSnippet = !item.isSnippet;
    }
  });
});

ipcMain.handle('clear-history', () => {
  clipboardHistory = clipboardHistory.filter((item) => item.pinned);
  saveHistory();
  broadcastHistory();
  return clipboardHistory;
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

ipcMain.handle('minimize-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (window) {
    window.minimize();
  }
});

ipcMain.handle('close-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.hide();
  }
});

app.whenReady().then(() => {
  loadHistory();
  syncClipboardTrackingState();
  createTray();
  createMainWindow();

  try {
    globalShortcut.register(settings.shortcut || 'CommandOrControl+Shift+V', () => {
      toggleWindow();
    });
  } catch {}

  pollingInterval = setInterval(checkClipboard, settings.pollInterval || POLL_MS);

  app.setLoginItemSettings({
    openAtLogin: settings.launchAtStartup,
    path: app.getPath('exe')
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  saveHistory();
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
