import type { Album } from '../shared/types';
import './AlbumGrid.css';

interface AlbumGridProps {
  albums: Album[];
  onSelectAlbum: (album: Album) => void;
}

function AlbumGrid({ albums, onSelectAlbum }: AlbumGridProps) {
  if (albums.length === 0) {
    return <p>No albums loaded. Open a music folder to get started.</p>;
  }

  return (
    <div className="album-grid">
      {albums.map((album) => (
        <button
          key={album.id}
          className="album-card"
          onClick={() => onSelectAlbum(album)}
        >
          {album.coverUrl ? (
            <img src={album.coverUrl} alt={album.name} />
          ) : (
            <div className="album-cover-placeholder">🎵</div>
          )}
          <span className="album-name">{album.name}</span>
          <span className="album-meta">
            {album.artist}
            {album.year ? ` · ${album.year}` : ''}
          </span>
        </button>
      ))}
    </div>
  );
}

export default AlbumGrid;
