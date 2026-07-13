import type { MusicApi } from './shared/types';

declare global {
  interface Window {
    api: MusicApi;
  }
}
