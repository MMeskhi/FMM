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

interface HueCluster {
  hue: number;
  saturation: number;
  lightness: number;
  weight: number;
}

const BUCKET_COUNT = 36;

// Clusters an image's pixels into 10°-wide hue buckets, ignoring
// near-neutral and near-black/near-white pixels so a track's dark backdrop
// or a white matte border doesn't drown out its actual colors. Each pixel
// is weighted by its own saturation, so a small vivid patch (a logo, a
// sleeve's accent color) can outrank a much larger but duller background —
// closer to what a viewer would call the cover's "dominant color" than a
// flat pixel count. Within the winning bucket, the hue/saturation/lightness
// are the true weighted averages of its pixels (not the bucket's midpoint),
// so the result tracks the actual cover instead of a quantized guess.
function clusterHues(imageData: ImageData): HueCluster[] {
  const weight = new Array(BUCKET_COUNT).fill(0) as number[];
  const sin = new Array(BUCKET_COUNT).fill(0) as number[];
  const cos = new Array(BUCKET_COUNT).fill(0) as number[];
  const satSum = new Array(BUCKET_COUNT).fill(0) as number[];
  const lightSum = new Array(BUCKET_COUNT).fill(0) as number[];

  const { data } = imageData;
  const bucketSize = 360 / BUCKET_COUNT;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.15 || l < 0.08 || l > 0.92) continue;

    const bucket = Math.floor(h / bucketSize) % BUCKET_COUNT;
    const rad = (h * Math.PI) / 180;
    weight[bucket] += s;
    sin[bucket] += Math.sin(rad) * s;
    cos[bucket] += Math.cos(rad) * s;
    satSum[bucket] += s * s;
    lightSum[bucket] += l * s;
  }

  const clusters: HueCluster[] = [];
  for (let i = 0; i < BUCKET_COUNT; i++) {
    if (weight[i] === 0) continue;
    let hue = (Math.atan2(sin[i], cos[i]) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    clusters.push({
      hue,
      saturation: satSum[i] / weight[i],
      lightness: lightSum[i] / weight[i],
      weight: weight[i],
    });
  }

  return clusters.sort((a, b) => b.weight - a.weight);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Renders a measured cluster as CSS hsl(), nudging saturation/lightness
// into a legible band for the given UI role (accent chrome shouldn't be
// near-black or neon) — but the hue itself is left untouched, since hue is
// what makes a swatch actually read as "that album's color".
function toRole(cluster: HueCluster, satRange: [number, number], lightRange: [number, number]): string {
  const saturation = clamp(cluster.saturation * 100, satRange[0], satRange[1]);
  const lightness = clamp(cluster.lightness * 100, lightRange[0], lightRange[1]);
  return `hsl(${cluster.hue.toFixed(1)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
}

// Derives a small palette from an album cover so each album can tint its
// own page — the hue and rough color intensity are pulled straight from
// the cover's actual dominant color, with saturation/lightness only
// clamped (not replaced) into a legible range for use as UI chrome.
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

    const clusters = clusterHues(imageData);
    if (clusters.length === 0) return null;

    const primary = clusters[0];
    const secondary = clusters.find((c) => hueDistance(c.hue, primary.hue) > 40) ?? {
      ...primary,
      hue: (primary.hue + 130) % 360,
    };

    return {
      accent: toRole(primary, [26, 46], [42, 58]),
      accentStrong: toRole(primary, [30, 50], [32, 44]),
      accentSoft: toRole(primary, [18, 32], [86, 92]),
      secondary: toRole(secondary, [16, 30], [54, 68]),
    };
  } catch {
    return null;
  }
}
