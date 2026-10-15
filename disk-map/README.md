# Disk Map

Find out what's filling your Mac, and clean it up.

Disk Map scans your home folder, finds caches and build junk, and opens an interactive map in your browser. You tick what to remove and copy a cleanup script. Nothing is deleted until you run that script yourself.

## Run it

```bash
python3 disk-map/diskmap.py
```

No installs needed. It uses the Python that ships with macOS. A full scan takes a minute or two.

- `--demo` opens the page with sample data
- `--root PATH` scans a different folder
- `--out FILE` saves the report somewhere else
- `--no-open` skips opening the browser

For a complete scan, give Terminal **Full Disk Access** (System Settings → Privacy & Security). Without it some folders are skipped and the scan says how many.

## What it finds

**Safe to remove** (rebuilt or re-downloaded when needed): npm, Yarn, pnpm and Bun caches, Gradle caches, Xcode DerivedData, uv/pip/Puppeteer/Playwright caches, Homebrew downloads, CocoaPods and Go caches, Next.js `.next` and Turbo `.turbo` build folders, the Trash.

**Review first** (you might still want these): Android SDK and emulators, Ollama models (removed with `ollama rm`), other local AI models, iOS simulators and DeviceSupport, Docker images, Claude Code worktrees, `node_modules` in projects untouched for 30+ days, and downloads over 100 MB not opened in 90 days.

## Using the page

- **Explorer**: tiles are sized by space used. Click one to open it. Switch to **Cleanup** to see only what can go.
- **Recommendations**: safe items start ticked. Open an item with the arrow to see every path and the exact commands.
- **Copy script**: copies a bash script for the ticked items. Read it, then run `pbpaste | bash` in Terminal.

The report is saved as `disk-map/diskmap-report.html` and contains your folder names, so it's ignored by git.
