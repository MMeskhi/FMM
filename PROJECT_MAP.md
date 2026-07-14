# FMM — Project Map

A desktop music player built with Electron + React + TypeScript.
This file is a living doc — edit it yourself as things change.

## Is there a backend? Is it Node.js?

**Yes, and it already is Node.js.** Electron apps don't have a separate
backend server like a typical web app (no Express, no API routes, no
database server). Instead:

- The **main process** (`src/main.ts`) runs full Node.js. This *is* your
  backend — it has filesystem access, can spawn native dialogs, and is
  the only place with OS-level privileges.
- The **renderer** (your React UI) runs in a Chromium window with *no*
  Node access, for security. It can only ask the main process to do
  things by sending messages over IPC.
- The **preload script** (`src/preload.ts`) is the bridge between them —
  it exposes a small, explicit API (`window.api.selectMusicFolder()`)
  from main to renderer via `contextBridge`.

So "front end" and "back end" here are `src/renderer` (React) and
`src/main.ts` (Node), living in the same app, same repo, same process
tree — just two separate JS execution contexts talking over IPC instead
of HTTP.

## Architecture

```
┌─────────────────────────┐        IPC        ┌──────────────────────────┐
│   Renderer (Chromium)   │ <----------------> │  Main process (Node.js)  │
│   React UI               │   window.api.*    │  src/main.ts             │
│   src/App.tsx             │                   │  - fs (scan folders)     │
│   src/components/*.tsx    │                   │  - dialog (folder picker)│
│   No direct Node access   │                   │  - custom media:// proto │
└─────────────────────────┘                    └──────────────────────────┘
              ^
              | contextBridge.exposeInMainWorld('api', ...)
              |
        src/preload.ts  (the only file allowed to bridge the two worlds)
```

## Step by step — what we've built so far

1. **Started from the Electron Forge + Vite + TypeScript template**
   (vanilla, no UI framework). Confirmed it built/ran cleanly.

2. **Added React to the renderer only** (main/preload stay plain
   TS/Node — no reason for them to be React).
   - Installed `react`, `react-dom`, `@vitejs/plugin-react` (v4, matching
     Vite 5 — the plugin's v6 requires Vite 8).
   - `vite.renderer.config.ts` → added the React plugin.
   - `tsconfig.json` → added `"jsx": "react-jsx"`.
   - `index.html` → renders into `<div id="root">` instead of static HTML.
   - `src/renderer.tsx` → mounts `<App />` via `createRoot`.
   - `src/App.tsx` → the root React component.

3. **Fixed a pre-existing template bug** unrelated to our changes: the
   template pinned `typescript@~4.5.4`, but `@types/node` had resolved
   to a much newer version whose type definitions use syntax TS 4.5
   can't parse. Bumped to `typescript@^5.9`.

4. **Built the music library + playback pipeline** (this is the real
   "backend" work):
   - `src/shared/types.ts` — shared `Track` and `MusicApi` types, used by
     main, preload, *and* renderer (single source of truth).
   - `src/main.ts`:
     - `ipcMain.handle('library:selectFolder', ...)` — opens a native
       folder picker (`dialog.showOpenDialog`), then recursively scans
       the chosen folder for audio files (`.mp3`, `.wav`, `.flac`,
       `.ogg`, `.m4a`, `.aac`) and returns them as `Track[]`.
     - A custom `media://` protocol, registered via
       `protocol.registerSchemesAsPrivileged` +
       `protocol.handle('media', ...)`, that streams audio files from
       disk to the renderer with proper `Content-Length` /
       `Accept-Ranges` / `Content-Range` headers (see "Bugs we hit"
       below for why this needed to be hand-rolled).
   - `src/preload.ts` — exposes `window.api.selectMusicFolder()` to the
     renderer via `contextBridge`.
   - `src/global.d.ts` — TypeScript ambient declaration so
     `window.api` type-checks in the renderer.

5. **Built the UI**:
   - `src/App.tsx` — owns the track list + "currently playing index"
     state; wires `Player` and `Playlist` together.
   - `src/components/Player.tsx` — an `<audio>` element + play/pause/
     next/prev buttons + seek bar. Auto-plays on track change, advances
     to the next track when one ends.
   - `src/components/Playlist.tsx` — renders the track list, click to
     jump to a track.
   - `src/index.css` — basic layout/styling for the above.

## Bugs we hit & fixed (worth knowing if you touch this code)

- **`Not allowed to load local resource` for `file://` URLs** — the
  renderer loads from `http://localhost` (Vite dev server) or a
  `file://` page in production; Chromium blocks either from loading
  raw `file://` URLs directly. Fixed by routing all track URLs through
  the custom `media://` protocol instead.
- **`media:///<encoded-path>` failed to parse** — putting the encoded
  path in the URL's *host* position gets validated as a hostname, and
  hostnames reject decoded colons/backslashes/spaces (i.e. every
  Windows path). Fixed by using `media://track/<encoded-path>` so the
  path lives in the *pathname*, which has no such restriction.
- **Duration showed `Infinity`** — `net.fetch(fileURL, { headers:
  request.headers })` was used to serve the file, but it silently drops
  `Content-Length`/`Accept-Ranges` when a `Range` header is forwarded
  through it. Without a known length, `<audio>` can't compute duration.
  Fixed by hand-rolling the response with `fs.createReadStream` and
  correct `Content-Length` / `Accept-Ranges` / `Content-Range` headers
  (206 for ranged requests, 200 for full ones).

## What's done

- [x] Electron + Vite + TypeScript + React scaffolding
- [x] Main ↔ renderer IPC bridge (`window.api`)
- [x] Folder picker + recursive audio file scanning
- [x] Local file playback via a custom streaming protocol (seek-capable)
- [x] Basic player UI: play/pause, next/prev, seek bar, track duration
- [x] Playlist UI: track list, click-to-play, highlights current track

## What's not done yet

- [ ] Persist the music library between app launches (currently you
      have to re-pick the folder every time you open the app)
- [ ] Track metadata — album art, artist/album tags (would need a
      library like `music-metadata` in the main process)
- [ ] OS media key support (play/pause/next from keyboard/headset)
- [ ] System tray icon + tray controls
- [ ] Volume control
- [ ] Shuffle / repeat modes
- [ ] Multiple playlists (currently just one flat list per folder)
- [ ] Search/filter within the library
- [ ] Packaging/distribution (`npm run make` — untested so far)
- [ ] Remove the stray `console.log(duration, 222)` debug line in
      `Player.tsx` once you're done debugging with it

## Running it

```bash
npm start   # electron-forge start — builds + launches a window
```

DevTools opens automatically (see `mainWindow.webContents.openDevTools()`
in `src/main.ts`) — remove that call once you don't want it opening on
every launch.
