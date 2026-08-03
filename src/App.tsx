import { useEffect, useState, type CSSProperties } from 'react';
import Player from './components/Player';
import AlbumGrid from './components/AlbumGrid';
import AlbumView from './components/AlbumView';
import TitleBar from './components/TitleBar';
import Backdrop from './components/Backdrop';
import { FolderIcon } from './components/icons';
import { useAlbumPalette } from './hooks/useAlbumPalette';
import type { Album, Track } from './shared/types';
import './App.css';

interface NowPlaying {
  albumId: string;
  tracks: Track[];
  index: number;
}

function App() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  // Deliberately separate from `tracks`/`selectedAlbum`: those describe
  // whatever album is currently on screen, but playback should survive
  // navigating to a different album or back to the grid — it only changes
  // when the user picks a track themselves or hits next/prev/pause.
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);

  const currentTrack = nowPlaying ? nowPlaying.tracks[nowPlaying.index] : null;
  const activeIndex = selectedAlbum && nowPlaying?.albumId === selectedAlbum.id ? nowPlaying.index : null;
  const palette = useAlbumPalette(selectedAlbum?.coverUrl ?? null);
  const sceneStyle = palette
    ? ({
        '--scene-accent': palette.accent,
        '--scene-accent-strong': palette.accentStrong,
        '--scene-accent-soft': palette.accentSoft,
        '--scene-secondary': palette.secondary,
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    window.api.loadLastFolder().then((result) => {
      if (result) setAlbums(result.albums);
    });
  }, []);

  const handleOpenLibrary = async () => {
    const result = await window.api.selectLibraryFolder();
    if (!result) return;
    setAlbums(result.albums);
    setSelectedAlbum(null);
    setTracks([]);
    setNowPlaying(null);
  };

  const handleOpenAlbum = async (album: Album) => {
    const albumTracks = await window.api.getAlbumTracks(album.folderPath);
    setSelectedAlbum(album);
    setTracks(albumTracks);
  };

  const handleSelectTrack = (index: number) => {
    if (!selectedAlbum) return;
    setNowPlaying({ albumId: selectedAlbum.id, tracks, index });
  };

  const handleNext = () => {
    setNowPlaying((prev) => {
      if (!prev || prev.tracks.length === 0) return prev;
      return { ...prev, index: (prev.index + 1) % prev.tracks.length };
    });
  };

  const handlePrev = () => {
    setNowPlaying((prev) => {
      if (!prev || prev.tracks.length === 0) return prev;
      return { ...prev, index: (prev.index - 1 + prev.tracks.length) % prev.tracks.length };
    });
  };

  return (
    <div className="app" style={sceneStyle}>
      <Backdrop />
      <TitleBar />
      <div className="app-content">
        <div className="app-content-inner">
          <header>
            <h1>FMM</h1>
            <button onClick={handleOpenLibrary}>
              <FolderIcon />
              Open Music Folder
            </button>
          </header>

          {selectedAlbum ? (
            <AlbumView
              album={selectedAlbum}
              tracks={tracks}
              currentIndex={activeIndex}
              onSelectTrack={handleSelectTrack}
              onBack={() => setSelectedAlbum(null)}
            />
          ) : (
            <AlbumGrid albums={albums} onSelectAlbum={handleOpenAlbum} />
          )}
        </div>
      </div>

      <Player
        track={currentTrack}
        onEnded={handleNext}
        onNext={handleNext}
        onPrev={handlePrev}
      />
    </div>
  );
}

export default App;
