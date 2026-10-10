// CHORUS, the sets — where chorus.ts stages the way home, her evening and the months after it:
//   the way home, one long strip seen from the side: the school corridor and its windows, the steps down to the
//     yard, the yard and the gate, the street with its low shop fronts, the bus stop, the bus
//   her room: the bed under the window, the calendar on the wall; and in that window the night, the morning,
//     the tree losing its leaves, the first snow, the frost
//   what is on her phone, the photographs the day has left her, and her school bag, close up
// What depends on the season is in SEASONS, one entry a chorus: 1 is an afternoon in autumn; 2 the same way home in
// winter, at the blue hour: snow on everything, the trees bare, the windows and the lamps alight, and the way
// starting out of doors, on the terrace along the school's front, where verse 2 left the two of them.
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, hash, lerp, smoothstep, TAU } from '../engine/util';
import {
  CHORUS1_FROST, VERSE2_LAMPS, camera, drawBag, dustMotes, drawStar, frost, glow, layer, leaves, lightShaft, petals, scratch, snow, sparkle,
  type Cam, type Ctx, type Outfit, type Shaft, type V2,
} from './_love';

type V3 = [number, number, number];
// (the kit's own blends, _love-rig.ts and _love-props.ts: her hand and sleeve, wood)
const SKIN = mix('paper', 'peach', 0.4), BEIGE = mix(mix('paper', 'gold', 0.4), 'ink', 0.08), BEIGE_LOW = mix(mix('paper', 'peach', 0.5), 'ink', 0.18);
const WOOD = mix(mix('paper', 'peach', 0.55), 'ink', 0.1), WOOD_LOW = mix(mix('paper', 'peach', 0.7), 'ink', 0.3);
const METAL = mix('frost', 'navy', 0.35), TRIM = CHORUS1_FROST.trim, NIGHT = mix('navy', 'dusk', 0.16);
const fillV = (c: Ctx, y0: number, y1: number, top: string, low: string) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, low); c.fillStyle = g; };
const poly = (c: Ctx, pts: V2[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
// (winter, the blue hour: the evening's colour; the snow in it, lying on top of things, on the ground, in the shade and far off; what is alight; a lamp's post)
const EVE = mix('dusk', 'navy', 0.5), CAP = mix(mix('paper', 'frost', 0.5), 'dusk', 0.25), SNOW = mix(mix(mix('paper', 'frost', 0.5), 'dusk', 0.4), 'navy', 0.08);
const SNOW_LOW = mix(mix('frost', 'dusk', 0.5), 'navy', 0.36), SNOW_FAR = mix(mix('frost', 'dusk', 0.45), 'navy', 0.22);
const LIT = mix('gold', 'paper', 0.3), POST = mix('navy', 'dusk', 0.3);
/** A colour with `k` of another over it: as mix(), but it keeps the opacity it has. */
const over = (col: string, tint: string, k: number) => mix(col, tint, k, +(col.match(/[\d.]+/g)?.[3] ?? 1));
/** Snow lying along the top of something, from x0 to x1 at y: a pale band, `deep` px at its deepest and uneven (the same wherever it is seen from). */
function snowOn(c: Ctx, x0: number, x1: number, y: number, deep = 10, seed = 1, col = CAP) {
  c.fillStyle = col; c.beginPath(); c.rect(x0, y - deep * 0.45, x1 - x0, deep * 0.45 + 2);
  for (let i = Math.ceil(x0 / 26); i * 26 < x1; i++) {
    const r = 12 + 9 * hash(i, seed), x = clamp(i * 26 + 8 * hash(i, seed, 1), x0 + r * 0.7, x1 - r * 0.7);
    c.moveTo(x + r, y - deep * 0.4); c.ellipse(x, y - deep * 0.4, r, deep * (0.35 + 0.3 * hash(i, seed, 2)), 0, 0, TAU);
  }
  c.fill();
}
/** A bare tree: a branch from (x, y), `len` long and `a` rad off upright, and the smaller ones it carries. */
export function bare(c: Ctx, x: number, y: number, len: number, a: number, w: number, seed: number, level = 0) {
  const x1 = x + Math.sin(a) * len, y1 = y - Math.cos(a) * len;
  c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x1, y1); c.stroke();
  if (level > 3 || len < 14) return;
  const n = level ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const r = (k: number) => hash(seed, level, i, k), at = level ? 0.45 + 0.5 * r(1) : 0.52 + 0.46 * (i / (n - 1));
    bare(c, lerp(x, x1, at), lerp(y, y1, at), len * (0.5 + 0.22 * r(2)), a + (i % 2 ? 1 : -1) * (0.42 + 0.4 * r(3)), w * 0.62, seed * 7 + i + 1, level + 1);
  }
}

// ------------------------------------------------------------------ the season
export interface Season {
  name: string;
  /** What the two of them wear. */
  outfit: Outfit;
  /**
   * The sky over the way home, down the frame: its colours as they leave and at the bus stop, and where each of them
   * lies (`skyAt`, 0..1 of the way down to `skyTo` px).
   */
  sky: [string[], string[]]; skyAt: number[]; skyTo: number;
  /** The air that lies over what is far, how much more of it there is than on a clear afternoon, and the colour of the low sun (none once it is down). */
  haze: string; dim: number; sun: string | null;
  /** The crowns of the trees and the hedge: in the light, their body, in the shade. */
  leaf: [string, string, string];
  /**
   * Winter: the trees are bare, snow lies on everything, the windows and the lamps are alight, and the way starts
   * out of doors, on the terrace, where it is the corridor in autumn.
   */
  snow: boolean;
  /** What the hour does to a colour of the way (nothing, in the afternoon), and how much of its air lies over the two of them. */
  eve: (col: string) => string; dusk: number;
  /** What a running foot raises: its shade, and the pale of it. */
  puff: [string, string];
  /** How bright the star marks of her small steps are (1: chorus 1). */
  stars: number;
  /** What comes down through the air along the way (under the camera; `area`: the way out of doors). */
  air: (c: Ctx, t: number, area: { x: number; y: number; w: number; h: number }) => void;
}
/** By chorus: 1 is an autumn afternoon that goes down to sunset; 2 a winter evening that goes down to night. */
export const SEASONS: Record<number, Season> = {
  1: {
    name: 'autumn', outfit: 'autumn',
    sky: [
      [mix('sky', 'paper', 0.12), mix('sky', 'paper', 0.45), mix('paper', 'gold', 0.4), mix('gold', 'peach', 0.4), mix('peach', 'paper', 0.3)],
      [mix('dusk', 'sky', 0.4), mix('blush', 'dusk', 0.3), mix('peach', 'blush', 0.35), mix('gold', 'peach', 0.55), mix('gold', 'paper', 0.25)],
    ],
    skyAt: [0, 0.3, 0.56, 0.8, 1], skyTo: 820,
    haze: mix('paper', 'gold', 0.35), dim: 0, sun: 'gold',
    leaf: [mix('gold', 'paper', 0.3), mix(mix('gold', 'peach', 0.5), 'ink', 0.12), mix(mix('peach', 'rose', 0.22), 'ink', 0.3)],
    snow: false, eve: (col) => col, dusk: 0, puff: [mix('peach', 'ink', 0.22), rgba('paper')], stars: 1,
    air: (c, t, area) => { leaves(c, t, { ...area, count: 22, wind: -0.25, seed: 41 }); petals(c, t, { ...area, count: 12, wind: -0.2, seed: 43 }); },
  },
  2: {
    name: 'winter', outfit: 'winter',
    // (the sky verse 2 ends on, VERSE2_LAMPS, laid down the whole frame as it is there; and the night it goes down to)
    sky: [[...VERSE2_LAMPS.sky], [mix('navy', 'dusk', 0.2), mix('navy', 'dusk', 0.5), mix('dusk', 'navy', 0.25)]],
    skyAt: [0, 0.55, 1], skyTo: H,
    haze: mix('dusk', 'navy', 0.55), dim: 0.5, sun: null,
    leaf: [CAP, mix(mix('frost', 'navy', 0.5), 'dusk', 0.3), mix('navy', 'dusk', 0.35)],
    snow: true, eve: (col) => over(over(col, 'frost', 0.25), EVE, 0.6), dusk: 0.12, puff: [mix('dusk', 'navy', 0.35), rgba('paper')], stars: 1.35,
    air: (c, t) => { snow(c, t, { x: -900, y: -560, w: 7200, h: 2100, count: 430, wind: -0.12, seed: 47 }); },
  },
};

// ------------------------------------------------------------------ the way home: where things are
/** How large the two of them are on the way; the corridor's floor (y); how much lower the yard and the street lie. */
export const S = 0.92, FLOOR = 925, DROP = 300, GROUND = FLOOR + DROP;
/**
 * Along the way (x, at the depth of the two): the top of the steps (the corridor ends there), their foot, the gate,
 * the sign of the bus stop, where she and he stop, and the door of the bus.
 */
export const WAY = { steps: 1500, yard: 1995, gate: 3050, sign: 4150, her: 4390, him: 4590, door: 4660 } as const;
/** The floor under somebody at x: the corridor's, the steps (taken as a slope), the yard's. */
export const groundAt = (x: number) => FLOOR + DROP * clamp((x - WAY.steps + 45) / (WAY.yard - WAY.steps + 45));
/**
 * The bus, in its own px (from its rear along the road, y up from the road): how large it is drawn (it stands
 * across the pavement, further off than they are), its length, its door, the window he waves from, its floor;
 * and the road under it (y of the way).
 */
export const BUS = { k: 0.82, len: 1560, door: [680, 850] as V2, win: [875, 1065] as V2, floor: 100, road: GROUND - 62 } as const;
/** Where the sun stands over the way (on screen): it goes down as they go. */
export const sunAt = (late: number): V2 => [1590, lerp(350, 520, late)];

/** The part of a layer `depth` away that is in view under a camera: from x to x. */
const span = (cam: Cam, depth: number, pad = 80): V2 => { const z = 1 + ((cam.zoom ?? 1) - 1) * depth, mid = W / 2 + (cam.x ?? 0) * depth; return [mid - W / 2 / z - pad, mid + W / 2 / z + pad]; };
/** Where a layer `depth` away shows what lies behind x of the way, when the camera is on it. */
const behind = (x: number, depth: number) => W / 2 + (x - W / 2) * depth;
/** The part of the way that is in view. */
export const inView = (cam: Cam) => span(cam, 1);
/** A point of a layer `depth` away, on screen. */
export const seen = (cam: Cam, [x, y]: V2, depth = 1): V2 => { const z = 1 + ((cam.zoom ?? 1) - 1) * depth; return [(x - W / 2 - (cam.x ?? 0) * depth) * z + W / 2, (y - H / 2 - (cam.y ?? 0) * depth) * z + H / 2]; };

// ------------------------------------------------------------------ the way home: sky, distance, trees
function sky(c: Ctx, s: Season, late: number) {
  const g = c.createLinearGradient(0, 0, 0, s.skyTo);
  s.skyAt.forEach((at, i) => g.addColorStop(at, mix(s.sky[0][i]!, s.sky[1][i]!, late)));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (!s.sun) return;
  const [x, y] = sunAt(late), r = c.createRadialGradient(x, y, 0, x, y, 950);
  r.addColorStop(0, mix('paper', s.sun, 0.3, 0.95)); r.addColorStop(0.06, mix('paper', s.sun, 0.45, 0.6)); r.addColorStop(0.4, mix(s.sun, 'paper', 0.3, 0.2)); r.addColorStop(1, mix(s.sun, 'paper', 0.3, 0));
  c.fillStyle = r; c.fillRect(0, 0, W, H);
}
const kept = new Map<string, HTMLCanvasElement>();
/**
 * What is too far off to be seen moving (the town, the trees, the shops across the road): a strip of its layer, from
 * (x0, y0) to (x1, y1), painted once at `res` of the picture's resolution (a little soft, as far things are) with
 * `haze` of the air's colour over it, and kept. (Three such layers painted afresh each frame cost more than all the rest.)
 * `lit` paints what is alight there, which the air does not dim. `quality`: how carefully it is laid on (a soft glow needs little care).
 */
function strip(c: Ctx, key: string, [x0, y0, x1, y1]: number[], res: number, haze: [string, number], draw: (c: Ctx) => void, lit?: (c: Ctx) => void, quality: ImageSmoothingQuality = 'high') {
  let cv = kept.get(key);
  if (!cv) {
    kept.set(key, (cv = document.createElement('canvas')));
    cv.width = Math.round((x1! - x0!) * SCALE * res); cv.height = Math.round((y1! - y0!) * SCALE * res);
    const x = scaleContext2D(cv.getContext('2d')!, SCALE * res);
    x.translate(-x0!, -y0!); draw(x);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgba(haze[0], haze[1]); x.fillRect(x0!, y0!, x1! - x0!, y1! - y0!);
    if (lit) { x.globalCompositeOperation = 'source-over'; lit(x); }
  }
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = quality;
  c.drawImage(cv, x0!, y0!, x1! - x0!, y1! - y0!);
}
const PUFFS: V3[] = [[0, 0, 60], [-74, 16, 42], [70, 12, 48], [-28, -26, 44], [34, -30, 38], [132, 24, 30], [-132, 26, 28]];
/** Far off: clouds lit from under by the low sun, the hills, the town in the haze with a window lit here and there. */
function distance(c: Ctx, [x0, x1]: V2) {
  for (let i = Math.floor(x0 / 520) - 1; i <= x1 / 520; i++) {
    const k = 0.5 + 0.55 * hash(i, 11), x = i * 520 + 240 * hash(i, 12), y = 270 + 180 * hash(i, 13);
    for (const [low, col] of [[1, mix('peach', 'blush', 0.5, 0.55)], [0, rgba('paper', 0.9)]] as [number, string][]) {
      c.fillStyle = col; c.beginPath();
      for (const [px, py, r] of PUFFS) { c.moveTo(x + (px + r) * k, y + (py + low * 10) * k); c.arc(x + px * k, y + (py + low * 10) * k, r * k, 0, TAU); }
      c.fill();
    }
  }
  c.fillStyle = mix(mix('gold', 'peach', 0.5), 'paper', 0.4); c.fillRect(x0, 700, x1 - x0, 600);
  for (let i = Math.floor(x0 / 105) - 1; i <= x1 / 105; i++) { c.fillStyle = mix(mix('dusk', 'peach', 0.45 + 0.3 * hash(i, 71)), 'paper', 0.5); c.beginPath(); c.arc(i * 105 + 40 * hash(i, 72), 690 + 16 * hash(i, 73), 60 + 50 * hash(i, 74), 0, TAU); c.fill(); }
  for (let i = Math.floor(x0 / 140) - 1; i <= x1 / 140; i++) {
    if (hash(i, 21) < 0.28) continue;
    const x = i * 140 + 50 * hash(i, 22), w = 64 + 70 * hash(i, 23), h = 60 + 130 * hash(i, 24);
    c.fillStyle = mix(mix('dusk', 'frost', 0.5), 'paper', 0.42); c.fillRect(x, 720 - h, w, h + 300);
    c.fillStyle = rgba('gold', 0.5);
    for (let j = 0; j < 3; j++) if (hash(i, j, 25) < 0.5) c.fillRect(x + 10 + (w - 26) * hash(i, j, 26), 720 - h + 14 + (h - 40) * hash(i, j, 27), 7, 9);
  }
}
/** The town after dark: more of its windows are alight. */
function townLit(c: Ctx, [x0, x1]: V2) {
  c.fillStyle = rgba(LIT, 0.95);
  for (let i = Math.floor(x0 / 140) - 1; i <= x1 / 140; i++) {
    if (hash(i, 21) < 0.28) continue;
    const x = i * 140 + 50 * hash(i, 22), w = 64 + 70 * hash(i, 23), h = 60 + 130 * hash(i, 24);
    for (let j = 0; j < 6; j++) if (hash(i, j, 25) < 0.7) c.fillRect(x + 10 + (w - 26) * hash(i, j, 26), 720 - h + 14 + (h - 40) * hash(i, j, 27), 7, 9);
  }
}
/** A lamp seen from far off, its light at (x, y) over a post `h` long. (`soft`: its glow alone, for the light layer.) */
function farLamp(c: Ctx, x: number, y: number, h: number, soft: boolean) {
  const r = soft ? 46 : 64, g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba('gold', soft ? 0.9 : 0.5)); g.addColorStop(0.3, rgba('gold', soft ? 0.3 : 0.2)); g.addColorStop(1, rgba('gold', 0));
  if (!soft) { c.fillStyle = mix(POST, EVE, 0.3); c.fillRect(x - 2.5, y + 6, 5, h - 6); }
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  if (!soft) { c.fillStyle = mix('paper', 'gold', 0.4); c.beginPath(); c.arc(x, y, 8.5, 0, TAU); c.fill(); }
}
/** A tree standing on (x, y): a round crown of radius `r`, dappled by the sun (its colours are the season's). */
function tree(c: Ctx, x: number, y: number, r: number, t: number, seed: number, leaf: Season['leaf'], trunk = 1.25) {
  const cy = y - r * trunk - r * 0.5, sway = (i: number) => r * 0.014 * Math.sin(t * 0.7 + i * 1.7 + seed);
  c.fillStyle = mix('ink', 'peach', 0.3);
  poly(c, [[x - r * 0.09, y], [x - r * 0.05, cy], [x + r * 0.05, cy], [x + r * 0.09, y]]); c.fill();
  const crown: V3[] = [[0, 0.3, 0.74], [-0.62, 0.22, 0.56], [0.6, 0.24, 0.6], [-0.84, 0.5, 0.36], [0.86, 0.5, 0.36], [0, 0, 0.92], [-0.36, -0.42, 0.56], [0.34, -0.4, 0.54]];
  const blobs = new Path2D();
  crown.forEach(([px, py, pr], i) => { const bx = x + px * r + sway(i), by = cy + py * r; blobs.moveTo(bx + pr * r, by); blobs.arc(bx, by, pr * r, 0, TAU); });
  const g = c.createLinearGradient(x + r * 0.5, cy - r, x - r * 0.4, cy + r);
  g.addColorStop(0, mix(leaf[1], leaf[0], 0.6)); g.addColorStop(0.5, leaf[1]); g.addColorStop(1, leaf[2]);
  c.fillStyle = g; c.fill(blobs);
  // the dapples: leaves that catch the sun, and the shade between them
  c.save(); c.clip(blobs);
  for (let i = 0; i < 16; i++) {
    const a = hash(i, seed, 1) * TAU, d = Math.sqrt(hash(i, seed, 2)) * r * 0.95, lit = hash(i, seed, 3) < 0.62, k = 0.5 + 0.5 * Math.sin(t * (0.7 + hash(i, seed, 4)) + i);
    c.fillStyle = lit ? mix(leaf[0], 'paper', 0.2, 0.3 + 0.4 * k) : mix(leaf[2], 'ink', 0.1, 0.22);
    c.beginPath(); c.ellipse(x + Math.cos(a) * d + (lit ? r * 0.14 : -r * 0.1) + sway(i), cy + Math.sin(a) * d * 0.9 + (lit ? -r * 0.12 : r * 0.14), r * (0.07 + 0.09 * hash(i, seed, 5)), r * (0.05 + 0.05 * hash(i, seed, 6)), a, 0, TAU); c.fill();
  }
  c.restore();
}
/** Half way off: the school's other wing across the yard, and trees all along the way (they stand on y = YARD). */
const YARD = 950;
function yard(c: Ctx, [x0, x1]: V2, s: Season) {
  const base = YARD, a = behind(WAY.steps + 100, 0.5), z = behind(WAY.gate - 420, 0.5);
  if (a < x1 && z > x0) {
    fillV(c, base - 400, base, mix('paper', 'peach', 0.3), mix(mix('paper', 'peach', 0.5), 'ink', 0.06)); c.fillRect(a, base - 400, z - a, 400);
    c.fillStyle = mix(mix('paper', 'peach', 0.5), 'ink', 0.14); c.fillRect(a - 6, base - 410, z - a + 12, 14);
    for (let j = 0; j < 4; j++) for (let x = a + 26; x + 58 < z; x += 84) { c.fillStyle = mix('sky', 'navy', 0.18, 0.75); c.fillRect(x, base - 366 + j * 92, 58, 50); c.fillStyle = rgba('paper', 0.55); c.fillRect(x + 27, base - 366 + j * 92, 3, 50); }
  }
  if (s.snow) { c.strokeStyle = mix('ink', 'peach', 0.25); c.lineCap = 'round'; }
  for (let i = Math.floor(x0 / 230) - 1; i <= x1 / 230; i++) {
    if (hash(i, 51) < 0.3) continue;
    const street = i * 230 > behind(WAY.gate, 0.5);
    if (s.snow) bare(c, i * 230 + 90 * hash(i, 52), base + 6, (street ? 230 : 180) + 70 * hash(i, 53), (hash(i, 54) - 0.5) * 0.16, 13, 60 + i);
    else tree(c, i * 230 + 90 * hash(i, 52), base + 6, (street ? 126 : 96) + 40 * hash(i, 53), 0, 60 + i, s.leaf, street ? 1.3 : 1);
  }
}
/** Where the lamps stand along the yard's far side (x, in that layer). */
const YARD_LAMPS = [1390, 1640, 1890];
/** The yard after dark: snow along the other wing's roof, some of its windows alight, the lamps along its foot. (`soft`: what glows of that, for the light layer.) */
function yardLit(c: Ctx, soft = false) {
  const base = YARD, a = behind(WAY.steps + 100, 0.5), z = behind(WAY.gate - 420, 0.5);
  if (!soft) snowOn(c, a - 6, z + 6, base - 410, 9, 3);
  for (let j = 0; j < 4; j++) for (let x = a + 26; x + 58 < z; x += 84) {
    if (hash(j, Math.round(x), 61) > 0.42) continue;
    c.fillStyle = soft ? rgba('gold', 0.4) : rgba(LIT, 0.95); c.fillRect(x, base - 366 + j * 92, 58, 50);
    if (!soft) { c.fillStyle = mix(mix('paper', 'peach', 0.4), EVE, 0.4); c.fillRect(x + 27, base - 366 + j * 92, 3, 50); }
  }
  for (const x of YARD_LAMPS) farLamp(c, x, base - 172, 178, soft);
}

// ------------------------------------------------------------------ the way home: the street's far side
/**
 * What a shop sells, as a small picture round (x, y), about 54 px wide at s = 1: 0 a book, 1 a bowl of noodles,
 * 2 fruit, 3 steamed buns. (The shops say what they are in pictures: nothing is written on them.)
 */
function goods(c: Ctx, kind: number, x: number, y: number, s = 1) {
  const blue = mix('sky', 'navy', 0.3), stick = mix('peach', 'ink', 0.45);
  const line = (pts: number[], col: string, w: number) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); for (let i = 0; i < pts.length; i += 2) { if (i) c.lineTo(pts[i]!, pts[i + 1]!); else c.moveTo(pts[i]!, pts[i + 1]!); } c.stroke(); };
  const steam = (sx: number) => line([sx, -13, sx + 4, -18, sx - 2, -23, sx + 2, -28], rgba('ink', 0.22), 2.2);
  c.save(); c.translate(x, y); c.scale(s, s);
  if (kind === 0) {
    // an open book: its cover, its two pages, a few lines on them
    c.fillStyle = blue; c.beginPath(); c.roundRect(-26, -12, 52, 30, 3); c.fill();
    c.fillStyle = rgba('paper'); poly(c, [[-23, -15], [0, -10], [0, 14], [-23, 10]]); c.fill(); poly(c, [[23, -15], [0, -10], [0, 14], [23, 10]]); c.fill();
    for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) line([sg * 5, -4 + i * 6, sg * 18, -6.5 + i * 6], rgba('ink', 0.26), 1.8);
    line([0, -10, 0, 14], rgba('ink', 0.3), 1.8);
  } else if (kind === 1) {
    // a bowl of noodles, the chopsticks in it, steam over it
    steam(-9); steam(3);
    line([8, -6, 27, -24], stick, 3); line([13, -5, 30, -19], stick, 3);
    c.fillStyle = mix('gold', 'paper', 0.25); c.beginPath(); c.ellipse(0, -3, 22, 8, 0, 0, TAU); c.fill();
    c.fillStyle = blue; c.beginPath(); c.moveTo(-25, -3); c.bezierCurveTo(-23, 22, 23, 22, 25, -3); c.closePath(); c.fill();
    c.fillStyle = rgba('paper', 0.8); c.fillRect(-16, 6, 32, 3);
  } else if (kind === 2) {
    // fruit: an apple with its stalk and leaf, an orange beside it
    c.fillStyle = mix('gold', 'peach', 0.45); c.beginPath(); c.arc(14, 6, 13, 0, TAU); c.fill();
    c.fillStyle = mix('peach', 'rose', 0.42); c.beginPath(); c.arc(-9, 3, 16, 0, TAU); c.fill();
    c.fillStyle = rgba('paper', 0.35); c.beginPath(); c.ellipse(-15, -3, 4, 6, 0.5, 0, TAU); c.fill();
    line([-9, -12, -7, -19], stick, 2.5);
    c.fillStyle = mix('gold', 'ink', 0.3); c.beginPath(); c.ellipse(0, -19, 7, 3.5, -0.5, 0, TAU); c.fill();
  } else {
    // two steamed buns in their basket, steam over them
    steam(-7); steam(7);
    for (const bx of [-12, 12]) { c.fillStyle = rgba('paper'); c.beginPath(); c.ellipse(bx, 7, 12.5, 15, 0, Math.PI, TAU); c.fill(); c.strokeStyle = rgba('ink', 0.3); c.lineWidth = 1.8; c.stroke(); line([bx - 4, -3, bx, -8, bx + 4, -3], rgba('ink', 0.3), 1.6); }
    c.fillStyle = mix('gold', 'ink', 0.28); c.beginPath(); c.roundRect(-28, 6, 56, 14, 4); c.fill();
    c.fillStyle = rgba('paper', 0.35); c.fillRect(-28, 11, 56, 2.5);
  }
  c.restore();
}
/** A low shop front standing on (x, base): its sign (a picture of what it sells: the only place it is shown), its striped awning, its window lit from inside, its door. */
function shop(c: Ctx, x: number, base: number, w: number, h: number, i: number) {
  const tints = [mix('paper', 'peach', 0.32), mix('paper', 'blush', 0.5), mix('paper', 'sky', 0.4), mix('paper', 'gold', 0.42)], stripes = [rgba('peach'), mix('blush', 'rose', 0.15), mix('sky', 'navy', 0.1), mix('gold', 'peach', 0.3)];
  const wall = tints[i % 4]!, top = base - h, ay = top + 84, n = Math.round(w / 44), wy = ay + 66, wh = base - 26 - wy;
  fillV(c, top, base, wall, mix(wall, 'ink', 0.12)); c.fillRect(x, top, w, h + 60);
  c.fillStyle = mix(mix('peach', 'ink', 0.4), 'navy', 0.1); c.fillRect(x - 8, top - 16, w + 16, 20);
  c.fillStyle = rgba('paper', 0.92); c.beginPath(); c.roundRect(x + 30, top + 16, w - 60, 56, 6); c.fill();
  goods(c, i % 4, x + w / 2, top + 48);
  for (let j = 0; j < n; j++) { c.fillStyle = j % 2 ? rgba('paper') : stripes[(i + 1) % 4]!; poly(c, [[x + 8 + ((w - 16) * j) / n, ay], [x + 8 + ((w - 16) * (j + 1)) / n, ay], [x - 14 + ((w + 28) * (j + 1)) / n, ay + 46], [x - 14 + ((w + 28) * j) / n, ay + 46]]); c.fill(); }
  c.fillStyle = rgba('ink', 0.1); c.fillRect(x - 14, ay + 46, w + 28, 7);
  c.fillStyle = mix(mix('peach', 'ink', 0.3), mix('gold', 'paper', 0.3), 0.8); c.fillRect(x + 26, wy, w * 0.52, wh);
  c.strokeStyle = rgba('paper', 0.9); c.lineWidth = 5; c.strokeRect(x + 26, wy, w * 0.52, wh);
  c.beginPath(); c.moveTo(x + 26 + w * 0.26, wy); c.lineTo(x + 26 + w * 0.26, wy + wh); c.stroke();
  c.fillStyle = mix(wall, 'ink', 0.32); c.fillRect(x + w - 104, wy - 8, 74, base - wy + 8);
  c.fillStyle = mix('sky', 'paper', 0.3, 0.6); c.fillRect(x + w - 94, wy + 2, 54, 70);
}
/** The far side of the street: the row of shops along it (they stand on y = SHOPS), a lane between two of them now and then. */
const SHOPS = 1050;
function shopRow(x1: number) {
  const row: { x: number; w: number; h: number; i: number }[] = [];
  for (let i = 0, x = behind(WAY.gate + 260, 0.8); x < x1; i++) {
    const w = 300 + 140 * hash(i, 31), h = 236 + 70 * hash(i, 32);
    row.push({ x, w, h, i });
    x += w + (hash(i, 33) < 0.34 ? 60 + 70 * hash(i, 34) : 10);
  }
  return row;
}
function shops(c: Ctx, x1: number) { for (const p of shopRow(x1)) shop(c, p.x, SHOPS, p.w, p.h, p.i); }
/**
 * The street's far side after dark: snow on the roofs and the awnings, the shop windows alight and their light on
 * the snow before them, the lamps along the kerb. (`soft`: what glows of that, for the light layer.)
 */
function shopsLit(c: Ctx, x1: number, soft = false) {
  for (const { x, w, h, i } of shopRow(x1)) {
    const top = SHOPS - h, ay = top + 84, wy = ay + 66, wh = SHOPS - 26 - wy;
    if (soft) { c.fillStyle = rgba('gold', 0.32); c.fillRect(x + 26, wy, w * 0.52, wh); c.fillRect(x + w - 94, wy + 2, 54, 70); continue; }
    snowOn(c, x - 8, x + w + 8, top - 16, 11, i + 40); snowOn(c, x - 12, x + w + 12, ay, 8, i + 80);
    c.fillStyle = rgba(LIT, 0.94); c.fillRect(x + 26, wy, w * 0.52, wh);
    c.fillStyle = rgba('gold', 0.8); c.fillRect(x + w - 94, wy + 2, 54, 70);
    c.strokeStyle = mix('paper', EVE, 0.25); c.lineWidth = 5; c.strokeRect(x + 26, wy, w * 0.52, wh);
    c.beginPath(); c.moveTo(x + 26 + w * 0.26, wy); c.lineTo(x + 26 + w * 0.26, wy + wh); c.stroke();
    const spill = c.createLinearGradient(0, SHOPS, 0, SHOPS + 56);
    spill.addColorStop(0, rgba(LIT, 0.42)); spill.addColorStop(1, rgba(LIT, 0));
    c.fillStyle = spill; poly(c, [[x + 26, SHOPS], [x + 26 + w * 0.52, SHOPS], [x + 60 + w * 0.52, SHOPS + 56], [x - 8, SHOPS + 56]]); c.fill();
  }
  for (let x = 2700; x < x1; x += 470) farLamp(c, x, SHOPS - 350, 362, soft);
}

// ------------------------------------------------------------------ the way home: the strip they walk along
const PITCH = 500, SILL = FLOOR - 255, HEAD = FLOOR - 640, END = WAY.steps + 60;
const ROAD = mix(mix('dusk', 'frost', 0.5), 'paper', 0.3), ROAD_LOW = mix(mix('dusk', 'frost', 0.4), 'ink', 0.12);
/** The corridor's windows that are in view: the left edge of each (they are 380 wide). */
export function openings([x0, x1]: V2): number[] {
  const out: number[] = [];
  for (let m = Math.floor(x0 / PITCH) - 1; m <= 2 && m * PITCH + 60 < x1; m++) out.push(m * PITCH + 60);
  return out;
}
/** The corridor: its wall in its own shade (the light is behind it), the windows in it, the floor with the sun lying across it. */
function corridor(c: Ctx, view: V2) {
  const x0 = view[0], z = Math.min(view[1], END);
  if (x0 >= z) return;
  const wall = mix(mix('paper', 'peach', 0.3), 'ink', 0.06), low = mix(mix('paper', 'peach', 0.48), 'ink', 0.13), dado = mix(mix('sky', 'paper', 0.35), 'ink', 0.08);
  fillV(c, HEAD - 320, SILL, wall, low); c.fillRect(x0, HEAD - 1400, z - x0, 1400);
  for (let m = Math.floor(x0 / PITCH); m <= 3 && m * PITCH - 60 < z; m++) c.fillRect(m * PITCH - 60, HEAD, 120, SILL - HEAD);
  fillV(c, SILL, FLOOR, dado, mix(mix('sky', 'paper', 0.2), 'navy', 0.14)); c.fillRect(x0, SILL, z - x0, FLOOR - SILL);
  c.fillStyle = rgba('ink', 0.07); c.fillRect(x0, HEAD - 12, z - x0, 12);
  for (const a of openings(view)) {
    const sheen = c.createLinearGradient(a, SILL, a + 300, HEAD);
    sheen.addColorStop(0.2, rgba('paper', 0)); sheen.addColorStop(0.45, rgba('paper', 0.16)); sheen.addColorStop(0.55, rgba('paper', 0.03)); sheen.addColorStop(0.7, rgba('paper', 0.1)); sheen.addColorStop(0.9, rgba('paper', 0));
    c.fillStyle = sheen; c.fillRect(a, HEAD, 380, SILL - HEAD);
    c.strokeStyle = TRIM; c.lineWidth = 9; c.strokeRect(a, HEAD, 380, SILL - HEAD);
    c.lineWidth = 6; c.beginPath(); c.moveTo(a + 190, HEAD); c.lineTo(a + 190, SILL); c.moveTo(a, HEAD + 112); c.lineTo(a + 380, HEAD + 112); c.stroke();
    c.fillStyle = TRIM; c.fillRect(a - 14, SILL - 5, 408, 13);
    c.fillStyle = rgba('ink', 0.1); c.fillRect(a - 14, SILL + 8, 408, 6);
  }
  const w = Math.min(z, WAY.steps) - x0;
  fillV(c, FLOOR, FLOOR + 175, mix(mix('paper', 'peach', 0.45), 'ink', 0.07), mix(mix('paper', 'peach', 0.66), 'ink', 0.2)); c.fillRect(x0, FLOOR, w, 1200);
  for (const a of openings(view)) {
    const g = c.createLinearGradient(0, FLOOR, 0, FLOOR + 175);
    g.addColorStop(0, mix('gold', 'paper', 0.25, 0.55)); g.addColorStop(1, mix('gold', 'paper', 0.25, 0.12));
    c.fillStyle = g; poly(c, [[a, FLOOR], [a + 380, FLOOR], [a + 170, FLOOR + 175], [a - 210, FLOOR + 175]]); c.fill();
  }
  c.fillStyle = mix(dado, 'ink', 0.2); c.fillRect(x0, FLOOR - 14, z - x0, 14);
}
/** The ground outside: the yard, and past the gate the far pavement, the road and its kerb; the steps down from the corridor. */
function ground(c: Ctx, [x0, x1]: V2, s: Season) {
  const far = GROUND - 125, a = Math.max(x0, WAY.steps), r = Math.max(x0, WAY.gate + 70), e = s.eve;
  if (x1 <= WAY.steps) return;
  if (s.snow) {
    // snow on the yard and on both pavements; the road between them, two wheel tracks along it, snow heaped at its kerbs
    fillV(c, far, GROUND, SNOW_FAR, SNOW); c.fillRect(a, far, x1 - a, 125);
    if (x1 > r) {
      fillV(c, far + 13, GROUND - 22, e(ROAD), e(ROAD_LOW)); c.fillRect(r, far + 13, x1 - r, 92);
      c.fillStyle = rgba(SNOW, 0.26); for (const y of [far + 36, GROUND - 56]) c.fillRect(r, y, x1 - r, 10);
      snowOn(c, r, x1, far + 16, 8, 8); snowOn(c, r, x1, GROUND - 18, 13, 7);
    }
    fillV(c, GROUND - 8, GROUND + 200, SNOW, SNOW_LOW); c.fillRect(a, GROUND - 8, x1 - a, 1200);
  } else {
    fillV(c, far, GROUND, mix('paper', 'peach', 0.3), mix('paper', 'peach', 0.44)); c.fillRect(a, far, x1 - a, 125);
    if (x1 > r) {
      fillV(c, far + 13, GROUND - 22, ROAD, ROAD_LOW); c.fillRect(r, far + 13, x1 - r, 92);
      c.fillStyle = rgba('paper', 0.7);
      for (let i = Math.ceil(r / 230); i * 230 < x1; i++) c.fillRect(i * 230, GROUND - 71, 96, 6);
      c.fillStyle = mix('paper', 'frost', 0.3); c.fillRect(r, GROUND - 24, x1 - r, 16);
      c.fillStyle = rgba('ink', 0.1); c.fillRect(r, GROUND - 28, x1 - r, 4);
    }
    fillV(c, GROUND - 8, GROUND + 200, mix('paper', 'peach', 0.44), mix(mix('paper', 'peach', 0.62), 'ink', 0.14)); c.fillRect(a, GROUND - 8, x1 - a, 1200);
    c.strokeStyle = rgba('ink', 0.07); c.lineWidth = 2; c.beginPath();
    for (let i = Math.floor(a / 240); i * 240 < x1 + 80; i++) { c.moveTo(i * 240, GROUND - 8); c.lineTo(i * 240 - 70, GROUND + 260); }
    c.stroke();
  }
  if (x0 < WAY.gate + 200 && x1 > 2050) {
    // the yard: a hedge along its far side; the gate, its leaf swung open along the way, and the pillar it hangs on
    c.fillStyle = e(mix(s.leaf[1], 'ink', 0.1)); c.beginPath(); c.roundRect(2090, far - 62, 470, 70, 30);
    for (let x = 2120; x < 2540; x += 46) { const r = 30 + 22 * hash(x, 2); c.moveTo(x + r, far - 56); c.arc(x, far - 56 - 8 * hash(x, 1), r, 0, TAU); }
    c.fill();
    c.fillStyle = mix(s.leaf[0], 'paper', 0.2, s.snow ? 0.8 : 0.32); for (let x = 2130; x < 2540; x += 46) { c.beginPath(); c.ellipse(x + 12 * hash(x, 3), far - 74 - 14 * hash(x, 4), s.snow ? 24 : 15, 9, s.snow ? -0.1 : -0.4, 0, TAU); c.fill(); }
    c.strokeStyle = e(METAL); c.lineCap = 'round'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(2620, far - 400); c.lineTo(2980, far - 400); c.moveTo(2620, far - 30); c.lineTo(2980, far - 30); c.stroke();
    c.lineWidth = 4.5; c.beginPath(); for (let x = 2624; x < 2980; x += 38) { c.moveTo(x, far - 428); c.lineTo(x, far - 12); } c.stroke();
    const wall = e(mix('paper', 'peach', 0.3));
    fillV(c, far - 500, far, wall, e(mix(mix('paper', 'peach', 0.5), 'ink', 0.08))); c.fillRect(WAY.gate - 70, far - 500, 140, 512);
    c.fillStyle = e(mix(mix('paper', 'peach', 0.5), 'ink', 0.16)); c.fillRect(WAY.gate - 84, far - 528, 168, 30);
    c.fillStyle = e(rgba('paper', 0.9)); c.beginPath(); c.roundRect(WAY.gate - 27, far - 410, 54, 236, 5); c.fill();
    c.fillStyle = rgba('ink', 0.28); for (let i = 0; i < 4; i++) c.fillRect(WAY.gate - 13, far - 388 + i * 52, 26, 30);
    if (s.snow) { snowOn(c, 2616, 2984, far - 400, 6, 13); snowOn(c, WAY.gate - 84, WAY.gate + 84, far - 528, 12, 12); }
    else { c.strokeStyle = rgba('ink', 0.16); c.lineWidth = 6; c.beginPath(); c.moveTo(WAY.gate, far + 6); c.lineTo(WAY.gate - 70, GROUND + 320); c.stroke(); }
  }
  if (x0 < WAY.yard + 60) {
    // the steps: the wall along them with its rail, and the six steps
    const wall = e(mix(mix('paper', 'peach', 0.34), 'ink', 0.08)), pts: V2[] = [[WAY.steps, FLOOR]];
    fillV(c, FLOOR - 140, GROUND, wall, mix(wall, 'ink', 0.1)); poly(c, [[WAY.steps, FLOOR - 140], [2010, GROUND - 140], [2010, GROUND + 60], [WAY.steps, FLOOR + 60]]); c.fill();
    c.strokeStyle = e(TRIM); c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(WAY.steps, FLOOR - 140); c.lineTo(2010, GROUND - 140); c.stroke();
    c.fillStyle = e(TRIM); c.fillRect(1996, GROUND - 180, 30, 180);
    for (let i = 0; i < 6; i++) pts.push([WAY.steps + i * 90, FLOOR + (i + 1) * 50], [WAY.steps + (i + 1) * 90, FLOOR + (i + 1) * 50]);
    fillV(c, FLOOR, GROUND + 200, e(mix('paper', 'peach', 0.26)), e(mix(mix('paper', 'peach', 0.5), 'ink', 0.12))); poly(c, [...pts, [WAY.steps + 540, GROUND + 1200], [WAY.steps, GROUND + 1200]]); c.fill();
    for (let i = 0; i < 6; i++) {
      const x = WAY.steps + i * 90, y = FLOOR + i * 50;
      c.fillStyle = rgba('ink', 0.08); c.fillRect(x, y, 7, 50);
      if (s.snow) snowOn(c, x + 5, x + 96, y + 52, 9, 20 + i); else { c.fillStyle = rgba('paper', 0.6); c.fillRect(x, y + 50, 90, 4); }
    }
    if (s.snow) snowOn(c, 1990, 2032, GROUND - 180, 9, 27);
  }
}
/**
 * In winter the way starts out of doors, where the corridor is in autumn: the terrace along the school's front. Its
 * low wall, as high as the corridor's sill, snow along the top of it and a pier under each lamp; the snow on its floor.
 */
function terrace(c: Ctx, view: V2, s: Season, lamps: Lamp[]) {
  const x0 = view[0], z = Math.min(view[1], WAY.steps + 16), e = s.eve;
  if (x0 >= z) return;
  const wall = e(mix(mix('paper', 'peach', 0.3), 'ink', 0.06)), low = e(mix(mix('paper', 'peach', 0.48), 'ink', 0.13));
  fillV(c, SILL, FLOOR, wall, low); c.fillRect(x0, SILL, z - x0, FLOOR - SILL);
  c.fillStyle = e(TRIM); c.fillRect(x0, SILL - 8, z - x0, 22);
  c.fillStyle = rgba('ink', 0.09); c.fillRect(x0, SILL + 14, z - x0, 7);
  snowOn(c, x0, z, SILL - 8, 12, 31);
  for (const x of [...lamps.filter((l) => l.x < WAY.steps).map((l) => l.x), WAY.steps - 14]) {
    if (x < x0 - 60 || x > z + 60) continue;
    fillV(c, SILL - 30, FLOOR, mix(wall, 'paper', 0.12), low); c.fillRect(x - 30, SILL - 30, 60, FLOOR - SILL + 30);
    c.fillStyle = e(TRIM); c.fillRect(x - 36, SILL - 38, 72, 14);
    c.fillStyle = rgba('ink', 0.07); c.fillRect(x + 24, SILL - 24, 6, FLOOR - SILL + 24);
    snowOn(c, x - 36, x + 36, SILL - 38, 12, 33 + Math.round(x));
  }
  fillV(c, FLOOR, FLOOR + 175, SNOW, SNOW_LOW); c.fillRect(x0, FLOOR, Math.min(z, WAY.steps) - x0, 1200);
  c.fillStyle = e(mix(mix('sky', 'paper', 0.35), 'ink', 0.2)); c.fillRect(x0, FLOOR - 10, Math.min(z, WAY.steps) - x0, 10);
  snowOn(c, x0, Math.min(z, WAY.steps), FLOOR + 2, 7, 35);
}
/** The sign of the bus stop, on the near pavement. */
function busStop(c: Ctx, s: Season) {
  const x = WAY.sign, y = GROUND - 6, e = s.eve, blue = e(mix('sky', 'navy', 0.25)), white = e(rgba('paper'));
  c.fillStyle = rgba('ink', 0.14); c.beginPath(); c.ellipse(x - 14, y + 2, 40, 6, 0, 0, TAU); c.fill();
  c.fillStyle = e(METAL); c.fillRect(x - 5, y - 500, 10, 500);
  c.fillStyle = blue; c.beginPath(); c.arc(x, y - 528, 52, 0, TAU); c.fill();
  c.strokeStyle = white; c.lineWidth = 6; c.beginPath(); c.arc(x, y - 528, 41, 0, TAU); c.stroke();
  c.fillStyle = white; c.beginPath(); c.roundRect(x - 25, y - 546, 50, 29, 7); c.fill();
  for (const sg of [-1, 1]) { c.beginPath(); c.arc(x + sg * 13, y - 514, 5.5, 0, TAU); c.fill(); }
  c.fillStyle = blue; c.fillRect(x - 19, y - 541, 38, 11);
  if (s.snow) { c.fillStyle = CAP; c.beginPath(); c.arc(x, y - 528, 60, Math.PI * 1.17, Math.PI * 1.83); c.arc(x, y - 528, 50, Math.PI * 1.83, Math.PI * 1.17, true); c.fill(); snowOn(c, x - 58, x + 58, y - 462, 8, 15); }
  c.fillStyle = white; c.beginPath(); c.roundRect(x - 58, y - 462, 116, 162, 8); c.fill();
  c.strokeStyle = blue; c.lineWidth = 4; c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = rgba('ink', 0.85);
  c.font = font(F.hand(500), 40); c.fillText('车站', x, y - 410);
  c.font = font(F.sans(500), 26); c.fillText('12路', x, y - 370);
  c.fillStyle = rgba('ink', 0.2); for (let i = 0; i < 3; i++) c.fillRect(x - 40, y - 350 + i * 15, 80 - 14 * i, 4);
}

export interface BusOpts {
  /** Where its rear is (x of the way), and its doors: 0 = shut .. 1 = open. */
  x: number; door: number;
  /** Paints who is seen through its windows and its door, in the bus's own px (he stands on y = -BUS.floor). */
  inside?: (c: Ctx) => void;
}
const CREAM = mix('paper', 'gold', 0.2), BLUE = mix('sky', 'navy', 0.14);
/** The bus's windows (from, to along it), the one he waves from among them. */
const BUS_WINS: V2[] = [[70, 250], [276, 456], [482, 662], BUS.win, [1091, 1281], [1310, 1500]];
/**
 * The bus on the road behind them: cream over blue, the evening in its windows, its door toward us. In winter its
 * lights are on, and snow lies along its roof.
 */
function bus(c: Ctx, o: BusOpts, s: Season) {
  const k = BUS.k, [d0, d1] = BUS.door, open = clamp(o.door), e = s.eve, frame = e(mix(BLUE, 'navy', 0.35));
  c.save(); c.translate(o.x, BUS.road); c.scale(k, k);
  c.fillStyle = rgba('ink', 0.16); c.beginPath(); c.ellipse(BUS.len / 2, 2, BUS.len * 0.5, 20, 0, 0, TAU); c.fill();
  const body = new Path2D();
  body.moveTo(0, -110); body.lineTo(0, -700); body.quadraticCurveTo(0, -760, 60, -760); body.lineTo(1460, -760); body.quadraticCurveTo(1524, -756, 1538, -690);
  body.lineTo(1560, -440); body.lineTo(1560, -110); body.quadraticCurveTo(1560, -70, 1520, -70); body.lineTo(40, -70); body.quadraticCurveTo(0, -70, 0, -110); body.closePath();
  c.fillStyle = e(mix('frost', 'paper', 0.4)); c.beginPath(); c.roundRect(520, -792, 430, 40, 12); c.fill();
  fillV(c, -760, -70, e(CREAM), e(mix(CREAM, 'peach', 0.2))); c.fill(body);
  c.save(); c.clip(body);
  fillV(c, -340, -70, e(BLUE), e(mix(BLUE, 'navy', 0.12))); c.fillRect(0, -340, 1560, 280);
  c.fillStyle = e(rgba('paper', 0.9)); c.fillRect(0, -356, 1560, 14);
  c.restore();
  if (s.snow) { snowOn(c, 526, 944, -792, 13, 61); snowOn(c, 46, 1486, -758, 14, 62); }
  // the inside, through the windows and the door: the light in the roof, the people on it, and him
  const wins = BUS_WINS, glass = new Path2D();
  for (const [a, z] of wins) glass.roundRect(a, -715, z - a, 215, 14);
  glass.rect(d0, -700, d1 - d0, 600);
  c.save(); c.clip(glass);
  if (s.snow) fillV(c, -715, -100, mix('paper', 'gold', 0.5), mix('gold', 'peach', 0.4)); else fillV(c, -715, -100, mix('gold', 'paper', 0.45), mix('peach', 'ink', 0.3));
  c.fillRect(0, -720, 1560, 640);
  c.fillStyle = mix('frost', 'navy', 0.3, 0.8);
  for (const [x, y] of [[150, -590], [372, -604], [578, -586], [1190, -598]] as V2[]) { c.beginPath(); c.arc(x, y, 36, 0, TAU); c.roundRect(x - 50, y + 30, 100, 140, 30); c.fill(); }
  o.inside?.(c);
  c.restore();
  // the glass over them, the frames; the two leaves of the door, which slide apart
  c.strokeStyle = frame; c.lineWidth = 6;
  for (const [a, z] of wins) { c.fillStyle = mix('sky', 'paper', 0.3, 0.2); c.beginPath(); c.roundRect(a, -715, z - a, 215, 14); c.fill(); c.stroke(); }
  for (const x of [d0 - 80 * open, (d0 + d1) / 2 + 80 * open]) {
    c.fillStyle = mix('sky', 'paper', 0.3, 0.3); c.fillRect(x, -700, 85, 600);
    c.fillStyle = e(mix(CREAM, 'peach', 0.1)); c.fillRect(x, -330, 85, 230);
    c.strokeRect(x, -700, 85, 600);
  }
  c.fillStyle = rgba('ink', 0.22); c.fillRect(d0, -104, d1 - d0, 8);
  // the wheels, the number of its line, its lamps
  for (const x of [310, 1250]) {
    c.fillStyle = e(mix('ink', 'navy', 0.3)); c.beginPath(); c.arc(x, -70, 88, Math.PI, TAU); c.fill();
    c.beginPath(); c.arc(x, -64, 64, 0, TAU); c.fill();
    c.fillStyle = e(mix('frost', 'paper', 0.3)); c.beginPath(); c.arc(x, -64, 30, 0, TAU); c.fill();
    c.strokeStyle = e(mix('frost', 'navy', 0.4)); c.lineWidth = 6; c.beginPath();
    for (let j = 0; j < 3; j++) { const a = o.x / (64 * k) + (j * TAU) / 3; c.moveTo(x, -64); c.lineTo(x + Math.cos(a) * 27, -64 + Math.sin(a) * 27); }
    c.stroke();
  }
  c.fillStyle = e(rgba('paper')); c.beginPath(); c.roundRect(1100, -474, 150, 72, 10); c.fill();
  c.fillStyle = rgba('ink', 0.8); c.font = font(F.sans(700), 44); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('12路', 1175, -422);
  c.fillStyle = mix('peach', 'rose', 0.4); c.fillRect(0, -330, 12, 70);
  c.fillStyle = rgba('gold'); c.beginPath(); c.roundRect(1542, -300, 18, 50, 8); c.fill();
  if (s.snow) {
    // (its lamps show it the road)
    const beam = c.createLinearGradient(1556, 0, 2300, 0);
    beam.addColorStop(0, rgba(LIT, 0.3)); beam.addColorStop(1, rgba(LIT, 0));
    c.fillStyle = beam; poly(c, [[1556, -294], [2300, -470], [2300, -90], [1556, -256]]); c.fill();
  }
  c.restore();
}
/**
 * What stands on the way and lets nothing through, as flat shapes: the terrace, the ground, the steps, the hedge and
 * the pillar of the gate, the sign of the bus stop, the bus. (In winter what glows behind these is taken off the
 * light layer with them: see way().)
 */
function solid(c: Ctx, [x0, x1]: V2, bus?: BusOpts) {
  const far = GROUND - 125, a = Math.max(x0, WAY.steps), y = GROUND - 6;
  c.beginPath();
  if (x0 < WAY.steps + 16) c.rect(x0, SILL - 8, WAY.steps + 16 - x0, 2400);
  if (x1 > a) c.rect(a, far, x1 - a, 2400);
  c.moveTo(WAY.steps, FLOOR - 146); c.lineTo(2026, GROUND - 180); c.lineTo(2026, GROUND + 1200); c.lineTo(WAY.steps, GROUND + 1200); c.closePath();
  c.roundRect(2090, far - 96, 470, 110, 30); c.rect(WAY.gate - 84, far - 528, 168, 540);
  c.rect(WAY.sign - 58, y - 462, 116, 162); c.moveTo(WAY.sign + 52, y - 528); c.arc(WAY.sign, y - 528, 52, 0, TAU);
  c.fill();
  if (!bus) return;
  c.save(); c.translate(bus.x, BUS.road); c.scale(BUS.k, BUS.k);
  c.beginPath(); c.roundRect(0, -760, 1560, 690, 50); c.roundRect(520, -792, 430, 40, 12); c.fill();
  c.restore();
}
/** What of the bus glows after dark, for the light layer: its windows (but the one somebody is seen at), its door while that is open, its lamps. */
function busGlow(g: Ctx, o: BusOpts) {
  const [d0, d1] = BUS.door;
  g.save(); g.translate(o.x, BUS.road); g.scale(BUS.k, BUS.k);
  g.fillStyle = rgba('gold', 0.08);
  for (const w of BUS_WINS) if (!(o.inside && w === BUS.win)) { g.beginPath(); g.roundRect(w[0], -715, w[1] - w[0], 215, 14); g.fill(); }
  if (!o.inside) { g.fillStyle = rgba('gold', 0.08 * clamp(o.door)); g.fillRect(d0, -700, d1 - d0, 600); }
  glow(g, 1552, -275, 170, { alpha: 0.7 });
  g.restore();
}

// ------------------------------------------------------------------ the way home in winter: lamps, prints, breath
/** A lamp of the way: where its post stands (x, y of the way). Its light is LAMP.h above that. */
export interface Lamp { x: number; y: number }
/**
 * The lamps: how high their light is over the ground, and that light as verse 2 hands it over (VERSE2_LAMPS): a soft
 * halo on the picture, a bright heart on the light layer.
 */
export const LAMP = { h: 1000, halo: VERSE2_LAMPS.halo, soft: VERSE2_LAMPS.soft, heart: VERSE2_LAMPS.heart } as const;
/** What a lamp throws down, in its own px (the lamp at the middle of the top): a cone of light, and the pool it makes on the snow, LAMP.h below. */
const CONE = { w: 680, h: LAMP.h + 100, res: 0.5 };
let cone: HTMLCanvasElement | null = null;
/** That light, painted once: soft all round, so it is painted small. */
function lampCone() {
  if (cone) return cone;
  const k = SCALE * CONE.res, cv = (cone = document.createElement('canvas')), m = CONE.w / 2;
  cv.width = Math.round(CONE.w * k); cv.height = Math.round(CONE.h * k);
  const c = scaleContext2D(cv.getContext('2d')!, k), fall = c.createLinearGradient(0, 0, 0, LAMP.h);
  fall.addColorStop(0, rgba(LIT, 0.24)); fall.addColorStop(0.45, rgba(LIT, 0.09)); fall.addColorStop(1, rgba(LIT, 0.07));
  c.fillStyle = fall; c.filter = 'blur(18px)';
  poly(c, [[m - 14, 24], [m + 14, 24], [m + 190, LAMP.h + 14], [m - 190, LAMP.h + 14]]); c.fill();
  c.filter = 'none';
  c.translate(m, LAMP.h + 30); c.scale(1, 0.2);
  const pool = c.createRadialGradient(0, 0, 0, 0, 0, 300);
  pool.addColorStop(0, rgba(LIT, 0.78)); pool.addColorStop(0.5, rgba(LIT, 0.4)); pool.addColorStop(1, rgba(LIT, 0));
  c.fillStyle = pool; c.fillRect(-300, -300, 600, 600);
  return cv;
}
/** A lamp of the way: its post, and at the top of it the lantern, alight, snow on its cap. (Its light: lampLight.) */
function lamp(c: Ctx, l: Lamp) {
  const top = l.y - LAMP.h;
  c.fillStyle = POST; c.fillRect(l.x - 5, top + 26, 10, LAMP.h - 26);
  c.beginPath(); c.roundRect(l.x - 12, l.y - 60, 24, 60, 6); c.roundRect(l.x - 9, top + 22, 18, 12, 4); c.fill();
  c.fillStyle = mix('paper', 'gold', 0.45); c.beginPath(); c.roundRect(l.x - 17, top - 22, 34, 46, [5, 5, 12, 12]); c.fill();
  c.fillStyle = POST; poly(c, [[l.x - 26, top - 20], [l.x + 26, top - 20], [l.x + 11, top - 36], [l.x - 11, top - 36]]); c.fill();
  c.fillRect(l.x - 2, top - 46, 4, 12); c.fillRect(l.x - 1.5, top - 22, 3, 46);
  c.fillStyle = CAP; c.beginPath(); c.ellipse(l.x, top - 36, 17, 7, 0, Math.PI, TAU); c.fill();
}
/** The lamps' light, on screen: the halo of each on the picture `c`, its heart on the light layer `g` (either may be left out). */
function lampLight(c: Ctx | null, g: Ctx | null, cam: Cam, lamps: Lamp[]) {
  const z = cam.zoom ?? 1;
  for (const l of lamps) {
    const [x, y] = seen(cam, [l.x, l.y - LAMP.h]);
    if (x < -LAMP.halo * z || x > W + LAMP.halo * z) continue;
    if (c) glow(c, x, y, LAMP.halo * z, { alpha: LAMP.soft });
    if (g) glow(g, x, y, LAMP.heart * z);
  }
}
/** The print a foot has left in the snow at (x, y), `age` s ago: pressed in, a little light on its near lip. */
function print(c: Ctx, x: number, y: number, age: number, run: boolean) {
  const a = clamp(age / 0.12);
  if (a <= 0) return;
  c.fillStyle = mix(SNOW_LOW, 'navy', 0.35, 0.62 * a); c.beginPath(); c.ellipse(x, y + 5, run ? 19 : 16, run ? 6.5 : 5.5, 0, 0, TAU); c.fill();
  c.fillStyle = rgba('paper', 0.5 * a); c.beginPath(); c.ellipse(x, y + 8, run ? 17 : 14, 2.4, 0, 0, Math.PI); c.fill();
}
const ROSE = rgba('rose'), ROSE_LOW = mix('rose', 'ink', 0.16);
/**
 * His scarf in her hands (chorus 2): it hangs from `at`, `len` long, and its foot swings `swing` px aside; `s` is her
 * figure's scale. Knitted, with a fringe, as the kit has it round his neck.
 */
export function drawScarfHeld(c: Ctx, at: V2, len: number, s: number, t: number, swing = 0) {
  if (len <= 1) return;
  const [x, y] = at, w = 11 * s, n = 7, mid = (u: number): V2 => [x + (swing + 3 * s * Math.sin(t * 2.3)) * u * u, y + len * u], pts: V2[] = [];
  for (let i = 0; i <= n; i++) { const [mx, my] = mid(i / n); pts.push([mx - w, my]); }
  for (let i = n; i >= 0; i--) { const [mx, my] = mid(i / n); pts.push([mx + w, my]); }
  c.save();
  fillV(c, y, y + len, ROSE, ROSE_LOW); poly(c, pts); c.fill();
  c.strokeStyle = rgba('paper', 0.3); c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
  for (let i = 1; i < n; i++) { const [mx, my] = mid(i / n); c.moveTo(mx - w * 0.6, my); c.lineTo(mx + w * 0.6, my); }
  const [ex, ey] = mid(1);
  for (let i = 0; i < 4; i++) { const fx = ex - w + (w * 2 * (i + 0.5)) / 4; c.moveTo(fx, ey); c.lineTo(fx, ey + 7 * s); }
  c.stroke();
  c.restore();
}
/** Breath in the cold, where it left a mouth (x, y) `age` s ago, going the way `dir` (1: to the right): three small clouds that go on a little, rise, thin and are gone. */
function breath(c: Ctx, x: number, y: number, age: number, dir: number) {
  const life = 1.25, u = age / life;
  if (age <= 0 || u >= 1) return;
  const out = 1 - Math.exp(-3.2 * age), fade = Math.min(1, age / 0.1) * (1 - u) ** 1.4;
  for (let j = 0; j < 3; j++) {
    const px = x + dir * (14 + 20 * j) * out, py = y - (4 + 9 * j) * out - 16 * age, r = (11 + 6 * j) * (0.6 + 1.2 * Math.sqrt(u));
    const g = c.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, rgba('paper', 0.5 * fade)); g.addColorStop(0.55, rgba('paper', 0.3 * fade)); g.addColorStop(1, rgba('paper', 0));
    c.fillStyle = g; c.fillRect(px - r, py - r, r * 2, r * 2);
  }
}

// ------------------------------------------------------------------ the way home: the picture
/** The dust (in winter the snow) a running foot raises where it comes down (x, y), `age` s ago: a few pale puffs that trail behind, lift a little, and are gone. */
function puff(c: Ctx, x: number, y: number, age: number, cols: [string, string]) {
  const life = 0.62, u = age / life, out = 1 - Math.exp(-4 * age), fade = (1 - u) ** 1.3, quick = 1 - age / 0.26;
  if (age <= 0 || u >= 1) return;
  // (and the air behind the heel: two short streaks, gone at once)
  if (quick > 0) {
    c.strokeStyle = rgba('ink', 0.24 * quick); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
    for (const [dy, len] of [[-12, 46], [-30, 30]] as V2[]) { c.moveTo(x - 30 - 90 * age, y + dy); c.lineTo(x - 30 - 90 * age - len, y + dy); }
    c.stroke();
  }
  // (each puff soft-edged, pale over a little of its own shade, so that it shows on a pale floor too)
  for (let j = 0; j < 3; j++) for (const [dx, col, a] of [[3, cols[0], 0.34], [0, cols[1], 0.95]] as [number, string, number][]) {
    const px = x - (10 + 24 * j) * out - 26 * age + dx, py = y - 10 - (5 + 11 * j) * out + dx * 1.4, r = (19 + 9 * j) * (0.55 + 1.15 * Math.sqrt(u));
    const g = c.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, rgba(col, a * fade)); g.addColorStop(0.5, rgba(col, a * 0.72 * fade)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(px - r, py - r, r * 2, r * 2);
  }
}

export interface WayOpts {
  t: number; cam: Cam; season: Season;
  /** 0 as they leave the classroom .. 1 at the bus stop: the afternoon going down to sunset (the evening, to night). */
  late: number;
  /** The dust their feet raise as they run: where each came down (x, y of the way), and how long ago (s). */
  dust: { x: number; y: number; age: number }[];
  /** The star marks her small steps leave on the pavement: where (x), and how long ago (s; not yet if negative). */
  stars: { x: number; age: number }[];
  bus?: BusOpts;
  /** Paints the two of them, on the way (under the camera). */
  two: (c: Ctx) => void;
  /** Winter: the lamps along the way. */
  lamps?: Lamp[];
  /** Winter: the prints their feet have left in the snow: where (x, y of the way), how long ago (s), and whether at a run. */
  prints?: { x: number; y: number; age: number; run: boolean }[];
  /** Winter: their breath: where it left a mouth (x, y of the way), how long ago (s), and which way (1: to the right). */
  breath?: { x: number; y: number; age: number; dir: number }[];
  /** 0..1: how much of the place is there yet. Chorus 2 starts on its sky and its first four lamps alone (VERSE2_LAMPS). */
  there?: number;
}
/**
 * The way home under a camera. `c`: the picture (the whole frame is painted); `g`: the light layer (the low sun,
 * the shafts through the corridor's windows and the dust in them, the glow of the star marks; in winter the lamps
 * and the lit windows).
 */
export function drawWay(c: Ctx, g: Ctx, o: WayOpts) {
  const there = o.there ?? 1;
  if (there >= 1) { way(c, g, o, 1); return; }
  // the place comes up under its lamps: the sky and their light are there from the first frame
  const s = scratch('way');
  way(s.c, g, o, there);
  sky(c, o.season, o.late); lampLight(c, null, o.cam, o.lamps ?? []);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = there; c.drawImage(s.cv, 0, 0, W, H); c.restore();
}
function way(c: Ctx, g: Ctx, o: WayOpts, there: number) {
  const { t, cam, season: s, late } = o, view = inView(cam), z = cam.zoom ?? 1, lamps = (o.lamps ?? []).filter((l) => l.x > view[0] - 420 && l.x < view[1] + 420);
  sky(c, s, late);
  // what is far: the town, the trees, the shops, each a layer painted once (see strip())
  const far = (x: Ctx, depth: number, paint: (v: V2) => void) => { x.save(); camera(x, cam, depth); paint(span(cam, depth)); x.restore(); };
  const town = [-260, 180, 2560, 1000], trees = [-620, s.snow ? 330 : 420, 4060, YARD + 10], row = [2560, s.snow ? 620 : 700, 5280, SHOPS + 60];
  far(c, 0.12, () => strip(c, `far/${s.name}`, town, 0.5, [s.haze, 0.12 + 1.3 * s.dim], (b) => distance(b, [-260, 2560]), s.snow ? (b) => townLit(b, [-260, 2560]) : undefined));
  far(c, 0.5, (v) => { c.fillStyle = s.snow ? SNOW_FAR : mix(mix('paper', 'peach', 0.34), s.haze, 0.1); c.fillRect(v[0], YARD - 4, v[1] - v[0], 700); strip(c, `yard/${s.name}`, trees, 0.6, [s.haze, 0.1 + s.dim], (b) => yard(b, [-620, 4060], s), s.snow ? (b) => yardLit(b) : undefined); });
  if (view[1] > WAY.gate) far(c, 0.8, (v) => { const a = Math.max(v[0], behind(WAY.gate, 0.8)); c.fillStyle = s.snow ? SNOW_FAR : mix(mix('paper', 'peach', 0.36), s.haze, 0.06); c.fillRect(a, SHOPS - 4, v[1] - a, 500); strip(c, `shops/${s.name}`, row, 1, [s.haze, 0.06 + s.dim], (b) => shops(b, 5280), s.snow ? (b) => shopsLit(b, 5280) : undefined); });
  c.save(); camera(c, cam, 1);
  ground(c, view, s);
  if (s.snow) { for (const l of lamps) if (l.x < WAY.steps) lamp(c, l); terrace(c, view, s, lamps); } else corridor(c, view);
  if (o.bus) bus(c, o.bus, s);
  // (the lamps out on the way stand before the bus; the one at the stop carries its sign)
  if (s.snow) for (const l of lamps) if (l.x >= WAY.steps) lamp(c, l);
  if (view[1] > WAY.sign - 100 && view[0] < WAY.sign + 100) busStop(c, s);
  if (s.snow) {
    // the prints in the snow; the lamps' light on all of it
    for (const p of o.prints ?? []) if (p.x > view[0] - 30 && p.x < view[1] + 30) print(c, p.x, p.y, p.age, p.run);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
    for (const l of lamps) c.drawImage(lampCone(), l.x - CONE.w / 2, l.y - LAMP.h, CONE.w, CONE.h);
    c.restore(); lampLight(c, null, cam, lamps); c.save(); camera(c, cam, 1);
  }
  for (const st of o.stars) if (st.age > 0) { c.save(); c.translate(st.x, GROUND + 30); c.scale(1, 0.55); drawStar(c, 0, 0, (s.snow ? 15 : 16) * (1 + 0.5 * Math.sin(Math.PI * clamp(st.age / 0.4))), 0.3 * Math.sin(st.x), { color: rgba('gold') }); c.restore(); }
  // (in the evening a little of its air is over the two of them: they are painted on a canvas of their own, which
  // then also serves to keep what glows behind them off them)
  let fig: ReturnType<typeof scratch> | null = null;
  if (s.dusk > 0) {
    const f = (fig = scratch('two')).c;
    f.save(); camera(f, cam, 1); o.two(f); f.restore();
    f.globalCompositeOperation = 'source-atop'; f.fillStyle = rgba(EVE, s.dusk); f.fillRect(0, 0, W, H);
    c.restore(); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(fig.cv, 0, 0, W, H); c.restore();
    c.save(); camera(c, cam, 1);
  } else o.two(c);
  for (const d of o.dust) puff(c, d.x, d.y, d.age, s.puff);
  for (const b of o.breath ?? []) breath(c, b.x, b.y, b.age, b.dir);
  s.air(c, t, { x: WAY.steps, y: GROUND - 1000, w: 4600, h: 1060 });
  c.restore();
  // (and a few flakes close to the lens, out of focus)
  if (s.snow) layer(c, { cam, depth: 1.5, blur: 5 }, (x) => { snow(x, t, { x: -2400, y: -900, w: 11000, h: 2700, count: 110, size: 2.3, alpha: 0.75, seed: 53 }); });
  // the light (all of it but the lamps' comes with the place)
  const shafts: Shaft[] = [];
  g.save(); g.globalAlpha *= there;
  if (s.sun) {
    // the sun low ahead of them; in the corridor its shafts through the windows and the dust in them
    const sun = sunAt(late);
    glow(g, sun[0], sun[1], 720, { color: s.sun, alpha: 0.5 });
    for (const a of openings(view)) {
      const [x, y] = seen(cam, [a + 190, HEAD + 60]), [gx, gy] = seen(cam, [a, HEAD]), shaft: Shaft = { x, y, angle: -0.56, length: 800 * z, width: 330 * z, spread: 1.15 };
      lightShaft(c, shaft, { color: s.sun, alpha: 0.2, t }); lightShaft(g, shaft, { color: s.sun, alpha: 0.028, t });
      g.fillStyle = mix('paper', s.sun, 0.3, 0.06); g.fillRect(gx, gy, 380 * z, (SILL - HEAD) * z);
      shafts.push(shaft);
    }
    dustMotes(g, t, shafts.length ? { shafts, count: 60, seed: 31 } : { count: 22, seed: 31, alpha: 0.5 });
  } else {
    // the windows of the school and of the shops, the lamps far off. (The light layer is added over the whole picture:
    // what glows is kept off it, or taken off it again, wherever something nearer stands before it: the yard's lights
    // where the row of shops starts, all of them behind what stands on the way, and everything behind the two.)
    const hide = (paint: () => void) => { g.save(); g.globalAlpha = 1; g.globalCompositeOperation = 'destination-out'; g.fillStyle = rgba('ink'); paint(); g.restore(); };
    g.save(); g.beginPath(); g.rect(0, 0, Math.max(0, seen(cam, [behind(WAY.gate + 260, 0.8), 0], 0.8)[0]), H); g.clip();
    far(g, 0.5, () => strip(g, `yard/${s.name}/lit`, trees, 0.3, [s.haze, 0], (b) => yardLit(b, true), undefined, 'low'));
    g.restore();
    if (view[1] > WAY.gate) far(g, 0.8, () => strip(g, `shops/${s.name}/lit`, row, 0.3, [s.haze, 0], (b) => shopsLit(b, 5280, true), undefined, 'low'));
    hide(() => { camera(g, cam, 1); solid(g, view, o.bus); });
    // the bus; and the lamps of the way, which stand before all of that
    if (o.bus) { g.save(); camera(g, cam, 1); busGlow(g, o.bus); g.restore(); }
    g.restore(); lampLight(null, g, cam, lamps);
    if (fig) { const cv = fig.cv; hide(() => { g.globalAlpha = there; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(cv, 0, 0, W, H); }); }
    g.save(); g.globalAlpha *= there;
  }
  for (const st of o.stars) if (st.age > 0) {
    const [x, y] = seen(cam, [st.x, GROUND + 30]), born = Math.sin(Math.PI * clamp(st.age / 0.6)) ** 0.8;
    glow(g, x, y, 46 * z * s.stars, { alpha: (0.3 + 0.1 * Math.sin(t * 3 + st.x)) * s.stars });
    sparkle(g, x, y - 18 * z, 36 * z, born, { rot: st.x });
    // (in winter they go on glinting, now one and now another)
    if (s.snow) sparkle(g, x, y - 12 * z, 22 * z, Math.max(0, Math.sin(t * 3.1 + st.x * 1.7)) ** 8, { rot: st.x + t });
  }
  g.restore();
}

// ------------------------------------------------------------------ her room
/** Her room (its own px): her window's glass, the top of the bed, the floor, where she lies. */
export const ROOM = { win: { x: 640, y: 150, w: 720, h: 405 }, bed: 830, floor: 960, her: 640 } as const;
const CAL = { x: 1400, y: 180, w: 184, h: 240 };
/** The tree outside her window, in the window's own px: its trunk, then its branches (each with its width from, to). */
const BRANCHES: { pts: V2[]; w: V2 }[] = [
  { pts: [[650, 430], [628, 300], [604, 190], [566, 90], [548, -10]], w: [28, 12] },
  { pts: [[620, 268], [524, 212], [412, 190], [300, 152], [206, 150]], w: [11, 3] },
  { pts: [[602, 186], [504, 122], [404, 72], [334, 22]], w: [10, 3] },
  { pts: [[632, 312], [698, 244], [736, 172]], w: [9, 3] },
  { pts: [[470, 200], [432, 266], [362, 300]], w: [6, 2.5] },
  { pts: [[412, 190], [350, 228], [272, 238]], w: [5, 2.5] },
  { pts: [[504, 122], [470, 60], [476, 10]], w: [5, 2.5] },
];
const along = (pts: V2[], u: number): V2 => { const f = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i; return [lerp(pts[i]![0], pts[i + 1]![0], k), lerp(pts[i]![1], pts[i + 1]![1], k)]; };

export interface RoomOpts {
  t: number; cam: Cam;
  /** 0 = night .. 1 = day: the light in the room. */
  day: number;
  /** The sky in her window: top, middle, bottom; its stars (0..1); the moon (in the window's own px) and how bright it is. */
  sky: string[]; stars: number; moon: V2; moonlight: number;
  /** The morning sun through the window (0..1). */
  sun: number;
  /** The tree outside: how far its leaves have turned (0..1), and when each lot of them lets go (s). */
  turned: number; falls: number[];
  /** How long ago the first snowflake came (s; not yet if negative), the snow after it (0..1), the frost on the glass (0..1). */
  first: number; snow: number; frost: number;
  /** The calendar: the month on top, and how far that page has turned over (0..1). */
  month: number; flip: number;
  /** Paints her on the bed (in the room's px). */
  her?: (c: Ctx) => void;
  /** Winter: snow lies on the roofs, on the tree and on the sill outside (0..1), and the frost has kept the edges of the glass. */
  lies?: number;
}
/** The frost that stays at the edges of her window in winter (the kit's frost: 1 = all over the glass), painted once: it is costly to paint afresh every frame. */
const RIME = 0.15;
function rime() {
  let cv = kept.get('rime');
  if (!cv) {
    kept.set('rime', (cv = document.createElement('canvas')));
    cv.width = ROOM.win.w * 2 * SCALE; cv.height = ROOM.win.h * 2 * SCALE;
    frost(scaleContext2D(cv.getContext('2d')!, 2 * SCALE), { x: 0, y: 0, w: ROOM.win.w, h: ROOM.win.h }, RIME, CHORUS1_FROST);
  }
  return cv;
}
/** Where the first snowflake is, `age` s after it came (the window's own px). */
const flakeAt = (age: number): V2 => [ROOM.win.w * 0.42 + 34 * Math.sin(age * 1.4), -12 + 84 * age];
/** What is outside her window, in the window's own px. */
function outside(c: Ctx, o: RoomOpts) {
  const { w, h } = ROOM.win, t = o.t, night = 1 - o.day, g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, o.sky[0]!); g.addColorStop(0.55, o.sky[1]!); g.addColorStop(1, o.sky[2]!);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  if (o.stars > 0.01) for (let i = 0; i < 26; i++) { c.fillStyle = rgba('paper', o.stars * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1 + 2 * hash(i, 3)) + i * 2.4)))); c.beginPath(); c.arc(w * hash(i, 1), h * 0.8 * hash(i, 2), 1.2 + 1.6 * hash(i, 4), 0, TAU); c.fill(); }
  if (o.moonlight > 0.01) {
    const [mx, my] = o.moon;
    c.fillStyle = mix('paper', 'gold', 0.25, o.moonlight); c.beginPath(); c.arc(mx, my, 30, 0, TAU); c.fill();
    c.fillStyle = mix('gold', 'ink', 0.2, 0.1 * o.moonlight);
    for (const [dx, dy, r] of [[-9, -6, 7], [10, 9, 5]] as V3[]) { c.beginPath(); c.arc(mx + dx, my + dy, r, 0, TAU); c.fill(); }
  }
  // the roofs across the way, a window lit in some of them at night
  c.fillStyle = mix(mix('navy', 'dusk', 0.25), mix(mix('dusk', 'peach', 0.5), 'paper', 0.35), o.day); c.fillRect(0, h - 62, w, 66);
  for (let i = 0; i < 7; i++) {
    const rx = -30 + i * 118 + 30 * hash(i, 5), rw = 96 + 40 * hash(i, 6), rh = 44 + 50 * hash(i, 7);
    c.fillStyle = mix(mix('navy', 'dusk', 0.25), mix(mix('dusk', 'peach', 0.5), 'paper', 0.35), o.day); c.fillRect(rx, h - rh, rw, rh + 4);
    poly(c, [[rx - 10, h - rh], [rx + rw / 2, h - rh - 34], [rx + rw + 10, h - rh]]); c.fill();
    if (o.lies) { c.strokeStyle = mix(CAP, NIGHT, 0.3, o.lies); c.lineWidth = 8; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(rx - 9, h - rh - 2); c.lineTo(rx + rw / 2, h - rh - 36); c.lineTo(rx + rw + 9, h - rh - 2); c.stroke(); }
    if (night > 0.05 && hash(i, 8) < 0.6) { c.fillStyle = rgba('gold', 0.85 * night); c.fillRect(rx + 16 + 30 * hash(i, 9), h - rh + 14, 14, 16); }
  }
  // the tree: its branches, and the leaves on them, which turn, let go on the beat and come down
  const dim = (col: string) => mix(col, NIGHT, 0.55 * night);
  c.strokeStyle = dim(mix('ink', 'peach', 0.25)); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const b of BRANCHES) for (let i = 0; i < b.pts.length - 1; i++) { c.lineWidth = lerp(b.w[0], b.w[1], (i + 0.5) / (b.pts.length - 1)); c.beginPath(); c.moveTo(b.pts[i]![0], b.pts[i]![1]); c.lineTo(b.pts[i + 1]![0], b.pts[i + 1]![1]); c.stroke(); }
  if (o.lies) {
    // (in winter: snow along the top of each branch, and heaped on the sill)
    c.strokeStyle = mix(CAP, NIGHT, 0.3, o.lies);
    for (const b of BRANCHES.slice(1)) for (let i = 0; i < b.pts.length - 1; i++) { const bw = lerp(b.w[0], b.w[1], (i + 0.5) / (b.pts.length - 1)); c.lineWidth = Math.max(2.5, bw * 0.5); c.beginPath(); c.moveTo(b.pts[i]![0], b.pts[i]![1] - bw * 0.42); c.lineTo(b.pts[i + 1]![0], b.pts[i + 1]![1] - bw * 0.42); c.stroke(); }
    c.save(); c.globalAlpha *= o.lies; snowOn(c, 0, w, h + 3, 20, 77, mix(CAP, NIGHT, 0.3)); c.restore();
  }
  for (let i = 0; i < 60; i++) {
    const r = (k: number) => hash(i, 17, k), at = along(BRANCHES[1 + Math.floor(r(1) * 6)]!.pts, 0.15 + 0.85 * r(2));
    const age = o.falls.length ? t - o.falls[i % o.falls.length]! - 0.3 * r(9) : -1, fall = Math.max(0, age), size = 13 + 8 * r(5);
    if (fall > 2.2) continue;
    c.save(); c.translate(at[0] + (r(3) - 0.5) * 46 + (30 * Math.sin(fall * 3 + i) - 26 * fall) * Math.min(1, fall * 2), at[1] + (r(4) - 0.5) * 40 + 60 * fall + 170 * fall * fall);
    c.rotate(r(6) * TAU + 0.15 * Math.sin(t * 1.3 + i) + fall * (2 + 3 * r(7)));
    c.fillStyle = dim(mix(mix('gold', 'peach', 0.15 + 0.4 * r(8)), mix(mix('peach', 'rose', 0.2 + 0.25 * r(8)), 'ink', 0.15), o.turned));
    c.beginPath(); c.moveTo(0, -size); c.quadraticCurveTo(size * 0.72, 0, 0, size); c.quadraticCurveTo(-size * 0.72, 0, 0, -size); c.fill();
    c.restore();
  }
  // the first flake, by itself; then the snow
  if (o.first > 0) { const [fx, fy] = flakeAt(o.first); c.fillStyle = rgba('paper', 0.35); c.beginPath(); c.arc(fx, fy, 16, 0, TAU); c.fill(); c.fillStyle = rgba('paper'); c.beginPath(); c.arc(fx, fy, 7, 0, TAU); c.fill(); }
  if (o.snow > 0.01) snow(c, t, { x: -20, y: -20, w: w + 40, h: h + 40, count: 44, alpha: o.snow, size: 0.85, seed: 17 });
}
/** A page of her calendar, in its own px ((0, 0) = the middle of its top edge): the month, and its weeks as a dot a day. */
function page(c: Ctx, month: number) {
  const { w, h } = CAL;
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(-w / 2, 0, w, h, [0, 0, 6, 6]); c.fill();
  c.fillStyle = mix('peach', 'blush', 0.4); c.fillRect(-w / 2, 0, w, 30);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = rgba('ink', 0.85);
  c.font = font(F.hand(500), 80); c.fillText(String(month), -20, 112);
  c.font = font(F.hand(500), 34); c.fillText('月', 50, 108);
  // (in October the ninth has a ring round it: the day of this walk)
  for (let d = 0; d < (month === 11 ? 30 : 31); d++) {
    const cell = d + [4, 0, 2][month - 10]!, px = -66 + (cell % 7) * 22, py = 140 + Math.floor(cell / 7) * 19;
    c.fillStyle = rgba('ink', 0.24); c.beginPath(); c.arc(px, py, 2.8, 0, TAU); c.fill();
    if (month === 10 && d === 8) { c.strokeStyle = rgba('rose', 0.9); c.lineWidth = 2.2; c.beginPath(); c.arc(px, py, 8, 0, TAU); c.stroke(); }
  }
}
/** The calendar on the wall: a page lifts from its foot and goes over the top. */
function calendar(c: Ctx, month: number, flip: number) {
  const { x, y, w, h } = CAL, turning = flip > 0 && flip < 1 && month < 12, a = Math.PI * flip, k = Math.cos(a);
  c.save(); c.translate(x + w / 2, y);
  c.fillStyle = rgba('ink', 0.12); c.fillRect(-w / 2 + 5, 7, w, h);
  page(c, turning ? month + 1 : month);
  if (turning) {
    c.fillStyle = rgba('ink', 0.14 * Math.sin(a)); c.fillRect(-w / 2, 0, w, h * Math.max(0, k) + 14);
    c.save(); c.scale(1, k);
    if (k > 0) page(c, month); else { c.globalAlpha *= 1 - smoothstep(0.8, 1, flip); c.fillStyle = mix('paper', 'ink', 0.07); c.fillRect(-w / 2, 0, w, h); }
    c.restore();
  }
  c.fillStyle = mix('peach', 'ink', 0.4); c.fillRect(-w / 2 - 4, -8, w + 8, 14);
  c.fillStyle = METAL; c.beginPath(); c.arc(0, -16, 5, 0, TAU); c.fill();
  c.restore();
}
/** Her bed along the wall: the headboard on the left, the sheet, the cover, her pillow. */
function bed(c: Ctx) {
  const top = ROOM.bed, fl = ROOM.floor;
  c.fillStyle = WOOD_LOW; c.beginPath(); c.roundRect(96, top - 150, 46, fl - top + 150, 12); c.fill();
  c.fillStyle = rgba('ink', 0.14); c.fillRect(140, fl - 8, 1160, 14);
  fillV(c, top + 60, fl, mix(WOOD, 'paper', 0.1), WOOD_LOW); c.fillRect(140, top + 70, 1150, fl - top - 84);
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(140, top, 1160, 86, [22, 22, 8, 8]); c.fill();
  fillV(c, top, top + 116, mix('blush', 'paper', 0.35), mix('blush', 'peach', 0.45)); c.beginPath(); c.roundRect(430, top - 6, 880, 124, [26, 22, 14, 14]); c.fill();
  c.strokeStyle = rgba('paper', 0.5); c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(452, top + 26); c.quadraticCurveTo(470, top + 70, 456, top + 108); c.moveTo(1000, top + 12); c.quadraticCurveTo(1060, top + 50, 1040, top + 112); c.stroke();
  c.fillStyle = mix('paper', 'sky', 0.2); c.beginPath(); c.roundRect(168, top - 46, 232, 64, 26); c.fill();
}
/** The curtain, drawn aside. */
function curtain(c: Ctx, x: number, y: number, w: number, h: number, t: number) {
  const n = 4, folds = Array.from({ length: n + 1 }, (_, i): V2[] => { const fx = x + (w * i) / n, air = 5 * Math.sin(t * 0.7 + i * 1.3); return [[fx, y], [fx + air * 0.4, y + h * 0.55], [fx + air + (i - n / 2) * 6, y + h + 8 * Math.sin(i * 1.9)]]; });
  const cloth = new Path2D();
  folds.forEach(([a], i) => (i ? cloth.lineTo(a![0], a![1]) : cloth.moveTo(a![0], a![1])));
  for (let i = n; i >= 0; i--) { const [, m, b] = folds[i]!; if (i === n) cloth.lineTo(m![0], m![1]); cloth.lineTo(b![0], b![1]); }
  cloth.closePath();
  fillV(c, y, y + h, mix('blush', 'paper', 0.4), mix('blush', 'peach', 0.5)); c.fill(cloth);
  c.lineCap = 'round'; c.lineWidth = 5;
  folds.forEach(([a, m, b], i) => { c.strokeStyle = i % 2 ? mix('blush', 'ink', 0.2, 0.35) : rgba('paper', 0.45); c.beginPath(); c.moveTo(a![0], a![1]); c.quadraticCurveTo(m![0], m![1], b![0], b![1]); c.stroke(); });
}
/**
 * Her room under a camera. `c`: the picture (the whole frame is painted); `g`: the light layer (the moon and its
 * light, or the morning's). At the end of chorus 1 the camera is on the glass alone: CHORUS1_FROST.
 */
export function drawRoom(c: Ctx, g: Ctx, o: RoomOpts) {
  const { t, cam } = o, night = 1 - o.day, { x, y, w, h } = ROOM.win, z = cam.zoom ?? 1, bar = (CHORUS1_FROST.bar * w) / CHORUS1_FROST.w;
  c.save(); camera(c, cam, 1);
  fillV(c, -300, ROOM.floor, mix('paper', 'blush', 0.28), mix('paper', 'peach', 0.3)); c.fillRect(-1200, -1200, 4400, 1200 + ROOM.floor);
  fillV(c, ROOM.floor, ROOM.floor + 200, WOOD, WOOD_LOW); c.fillRect(-1200, ROOM.floor, 4400, 800);
  c.fillStyle = rgba('paper', 0.6); c.fillRect(-1200, ROOM.floor - 14, 4400, 14);
  curtain(c, x - 168, y - 70, 136, h + 170, t);
  c.fillStyle = TRIM; c.fillRect(x - 24, y - 24, w + 48, h + 48); c.fillRect(x - 46, y + h + 20, w + 92, 22);
  c.fillStyle = rgba('ink', 0.1); c.fillRect(x - 46, y + h + 42, w + 92, 7);
  calendar(c, o.month, o.flip);
  bed(c);
  c.restore();
  // the night lies over all of it (less of it over her: her phone lights her); the window is brighter than the room
  if (night > 0.003) { c.fillStyle = rgba(NIGHT, 0.64 * night); c.fillRect(0, 0, W, H); }
  if (o.her) layer(c, { cam, depth: 1, haze: 0.3 * night, hazeColor: NIGHT }, o.her);
  c.save(); camera(c, cam, 1);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); outside(c, o); c.restore();
  if (o.lies) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(rime(), x, y, w, h); }
  frost(c, ROOM.win, o.frost, CHORUS1_FROST);
  c.fillStyle = mix(TRIM, NIGHT, 0.64 * night); c.fillRect(x + (w - bar) / 2, y, bar, h); c.fillRect(x, y + (h - bar) / 2, w, bar);
  c.restore();
  // the light through the window: the moon's, then the morning's
  const [sx, sy] = seen(cam, [x + w * 0.4, y + h * 0.5]), shaft: Shaft = { x: sx, y: sy, angle: 0.45, length: 700 * z, width: 430 * z, spread: 1.25 }, pale = mix('sky', 'paper', 0.5);
  if (o.moonlight * night > 0.01) {
    const [mx, my] = seen(cam, [x + o.moon[0], y + o.moon[1]]);
    // (at night the soft light goes on the picture: on the light layer its faint edges would show as bands in the dark)
    lightShaft(c, shaft, { color: pale, alpha: 0.13 * o.moonlight * night, t });
    glow(g, mx, my, 100 * z, { color: mix('paper', 'gold', 0.3), alpha: 0.5 * o.moonlight });
  }
  if (o.first > 0 && flakeAt(o.first)[1] < h) {
    // (the first flake catches the light, until the frost is over it)
    const [fx, fy] = flakeAt(o.first), [px, py] = seen(cam, [x + fx, y + fy]);
    glow(g, px, py, 34 * z, { color: 'paper', alpha: 0.6 * (1 - o.frost) });
  }
  if (o.sun > 0.01) {
    const [ax, ay] = seen(cam, [x, y]);
    lightShaft(c, shaft, { alpha: 0.16 * o.sun, t }); lightShaft(g, shaft, { alpha: 0.03 * o.sun, t });
    g.fillStyle = mix('paper', 'gold', 0.3, 0.07 * o.sun); g.fillRect(ax, ay, w * z, h * z);
  }
}

// ------------------------------------------------------------------ her phone, the photographs
/** The chat on her phone (our own plain design), in its own px: its size, and where what she types goes: the first character's middle, the step between characters, the distance between rows. */
export const CHAT = { w: 600, h: 820, field: { x: 84, y: 620, step: 66, lead: 92 } } as const;
export interface ChatOpts {
  /** Its middle on screen, its scale and its lean (rad). */
  x: number; y: number; scale: number; tilt?: number;
  /** 0..1: her 晚安 has been sent. */
  sent: number;
  /** Chorus 2: 0..1, his 晚安 has come, before hers (which is then her answer to it, under it). */
  his?: number;
  /** Paints what she has typed into the field, in the chat's own px. */
  typed: (c: Ctx) => void;
  /** Where the caret stands (the chat's px), and how much of it shows (it blinks). */
  caret: V2; blink: number;
}
/** Her phone's screen, large beside her: his last message, her 晚安, and the field she types in. */
export function drawChat(c: Ctx, g: Ctx, o: ChatOpts) {
  const { w, h } = CHAT, pop = Math.max(0, o.sent), words = (text: string, x: number, y: number, size: number, alpha: number, weight = 400) => { c.font = font(F.sans(weight), size); c.fillStyle = rgba('ink', alpha); c.fillText(text, x, y); };
  glow(c, o.x, o.y, 640 * o.scale, { color: mix('paper', 'sky', 0.4), alpha: 0.2 });
  for (const x of [c, g]) { x.save(); x.translate(o.x, o.y); x.rotate(o.tilt ?? 0); x.scale(o.scale, o.scale); x.translate(-w / 2, -h / 2); }
  for (const d of [30, 20, 10]) { c.fillStyle = rgba('ink', 0.07); c.beginPath(); c.roundRect(-d, 14 - d * 0.6, w + 2 * d, h + 1.4 * d, 44 + d); c.fill(); }
  c.fillStyle = mix('paper', 'sky', 0.1); c.beginPath(); c.roundRect(0, 0, w, h, 44); c.fill();
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  // who she is writing to: 你
  c.fillStyle = mix('sky', 'paper', 0.35); c.beginPath(); c.arc(64, 50, 27, 0, TAU); c.fill();
  c.fillStyle = SKIN; c.beginPath(); c.arc(64, 55, 14, 0, TAU); c.fill();
  c.fillStyle = mix('ink', 'navy', 0.38); c.beginPath(); c.arc(64, 49, 15, Math.PI * 0.95, Math.PI * 2.05); c.fill();
  words('你', 106, 63, 34, 0.85, 500);
  c.fillStyle = rgba('ink', 0.08); c.fillRect(0, 94, w, 2);
  c.textAlign = 'center'; words('21:30', w / 2, 136, 20, 0.4); c.textAlign = 'left';
  // his message, and hers
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(34, 158, 164, 74, 28); c.fill();
  c.strokeStyle = rgba('ink', 0.1); c.lineWidth = 1.5; c.stroke();
  words('到家了', 56, 207, 34, 0.85);
  const first = Math.max(0, o.his ?? 0);
  if (first > 0.01) {
    c.save(); c.translate(34, 332); c.scale(first, first); c.globalAlpha *= clamp(first * 2);
    c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(0, -74, 130, 74, 28); c.fill();
    c.strokeStyle = rgba('ink', 0.1); c.lineWidth = 1.5; c.stroke();
    words('晚安', 22, -25, 34, 0.85);
    c.restore();
  }
  if (pop > 0.01) {
    c.save(); c.translate(w - 34, o.his === undefined ? 332 : 432); c.scale(pop, pop); c.globalAlpha *= clamp(pop * 2);
    c.fillStyle = mix('blush', 'peach', 0.35); c.beginPath(); c.roundRect(-130, -74, 130, 74, 28); c.fill();
    words('晚安', -108, -25, 34, 0.85);
    c.restore();
  }
  // the field, what is typed in it, the caret, the button that sends
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(28, 548, w - 56, 244, 34); c.fill();
  c.strokeStyle = mix('peach', 'ink', 0.2, 0.4); c.lineWidth = 2; c.stroke();
  o.typed(c);
  c.fillStyle = rgba('ink', 0.7 * o.blink); c.fillRect(o.caret[0] - 2, o.caret[1] - 30, 4, 60);
  c.fillStyle = mix('peach', 'gold', 0.4); c.beginPath(); c.arc(w - 72, 742, 28, 0, TAU); c.fill();
  c.strokeStyle = rgba('paper'); c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(w - 72, 756); c.lineTo(w - 72, 729); c.moveTo(w - 84, 741); c.lineTo(w - 72, 729); c.lineTo(w - 60, 741); c.stroke();
  // it is a light in the dark room
  g.fillStyle = mix('paper', 'sky', 0.3, 0.05); g.beginPath(); g.roundRect(0, 0, w, h, 44); g.fill();
  c.restore(); g.restore();
}

export interface PhotoOpts {
  /** Its middle on screen, its width, its lean (rad), its scale (it pops in) and its opacity. */
  x: number; y: number; w: number; rot: number; scale: number; alpha: number;
  /** The frame it is a print of (a small copy of a whole frame), and the part of that frame in it: the middle (x, y) and the width, in the frame's px. */
  img: HTMLCanvasElement; crop: V3;
}
/** A photograph with a white border, wider at its foot (where a caption goes: its middle is 0.38 of the width under the photo's middle). */
export function drawPhoto(c: Ctx, o: PhotoOpts) {
  const { w } = o, h = w * 1.2, m = w * 0.065, pw = w - 2 * m, ph = pw * 0.8, k = o.img.width / W, [cx, cy, cw] = o.crop;
  c.save(); c.translate(o.x, o.y); c.rotate(o.rot); c.scale(o.scale, o.scale); c.globalAlpha *= o.alpha;
  for (const d of [18, 12, 6]) { c.fillStyle = rgba('ink', 0.08); c.beginPath(); c.roundRect(-w / 2 - d, -h / 2 + 10 - d * 0.6, w + 2 * d, h + 1.4 * d, 6 + d); c.fill(); }
  c.fillStyle = mix('paper', 'dusk', 0.1); c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 6); c.fill();
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(o.img, (cx - cw / 2) * k, (cy - cw * 0.4) * k, cw * k, cw * 0.8 * k, -pw / 2, -h / 2 + m, pw, ph);
  c.fillStyle = mix('paper', 'gold', 0.4, 0.12); c.fillRect(-pw / 2, -h / 2 + m, pw, ph);
  c.restore();
}

// ------------------------------------------------------------------ her bag, close up; and her desk
/** Her bag as it stands on her desk chair (the middle of its base), and how large the kit's bag is drawn. */
export const BAG = { x: 1190, y: 1010, scale: 5.2 } as const;
export interface BagOpts {
  t: number; cam: Cam;
  /** The pocket's zip: 1 = open .. 0 = shut. */
  zip: number;
  /** Paints what goes into the pocket (the star, the line): it is cut off at the pocket's lip. */
  into?: (c: Ctx) => void;
  /** Her hand: where its finger and thumb meet, and its turn (rad). */
  hand?: { x: number; y: number; rot: number } | null;
  /** Chorus 2: her other hand, come up from the lower left (it is the one at the zip). */
  other?: { x: number; y: number; rot: number } | null;
  /** Chorus 2: the pocket is full of paper stars already (they show where the zip is open): how far they are pressed down, 0..1. */
  pile?: number;
  /**
   * Chorus 2: the corner of her room is there behind her chair, to be pulled back to: `sharp` 0 = out of focus, as
   * from close by .. 1 = in focus; `warm`, her lamp's light, 1 = as it is that evening (the bridge cools it).
   */
  room?: { sharp: number; warm?: number };
}
/**
 * The handoff from chorus 2 to the bridge: her desk under its lamp, her bag on her chair before it, the snow in her
 * window. Chorus 2's last frame is `drawBagShot(c, g, { t, ...CHORUS2_DESK })`; the bridge starts on it (it cools the
 * lamp with `room.warm` and goes on back and up with `cam`).
 */
export const CHORUS2_DESK = { cam: { zoom: 0.34, x: 1955 - W / 2, y: 535 - H / 2 }, zip: 0, room: { sharp: 1, warm: 1 } } as const;
/** How far it is from the seat of her chair down to the floor (the bag shot's own px). */
const SEAT = 760;
/** Her hand, come down from the upper right, the sleeve of her cardigan behind it: (x, y) is where finger and thumb meet. (`flip`: her other hand.) */
function hand(c: Ctx, x: number, y: number, rot: number, s: number, flip = false) {
  const part = (ax: number, ay: number, bx: number, by: number, w: number, col: string) => {
    c.lineWidth = w + 3; c.strokeStyle = mix(col, 'ink', 0.3); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.lineWidth = w; c.strokeStyle = col; c.stroke();
  };
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(flip ? -s : s, s); c.lineCap = 'round';
  part(196, -430, 92, -140, 84, BEIGE); part(98, -156, 88, -128, 92, BEIGE_LOW);
  for (const [ax, ay, bx, by, w] of [[92, -58, 86, -22, 19], [78, -52, 66, -12, 21], [62, -54, 44, -14, 22]]) part(ax!, ay!, bx!, by!, w!, SKIN);
  part(80, -116, 54, -62, 72, SKIN);
  part(48, -60, 9, -5, 22, SKIN); part(22, -86, -3, -12, 22, SKIN);
  c.restore();
}
/**
 * The corner of her room where her desk stands, at night: what is behind her chair, a layer 0.7 away, in its own px
 * (close by, its lamp is at the upper right, as in chorus 1). The wall and the floor; the window over her chair, the
 * snow outside it; the foot of her bed; her desk, the lamp on it and what lies in its light; the calendar, in December.
 */
function study(b: Ctx, t: number, warm: number) {
  const dark = (col: string, k: number) => mix(col, NIGHT, k), wall = dark(mix('paper', 'blush', 0.28), 0.6), light = mix('frost', LIT, warm);
  b.fillStyle = wall; b.fillRect(-1700, -1500, 6600, 2740);
  fillV(b, 1215, 1800, dark(WOOD, 0.45), dark(WOOD_LOW, 0.6)); b.fillRect(-1700, 1215, 6600, 900);
  b.fillStyle = dark(rgba('paper'), 0.55); b.fillRect(-1700, 1193, 6600, 22);
  // her window, the night and the snow in it; its curtains
  const wx = 900, wy = -300, ww = 540, wh = 630, sky = b.createLinearGradient(0, wy, 0, wy + wh);
  sky.addColorStop(0, mix('navy', 'dusk', 0.22)); sky.addColorStop(1, mix('dusk', 'navy', 0.3));
  b.fillStyle = dark(TRIM, 0.5); b.fillRect(wx - 26, wy - 26, ww + 52, wh + 52); b.fillRect(wx - 50, wy + wh + 22, ww + 100, 24);
  b.save(); b.beginPath(); b.rect(wx, wy, ww, wh); b.clip();
  b.fillStyle = sky; b.fillRect(wx, wy, ww, wh);
  b.fillStyle = mix('navy', 'dusk', 0.3);
  for (let i = 0; i < 4; i++) { const rx = wx - 30 + i * 150 + 30 * hash(i, 5), rw = 110 + 50 * hash(i, 6), top = wy + wh - 70 - 80 * hash(i, 7); b.fillRect(rx, top, rw, 200); poly(b, [[rx - 12, top], [rx + rw / 2, top - 40], [rx + rw + 12, top]]); b.fill(); }
  for (let i = 0; i < 4; i++) if (hash(i, 8) < 0.6) { b.fillStyle = rgba('gold', 0.85); b.fillRect(wx + 10 + i * 150 + 40 * hash(i, 9), wy + wh - 52 - 60 * hash(i, 7), 16, 18); }
  snow(b, t, { x: wx - 20, y: wy - 20, w: ww + 40, h: wh + 40, count: 40, size: 1.1, seed: 19 });
  snowOn(b, wx, wx + ww, wy + wh + 3, 22, 78, mix(CAP, NIGHT, 0.3));
  b.restore();
  b.fillStyle = dark(TRIM, 0.5); b.fillRect(wx + ww / 2 - 13, wy, 26, wh); b.fillRect(wx, wy + wh / 2 - 13, ww, 26);
  for (const sg of [-1, 1]) {
    const cx = wx + ww / 2 + sg * (ww / 2 + 72);
    fillV(b, wy - 60, wy + wh + 150, dark(mix('blush', 'paper', 0.4), 0.5), dark(mix('blush', 'peach', 0.5), 0.56)); b.beginPath(); b.roundRect(cx - 56, wy - 66, 112, wh + 230, [8, 8, 30, 30]); b.fill();
    b.strokeStyle = rgba('ink', 0.1); b.lineWidth = 5; b.beginPath(); for (const dx of [-24, 6, 34]) { b.moveTo(cx + dx, wy - 50); b.lineTo(cx + dx + 5 * Math.sin(t * 0.7 + dx), wy + wh + 150); } b.stroke();
  }
  // the foot of her bed, at the left
  b.fillStyle = dark(WOOD_LOW, 0.5); b.beginPath(); b.roundRect(330, 800, 50, 420, 14); b.fill(); b.fillRect(-1700, 1040, 2040, 175);
  fillV(b, 900, 1060, dark(mix('blush', 'paper', 0.35), 0.5), dark(mix('blush', 'peach', 0.45), 0.56)); b.beginPath(); b.roundRect(-1700, 905, 2050, 150, [0, 30, 20, 0]); b.fill();
  // her calendar, over the desk
  b.save(); b.translate(2240, -150); b.scale(1.15, 1.15);
  b.fillStyle = rgba('ink', 0.14); b.fillRect(-CAL.w / 2 + 6, 8, CAL.w, CAL.h); page(b, 12);
  b.fillStyle = rgba(NIGHT, 0.42); b.fillRect(-CAL.w / 2, 0, CAL.w, CAL.h);
  b.fillStyle = dark(mix('peach', 'ink', 0.4), 0.4); b.fillRect(-CAL.w / 2 - 4, -8, CAL.w + 8, 14);
  b.restore();
  // the night in the room, away from the lamp; and the lamp's light on the wall behind the desk
  const night = b.createRadialGradient(1700, 240, 500, 1700, 240, 2300), on = b.createRadialGradient(1700, 150, 0, 1700, 150, 1100);
  night.addColorStop(0, rgba(NIGHT, 0)); night.addColorStop(1, rgba(NIGHT, 0.5));
  b.fillStyle = night; b.fillRect(-1700, -1500, 6600, 3640);
  on.addColorStop(0, rgba(light, 0.55)); on.addColorStop(0.4, rgba(light, 0.15)); on.addColorStop(1, rgba(light, 0));
  b.fillStyle = on; b.fillRect(-1700, -1500, 6600, 2740);
  // her desk: its top, the drawers at its right end, its leg at the left; the dark under it
  const top = 546, left = 1560, right = 2720;
  b.fillStyle = dark(WOOD_LOW, 0.62); b.fillRect(left + 30, top + 40, right - left - 60, 1215 - top - 40);
  fillV(b, top + 40, 1215, dark(WOOD, 0.36), dark(WOOD_LOW, 0.46));
  b.fillRect(left + 24, top + 40, 64, 1215 - top - 40); b.fillRect(right - 420, top + 40, 396, 1215 - top - 40);
  b.strokeStyle = rgba('ink', 0.16); b.lineWidth = 5; b.beginPath(); for (const y of [760, 980]) { b.moveTo(right - 420, y); b.lineTo(right - 24, y); } b.stroke();
  b.fillStyle = dark(METAL, 0.3); for (const y of [672, 868, 1094]) { b.beginPath(); b.roundRect(right - 262, y, 80, 14, 7); b.fill(); }
  fillV(b, top, top + 44, mix(dark(WOOD, 0.22), light, 0.3 * warm), dark(WOOD, 0.34)); b.beginPath(); b.roundRect(left, top, right - left, 44, 8); b.fill();
  // what is on it: her books, her pencils in their pot, a notebook left open
  const books: [number, number, string][] = [[2330, 250, mix('dusk', 'navy', 0.2)], [2350, 224, mix('sky', 'paper', 0.2)], [2338, 200, mix('blush', 'peach', 0.4)]];
  books.forEach(([x, w, col], i) => { b.fillStyle = dark(col, 0.32); b.beginPath(); b.roundRect(x, top - 34 * (i + 1), w, 34, 5); b.fill(); b.fillStyle = rgba('paper', 0.3); b.fillRect(x + 8, top - 34 * (i + 1) + 13, w - 16, 5); });
  b.strokeStyle = dark(mix('gold', 'peach', 0.4), 0.2); b.lineWidth = 9; b.lineCap = 'round'; b.beginPath(); b.moveTo(2204, top - 80); b.lineTo(2186, top - 166); b.stroke();
  b.strokeStyle = dark(mix('sky', 'navy', 0.3), 0.2); b.beginPath(); b.moveTo(2226, top - 80); b.lineTo(2244, top - 152); b.stroke();
  b.fillStyle = dark(mix('sky', 'paper', 0.4), 0.25); b.beginPath(); b.roundRect(2176, top - 96, 78, 96, [4, 4, 12, 12]); b.fill();
  b.fillStyle = mix(rgba('paper'), light, 0.25 * warm); poly(b, [[1930, top - 4], [2040, top - 16], [2046, top], [1930, top]]); b.fill(); poly(b, [[1930, top - 4], [1820, top - 16], [1814, top], [1930, top]]); b.fill();
  // the lamp: its foot, its arm, its shade; its light in the air and on the desk
  b.strokeStyle = dark(METAL, 0.3); b.lineWidth = 16; b.lineJoin = 'round'; b.beginPath(); b.moveTo(1640, top - 10); b.lineTo(1680, 380); b.lineTo(1744, 200); b.stroke();
  b.fillStyle = dark(METAL, 0.3); b.beginPath(); b.roundRect(1590, top - 20, 104, 20, 8); b.fill();
  const cone = b.createLinearGradient(0, 240, 0, top);
  cone.addColorStop(0, rgba(light, 0.4)); cone.addColorStop(1, rgba(light, 0.12));
  b.fillStyle = cone; poly(b, [[1650, 262], [1812, 250], [2230, top], [1590, top]]); b.fill();
  const pool = b.createLinearGradient(1600, 0, 2260, 0);
  pool.addColorStop(0, rgba(light, 0.5)); pool.addColorStop(0.45, rgba(light, 0.62)); pool.addColorStop(1, rgba(light, 0));
  b.fillStyle = pool; b.fillRect(1590, top, 680, 12);
  b.fillStyle = mix('peach', 'paper', 0.3); poly(b, [[1650, 130], [1800, 100], [1812, 250], [1610, 280]]); b.fill();
  b.fillStyle = mix(rgba('paper'), light, 0.6); poly(b, [[1612, 276], [1812, 248], [1806, 262], [1622, 288]]); b.fill();
}
/**
 * Her school bag, close up, in the lamp's light; and, with `room`, the corner of her room it stands in, for the
 * camera to go back to. `c`: the picture (the whole frame is painted); `g`: the light layer (the lamp). Returns the
 * mouth of the pocket and its pull (as the kit's drawBag does) and the y of the pocket's lip, all in the shot's own
 * px (under the camera: seen()).
 */
export function drawBagShot(c: Ctx, g: Ctx, o: BagOpts): { mouth: V2; pull: V2; lip: number } {
  const { t, cam } = o, { x, y, scale: s } = BAG, wood = mix(WOOD, NIGHT, 0.22), woodLow = mix(WOOD_LOW, NIGHT, 0.3), room = o.room, warm = room?.warm ?? 1;
  if (room) layer(c, { cam, depth: 0.7, blur: 6 * (1 - room.sharp) }, (b) => study(b, t, warm));
  // her room behind it, dark and out of focus; the lamp on her desk, off to the right
  else layer(c, { cam, depth: 0.7, blur: 6 }, (b) => {
    const wall = mix(mix('paper', 'blush', 0.28), NIGHT, 0.6), lamp = b.createRadialGradient(1700, 120, 0, 1700, 120, 1300);
    b.fillStyle = wall; b.fillRect(-400, -400, W + 800, H + 800);
    lamp.addColorStop(0, mix('gold', 'paper', 0.3, 0.6)); lamp.addColorStop(0.4, rgba('gold', 0.16)); lamp.addColorStop(1, rgba('gold', 0));
    b.fillStyle = lamp; b.fillRect(-400, -400, W + 800, H + 800);
    b.fillStyle = mix(WOOD, NIGHT, 0.3); b.fillRect(1600, 650, 800, 56); b.fillStyle = mix(WOOD_LOW, NIGHT, 0.4); b.fillRect(1620, 706, 800, 800);
    b.strokeStyle = mix(METAL, NIGHT, 0.3); b.lineWidth = 16; b.lineCap = 'round'; b.lineJoin = 'round'; b.beginPath(); b.moveTo(1830, 650); b.lineTo(1870, 380); b.lineTo(1740, 200); b.stroke();
    b.fillStyle = mix('peach', 'paper', 0.3); poly(b, [[1650, 130], [1800, 100], [1812, 250], [1610, 280]]); b.fill();
  });
  c.save(); camera(c, cam, 1);
  if (room) {
    // (the chair stands on the floor: its shadow there, its legs and the rail between them)
    c.fillStyle = rgba('ink', 0.22); c.beginPath(); c.ellipse(x, y + SEAT + 8, 500, 30, 0, 0, TAU); c.fill();
    fillV(c, y + 50, y + SEAT, woodLow, mix(WOOD_LOW, NIGHT, 0.5));
    for (const sg of [-1, 1]) { c.beginPath(); c.roundRect(x + sg * 392 - 24, y + 40, 48, SEAT - 40, [0, 0, 10, 10]); c.fill(); }
    c.fillRect(x - 392, y + 400, 784, 34);
  }
  // the chair: its back behind the bag, its seat under it
  fillV(c, 100, y, wood, woodLow);
  for (const sg of [-1, 1]) { c.beginPath(); c.roundRect(x + sg * 392 - 22, 60, 44, y - 60, 16); c.fill(); }
  c.beginPath(); c.roundRect(x - 400, 96, 800, 84, 20); c.fill();
  c.fillStyle = rgba('ink', 0.2); c.beginPath(); c.ellipse(x, y + 4, 370, 22, 0, 0, TAU); c.fill();
  // the bag (the kit's), its form in the lamp's light, and what a close look adds: the zip's teeth, the pocket's stitching
  const bag = drawBag(c, { x, y, scale: s, zip: o.zip }), shade = c.createLinearGradient(x - 62 * s, 0, x + 62 * s, 0), zy = bag.mouth[1];
  shade.addColorStop(0, rgba('ink', 0.2)); shade.addColorStop(0.55, rgba('ink', 0)); shade.addColorStop(1, mix('gold', 'paper', 0.3, 0.16));
  c.fillStyle = shade; c.beginPath(); c.roundRect(x - 62 * s, y - 150 * s, 124 * s, 150 * s, [44 * s, 44 * s, 20 * s, 20 * s]); c.fill();
  c.strokeStyle = rgba('ink', 0.3); c.lineWidth = 2.5; c.beginPath();
  for (let tx = x - 37 * s + 6; tx < bag.pull[0] - 10; tx += 11) { c.moveTo(tx, zy - 7); c.lineTo(tx, zy + 7); }
  c.stroke();
  c.strokeStyle = rgba('paper', 0.6); c.lineWidth = 3; c.setLineDash([12, 10]);
  c.beginPath(); c.roundRect(x - 46 * s + 16, y - 54 * s, 92 * s - 32, 40 * s - 16, [6, 6, 14 * s, 14 * s]); c.stroke(); c.setLineDash([]);
  fillV(c, y - 4, y + 60, wood, woodLow); c.beginPath(); c.roundRect(x - 440, y - 6, 880, 56, 18); c.fill();
  c.fillStyle = woodLow; c.fillRect(x - 400, y + 50, 800, room ? 70 : 200);
  const lip = zy + 14;
  if (o.pile !== undefined && o.zip > 0.01) {
    // chorus 2: the pocket is full already. It gapes wider for all that is in it; the stars stand up out of it
    // wherever the zip has let them, and go under again as it comes back over them
    const px = bag.pull[0], x1 = x + 37 * s, mid = (px + x1) / 2;
    c.fillStyle = mix('ink', 'navy', 0.3, 0.8);
    c.beginPath(); c.moveTo(px, zy); c.quadraticCurveTo(mid, zy - 30 * s * o.zip, x1, zy); c.quadraticCurveTo(mid, zy + 9 * s * o.zip, px, zy); c.fill();
    c.save(); c.beginPath(); c.rect(-600, -600, W + 1200, lip + 600); c.clip();
    // (three behind and four before: where each is along the mouth, how large, how it lies)
    const stars: [number, number, number][] = [[0.22, 35, -0.3], [0.52, 39, 0.2], [0.8, 34, 0.5], [0.09, 31, 0.4], [0.37, 36, -0.15], [0.65, 35, 0.3], [0.92, 30, -0.45]];
    stars.forEach(([u, r, turn], j) => {
      const back = j < 3, sx = lerp(x - 37 * s + 20, x1 - 16, u), up = smoothstep(0, 76, sx - px - r * 0.5) * (1 - 0.55 * (o.pile ?? 0) * Math.exp(-(((sx - x - 8) / 120) ** 2)));
      if (up <= 0.01) return;
      drawStar(c, sx, lerp(lip + r + 6, lip - (back ? 46 : 10), up) + 2.5 * Math.sin(t * 2.2 + j * 1.9) * up, r, turn + 0.05 * Math.sin(t * 1.7 + j), { color: back ? mix('rose', 'ink', 0.14) : j % 2 ? mix('rose', 'blush', 0.28) : undefined });
    });
    c.restore();
  }
  if (o.into) { c.save(); c.beginPath(); c.rect(-600, -600, W + 1200, lip + 600); c.clip(); o.into(c); c.restore(); }
  if (o.other) hand(c, o.other.x, o.other.y, o.other.rot, 1.9, true);
  if (o.hand) hand(c, o.hand.x, o.hand.y, o.hand.rot, 1.9);
  c.restore();
  const [lx, ly] = seen(cam, [1700, 120], 0.7), zl = 1 + ((cam.zoom ?? 1) - 1) * 0.7;
  glow(g, lx, ly, room ? 680 * zl : 680, { color: room ? mix('frost', 'gold', warm) : undefined, alpha: 0.45 });
  dustMotes(g, t, { count: 26, seed: 51, alpha: 0.6 });
  for (const [h, flip] of [[o.hand, false], [o.other, true]] as const) if (h) { g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.8; camera(g, cam, 1); hand(g, h.x, h.y, h.rot, 1.9, flip); g.restore(); }
  return { ...bag, lip };
}
