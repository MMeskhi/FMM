import type { Track } from '../shared/types';
import './Playlist.css';

interface PlaylistProps {
  tracks: Track[];
  currentIndex: number | null;
  onSelect: (index: number) => void;
}

function Playlist({ tracks, currentIndex, onSelect }: PlaylistProps) {
  if (tracks.length === 0) {
    return null;
  }

  return (
    <ul className="playlist">
      {tracks.map((track, index) => (
        <li
          key={track.id}
          className={index === currentIndex ? 'active' : ''}
          onClick={() => onSelect(index)}
        >
          {track.name}
        </li>
      ))}
    </ul>
  );
}

export default Playlist;
