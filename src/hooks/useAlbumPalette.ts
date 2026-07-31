import { useEffect, useState } from 'react';
import { extractAlbumPalette, type AlbumPalette } from '../lib/albumPalette';

export function useAlbumPalette(coverUrl: string | null): AlbumPalette | null {
  const [palette, setPalette] = useState<AlbumPalette | null>(null);

  useEffect(() => {
    if (!coverUrl) {
      setPalette(null);
      return;
    }

    let cancelled = false;
    extractAlbumPalette(coverUrl).then((result) => {
      if (!cancelled) setPalette(result);
    });

    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  return palette;
}
