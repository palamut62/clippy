(() => {
  const state = {
    history: [],
    currentFilter: 'all',
    selectedId: null,
    trackingEnabled: true,
    compactMode: true,
    theme: 'dark',
    language: 'tr'
  };

  const elements = {
    historyList: document.getElementById('historyList'),
    searchInput: document.getElementById('searchInput'),
    filterChips: [...document.querySelectorAll('.filter-chip')],
    detailEmpty: document.getElementById('detailEmpty'),
    detailView: document.getElementById('detailView'),
    detailType: document.getElementById('detailType'),
    detailPinned: document.getElementById('detailPinned'),
    detailTitle: document.getElementById('detailTitle'),
    detailTimestamp: document.getElementById('detailTimestamp'),
    previewBox: document.getElementById('previewBox'),
    tagInput: document.getElementById('tagInput'),
    tagList: document.getElementById('tagList'),
    btnSettings: document.getElementById('btnSettings'),
    btnCompact: document.getElementById('btnCompact'),
    btnClear: document.getElementById('btnClear'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    btnLangToggle: document.getElementById('btnLangToggle'),
    langLabel: document.getElementById('langLabel'),
    btnMinimize: document.getElementById('btnMinimize'),
    btnClose: document.getElementById('btnClose'),
    btnPinAction: document.getElementById('btnPinAction'),
    btnCopyAction: document.getElementById('btnCopyAction'),
    btnPlainTextAction: document.getElementById('btnPlainTextAction'),
    btnSnippetAction: document.getElementById('btnSnippetAction'),
    btnDeleteAction: document.getElementById('btnDeleteAction'),
    trackingIndicator: document.getElementById('trackingIndicator'),
    statusText: document.getElementById('statusText'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptyDesc: document.getElementById('emptyDesc'),
    shortcutText: document.getElementById('shortcutText'),
    themeIconSun: document.getElementById('themeIconSun'),
    themeIconMoon: document.getElementById('themeIconMoon'),
    pressLabel: document.getElementById('pressLabel'),
    pasteLabel: document.getElementById('pasteLabel')
  };

  let toastTimeout = null;
  let isPersistingTags = false;

  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  document.body.appendChild(toast);

  function i(key) {
    return t(key, state.language);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 1400);
  }

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = value;
    return node.innerHTML;
  }

  function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((n) => n.remove());
    template.content.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith('on') || name === 'style') node.removeAttribute(attr.name);
        if ((name === 'src' || name === 'href') && value.startsWith('javascript:')) node.removeAttribute(attr.name);
      });
    });
    return template.innerHTML;
  }

  function truncate(value, length = 120) {
    return value.length <= length ? value : `${value.slice(0, length).trimEnd()}...`;
  }

  function parseTags(value) {
    return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))];
  }

  function getItemText(item) {
    if (item.type === 'image') return '';
    return item.type === 'html' ? item.textPreview || '' : item.text || '';
  }

  function getImageSource(item, preferred = 'full') {
    if (item.type !== 'image') return '';
    const pUrl = preferred === 'full' ? item.fullDataUrl : item.previewDataUrl;
    const fUrl = preferred === 'full' ? item.previewDataUrl : item.fullDataUrl;
    const pB64 = preferred === 'full' ? item.fullPngBase64 : item.previewPngBase64;
    const fB64 = preferred === 'full' ? item.previewPngBase64 : item.fullPngBase64;
    if (pUrl) return pUrl;
    if (fUrl) return fUrl;
    if (pB64) return `data:image/png;base64,${pB64}`;
    if (fB64) return `data:image/png;base64,${fB64}`;
    return '';
  }

  function getDisplayType(item) {
    if (item.type === 'image') return 'IMAGE';
    if (item.isSnippet) return 'SNIPPET';
    return 'TEXT';
  }

  function getTitleText(item) {
    if (item.type === 'image') return i('imageLabel');
    const content = getItemText(item).trim().replace(/\s+/g, ' ');
    return truncate(content || i('clipboardItem'), 96);
  }

  function getSubtitleText(item) {
    if (item.type === 'image') return `${item.width || '?'} x ${item.height || '?'}`;
    const content = getItemText(item).trim().replace(/\s+/g, ' ');
    return truncate(content || i('noPreview'), 104);
  }

  function matchesFilter(item) {
    if (state.currentFilter === 'all') return true;
    if (state.currentFilter === 'text') return item.type !== 'image' && !item.isSnippet;
    if (state.currentFilter === 'image') return item.type === 'image';
    return item.isSnippet;
  }

  function matchesSearch(item, query) {
    if (!query) return true;
    return [getItemText(item), ...(item.tags || []), getDisplayType(item), item.type].join(' ').toLowerCase().includes(query);
  }

  function getFilteredItems() {
    const query = elements.searchInput.value.trim().toLowerCase();
    return state.history.filter((item) => matchesFilter(item) && matchesSearch(item, query));
  }

  function getSelectedItem(filteredItems = getFilteredItems()) {
    return filteredItems.find((item) => item.id === state.selectedId) || null;
  }

  function ensureSelected(filteredItems) {
    if (!filteredItems.length) { state.selectedId = null; return; }
    if (!filteredItems.some((item) => item.id === state.selectedId)) {
      state.selectedId = filteredItems[0].id;
    }
  }

  function applyThemeIcons() {
    const isDark = state.theme === 'dark';
    elements.themeIconSun.style.display = isDark ? 'none' : 'block';
    elements.themeIconMoon.style.display = isDark ? 'block' : 'none';
  }

  function updateI18nLabels() {
    const lang = state.language;
    elements.langLabel.textContent = lang.toUpperCase();
    elements.searchInput.placeholder = i('searchPlaceholder');
    elements.tagInput.placeholder = i('tagPlaceholder');
    elements.emptyTitle.textContent = i('selectItem');
    elements.emptyDesc.textContent = i('selectItemDesc');
    elements.shortcutText.textContent = i('toggle');
    elements.btnCompact.textContent = i('compact');
    elements.btnClear.textContent = i('clear');
    elements.pressLabel.textContent = 'Press';
    elements.pasteLabel.textContent = i('pressTo');

    // Filter chips
    const filterLabels = { all: i('all'), text: i('text'), image: i('images'), snippet: i('snippets') };
    elements.filterChips.forEach((chip) => {
      chip.textContent = filterLabels[chip.dataset.filter] || chip.dataset.filter;
    });
  }

  function updateTrackingUi() {
    elements.trackingIndicator.classList.toggle('is-active', state.trackingEnabled);
    elements.statusText.textContent = state.trackingEnabled ? i('liveTracking') : i('pausedTracking');
    elements.btnCompact.classList.toggle('header-pill-active', state.compactMode);
  }

  function renderEmptyHistory() {
    elements.historyList.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon"></div>
        <h2>${escapeHtml(i('noItems'))}</h2>
        <p>${escapeHtml(i('noItemsDesc'))}</p>
      </div>
    `;
  }

  const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  function renderHistoryList(filteredItems) {
    if (!filteredItems.length) { renderEmptyHistory(); return; }

    elements.historyList.innerHTML = filteredItems.map((item) => {
      const hasThumb = item.type === 'image';
      const selectedClass = item.id === state.selectedId ? ' is-selected' : '';
      const pinnedMarkup = item.pinned
        ? `<span class="history-pin-icon" title="${i('pinned')}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M15 4.5a2.5 2.5 0 0 0-3.54 0l-.63.63l-1.4 1.4l-2.3.46a1 1 0 0 0-.54 1.68l2.74 2.74l-4.6 6.15a.9.9 0 1 0 1.44 1.08l6.15-4.6l2.74 2.74a1 1 0 0 0 1.68-.54l.46-2.3l1.4-1.4l.63-.63A2.5 2.5 0 0 0 19.5 8.5L15 4.5Z" fill="currentColor"/></svg>
          </span>`
        : '';
      const thumbMarkup = hasThumb
        ? `<div class="history-thumb"><img class="history-thumb-image" src="${getImageSource(item, 'preview')}" alt=""></div>`
        : '';
      const typeLabel = hasThumb ? i('imageLabel') : getDisplayType(item) === 'SNIPPET' ? i('snippetLabel') : i('textLabel');

      return `
        <button class="history-card${selectedClass}${hasThumb ? ' has-thumb' : ''}" type="button" data-id="${item.id}">
          <div class="history-inner">
            ${thumbMarkup}
            <div class="history-copy">
              <div class="history-title">${escapeHtml(getTitleText(item))}</div>
              <div class="history-subtitle">${escapeHtml(getSubtitleText(item))}</div>
            </div>
            <div class="history-side">
              <div class="history-side-top">
                ${pinnedMarkup}
                <span class="history-label">${escapeHtml(typeLabel)}</span>
              </div>
            </div>
          </div>
        </button>
      `;
    }).join('');

    elements.historyList.querySelectorAll('.history-card').forEach((card) => {
      card.addEventListener('click', () => { state.selectedId = card.dataset.id; render(); });
      card.addEventListener('dblclick', async () => {
        const item = state.history.find((e) => e.id === card.dataset.id);
        if (!item) return;
        const ok = await window.clippy.copyItem(item);
        if (ok) showToast(i('toastCopied'));
      });
    });
  }

  function renderTagList(tags) {
    if (!tags.length) { elements.tagList.innerHTML = ''; return; }
    elements.tagList.innerHTML = tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('');
  }

  function renderPreview(item) {
    if (item.type === 'image') {
      const src = getImageSource(item, 'full');
      elements.previewBox.innerHTML = src
        ? `<img class="detail-image" src="${src}" alt="">`
        : `<div class="image-preview-empty">${escapeHtml(i('imagePreviewUnavailable'))}</div>`;
      return;
    }
    if (item.isSnippet) {
      elements.previewBox.innerHTML = `<pre class="code-preview"><code>${escapeHtml(getItemText(item))}</code></pre>`;
      return;
    }
    if (item.type === 'html' && item.html) {
      elements.previewBox.innerHTML = `<div class="rich-preview">${sanitizeHtml(item.html)}</div>`;
      return;
    }
    elements.previewBox.innerHTML = `<div class="text-preview">${escapeHtml(getItemText(item))}</div>`;
  }

  function renderDetail(item) {
    if (!item) {
      elements.detailEmpty.classList.remove('is-hidden');
      elements.detailView.classList.add('is-hidden');
      elements.btnPinAction.disabled = true;
      elements.btnCopyAction.disabled = true;
      elements.btnPlainTextAction.disabled = true;
      elements.btnSnippetAction.disabled = true;
      elements.btnDeleteAction.disabled = true;
      elements.tagInput.disabled = true;
      elements.tagInput.value = '';
      elements.tagList.innerHTML = '';
      elements.previewBox.innerHTML = '';
      return;
    }

    elements.detailEmpty.classList.add('is-hidden');
    elements.detailView.classList.remove('is-hidden');
    elements.detailType.textContent = item.type === 'image' ? 'IMAGE' : 'TEXT';
    elements.detailTitle.textContent = `"${getTitleText(item)}"`;
    elements.detailTimestamp.textContent = dateFormatter.format(item.createdAt);
    elements.detailPinned.textContent = i('pinned');
    elements.detailPinned.classList.toggle('is-hidden', !item.pinned);
    elements.tagInput.disabled = false;
    if (document.activeElement !== elements.tagInput) {
      elements.tagInput.value = (item.tags || []).join(', ');
    }
    elements.btnPinAction.disabled = false;
    elements.btnCopyAction.disabled = false;
    elements.btnPlainTextAction.disabled = item.type === 'image';
    elements.btnSnippetAction.disabled = item.type === 'image';
    elements.btnDeleteAction.disabled = false;
    elements.btnPinAction.textContent = i('pinUnpin');
    elements.btnCopyAction.textContent = i('copy');
    elements.btnPlainTextAction.textContent = i('plainText');
    elements.btnSnippetAction.textContent = item.isSnippet ? i('removeSnippet') : i('addSnippet');
    elements.btnDeleteAction.textContent = i('delete');

    renderTagList(item.tags || []);
    renderPreview(item);
  }

  function render() {
    const filteredItems = getFilteredItems();
    ensureSelected(filteredItems);
    renderHistoryList(filteredItems);
    renderDetail(getSelectedItem(filteredItems));
    updateTrackingUi();
    updateI18nLabels();
    applyThemeIcons();
    document.body.classList.toggle('compact-mode', state.compactMode);
  }

  async function persistTags() {
    if (!state.selectedId || isPersistingTags) return;
    const selectedItem = getSelectedItem();
    const nextTags = parseTags(elements.tagInput.value);
    if ((selectedItem?.tags || []).join('|') === nextTags.join('|')) return;
    isPersistingTags = true;
    try {
      state.history = await window.clippy.setItemTags(state.selectedId, nextTags);
      render();
      showToast(i('toastTagsUpdated'));
    } finally { isPersistingTags = false; }
  }

  function moveSelection(step) {
    const filteredItems = getFilteredItems();
    if (!filteredItems.length) return;
    const idx = filteredItems.findIndex((item) => item.id === state.selectedId);
    const next = idx === -1 ? 0 : Math.max(0, Math.min(filteredItems.length - 1, idx + step));
    state.selectedId = filteredItems[next].id;
    render();
    const card = elements.historyList.querySelector(`[data-id="${state.selectedId}"]`);
    if (card) card.scrollIntoView({ block: 'nearest' });
  }

  async function runSelectedAction(action) {
    const item = getSelectedItem();
    if (!item) return;

    if (action === 'copy') {
      if (await window.clippy.copyItem(item)) showToast(i('toastCopied'));
      return;
    }
    if (action === 'plain') {
      if (await window.clippy.copyItemPlain(item)) showToast(i('toastPlain'));
      return;
    }
    if (action === 'pin') {
      state.history = await window.clippy.pinItem(item.id);
      render();
      showToast(item.pinned ? i('toastUnpinned') : i('toastPinned'));
      return;
    }
    if (action === 'snippet') {
      state.history = await window.clippy.toggleSnippet(item.id);
      render();
      showToast(item.isSnippet ? i('toastSnippetRemoved') : i('toastSnippetAdded'));
      return;
    }
    if (action === 'delete') {
      state.history = await window.clippy.deleteItem(item.id);
      render();
      showToast(i('toastDeleted'));
    }
  }

  async function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    applyThemeIcons();
    const settings = await window.clippy.getSettings();
    settings.theme = state.theme;
    await window.clippy.saveSettings(settings);
  }

  async function toggleLanguage() {
    state.language = state.language === 'tr' ? 'en' : 'tr';
    const settings = await window.clippy.getSettings();
    settings.language = state.language;
    await window.clippy.saveSettings(settings);
    render();
  }

  function bindEvents() {
    elements.searchInput.addEventListener('input', () => render());

    elements.filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        elements.filterChips.forEach((b) => b.classList.remove('active'));
        chip.classList.add('active');
        state.currentFilter = chip.dataset.filter;
        render();
      });
    });

    elements.tagInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') { e.preventDefault(); await persistTags(); }
    });
    elements.tagInput.addEventListener('blur', () => persistTags());

    elements.btnSettings.addEventListener('click', () => window.clippy.openSettings());
    elements.btnCompact.addEventListener('click', () => { state.compactMode = !state.compactMode; render(); });
    elements.btnClear.addEventListener('click', async () => {
      state.history = await window.clippy.clearHistory();
      render();
      showToast(i('toastCleared'));
    });

    elements.btnThemeToggle.addEventListener('click', () => toggleTheme());
    elements.btnLangToggle.addEventListener('click', () => toggleLanguage());

    elements.btnMinimize.addEventListener('click', () => window.clippy.minimizeWindow());
    elements.btnClose.addEventListener('click', () => window.clippy.closeWindow());
    elements.btnPinAction.addEventListener('click', () => runSelectedAction('pin'));
    elements.btnCopyAction.addEventListener('click', () => runSelectedAction('copy'));
    elements.btnPlainTextAction.addEventListener('click', () => runSelectedAction('plain'));
    elements.btnSnippetAction.addEventListener('click', () => runSelectedAction('snippet'));
    elements.btnDeleteAction.addEventListener('click', () => runSelectedAction('delete'));

    document.addEventListener('keydown', async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        elements.searchInput.focus();
        elements.searchInput.select();
        return;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); return; }
      if (e.key === 'Enter' && document.activeElement !== elements.tagInput) {
        e.preventDefault();
        const sel = getSelectedItem();
        if (!sel) return;
        if (await window.clippy.copyItem(sel)) {
          showToast(i('toastSelectedCopied'));
          window.clippy.closeWindow();
        }
      }
    });

    window.clippy.onHistoryUpdated((history) => { state.history = history; render(); });
    window.clippy.onTrackingUpdated((enabled) => { state.trackingEnabled = enabled; render(); });
  }

  async function init() {
    const settings = await window.clippy.getSettings();
    state.history = await window.clippy.getHistory();
    state.trackingEnabled = await window.clippy.getTrackingState();
    state.theme = settings.theme || 'dark';
    state.language = settings.language || 'tr';
    document.documentElement.setAttribute('data-theme', state.theme);
    bindEvents();
    render();
    elements.searchInput.focus();
  }

  init();
})();
