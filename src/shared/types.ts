export interface Track {
  id: string;
  name: string;
  path: string;
  url: string;
}

export interface Album {
  id: string;
  name: string;
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
