// Light, air and depth for every scene: parallax layers, light shafts and leaks, paper grain, and
// the particle systems of docs/TREATMENT.md ("Particles"). Everything here is a pure function of
// the time handed in and a seed: no state, so any frame can be rendered on its own.
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { clamp, ease, hash, lerp, mod, mulberry32, smoothstep, TAU } from '../engine/util';
import { drawStar } from './_love-props';
import type { Ctx, V2 } from './_love-rig';

// ------------------------------------------------------------------ spare canvases
const pool = new Map<string, { cv: HTMLCanvasElement; c: Ctx }>();
/**
 * A spare canvas the size of the frame (divided by `div`), cleared, drawing in the frame's own px.
 * One per name: what was on it is gone the next time the same name is asked for.
 */
export function scratch(name: string, div = 1) {
  const key = `${name}/${div}`;
  let s = pool.get(key);
  if (!s) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((W * SCALE) / div); cv.height = Math.ceil((H * SCALE) / div);
    s = { cv, c: scaleContext2D(cv.getContext('2d')!, SCALE / div) };
    if (SCALE / div === 1) s.c.setTransform(1, 0, 0, 1, 0, 0);
    pool.set(key, s);
  }
  const c = s.c;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  c.clearRect(0, 0, W, H);
  return s;
}

// ------------------------------------------------------------------ camera and parallax layers
/** The slow camera of a shot: how far it has moved right / down from rest (px), its push-in (1 = rest) and tilt (rad). */
export interface Cam { x?: number; y?: number; zoom?: number; roll?: number }
/**
 * Put a context in the space of something `depth` away from the camera: 0 = infinitely far (it never
 * moves: the sky), 1 = the plane of the subject, above 1 = nearer than the subject (it moves more).
 */
export function camera(c: Ctx, cam: Cam, depth = 1) {
  const z = 1 + ((cam.zoom ?? 1) - 1) * depth;
  c.translate(W / 2, H / 2); c.scale(z, z);
  if (cam.roll) c.rotate(cam.roll * depth);
  c.translate(-W / 2 - (cam.x ?? 0) * depth, -H / 2 - (cam.y ?? 0) * depth);
}
export interface LayerOpts {
  cam?: Cam; depth?: number;
  /** Out of focus, px (far layers 2 to 4, things passing close to the camera 6 to 12). */
  blur?: number;
  /** 0..1: how much of the air's colour lies over it (far layers are lighter and less saturated). */
  haze?: number; hazeColor?: string;
  alpha?: number;
}
/**
 * One parallax layer: `draw` paints it, already in the camera's space for its depth; it is then hazed,
 * put out of focus and laid on `c`. Paint a shot far to near, 3 to 6 of these. (Not inside one another.)
 */
export function layer(c: Ctx, o: LayerOpts, draw: (c: Ctx) => void) {
  const blur = o.blur ?? 0, haze = o.haze ?? 0, alpha = o.alpha ?? 1;
  if (blur <= 0 && haze <= 0 && alpha >= 1) {
    c.save();
    if (o.cam) camera(c, o.cam, o.depth ?? 1);
    draw(c);
    c.restore();
    return;
  }
  // out of focus = painted small and enlarged (cheap, and soft enough at these sizes)
  const s = scratch('layer', blur <= 0 ? 1 : clamp(Math.round(blur / 1.5), 1, 8)), sc = s.c;
  sc.save();
  if (o.cam) camera(sc, o.cam, o.depth ?? 1);
  draw(sc);
  sc.restore();
  if (haze > 0) { sc.globalCompositeOperation = 'source-atop'; sc.fillStyle = rgba(o.hazeColor ?? 'paper', haze); sc.fillRect(0, 0, W, H); sc.globalCompositeOperation = 'source-over'; }
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha *= alpha; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(s.cv, 0, 0, W, H);
  c.restore();
}

// ------------------------------------------------------------------ light
/** A shaft of light: from (x, y), going `angle` rad off straight down (+ = toward the right), `width` px wide where it starts and `spread` times that at its end. */
export interface Shaft { x: number; y: number; angle?: number; length: number; width: number; spread?: number }
/**
 * A soft shaft of light, as through a window. On the picture it tints what it crosses; on the light
 * layer (added with a tint above 1) it glows. Dust shows in it: dustMotes(..., { shafts: [shaft] }).
 */
export function lightShaft(c: Ctx, s: Shaft, o: { color?: string; alpha?: number; t?: number } = {}) {
  const col = o.color ?? 'gold', live = o.t === undefined ? 1 : 1 + 0.07 * Math.sin(o.t * 0.7 + s.x * 0.01);
  const a = (o.alpha ?? 0.3) * live, sp = s.spread ?? 1.6, soft = Math.max(3, s.width * 0.11), w0 = s.width / 2 - soft, w1 = (s.width / 2) * sp - soft;
  c.save(); c.translate(s.x, s.y); c.rotate(-(s.angle ?? 0));
  const g = c.createLinearGradient(0, 0, 0, s.length);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(0.55, rgba(col, a * 0.5)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.filter = `blur(${soft.toFixed(1)}px)`;
  c.beginPath(); c.moveTo(-w0, -soft); c.lineTo(w0, -soft); c.lineTo(w1, s.length); c.lineTo(-w1, s.length); c.closePath(); c.fill();
  c.restore();
}
/** 0..1: how far inside a shaft a point is. */
export function inShaft(s: Shaft, x: number, y: number): number {
  const a = s.angle ?? 0, dx = x - s.x, dy = y - s.y, along = dx * Math.sin(a) + dy * Math.cos(a), across = dx * Math.cos(a) - dy * Math.sin(a);
  if (along < 0 || along > s.length) return 0;
  return clamp(1.25 - Math.abs(across) / ((s.width / 2) * lerp(1, s.spread ?? 1.6, along / s.length))) * clamp(1.6 - (1.6 * along) / s.length);
}
/**
 * A light leak: soft peach and pink light blooming in from a frame edge, for emotional peaks.
 * `amount` 0..1: at 1 it washes the whole frame. `from`: the side it comes from (rad: 0 = the right
 * edge, PI / 2 = the bottom, -PI / 2 = the top). Best on the light layer.
 */
export function lightLeak(c: Ctx, amount: number, o: { from?: number; t?: number; color?: string; color2?: string } = {}) {
  const k = clamp(amount);
  if (k < 0.003) return;
  const from = o.from ?? -0.6, t = o.t ?? 0, c1 = o.color ?? 'peach', c2 = o.color2 ?? 'blush';
  const ex = W / 2 + Math.cos(from) * W * 0.6, ey = H / 2 + Math.sin(from) * H * 0.66, px = -Math.sin(from), py = Math.cos(from);
  const blobs: [number, number, string][] = [[0, 1, c1], [0.34, 0.72, c2], [-0.3, 0.62, mix(c1, 'gold', 0.5)]];
  c.save();
  blobs.forEach(([off, size, col], i) => {
    const d = off * W * 0.5 + 40 * Math.sin(t * 0.31 + i * 2.1), x = ex + px * d, y = ey + py * d + 24 * Math.cos(t * 0.23 + i);
    const r = lerp(0.2, 1.5, k) * W * size, a = 0.55 * k ** 1.2, g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.45, rgba(col, a * 0.42)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  const wash = smoothstep(0.55, 1, k);
  if (wash > 0) { c.fillStyle = mix(mix(c1, c2, 0.4), 'paper', 0.35, wash); c.fillRect(0, 0, W, H); }
  c.restore();
}
/**
 * The glow of a light source, for the light layer: the sun, a lamp, a window at night. Bright at its
 * heart (`alpha`, default 0.9), a wide faint halo out to `r`.
 */
export function glow(c: Ctx, x: number, y: number, r: number, o: { color?: string; alpha?: number } = {}) {
  const col = o.color ?? 'gold', a = o.alpha ?? 0.9, g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [at, k] of [[0, 1], [0.07, 0.86], [0.2, 0.3], [0.5, 0.08], [1, 0]] as const) g.addColorStop(at, rgba(col, a * k));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
/** A four-point glint for the light layer (sparkles in his eyes, a pop on a star): `k` 0..1 = how open it is. */
export function sparkle(c: Ctx, x: number, y: number, r: number, k = 1, o: { color?: string; rot?: number } = {}) {
  if (k <= 0.01) return;
  const col = o.color ?? 'gold', R = r * k, rot = o.rot ?? 0;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = rgba(col, Math.min(1, k * 1.4));
  c.beginPath(); c.moveTo(0, -R);
  for (let i = 1; i <= 4; i++) { const a = -Math.PI / 2 + (i * TAU) / 4, m = a - TAU / 8; c.quadraticCurveTo(Math.cos(m) * R * 0.12, Math.sin(m) * R * 0.12, Math.cos(a) * R, Math.sin(a) * R); }
  c.fill();
  c.fillStyle = rgba('paper', Math.min(1, k)); c.beginPath(); c.arc(0, 0, R * 0.2, 0, TAU); c.fill();
  c.restore();
}

// ------------------------------------------------------------------ paper
let grain: HTMLCanvasElement | null = null;
function grainTile() {
  if (grain) return grain;
  const n = 256, cv = document.createElement('canvas'), c = cv.getContext('2d')!, rnd = mulberry32(20261009);
  cv.width = cv.height = n;
  // fibres and flecks, each drawn at the nine offsets that make the tile repeat without a seam
  const tiled = (f: (ox: number, oy: number) => void) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) f(ox, oy); };
  c.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = rnd() * n, y = rnd() * n, a = rnd() * TAU, l = 3 + rnd() * 11, light = rnd() < 0.35;
    c.strokeStyle = light ? rgba('paper', 0.08 + rnd() * 0.1) : rgba('ink', 0.02 + rnd() * 0.035); c.lineWidth = 0.6 + rnd() * 0.6;
    tiled((ox, oy) => { c.beginPath(); c.moveTo(x + ox, y + oy); c.quadraticCurveTo(x + ox + Math.cos(a + 0.5) * l * 0.5, y + oy + Math.sin(a + 0.5) * l * 0.5, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); c.stroke(); });
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * n, y = rnd() * n, r = 14 + rnd() * 34, dark = rnd() < 0.6;
    tiled((ox, oy) => {
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, dark ? rgba('ink', 0.018) : rgba('paper', 0.07)); g.addColorStop(1, dark ? rgba('ink', 0) : rgba('paper', 0));
      c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }
  return (grain = cv);
}
/**
 * Paper grain (fibres, flecks, faint blotches) over what is already drawn: the whole frame, or a
 * rectangle (a notebook page, a sheet of composition paper). Clip first for other shapes.
 */
export function paperGrain(c: Ctx, o: { x?: number; y?: number; w?: number; h?: number; alpha?: number; scale?: number } = {}) {
  const p = c.createPattern(grainTile(), 'repeat');
  if (!p) return;
  const k = o.scale ?? 1;
  p.setTransform(new DOMMatrix().translate(o.x ?? 0, o.y ?? 0).scale(k, k));
  c.save(); c.globalAlpha *= o.alpha ?? 1; c.fillStyle = p;
  c.fillRect(o.x ?? 0, o.y ?? 0, o.w ?? W, o.h ?? H);
  c.restore();
}

// ------------------------------------------------------------------ the dotted path
/**
 * The dotted-path motif: a hand-drawn dotted line through `pts`, like a doodled map, drawn up to
 * `k` (0..1) of its length. Returns the point it has reached.
 */
export function dottedPath(c: Ctx, pts: V2[], k = 1, o: { color?: string; width?: number; gap?: number; alpha?: number; seed?: number } = {}): V2 {
  if (pts.length < 2) return pts[0] ?? [0, 0];
  // a smooth curve through the points, as a polyline
  const line: V2[] = [], P = (i: number) => pts[clamp(i, 0, pts.length - 1)]!;
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < 16; j++) {
    const u = j / 16, a = P(i - 1), b = P(i), d = P(i + 1), e = P(i + 2);
    const f = (q: number) => 0.5 * (2 * b[q]! + (d[q]! - a[q]!) * u + (2 * a[q]! - 5 * b[q]! + 4 * d[q]! - e[q]!) * u * u + (3 * b[q]! - a[q]! - 3 * d[q]! + e[q]!) * u * u * u);
    line.push([f(0), f(1)]);
  }
  line.push(P(pts.length - 1));
  const L = [0];
  for (let i = 1; i < line.length; i++) L.push(L[i - 1]! + Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1]));
  const total = L[L.length - 1]!, gap = o.gap ?? 24, w = o.width ?? 4.5, seed = o.seed ?? 3;
  const at = (s: number): [number, number, number] => {
    let i = 1;
    while (i < L.length - 1 && L[i]! < s) i++;
    const a = line[i - 1]!, b = line[i]!, u = (s - L[i - 1]!) / Math.max(1e-6, L[i]! - L[i - 1]!);
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  c.save(); c.strokeStyle = rgba(o.color ?? 'ink', o.alpha ?? 0.55); c.lineWidth = w; c.lineCap = 'round';
  const reach = clamp(k) * total;
  for (let n = 0, s = gap / 2; s < reach; n++, s += gap) {
    const [x, y, a] = at(s), l = w * (0.6 + 0.9 * hash(n, seed)), a2 = a + (hash(n, seed, 1) - 0.5) * 0.5;
    const jx = (hash(n, seed, 2) - 0.5) * 3, jy = (hash(n, seed, 3) - 0.5) * 3, grow = clamp((reach - s) / gap);
    c.globalAlpha = grow;
    c.beginPath(); c.moveTo(x + jx - Math.cos(a2) * l, y + jy - Math.sin(a2) * l); c.lineTo(x + jx + Math.cos(a2) * l, y + jy + Math.sin(a2) * l); c.stroke();
  }
  c.restore();
  const [x, y] = at(reach);
  return [x, y];
}

// ------------------------------------------------------------------ particles
/** What every particle system takes. They drift slowly and never swarm: keep the counts low. */
export interface Drift {
  /** The area they live in (default: the frame and a margin around it). */
  x?: number; y?: number; w?: number; h?: number;
  count?: number; seed?: number;
  /** -1..1: blows them sideways (+ = to the right). */
  wind?: number;
  /** 0..1 overall opacity; a size factor. */
  alpha?: number; size?: number;
  color?: string;
}
interface Mote { i: number; x: number; y: number; /** 0 far .. 1 near */ z: number; /** a random number 0..1 of this particle */ r: (k: number) => number }
/** `n` particles moving at about (vx, vy) px/s through the area, wrapping round its edges (each time at a new place). */
function field(o: Drift, n: number, t: number, vx: number, vy: number, fn: (p: Mote) => void, margin = 50) {
  const x0 = o.x ?? -margin, y0 = o.y ?? -margin, w = o.w ?? W + margin * 2, h = o.h ?? H + margin * 2, seed = o.seed ?? 1;
  for (let i = 0; i < n; i++) {
    const z = hash(i, seed, 1), f = lerp(0.55, 1.45, z) * (0.8 + 0.4 * hash(i, seed, 2));
    const Y = hash(i, seed, 3) * h + vy * f * t, X = hash(i, seed, 4, Math.floor(Y / h)) * w + vx * f * t;
    fn({ i, x: x0 + mod(X, w), y: y0 + mod(Y, h), z, r: (k) => hash(i, seed, 10 + k) });
  }
}
const disc = (c: Ctx, x: number, y: number, r: number, style: string) => { c.fillStyle = style; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };

/** Dust motes: the default air of every shot. With `shafts` they only catch the light inside those. */
export function dustMotes(c: Ctx, t: number, o: Drift & { shafts?: Shaft[] } = {}) {
  const col = o.color ?? 'gold', A = o.alpha ?? 1, k = o.size ?? 1;
  field(o, o.count ?? 70, t, 3 + (o.wind ?? 0) * 16, -5, (p) => {
    const ph = p.r(0) * TAU, x = p.x + 14 * Math.sin(t * (0.25 + 0.3 * p.r(1)) + ph), y = p.y + 9 * Math.sin(t * (0.2 + 0.25 * p.r(2)) + ph * 1.7);
    let a = (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * (0.6 + p.r(3)) + ph * 3))) * lerp(0.5, 1, p.z);
    if (o.shafts) a *= 0.1 + 0.9 * Math.max(0, ...o.shafts.map((s) => inShaft(s, x, y)));
    const r = lerp(1.1, 3.4, p.z * p.z) * k;
    disc(c, x, y, r * 2.6, rgba(col, 0.16 * a * A)); disc(c, x, y, r, rgba(col, 0.8 * a * A));
  }, 20);
}

/**
 * Chalk dust. Without `from`: fine pale dust sinking through the area (it settles on his hair).
 * With `from` (a point, or where the chalk or the eraser was at a given time): puffs that leave it,
 * spread and fall; `since` / `until` bound when it gives off dust.
 */
export function chalkDust(c: Ctx, t: number, o: Drift & { from?: V2 | ((at: number) => V2); since?: number; until?: number } = {}) {
  const col = o.color ?? 'paper', A = o.alpha ?? 1, k = o.size ?? 1, seed = o.seed ?? 1;
  if (!o.from) {
    field(o, o.count ?? 90, t, (o.wind ?? 0) * 22, 11, (p) => {
      const x = p.x + 10 * Math.sin(t * (0.3 + 0.4 * p.r(1)) + p.r(0) * TAU), r = lerp(0.9, 2.4, p.z) * k;
      disc(c, x, p.y, r * 2.2, rgba(col, 0.12 * A)); disc(c, x, p.y, r, rgba(col, lerp(0.35, 0.8, p.z) * A));
    }, 20);
    return;
  }
  const n = o.count ?? 36;
  for (let i = 0; i < n; i++) {
    const life = 1.5 + 1.3 * hash(i, seed, 1), cyc = Math.floor((t - hash(i, seed, 2) * life) / life), born = (cyc + hash(i, seed, 2)) * life, age = t - born;
    if ((o.since !== undefined && born < o.since) || (o.until !== undefined && born > o.until)) continue;
    const [fx, fy] = typeof o.from === 'function' ? o.from(born) : o.from, u = age / life, r = (k2: number) => hash(i, seed, cyc, k2);
    const push = (1 - Math.exp(-2.2 * age)) / 2.2, x = fx + (r(3) - 0.5) * 16 + ((r(4) - 0.5) * 90 + (o.wind ?? 0) * 40) * push + (o.wind ?? 0) * 18 * age;
    const y = fy + (r(5) - 0.5) * 10 + (r(6) * 30 - 16) * push + (14 + 16 * r(7)) * age;
    disc(c, x, y, lerp(1.4, 4.6, u) * (0.6 + 0.8 * r(8)) * k, rgba(col, 0.55 * (1 - u) ** 1.6 * Math.min(1, age * 8) * A));
  }
}

/** A petal or a leaf tumbling down: `draw` paints it pointing up, about 1 unit long, at the origin. */
function tumble(c: Ctx, t: number, o: Drift, n: number, vy: number, sway: number, size: [number, number], draw: (p: Mote) => void) {
  const k = o.size ?? 1;
  field(o, n, t, (o.wind ?? 0) * 70, vy, (p) => {
    const ph = p.r(0) * TAU, w = 0.5 + 0.6 * p.r(1), x = p.x + sway * Math.sin(t * w + ph), s = lerp(size[0], size[1], p.z) * k;
    c.save();
    c.translate(x, p.y + sway * 0.25 * Math.sin(t * w * 2 + ph));
    c.rotate(ph + 0.9 * Math.sin(t * w + ph) + t * (p.r(2) - 0.5) * 0.8);
    c.scale(s * (0.35 + 0.65 * Math.abs(Math.cos(t * (0.9 + p.r(3)) + ph))), s);
    c.globalAlpha = (o.alpha ?? 1) * lerp(0.6, 1, p.z);
    draw(p);
    c.restore();
  });
}
/** Falling petals (chorus 1, the interlude): pale pink, a few at a time. */
export function petals(c: Ctx, t: number, o: Drift = {}) {
  tumble(c, t, o, o.count ?? 22, 46, 42, [7, 15], (p) => {
    c.fillStyle = o.color ?? mix('blush', p.r(5) < 0.5 ? 'paper' : 'rose', p.r(5) < 0.5 ? 0.3 : 0.18);
    c.beginPath(); c.moveTo(0, -1); c.bezierCurveTo(0.85, -0.55, 0.7, 0.75, 0, 1); c.bezierCurveTo(-0.7, 0.75, -0.85, -0.55, 0, -1); c.fill();
  });
}
/** Falling leaves (autumn): gold to peach, with a midrib. */
export function leaves(c: Ctx, t: number, o: Drift = {}) {
  const cols = [rgba('gold'), mix('gold', 'peach', 0.6), mix('peach', 'rose', 0.25), mix('gold', 'ink', 0.2)];
  tumble(c, t, o, o.count ?? 12, 58, 60, [11, 22], (p) => {
    c.fillStyle = o.color ?? cols[Math.floor(p.r(5) * cols.length)]!;
    c.beginPath(); c.moveTo(0, -1); c.quadraticCurveTo(0.8, -0.2, 0, 1); c.quadraticCurveTo(-0.8, -0.2, 0, -1); c.fill();
    c.strokeStyle = rgba('ink', 0.22); c.lineWidth = 0.07; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -0.7); c.lineTo(0, 1.25); c.stroke();
  });
}
/** Wind-blown paper scraps (verse 2): they cross the frame with the wind (default: to the right). */
export function paperScraps(c: Ctx, t: number, o: Drift = {}) {
  const wind = o.wind ?? 1, k = o.size ?? 1;
  field(o, o.count ?? 9, t, wind * 190, 14, (p) => {
    const ph = p.r(0) * TAU, flip = Math.cos(t * (2.2 + 2 * p.r(1)) + ph), s = lerp(9, 20, p.z) * k;
    c.save();
    c.translate(p.x, p.y + 46 * Math.sin(t * (0.7 + 0.6 * p.r(2)) + ph));
    c.rotate(ph + t * (p.r(3) - 0.5) * 3);
    c.scale(1, 0.25 + 0.75 * Math.abs(flip));
    c.globalAlpha = (o.alpha ?? 1) * lerp(0.7, 1, p.z);
    c.fillStyle = o.color ?? (flip > 0 ? rgba('paper') : mix('paper', 'frost', 0.55));
    c.beginPath(); c.moveTo(-s, -s * 0.62); c.lineTo(s * 0.9, -s * 0.7); c.lineTo(s, s * 0.6); c.lineTo(-s * 0.85, s * 0.7); c.closePath(); c.fill();
    c.restore();
  });
}
/** Light snow (chorus 2): soft flakes, the near ones larger and fainter. */
export function snow(c: Ctx, t: number, o: Drift = {}) {
  const col = o.color ?? 'paper', A = o.alpha ?? 1, k = o.size ?? 1;
  field(o, o.count ?? 90, t, (o.wind ?? 0) * 60, 52, (p) => {
    const x = p.x + lerp(8, 26, p.z) * Math.sin(t * (0.5 + 0.5 * p.r(1)) + p.r(0) * TAU), r = lerp(1.4, 5.2, p.z ** 1.6) * k;
    disc(c, x, p.y, r * 2, rgba(col, 0.14 * A)); disc(c, x, p.y, r, rgba(col, lerp(0.9, 0.55, p.z) * A));
  });
}
/** Rain (the finale): thin slanted streaks; with `ground` (a y) each drop leaves a small splash there. */
export function rain(c: Ctx, t: number, o: Drift & { ground?: number } = {}) {
  const col = o.color ?? 'frost', A = o.alpha ?? 1, wind = o.wind ?? -0.2, V = 1150, margin = 50, h = o.h ?? H + margin * 2, seed = o.seed ?? 1;
  c.save(); c.lineCap = 'round';
  field(o, o.count ?? 130, t, wind * V * 0.3, V, (p) => {
    const l = lerp(16, 46, p.z) * (o.size ?? 1), sx = wind * 0.3 * l;
    c.strokeStyle = rgba(col, lerp(0.25, 0.6, p.z) * A); c.lineWidth = lerp(1, 2, p.z);
    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - sx, p.y - l); c.stroke();
    if (o.ground === undefined || p.z < 0.35) return;
    // the splash: how long ago this drop passed the ground line
    const f = lerp(0.55, 1.45, p.z) * (0.8 + 0.4 * hash(p.i, seed, 2)), ago = mod(p.y - o.ground, h) / (V * f);   // (f: its speed, as in field())
    if (ago > 0.28) return;
    const u = ago / 0.28, gx = p.x - wind * 0.3 * V * f * ago;
    c.strokeStyle = rgba(col, 0.55 * (1 - u) * A); c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(gx, o.ground, 3 + 11 * u, 1 + 3 * u, 0, 0, TAU); c.stroke();
  }, margin);
  c.restore();
}
/**
 * Paper stars, rose. Without `from`: stars rising slowly through the area (the finale's sky, the outro).
 * With `from`: they leave that point one by one from time `since`, `rate` a second, and rise.
 */
export function paperStars(c: Ctx, t: number, o: Drift & { from?: V2; since?: number; rate?: number; rise?: number } = {}) {
  const k = o.size ?? 1, A = o.alpha ?? 1, seed = o.seed ?? 1;
  if (!o.from) {
    field(o, o.count ?? 16, t, (o.wind ?? 0) * 30, -34, (p) => {
      const ph = p.r(0) * TAU, x = p.x + 30 * Math.sin(t * (0.35 + 0.3 * p.r(1)) + ph);
      drawStar(c, x, p.y, lerp(8, 20, p.z) * k, ph + 0.5 * Math.sin(t * 0.6 + ph), { color: o.color, alpha: A * lerp(0.7, 1, p.z) });
    }, 60);
    return;
  }
  const n = o.count ?? 12, rate = o.rate ?? 2, rise = o.rise ?? 48, since = o.since ?? 0;
  for (let i = 0; i < n; i++) {
    const age = t - since - i / rate;
    if (age <= 0) continue;
    const r = (q: number) => hash(i, seed, q), ph = r(0) * TAU, out = 1 - Math.exp(-age * 0.9);
    const x = o.from[0] + (r(1) - 0.5) * 260 * out + 22 * Math.sin(age * (0.6 + 0.5 * r(2)) + ph) * out + (o.wind ?? 0) * 26 * age;
    const y = o.from[1] - rise * (0.75 + 0.5 * r(3)) * age - 26 * out;
    drawStar(c, x, y, lerp(9, 17, r(4)) * k * ease.outBack(clamp(age / 0.45)), ph + 0.6 * Math.sin(age * 0.8 + ph), { color: o.color, alpha: A * clamp(age * 5) });
  }
}
