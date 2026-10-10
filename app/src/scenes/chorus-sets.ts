// CHORUS, the sets — where chorus.ts stages the way home, her evening and the months after it:
//   the way home, one long strip seen from the side: the school corridor and its windows, the steps down to the
//     yard, the yard and the gate, the street with its low shop fronts, the bus stop, the bus
//   her room: the bed under the window, the calendar on the wall; and in that window the night, the morning,
//     the tree losing its leaves, the first snow, the frost
//   what is on her phone, the photographs the day has left her, and her school bag, close up
// What depends on the season is in SEASONS, one entry a chorus: chorus 2 (Prompt 5) is the same way home in winter.
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, hash, lerp, smoothstep, TAU } from '../engine/util';
import {
  CHORUS1_FROST, camera, dottedPath, drawBag, dustMotes, drawStar, frost, glow, layer, leaves, lightShaft, petals, snow, sparkle,
  type Cam, type Ctx, type Outfit, type Shaft, type V2,
} from './_love';

type V3 = [number, number, number];
// (the kit's own blends, _love-rig.ts and _love-props.ts: her hand and sleeve, wood)
const SKIN = mix('paper', 'peach', 0.4), BEIGE = mix(mix('paper', 'gold', 0.4), 'ink', 0.08), BEIGE_LOW = mix(mix('paper', 'peach', 0.5), 'ink', 0.18);
const WOOD = mix(mix('paper', 'peach', 0.55), 'ink', 0.1), WOOD_LOW = mix(mix('paper', 'peach', 0.7), 'ink', 0.3);
const METAL = mix('frost', 'navy', 0.35), TRIM = CHORUS1_FROST.trim, NIGHT = mix('navy', 'dusk', 0.16);
const fillV = (c: Ctx, y0: number, y1: number, top: string, low: string) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, low); c.fillStyle = g; };
const poly = (c: Ctx, pts: V2[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

// ------------------------------------------------------------------ the season
export interface Season {
  name: string;
  /** What the two of them wear. */
  outfit: Outfit;
  /** The sky over the way home, from the top of the frame down to the horizon (five stops): as they leave, and at the bus stop. */
  sky: [string[], string[]];
  /** The air that lies over what is far, and the colour of the low sun. */
  haze: string; sun: string;
  /** The crowns of the trees: in the light, their body, in the shade. */
  leaf: [string, string, string];
  /** What comes down through the air along the way (over an area of the way, under the camera). */
  air: (c: Ctx, t: number, area: { x: number; y: number; w: number; h: number }) => void;
}
/** By chorus: 1 is an autumn afternoon that goes down to sunset. */
export const SEASONS: Record<number, Season> = {
  1: {
    name: 'autumn', outfit: 'autumn',
    sky: [
      [mix('sky', 'paper', 0.12), mix('sky', 'paper', 0.45), mix('paper', 'gold', 0.4), mix('gold', 'peach', 0.4), mix('peach', 'paper', 0.3)],
      [mix('dusk', 'sky', 0.4), mix('blush', 'dusk', 0.3), mix('peach', 'blush', 0.35), mix('gold', 'peach', 0.55), mix('gold', 'paper', 0.25)],
    ],
    haze: mix('paper', 'gold', 0.35), sun: 'gold',
    leaf: [mix('gold', 'paper', 0.3), mix(mix('gold', 'peach', 0.5), 'ink', 0.12), mix(mix('peach', 'rose', 0.22), 'ink', 0.3)],
    air: (c, t, area) => { leaves(c, t, { ...area, count: 22, wind: -0.25, seed: 41 }); petals(c, t, { ...area, count: 12, wind: -0.2, seed: 43 }); },
  },
};

// ------------------------------------------------------------------ the way home: where things are
/** How large the two of them are on the way; the corridor's floor (y); how much lower the yard and the street lie. */
export const S = 0.92, FLOOR = 925, DROP = 300, GROUND = FLOOR + DROP;
/**
 * Along the way (x, at the depth of the two): where the dotted path starts, the top of the steps (the corridor
 * ends there), their foot, the gate, the sign of the bus stop, where she and he stop, and the door of the bus.
 */
export const WAY = { board: 380, steps: 1500, yard: 1995, gate: 3050, sign: 4150, her: 4390, him: 4590, door: 4660 } as const;
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
  const g = c.createLinearGradient(0, 0, 0, 820);
  [0, 0.3, 0.56, 0.8, 1].forEach((at, i) => g.addColorStop(at, mix(s.sky[0][i]!, s.sky[1][i]!, late)));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const [x, y] = sunAt(late), r = c.createRadialGradient(x, y, 0, x, y, 950);
  r.addColorStop(0, mix('paper', s.sun, 0.3, 0.95)); r.addColorStop(0.06, mix('paper', s.sun, 0.45, 0.6)); r.addColorStop(0.4, mix(s.sun, 'paper', 0.3, 0.2)); r.addColorStop(1, mix(s.sun, 'paper', 0.3, 0));
  c.fillStyle = r; c.fillRect(0, 0, W, H);
}
const kept = new Map<string, HTMLCanvasElement>();
/**
 * What is too far off to be seen moving (the town, the trees, the shops across the road): a strip of its layer, from
 * (x0, y0) to (x1, y1), painted once at `res` of the picture's resolution (a little soft, as far things are) with
 * `haze` of the air's colour over it, and kept. (Three such layers painted afresh each frame cost more than all the rest.)
 */
function strip(c: Ctx, key: string, [x0, y0, x1, y1]: number[], res: number, haze: [string, number], draw: (c: Ctx) => void) {
  let cv = kept.get(key);
  if (!cv) {
    kept.set(key, (cv = document.createElement('canvas')));
    cv.width = Math.round((x1! - x0!) * SCALE * res); cv.height = Math.round((y1! - y0!) * SCALE * res);
    const x = scaleContext2D(cv.getContext('2d')!, SCALE * res);
    x.translate(-x0!, -y0!); draw(x);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgba(haze[0], haze[1]); x.fillRect(x0!, y0!, x1! - x0!, y1! - y0!);
  }
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
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
  for (let i = Math.floor(x0 / 230) - 1; i <= x1 / 230; i++) {
    if (hash(i, 51) < 0.3) continue;
    const street = i * 230 > behind(WAY.gate, 0.5);
    tree(c, i * 230 + 90 * hash(i, 52), base + 6, (street ? 126 : 96) + 40 * hash(i, 53), 0, 60 + i, s.leaf, street ? 1.3 : 1);
  }
}

// ------------------------------------------------------------------ the way home: the street's far side
const SIGNS = ['书', '面', '果', '包子'];
/** A low shop front standing on (x, base): its sign, its striped awning, its window lit from inside, its door. */
function shop(c: Ctx, x: number, base: number, w: number, h: number, i: number) {
  const tints = [mix('paper', 'peach', 0.32), mix('paper', 'blush', 0.5), mix('paper', 'sky', 0.4), mix('paper', 'gold', 0.42)], stripes = [rgba('peach'), mix('blush', 'rose', 0.15), mix('sky', 'navy', 0.1), mix('gold', 'peach', 0.3)];
  const wall = tints[i % 4]!, top = base - h, ay = top + 84, n = Math.round(w / 44), wy = ay + 66, wh = base - 26 - wy;
  fillV(c, top, base, wall, mix(wall, 'ink', 0.12)); c.fillRect(x, top, w, h + 60);
  c.fillStyle = mix(mix('peach', 'ink', 0.4), 'navy', 0.1); c.fillRect(x - 8, top - 16, w + 16, 20);
  c.fillStyle = rgba('paper', 0.92); c.beginPath(); c.roundRect(x + 30, top + 16, w - 60, 56, 6); c.fill();
  c.font = font(F.hand(500), 42); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = rgba('ink', 0.78);
  c.fillText(SIGNS[i % 4]!, x + w / 2, top + 59);
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
function shops(c: Ctx, x1: number) {
  for (let i = 0, x = behind(WAY.gate + 260, 0.8); x < x1; i++) {
    const w = 300 + 140 * hash(i, 31), h = 236 + 70 * hash(i, 32);
    shop(c, x, SHOPS, w, h, i);
    x += w + (hash(i, 33) < 0.34 ? 60 + 70 * hash(i, 34) : 10);
  }
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
  const far = GROUND - 125, a = Math.max(x0, WAY.steps), r = Math.max(x0, WAY.gate + 70);
  if (x1 <= WAY.steps) return;
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
  if (x0 < WAY.gate + 200 && x1 > 2050) {
    // the yard: a hedge along its far side; the gate, its leaf swung open along the way, and the pillar it hangs on
    c.fillStyle = mix(s.leaf[1], 'ink', 0.1); c.beginPath(); c.roundRect(2090, far - 62, 470, 70, 30);
    for (let x = 2120; x < 2540; x += 46) { const r = 30 + 22 * hash(x, 2); c.moveTo(x + r, far - 56); c.arc(x, far - 56 - 8 * hash(x, 1), r, 0, TAU); }
    c.fill();
    c.fillStyle = mix(s.leaf[0], 'paper', 0.2, 0.32); for (let x = 2130; x < 2540; x += 46) { c.beginPath(); c.ellipse(x + 12 * hash(x, 3), far - 74 - 14 * hash(x, 4), 15, 9, -0.4, 0, TAU); c.fill(); }
    c.strokeStyle = METAL; c.lineCap = 'round'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(2620, far - 400); c.lineTo(2980, far - 400); c.moveTo(2620, far - 30); c.lineTo(2980, far - 30); c.stroke();
    c.lineWidth = 4.5; c.beginPath(); for (let x = 2624; x < 2980; x += 38) { c.moveTo(x, far - 428); c.lineTo(x, far - 12); } c.stroke();
    const wall = mix('paper', 'peach', 0.3);
    fillV(c, far - 500, far, wall, mix(mix('paper', 'peach', 0.5), 'ink', 0.08)); c.fillRect(WAY.gate - 70, far - 500, 140, 512);
    c.fillStyle = mix(mix('paper', 'peach', 0.5), 'ink', 0.16); c.fillRect(WAY.gate - 84, far - 528, 168, 30);
    c.fillStyle = rgba('paper', 0.9); c.beginPath(); c.roundRect(WAY.gate - 27, far - 410, 54, 236, 5); c.fill();
    c.fillStyle = rgba('ink', 0.28); for (let i = 0; i < 4; i++) c.fillRect(WAY.gate - 13, far - 388 + i * 52, 26, 30);
    c.strokeStyle = rgba('ink', 0.16); c.lineWidth = 6; c.beginPath(); c.moveTo(WAY.gate, far + 6); c.lineTo(WAY.gate - 70, GROUND + 320); c.stroke();
  }
  if (x0 < WAY.yard + 60) {
    // the steps: the wall along them with its rail, and the six steps
    const wall = mix(mix('paper', 'peach', 0.34), 'ink', 0.08), pts: V2[] = [[WAY.steps, FLOOR]];
    fillV(c, FLOOR - 140, GROUND, wall, mix(wall, 'ink', 0.1)); poly(c, [[WAY.steps, FLOOR - 140], [2010, GROUND - 140], [2010, GROUND + 60], [WAY.steps, FLOOR + 60]]); c.fill();
    c.strokeStyle = TRIM; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(WAY.steps, FLOOR - 140); c.lineTo(2010, GROUND - 140); c.stroke();
    c.fillStyle = TRIM; c.fillRect(1996, GROUND - 180, 30, 180);
    for (let i = 0; i < 6; i++) pts.push([WAY.steps + i * 90, FLOOR + (i + 1) * 50], [WAY.steps + (i + 1) * 90, FLOOR + (i + 1) * 50]);
    fillV(c, FLOOR, GROUND + 200, mix('paper', 'peach', 0.26), mix(mix('paper', 'peach', 0.5), 'ink', 0.12)); poly(c, [...pts, [WAY.steps + 540, GROUND + 1200], [WAY.steps, GROUND + 1200]]); c.fill();
    for (let i = 0; i < 6; i++) { const x = WAY.steps + i * 90, y = FLOOR + i * 50; c.fillStyle = rgba('ink', 0.08); c.fillRect(x, y, 7, 50); c.fillStyle = rgba('paper', 0.6); c.fillRect(x, y + 50, 90, 4); }
  }
}
/** The sign of the bus stop, on the near pavement. */
function busStop(c: Ctx) {
  const x = WAY.sign, y = GROUND - 6, blue = mix('sky', 'navy', 0.25);
  c.fillStyle = rgba('ink', 0.14); c.beginPath(); c.ellipse(x - 14, y + 2, 40, 6, 0, 0, TAU); c.fill();
  c.fillStyle = METAL; c.fillRect(x - 5, y - 500, 10, 500);
  c.fillStyle = blue; c.beginPath(); c.arc(x, y - 528, 52, 0, TAU); c.fill();
  c.strokeStyle = rgba('paper'); c.lineWidth = 6; c.beginPath(); c.arc(x, y - 528, 41, 0, TAU); c.stroke();
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(x - 25, y - 546, 50, 29, 7); c.fill();
  for (const sg of [-1, 1]) { c.beginPath(); c.arc(x + sg * 13, y - 514, 5.5, 0, TAU); c.fill(); }
  c.fillStyle = blue; c.fillRect(x - 19, y - 541, 38, 11);
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(x - 58, y - 462, 116, 162, 8); c.fill();
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
/** The bus on the road behind them: cream over blue, the evening in its windows, its door toward us. */
function bus(c: Ctx, o: BusOpts) {
  const k = BUS.k, [d0, d1] = BUS.door, open = clamp(o.door), frame = mix(BLUE, 'navy', 0.35);
  c.save(); c.translate(o.x, BUS.road); c.scale(k, k);
  c.fillStyle = rgba('ink', 0.16); c.beginPath(); c.ellipse(BUS.len / 2, 2, BUS.len * 0.5, 20, 0, 0, TAU); c.fill();
  const body = new Path2D();
  body.moveTo(0, -110); body.lineTo(0, -700); body.quadraticCurveTo(0, -760, 60, -760); body.lineTo(1460, -760); body.quadraticCurveTo(1524, -756, 1538, -690);
  body.lineTo(1560, -440); body.lineTo(1560, -110); body.quadraticCurveTo(1560, -70, 1520, -70); body.lineTo(40, -70); body.quadraticCurveTo(0, -70, 0, -110); body.closePath();
  c.fillStyle = mix('frost', 'paper', 0.4); c.beginPath(); c.roundRect(520, -792, 430, 40, 12); c.fill();
  fillV(c, -760, -70, CREAM, mix(CREAM, 'peach', 0.2)); c.fill(body);
  c.save(); c.clip(body);
  fillV(c, -340, -70, BLUE, mix(BLUE, 'navy', 0.12)); c.fillRect(0, -340, 1560, 280);
  c.fillStyle = rgba('paper', 0.9); c.fillRect(0, -356, 1560, 14);
  c.restore();
  // the inside, through the windows and the door: the light in the roof, the people on it, and him
  const wins: V2[] = [[70, 250], [276, 456], [482, 662], BUS.win, [1091, 1281], [1310, 1500]], glass = new Path2D();
  for (const [a, z] of wins) glass.roundRect(a, -715, z - a, 215, 14);
  glass.rect(d0, -700, d1 - d0, 600);
  c.save(); c.clip(glass);
  fillV(c, -715, -100, mix('gold', 'paper', 0.45), mix('peach', 'ink', 0.3)); c.fillRect(0, -720, 1560, 640);
  c.fillStyle = mix('frost', 'navy', 0.3, 0.8);
  for (const [x, y] of [[150, -590], [372, -604], [578, -586], [1190, -598]] as V2[]) { c.beginPath(); c.arc(x, y, 36, 0, TAU); c.roundRect(x - 50, y + 30, 100, 140, 30); c.fill(); }
  o.inside?.(c);
  c.restore();
  // the glass over them, the frames; the two leaves of the door, which slide apart
  c.strokeStyle = frame; c.lineWidth = 6;
  for (const [a, z] of wins) { c.fillStyle = mix('sky', 'paper', 0.3, 0.2); c.beginPath(); c.roundRect(a, -715, z - a, 215, 14); c.fill(); c.stroke(); }
  for (const x of [d0 - 80 * open, (d0 + d1) / 2 + 80 * open]) {
    c.fillStyle = mix('sky', 'paper', 0.3, 0.3); c.fillRect(x, -700, 85, 600);
    c.fillStyle = mix(CREAM, 'peach', 0.1); c.fillRect(x, -330, 85, 230);
    c.strokeRect(x, -700, 85, 600);
  }
  c.fillStyle = rgba('ink', 0.22); c.fillRect(d0, -104, d1 - d0, 8);
  // the wheels, the number of its line, its lamps
  for (const x of [310, 1250]) {
    c.fillStyle = mix('ink', 'navy', 0.3); c.beginPath(); c.arc(x, -70, 88, Math.PI, TAU); c.fill();
    c.beginPath(); c.arc(x, -64, 64, 0, TAU); c.fill();
    c.fillStyle = mix('frost', 'paper', 0.3); c.beginPath(); c.arc(x, -64, 30, 0, TAU); c.fill();
    c.strokeStyle = mix('frost', 'navy', 0.4); c.lineWidth = 6; c.beginPath();
    for (let j = 0; j < 3; j++) { const a = o.x / (64 * k) + (j * TAU) / 3; c.moveTo(x, -64); c.lineTo(x + Math.cos(a) * 27, -64 + Math.sin(a) * 27); }
    c.stroke();
  }
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(1100, -474, 150, 72, 10); c.fill();
  c.fillStyle = rgba('ink', 0.8); c.font = font(F.sans(700), 44); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('12路', 1175, -422);
  c.fillStyle = mix('peach', 'rose', 0.4); c.fillRect(0, -330, 12, 70);
  c.fillStyle = rgba('gold'); c.beginPath(); c.roundRect(1542, -300, 18, 50, 8); c.fill();
  c.restore();
}

// ------------------------------------------------------------------ the way home: the picture
/** The dotted path (TREATMENT, motif 5): from the blackboard to the gate, and on to the bus stop. */
const PATH: V2[] = Array.from({ length: 30 }, (_, i) => { const x = WAY.board + i * 138; return [x, groundAt(x) + 34 + 7 * Math.sin(i * 1.7)] as V2; });
/** One of its two small labels, with its mark: a ring where it starts, a cross where it ends. */
function label(c: Ctx, text: string, x: number, k: number, end: boolean) {
  if (k <= 0.01) return;
  const y = groundAt(x) + 34;
  c.save(); c.globalAlpha *= k; c.strokeStyle = rgba('ink', 0.6); c.lineWidth = 4; c.lineCap = 'round'; c.beginPath();
  if (end) { c.moveTo(x - 11, y - 11); c.lineTo(x + 11, y + 11); c.moveTo(x + 11, y - 11); c.lineTo(x - 11, y + 11); } else c.arc(x, y, 11, 0, TAU);
  c.stroke();
  c.font = font(F.hand(500), 40); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = rgba('ink', 0.74);
  c.fillText(text, x, y + 62);
  c.restore();
}

export interface WayOpts {
  t: number; cam: Cam; season: Season;
  /** 0 as they leave the classroom .. 1 at the bus stop: the afternoon going down to sunset. */
  late: number;
  /** How far along the way the dotted path has drawn itself (x), and how much of its two labels is there (0..1 each). */
  path: number; labels: V2;
  /** The star marks her small steps leave on the pavement: where (x), and how long ago (s; not yet if negative). */
  stars: { x: number; age: number }[];
  bus?: BusOpts;
  /** Paints the two of them, on the way (under the camera). */
  two: (c: Ctx) => void;
}
/**
 * The way home under a camera. `c`: the picture (the whole frame is painted); `g`: the light layer (the low sun,
 * the shafts through the corridor's windows and the dust in them, the glow of the star marks).
 */
export function drawWay(c: Ctx, g: Ctx, o: WayOpts) {
  const { t, cam, season: s, late } = o, view = inView(cam), z = cam.zoom ?? 1;
  sky(c, s, late);
  // what is far: the town, the trees, the shops, each a layer painted once (see strip())
  const far = (depth: number, paint: (v: V2) => void) => { c.save(); camera(c, cam, depth); paint(span(cam, depth)); c.restore(); };
  far(0.12, () => strip(c, `far/${s.name}`, [-260, 180, 2560, 1000], 0.5, [s.haze, 0.12], (b) => distance(b, [-260, 2560])));
  far(0.5, (v) => { c.fillStyle = mix(mix('paper', 'peach', 0.34), s.haze, 0.1); c.fillRect(v[0], YARD - 4, v[1] - v[0], 700); strip(c, `yard/${s.name}`, [-620, 420, 4060, YARD + 10], 0.6, [s.haze, 0.1], (b) => yard(b, [-620, 4060], s)); });
  if (view[1] > WAY.gate) far(0.8, (v) => { const a = Math.max(v[0], behind(WAY.gate, 0.8)); c.fillStyle = mix(mix('paper', 'peach', 0.36), s.haze, 0.06); c.fillRect(a, SHOPS - 4, v[1] - a, 500); strip(c, `shops/${s.name}`, [2560, 700, 5280, SHOPS + 60], 1, [s.haze, 0.06], (b) => shops(b, 5280)); });
  c.save(); camera(c, cam, 1);
  ground(c, view, s);
  corridor(c, view);
  if (o.bus) bus(c, o.bus);
  if (view[1] > WAY.sign - 100 && view[0] < WAY.sign + 100) busStop(c);
  dottedPath(c, PATH, (o.path - WAY.board) / (PATH[PATH.length - 1]![0] - WAY.board), { alpha: 0.5, gap: 26, width: 5 });
  label(c, '黑板', WAY.board, o.labels[0], false); label(c, '校门', WAY.gate, o.labels[1], true);
  for (const st of o.stars) if (st.age > 0) { c.save(); c.translate(st.x, GROUND + 30); c.scale(1, 0.55); drawStar(c, 0, 0, 16 * (1 + 0.5 * Math.sin(Math.PI * clamp(st.age / 0.4))), 0.3 * Math.sin(st.x), { color: rgba('gold') }); c.restore(); }
  o.two(c);
  s.air(c, t, { x: WAY.steps, y: GROUND - 1000, w: 4600, h: 1060 });
  c.restore();
  // the light: the sun low ahead of them; in the corridor its shafts through the windows and the dust in them
  const sun = sunAt(late), shafts: Shaft[] = [];
  glow(g, sun[0], sun[1], 720, { color: s.sun, alpha: 0.5 });
  for (const a of openings(view)) {
    const [x, y] = seen(cam, [a + 190, HEAD + 60]), [gx, gy] = seen(cam, [a, HEAD]), shaft: Shaft = { x, y, angle: -0.56, length: 800 * z, width: 330 * z, spread: 1.15 };
    lightShaft(c, shaft, { color: s.sun, alpha: 0.2, t }); lightShaft(g, shaft, { color: s.sun, alpha: 0.028, t });
    g.fillStyle = mix('paper', s.sun, 0.3, 0.06); g.fillRect(gx, gy, 380 * z, (SILL - HEAD) * z);
    shafts.push(shaft);
  }
  dustMotes(g, t, shafts.length ? { shafts, count: 60, seed: 31 } : { count: 22, seed: 31, alpha: 0.5 });
  for (const st of o.stars) if (st.age > 0) {
    const [x, y] = seen(cam, [st.x, GROUND + 30]);
    glow(g, x, y, 46 * z, { alpha: 0.3 + 0.1 * Math.sin(t * 3 + st.x) });
    sparkle(g, x, y - 18 * z, 36 * z, Math.sin(Math.PI * clamp(st.age / 0.6)) ** 0.8, { rot: st.x });
  }
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
    if (night > 0.05 && hash(i, 8) < 0.6) { c.fillStyle = rgba('gold', 0.85 * night); c.fillRect(rx + 16 + 30 * hash(i, 9), h - rh + 14, 14, 16); }
  }
  // the tree: its branches, and the leaves on them, which turn, let go on the beat and come down
  const dim = (col: string) => mix(col, NIGHT, 0.55 * night);
  c.strokeStyle = dim(mix('ink', 'peach', 0.25)); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const b of BRANCHES) for (let i = 0; i < b.pts.length - 1; i++) { c.lineWidth = lerp(b.w[0], b.w[1], (i + 0.5) / (b.pts.length - 1)); c.beginPath(); c.moveTo(b.pts[i]![0], b.pts[i]![1]); c.lineTo(b.pts[i + 1]![0], b.pts[i + 1]![1]); c.stroke(); }
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
  if (pop > 0.01) {
    c.save(); c.translate(w - 34, 332); c.scale(pop, pop); c.globalAlpha *= clamp(pop * 2);
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

// ------------------------------------------------------------------ her bag, close up
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
}
/** Her hand, come down from the upper right, the sleeve of her cardigan behind it: (x, y) is where finger and thumb meet. */
function hand(c: Ctx, x: number, y: number, rot: number, s: number) {
  const part = (ax: number, ay: number, bx: number, by: number, w: number, col: string) => {
    c.lineWidth = w + 3; c.strokeStyle = mix(col, 'ink', 0.3); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.lineWidth = w; c.strokeStyle = col; c.stroke();
  };
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.lineCap = 'round';
  part(196, -430, 92, -140, 84, BEIGE); part(98, -156, 88, -128, 92, BEIGE_LOW);
  for (const [ax, ay, bx, by, w] of [[92, -58, 86, -22, 19], [78, -52, 66, -12, 21], [62, -54, 44, -14, 22]]) part(ax!, ay!, bx!, by!, w!, SKIN);
  part(80, -116, 54, -62, 72, SKIN);
  part(48, -60, 9, -5, 22, SKIN); part(22, -86, -3, -12, 22, SKIN);
  c.restore();
}
/**
 * Her school bag, close up, in the lamp's light. `c`: the picture (the whole frame is painted); `g`: the light
 * layer (the lamp). Returns the mouth of the pocket and its pull (as the kit's drawBag does) and the y of the
 * pocket's lip, all in the shot's own px (under the camera: seen()).
 */
export function drawBagShot(c: Ctx, g: Ctx, o: BagOpts): { mouth: V2; pull: V2; lip: number } {
  const { t, cam } = o, { x, y, scale: s } = BAG, wood = mix(WOOD, NIGHT, 0.22), woodLow = mix(WOOD_LOW, NIGHT, 0.3);
  // her room behind it, dark and out of focus; the lamp on her desk, off to the right
  layer(c, { cam, depth: 0.7, blur: 6 }, (b) => {
    const wall = mix(mix('paper', 'blush', 0.28), NIGHT, 0.6), lamp = b.createRadialGradient(1700, 120, 0, 1700, 120, 1300);
    b.fillStyle = wall; b.fillRect(-400, -400, W + 800, H + 800);
    lamp.addColorStop(0, mix('gold', 'paper', 0.3, 0.6)); lamp.addColorStop(0.4, rgba('gold', 0.16)); lamp.addColorStop(1, rgba('gold', 0));
    b.fillStyle = lamp; b.fillRect(-400, -400, W + 800, H + 800);
    b.fillStyle = mix(WOOD, NIGHT, 0.3); b.fillRect(1600, 650, 800, 56); b.fillStyle = mix(WOOD_LOW, NIGHT, 0.4); b.fillRect(1620, 706, 800, 800);
    b.strokeStyle = mix(METAL, NIGHT, 0.3); b.lineWidth = 16; b.lineCap = 'round'; b.lineJoin = 'round'; b.beginPath(); b.moveTo(1830, 650); b.lineTo(1870, 380); b.lineTo(1740, 200); b.stroke();
    b.fillStyle = mix('peach', 'paper', 0.3); poly(b, [[1650, 130], [1800, 100], [1812, 250], [1610, 280]]); b.fill();
  });
  c.save(); camera(c, cam, 1);
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
  c.fillStyle = woodLow; c.fillRect(x - 400, y + 50, 800, 200);
  const lip = zy + 14;
  if (o.into) { c.save(); c.beginPath(); c.rect(-600, -600, W + 1200, lip + 600); c.clip(); o.into(c); c.restore(); }
  if (o.hand) hand(c, o.hand.x, o.hand.y, o.hand.rot, 1.9);
  c.restore();
  const [lx, ly] = seen(cam, [1700, 120], 0.7), h = o.hand;
  glow(g, lx, ly, 680, { alpha: 0.45 });
  dustMotes(g, t, { count: 26, seed: 51, alpha: 0.6 });
  if (h) { g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.8; camera(g, cam, 1); hand(g, h.x, h.y, h.rot, 1.9); g.restore(); }
  return { ...bag, lip };
}
