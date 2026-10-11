// INTRO, shots 3 and 4 — outside, on a golden afternoon: the school building as a grid of classroom
// windows over four floors (the grid that returns in the bridge), her window among them, the autumn trees,
// the basketball court in the distance, the birds on their wire, and on the wall the bell that ends the
// intro and comes back in the outro.
import { W, H } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { hash, lerp, smoothstep, TAU } from '../engine/util';
import { dustMotes, glow, layer, type Cam, type Ctx, type V2 } from './_love';

/** The grid of windows: the first column and row, their pitch, and the size of a window (16:9, like the picture). */
const COL0 = 60, ROW0 = 250, PITCH_X = 240, PITCH_Y = 170, WIN_W = 192, WIN_H = 108;
/** Her classroom's window (fourth column, third floor): the classroom picture, a tenth of its size. */
export const WIN = { x: COL0 + 2 * PITCH_X, y: ROW0 + PITCH_Y, w: WIN_W, h: WIN_H };
/** (The bridge builds this wall on without an end: the grid's pitch, and from below `miniRoom`, `dressing` and the wall's colours.) */
export const PITCH: V2 = [PITCH_X, PITCH_Y];
/** The building: the end of its front, the width of its end wall (in shade), its roof line, the ground. */
const EDGE = 1022, END = 30, ROOF = 196, GROUND = 930;
/** The middle of the bell as it hangs on the end wall. */
export const BELL: V2 = [EDGE + END + 46, 470];
/** The wire from the corner of the roof, sagging, and the birds along it. */
const wire = (u: number): V2 => [lerp(EDGE + END + 6, 2090, u), lerp(ROOF + 4, 92, u) + 280 * u * (1 - u)];
const BIRDS = [0.262, 0.305, 0.385, 0.47, 0.515];

export const WALL = mix('paper', 'peach', 0.34), WALL_LOW = mix(mix('paper', 'peach', 0.56), 'ink', 0.07);
const SHADE = mix(mix('paper', 'peach', 0.7), 'ink', 0.3), TRIM = mix('paper', 'peach', 0.1);
const LEAF = mix(mix('gold', 'peach', 0.5), 'ink', 0.12), LEAF_LOW = mix(mix('peach', 'rose', 0.22), 'ink', 0.3), LEAF_LIT = mix('gold', 'paper', 0.3);
const BRONZE = mix('gold', 'ink', 0.34), BRONZE_LOW = mix('gold', 'ink', 0.58), IRON = mix('ink', 'navy', 0.3);

export interface OutsideOpts {
  t: number;
  /** The camera, for the plane of the building; the sky, the court and the trees follow it by their depth. */
  cam: Cam;
  /** How far out of focus the building is, px: coming out of her window, it passes close to the camera. */
  blur?: number;
  /** Paints the classroom into her window: called once the wall is down, before the window's own glass and frame. */
  inside?: () => void;
  /** Paints what is written in the sky (the title): called behind the building, so that the building can hide it. */
  written?: () => void;
  /** Her window: 0..1 how much of its glass and bars is there yet, and how far out of focus they are, px. */
  glass?: number; frameBlur?: number;
  /** The bell's swing and its clapper's, rad. */
  swing?: number; clapper?: number;
  /** When the birds leave the wire (s); never, if left out. */
  birdsAt?: number;
  /** 0..1: the branch close to the camera; the sun's glow (it is behind the building until the sky comes into view). */
  near?: number; sun?: number;
  /** Paints the sky (the whole frame) in place of the afternoon's and its clouds: the outro's sunset. */
  sky?: (c: Ctx) => void;
  /** After school: there is nobody at the windows. */
  empty?: boolean;
}

// ------------------------------------------------------------------ sky, distance, trees
function sky(c: Ctx) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix('sky', 'paper', 0.12)); g.addColorStop(0.3, mix('sky', 'paper', 0.42)); g.addColorStop(0.56, mix('paper', 'gold', 0.32)); g.addColorStop(0.78, mix('gold', 'peach', 0.42)); g.addColorStop(1, mix('peach', 'paper', 0.3));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // the sun low on the right: its warmth in the air round it
  const s = c.createRadialGradient(1800, 70, 0, 1800, 70, 900);
  s.addColorStop(0, mix('paper', 'gold', 0.3, 0.95)); s.addColorStop(0.07, mix('paper', 'gold', 0.4, 0.6)); s.addColorStop(0.4, mix('gold', 'paper', 0.3, 0.2)); s.addColorStop(1, mix('gold', 'paper', 0.3, 0));
  c.fillStyle = s; c.fillRect(0, 0, W, H);
}
/** Soft afternoon clouds, drifting. */
function clouds(c: Ctx, t: number) {
  const puffs: [number, number, number][] = [[0, 0, 60], [-74, 16, 42], [70, 12, 48], [-28, -26, 44], [34, -30, 38], [132, 24, 30], [-132, 26, 28]];
  for (const [x, y, s] of [[1230, 150, 1.05], [1700, 262, 0.72], [720, 96, 0.85], [1960, 470, 0.7], [250, 70, 0.62], [1420, 560, 0.5]] as [number, number, number][]) {
    const cx = x + 5 * t * (0.6 + 0.4 * s);
    for (const [low, col] of [[1, mix('peach', 'blush', 0.5, 0.5)], [0, rgba('paper', 0.92)]] as [number, string][]) {
      c.fillStyle = col; c.beginPath();
      for (const [px, py, r] of puffs) { c.moveTo(cx + px * s + r * s, y + py * s + low * 9 * s); c.arc(cx + px * s, y + py * s + low * 9 * s, r * s, 0, TAU); }
      c.fill();
    }
  }
}

/** An autumn tree standing on (x, y): a round crown of radius `r`, dappled by the sun. */
function tree(c: Ctx, x: number, y: number, r: number, t: number, seed: number, trunk = 1.25) {
  const cy = y - r * trunk - r * 0.5, sway = (i: number) => r * 0.014 * Math.sin(t * 0.7 + i * 1.7 + seed);
  c.fillStyle = mix('ink', 'peach', 0.3);
  c.beginPath(); c.moveTo(x - r * 0.09, y); c.lineTo(x - r * 0.05, cy); c.lineTo(x + r * 0.05, cy); c.lineTo(x + r * 0.09, y); c.closePath(); c.fill();
  const crown: [number, number, number][] = [[0, 0.3, 0.74], [-0.62, 0.22, 0.56], [0.6, 0.24, 0.6], [-0.84, 0.5, 0.36], [0.86, 0.5, 0.36], [0, 0, 0.92], [-0.36, -0.42, 0.56], [0.34, -0.4, 0.54]];
  const blobs = new Path2D();
  crown.forEach(([px, py, pr], i) => { const bx = x + px * r + sway(i), by = cy + py * r; blobs.moveTo(bx + pr * r, by); blobs.arc(bx, by, pr * r, 0, TAU); });
  const g = c.createLinearGradient(x + r * 0.5, cy - r, x - r * 0.4, cy + r);
  g.addColorStop(0, mix(LEAF, 'gold', 0.5)); g.addColorStop(0.5, LEAF); g.addColorStop(1, LEAF_LOW);
  c.fillStyle = g; c.fill(blobs);
  // the dapples: leaves that catch the sun, and the shade between them
  c.save(); c.clip(blobs);
  for (let i = 0; i < 26; i++) {
    const a = hash(i, seed, 1) * TAU, d = Math.sqrt(hash(i, seed, 2)) * r * 0.95, lit = hash(i, seed, 3) < 0.62, k = 0.5 + 0.5 * Math.sin(t * (0.7 + hash(i, seed, 4)) + i);
    c.fillStyle = lit ? mix(LEAF_LIT, 'paper', 0.2, 0.3 + 0.4 * k) : mix(LEAF_LOW, 'ink', 0.1, 0.22);
    c.beginPath(); c.ellipse(x + Math.cos(a) * d + (lit ? r * 0.14 : -r * 0.1) + sway(i), cy + Math.sin(a) * d * 0.9 + (lit ? -r * 0.12 : r * 0.14), r * (0.07 + 0.09 * hash(i, seed, 5)), r * (0.05 + 0.05 * hash(i, seed, 6)), a, 0, TAU); c.fill();
  }
  c.restore();
}

/** The far side of the school grounds: low hills and roofs in the haze, the ground, the fence, the basketball court. */
function distance(c: Ctx, t: number) {
  for (let i = 0; i < 26; i++) { c.fillStyle = mix(mix('dusk', 'peach', 0.45 + 0.3 * hash(i, 71)), 'paper', 0.5); c.beginPath(); c.arc(-300 + i * 105 + 40 * hash(i, 72), 806 + 16 * hash(i, 73), 60 + 50 * hash(i, 74), 0, TAU); c.fill(); }
  c.fillStyle = mix(mix('dusk', 'frost', 0.5), 'paper', 0.45);
  for (const [x, y, w] of [[1290, 716, 120], [1430, 742, 86], [1700, 728, 150]]) { c.fillRect(x, y, w, 110); c.fillRect(x + w * 0.2, y - 16, w * 0.3, 20); }
  const g = c.createLinearGradient(0, 800, 0, 1080);
  g.addColorStop(0, mix(mix('gold', 'peach', 0.5), 'paper', 0.3)); g.addColorStop(1, mix('peach', 'paper', 0.25));
  c.fillStyle = g; c.fillRect(-900, 806, 4200, 700);
  for (let i = 0; i < 9; i++) tree(c, 1170 + i * 104 + 30 * hash(i, 75), 836 + 4 * hash(i, 76), 40 + 16 * hash(i, 77), t, 30 + i, 0.5);
  // the court, seen from its long side: its lines, the two hoops, a ball left on it
  const court: V2[] = [[1168, 908], [2010, 908], [1946, 842], [1238, 842]], line = (pts: V2[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
  c.fillStyle = mix(mix('peach', 'blush', 0.5), 'rose', 0.08); c.beginPath(); court.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
  c.strokeStyle = rgba('paper', 0.85); c.lineWidth = 2.5; c.lineJoin = 'round'; c.lineCap = 'round';
  line([[1196, 900], [1982, 900], [1928, 850], [1256, 850], [1196, 900]]); line([[1592, 850], [1589, 900]]);
  c.beginPath(); c.ellipse(1590, 874, 50, 15, 0, 0, TAU); c.stroke();
  c.beginPath(); c.ellipse(1226, 874, 84, 24, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
  c.beginPath(); c.ellipse(1955, 874, 84, 24, 0, Math.PI / 2, Math.PI * 1.5); c.stroke();
  for (const [x, sg] of [[1206, 1], [1974, -1]]) {
    c.strokeStyle = mix('frost', 'navy', 0.35); c.lineWidth = 4; line([[x - sg * 22, 876], [x - sg * 22, 800], [x, 786]]);
    c.strokeStyle = rgba('paper'); c.lineWidth = 5; line([[x, 768], [x, 806]]);
    c.strokeStyle = mix('peach', 'rose', 0.45); c.lineWidth = 2.5; line([[x, 797], [x + sg * 20, 797]]);
    c.strokeStyle = rgba('paper', 0.8); c.lineWidth = 1.5; line([[x + sg * 3, 798], [x + sg * 7, 812], [x + sg * 15, 812], [x + sg * 19, 798]]);
  }
  c.fillStyle = mix('peach', 'rose', 0.3); c.beginPath(); c.arc(1508, 886, 7, 0, TAU); c.fill();
  c.strokeStyle = mix('frost', 'navy', 0.3, 0.5); c.lineWidth = 1.5;
  c.beginPath(); for (let x = 1150; x <= 2040; x += 52) { c.moveTo(x, 812); c.lineTo(x, 846); } c.moveTo(1150, 814); c.lineTo(2040, 814); c.stroke();
}

// ------------------------------------------------------------------ the building
/** A classroom seen through its window from far away: what the classroom picture looks like at this size. */
export function miniRoom(c: Ctx, x: number, y: number, w: number, h: number, seed: number, empty = false) {
  const px = (v: number) => x + (w * v) / 1920, py = (v: number) => y + (h * v) / 1080;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = mix('paper', 'peach', 0.28); c.fillRect(x, y, w, h);
  c.fillStyle = mix('paper', 'frost', 0.25); c.fillRect(x, y, w, py(172) - y);
  c.fillStyle = mix('sky', 'paper', 0.32); c.fillRect(x, py(527), w, py(652) - py(527));
  c.fillStyle = mix(mix('paper', 'peach', 0.55), 'ink', 0.16); c.fillRect(x, py(652), w, y + h - py(652));
  c.fillStyle = mix('navy', 'ink', 0.3); c.fillRect(px(112), py(332), px(781) - px(112), py(514) - py(332));
  c.fillStyle = mix(mix('paper', 'peach', 0.45), 'ink', 0.12); c.beginPath(); c.moveTo(px(1065), py(172)); c.lineTo(px(1920), py(-690)); c.lineTo(px(1920), py(1340)); c.lineTo(px(1065), py(652)); c.closePath(); c.fill();
  c.fillStyle = mix('paper', 'gold', 0.22); c.beginPath(); c.moveTo(px(1140), py(250)); c.lineTo(px(1920), py(-420)); c.lineTo(px(1920), py(790)); c.lineTo(px(1140), py(540)); c.closePath(); c.fill();
  // the heads of the class, row behind row (after school: their desks alone)
  for (const [Z, n] of [[2720, 8], [2290, 7], [1860, 6], [1430, 5], [1000, 4]] as [number, number][]) for (let k = 0; k < n; k++) {
    if (!empty && (hash(seed, Z, k) < 0.16 || (Z === 1000 && k === 1))) continue;
    const X = 480 - 290 * k, hx = px(800 + (1250 * X) / Z), hy = py(440 + (1250 * 150) / Z), r = (w * 49 * 1250) / Z / 1920;
    if (hx < x - r) continue;
    if (!empty) {
      c.fillStyle = mix('frost', 'sky', 0.15 + 0.6 * hash(seed, Z, k, 2));
      c.beginPath(); c.arc(hx, hy, r, 0, TAU); c.fill(); c.beginPath(); c.roundRect(hx - r * 1.15, hy + r * 0.85, r * 2.3, r * 2.1, r * 0.8); c.fill();
    }
    c.fillStyle = mix(mix('paper', 'peach', 0.6), 'ink', 0.14); c.fillRect(hx - r * 1.5, hy + r * 2.5, r * 3, r * 0.8);
  }
  c.restore();
}
/** A window's glass (a little of the sky in it), its frame and bars, its sill: `glass` 0..1 = how much of them is there. */
export function dressing(c: Ctx, x: number, y: number, w: number, h: number, glass = 1) {
  if (glass <= 0.003) return;
  c.save(); c.globalAlpha *= glass;
  c.fillStyle = mix('sky', 'navy', 0.22, 0.26); c.fillRect(x, y, w, h);
  const sheen = c.createLinearGradient(x, y + h, x + w * 0.8, y);
  sheen.addColorStop(0.2, rgba('paper', 0)); sheen.addColorStop(0.42, rgba('paper', 0.2)); sheen.addColorStop(0.5, rgba('paper', 0.05)); sheen.addColorStop(0.62, rgba('paper', 0.14)); sheen.addColorStop(0.8, rgba('paper', 0));
  c.fillStyle = sheen; c.fillRect(x, y, w, h);
  const top = c.createLinearGradient(0, y, 0, y + h * 0.3);
  top.addColorStop(0, rgba('ink', 0.2)); top.addColorStop(1, rgba('ink', 0));
  c.fillStyle = top; c.fillRect(x, y, w, h * 0.3);
  c.strokeStyle = TRIM; c.lineWidth = w * 0.019; c.lineJoin = 'miter';
  c.beginPath(); c.moveTo(x + w / 3, y); c.lineTo(x + w / 3, y + h); c.moveTo(x + (2 * w) / 3, y); c.lineTo(x + (2 * w) / 3, y + h); c.moveTo(x, y + h * 0.3); c.lineTo(x + w, y + h * 0.3); c.stroke();
  c.lineWidth = w * 0.03; c.strokeRect(x, y, w, h);
  c.fillStyle = TRIM; c.fillRect(x - w * 0.04, y + h + w * 0.012, w * 1.08, w * 0.036);
  c.fillStyle = rgba('ink', 0.1); c.fillRect(x - w * 0.04, y + h + w * 0.048, w * 1.08, w * 0.03);
  c.restore();
}
const columns = [-1, 0, 1, 2, 3], floors = [0, 1, 2, 3];
function building(c: Ctx, empty = false) {
  // the end wall, in shade; the front; the roof's edge
  c.fillStyle = SHADE; c.fillRect(EDGE, ROOF, END, GROUND - ROOF);
  const g = c.createLinearGradient(0, ROOF, 0, GROUND);
  g.addColorStop(0, WALL); g.addColorStop(1, WALL_LOW);
  c.fillStyle = g; c.fillRect(-1400, ROOF, EDGE + 1400, GROUND - ROOF);
  c.fillStyle = mix(SHADE, 'ink', 0.1); c.fillRect(EDGE - 2, ROOF - 16, END + 12, 22);
  c.fillStyle = mix(WALL_LOW, 'ink', 0.06); c.fillRect(-1400, ROOF - 16, EDGE + 1400 + 4, 22);
  c.fillStyle = rgba('ink', 0.08); c.fillRect(-1400, ROOF + 6, EDGE + 1400, 9);
  // a stair head on the roof, the line of each floor, the foot of the wall, a drain pipe
  c.fillStyle = WALL_LOW; c.fillRect(170, ROOF - 62, 150, 48); c.fillStyle = mix(WALL_LOW, 'ink', 0.1); c.fillRect(162, ROOF - 68, 166, 9);
  for (const j of floors.slice(1)) { const y = ROW0 + j * PITCH_Y - 34; c.fillStyle = rgba('paper', 0.3); c.fillRect(-1400, y, EDGE + 1400, 5); c.fillStyle = rgba('ink', 0.07); c.fillRect(-1400, y + 5, EDGE + 1400, 4); }
  c.fillStyle = mix(WALL_LOW, 'ink', 0.14); c.fillRect(-1400, GROUND - 34, EDGE + 1400, 34);
  c.fillStyle = mix(SHADE, 'ink', 0.16); c.fillRect(EDGE, GROUND - 34, END, 34);
  c.fillStyle = mix('frost', 'peach', 0.4); c.fillRect(992, ROOF + 6, 7, GROUND - ROOF - 6);
  for (const i of columns) for (const j of floors) {
    const x = COL0 + i * PITCH_X, y = ROW0 + j * PITCH_Y, hers = x === WIN.x && y === WIN.y;
    // (the reveal of the window in the wall: a line of shade above and on the left)
    c.fillStyle = rgba('ink', 0.1); c.fillRect(x - 6, y - 7, WIN_W + 9, WIN_H + 10);
    if (hers) { c.fillStyle = mix('paper', 'peach', 0.28); c.fillRect(x, y, WIN_W, WIN_H); continue; }
    miniRoom(c, x, y, WIN_W, WIN_H, 100 + i * 7 + j * 31, empty);
    dressing(c, x, y, WIN_W, WIN_H);
  }
}

/** The bell on its bracket: `swing` and `clapper` in rad. */
function bell(c: Ctx, swing: number, clapper: number) {
  const wall = EDGE + END, px = BELL[0], py = BELL[1] - 34;
  c.strokeStyle = IRON; c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = 6; c.beginPath(); c.moveTo(wall + 1, py - 16); c.lineTo(wall + 1, py + 34); c.stroke();
  c.lineWidth = 4; c.beginPath(); c.moveTo(wall, py - 6); c.lineTo(px + 7, py - 6); c.moveTo(wall, py + 28); c.quadraticCurveTo(px - 12, py + 24, px - 5, py - 4); c.stroke();
  c.save(); c.translate(px, py); c.rotate(swing);
  c.lineWidth = 3; c.beginPath(); c.arc(0, 5, 5.5, 0, TAU); c.stroke();
  // the clapper inside, then the bell over it
  c.save(); c.translate(0, 30); c.rotate(clapper);
  c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 30); c.stroke();
  c.fillStyle = IRON; c.beginPath(); c.arc(0, 34, 6, 0, TAU); c.fill();
  c.restore();
  const body = new Path2D();
  body.moveTo(-9, 12); body.bezierCurveTo(-11, 32, -17, 44, -28, 55); body.lineTo(28, 55); body.bezierCurveTo(17, 44, 11, 32, 9, 12); body.quadraticCurveTo(0, 3, -9, 12); body.closePath();
  const g = c.createLinearGradient(-28, 0, 28, 0);
  g.addColorStop(0, BRONZE_LOW); g.addColorStop(0.6, BRONZE); g.addColorStop(1, mix(BRONZE, 'gold', 0.6));
  c.fillStyle = g; c.fill(body);
  c.fillStyle = BRONZE_LOW; c.beginPath(); c.roundRect(-30, 53, 60, 7, 3.5); c.fill();
  c.strokeStyle = rgba('paper', 0.5); c.lineWidth = 3; c.beginPath(); c.moveTo(8, 18); c.quadraticCurveTo(11, 36, 19, 47); c.stroke();
  c.restore();
}

/** The birds: on the wire, or (from `at` on) lifting off it one after the other and away. */
function birds(c: Ctx, t: number, at: number | undefined) {
  c.strokeStyle = mix('ink', 'navy', 0.3, 0.7); c.lineWidth = 1.6; c.lineCap = 'round';
  c.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = wire(i / 40); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
  const col = mix('navy', 'ink', 0.5);
  BIRDS.forEach((u, i) => {
    const [x0, y0] = wire(u), since = at === undefined ? -1 : t - at - 0.1 * i - 0.14 * hash(i, 81), flip = hash(i, 82) < 0.4 ? -1 : 1;
    c.save();
    if (since <= 0) {
      // perched: a round body, a head, a tail; it looks about now and then
      c.translate(x0, y0 - 7 + 0.6 * Math.sin(t * 2 + i)); c.scale(flip, 1);
      const look = Math.sin(t * 0.9 + i * 2.3) > 0.7 ? 1.5 : 0;
      c.fillStyle = col;
      c.beginPath(); c.ellipse(0, 0, 9.5, 7, -0.25, 0, TAU); c.arc(7 + look, -7.5, 4.8, 0, TAU); c.moveTo(-6, -1); c.lineTo(-18, 5); c.lineTo(-6, 5); c.closePath(); c.fill();
      c.fillStyle = rgba('gold'); c.beginPath(); c.moveTo(11.5 + look, -8.5); c.lineTo(16 + look, -7); c.lineTo(11.5 + look, -5.5); c.closePath(); c.fill();
    } else {
      // away: a hop off the wire, then up and off to the right, wings beating
      const far = 1 - Math.exp(-since * 1.1), x = x0 + (110 + 80 * hash(i, 83)) * since ** 1.25 + 30 * far, y = y0 - 7 - 34 * (1 - Math.exp(-since * 5)) - (86 + 60 * hash(i, 84)) * since ** 1.15, flap = Math.sin(since * TAU * (3.6 + hash(i, 85)) + i);
      c.translate(x, y); c.scale(1 - 0.3 * far, 1 - 0.3 * far); c.globalAlpha *= 1 - smoothstep(1.6, 2.6, since);
      c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 8, 4.4, -0.3, 0, TAU); c.arc(7, -3.5, 3.6, 0, TAU); c.fill();
      c.strokeStyle = col; c.lineWidth = 4.2; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(-17, -4 - 12 * flap); c.quadraticCurveTo(-7, -4 - 4 * flap, 0, -1); c.quadraticCurveTo(5, -6 - 5 * flap, 12, -9 - 13 * flap); c.stroke();
    }
    c.restore();
  });
}

/** A branch close to the camera, out of focus, in the corner of the frame. */
function branch(c: Ctx, t: number) {
  for (let i = 0; i < 26; i++) {
    const d = 60 + 400 * hash(i, 91) ** 1.4, th = 0.08 + 1.1 * hash(i, 92), x = -30 + d * Math.cos(th), y = -40 + d * Math.sin(th) * 0.62, a = th + 0.9 + 0.9 * (hash(i, 94) - 0.5) + 0.1 * Math.sin(t * 0.8 + i), s = 38 + 34 * hash(i, 95);
    c.save(); c.translate(x + 5 * Math.sin(t * 0.6 + i), y); c.rotate(a);
    c.fillStyle = hash(i, 96) < 0.5 ? LEAF : mix(LEAF, 'gold', 0.5);
    c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * 0.7, 0, 0, s); c.quadraticCurveTo(-s * 0.7, 0, 0, -s); c.fill();
    c.restore();
  }
}

// ------------------------------------------------------------------ the picture
/**
 * The school from outside. `c`: the picture (the whole frame is painted); `g`: the light layer (the sun,
 * the dust in the air). The rings of the bell and the title are the scene's own.
 */
export function drawOutside(c: Ctx, g: Ctx, o: OutsideOpts) {
  const { t, cam } = o, blur = o.blur ?? 0;
  if (o.sky) o.sky(c);
  else { sky(c); layer(c, { cam, depth: 0.05, blur: 3 }, (b) => clouds(b, t)); }
  o.written?.();
  layer(c, { cam, depth: 0.5, blur: 3, haze: 0.16, hazeColor: mix('paper', 'gold', 0.35) }, (b) => distance(b, t));
  layer(c, { cam, depth: 0.8, haze: 0.06, hazeColor: mix('paper', 'gold', 0.35) }, (b) => tree(b, 1856, 990, 128, t, 3));
  layer(c, { cam, depth: 1, blur }, (b) => {
    building(b, o.empty);
    bell(b, o.swing ?? 0, o.clapper ?? 0);
    birds(b, t, o.birdsAt);
  });
  o.inside?.();
  layer(c, { cam, depth: 1, blur: o.frameBlur ?? 0 }, (b) => dressing(b, WIN.x, WIN.y, WIN.w, WIN.h, o.glass ?? 1));
  layer(c, { cam, depth: 1.1, blur: blur * 1.2 }, (b) => {
    // the school yard, and the trees along the front of the building
    const yard = b.createLinearGradient(0, GROUND, 0, 1080);
    yard.addColorStop(0, mix('paper', 'peach', 0.42)); yard.addColorStop(1, mix(mix('paper', 'peach', 0.6), 'ink', 0.1));
    b.fillStyle = yard; b.fillRect(-1600, GROUND, 5200, 900);
    b.fillStyle = rgba('ink', 0.08); b.fillRect(-1600, GROUND, EDGE + END + 1600, 8);
    for (const [x, y, r, seed] of [[96, 1004, 132, 1], [466, 1010, 118, 2], [842, 1000, 126, 5]] as const) {
      // (its shadow on the yard, thrown away from the sun)
      b.fillStyle = rgba('ink', 0.09); b.beginPath(); b.ellipse(x - r * 0.5, y + 3, r * 0.95, r * 0.11, 0, 0, TAU); b.fill();
      tree(b, x, y, r, t, seed);
    }
  });
  if ((o.near ?? 1) > 0.003) layer(c, { cam, depth: 1.7, blur: 9, alpha: 0.92 * (o.near ?? 1) }, (b) => branch(b, t));
  glow(g, 1800, 70, 660, { alpha: 0.85 * (o.sun ?? 1) });
  dustMotes(g, t, { count: 26, alpha: 0.55 * (o.sun ?? 1), seed: 12 });
}
