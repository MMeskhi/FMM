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
          <span className="track-number">{track.trackNo ?? index + 1}</span>
          <span className="track-name">{track.name}</span>
          {track.artist !== track.albumArtist && (
            <span className="track-artist">{track.artist}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default Playlist;
