import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import started from 'electron-squirrel-startup';
import type { Track } from './shared/types';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// The renderer is loaded from http://localhost (Vite dev server) or a
// file:// page in production; either way Chromium blocks it from loading
// file:// URLs directly ("Not allowed to load local resource"). Serving
// tracks through a custom "media" protocol avoids that restriction while
// still forwarding Range headers so seeking works.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

const AUDIO_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};
const AUDIO_EXTENSIONS = new Set(Object.keys(AUDIO_MIME_TYPES));

function scanFolderForTracks(folder: string): Track[] {
  const tracks: Track[] = [];

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        tracks.push({
          id: fullPath,
          name: path.basename(entry.name, path.extname(entry.name)),
          path: fullPath,
          url: `media://track/${encodeURIComponent(fullPath)}`,
        });
      }
    }
  };

  walk(folder);
  return tracks;
}

ipcMain.handle('library:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  return scanFolderForTracks(result.filePaths[0]);
});

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // net.fetch() on a file:// URL drops Content-Length/Accept-Ranges when a
  // Range header is forwarded through it, which leaves <audio> unable to
  // determine track duration (shows Infinity). Stream the file ourselves
  // with proper HTTP range semantics instead.
  protocol.handle('media', async (request) => {
    const encodedPath = new URL(request.url).pathname.slice(1);
    const filePath = decodeURIComponent(encodedPath);
    const mimeType = AUDIO_MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      return new Response(null, { status: 404 });
    }

    const range = request.headers.get('range');
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      const start = match ? Number(match[1]) : 0;
      const end = match?.[2] ? Number(match[2]) : stat.size - 1;
      const stream = fs.createReadStream(filePath, { start, end });

      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': mimeType,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Content-Length': String(end - start + 1),
          'Accept-Ranges': 'bytes',
        },
      });
    }

    const stream = fs.createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(stat.size),
        'Accept-Ranges': 'bytes',
      },
    });
  });

  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
