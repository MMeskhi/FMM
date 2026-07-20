import { contextBridge, ipcRenderer } from 'electron';
import type { MusicApi } from './shared/types';

const api: MusicApi = {
  selectLibraryFolder: () => ipcRenderer.invoke('library:selectLibraryFolder'),
  getAlbumTracks: (folderPath) => ipcRenderer.invoke('library:getAlbumTracks', folderPath),
  loadLastFolder: () => ipcRenderer.invoke('library:loadLastFolder'),
};

contextBridge.exposeInMainWorld('api', api);
