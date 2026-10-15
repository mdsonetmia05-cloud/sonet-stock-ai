/**
 * lib/image.ts — real client-side image analysis & processing.
 *
 * Everything here runs on-device with the Canvas API. It is NOT AI:
 * callers must label outputs honestly (e.g. "on-device heuristic",
 * "basic browser upscaling (not AI)").
 */

export interface DominantColor {
  hex: string;
  pct: number; // 0-100
}

export interface ImageAnalysis {
  width: number;
  height: number;
  orientation: "landscape" | "portrait" | "square";
  brightness: number; // 0-1
  contrast: number; // 0-1 (stddev of luminance)
  saturation: number; // 0-1
  warmth: number; // -1 (cool) .. +1 (warm)
  edgeDensity: number; // 0-1
  dominantColors: DominantColor[];
  isMostlyDark: boolean;
  isMostlyBright: boolean;
}

export interface ExposureReport {
  shadowClipPct: number;
  highlightClipPct: number;
  verdict: "ok" | "underexposed" | "overexposed" | "high-contrast-clipping";
}

/** Load an image element from a File (object URL, revoked after load). */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode image: ${file.name}`));
    };
    img.src = url;
  });
}

/** Draw an image into a canvas, optionally downscaling to maxDim. */
export function drawToCanvas(
  img: HTMLImageElement | HTMLCanvasElement,
  maxDim = 512,
): HTMLCanvasElement {
  const w = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const h = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas;
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Full statistical analysis of an image. */
export function analyzeImage(img: HTMLImageElement): ImageAnalysis {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const canvas = drawToCanvas(img, 256);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const n = canvas.width * canvas.height;

  let sumLum = 0;
  let sumLumSq = 0;
  let sumSat = 0;
  let sumWarm = 0;
  const buckets = new Map<string, number>();

  const lumAt = (i: number) => {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const gray = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = lumAt(i);
    gray[p] = lum;
    sumLum += lum;
    sumLumSq += lum * lum;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    sumSat += mx === 0 ? 0 : (mx - mn) / mx;
    sumWarm += (r - b) / 255;
    // 4-bit per channel quantization for dominant colors
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const brightness = sumLum / n;
  const variance = Math.max(0, sumLumSq / n - brightness * brightness);
  const contrast = Math.min(1, Math.sqrt(variance) * 2.2);
  const saturation = sumSat / n;
  const warmth = Math.max(-1, Math.min(1, (sumWarm / n) * 3));

  // Sobel edge density on the downscaled grayscale
  const w = canvas.width;
  const h = canvas.height;
  let edgeSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const gx =
        -gray[(y - 1) * w + x - 1] - 2 * gray[y * w + x - 1] - gray[(y + 1) * w + x - 1] +
        gray[(y - 1) * w + x + 1] + 2 * gray[y * w + x + 1] + gray[(y + 1) * w + x + 1];
      const gy =
        -gray[(y - 1) * w + x - 1] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + x + 1] +
        gray[(y + 1) * w + x - 1] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + x + 1];
      edgeSum += Math.sqrt(gx * gx + gy * gy);
      edgeCount++;
    }
  }
  const edgeDensity = Math.min(1, edgeSum / Math.max(1, edgeCount) / 1.4);

  const dominantColors: DominantColor[] = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => {
      const [qr, qg, qb] = key.split(",").map(Number);
      return { hex: toHex(qr * 16 + 8, qg * 16 + 8, qb * 16 + 8), pct: (count / n) * 100 };
    });

  const orientation = width === height ? "square" : width > height ? "landscape" : "portrait";

  return {
    width,
    height,
    orientation,
    brightness,
    contrast,
    saturation,
    warmth,
    edgeDensity,
    dominantColors,
    isMostlyDark: brightness < 0.32,
    isMostlyBright: brightness > 0.72,
  };
}

/** Laplacian variance → 0-100 sharpness score (higher = sharper). */
export function sharpnessScore(img: HTMLImageElement): number {
  const canvas = drawToCanvas(img, 256);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;
  const gray = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    gray[p] = (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]) / 255;
  }
  const lap: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = gray[y * w + x];
      lap.push(
        Math.abs(4 * c - gray[(y - 1) * w + x] - gray[(y + 1) * w + x] - gray[y * w + x - 1] - gray[y * w + x + 1]),
      );
    }
  }
  const mean = lap.reduce((a, b) => a + b, 0) / lap.length;
  const variance = lap.reduce((a, b) => a + (b - mean) ** 2, 0) / lap.length;
  // empirical scale: variance ~0.002 (blurry) .. ~0.05+ (crisp)
  return Math.max(0, Math.min(100, Math.round((variance / 0.045) * 100)));
}

/** Histogram clipping analysis. */
export function exposureReport(img: HTMLImageElement): ExposureReport {
  const canvas = drawToCanvas(img, 256);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const n = canvas.width * canvas.height;
  let dark = 0;
  let bright = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    if (lum < 0.04) dark++;
    if (lum > 0.96) bright++;
  }
  const shadowClipPct = (dark / n) * 100;
  const highlightClipPct = (bright / n) * 100;
  let verdict: ExposureReport["verdict"] = "ok";
  if (shadowClipPct > 12 && highlightClipPct > 8) verdict = "high-contrast-clipping";
  else if (shadowClipPct > 15) verdict = "underexposed";
  else if (highlightClipPct > 12) verdict = "overexposed";
  return { shadowClipPct, highlightClipPct, verdict };
}

/** Rough noise estimate: mean abs deviation from a 3x3-smoothed grayscale. 0-100. */
export function noiseEstimate(img: HTMLImageElement): number {
  const canvas = drawToCanvas(img, 192);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const w = canvas.width;
  const h = canvas.height;
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    gray[p] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  }
  let acc = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += gray[(y + dy) * w + x + dx];
      acc += Math.abs(gray[y * w + x] - s / 9);
      count++;
    }
  }
  const mean = acc / Math.max(1, count);
  return Math.max(0, Math.min(100, Math.round((mean / 0.06) * 100)));
}

export interface BgRemovalResult {
  canvas: HTMLCanvasElement;
  removedPct: number; // % of pixels made transparent
  width: number;
  height: number;
}

/**
 * REAL background removal: flood-fill from all four image edges.
 * Pixels connected to the border and within `tolerance` (0-100) color
 * distance of the sampled border color get genuine alpha = 0.
 * This is a basic heuristic (not AI) — works best on solid/near-solid backgrounds.
 */
export function removeBackgroundFloodFill(
  img: HTMLImageElement,
  tolerance = 32,
  maxDim = 1600,
): BgRemovalResult {
  const canvas = drawToCanvas(img, maxDim);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // sample border colors → median border color as reference
  const samples: number[][] = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 64));
  for (let x = 0; x < w; x += step) {
    samples.push([d[x * 4], d[x * 4 + 1], d[x * 4 + 2]]);
    const bi = ((h - 1) * w + x) * 4;
    samples.push([d[bi], d[bi + 1], d[bi + 2]]);
  }
  for (let y = 0; y < h; y += step) {
    samples.push([d[y * w * 4], d[y * w * 4 + 1], d[y * w * 4 + 2]]);
    const bi = (y * w + (w - 1)) * 4;
    samples.push([d[bi], d[bi + 1], d[bi + 2]]);
  }
  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)] ?? 0;
  };
  const ref: [number, number, number] = [
    median(samples.map((s) => s[0])),
    median(samples.map((s) => s[1])),
    median(samples.map((s) => s[2])),
  ];

  const threshold = (tolerance / 100) * 442; // max RGB distance ~441.7
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (!visited[p]) {
      visited[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  let removed = 0;
  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    const dr = d[i] - ref[0];
    const dg = d[i + 1] - ref[1];
    const db = d[i + 2] - ref[2];
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= threshold) {
      d[i + 3] = 0; // genuine alpha transparency
      removed++;
      const x = p % w;
      const y = Math.floor(p / w);
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return { canvas, removedPct: (removed / (w * h)) * 100, width: w, height: h };
}

export interface UpscaleOptions {
  denoise: number; // 0-100
  sharpen: number; // 0-100
}

/**
 * Honest canvas upscaling (NOT AI). High-quality bicubic resample with
 * optional mild denoise (pre-blur) and unsharp-mask sharpening.
 */
export function upscaleCanvas(
  img: HTMLImageElement | HTMLCanvasElement,
  scale: 2 | 4,
  opts: UpscaleOptions,
): HTMLCanvasElement {
  const srcW = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const srcH = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  const canvas = document.createElement("canvas");
  canvas.width = srcW * scale;
  canvas.height = srcH * scale;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  if (opts.denoise > 0) {
    // draw slightly blurred first pass to soften noise
    ctx.filter = `blur(${(opts.denoise / 100) * 1.2}px)`;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  if (opts.sharpen > 0) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    const w = canvas.width;
    const h = canvas.height;
    const src = new Uint8ClampedArray(d);
    const amount = (opts.sharpen / 100) * 0.9;
    // 3x3 unsharp mask on luminance only (cheap, avoids color fringing)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = src[p + c];
          const avg =
            (src[p - 4 + c] + src[p + 4 + c] + src[p - w * 4 + c] + src[p + w * 4 + c]) / 4;
          d[p + c] = Math.max(0, Math.min(255, center + (center - avg) * amount));
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      type,
      quality,
    );
  });
}

/** Natural-language phrases describing an analysis (for prompt building). */
export function describeAnalysis(a: ImageAnalysis): string[] {
  const parts: string[] = [];
  parts.push(`${a.orientation} composition, ${a.width}×${a.height}px`);
  parts.push(a.brightness < 0.35 ? "dark, low-key lighting" : a.brightness > 0.68 ? "bright, high-key lighting" : "balanced mid-tone exposure");
  parts.push(a.contrast > 0.55 ? "strong contrast with deep shadows" : a.contrast < 0.25 ? "soft, low-contrast tonal range" : "moderate contrast");
  parts.push(a.saturation > 0.55 ? "vivid, highly saturated colors" : a.saturation < 0.22 ? "muted, desaturated color treatment" : "natural color saturation");
  parts.push(a.warmth > 0.18 ? "warm color temperature" : a.warmth < -0.18 ? "cool color temperature" : "neutral color temperature");
  parts.push(a.edgeDensity > 0.5 ? "highly detailed with intricate textures" : a.edgeDensity < 0.2 ? "minimal detail, smooth surfaces" : "moderate fine detail");
  if (a.dominantColors.length) {
    parts.push(`dominant palette: ${a.dominantColors.slice(0, 3).map((c) => c.hex).join(", ")}`);
  }
  return parts;
}

const COLOR_NAMES: Array<[string, [number, number, number]]> = [
  ["red", [200, 40, 40]], ["orange", [230, 130, 40]], ["yellow", [230, 210, 60]],
  ["green", [60, 170, 80]], ["teal", [50, 160, 160]], ["blue", [60, 110, 220]],
  ["purple", [140, 80, 200]], ["pink", [230, 130, 180]], ["brown", [130, 90, 60]],
  ["white", [240, 240, 240]], ["gray", [140, 140, 140]], ["black", [30, 30, 30]],
];

export function nearestColorName(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  let best = "neutral";
  let bestD = Infinity;
  for (const [name, [cr, cg, cb]] of COLOR_NAMES) {
    const dd = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = name;
    }
  }
  return best;
}
