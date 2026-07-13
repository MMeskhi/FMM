import { useState } from 'react';
import Player from './components/Player';
import Playlist from './components/Playlist';
import type { Track } from './shared/types';

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  const currentTrack = currentIndex !== null ? tracks[currentIndex] : null;

  const handleSelectFolder = async () => {
    const found = await window.api.selectMusicFolder();
    setTracks(found);
    setCurrentIndex(found.length > 0 ? 0 : null);
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
        <button onClick={handleSelectFolder}>Open Music Folder</button>
      </header>
      <Player
        track={currentTrack}
        onEnded={handleNext}
        onNext={handleNext}
        onPrev={handlePrev}
      />
      <Playlist
        tracks={tracks}
        currentIndex={currentIndex}
        onSelect={setCurrentIndex}
      />
    </div>
  );
}

export default App;
