import type { MusicApi, WindowApi } from './shared/types';

declare global {
  interface Window {
    api: MusicApi;
    windowControls: WindowApi;
  }
}
