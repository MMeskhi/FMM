import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { MusicApi, WindowApi } from './shared/types';

const api: MusicApi = {
  selectLibraryFolder: () => ipcRenderer.invoke('library:selectLibraryFolder'),
  getAlbumTracks: (folderPath) => ipcRenderer.invoke('library:getAlbumTracks', folderPath),
  loadLastFolder: () => ipcRenderer.invoke('library:loadLastFolder'),
};

const windowControls: WindowApi = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximizeToggle: () => ipcRenderer.send('window:maximizeToggle'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback) => {
    const listener = (_event: IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window:maximized-change', listener);
    return () => ipcRenderer.removeListener('window:maximized-change', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('windowControls', windowControls);
