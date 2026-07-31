import Playlist from './Playlist';
import { BackIcon, NoteIcon } from './icons';
import type { Album, Track } from '../shared/types';
import './AlbumView.css';

interface AlbumViewProps {
  album: Album;
  tracks: Track[];
  currentIndex: number | null;
  onSelectTrack: (index: number) => void;
  onBack: () => void;
}

function AlbumView({ album, tracks, currentIndex, onSelectTrack, onBack }: AlbumViewProps) {
  return (
    <div className="album-view">
      <button className="back-button" onClick={onBack}>
        <BackIcon />
        Back to albums
      </button>
      <div className="album-header">
        {album.coverUrl ? (
          <img src={album.coverUrl} alt={album.name} className="album-header-cover" />
        ) : (
          <div className="album-cover-placeholder large">
            <NoteIcon size={36} />
          </div>
        )}
        <div>
          <h2>{album.name}</h2>
          <p className="album-meta">
            {album.artist}
            {album.year ? ` · ${album.year}` : ''}
          </p>
        </div>
      </div>
      <Playlist tracks={tracks} currentIndex={currentIndex} onSelect={onSelectTrack} />
    </div>
  );
}

export default AlbumView;
