import { contextBridge, ipcRenderer } from 'electron';
import type { MusicApi } from './shared/types';

const api: MusicApi = {
  selectMusicFolder: () => ipcRenderer.invoke('library:selectFolder'),
};

contextBridge.exposeInMainWorld('api', api);
