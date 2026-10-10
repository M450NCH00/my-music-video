// VERSE 2, the sets — where verse2.ts stages a windy winter afternoon at school:
//   the corridor the chorus leaves by, from the side again, in winter: frost at the edges of its windows, the yard
//     outside under a little snow, the notice board, a pale light on the floor
//   her coat pocket, close up, the end of his scarf in it
//   the stairs from their foot, everybody on the way down; and the way out of the school as it gets dark
//   what is said and thought there: speech and thought bubbles, and doodles drawn stroke by stroke (in ink, in chalk)
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { clamp, ease, hash, lerp, mulberry32, smoothstep, TAU } from '../engine/util';
import {
  CHORUS1_FROST, VERSE2_LAMPS, camera, drawStudent, dustMotes, frost, glow, layer, lightShaft, paperScraps, scratch, snow,
  type Cam, type Ctx, type Shaft, type V2,
} from './_love';
import { FLOOR, bare, seen } from './chorus-sets';

// (the kit's own blends, _love-rig.ts and _love-props.ts: her coat, the scarf, wood)
const BEIGE = mix(mix('paper', 'gold', 0.4), 'ink', 0.08), BEIGE_LOW = mix(mix('paper', 'peach', 0.5), 'ink', 0.18);
const ROSE = rgba('rose'), ROSE_LOW = mix('rose', 'ink', 0.16);
const WOOD = mix(mix('paper', 'peach', 0.55), 'ink', 0.1), WOOD_LOW = mix(mix('paper', 'peach', 0.7), 'ink', 0.3);
const METAL = mix('frost', 'navy', 0.35), TRIM = CHORUS1_FROST.trim;
/** A colour in winter light: part of the way to frost. */
const cool = (col: string, k = 0.5) => mix(col, 'frost', k);
// (the corridor's colours are the chorus's, in that light)
const WALL = cool(mix(mix('paper', 'peach', 0.3), 'ink', 0.06)), WALL_LOW = cool(mix(mix('paper', 'peach', 0.48), 'ink', 0.13));
const DADO = cool(mix(mix('sky', 'paper', 0.35), 'ink', 0.08), 0.3), DADO_LOW = cool(mix(mix('sky', 'paper', 0.2), 'navy', 0.14), 0.3);
const BOARDS = cool(mix(mix('paper', 'peach', 0.45), 'ink', 0.07)), BOARDS_LOW = cool(mix(mix('paper', 'peach', 0.66), 'ink', 0.2));
/** The light of a winter afternoon, and the colour of the evening that comes after it. */
const PALE = mix('paper', 'frost', 0.35), EVENING = mix('dusk', 'navy', 0.3);
const fillV = (c: Ctx, y0: number, y1: number, top: string, low: string) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, low); c.fillStyle = g; };
const poly = (c: Ctx, pts: V2[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

/** The camera that shows the point `at` of a picture at `to` on screen (default: its middle), `zoom` times its size. */
export const aim = (zoom: number, at: V2, to: V2 = [W / 2, H / 2]): Cam => ({ zoom, x: at[0] - W / 2 - (to[0] - W / 2) / zoom, y: at[1] - H / 2 - (to[1] - H / 2) / zoom });

// ------------------------------------------------------------------ the corridor in winter
/**
 * The corridor's windows here are wide, a cross of bars through the middle of each (the sill is where the chorus
 * has it): the glass of one, its head, and how far it is from one window to the next.
 */
const GLASS = { w: 640, h: 360 }, SILL = FLOOR - 255, HEAD = SILL - GLASS.h, PITCH = 800, BAR = (CHORUS1_FROST.bar * GLASS.w) / CHORUS1_FROST.w;
/** The glass of window n. 0 is the one the part starts on; between -1 and 0 the wall is wider, and the notice board hangs there. */
export const glass = (n: number) => ({ x: n * PITCH - (n < 0 ? 520 : 0), y: HEAD, w: GLASS.w, h: GLASS.h });
/** The camera that has window 0's glass where chorus 1 left her bedroom window's: over the whole frame (CHORUS1_FROST). */
export const ON_GLASS = aim(CHORUS1_FROST.w / GLASS.w, [GLASS.w / 2, HEAD + GLASS.h / 2]);
/** The frost that stays at the edges of every pane (the kit's frost: 1 = all over the glass). */
export const REST = 0.24;

let rest: HTMLCanvasElement | null = null;
/** That frost on a pane, painted once (the kit's frost is costly to paint afresh on every window, every frame). */
function restFrost() {
  if (rest) return rest;
  // (twice the picture's resolution: the two of them are seen in front of it from close by)
  const k = 2 * SCALE, cv = (rest = document.createElement('canvas'));
  cv.width = GLASS.w * k; cv.height = GLASS.h * k;
  frost(scaleContext2D(cv.getContext('2d')!, k), { x: 0, y: 0, w: GLASS.w, h: GLASS.h }, REST, CHORUS1_FROST);
  return cv;
}

/** What is outside the corridor's windows, too far off to be seen moving (a layer `depth` away, kept): the yard under snow, the school's other wing across it, bare trees. */
const FAR = { x: -340, y: 180, w: 2560, h: 660, res: 0.6, depth: 0.3 };
let far: HTMLCanvasElement | null = null;
function farYard() {
  if (far) return far;
  const k = SCALE * FAR.res, cv = (far = document.createElement('canvas')), x0 = FAR.x, x1 = FAR.x + FAR.w, base = 640;
  cv.width = Math.round(FAR.w * k); cv.height = Math.round(FAR.h * k);
  const c = scaleContext2D(cv.getContext('2d')!, k), wall = cool(mix('paper', 'peach', 0.34));
  c.translate(-FAR.x, -FAR.y);
  c.fillStyle = mix('paper', 'frost', 0.4); c.fillRect(x0, base, FAR.w, 220);
  fillV(c, 410, base, wall, mix(wall, 'navy', 0.08)); c.fillRect(x0, 410, FAR.w, base - 410);
  c.fillStyle = rgba('paper'); c.fillRect(x0, 396, FAR.w, 18);                                   // the snow along its roof
  c.fillStyle = mix(wall, 'navy', 0.16); c.fillRect(x0, 414, FAR.w, 6);
  for (let j = 0; j < 2; j++) for (let x = x0 + 30; x < x1; x += 92) {
    c.fillStyle = mix('sky', 'navy', 0.22, 0.7); c.fillRect(x, 446 + j * 92, 56, 52);
    c.fillStyle = rgba('paper', 0.6); c.fillRect(x + 26, 446 + j * 92, 4, 52); c.fillRect(x - 3, 498 + j * 92, 62, 5);
  }
  c.strokeStyle = cool(mix('ink', 'peach', 0.25), 0.4); c.lineCap = 'round';
  for (let i = 0, x = x0 + 120; x < x1; i++, x += 300 + 180 * hash(i, 41)) bare(c, x, base + 30, 150 + 50 * hash(i, 42), (hash(i, 43) - 0.5) * 0.16, 13, 50 + i);
  // (far off: the air's colour over all of it)
  c.globalCompositeOperation = 'source-atop'; c.fillStyle = mix('paper', 'frost', 0.5, 0.3); c.fillRect(x0, FAR.y, FAR.w, FAR.h);
  return cv;
}

/** The notice board, on the wall between two windows. */
const BOARD = { x: -566, y: 318, w: 452, h: 306 };
/** The notices on it: where (from the board's corner), their size, their paper and what heads them, and whether one pin holds them or two. */
const NOTICES: { x: number; y: number; w: number; h: number; paper: string; head: string; pins: 1 | 2 }[] = [
  { x: 22, y: 20, w: 122, h: 158, paper: rgba('paper'), head: mix('sky', 'navy', 0.2), pins: 2 },
  { x: 166, y: 30, w: 104, h: 128, paper: mix('paper', 'blush', 0.45), head: mix('blush', 'rose', 0.25), pins: 1 },
  { x: 292, y: 18, w: 136, h: 104, paper: mix('paper', 'sky', 0.3), head: mix('dusk', 'navy', 0.2), pins: 2 },
  { x: 40, y: 196, w: 150, h: 92, paper: mix('paper', 'frost', 0.4), head: mix('frost', 'navy', 0.35), pins: 2 },
  { x: 214, y: 178, w: 96, h: 112, paper: rgba('paper'), head: mix('dusk', 'paper', 0.2), pins: 1 },
  { x: 330, y: 146, w: 100, h: 138, paper: mix('paper', 'dusk', 0.22), head: mix('sky', 'navy', 0.3), pins: 1 },
];
/** A notice pinned by its top edge: the wind gets under its foot and lifts it, one corner more than the other. */
function notice(c: Ctx, x: number, y: number, n: (typeof NOTICES)[number], t: number, wind: number, i: number) {
  const r = (k: number) => hash(i, 19, k), gust = wind * (0.55 + 0.45 * Math.sin(t * (5.3 + 2.1 * r(1)) + i * 2.3)), flick = Math.sin(t * (10.5 + 3 * r(2)) + i * 1.7);
  const reach = n.h * 0.36 * gust * (n.pins === 1 ? 1.3 : 1), lift = Math.abs(reach) * 0.6, swing = n.pins === 1 ? 0.05 * gust * n.h : 0;
  const tl: V2 = [x, y], tr: V2 = [x + n.w, y];
  const bl: V2 = [x + reach * (0.85 + 0.15 * flick) + swing, y + n.h - lift * (0.75 + 0.25 * flick)], br: V2 = [x + n.w + reach * (1 - 0.18 * flick) + swing, y + n.h - lift * (0.9 + 0.18 * flick)];
  // (its sides stay against the board near the pins and curve away below them)
  const side = (a: V2, b: V2, v: number): V2 => { const cy = lerp(a[1], b[1], 0.6), w = 1 - v; return [w * w * a[0] + 2 * w * v * a[0] + v * v * b[0], w * w * a[1] + 2 * w * v * cy + v * v * b[1]]; };
  const across = (v: number, a: number, b: number): [V2, V2] => { const L = side(tl, bl, v), R = side(tr, br, v); return [[lerp(L[0], R[0], a), lerp(L[1], R[1], a)], [lerp(L[0], R[0], b), lerp(L[1], R[1], b)]]; };
  const sheet = new Path2D();
  sheet.moveTo(tl[0], tl[1]); sheet.lineTo(tr[0], tr[1]); sheet.quadraticCurveTo(tr[0], lerp(tr[1], br[1], 0.6), br[0], br[1]);
  sheet.lineTo(bl[0], bl[1]); sheet.quadraticCurveTo(tl[0], lerp(tl[1], bl[1], 0.6), tl[0], tl[1]); sheet.closePath();
  c.save(); c.translate(5 - reach * 0.12, 6); c.fillStyle = rgba('ink', 0.12); c.fill(sheet); c.restore();
  c.fillStyle = n.paper; c.fill(sheet);
  // what heads it, its lines; its foot, turned up, in its own shade
  const [h0, h1] = across(0.12, 0.12, 0.88), [h2, h3] = across(0.26, 0.12, 0.88);
  c.fillStyle = n.head; poly(c, [h0, h1, h3, h2]); c.fill();
  c.strokeStyle = rgba('ink', 0.2); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
  for (let j = 0; j < 4; j++) { const [a, b] = across(0.42 + j * 0.13, 0.12, j === 3 ? 0.55 : 0.88); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
  c.stroke();
  c.fillStyle = rgba('ink', 0.06 * Math.min(1, Math.abs(gust))); poly(c, [side(tl, bl, 0.7), side(tr, br, 0.7), br, bl]); c.fill();
  c.fillStyle = mix('navy', 'sky', 0.35);
  for (const px of n.pins === 2 ? [x + 9, x + n.w - 9] : [x + n.w / 2]) { c.beginPath(); c.arc(px, y + 8, 4.5, 0, TAU); c.fill(); }
}
function board(c: Ctx, t: number, wind: number) {
  const { x, y, w, h } = BOARD, cork = cool(mix('peach', 'ink', 0.22), 0.3);
  c.fillStyle = rgba('ink', 0.1); c.fillRect(x - 8, y - 4, w + 26, h + 28);
  fillV(c, y - 14, y + h + 14, cool(WOOD, 0.25), cool(WOOD_LOW, 0.25)); c.beginPath(); c.roundRect(x - 14, y - 14, w + 28, h + 28, 6); c.fill();
  fillV(c, y, y + h, cork, mix(cork, 'ink', 0.1)); c.fillRect(x, y, w, h);
  NOTICES.forEach((n, i) => notice(c, x + n.x, y + n.y, n, t, wind, i));
}

export interface CorridorOpts {
  t: number; cam: Cam;
  /** The frost on the glass the part starts on: 1 = all over it (CHORUS1_FROST) .. REST = what stays, as on every window. */
  frost: number;
  /** How hard it blows along the corridor (the kit's wind, and beyond its -1..1: to the left if negative): the notices, the snow outside, the dust. */
  wind: number;
  /** 0..1: the light through the windows (none of it on the frame chorus 1 ends on). */
  lit: number;
  /** Paints who is in the corridor, under the camera; with `flat`, as flat shapes of that colour (the windows' light is kept off them). */
  who?: (c: Ctx, flat?: string) => void;
}
/**
 * The corridor in winter under a camera. `c`: the picture (the whole frame is painted); `g`: the light layer (the
 * windows, their pale shafts and the dust in them).
 */
export function drawCorridor(c: Ctx, g: Ctx, o: CorridorOpts) {
  const { t, cam } = o, z = cam.zoom ?? 1, mid = W / 2 + (cam.x ?? 0), x0 = mid - W / 2 / z - 40, x1 = mid + W / 2 / z + 40;
  const wins = [-2, -1, 0, 1, 2, 3].filter((n) => glass(n).x + GLASS.w > x0 && glass(n).x < x1);
  // outside: the sky, the yard far off, the snow the wind drives past (all of it under the wall, but for the glass)
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, mix('frost', 'sky', 0.35)); sky.addColorStop(0.6, mix('frost', 'paper', 0.45)); sky.addColorStop(1, mix('paper', 'frost', 0.2));
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  c.save(); camera(c, cam, FAR.depth); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(farYard(), FAR.x, FAR.y, FAR.w, FAR.h); c.restore();
  snow(c, t, { count: 46, wind: o.wind * 0.9, alpha: 0.75, size: 0.9, seed: 23 });
  c.save(); camera(c, cam, 1);
  // the glass: the day on it, the frost at its edges
  for (const n of wins) {
    const r = glass(n), sheen = c.createLinearGradient(r.x, r.y + r.h, r.x + r.w * 0.7, r.y);
    sheen.addColorStop(0.2, rgba('paper', 0)); sheen.addColorStop(0.45, rgba('paper', 0.2)); sheen.addColorStop(0.55, rgba('paper', 0.04)); sheen.addColorStop(0.7, rgba('paper', 0.12)); sheen.addColorStop(0.9, rgba('paper', 0));
    c.fillStyle = sheen; c.fillRect(r.x, r.y, r.w, r.h);
    if (n === 0 && o.frost > REST + 0.004) frost(c, r, o.frost, CHORUS1_FROST);
    else { c.save(); c.translate(n % 2 ? r.x + r.w : r.x, r.y); c.scale(n % 2 ? -1 : 1, 1); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(restFrost(), 0, 0, r.w, r.h); c.restore(); }
  }
  // the wall round the windows, in its own shade (the light is behind it); the dado under them
  const wall = new Path2D();
  wall.rect(x0, HEAD - 1400, x1 - x0, 1400 + GLASS.h);
  for (const n of wins) { const r = glass(n); wall.rect(r.x, r.y, r.w, r.h); }
  fillV(c, HEAD - 320, SILL, WALL, WALL_LOW); c.fill(wall, 'evenodd');
  c.fillStyle = rgba('ink', 0.06); c.fillRect(x0, HEAD - 14, x1 - x0, 14);
  fillV(c, SILL, FLOOR, DADO, DADO_LOW); c.fillRect(x0, SILL, x1 - x0, FLOOR - SILL);
  for (const n of wins) {
    const r = glass(n);
    c.strokeStyle = TRIM; c.lineWidth = 12; c.strokeRect(r.x, r.y, r.w, r.h);
    c.fillStyle = TRIM; c.fillRect(r.x + (r.w - BAR) / 2, r.y, BAR, r.h); c.fillRect(r.x, r.y + (r.h - BAR) / 2, r.w, BAR);
    c.fillRect(r.x - 18, SILL - 4, r.w + 36, 15);
    c.fillStyle = rgba('ink', 0.1); c.fillRect(r.x - 18, SILL + 11, r.w + 36, 6);
  }
  // the floor, and the day lying across it
  fillV(c, FLOOR, FLOOR + 175, BOARDS, BOARDS_LOW); c.fillRect(x0, FLOOR, x1 - x0, 1200);
  for (const n of wins) {
    const a = glass(n).x, day = c.createLinearGradient(0, FLOOR, 0, FLOOR + 175);
    day.addColorStop(0, rgba(PALE, 0.5 * o.lit)); day.addColorStop(1, rgba(PALE, 0.1 * o.lit));
    c.fillStyle = day; poly(c, [[a, FLOOR], [a + GLASS.w, FLOOR], [a + GLASS.w - 230, FLOOR + 175], [a - 230, FLOOR + 175]]); c.fill();
  }
  c.fillStyle = mix(DADO, 'ink', 0.2); c.fillRect(x0, FLOOR - 14, x1 - x0, 14);
  if (x0 < BOARD.x + BOARD.w + 40 && x1 > BOARD.x - 40) board(c, t, o.wind);
  o.who?.(c);
  c.restore();
  // the light: each window, the shaft it throws (not from as close as the part starts: it would be all there is), the dust
  const shafts: Shaft[] = [], thrown = o.lit * smoothstep(2.6, 1.7, z);
  for (const n of wins) {
    const r = glass(n), [x, y] = seen(cam, [r.x + r.w / 2, HEAD + 60]), [gx, gy] = seen(cam, [r.x, r.y]);
    const shaft: Shaft = { x, y, angle: -0.5, length: 780 * z, width: 540 * z, spread: 1.12 };
    if (thrown > 0.01) { lightShaft(c, shaft, { color: PALE, alpha: 0.09 * thrown, t }); lightShaft(g, shaft, { color: PALE, alpha: 0.02 * thrown, t }); shafts.push(shaft); }
    g.fillStyle = rgba(PALE, 0.05 * o.lit); g.fillRect(gx, gy, r.w * z, r.h * z);
  }
  if (o.who) { g.save(); g.globalCompositeOperation = 'destination-out'; camera(g, cam, 1); o.who(g, rgba('ink')); g.restore(); }
  if (shafts.length) dustMotes(g, t, { shafts, count: 46, seed: 61, wind: o.wind * 2.5, color: PALE, alpha: thrown });
}

/**
 * The end of his scarf, looking out of her coat pocket: `at` is the kit's `pocket` of her figure, `s` its scale.
 * It hangs there, and the wind takes it (`wind` as the kit's: to the left if negative).
 */
export function drawScarfEnd(c: Ctx, at: V2, s: number, t: number, wind = 0) {
  const [x, y] = at, w = 8.5 * s, l = 42 * s, blow = Math.min(1, Math.abs(wind)), sw = wind * (0.72 + 0.28 * Math.sin(t * 6.3)) * 22 * s, n = 6;
  const mid = (u: number): V2 => [x + sw * u * u + 1.5 * s * u * blow * Math.sin(u * 5 - t * 7), y + l * u * (1 - 0.18 * blow * u)];
  // the pocket's mouth, then what hangs out of it: knitted, with a fringe
  c.save();
  c.strokeStyle = rgba('ink', 0.26); c.lineWidth = Math.max(1.5, 1.6 * s); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 12 * s, y - 1.5 * s); c.lineTo(x + 12 * s, y + s); c.stroke();
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) { const [mx, my] = mid(i / n); pts.push([mx - w, my]); }
  for (let i = n; i >= 0; i--) { const [mx, my] = mid(i / n); pts.push([mx + w, my]); }
  fillV(c, y, y + l, ROSE, ROSE_LOW); poly(c, pts); c.fill();
  c.strokeStyle = rgba('paper', 0.3); c.lineWidth = Math.max(1, 1.5 * Math.sqrt(s)); c.beginPath();
  for (let i = 1; i < n; i++) { const [mx, my] = mid(i / n); c.moveTo(mx - w * 0.6, my); c.lineTo(mx + w * 0.6, my); }
  const [ex, ey] = mid(1);
  for (let i = 0; i < 4; i++) { const fx = ex - w + (w * 2 * (i + 0.5)) / 4; c.moveTo(fx, ey); c.lineTo(fx + sw * 0.1, ey + 6 * s); }
  c.stroke();
  c.restore();
}

// ------------------------------------------------------------------ her coat pocket, close up
/** The end of the scarf as the close-up has it, in units of her figure: its length, half its width, half the pocket's mouth (a slit in the side of her coat) and the way that slants. */
const SCARF = { len: 122, half: 13, mouth: 27, slant: [0.6, -0.8] as V2 };
export interface PocketOpts {
  t: number; cam: Cam;
  /** How hard it blows (as in the corridor: to the left if negative). */
  wind: number;
  /** Paints her, under the camera, and says where her pocket and her hand are (the kit's `pocket` and `handR`) and how large she is. */
  her: (c: Ctx) => { pocket: V2; hand: V2; scale: number };
  /** The warmth under her hand, 0..1. */
  warm: number;
  /** Paints the line along the scarf: `at(v)` is a place beside it and the way it runs there, from v = 0 where the line starts to 1 where it ends. */
  along?: (c: Ctx, at: (v: number) => { x: number; y: number; angle: number }) => void;
}
/**
 * Her coat pocket from close by, the end of his scarf streaming out of it. `c`: the picture (the whole frame is
 * painted); `g`: the light layer (the warmth under her hand).
 */
export function drawPocket(c: Ctx, g: Ctx, o: PocketOpts) {
  const { t, cam } = o, dir = Math.sign(o.wind) || -1, blow = Math.min(1.2, Math.abs(o.wind));
  // the corridor behind her, out of focus, and the paper the wind carries through it
  layer(c, { cam, depth: 0.5, blur: 9 }, (x) => {
    fillV(x, 0, H, WALL, WALL_LOW); x.fillRect(-300, -300, W + 600, H + 600);
    for (const wx of [-260, 1500]) { x.fillStyle = mix('paper', 'frost', 0.3); x.fillRect(wx, 30, 700, 580); x.fillStyle = TRIM; x.fillRect(wx, 290, 700, 34); x.fillRect(wx + 330, 30, 34, 580); }
    fillV(x, 650, 1010, DADO, DADO_LOW); x.fillRect(-300, 650, W + 600, 360);
    fillV(x, 1010, 1300, BOARDS, BOARDS_LOW); x.fillRect(-300, 1010, W + 600, 400);
    paperScraps(x, t, { count: 7, wind: o.wind * 2.4, size: 2.4, seed: 71 });
  });
  c.save(); camera(c, cam, 1);
  const her = o.her(c), s = her.scale, half = SCARF.half * s, len = SCARF.len * s, slit = SCARF.slant, mouth = her.pocket, open: V2 = [-slit[1], slit[0]];
  const a: V2 = [mouth[0] + slit[0] * SCARF.mouth * s, mouth[1] + slit[1] * SCARF.mouth * s], b: V2 = [mouth[0] - slit[0] * SCARF.mouth * s, mouth[1] - slit[1] * SCARF.mouth * s];
  // the scarf's end: out of the pocket's mouth and away on the wind, a wave running along it
  const mid = (u: number): V2 => {
    const amp = 0.052 * len * u ** 1.3 * blow, ph = t * 9.5;
    return [mouth[0] + dir * len * u * (0.9 + 0.1 * blow), mouth[1] + 0.035 * len * u + (1.2 - blow) * 0.45 * len * u * u + amp * Math.sin(u * 7.2 - ph) + 0.4 * amp * Math.sin(u * 13 - ph * 1.7 + 1)];
  };
  /** Along the scarf at u: which way it runs, and which way is across it toward its upper edge (at the mouth: along the slit). */
  const frame = (u: number) => {
    const p = mid(u), [qx, qy] = mid(u + 0.012), [rx, ry] = mid(Math.max(0, u - 0.012)), l = Math.hypot(qx - rx, qy - ry) || 1, tx = (qx - rx) / l, ty = (qy - ry) / l;
    const e = smoothstep(0, 0.2, u), ux = lerp(slit[0], ty * dir, e), uy = lerp(slit[1], -tx * dir, e), ul = Math.hypot(ux, uy) || 1;
    return { p, tx, ty, ux: ux / ul, uy: uy / ul };
  };
  const N = 22, upper: V2[] = [], lower: V2[] = [];
  for (let i = 0; i <= N; i++) { const f = frame(i / N); upper.push([f.p[0] + f.ux * half, f.p[1] + f.uy * half]); lower.push([f.p[0] - f.ux * half, f.p[1] - f.uy * half]); }
  const band = [...upper, ...lower.slice().reverse()], ys = band.map((q) => q[1]);
  // (her hand stays on top of all this)
  c.save();
  const under = new Path2D();
  under.rect(-4000, -4000, 9000, 9000); under.arc(her.hand[0], her.hand[1], 11.2 * s, 0, TAU);
  c.clip(under, 'evenodd');
  // (the pocket's mouth, dark)
  c.fillStyle = mix('ink', 'navy', 0.25, 0.42);
  c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(mouth[0] - open[0] * 5 * s, mouth[1] - open[1] * 5 * s, b[0], b[1]); c.quadraticCurveTo(mouth[0] + open[0] * 1.5 * s, mouth[1] + open[1] * 1.5 * s, a[0], a[1]); c.fill();
  fillV(c, Math.min(...ys), Math.max(...ys), ROSE, ROSE_LOW); poly(c, band); c.fill();
  // (knitted: a rib across it every little way; and its fringe)
  c.strokeStyle = rgba('paper', 0.28); c.lineWidth = 0.75 * s; c.lineCap = 'round'; c.beginPath();
  for (let u = 0.07; u < 0.985; u += 0.043) { const f = frame(u); c.moveTo(f.p[0] + f.ux * half * 0.74, f.p[1] + f.uy * half * 0.74); c.lineTo(f.p[0] - f.ux * half * 0.74, f.p[1] - f.uy * half * 0.74); }
  c.stroke();
  const tip = frame(1);
  c.strokeStyle = ROSE_LOW; c.lineWidth = 1.1 * s; c.beginPath();
  for (let i = 0; i < 8; i++) {
    const v = (i + 0.5) / 8 - 0.5, fx = tip.p[0] + tip.ux * half * 2 * v, fy = tip.p[1] + tip.uy * half * 2 * v, fl = (6.5 + 1.7 * hash(i, 5)) * s, wag = 1.5 * s * Math.sin(t * 11 + i * 1.9);
    c.moveTo(fx, fy); c.lineTo(fx + tip.tx * fl + tip.ux * wag, fy + tip.ty * fl + tip.uy * wag);
  }
  c.stroke();
  // the pocket's lip, over where the scarf goes in
  c.strokeStyle = mix(BEIGE, BEIGE_LOW, 0.5); c.lineWidth = 3.4 * s;
  c.beginPath(); c.moveTo(a[0] + open[0] * 1.2 * s, a[1] + open[1] * 1.2 * s); c.lineTo(b[0] + open[0] * 1.2 * s, b[1] + open[1] * 1.2 * s); c.stroke();
  c.strokeStyle = rgba('ink', 0.16); c.lineWidth = 0.5 * s;
  c.beginPath(); c.moveTo(a[0] + open[0] * 3 * s, a[1] + open[1] * 3 * s); c.lineTo(b[0] + open[0] * 3 * s, b[1] + open[1] * 3 * s); c.stroke();
  c.restore();
  // the line, under the scarf and waving with it (it reads from left to right, whichever way the wind blows)
  o.along?.(c, (v) => {
    const u = dir < 0 ? lerp(0.955, 0.075, v) : lerp(0.075, 0.955, v), f = frame(u);
    return { x: f.p[0], y: f.p[1] + half + 15.5 * s, angle: Math.atan2(f.ty * dir, f.tx * dir) };
  });
  c.restore();
  // paper going by close to the lens
  layer(c, { blur: 6 }, (x) => { paperScraps(x, t, { count: 3, wind: o.wind * 3.1, size: 3.3, seed: 73, alpha: 0.9 }); });
  // and the scarf is warm under her hand: softly on the picture, and a little on the light layer (no bright heart: it is not a lamp)
  if (o.warm > 0.003) {
    const [wx, wy] = seen(cam, her.hand), z = cam.zoom ?? 1, beat = 0.86 + 0.14 * Math.sin(t * 2.6), warm = mix('gold', 'blush', 0.5);
    for (const [x, r, k] of [[c, 440, 0.4], [g, 330, 0.12]] as [Ctx, number, number][]) {
      const soft = x.createRadialGradient(wx, wy, 0, wx, wy, r * z);
      soft.addColorStop(0, rgba(warm, k * o.warm * beat)); soft.addColorStop(0.4, rgba(warm, 0.45 * k * o.warm * beat)); soft.addColorStop(1, rgba(warm, 0));
      x.fillStyle = soft; x.fillRect(wx - r * z, wy - r * z, 2 * r * z, 2 * r * z);
    }
  }
}

// ------------------------------------------------------------------ the stairs
/** The stairs from their foot: the picture's own line (y: who stands on it is full size), the height of a step there, how fast things get smaller up the stairs, half the stairs' width. */
const STAIR = { y: 950, rise: 58, a: 0.035, half: 590 };
/** How large what is `j` steps up the stairs from the picture's line looks, and how high on screen that step is. */
export const stairK = (j: number) => 1 / (1 + STAIR.a * Math.max(j, -12));
export const stairY = (j: number) => STAIR.y - (STAIR.rise * Math.log(1 + STAIR.a * Math.max(j, -12))) / STAIR.a;
/** Somebody on the stairs, `X` across them (-1 and 1: the walls) and `j` steps up from the picture's line: where their feet are, and their size. */
export const onStairs = (X: number, j: number) => ({ x: W / 2 + X * STAIR.half * stairK(j), y: stairY(j), k: stairK(j) });

/**
 * The stairwell, looking up the stairs from below. `ride`: how many steps the picture has gone down them (the steps
 * go up through it). `c`: the picture (the whole frame is painted); `g`: the light layer (the landing's window, above).
 */
export function drawStairs(c: Ctx, g: Ctx, o: { t: number; ride: number }) {
  const f = o.ride - Math.floor(o.ride), n0 = Math.floor(o.ride), riser = mix(mix('frost', 'paper', 0.3), 'navy', 0.07), tread = mix('paper', 'frost', 0.3);
  // the walls of the well, and the dado that goes up them with the stairs
  fillV(c, 0, H, WALL, WALL_LOW); c.fillRect(0, 0, W, H);
  const edge = (sg: number, lift: number, inset = 0): V2[] => Array.from({ length: 44 }, (_, i) => { const j = i - 11, k = stairK(j); return [W / 2 + sg * (STAIR.half - inset) * k, stairY(j) - lift * k] as V2; });
  for (const sg of [-1, 1]) { fillV(c, 0, H, mix(DADO, 'paper', 0.3), DADO_LOW); poly(c, [...edge(sg, -40), ...edge(sg, 300).reverse()]); c.fill(); }
  // the steps, far to near: of each the riser, and the tread going back from its edge (seen less and less the higher it is)
  for (let m = 32; m >= -6; m--) {
    const j = m + f, k0 = stairK(j), k1 = stairK(j + 1), y0 = stairY(j), y1 = stairY(j + 1), w0 = STAIR.half * k0, w1 = STAIR.half * k1;
    const yt = lerp(y0, y1, 1 - 0.3 * clamp(1 - j / 10)), away = 0.62 * clamp(j / 24);
    c.fillStyle = mix(riser, 'paper', away); c.fillRect(W / 2 - w0, yt, w0 * 2, y0 - yt + 1);
    c.fillStyle = mix(tread, 'paper', away); poly(c, [[W / 2 - w0, yt], [W / 2 + w0, yt], [W / 2 + w1, y1], [W / 2 - w1, y1]]); c.fill();
    c.fillStyle = rgba('ink', 0.05 * (1 - away)); c.fillRect(W / 2 - w0, yt, w0 * 2, 3 * k0);
  }
  // the rails, a post every third step
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const sg of [-1, 1]) {
    c.strokeStyle = METAL; c.beginPath();
    for (let m = 30; m >= -6; m--) if ((((n0 - m) % 3) + 3) % 3 === 0) { const j = m + f, k = stairK(j), x = W / 2 + sg * (STAIR.half - 26) * k; c.moveTo(x, stairY(j)); c.lineTo(x, stairY(j) - 214 * k); }
    c.lineWidth = 4.5; c.stroke();
    c.strokeStyle = TRIM; c.lineWidth = 10; c.beginPath(); edge(sg, 214, 26).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  }
  // the day comes down them from the landing's window
  const top = c.createRadialGradient(W / 2, -60, 0, W / 2, -60, 1000);
  top.addColorStop(0, rgba('paper', 0.96)); top.addColorStop(0.42, rgba('paper', 0.5)); top.addColorStop(1, rgba('paper', 0));
  c.fillStyle = top; c.fillRect(0, 0, W, H);
  lightShaft(c, { x: W / 2, y: -80, angle: 0, length: 1100, width: 560, spread: 2.1 }, { color: PALE, alpha: 0.14, t: o.t });
  glow(g, W / 2, -110, 760, { color: PALE, alpha: 0.5 });
}

/**
 * One of the crowd on the stairs: a walker facing us, in one flat colour. Each of its steps is painted once and kept
 * (a figure of the kit a frame is far too slow for a crowd), at half the picture's resolution: they are only ever
 * seen out of focus.
 */
const WALKER = { w: 280, h: 720, foot: 26, steps: 8, res: 0.5 }, CROWD = mix('frost', 'navy', 0.22);
const walkers = new Map<number, HTMLCanvasElement>();
function walker(boy: boolean, step: number) {
  const key = (boy ? WALKER.steps : 0) + step;
  let cv = walkers.get(key);
  if (!cv) {
    walkers.set(key, (cv = document.createElement('canvas')));
    cv.width = WALKER.w * SCALE * WALKER.res; cv.height = WALKER.h * SCALE * WALKER.res;
    drawStudent(scaleContext2D(cv.getContext('2d')!, SCALE * WALKER.res), 'walk', { x: WALKER.w / 2, y: WALKER.h - WALKER.foot, facing: 0, walk: step / WALKER.steps, t: step * 0.7, boy, silhouette: CROWD });
  }
  return cv;
}
export interface Walker {
  /** Where its feet are, and its size. */
  x: number; y: number; k: number;
  boy: boolean;
  /** Where in its stride (cycles of two steps); 0..1 how much of it is there; and how long the blur behind it is, px (it is going down). */
  walk: number; alpha: number; streak: number;
}
export function drawWalker(c: Ctx, w: Walker) {
  if (w.alpha <= 0.003) return;
  const step = ((Math.floor(w.walk * WALKER.steps) % WALKER.steps) + WALKER.steps) % WALKER.steps, cv = walker(w.boy, step);
  const sw = WALKER.w * w.k, sh = WALKER.h * w.k, x = w.x - sw / 2, y = w.y - (WALKER.h - WALKER.foot) * w.k, fast = w.streak > 2;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low';
  if (fast) for (const [up, a] of [[0.85, 0.12], [0.45, 0.24]]) { c.globalAlpha = w.alpha * a!; c.drawImage(cv, x, y - w.streak * up!, sw, sh); }
  c.globalAlpha = w.alpha * (fast ? 0.74 : 1); c.drawImage(cv, x, y, sw, sh);
  c.globalAlpha = 1;
}

// ------------------------------------------------------------------ out of the school, as it gets dark
/** The sky as they come out, top to bottom (it goes on into VERSE2_LAMPS's); the school behind them, far off (a layer `depth` away, kept), the foot of its wall. */
const SKY_OUT = [mix('navy', 'dusk', 0.62), mix('dusk', 'frost', 0.2), mix('frost', 'blush', 0.5)];
const SCHOOL = { x: -700, y: 120, w: 3320, h: 860, res: 0.5, depth: 0.4, base: 660 }, SNOW = mix('frost', 'dusk', 0.42);
let school: HTMLCanvasElement | null = null;
function schoolFront() {
  if (school) return school;
  const k = SCALE * SCHOOL.res, cv = (school = document.createElement('canvas')), base = SCHOOL.base;
  cv.width = Math.round(SCHOOL.w * k); cv.height = Math.round(SCHOOL.h * k);
  const c = scaleContext2D(cv.getContext('2d')!, k), wall = cool(mix('paper', 'peach', 0.34)), glassy = mix('sky', 'navy', 0.42, 0.75);
  c.translate(-SCHOOL.x, -SCHOOL.y);
  c.fillStyle = SNOW; c.fillRect(SCHOOL.x, base, SCHOOL.w, 400);
  // its two wings and the block over the door, snow along the roofs; its grid of windows; the door they came out of
  for (const [x, top, w] of [[300, 372, 1320], [800, 330, 320]]) {
    fillV(c, top, base, wall, mix(wall, 'navy', 0.1)); c.fillRect(x!, top!, w!, base - top!);
    c.fillStyle = rgba('paper'); c.fillRect(x! - 8, top! - 14, w! + 16, 18);
    c.fillStyle = mix(wall, 'navy', 0.18); c.fillRect(x! - 8, top! + 4, w! + 16, 6);
  }
  for (let j = 0; j < 3; j++) for (let x = 326; x + 46 < 1620; x += 78) {
    if (j === 2 && x > 860 && x < 1020) continue;
    c.fillStyle = glassy; c.fillRect(x, 404 + j * 78, 46, 48);
    c.fillStyle = rgba('paper', 0.55); c.fillRect(x + 21, 404 + j * 78, 4, 48);
  }
  c.fillStyle = mix('navy', 'dusk', 0.3); c.fillRect(905, 562, 110, base - 562);
  c.fillStyle = rgba('paper', 0.5); c.fillRect(958, 562, 4, base - 562);
  c.fillStyle = TRIM; c.fillRect(880, 548, 160, 14); c.fillRect(884, base, 152, 8); c.fillRect(868, base + 8, 184, 9);
  c.strokeStyle = cool(mix('ink', 'peach', 0.25), 0.3); c.lineCap = 'round';
  for (const [x, len] of [[-420, 250], [-150, 290], [110, 240], [236, 200], [1690, 210], [1820, 250], [2080, 290], [2360, 250]]) bare(c, x!, base + 36, len!, (hash(x!, 3) - 0.5) * 0.14, 16, 90 + x!);
  c.globalCompositeOperation = 'source-atop'; c.fillStyle = mix('dusk', 'navy', 0.18, 0.46); c.fillRect(SCHOOL.x, SCHOOL.y, SCHOOL.w, SCHOOL.h);
  return cv;
}
export interface YardOpts {
  t: number; cam: Cam;
  /** 0 = as they come out of the door .. 1 = the blue hour (the sky of VERSE2_LAMPS). */
  late: number;
  /** 0..1: how much of the place is there (it goes, at the end: the sky alone is left). */
  there: number;
}
/** The way out of the school, the two of them coming toward us along it: the sky, the school behind, the ground. All of it on the picture. */
export function drawYard(c: Ctx, o: YardOpts) {
  const sky = c.createLinearGradient(0, 0, 0, H);
  [0, 0.55, 1].forEach((at, i) => sky.addColorStop(at, mix(SKY_OUT[i]!, VERSE2_LAMPS.sky[i]!, o.late)));
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  if (o.there <= 0.003) return;
  // (the place, on a canvas of its own while it goes)
  const s = o.there >= 1 ? null : scratch('yard'), x = s ? s.c : c;
  x.save(); camera(x, o.cam, SCHOOL.depth); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(schoolFront(), SCHOOL.x, SCHOOL.y, SCHOOL.w, SCHOOL.h); x.restore();
  x.save(); camera(x, o.cam, 1);
  fillV(x, 690, 1100, SNOW, mix('frost', 'dusk', 0.22)); x.fillRect(-2000, 690, W + 4000, 2000);
  x.fillStyle = mix('paper', 'frost', 0.5, 0.42); poly(x, [[900, 690], [1020, 690], [1700, 1500], [220, 1500]]); x.fill();
  x.restore();
  if (s) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = o.there; c.drawImage(s.cv, 0, 0, W, H); c.restore(); }
}
/** The colour the evening lays over the two of them out there (for the kit's layer(): haze). */
export const DUSK = EVENING;

// ------------------------------------------------------------------ what is said, thought and drawn in the air
export interface BubbleOpts {
  /** The middle of the sheet, and its size. */
  x: number; y: number; w: number; h: number;
  /** Whom it comes from: its tail points there, and it grows out of there. */
  to: V2;
  /** 0..1: how far it has popped open. */
  k: number;
  alpha?: number;
  /** A thought, not something said: a cloud, and small ones leading up to it. */
  think?: boolean;
}
/** A speech bubble (our own: a rounded sheet of paper with a tail) or a thought bubble. What is in it is the scene's to draw. */
export function drawBubble(c: Ctx, o: BubbleOpts) {
  const a = clamp(o.k * 3) * (o.alpha ?? 1);
  if (a <= 0.003) return;
  const { x, y, w, h, to } = o, s = ease.outBack(clamp(o.k)), dx = to[0] - x, dy = to[1] - y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  // (where the way to `to` leaves the sheet)
  const e = 1 / Math.max(Math.abs(dx) / (w / 2), Math.abs(dy) / (h / 2), 1e-3), ex = x + dx * e, ey = y + dy * e;
  const parts: Path2D[] = [new Path2D()], sheet = parts[0]!;
  if (o.think) {
    sheet.ellipse(x, y, w * 0.42, h * 0.36, 0, 0, TAU);
    for (let i = 0; i < 11; i++) { const an = (i / 11) * TAU, r = h * (0.2 + 0.05 * hash(i, 3)), px = x + Math.cos(an) * w * 0.4, py = y + Math.sin(an) * h * 0.33; sheet.moveTo(px + r, py); sheet.arc(px, py, r, 0, TAU); }
    for (const [u, r] of [[0.2, 15], [0.5, 10.5], [0.76, 7]]) { const p = new Path2D(); p.arc(lerp(ex, to[0], u!), lerp(ey, to[1], u!), r!, 0, TAU); parts.push(p); }
  } else {
    sheet.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.38);
    const tail = new Path2D(), bx = ex - (dx / len) * 26, by = ey - (dy / len) * 26, tx = lerp(ex, to[0], 0.58), ty = lerp(ey, to[1], 0.58), mx = lerp(ex, tx, 0.5), my = lerp(ey, ty, 0.5);
    tail.moveTo(bx + nx * 26, by + ny * 26); tail.quadraticCurveTo(mx + nx * 6, my + ny * 6, tx, ty); tail.quadraticCurveTo(mx - nx * 4, my - ny * 4, bx - nx * 26, by - ny * 26); tail.closePath();
    parts.push(tail);
  }
  c.save();
  c.translate(to[0], to[1]); c.scale(s, s); c.translate(-to[0], -to[1]); c.globalAlpha *= a;
  c.save(); c.translate(5, 12); c.fillStyle = rgba('ink', 0.09); for (const p of parts) c.fill(p); c.restore();
  // (a soft edge: the inner half of the line is under the paper)
  c.strokeStyle = rgba('ink', 0.2); c.lineWidth = 4; c.lineJoin = 'round'; for (const p of parts) c.stroke(p);
  c.fillStyle = rgba('paper'); for (const p of parts) c.fill(p);
  c.restore();
}

/** Points round a circle (or part of one), for the strokes of a doodle. */
export const ring = (x: number, y: number, r: number, n = 12, a0 = -Math.PI / 2, a1 = a0 + TAU): V2[] => Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n); return [x + r * Math.cos(a), y + r * Math.sin(a)] as V2; });
/**
 * A doodle: `strokes` (each a run of points, in units of `size` round (x, y)) drawn one after the other by an
 * unsteady hand, `k` (0..1) of the whole of it so far. `boil`: a number that redraws it a little differently each
 * time it changes (a line that is alive).
 */
export function sketch(c: Ctx, strokes: V2[][], x: number, y: number, size: number, k = 1, o: { color?: string; width?: number; seed?: number; boil?: number } = {}) {
  const total = strokes.reduce((n, s) => n + s.length - 1, 0), seed = o.seed ?? 1, boil = o.boil ?? 0;
  let left = clamp(k) * total;
  if (left <= 0) return;
  c.save();
  c.strokeStyle = o.color ?? rgba('ink', 0.78); c.lineWidth = o.width ?? Math.max(1.5, size * 0.05); c.lineCap = 'round'; c.lineJoin = 'round';
  strokes.forEach((pts, i) => {
    if (left <= 0) return;
    const reach = Math.min(left, pts.length - 1), at = (j: number): V2 => [x + (pts[j]![0] + (hash(i, j, seed, boil) - 0.5) * 0.045) * size, y + (pts[j]![1] + (hash(i, j, seed + 1, boil) - 0.5) * 0.045) * size];
    c.beginPath();
    for (let j = 0; j <= Math.ceil(reach); j++) {
      const p = at(Math.min(j, pts.length - 1));
      if (!j) c.moveTo(p[0], p[1]);
      else if (j <= reach) c.lineTo(p[0], p[1]);
      else { const q = at(j - 1), u = reach - (j - 1); c.lineTo(lerp(q[0], p[0], u), lerp(q[1], p[1], u)); }
    }
    c.stroke();
    left -= pts.length - 1;
  });
  c.restore();
}

let gaps: HTMLCanvasElement | null = null;
/** What chalk leaves out: specks and short scratches, as a repeating tile (as the kit's chalk lettering has them). */
function chalkGaps() {
  if (gaps) return gaps;
  const n = 128, cv = (gaps = document.createElement('canvas')), c = cv.getContext('2d')!, rnd = mulberry32(89);
  cv.width = cv.height = n;
  c.fillStyle = rgba('ink');
  for (let i = 0; i < 1500; i++) { c.globalAlpha = 0.3 + rnd() * 0.7; c.beginPath(); c.arc(rnd() * n, rnd() * n, 0.35 + rnd() * 1.1, 0, TAU); c.fill(); }
  c.strokeStyle = rgba('ink'); c.lineCap = 'round';
  for (let i = 0; i < 90; i++) { const x = rnd() * n, y = rnd() * n, a = -0.6 + rnd() * 0.5, l = 3 + rnd() * 9; c.globalAlpha = 0.25 + rnd() * 0.4; c.lineWidth = 0.5 + rnd() * 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  return cv;
}
/** Paint what `draw` paints in chalk: it loses the grain that chalk leaves out. */
export function chalked(c: Ctx, draw: (c: Ctx) => void) {
  const s = scratch('doodle'), d = s.c, p = d.createPattern(chalkGaps(), 'repeat');
  d.save(); draw(d); d.restore();
  if (p) { d.globalCompositeOperation = 'destination-out'; d.fillStyle = p; d.fillRect(0, 0, W, H); d.globalCompositeOperation = 'source-over'; }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(s.cv, 0, 0, W, H); c.restore();
}
