// Clippy - Settings Renderer
(async () => {
  let settings = await window.clippy.getSettings();
  let lang = settings.language || 'tr';

  function i(key) { return t(key, lang); }

  function applyI18n() {
    document.getElementById('settingsTitle').textContent = i('settings');
    document.getElementById('settingsSubtitle').textContent = i('settingsDesc');
    document.getElementById('themeTitle').textContent = i('theme');
    document.getElementById('themeDesc').textContent = i('themeDesc');
    document.getElementById('darkLabel').textContent = i('dark');
    document.getElementById('lightLabel').textContent = i('light');
    document.getElementById('langTitle').textContent = i('language');
    document.getElementById('langDesc').textContent = i('languageDesc');
    document.getElementById('historyTitle').textContent = i('historyLimit');
    document.getElementById('historyDesc').textContent = i('historyLimitDesc');
    document.getElementById('shortcutTitle').textContent = i('shortcut');
    document.getElementById('shortcutDesc').textContent = i('shortcutDesc');
    document.getElementById('startupTitle').textContent = i('startWithWindows');
    document.getElementById('startupDesc').textContent = i('startWithWindowsDesc');
    document.getElementById('infoDesc').textContent = i('lightweight');
  }

  // Apply theme
  document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

  // Theme buttons
  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    if (btn.dataset.theme === settings.theme) btn.classList.add('active');
    else btn.classList.remove('active');

    btn.addEventListener('click', async () => {
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      settings.theme = btn.dataset.theme;
      document.documentElement.setAttribute('data-theme', settings.theme);
      await window.clippy.saveSettings(settings);
    });
  });

  // Language
  const langSelect = document.getElementById('languageSelect');
  langSelect.value = lang;
  langSelect.addEventListener('change', async () => {
    lang = langSelect.value;
    settings.language = lang;
    await window.clippy.saveSettings(settings);
    applyI18n();
  });

  // Max history
  const maxHistorySelect = document.getElementById('maxHistory');
  maxHistorySelect.value = settings.maxHistory || 50;
  maxHistorySelect.addEventListener('change', async () => {
    settings.maxHistory = parseInt(maxHistorySelect.value);
    await window.clippy.saveSettings(settings);
  });

  // Launch at startup
  const launchCheckbox = document.getElementById('launchAtStartup');
  launchCheckbox.checked = settings.launchAtStartup !== false;
  launchCheckbox.addEventListener('change', async () => {
    settings.launchAtStartup = launchCheckbox.checked;
    await window.clippy.saveSettings(settings);
  });

  // Shortcut display
  document.getElementById('shortcutDisplay').textContent =
    (settings.shortcut || 'CommandOrControl+Shift+V').replace('CommandOrControl', 'Ctrl');

  // Close
  document.getElementById('btnClose').addEventListener('click', () => {
    window.clippy.closeWindow();
  });

  applyI18n();
})();
