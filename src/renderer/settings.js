// Clippy - Settings Renderer
(async () => {
  let settings = await window.clippy.getSettings();

  // Apply theme
  document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

  // Theme buttons
  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    if (btn.dataset.theme === settings.theme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', async () => {
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      settings.theme = btn.dataset.theme;
      document.documentElement.setAttribute('data-theme', settings.theme);
      await window.clippy.saveSettings(settings);
    });
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
  const shortcutDisplay = document.getElementById('shortcutDisplay');
  shortcutDisplay.textContent = (settings.shortcut || 'CommandOrControl+Shift+V')
    .replace('CommandOrControl', 'Ctrl');

  // Close
  document.getElementById('btnClose').addEventListener('click', () => {
    window.clippy.closeWindow();
  });
})();
