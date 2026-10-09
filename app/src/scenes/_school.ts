// Shared look of the video: a cartoon school on a rainy afternoon. Flat colours with a dark
// outline, the rooms a little dim, the daylight outside grey-blue. Palette, small Canvas2D
// drawing helpers, rain and the clock, so every scene draws them the same way.
import { clamp, ease, hash, mod, TAU } from '../engine/util';

export type Ctx = CanvasRenderingContext2D;

/** Colours as they are in daylight. Indoors they are drawn through `dim()` (see ROOM). */
export const C = {
  // the classroom
  wall: '#E3DDCB', dado: '#86AFA5', dadoLine: '#64908A', floor: '#9C9285', floorLine: '#857C70', skirting: '#6A635B',
  frame: '#EEF1EE', sill: '#DAD6C8', curtain: '#F0DFA8', curtainFold: '#D2BD80',
  wood: '#D3A46B', woodDark: '#B08454', metal: '#8893A1', paper: '#F7F3E8',
  // people
  skin: '#FADBC4', skinShade: '#EDC0A4', blush: '#F5A79C', hair: '#2F2B3F', hairLight: '#514C68',
  shirt: '#F8F6EF', shirtShade: '#DADCE2', navy: '#34456A', navyDark: '#263352', red: '#DE5B4D', shoe: '#4E3E3D',
  pen: '#3F7CC4', teal: '#4FA39B', mouth: '#7A3B3F',
  /** The outline of every shape. */
  line: '#262739',
  // outside, in the rain
  sky0: '#56637A', sky1: '#A3AFBA', cloud: '#4F5C72', far: '#7C8996',
  bldg: '#C6C0B0', bldgLight: '#D4CEBE', bldgShade: '#A39D90', roof: '#465064',
  pane: '#3B495C', paneLit: '#FFD582', tree: '#44665D', treeDark: '#334F4A', ground: '#6F7A86', puddle: '#93A0AC',
  court: '#8C7470', courtLine: '#DCD6CC',
  brass: '#D0A043', brassDark: '#9A722B', brassLight: '#F3D07C',
  rain: '#E3EEF5',
} as const;

/** A colour as it looks in the dim room: multiplied by the cool light of a rainy day. */
export function dim(hex: string, k: [number, number, number] = [0.68, 0.72, 0.84]): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number, m: number) => Math.round(clamp(v * m, 0, 255));
  return `rgb(${ch((n >> 16) & 255, k[0])},${ch((n >> 8) & 255, k[1])},${ch(n & 255, k[2])})`;
}
/** The palette indoors. */
export type Pal = { [K in keyof typeof C]: string };
export const ROOM = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, dim(v)])) as Pal;

/** A palette blended toward one colour by k: for people and things further from the camera. */
export function fade(P: Pal, toward: string, k: number): Pal {
  const rgb = (s: string) => (s[0] === '#' ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : s.match(/\d+/g)!.map(Number));
  const to = rgb(toward);
  return Object.fromEntries(Object.entries(P).map(([name, v]) => [name, `rgb(${rgb(v).map((x, i) => Math.round(x + (to[i]! - x) * k)).join(',')})`])) as Pal;
}

export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
export function poly(c: Ctx, pts: number[], close = true) {
  c.beginPath();
  c.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i]!, pts[i + 1]!);
  if (close) c.closePath();
}
/** Fill the current path and outline it. */
export function ink(c: Ctx, fill: string | null, line = 3, stroke: string = C.line) {
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (line > 0) { c.strokeStyle = stroke; c.lineWidth = line; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
}
/** A limb or a rod: a round-capped polyline of width `w`, outlined. */
export function limb(c: Ctx, pts: number[], w: number, fill: string, line = 3, stroke: string = C.line) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  poly(c, pts, false);
  if (line > 0) { c.strokeStyle = stroke; c.lineWidth = w + line * 2; c.stroke(); }
  c.strokeStyle = fill;
  c.lineWidth = w;
  c.stroke();
}

/**
 * The middle joint (elbow, knee) of a two-segment limb from a to b with segment lengths l1 and l2.
 * `side` picks the bend: +1 = below the line when the limb points right. Out of reach, the joint
 * is the one of the straight limb (the second segment then draws longer).
 */
export function joint(ax: number, ay: number, bx: number, by: number, l1: number, l2: number, side = 1): [number, number] {
  const dx = bx - ax, dy = by - ay, d = Math.max(1e-3, Math.hypot(dx, dy));
  const dd = Math.min(d, l1 + l2 - 0.5);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  return [ax + ux * a - uy * h * side, ay + uy * a + ux * h * side];
}

/** The path of a heart centred on (x, y), `s` = half its width. */
export function heart(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y + s * 0.95);
  c.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.75, y - s * 1.15, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.75, y - s * 1.15, x + s * 1.5, y - s * 0.1, x, y + s * 0.95);
  c.closePath();
}

/**
 * Falling rain in a w x h area: slanted streaks, each a pure function of t. `len` and `speed`
 * (px, px/s) are for the average drop.
 */
export function rain(c: Ctx, t: number, o: { n: number; seed: number; len: number; speed: number; alpha: number; width: number; slant?: number; w?: number; h?: number }) {
  if (o.alpha <= 0.003) return;
  const w = o.w ?? 1920, h = o.h ?? 1080, sl = o.slant ?? 0.2;
  const span = h + o.len * 2 + 80;
  c.beginPath();
  for (let i = 0; i < o.n; i++) {
    const k = 0.65 + 0.7 * hash(i, o.seed, 1);
    const y = mod(hash(i, o.seed, 2) * span + t * o.speed * k, span) - o.len * 1.4 - 40;
    const x = hash(i, o.seed, 3) * (w + h * sl + 200) - 100 - y * sl;
    const l = o.len * k;
    c.moveTo(x, y);
    c.lineTo(x - l * sl, y + l);
  }
  c.globalAlpha = o.alpha;
  c.strokeStyle = C.rain;
  c.lineWidth = o.width;
  c.lineCap = 'round';
  c.stroke();
  c.globalAlpha = 1;
}

/**
 * Seconds shown by a clock that ticks every two beats and reaches the full minute (60) on beat
 * `end`: each tick snaps the hand on with a small overshoot. It stops there unless `run`.
 */
export function tickSeconds(beat: number, end: number, run = false): number {
  const k = (end - beat) / 2;
  const n = run ? Math.ceil(k) : Math.max(0, Math.ceil(k));
  return 59 - n + ease.outBack(clamp(((n - k) * 2) / 0.4));
}

/** A round clock: `h` hours (fractional), `m` minutes (fractional), `s` seconds. */
export function clock(c: Ctx, x: number, y: number, r: number, h: number, m: number, s: number, o: { face?: string; rim?: string; hands?: string; second?: string; line?: number } = {}) {
  const hands = o.hands ?? C.line;
  c.save();
  c.translate(x, y);
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  ink(c, o.rim ?? C.roof, o.line ?? 3);
  c.beginPath();
  c.arc(0, 0, r * 0.86, 0, TAU);
  ink(c, o.face ?? C.paper, 0);
  c.strokeStyle = hands;
  c.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, big = i % 3 === 0;
    c.lineWidth = r * (big ? 0.05 : 0.03);
    c.beginPath();
    c.moveTo(Math.cos(a) * r * (big ? 0.62 : 0.68), Math.sin(a) * r * (big ? 0.62 : 0.68));
    c.lineTo(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76);
    c.stroke();
  }
  const hand = (turn: number, len: number, w: number, col: string, tail = 0) => {
    const a = turn * TAU - TAU / 4;
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(-Math.cos(a) * tail, -Math.sin(a) * tail);
    c.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    c.stroke();
  };
  hand(h / 12, r * 0.42, r * 0.085, hands);
  hand(m / 60, r * 0.64, r * 0.06, hands);
  hand(s / 60, r * 0.7, r * 0.028, o.second ?? C.red, r * 0.16);
  c.beginPath();
  c.arc(0, 0, r * 0.06, 0, TAU);
  c.fillStyle = o.second ?? C.red;
  c.fill();
  c.restore();
}
