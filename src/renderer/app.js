(() => {
  const state = {
    history: [],
    currentFilter: 'all',
    selectedId: null,
    trackingEnabled: true,
    compactMode: true
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
    btnMinimize: document.getElementById('btnMinimize'),
    btnClose: document.getElementById('btnClose'),
    btnPinAction: document.getElementById('btnPinAction'),
    btnCopyAction: document.getElementById('btnCopyAction'),
    btnPlainTextAction: document.getElementById('btnPlainTextAction'),
    btnSnippetAction: document.getElementById('btnSnippetAction'),
    btnDeleteAction: document.getElementById('btnDeleteAction'),
    trackingIndicator: document.getElementById('trackingIndicator'),
    statusText: document.getElementById('statusText')
  };

  const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  let toastTimeout = null;
  let isPersistingTags = false;

  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  document.body.appendChild(toast);

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

    template.content.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((node) => {
      node.remove();
    });

    template.content.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().toLowerCase();

        if (name.startsWith('on') || name === 'style') {
          node.removeAttribute(attribute.name);
        }

        if ((name === 'src' || name === 'href') && value.startsWith('javascript:')) {
          node.removeAttribute(attribute.name);
        }
      });
    });

    return template.innerHTML;
  }

  function truncate(value, length = 120) {
    if (value.length <= length) {
      return value;
    }

    return `${value.slice(0, length).trimEnd()}...`;
  }

  function parseTags(value) {
    return [...new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )];
  }

  function getItemText(item) {
    if (item.type === 'image') {
      return '';
    }

    return item.type === 'html' ? item.textPreview || '' : item.text || '';
  }

  function getImageSource(item, preferred = 'full') {
    if (item.type !== 'image') {
      return '';
    }

    const preferredUrl = preferred === 'full' ? item.fullDataUrl : item.previewDataUrl;
    const fallbackUrl = preferred === 'full' ? item.previewDataUrl : item.fullDataUrl;
    const preferredBase64 = preferred === 'full' ? item.fullPngBase64 : item.previewPngBase64;
    const fallbackBase64 = preferred === 'full' ? item.previewPngBase64 : item.fullPngBase64;

    if (preferredUrl) {
      return preferredUrl;
    }

    if (fallbackUrl) {
      return fallbackUrl;
    }

    if (preferredBase64) {
      return `data:image/png;base64,${preferredBase64}`;
    }

    if (fallbackBase64) {
      return `data:image/png;base64,${fallbackBase64}`;
    }

    return '';
  }

  function getDisplayType(item) {
    if (item.type === 'image') {
      return 'IMAGE';
    }

    if (item.isSnippet) {
      return 'SNIPPET';
    }

    return 'TEXT';
  }

  function getTitleText(item) {
    if (item.type === 'image') {
      return 'Image';
    }

    const content = getItemText(item).trim().replace(/\s+/g, ' ');
    return truncate(content || 'Clipboard item', 96);
  }

  function getSubtitleText(item) {
    if (item.type === 'image') {
      return `${item.width || '?'} x ${item.height || '?'}`;
    }

    const content = getItemText(item).trim().replace(/\s+/g, ' ');
    return truncate(content || 'No preview available', 104);
  }

  function matchesFilter(item) {
    if (state.currentFilter === 'all') {
      return true;
    }

    if (state.currentFilter === 'text') {
      return item.type !== 'image' && !item.isSnippet;
    }

    if (state.currentFilter === 'image') {
      return item.type === 'image';
    }

    return item.isSnippet;
  }

  function matchesSearch(item, query) {
    if (!query) {
      return true;
    }

    const haystack = [
      getItemText(item),
      ...(item.tags || []),
      getDisplayType(item),
      item.type
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  }

  function getFilteredItems() {
    const query = elements.searchInput.value.trim().toLowerCase();
    return state.history.filter((item) => matchesFilter(item) && matchesSearch(item, query));
  }

  function getSelectedItem(filteredItems = getFilteredItems()) {
    return filteredItems.find((item) => item.id === state.selectedId) || null;
  }

  function ensureSelected(filteredItems) {
    if (!filteredItems.length) {
      state.selectedId = null;
      return;
    }

    if (!filteredItems.some((item) => item.id === state.selectedId)) {
      state.selectedId = filteredItems[0].id;
    }
  }

  function updateTrackingUi() {
    elements.trackingIndicator.classList.toggle('is-active', state.trackingEnabled);
    elements.statusText.textContent = state.trackingEnabled
      ? 'Live clipboard tracking'
      : 'Clipboard tracking paused';
    elements.btnCompact.classList.toggle('header-pill-active', state.compactMode);
  }

  function renderEmptyHistory() {
    elements.historyList.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon"></div>
        <h2>No clipboard items yet</h2>
        <p>Copy text, images, or code snippets to see them here.</p>
      </div>
    `;
  }

  function renderHistoryList(filteredItems) {
    if (!filteredItems.length) {
      renderEmptyHistory();
      return;
    }

    elements.historyList.innerHTML = filteredItems.map((item) => {
      const hasThumb = item.type === 'image';
      const selectedClass = item.id === state.selectedId ? ' is-selected' : '';
      const pinnedMarkup = item.pinned
        ? `
          <span class="history-pin-icon" title="Pinned" aria-label="Pinned">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 4.5a2.5 2.5 0 0 0-3.54 0l-.63.63l-1.4 1.4l-2.3.46a1 1 0 0 0-.54 1.68l2.74 2.74l-4.6 6.15a.9.9 0 1 0 1.44 1.08l6.15-4.6l2.74 2.74a1 1 0 0 0 1.68-.54l.46-2.3l1.4-1.4l.63-.63A2.5 2.5 0 0 0 19.5 8.5L15 4.5Z" fill="currentColor"/>
            </svg>
          </span>
        `
        : '';
      const thumbMarkup = hasThumb
        ? `
          <div class="history-thumb">
            <img class="history-thumb-image" src="${getImageSource(item, 'preview')}" alt="Clipboard image preview">
          </div>
        `
        : '';

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
                <span class="history-label">${hasThumb ? 'Image' : getDisplayType(item) === 'SNIPPET' ? 'Snippet' : 'Text'}</span>
              </div>
              <span class="type-badge">${getDisplayType(item) === 'SNIPPET' ? 'TEXT' : getDisplayType(item)}</span>
            </div>
          </div>
        </button>
      `;
    }).join('');

    elements.historyList.querySelectorAll('.history-card').forEach((card) => {
      card.addEventListener('click', () => {
        state.selectedId = card.dataset.id;
        render();
      });

      card.addEventListener('dblclick', async () => {
        const item = state.history.find((entry) => entry.id === card.dataset.id);
        if (!item) {
          return;
        }

        const ok = await window.clippy.copyItem(item);
        if (ok) {
          showToast('Panoya kopyalandi');
        }
      });
    });
  }

  function renderTagList(tags) {
    if (!tags.length) {
      elements.tagList.innerHTML = '<span class="tag-empty"></span>';
      return;
    }

    elements.tagList.innerHTML = tags
      .map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
      .join('');
  }

  function renderPreview(item) {
    if (item.type === 'image') {
      const imageSource = getImageSource(item, 'full');

      if (!imageSource) {
        elements.previewBox.innerHTML = '<div class="image-preview-empty">Image preview unavailable</div>';
        return;
      }

      elements.previewBox.innerHTML = `<img class="detail-image" src="${imageSource}" alt="Clipboard image preview">`;
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
    elements.btnPinAction.textContent = 'Pin / Unpin';
    elements.btnSnippetAction.textContent = item.isSnippet ? 'Remove from snippets' : 'Add to snippets';

    renderTagList(item.tags || []);
    renderPreview(item);
  }

  function render() {
    const filteredItems = getFilteredItems();
    ensureSelected(filteredItems);
    renderHistoryList(filteredItems);
    renderDetail(getSelectedItem(filteredItems));
    updateTrackingUi();
    document.body.classList.toggle('compact-mode', state.compactMode);
  }

  async function persistTags() {
    if (!state.selectedId || isPersistingTags) {
      return;
    }

    const selectedItem = getSelectedItem();
    const nextTags = parseTags(elements.tagInput.value);
    const currentTags = (selectedItem?.tags || []).join('|');

    if (currentTags === nextTags.join('|')) {
      return;
    }

    isPersistingTags = true;

    try {
      state.history = await window.clippy.setItemTags(state.selectedId, nextTags);
      render();
      showToast('Etiketler guncellendi');
    } finally {
      isPersistingTags = false;
    }
  }

  function moveSelection(step) {
    const filteredItems = getFilteredItems();
    if (!filteredItems.length) {
      return;
    }

    const currentIndex = filteredItems.findIndex((item) => item.id === state.selectedId);
    const nextIndex = currentIndex === -1
      ? 0
      : Math.max(0, Math.min(filteredItems.length - 1, currentIndex + step));

    state.selectedId = filteredItems[nextIndex].id;
    render();

    const selectedCard = elements.historyList.querySelector(`[data-id="${state.selectedId}"]`);
    if (selectedCard) {
      selectedCard.scrollIntoView({ block: 'nearest' });
    }
  }

  async function runSelectedAction(action) {
    const item = getSelectedItem();
    if (!item) {
      return;
    }

    if (action === 'copy') {
      const ok = await window.clippy.copyItem(item);
      if (ok) {
        showToast('Panoya kopyalandi');
      }
      return;
    }

    if (action === 'plain') {
      const ok = await window.clippy.copyItemPlain(item);
      if (ok) {
        showToast('Duz metin kopyalandi');
      }
      return;
    }

    if (action === 'pin') {
      state.history = await window.clippy.pinItem(item.id);
      render();
      showToast(item.pinned ? 'Sabit kaldirildi' : 'Sabitlendi');
      return;
    }

    if (action === 'snippet') {
      state.history = await window.clippy.toggleSnippet(item.id);
      render();
      showToast(item.isSnippet ? 'Snippet kaldirildi' : 'Snippet eklendi');
      return;
    }

    if (action === 'delete') {
      state.history = await window.clippy.deleteItem(item.id);
      render();
      showToast('Oge silindi');
    }
  }

  function bindEvents() {
    elements.searchInput.addEventListener('input', () => {
      render();
    });

    elements.filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        elements.filterChips.forEach((button) => button.classList.remove('active'));
        chip.classList.add('active');
        state.currentFilter = chip.dataset.filter;
        render();
      });
    });

    elements.tagInput.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        await persistTags();
      }
    });

    elements.tagInput.addEventListener('blur', async () => {
      await persistTags();
    });

    elements.btnSettings.addEventListener('click', () => {
      window.clippy.openSettings();
    });

    elements.btnCompact.addEventListener('click', () => {
      state.compactMode = !state.compactMode;
      render();
    });

    elements.btnClear.addEventListener('click', async () => {
      state.history = await window.clippy.clearHistory();
      render();
      showToast('Gecmis temizlendi');
    });

    elements.btnMinimize.addEventListener('click', () => {
      window.clippy.minimizeWindow();
    });

    elements.btnClose.addEventListener('click', () => {
      window.clippy.closeWindow();
    });

    elements.btnPinAction.addEventListener('click', async () => {
      await runSelectedAction('pin');
    });

    elements.btnCopyAction.addEventListener('click', async () => {
      await runSelectedAction('copy');
    });

    elements.btnPlainTextAction.addEventListener('click', async () => {
      await runSelectedAction('plain');
    });

    elements.btnSnippetAction.addEventListener('click', async () => {
      await runSelectedAction('snippet');
    });

    elements.btnDeleteAction.addEventListener('click', async () => {
      await runSelectedAction('delete');
    });

    document.addEventListener('keydown', async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        elements.searchInput.focus();
        elements.searchInput.select();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
        return;
      }

      if (event.key === 'Enter' && document.activeElement !== elements.tagInput) {
        event.preventDefault();
        const selectedItem = getSelectedItem();
        if (!selectedItem) {
          return;
        }

        const ok = await window.clippy.copyItem(selectedItem);
        if (ok) {
          showToast('Secili oge panoya alindi');
          window.clippy.closeWindow();
        }
      }
    });

    window.clippy.onHistoryUpdated((history) => {
      state.history = history;
      render();
    });

    window.clippy.onTrackingUpdated((enabled) => {
      state.trackingEnabled = enabled;
      render();
    });
  }

  async function init() {
    const settings = await window.clippy.getSettings();
    state.history = await window.clippy.getHistory();
    state.trackingEnabled = await window.clippy.getTrackingState();
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
    bindEvents();
    render();
    elements.searchInput.focus();
  }

  init();
})();
