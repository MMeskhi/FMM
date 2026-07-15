import { useState } from 'react';
import Player from './components/Player';
import AlbumGrid from './components/AlbumGrid';
import AlbumView from './components/AlbumView';
import type { Album, Track } from './shared/types';

function App() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  const currentTrack = currentIndex !== null ? tracks[currentIndex] : null;

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
    setCurrentIndex(albumTracks.length > 0 ? 0 : null);
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
    <div className="app">
      <header>
        <h1>FMM</h1>
        <button onClick={handleOpenLibrary}>Open Music Folder</button>
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
