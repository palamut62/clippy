<p align="center">
  <img src="assets/icon.png" alt="Clippy" width="128" height="128">
</p>

<h1 align="center">Clippy</h1>

<p align="center">
  A lightweight, modern clipboard manager for Windows built with Electron.
</p>

<p align="center">
  <a href="https://github.com/palamut62/clippy/releases/latest"><img src="https://img.shields.io/github/v/release/palamut62/clippy?style=flat-square" alt="Latest Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/palamut62/clippy?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square" alt="Platform">
</p>

---

## Features

- **Clipboard History** — Automatically tracks text, rich text (HTML), images, and code snippets
- **Persistent Pins** — Pinned items are never deleted, surviving app restarts and system reboots
- **Smart Snippet Detection** — Automatically recognizes code blocks and marks them as snippets
- **Search & Filter** — Quickly find items by content, tags, or type (Text / Images / Snippets)
- **Tagging System** — Organize clipboard items with custom comma-separated tags
- **Global Shortcut** — Toggle the window instantly with `Ctrl+Shift+V`
- **System Tray** — Runs quietly in the background, always one click away
- **Dark Theme** — Clean, modern UI with a dark-first design
- **Compact Mode** — Switch between comfortable and compact list views
- **Keyboard Navigation** — Arrow keys to browse, Enter to paste, Ctrl+F to search

## Installation

Download the latest installer from the [Releases](https://github.com/palamut62/clippy/releases/latest) page.

Run `Clippy Setup x.x.x.exe` and follow the installer steps.

## Usage

| Action | Shortcut |
|---|---|
| Toggle window | `Ctrl+Shift+V` |
| Search | `Ctrl+F` |
| Navigate items | `↑` `↓` |
| Copy & close | `Enter` |

- **Pin** an item to keep it permanently at the top of the list
- **Tag** items with keywords for easy filtering
- **Double-click** any item to copy it to your clipboard
- **Clear** removes all unpinned items; pinned items are always preserved

## Build from Source

```bash
# Clone
git clone https://github.com/palamut62/clippy.git
cd clippy

# Install dependencies
npm install

# Run in development
npm start

# Build installer
npm run build
```

Requires [Node.js](https://nodejs.org/) 18+ and npm.

## Tech Stack

- [Electron](https://www.electronjs.org/) 40
- Vanilla JavaScript (no frameworks)
- Native Windows NSIS installer via electron-builder

## License

[MIT](LICENSE)
