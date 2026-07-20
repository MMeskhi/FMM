import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { parseFile } from 'music-metadata';
import ffmpegPath from 'ffmpeg-static';
import started from 'electron-squirrel-startup';
import type { Album, Track } from './shared/types';

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

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.flac',
  '.ogg',
  '.m4a',
  '.aac',
]);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const COVER_FILE_NAMES = new Set(['cover', 'folder', 'front', 'album', 'albumart']);

function toMediaUrl(fullPath: string): string {
  return `media://track/${encodeURIComponent(fullPath)}`;
}

// .m4a/.aac files sometimes hold ALAC (Apple Lossless) audio instead of AAC.
// Chromium's media stack has no ALAC decoder — only Safari/AVFoundation does —
// so playback fails with MediaError code 4 even though the container parses
// fine. Transcode those specific files to FLAC (which Chromium decodes
// natively) once, and cache the result so repeat plays/seeks are instant.
const TRANSCODE_EXTENSIONS = new Set(['.m4a', '.aac']);
const TRANSCODE_CACHE_DIR = path.join(app.getPath('userData'), 'transcode-cache');

const codecProbeCache = new Map<string, Promise<string | undefined>>();
const transcodeJobs = new Map<string, Promise<string>>();

async function probeCodecUncached(filePath: string): Promise<string | undefined> {
  try {
    const metadata = await parseFile(filePath, { duration: false });
    return metadata.format.codec;
  } catch {
    return undefined;
  }
}

async function probeCodec(filePath: string, mtimeMs: number): Promise<string | undefined> {
  const key = `${filePath}:${mtimeMs}`;
  let probe = codecProbeCache.get(key);
  if (!probe) {
    probe = probeCodecUncached(filePath);
    codecProbeCache.set(key, probe);
  }
  return probe;
}

function transcodeToFlac(inputPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg binary is not available on this platform'));
      return;
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const tmpPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
    const ffmpeg = spawn(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-map', '0:a:0',
      '-c:a', 'flac',
      '-f', 'flac',
      tmpPath,
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        fs.renameSync(tmpPath, outputPath);
        resolve(outputPath);
      } else {
        fs.rmSync(tmpPath, { force: true });
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });
  });
}

async function ensureTranscoded(inputPath: string, cacheFile: string): Promise<string> {
  if (fs.existsSync(cacheFile)) return cacheFile;

  let job = transcodeJobs.get(cacheFile);
  if (!job) {
    job = transcodeToFlac(inputPath, cacheFile).finally(() => transcodeJobs.delete(cacheFile));
    transcodeJobs.set(cacheFile, job);
  }
  return job;
}

// Resolves the actual file (and MIME type) that should be streamed for a
// requested track, transcoding lossless-ALAC-in-M4A to FLAC on first play.
async function resolvePlaybackSource(
  filePath: string,
  stat: fs.Stats,
): Promise<{ path: string; mimeType: string }> {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

  if (!TRANSCODE_EXTENSIONS.has(ext)) {
    return { path: filePath, mimeType };
  }

  const codec = await probeCodec(filePath, stat.mtimeMs);
  if (codec !== 'ALAC') {
    return { path: filePath, mimeType };
  }

  const cacheKey = crypto.createHash('sha1').update(`${filePath}:${stat.mtimeMs}`).digest('hex');
  const cacheFile = path.join(TRANSCODE_CACHE_DIR, `${cacheKey}.flac`);
  await ensureTranscoded(filePath, cacheFile);
  return { path: cacheFile, mimeType: 'audio/flac' };
}

// Remembers the last folder the user picked, so they don't have to
// re-select it every time the app opens. Stored as a small JSON file in
// Electron's per-user app data directory (not the app's own install
// directory, which may not be writable).
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function readLastLibraryFolder(): string | null {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return typeof config.libraryFolder === 'string' ? config.libraryFolder : null;
  } catch {
    return null;
  }
}

function saveLastLibraryFolder(libraryFolder: string): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ libraryFolder }));
  } catch {
    // Non-fatal — the app just won't remember the folder for next time.
  }
}

function findFolderCoverImage(folder: string): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folder, { withFileTypes: true });
  } catch {
    return null;
  }

  const images = entries.filter(
    (entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
  );
  if (images.length === 0) return null;

  const preferred = images.find((img) =>
    COVER_FILE_NAMES.has(path.basename(img.name, path.extname(img.name)).toLowerCase()),
  );
  const chosen = preferred ?? images[0];
  return toMediaUrl(path.join(folder, chosen.name));
}

function findFirstAudioFile(folder: string): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folder, { withFileTypes: true });
  } catch {
    return null;
  }

  const audioFiles = entries
    .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return audioFiles.length > 0 ? path.join(folder, audioFiles[0].name) : null;
}

// Some albums have no standalone cover image file — the artwork is embedded
// in the audio file's own tags instead (ID3 APIC, FLAC PICTURE block, etc.),
// which is why other media players show a cover here but a plain folder scan
// doesn't. Fall back to reading it out of the first track with music-metadata.
async function findEmbeddedCover(folder: string): Promise<string | null> {
  const firstTrack = findFirstAudioFile(folder);
  if (!firstTrack) return null;

  try {
    const metadata = await parseFile(firstTrack, { duration: false });
    const picture = metadata.common.picture?.[0];
    if (!picture) return null;
    return `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`;
  } catch {
    return null;
  }
}

async function findAlbumCover(folder: string): Promise<string | null> {
  return findFolderCoverImage(folder) ?? (await findEmbeddedCover(folder));
}

async function scanAlbums(libraryFolder: string): Promise<Album[]> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(libraryFolder, { withFileTypes: true });
  } catch {
    return [];
  }

  const albums = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const folderPath = path.join(libraryFolder, entry.name);
        return {
          id: folderPath,
          name: entry.name,
          folderPath,
          coverUrl: await findAlbumCover(folderPath),
        };
      }),
  );

  albums.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return albums;
}

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
          url: toMediaUrl(fullPath),
        });
      }
    }
  };

  walk(folder);
  tracks.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return tracks;
}

ipcMain.handle('library:selectLibraryFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const libraryFolder = result.filePaths[0];
  saveLastLibraryFolder(libraryFolder);
  return { libraryFolder, albums: await scanAlbums(libraryFolder) };
});

ipcMain.handle('library:getAlbumTracks', async (_event, folderPath: string) => {
  return scanFolderForTracks(folderPath);
});

ipcMain.handle('library:loadLastFolder', async () => {
  const libraryFolder = readLastLibraryFolder();
  if (!libraryFolder) return null;
  return { libraryFolder, albums: await scanAlbums(libraryFolder) };
});

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
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

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      return new Response(null, { status: 404 });
    }

    let source: { path: string; mimeType: string };
    try {
      source = await resolvePlaybackSource(filePath, stat);
    } catch {
      return new Response(null, { status: 500 });
    }

    const sourceStat = source.path === filePath ? stat : await fs.promises.stat(source.path);

    const range = request.headers.get('range');
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      const start = match ? Number(match[1]) : 0;
      const end = match?.[2] ? Number(match[2]) : sourceStat.size - 1;
      const stream = fs.createReadStream(source.path, { start, end });

      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': source.mimeType,
          'Content-Range': `bytes ${start}-${end}/${sourceStat.size}`,
          'Content-Length': String(end - start + 1),
          'Accept-Ranges': 'bytes',
        },
      });
    }

    const stream = fs.createReadStream(source.path);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': source.mimeType,
        'Content-Length': String(sourceStat.size),
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
