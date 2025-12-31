# Search Shortlist Plugin for Obsidian

Navigate search results with your keyboard and build a shortlist of tabs - all without touching your mouse.

## The Problem This Solves

Obsidian's default search doesn't let you:
- Navigate through search results with arrow keys
- Preview results as you navigate
- Quickly open multiple results as tabs for later review

This plugin fixes all of that.

## How It Works

### The Workflow

1. **Open search** (`Ctrl+Shift+F`) and search for something
2. **Click in the search results area** (or tab to it)
3. **Press ↓ or ↑** to navigate through results
4. **A preview tab updates** automatically as you arrow through results
5. **Press `Ctrl+Enter`** to open the current result in a **new tab**
6. **Keep navigating and adding** - you're building your shortlist!
7. **Pin your preview tab** if you want to keep it separate from new tabs

### Simple Example

```
Search Panel (Side)          Preview Tab (Updates)         Shortlist Tabs
┌──────────────┐            ┌──────────────┐             ┌────┬────┬────┐
│ 🔍 "python"  │            │  File A      │             │ B  │ C  │ D  │
│              │   ↓/↑      │  (preview)   │  Ctrl+Enter │    │    │    │
│ ▶ File A     │ ────────>  │              │ ─────────>  │    │    │    │
│   File B     │            │              │             │    │    │    │
│   File C     │            │              │             └────┴────┴────┘
│   File D     │            └──────────────┘
└──────────────┘
```

## Features

### ✅ Keyboard Navigation in Search Results
- Use **↑** and **↓** arrow keys to navigate through search results
- Results preview automatically in a tab as you navigate
- No mouse needed!

### ✅ Build a Shortlist with Ctrl+Enter
- Press **`Ctrl+Enter`** (or `Cmd+Enter` on Mac) to open current result in a new tab
- Keeps focus in the search panel so you can keep navigating
- Build up a collection of tabs to review later

### ✅ Pin Your Preview Tab
- Use Obsidian's native pin feature to keep your preview tab separate
- Once pinned, Ctrl+Enter opens results in new tabs instead of replacing the preview
- Great for keeping your workspace organized

## Installation

### Manual Installation

1. Download or build the plugin files (`main.js`, `manifest.json`, `styles.css`)
2. Create folder: `YourVault/.obsidian/plugins/search-shortlist/`
3. Copy the files into that folder
4. Reload Obsidian
5. Enable "Search Shortlist" in Settings → Community Plugins

### Building from Source

```bash
cd search-shortlist-plugin
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder.

## Development

### Local Testing Setup

This project uses a Makefile-based workflow for syncing to your Obsidian vault (similar to other Obsidian asset workflows).

**Quick Start:**

1. **Set up your vault path:**
   ```bash
   # Option A: Create config.env file
   cp config.env.example config.env
   # Edit config.env and set DEV_VAULT_DIR
   
   # Option B: Use environment variable
   export OBSIDIAN_VAULT_PATH="/path/to/your/vault"
   ```

2. **Build and sync once:**
   ```bash
   make sync-dev
   ```

3. **Watch mode (auto-build and sync on changes):**
   ```bash
   make watch-plugin
   ```

**Available Make Commands:**

- `make build` - Build the plugin once
- `make sync-dev` - Build and sync to DEV vault
- `make sync-prod` - Build and sync to PROD vault  
- `make watch-plugin` - Watch for changes, auto-build and sync to DEV vault

**Alternative: Using sync.sh directly:**

```bash
# Build first
npm run build

# Then sync specific plugin files
./sync.sh dev main.js manifest.json styles.css

# Or sync all (if you have other assets)
./sync.sh dev
```

**Using sync-files.txt:**

You can list files to sync in `sync-files.txt`:
```bash
./sync.sh dev @sync-files.txt
```

After syncing, reload Obsidian (`Ctrl/Cmd+R`) to see your changes.

### Available npm Scripts

- `npm run dev` - Start esbuild in watch mode (rebuilds on changes, no sync)
- `npm run build` - Build for production

## Usage Guide

### Step-by-Step

1. **Open Search**
   - Press `Ctrl+Shift+F` (or `Cmd+Shift+F` on Mac)
   - Type your search query

2. **Start Navigating**
   - Click in the search results area (or press Tab until you're in the results)
   - Press **↓** to move to the first result
   - A preview tab opens automatically

3. **Browse Results**
   - Use **↑** and **↓** to navigate through results
   - Watch the preview tab update with each result

4. **Add to Shortlist**
   - When you find something interesting, press **`Ctrl+Enter`**
   - It opens in a new tab
   - Focus stays in search so you can keep going

5. **Review Your Shortlist**
   - Use `Ctrl+Tab` to switch between your opened tabs
   - All your interesting results are now in tabs for review

### Pro Tips

**Pin the preview tab**: Right-click the preview tab → "Pin". Now your preview stays separate and Ctrl+Enter always creates new tabs.

**Multiple searches**: Run different searches and add results from each to your growing collection of tabs.

**Close unwanted tabs**: While navigating, if you accidentally Ctrl+Enter something, just close that tab and keep going.

## Keyboard Shortcuts

| Action | Key |
|--------|-----|
| Navigate Down | `↓` |
| Navigate Up | `↑` |
| Open in New Tab | `Ctrl+Enter` (or `Cmd+Enter`) |

That's it! No complex shortcuts to remember.

## Troubleshooting

### Arrow keys aren't working?
Make sure you've clicked in the search results area first. The search panel needs focus.

### Preview not updating?
This is normal on the first press - press arrow down/up one more time and it should start working.

### Ctrl+Enter not working?
Ensure you're focused in the search panel (click in the results area if needed).

## Why This Plugin?

Because the workflow "search → browse results → pick several → review later" is incredibly common, but Obsidian makes it unnecessarily hard. This plugin makes it natural and keyboard-driven.

## License

MIT

## Feedback

Found a bug or have suggestions? Open an issue on GitHub!

