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

function App() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  const currentTrack = currentIndex !== null ? tracks[currentIndex] : null;
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
    setCurrentIndex(null);
  };

  const handleOpenAlbum = async (album: Album) => {
    const albumTracks = await window.api.getAlbumTracks(album.folderPath);
    setSelectedAlbum(album);
    setTracks(albumTracks);
    setCurrentIndex(null);
  };

  const handleNext = () => {
    if (currentIndex === null || tracks.length === 0) return;
    setCurrentIndex((currentIndex + 1) % tracks.length);
  };

  const handlePrev = () => {
    if (currentIndex === null || tracks.length === 0) return;
    setCurrentIndex((currentIndex - 1 + tracks.length) % tracks.length);
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
              currentIndex={currentIndex}
              onSelectTrack={setCurrentIndex}
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
