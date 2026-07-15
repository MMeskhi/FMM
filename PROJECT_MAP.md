# FMM — Project Map

A desktop music player built with Electron + React + TypeScript.
This file is a living doc.

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
  it exposes a small, explicit API (`window.api.selectLibraryFolder()`,
  `window.api.getAlbumTracks()`) from main to renderer via
  `contextBridge`.

So "front end" and "back end" here are `src/renderer` (React) and
`src/main.ts` (Node), living in the same app, same repo, same process
tree — just two separate JS execution contexts talking over IPC instead
of HTTP.

## Node.js primer (for a frontend-only dev)

The good news: **Node.js is not a new language.** It's the same
JavaScript/TypeScript you already know — same syntax, same `async/await`,
same array methods. What's different is the *environment* it runs in and
which built-in APIs exist. A rough translation table, based on what
actually shows up in `src/main.ts`:

| Browser/React world (what you know) | Node world (what's new here) |
|---|---|
| `window`, `document`, DOM APIs | Don't exist. No DOM in Node. |
| `fetch`, `localStorage` | Don't exist by default. Node has its own `fetch` now, but no `localStorage`. |
| npm packages for everything | Node ships built-in modules for OS-level stuff: `node:fs` (filesystem), `node:path` (file path handling), `node:stream` (chunked data) |
| Reading a File object from an `<input type="file">` | `fs.readdirSync(dir)` — lists files in a folder directly from disk, no user gesture needed, because Node has full OS access |
| A `Promise`-returning API you `await` | Same thing — `fs.promises.stat(path)` is a normal awaitable promise, just like a `fetch()` call |
| A `ReadableStream` from `fetch()`'s body | `fs.createReadStream(path)` — same *idea* (read data in chunks instead of all at once), just for local files instead of network responses |
| `postMessage` between a tab and a worker | `ipcMain.handle(...)` / `ipcRenderer.invoke(...)` — Electron's version of "send a message to the other process and wait for a reply" |

**The only genuinely new concept, not a browser analogue:** Node code
runs *outside* any sandbox — `fs.readdirSync` can read any file on disk
the OS user can access. That's exactly why Electron splits main
(Node, trusted) from renderer (Chromium, sandboxed) — so a bug or a
malicious webpage loaded in the renderer can't casually read your whole
filesystem.

**Where the Node code actually lives in this repo:** almost entirely in
`src/main.ts`. `src/preload.ts` uses one Node/Electron API
(`contextBridge`) but is otherwise just plain JS. Everything under
`src/components/` and `src/App.tsx` is 100% normal React — no Node
concepts there at all.

If you want to go through `src/main.ts` line by line and have each API
call explained, just ask.

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
   - `src/shared/types.ts` — shared `Track`, `Album`, `LibraryResult`,
     and `MusicApi` types, used by main, preload, *and* renderer (single
     source of truth).
   - `src/main.ts`:
     - `ipcMain.handle('library:selectLibraryFolder', ...)` — opens a
       native folder picker (`dialog.showOpenDialog`), then scans the
       chosen folder's *immediate subfolders* as albums (see step 6).
     - `ipcMain.handle('library:getAlbumTracks', ...)` — recursively
       scans one album folder for audio files (`.mp3`, `.wav`, `.flac`,
       `.ogg`, `.m4a`, `.aac`) and returns them as `Track[]`, naturally
       sorted by filename (so "2" sorts before "10").
     - A custom `media://` protocol, registered via
       `protocol.registerSchemesAsPrivileged` +
       `protocol.handle('media', ...)`, that streams audio *and cover
       image* files from disk to the renderer with proper
       `Content-Length` / `Accept-Ranges` / `Content-Range` headers (see
       "Bugs we hit" below for why this needed to be hand-rolled).
   - `src/preload.ts` — exposes `window.api.selectLibraryFolder()` and
     `window.api.getAlbumTracks()` to the renderer via `contextBridge`.
   - `src/global.d.ts` — TypeScript ambient declaration so
     `window.api` type-checks in the renderer.

5. **Built the UI**:
   - `src/App.tsx` — owns top-level state (albums, selected album,
     tracks, "currently playing index") and switches between the album
     grid and album detail view; the `Player` bar is always mounted so
     playback survives navigating back to the grid.
   - `src/components/Player.tsx` — an `<audio>` element + play/pause/
     next/prev buttons + seek bar. Auto-plays on track change, advances
     to the next track when one ends.
   - `src/components/Playlist.tsx` — renders a track list, click to
     jump to a track. Reused by `AlbumView`.
   - `src/index.css` — basic layout/styling for the above.

6. **Added album browsing** (folder of album folders → grid of covers →
   click in to see/play tracks → back to grid):
   - `src/main.ts` — `scanAlbums()` treats each *immediate subfolder* of
     the chosen library folder as one album; `findAlbumCover()` looks in
     each album folder for an image file (preferring names like
     `cover`/`folder`/`front`/`album`, falling back to the first image
     found) and serves it through the same `media://` protocol as audio.
   - `src/components/AlbumGrid.tsx` — grid of album cards (cover image
     or a placeholder icon if none found, + album name), click to open.
   - `src/components/AlbumView.tsx` — back button + album header (cover
     + name) + the track list (`Playlist`) for that one album.
   - `src/App.tsx` — rewired: `selectLibraryFolder()` now returns
     `{ libraryFolder, albums }` instead of a flat track list; opening
     an album lazily calls `getAlbumTracks(folderPath)` rather than
     scanning the whole library upfront.

7. **Added embedded cover-art fallback** — some albums have no standalone
   cover image file, but the art is embedded in the audio file's own tags
   (ID3 `APIC` frame for MP3, FLAC `PICTURE` block, etc.), which is why
   other media players showed a cover but our folder-image-only scan
   didn't.
   - Installed `music-metadata` (pure ESM package — bundles fine into the
     main process via Vite despite this project's CJS output; no special
     config needed).
   - `src/main.ts` — `findAlbumCover()` now tries `findFolderCoverImage()`
     first (unchanged), then falls back to `findEmbeddedCover()`, which
     parses tags from the album's first track (`music-metadata`'s
     `parseFile`) and returns the picture as a `data:` URL. `scanAlbums()`
     had to become `async` as a result (tag parsing is a real, if quick,
     file read — unlike the sync directory listing calls elsewhere).

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
- [x] Folder picker + album (subfolder) scanning, lazy per-album track scanning
- [x] Local file playback via a custom streaming protocol (seek-capable)
- [x] Basic player UI: play/pause, next/prev, seek bar, track duration
- [x] Playlist UI: track list, click-to-play, highlights current track
- [x] Album grid with cover art (folder image file, or embedded ID3/tag
      artwork as a fallback) + placeholder for albums with neither
- [x] Album detail view + back-to-grid navigation; player persists across navigation

## What's not done yet

- [ ] Persist the music library between app launches (currently you
      have to re-pick the folder every time you open the app)
- [ ] Other embedded tag metadata — artist/album name, track number,
      year (we only pull cover art out of tags so far, via `music-metadata`)
- [ ] OS media key support (play/pause/next from keyboard/headset)
- [ ] System tray icon + tray controls
- [ ] Volume control
- [ ] Shuffle / repeat modes
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
