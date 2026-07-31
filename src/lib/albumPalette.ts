export interface AlbumPalette {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  secondary: string;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d) % 6;
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Buckets an image's pixels into 24 hue slices, ignoring near-neutral
// (low-saturation) and near-black/near-white pixels so a track's dark
// backdrop or a white matte border doesn't drown out its actual colors.
// Returns the dominant hue and, if one stands apart enough, a second.
function dominantHues(imageData: ImageData): number[] {
  const buckets = new Array(24).fill(0) as number[];
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.12 || l < 0.08 || l > 0.92) continue;
    buckets[Math.floor(h / 15) % 24] += 1;
  }

  const ranked = buckets
    .map((count, index) => ({ hue: index * 15 + 7.5, count }))
    .filter((bucket) => bucket.count > 0)
    .sort((a, b) => b.count - a.count);

  if (ranked.length === 0) return [];

  const primary = ranked[0].hue;
  const secondary = ranked.find((bucket) => hueDistance(bucket.hue, primary) > 40)?.hue;
  return secondary === undefined ? [primary] : [primary, secondary];
}

function hsl(hue: number, lightness: number, saturation = 30): string {
  return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`;
}

// Derives a small, muted palette from an album cover so each album can tint
// its own page — kept desaturated/lightened to the same ranges as the
// app's default ice/sage tokens, so the "vibe" shifts hue without ever
// looking like raw, saturated album-art colors dropped into the UI.
export async function extractAlbumPalette(imageUrl: string): Promise<AlbumPalette | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`failed to load image: ${imageUrl}`));
    });
    img.src = imageUrl;
    await loaded;

    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);

    const [primary, secondary] = dominantHues(imageData);
    if (primary === undefined) return null;

    return {
      accent: hsl(primary, 50),
      accentStrong: hsl(primary, 38),
      accentSoft: hsl(primary, 89, 26),
      secondary: hsl(secondary ?? (primary + 130) % 360, 62, 22),
    };
  } catch {
    return null;
  }
}
