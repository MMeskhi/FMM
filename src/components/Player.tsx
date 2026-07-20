import { useEffect, useRef, useState } from 'react';
import type { Track } from '../shared/types';
import './Player.css';

interface PlayerProps {
  track: Track | null;
  onEnded: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function Player({ track, onEnded, onNext, onPrev }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);


  useEffect(() => {
    if (!audioRef.current || !track) return;
    audioRef.current.play().catch((error) => console.error('play() failed:', error));
    setIsPlaying(true);
  }, [track]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((error) => console.error('play() failed:', error));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Number(event.target.value);
  };

  if (!track) {
    return null;
  }

  return (
    <div className="player">
      <audio
        ref={audioRef}
        src={track.url}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={onEnded}
        onError={(e) =>
          console.error('audio element error:', e.currentTarget.error, track.url)
        }
      />
      <p className="track-name">{track.name}</p>
      <div className="controls">
        <button onClick={onPrev}>⏮</button>
        <button onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
        <button onClick={onNext}>⏭</button>
      </div>
      <div className="seek">
        <span>{formatTime(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={progress}
          onChange={handleSeek}
        />
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

export default Player;
