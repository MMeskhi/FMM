export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: number | null;
  genre: string | null;
  trackNo: number | null;
  diskNo: number | null;
  path: string;
  url: string;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  year: number | null;
  folderPath: string;
  coverUrl: string | null;
}

export interface LibraryResult {
  libraryFolder: string;
  albums: Album[];
}

export interface MusicApi {
  selectLibraryFolder: () => Promise<LibraryResult | null>;
  getAlbumTracks: (folderPath: string) => Promise<Track[]>;
  loadLastFolder: () => Promise<LibraryResult | null>;
}

export interface WindowApi {
  minimize: () => void;
  maximizeToggle: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
}
