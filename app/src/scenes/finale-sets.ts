// FINALE, the sets — where the last chorus is staged (finale.ts):
//   the way home once more (chorus-sets.ts), in spring and in the rain. What the finale gives it: its season, its sky,
//     which clears from the rain the bridge ends in (BRIDGE_RAIN) to a sunset, and the wet on its pavement
//   the small road under the trees in flower, seen from behind the two of them
//   that road from high above, the whole way from the school to the bus stop on it, small enough to go into a raindrop
//   the drops on the glass before the lens
//   the stars that come out of her pocket with the last line, and the sky they go up into: where the outro starts (FINALE_SKY)
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import type { AudioData } from '../engine/audio';
import type { Line, Lyrics } from '../engine/lyrics';
import { mix, rgba } from '../engine/palette';
import { clamp, ease, hash, lerp, mod, mulberry32, smoothstep, TAU } from '../engine/util';
import { dottedPath, drawLyric, drawStar, sparkle, type Ctx, type V2 } from './_love';
import { BRIDGE_RAIN } from './bridge-sets';
import { GROUND, type Season } from './chorus-sets';

type V3 = [number, number, number];
const sine = ease.inOutSine;
const poly = (c: Ctx, pts: V2[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
// (the chorus's road, and its earth: chorus-sets.ts; bark; the trim of the school's walls)
const ROAD = mix(mix('dusk', 'frost', 0.5), 'paper', 0.3), ROAD_LOW = mix(mix('dusk', 'frost', 0.4), 'ink', 0.12), EARTH = mix('paper', 'peach', 0.36), BARK = mix('ink', 'peach', 0.3);
/** The trees in flower: their crowns in the light, their body, in the shade. */
const BLOSSOM: [string, string, string] = [mix('blush', 'paper', 0.5), mix('blush', 'frost', 0.16), mix(mix('blush', 'dusk', 0.42), 'ink', 0.14)];
const RAIN_SKY = BRIDGE_RAIN.sky as [string, string, string];

/**
 * The way home in spring (a Season of chorus-sets.ts): the trees are in flower, and the two are back in what they wore
 * in autumn. Its sky and its light are the finale's own (drawSky, through drawWay's `sky`), and so is its air: the rain.
 */
export const SPRING: Season = {
  name: 'spring', outfit: 'autumn', sky: [[...RAIN_SKY], [...RAIN_SKY]], skyAt: [0, 0.5, 1], skyTo: H,
  haze: mix('frost', 'paper', 0.4), dim: 0.1, sun: null, leaf: BLOSSOM,
  snow: false, eve: (col) => col, dusk: 0, puff: [mix('frost', 'navy', 0.2), rgba('paper')], stars: 1, air: () => {},
};

// ------------------------------------------------------------------ the sky: from the rain to the sunset
/** How far the picture goes down the frame when the camera looks up after the stars, at the end (px). */
export const TILT = 1300;
/** The sky down the picture, and above it for that look up (y, px): its colours in the rain (the bridge's), and at sunset. */
const SKY_Y = [-TILT, H / 2 - TILT, H - TILT, 0, H / 2, H], RAINY = [0, 0, 0, 0, 1, 2].map((i) => RAIN_SKY[i]!);
const SUNSET = [mix('dusk', 'sky', 0.42), mix('dusk', 'blush', 0.5), mix('blush', 'peach', 0.5), mix('peach', 'blush', 0.25), mix('gold', 'paper', 0.28), mix('gold', 'peach', 0.42)];
/** The sky's colour low down, `clear` (0..1) of the way from the rain to the sunset: what lies in the wet. */
export const skyLow = (clear: number) => mix(RAINY[4]!, SUNSET[4]!, clear);
/** A bank of cloud, as puffs (x, y, r). */
const BANK: V3[] = [[0, 0, 150], [-170, 30, 110], [150, 40, 120], [-60, -70, 100], [80, -60, 90], [300, 60, 80], [-310, 62, 76], [20, 70, 120], [-190, 96, 70], [210, 110, 64]];
export interface SkyOpts {
  t: number;
  /** 0 = the rain .. 1 = the clouds have parted, and it is sunset. */
  clear: number;
  /** Where the sun stands (in the picture), and how much of it is seen yet (0..1). */
  sun: V2; shine: number;
}
/**
 * The finale's sky, on the picture: the grey of the rain (the bridge's last frame: BRIDGE_RAIN.sky down the frame),
 * which breaks up into banks of cloud that draw apart, lit from under; the sun low between them; and the sunset. It
 * goes on above the frame, TILT px up, for the look up at the end.
 */
export function drawSky(c: Ctx, o: SkyOpts) {
  const sky = c.createLinearGradient(0, -TILT, 0, H), k = clamp(o.clear);
  SKY_Y.forEach((y, i) => sky.addColorStop((y + TILT) / (H + TILT), mix(RAINY[i]!, SUNSET[i]!, k)));
  c.fillStyle = sky; c.fillRect(0, -TILT, W, H + TILT);
  if (o.shine > 0.003) {
    const [x, y] = o.sun, a = clamp(o.shine), r = c.createRadialGradient(x, y, 0, x, y, 600);
    for (const [at, col] of [[0, mix('paper', 'gold', 0.2, 0.97 * a)], [0.08, mix('paper', 'gold', 0.35, 0.92 * a)], [0.115, mix('gold', 'paper', 0.3, 0.5 * a)], [0.4, rgba('gold', 0.15 * a)], [1, rgba('gold', 0)]] as [number, string][]) r.addColorStop(at, col);
    c.fillStyle = r; c.fillRect(x - 600, y - 600, 1200, 1200);
  }
  const there = smoothstep(0.03, 0.32, k), part = sine(k);
  if (there <= 0.003) return;
  for (const [sg, x0, y0, s] of [[-1, 60, 400, 0.85], [1, 1870, 170, 0.95], [-1, 520, 200, 1.2], [1, 1430, 250, 1.1]] as [number, number, number, number][]) {
    const x = x0 + sg * 350 * part + 14 * Math.sin(o.t * 0.11 + x0), y = y0 - 36 * part;
    // (its underside first, toward the sun; then the body of it)
    for (const [low, col] of [[1, mix(mix('frost', 'paper', 0.4), mix('gold', 'paper', 0.3), part, 0.95 * there)], [0, mix(mix(mix('frost', 'dusk', 0.3), 'navy', 0.12), mix('dusk', 'peach', 0.5), part, 0.9 * there)]] as [number, string][]) {
      c.fillStyle = col; c.beginPath();
      for (const [px, py, r] of BANK) { const bx = x + (px - sg * low * 9) * s, by = y + (py + low * 10) * s; c.moveTo(bx + r * s, by); c.arc(bx, by, r * s, 0, TAU); }
      c.fill();
    }
  }
}

// ------------------------------------------------------------------ the glass before the lens
/**
 * Rain on the glass the picture is seen through, `k` (0..1) of it there: drops that sit on it, and drops that run down
 * it by fits and starts, a thread of wet behind each. Most of those run down through `band` (x, y, w: where a line is
 * written on the glass).
 */
export function drawGlass(c: Ctx, t: number, k: number, band: { x: number; y: number; w: number }) {
  if (k <= 0.003) return;
  const bead = (x: number, y: number, r: number) => {
    const g = c.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, rgba('paper', 0.12)); g.addColorStop(0.7, rgba('paper', 0.24)); g.addColorStop(1, rgba('navy', 0.2));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = rgba('paper', 0.5); c.lineWidth = Math.max(1, r * 0.13); c.beginPath(); c.arc(x, y, r * 0.72, 0.15 * Math.PI, 0.7 * Math.PI); c.stroke();
    c.fillStyle = rgba('paper', 0.9); c.beginPath(); c.arc(x - r * 0.34, y - r * 0.36, Math.max(1, r * 0.2), 0, TAU); c.fill();
  };
  c.save(); c.globalAlpha *= k; c.lineCap = 'round';
  for (let i = 0; i < 56; i++) bead(hash(i, 91) * W, hash(i, 92) * H, 3 + 9 * hash(i, 93) ** 2);
  for (let i = 0; i < 9; i++) {
    const period = 3.2 + 2.6 * hash(i, 94), s = mod(t + period * hash(i, 95), period), ph = hash(i, 96) * TAU, v = 150 + 130 * hash(i, 99);
    const x0 = i < 6 ? band.x + (band.w * (i + 0.5 + 0.6 * (hash(i, 97) - 0.5))) / 6 : hash(i, 97) * W, y0 = band.y - 110 - 180 * hash(i, 98);
    const at = (u: number): V2 => { const y = y0 + v * (u + 0.28 * Math.sin(u * 3.3 + ph)); return [x0 + 12 * Math.sin(y * 0.012 + ph) + 5 * Math.sin(y * 0.033 + ph * 2), y]; };
    const a = Math.min(1, s / 0.3, (period - s) / 0.5);
    for (let j = 0; j < 14; j++) {
      const u0 = Math.max(0, s - 1.3 * (1 - j / 14)), u1 = Math.max(0, s - 1.3 * (1 - (j + 1) / 14)), [ax, ay] = at(u0), [bx, by] = at(u1);
      c.strokeStyle = rgba('paper', 0.3 * a * ((j + 1) / 14)); c.lineWidth = 1.5 + (2.5 * j) / 14; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    }
    c.save(); c.globalAlpha *= a; bead(...at(s), 7 + 4 * hash(i, 100)); c.restore();
  }
  c.restore();
}

// ------------------------------------------------------------------ the small road, from behind the two of them
/**
 * The look down the small road: the point it runs to on screen, how many px a metre is at a metre's distance, how high
 * the lens is (m), and how far ahead of it the two are (m).
 */
export const LANE = { x: W / 2, y: 470, f: 1920, eye: 1.4, at: 5.2 } as const;
/** A point of the road on screen: X m to the right of its middle, Y m up, Z m ahead. */
export const laneAt = (X: number, Y: number, Z: number): V2 => [LANE.x + (LANE.f * X) / Z, LANE.y + (LANE.f * (LANE.eye - Y)) / Z];
/** How large the two are on it (the kit's figures: 615 px to 1.6 m), and where their feet are (y). */
export const LANE_SCALE = ((LANE.f / LANE.at) * 1.6) / 615, LANE_FLOOR = laneAt(0, 0, LANE.at)[1];
/** The road: how far it is seen, how near; half its width; how far apart the bushes stand along it (a tree at every third), all in m. */
const FAR = 96, NEAR = 2.3, EDGE = 1.5, STEP = 2;
/** A tree in flower and a bush, each painted once (`res` px to a metre) and stood along the road like flats. */
const FLAT = { tree: [5.2, 6.3] as V2, bush: [2.4, 0.86] as V2, res: 150 };
let flats: { trees: HTMLCanvasElement[]; bush: HTMLCanvasElement } | null = null;
function flatsOf() {
  if (flats) return flats;
  const sheet = ([w, h]: V2) => { const cv = document.createElement('canvas'); cv.width = Math.round(w * FLAT.res * SCALE); cv.height = Math.round(h * FLAT.res * SCALE); return { cv, x: scaleContext2D(cv.getContext('2d')!, FLAT.res * SCALE) }; };
  const dabs = (x: Ctx, rnd: () => number, n: number, cx: number, cy: number, rx: number, ry: number, size: number) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()), lit = rnd() < 0.62;
      x.fillStyle = lit ? mix(BLOSSOM[0], 'paper', 0.4, 0.4 + 0.4 * rnd()) : mix(BLOSSOM[2], 'ink', 0.1, 0.24);
      x.beginPath(); x.ellipse(cx + Math.cos(a) * d * rx - (lit ? 0.12 : -0.1) * size, cy + Math.sin(a) * d * ry - (lit ? 0.12 : -0.14) * size, size * (0.06 + 0.09 * rnd()), size * (0.045 + 0.05 * rnd()), a, 0, TAU); x.fill();
    }
  };
  const trees = [0, 1, 2].map((v) => {
    const { cv, x } = sheet(FLAT.tree), rnd = mulberry32(700 + v), cx = FLAT.tree[0] / 2, cy = 2.3, r = 1.75, foot = FLAT.tree[1];
    // the trunk and its limbs
    x.fillStyle = BARK; poly(x, [[cx - 0.17, foot], [cx - 0.08, cy + 0.5], [cx + 0.08, cy + 0.5], [cx + 0.17, foot]]); x.fill();
    x.strokeStyle = BARK; x.lineCap = 'round'; x.lineWidth = 0.1;
    for (const a of [-0.95, -0.4, 0.2, 0.75, 1.15]) { const b = a + (rnd() - 0.5) * 0.3, l = 1.1 + 0.6 * rnd(); x.beginPath(); x.moveTo(cx, cy + 0.8); x.quadraticCurveTo(cx + Math.sin(b) * l * 0.4, cy + 0.8 - l * 0.5, cx + Math.sin(b) * l, cy + 0.8 - Math.cos(b) * l); x.stroke(); }
    // the crown: clouds of blossom, paler where the sky is on them
    const crown = new Path2D();
    for (const [px, py, pr] of [[0, 0, 0.6], [-0.52, 0.2, 0.44], [0.5, 0.22, 0.46], [-0.3, -0.38, 0.46], [0.32, -0.36, 0.44], [-0.74, -0.08, 0.3], [0.76, -0.04, 0.3], [0, 0.36, 0.5], [-0.04, -0.62, 0.34]] as V3[]) {
      const bx = cx + (px + (rnd() - 0.5) * 0.1) * r, by = cy + (py + (rnd() - 0.5) * 0.1) * r;
      crown.moveTo(bx + pr * r, by); crown.arc(bx, by, pr * r, 0, TAU);
    }
    const g = x.createLinearGradient(cx - r * 0.4, cy - r, cx + r * 0.3, cy + r);
    g.addColorStop(0, mix(BLOSSOM[1], BLOSSOM[0], 0.7)); g.addColorStop(0.5, BLOSSOM[1]); g.addColorStop(1, BLOSSOM[2]);
    x.fillStyle = g; x.fill(crown);
    x.save(); x.clip(crown); dabs(x, rnd, 190, cx, cy, r, r * 0.9, r * 0.52); x.restore();
    return cv;
  });
  const { cv: bush, x } = sheet(FLAT.bush), rnd = mulberry32(31), body = new Path2D(), [bw, bh] = FLAT.bush;
  for (let i = 0; i < 8; i++) { const bx = 0.4 + (1.6 * i) / 7, br = 0.24 + 0.1 * rnd(), by = bh - br * 0.75; body.moveTo(bx + br, by); body.arc(bx, by, br, 0, TAU); }
  body.rect(0.3, bh - 0.22, bw - 0.6, 0.22);
  const g = x.createLinearGradient(0, 0.2, 0, bh);
  g.addColorStop(0, mix(BLOSSOM[2], 'ink', 0.16)); g.addColorStop(1, mix(BLOSSOM[2], 'ink', 0.36));
  x.fillStyle = g; x.fill(body);
  x.save(); x.clip(body); x.globalAlpha = 0.7; dabs(x, rnd, 60, bw / 2, bh - 0.36, 1, 0.3, 0.34); x.restore();
  return (flats = { trees, bush });
}
export interface LaneOpts {
  t: number;
  /** How far along the road they have come, m: it goes by under them. */
  walked: number;
  /** 0..1: how hard it rains (the rings on the wet road). */
  rain: number;
  /** Paints the two of them, between what is further off than they are and what is nearer: LANE.at ahead, their feet on LANE_FLOOR. */
  two: (c: Ctx) => void;
}
/**
 * The small road in the rain, looking along it from behind the two: the wet road and the petals on it, bushes and
 * trees in flower to either side, paler the further off, and at its end nothing but the rain's grey. The whole frame is painted.
 */
export function drawLane(c: Ctx, o: LaneOpts) {
  const { t, walked } = o, f = flatsOf(), hz = LANE.y, sky = c.createLinearGradient(0, 0, 0, H);
  RAIN_SKY.forEach((col, i) => sky.addColorStop(i / 2, col));
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  // where the road goes: the trees close over it, far off
  c.fillStyle = mix(BLOSSOM[1], RAIN_SKY[1], 0.74); c.beginPath();
  for (let i = 0; i < 26; i++) { const x = (i + hash(i, 5) - 0.5) * 80, r = (22 + 30 * hash(i, 6)) * (0.5 + Math.abs(x - LANE.x) / 640); c.moveTo(x + r, hz); c.arc(x, hz - r * 0.3, r, 0, TAU); }
  c.fill();
  // the ground: earth to either side, the road down the middle, and the sky lying in it
  const quad = (X0: number, X1: number) => poly(c, [laneAt(X0, 0, 400), laneAt(X1, 0, 400), laneAt(X1, 0, NEAR), laneAt(X0, 0, NEAR)]);
  const down = (top: string, mid: string, low: string) => { const g = c.createLinearGradient(0, hz, 0, H); g.addColorStop(0, top); g.addColorStop(0.25, mid); g.addColorStop(1, low); return g; };
  c.fillStyle = down(mix(EARTH, RAIN_SKY[2], 0.75), mix(EARTH, RAIN_SKY[2], 0.3), mix(EARTH, 'ink', 0.12)); c.fillRect(0, hz, W, H - hz);
  c.fillStyle = mix('paper', 'frost', 0.4); quad(-EDGE - 0.14, EDGE + 0.14); c.fill();
  c.fillStyle = down(mix(ROAD, RAIN_SKY[2], 0.75), ROAD, ROAD_LOW); quad(-EDGE, EDGE); c.fill();
  c.fillStyle = down(rgba('paper', 0.42), rgba('paper', 0.2), rgba('paper', 0.05)); quad(-0.55, 0.55); c.fill();
  /** Something flat on the ground, X across and Z ahead, rx wide and rz deep (m), added to the path. */
  const flat = (X: number, Z: number, rx: number, rz: number) => { const [x, y] = laneAt(X, 0, Z), k = LANE.f / Z; c.moveTo(x + rx * k, y); c.ellipse(x, y, rx * k, Math.max(0.6, (rz * k * LANE.eye) / Z), 0, 0, TAU); };
  c.fillStyle = mix(RAIN_SKY[1], 'paper', 0.3, 0.62); c.beginPath();
  for (let i = 0; i < 7; i++) flat((hash(i, 22) - 0.5) * 2.2, NEAR + mod(hash(i, 21) * 44 - walked, 44), 0.4 + 0.3 * hash(i, 23), 0.5 + 0.5 * hash(i, 24));
  c.fill();
  c.fillStyle = mix('blush', 'paper', 0.25, 0.85); c.beginPath();
  for (let i = 0; i < 90; i++) flat((hash(i, 26) - 0.5) * 6.4, NEAR + mod(hash(i, 25) * 40 - walked, 40), 0.05, 0.07);
  c.fill();
  // the rain on it: rings
  c.lineWidth = 1.5;
  for (let i = 0; i < 34 && o.rain > 0.01; i++) {
    const period = 0.9 + 0.8 * hash(i, 27), s = t / period + hash(i, 28), n = Math.floor(s), u = s - n;
    c.strokeStyle = rgba('paper', 0.55 * o.rain * (1 - u) ** 2); c.beginPath(); flat((hash(i, n, 30) - 0.5) * 2.8, NEAR + mod(hash(i, n, 29) * 30 - walked, 30), 0.05 + 0.3 * u, 0.05 + 0.3 * u); c.stroke();
  }
  // what stands along it, far to near, the rain's grey between: a bush every STEP, a tree at every third, a side in turn
  const stand = (cv: HTMLCanvasElement, X: number, Z: number, [w, h]: V2, flip: boolean) => {
    const [x, y] = laneAt(X, 0, Z), k = LANE.f / Z;
    c.save(); c.translate(x, y); if (flip) c.scale(-1, 1); c.drawImage(cv, (-w / 2) * k, -h * k, w * k, h * k); c.restore();
  };
  let done = false;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
  for (let n = Math.ceil((walked + FAR) / STEP); n * STEP - walked >= NEAR; n--) {
    const Z = n * STEP - walked;
    if (!done && Z < LANE.at) { o.two(c); done = true; }
    if (Z > LANE.at && n % 2) { c.save(); c.globalAlpha = 0.11; c.fillStyle = sky; c.fillRect(0, 0, W, laneAt(0, 0, Z)[1]); c.restore(); }
    for (const sg of [-1, 1]) {
      if (Z < 64) stand(f.bush, sg * 2.3, Z, FLAT.bush, hash(n, sg, 41) < 0.5);
      if (mod(n, 3) === (sg < 0 ? 0 : 1)) stand(f.trees[mod(n * 7 + sg, 3)]!, sg * 2.95, Z, FLAT.tree, hash(n, sg, 42) < 0.5);
    }
  }
  if (!done) o.two(c);
}

// ------------------------------------------------------------------ the whole way, small, from high above
/** The little road through it (its own px; the two are at the origin when they are half way along it), and which of its points are the school's gate and the bus stop. */
const MINI_ROAD: V2[] = [[-700, 380], [-500, 280], [-330, 205], [-205, 132], [-100, 60], [0, 0], [102, -52], [205, -84], [282, -150], [470, -250], [700, -380]], GATE_I = 3, STOP_I = 8, FINE = 10;
/** It is seen turned by this much (rad): its road goes up the frame, nearly, as the road did when it was seen from behind the two. (And what a shadow of size r is then to be moved by, to fall down and to the right.) */
const MINI_TURN = -0.84, shadeAt = (r: number): V2 => [r * (0.25 * Math.cos(MINI_TURN) + 0.3 * Math.sin(MINI_TURN)), r * (0.3 * Math.cos(MINI_TURN) - 0.25 * Math.sin(MINI_TURN))];
const TINTS = [mix('paper', 'peach', 0.5), mix('paper', 'blush', 0.6), mix('paper', 'sky', 0.5), mix('paper', 'gold', 0.5)];
/** That world, laid out once: the road as one smooth line, the trees (x, y, r) and roofs along it and round it, the school, the sign of the stop, and which way the road runs at the gate. */
interface Mini { road: V2[]; trees: V3[]; roofs: { x: number; y: number; w: number; h: number; rot: number; tint: number }[]; school: V2; sign: V2; lean: number }
let mini: Mini | null = null;
function miniOf() {
  if (mini) return mini;
  // the road as one smooth line through its points (the same one the kit's dotted path takes through them)
  const road: V2[] = [], P = (i: number) => MINI_ROAD[clamp(i, 0, MINI_ROAD.length - 1)]!;
  for (let i = 0; i < MINI_ROAD.length - 1; i++) for (let j = 0; j < FINE; j++) {
    const u = j / FINE, a = P(i - 1), b = P(i), d = P(i + 1), e = P(i + 2);
    const at = (q: 0 | 1) => 0.5 * (2 * b[q] + (d[q] - a[q]) * u + (2 * a[q] - 5 * b[q] + 4 * d[q] - e[q]) * u * u + (3 * b[q] - a[q] - 3 * d[q] + e[q]) * u * u * u);
    road.push([at(0), at(1)]);
  }
  road.push(P(MINI_ROAD.length - 1));
  const off = (i: number, side: number, along = 0): V2 => { const a = road[i - 1]!, b = road[i + 1]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l; return [road[i]![0] - dy * side + dx * along, road[i]![1] + dx * side + dy * along]; };
  const school = off(GATE_I * FINE, 92, -26), sign = off(STOP_I * FINE, -46), far = (x: number, y: number) => Math.min(...road.map(([rx, ry]) => Math.hypot(x - rx, y - ry)));
  const trees: V3[] = [], roofs: Mini['roofs'] = [];
  // trees in flower along it from the gate to the stop, a side in turn; and round it the town: roofs and more trees
  for (let i = GATE_I * FINE + 5, k = 0; i < STOP_I * FINE; i += 6, k++) trees.push([...off(i, (k % 2 ? 1 : -1) * 62), 23 + 8 * hash(k, 3)]);
  for (let i = -8; i <= 8; i++) for (let j = -9; j <= 9; j++) {
    const x = i * 168 + (hash(i, j, 1) - 0.5) * 80, y = j * 150 + (hash(i, j, 2) - 0.5) * 70;
    if (far(x, y) < 104 || Math.hypot(x - school[0], y - school[1]) < 130 || Math.hypot(x - sign[0], y - sign[1]) < 70) continue;
    if (hash(i, j, 3) < 0.55) roofs.push({ x, y, w: 86 + 50 * hash(i, j, 4), h: 58 + 26 * hash(i, j, 5), rot: (hash(i, j, 6) - 0.5) * 0.5 - 0.5, tint: Math.floor(hash(i, j, 7) * 4) });
    else trees.push([x, y, 24 + 16 * hash(i, j, 8)]);
  }
  const g0 = road[GATE_I * FINE - 1]!, g1 = road[GATE_I * FINE + 1]!;
  return (mini = { road, trees, roofs, school, sign, lean: Math.atan2(g1[1] - g0[1], g1[0] - g0[0]) });
}
export interface MiniOpts {
  t: number;
  /** Where the two are on screen, and how large the little world is drawn round them. */
  at: V2; zoom: number;
  /** How far along the road they are: 0 = at the school's gate .. 1 = at the bus stop. */
  u: number;
  /** 0..1: how much of the dotted path is drawn yet, from the gate to the stop. */
  path: number;
  /** 0..1: how hard it rains (rings on the ground). */
  rain: number;
}
/**
 * The way home from high above, as small as a toy: the school and its gate, the little road under the trees in flower,
 * the bus stop, the roofs of the town round it; on the road the umbrella, a clear disc with the two of them under
 * it; and along the road the dotted path (the kit's). The frame is painted for a zoom of 1 or more.
 */
export function drawMini(c: Ctx, o: MiniOpts) {
  const m = miniOf(), i = lerp(GATE_I, STOP_I, clamp(o.u)) * FINE, i0 = Math.min(Math.floor(i), m.road.length - 2), a = m.road[i0]!, b = m.road[i0 + 1]!;
  const U: V2 = [lerp(a[0], b[0], i - i0), lerp(a[1], b[1], i - i0)], way = Math.atan2(b[1] - a[1], b[0] - a[0]);
  c.save(); c.translate(o.at[0], o.at[1]); c.scale(o.zoom, o.zoom); c.rotate(MINI_TURN); c.translate(-U[0], -U[1]);
  // the ground, wet; the road
  c.fillStyle = EARTH; c.fillRect(-2400, -2400, 4800, 4800);
  for (let k = 0; k < 9; k++) { const x = (hash(k, 51) - 0.5) * 2200, y = (hash(k, 52) - 0.5) * 1300, r = 180 + 200 * hash(k, 53), g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, k % 2 ? rgba('blush', 0.2) : rgba('frost', 0.3)); g.addColorStop(1, k % 2 ? rgba('blush', 0) : rgba('frost', 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  c.lineJoin = 'round'; c.lineCap = 'round';
  const line = new Path2D();
  m.road.forEach(([x, y], k) => (k ? line.lineTo(x, y) : line.moveTo(x, y)));
  for (const [col, w] of [[mix('paper', 'frost', 0.3), 74], [mix(ROAD, 'paper', 0.3), 60], [rgba('paper', 0.2), 24]] as [string, number][]) { c.strokeStyle = col; c.lineWidth = w; c.stroke(line); }
  // puddles beside it
  c.fillStyle = mix(RAIN_SKY[1], 'paper', 0.25, 0.8); c.beginPath();
  for (let k = 0; k < 9; k++) { const [x, y] = m.road[20 + k * 9]!, sg = k % 2 ? 1 : -1; c.moveTo(x + 40, y); c.ellipse(x + sg * 16, y + sg * 12, 20 + 16 * hash(k, 54), 11 + 8 * hash(k, 55), 0.4, 0, TAU); }
  c.fill();
  // the school, its yard and its gate; the roofs of the town
  const roof = (x: number, y: number, w: number, h: number, rot: number, col: string) => {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = rgba('ink', 0.1); c.fillRect(-w / 2 + 7, -h / 2 + 9, w, h);
    c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h / 2); c.fillStyle = mix(col, 'ink', 0.1); c.fillRect(-w / 2, 0, w, h / 2);
    c.fillStyle = rgba('paper', 0.65); c.fillRect(-w / 2, -1.5, w, 3);
    c.restore();
  };
  const [gx, gy] = m.road[GATE_I * FINE]!;
  c.fillStyle = mix('paper', 'peach', 0.2); c.beginPath(); c.ellipse((gx + m.school[0]) / 2, (gy + m.school[1]) / 2, 92, 62, m.lean, 0, TAU); c.fill();
  roof(m.school[0], m.school[1], 128, 74, m.lean, mix(mix('paper', 'peach', 0.45), 'ink', 0.08));
  for (const sg of [-1, 1]) { const px = gx - Math.sin(m.lean) * sg * 44, py = gy + Math.cos(m.lean) * sg * 44; c.fillStyle = rgba('ink', 0.12); c.fillRect(px - 5, py - 4, 15, 15); c.fillStyle = mix('paper', 'peach', 0.1); c.fillRect(px - 8, py - 8, 15, 15); }
  for (const r of m.roofs) roof(r.x, r.y, r.w, r.h, r.rot, TINTS[r.tint]!);
  // the dotted path, from the gate to the stop
  dottedPath(c, MINI_ROAD.slice(GATE_I, STOP_I + 1), o.path, { color: 'ink', alpha: 0.62, width: 4.5, gap: 21, seed: 9 });
  // the trees in flower, from above; the sign of the bus stop
  for (const [x, y, r] of m.trees) {
    const [dx, dy] = shadeAt(r);
    c.fillStyle = rgba('ink', 0.1); c.beginPath(); c.arc(x + dx, y + dy, r, 0, TAU); c.fill();
    c.fillStyle = BLOSSOM[1]; c.beginPath();
    for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU + x, bx = x + Math.cos(an) * r * 0.5, by = y + Math.sin(an) * r * 0.5; c.moveTo(bx + r * 0.56, by); c.arc(bx, by, r * 0.56, 0, TAU); }
    c.fill();
    c.fillStyle = mix(BLOSSOM[0], 'paper', 0.3, 0.9); c.beginPath();
    for (let k = 0; k < 4; k++) { const an = (k / 4) * TAU + y, bx = x - dx * 0.7 + Math.cos(an) * r * 0.36, by = y - dy * 0.7 + Math.sin(an) * r * 0.36; c.moveTo(bx + r * 0.26, by); c.arc(bx, by, r * 0.26, 0, TAU); }
    c.fill();
  }
  const [sx, sy] = m.sign, blue = mix('sky', 'navy', 0.25);
  c.fillStyle = rgba('ink', 0.12); c.beginPath(); c.arc(sx + 4, sy + 5, 13, 0, TAU); c.fill();
  c.fillStyle = rgba('paper'); c.fillRect(sx + 14, sy - 9, 30, 19);
  c.fillStyle = blue; c.beginPath(); c.arc(sx, sy, 13, 0, TAU); c.fill();
  c.strokeStyle = rgba('paper'); c.lineWidth = 2.5; c.beginPath(); c.arc(sx, sy, 8.5, 0, TAU); c.stroke();
  // the rain: rings on the ground
  c.lineWidth = 1.6;
  for (let k = 0; k < 70 && o.rain > 0.01; k++) {
    const period = 1 + 0.8 * hash(k, 56), s = o.t / period + hash(k, 57), n = Math.floor(s), u = s - n;
    c.strokeStyle = rgba('paper', 0.6 * o.rain * (1 - u) ** 2); c.beginPath(); c.arc(U[0] + (hash(k, n, 58) - 0.5) * 2200, U[1] + (hash(k, n, 59) - 0.5) * 2200, 2 + 13 * u, 0, TAU); c.stroke();
  }
  // the two of them under their umbrella: its shadow, their heads side by side, and the clear disc of it over them
  c.translate(U[0], U[1]);
  c.fillStyle = rgba('ink', 0.14); c.beginPath(); c.arc(...shadeAt(30), 29, 0, TAU); c.fill();
  c.save(); c.rotate(way);
  for (const [y, hair, coat, r] of [[-10, rgba('ink'), mix(mix('paper', 'gold', 0.4), 'ink', 0.08), 6.5], [10, mix('ink', 'navy', 0.38), rgba('paper'), 7]] as [number, string, string, number][]) {
    c.fillStyle = coat; c.beginPath(); c.ellipse(-1, y, 5.5, 10.5, 0, 0, TAU); c.fill();
    c.fillStyle = hair; c.beginPath(); c.arc(0, y, r, 0, TAU); c.fill();
  }
  c.restore();
  c.fillStyle = mix('paper', 'frost', 0.5, 0.5); c.beginPath(); c.arc(0, 0, 29, 0, TAU); c.fill();
  c.strokeStyle = rgba('paper', 0.55); c.lineWidth = 1.2; c.beginPath();
  for (let k = 0; k < 8; k++) { const an = (k / 8) * TAU + 0.2; c.moveTo(0, 0); c.lineTo(Math.cos(an) * 29, Math.sin(an) * 29); }
  c.stroke();
  c.strokeStyle = rgba('paper', 0.95); c.lineWidth = 2.2; c.beginPath(); c.arc(0, 0, 29, 0, TAU); c.stroke();
  c.lineWidth = 3.5; c.strokeStyle = rgba('paper', 0.85); c.beginPath(); c.arc(0, 0, 21, Math.PI * 1.08 - MINI_TURN, Math.PI * 1.42 - MINI_TURN); c.stroke();
  c.fillStyle = BARK; c.beginPath(); c.arc(0, 0, 2.4, 0, TAU); c.fill();
  c.restore();
}

// ------------------------------------------------------------------ the wet on the way: the pavement, its puddles
/** The water lying on the near pavement at the bus stop: where each pool is (x of the way, y below the kerb), half its width and half its depth. */
const POOLS: [number, number, number, number][] = [[4470, 112, 380, 90], [4020, 78, 130, 20], [4890, 60, 120, 16], [3760, 120, 150, 24]];
export interface WetOpts {
  t: number;
  /** The part of the way in view (x to x). */
  view: V2;
  /** The sky's colour low down, which lies in the wet (skyLow). */
  sky: string;
  /** 0..1: how hard it rains (rings in the water), and how still the water is (it shows what stands over it). */
  rain: number; still: number;
  /** Paints what the water shows: the two of them once more (the context is turned over about y = `foot`, where they stand). */
  mirror?: (c: Ctx) => void; foot: number;
  /** The sun in the water: where it stands (x of the way), and how much of it there is. */
  sun?: { x: number; k: number };
}
/** The wet on the way, under the camera (painted over its ground, before the two): the sky on the pavement and on the road, and the pools on the near pavement. */
export function drawWet(c: Ctx, o: WetOpts) {
  const [x0, x1] = o.view, g = c.createLinearGradient(0, GROUND - 8, 0, GROUND + 200);
  g.addColorStop(0, rgba(o.sky, 0.36)); g.addColorStop(1, rgba(o.sky, 0.16));
  c.fillStyle = g; c.fillRect(x0, GROUND - 8, x1 - x0, 700);
  c.fillStyle = rgba(o.sky, 0.24); c.fillRect(x0, GROUND - 112, x1 - x0, 92);
  const pools = new Path2D(), seen = POOLS.filter(([x, , rx]) => x + rx * 1.5 > x0 && x - rx * 1.5 < x1);
  for (const [x, y, rx, ry] of seen) for (const [dx, dy, k] of [[0, 0, 1], [0.52, 0.3, 0.6], [-0.6, -0.2, 0.5]] as V3[]) { pools.moveTo(x + (dx + k) * rx, GROUND + y + dy * ry); pools.ellipse(x + dx * rx, GROUND + y + dy * ry, rx * k, ry * k, 0, 0, TAU); }
  // (its far lip in shade, its near one in the light)
  for (const [dy, col] of [[-3, rgba('ink', 0.1)], [2, rgba('paper', 0.5)]] as [number, string][]) { c.save(); c.translate(0, dy); c.fillStyle = col; c.fill(pools); c.restore(); }
  c.fillStyle = o.sky; c.fill(pools);
  c.save(); c.clip(pools);
  if (o.mirror && o.still > 0.01) {
    c.save(); c.globalAlpha *= 0.6 * o.still; c.translate(0, o.foot); c.scale(1, -0.42); c.translate(0, -o.foot);
    o.mirror(c);
    c.restore();
  }
  if (o.sun && o.sun.k > 0.01) {
    // (the sun's road across the water)
    c.save(); c.translate(o.sun.x, GROUND + 112); c.scale(1, 1.5);
    const r = c.createRadialGradient(0, 0, 0, 0, 0, 120);
    r.addColorStop(0, mix('paper', 'gold', 0.3, 0.9 * o.sun.k)); r.addColorStop(0.4, rgba('gold', 0.4 * o.sun.k)); r.addColorStop(1, rgba('gold', 0));
    c.fillStyle = r; c.fillRect(-120, -120, 240, 240);
    c.restore();
  }
  c.lineWidth = 1.6;
  for (let k = 0; k < 16 && o.rain > 0.01; k++) {
    const period = 0.9 + 0.8 * hash(k, 61), s = o.t / period + hash(k, 62), n = Math.floor(s), u = s - n, [x, y, rx, ry] = seen[Math.floor(hash(k, n, 63) * seen.length)] ?? POOLS[0]!;
    c.strokeStyle = rgba('paper', 0.65 * o.rain * (1 - u) ** 2); c.beginPath(); c.ellipse(x + (hash(k, n, 64) - 0.5) * 1.5 * rx, GROUND + y + (hash(k, n, 65) - 0.5) * 1.3 * ry, 4 + 26 * u, 1.2 + 7 * u, 0, 0, TAU); c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------ the stars out of her pocket; the sky they go up into
/**
 * The handoff from the finale to the outro: the camera has looked up after the stars, into the sunset, and nothing is
 * left in the frame but the sky, the stars out of her pocket going up it, and the last line under the first ten of
 * them. The finale's last frame is `sky` down the frame (a linear gradient, stops at 0, 0.5 and 1) and over it
 * `drawStarsUp(c, g, { t, rising })`, with `rising` = `risingOf(lyrics, audio)`: on the light layer there is nothing
 * but the stars' glints. The outro starts on the same sky and the same call: the stars go on up by themselves, the
 * line goes 1.6 s after it has been sung, and `alpha` lets the stars go.
 */
export const FINALE_SKY = { sky: SUNSET.slice(0, 3) };
/** The last line's stars: the size of its characters, how long a star is on its way from the pocket to its place (s), how fast it goes on up from there (px a second), how much of the look up takes it down the frame, and how many more follow the line's. */
const STARS = { size: 80, rise: 1.15, drift: 13, par: 0.23, more: 8 };
/** The last line and the timing of its stars. `look`: when the camera starts to look up after them, and when it has (the cut to the outro), s; `more`: when each of the stars that follow the line's leaves the pocket, s. */
export interface Rising { line: Line; look: V2; more: number[] }
export function risingOf(ly: Lyrics, au: AudioData): Rising {
  const line = ly.get('把喜欢一点一点说出口'), b = au.beatAt(line.words[line.words.length - 1]!.start);
  return { line, look: [au.timeOfBeat(b + 0.35), au.timeOfBeat(Math.round(au.beatAt(line.end)))], more: Array.from({ length: STARS.more }, (_, j) => au.timeOfBeat(b + 0.3 + 0.09 * j)) };
}
/** How far the camera has looked up at time t: the picture is this many px down the frame (0 .. TILT). */
export const lookUp = (r: Rising, t: number) => TILT * sine(clamp((t - r.look[0]) / (r.look[1] - r.look[0])));
/**
 * The stars out of her pocket, and the last line: one star for each of its characters, which leaves the pocket as the
 * character starts being sung and takes it up with it to its place in the sky, and a few more after the last. `from`:
 * where the pocket's mouth is on screen now (left out, every star has long left it: the outro), and `gap`: where the
 * space between the two of them is (x), which the stars go up through. See FINALE_SKY.
 */
export function drawStarsUp(c: Ctx, g: Ctx, o: { t: number; rising: Rising; from?: V2; gap?: number; alpha?: number }) {
  const { t, rising: r } = o, n = r.line.chars.length, down = STARS.par * lookUp(r, t), A = o.alpha ?? 1;
  /** Star j (the line's, then those that follow) now: where it is, how far it has come to its place (0..1), how long it has been out. */
  const star = (j: number) => {
    const own = j < n, age = t - (own ? r.line.chars[j]!.word?.start ?? Infinity : r.more[j - n]!);
    if (age <= 0) return null;
    const hx = own ? W / 2 + (j - (n - 1) / 2) * 94 : 300 + 1320 * hash(j, 71), hy = own ? 232 - 44 * Math.sin((Math.PI * j) / (n - 1)) : 96 + 150 * hash(j, 72);
    const x1 = hx + 9 * Math.sin(t * 0.7 + j * 1.9), y1 = hy - STARS.drift * Math.max(0, age - STARS.rise) + 6 * Math.sin(t * 0.9 + j * 2.3) + down;
    const u = o.from ? clamp(age / STARS.rise) : 1, e = ease.outCubic(u);
    if (!o.from || u >= 1) return { x: x1, y: y1, u: 1, age, own };
    // (straight up first, between the two of them; then out to its place in an arc over the ones that are in theirs already)
    const [x0, y0] = o.from, gap = (o.gap ?? x0) + (hash(j, 73) - 0.5) * 26, out = smoothstep(0.38, 1, e);
    return { x: lerp(lerp(x0, gap, smoothstep(0, 0.3, e)), x1, out), y: lerp(y0, y1, 1 - (1 - e) ** 2.6) - 84 * Math.sin(Math.PI * out), u: e, age, own };
  };
  const stars = Array.from({ length: n + r.more.length }, (_, j) => star(j));
  const each = (paint: (s: NonNullable<(typeof stars)[number]>, j: number, size: number) => void) => stars.forEach((s, j) => { if (s) paint(s, j, (s.own ? 17 : 9 + 6 * hash(j, 74)) * lerp(0.45, 1, ease.outBack(clamp(s.age / 0.4)))); });
  const turn = (j: number) => hash(j, 75) * TAU + 0.5 * Math.sin(t * 0.8 + j);
  const line = (x: Ctx) => drawLyric(x, r.line, t, {
    x: 0, y: 0, size: STARS.size, ghost: 0, alpha: A, hold: 1.6,
    path: (_u, k) => { const s = stars[k]; return s ? { x: s.x, y: s.y + lerp(34, 68, s.u), scale: lerp(0.35, 1, s.u), angle: 0.5 * (1 - s.u) } : { x: 0, y: -400 }; },
  });
  // (whatever light is on the light layer is kept off them: the sun is behind them)
  g.save(); g.globalCompositeOperation = 'destination-out'; each((s, j, size) => drawStar(g, s.x, s.y, size, turn(j))); line(g); g.restore();
  each((s, j, size) => {
    drawStar(c, s.x, s.y, size, turn(j), { alpha: A * clamp(s.age * 6) });
    // (a glint as it comes out of the pocket, and now and then once it is in its place)
    sparkle(g, s.x, s.y, size * 1.8, A * Math.max(Math.sin(Math.PI * clamp(s.age / 0.25)) ** 0.8, s.u < 1 ? 0 : 0.8 * Math.max(0, Math.sin(t * 2.1 + j * 1.7)) ** 10), { rot: j + t * 0.3 });
  });
  c.save(); c.shadowColor = rgba('paper', 0.9); c.shadowBlur = 16; line(c); c.restore();
}
