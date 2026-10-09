// VERSE 1, the sets — where the eight lines are staged (verse1.ts):
//   the classroom after the bell: the intro's room (intro-classroom.ts) under a camera of its own, its board wiped,
//     its desks empty, the class on its way out, and the door to the corridor in the wall the intro never showed
//   her desk as she sees it, across the bottom of the frame
//   her window from the aisle, and the basketball court outside it
//   the back wall, behind her and her textbook
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, hash, lerp, mod, TAU } from '../engine/util';
import { atDesk, camera, drawClock, drawStudent, dustMotes, glow, layer, lightShaft, paperGrain, scratch, type Cam, type Ctx, type Shaft, type V2 } from './_love';
import { AIR, BOARD_AT, CEIL, CLOCK_AT, CLOCK_R, COLS, DADO, DADO_LOW, EYE, FAR, FOC, HEAD, LEFT, P3, RIGHT, ROWS, SILL, TRIM, VP, WALL, WALL_LOW, WINDOWS, poly, seatAt, shell } from './intro-classroom';
import { DOODLE_UNFINISHED, drawDoodle } from './intro-desk';

// (the kit's own blends, _love-rig.ts and _love-props.ts: her hands, her desk)
const SKIN = mix('paper', 'peach', 0.4), SKIN_LOW = mix('paper', 'peach', 0.64);
const WOOD = mix(mix('paper', 'peach', 0.55), 'ink', 0.1), WOOD_LOW = mix(mix('paper', 'peach', 0.7), 'ink', 0.3);
const fillV = (c: Ctx, y0: number, y1: number, top: string, low: string) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, low); c.fillStyle = g; };
const quad = (c: Ctx, pts: V2[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

// ------------------------------------------------------------------ a camera on the classroom picture
/** The picture's point `at` is shown at `to` on screen, `zoom` times its size. */
export interface RoomCam { zoom: number; at: V2; to: V2 }
export const place = (c: Ctx, cam: RoomCam) => { c.translate(cam.to[0], cam.to[1]); c.scale(cam.zoom, cam.zoom); c.translate(-cam.at[0], -cam.at[1]); };
export const onScreen = (cam: RoomCam, p: V2): V2 => [cam.to[0] + (p[0] - cam.at[0]) * cam.zoom, cam.to[1] + (p[1] - cam.at[1]) * cam.zoom];
/** A shaft of the room's light as it lies on screen under a camera. */
export const shaftOn = (cam: RoomCam, s: Shaft): Shaft => { const [x, y] = onScreen(cam, [s.x, s.y]); return { ...s, x, y, length: s.length * cam.zoom, width: s.width * cam.zoom }; };

// ------------------------------------------------------------------ the classroom after the bell
/** The door to the corridor, at the front of the wall on the left (Z from, to; its height). */
const DOOR: V2 = [2700, 3050], DOOR_H = 800;
const onLeft = (Y: number, Z: number) => P3(LEFT, Y, Z);
/** Where he stops in the doorway (X, Z of the room), and the middle of the doorway's light on the picture. */
export const DOOR_STEP: V2 = [LEFT + 55, 2890], DOORWAY: V2 = onLeft(470, 2875);

/**
 * The room once class is over, in the picture's own space: the intro's shell with the board wiped (the first
 * formulas and the date are left: the lyric is written in the space), and the corridor wall with its open door.
 * `clock`: the wall clock as the intro has it; left out, the scene paints its own.
 */
export function afterClass(c: Ctx, t: number, clock?: { time: number; sec: number }) {
  shell(c, { t, time: 0, sec: 0 }, { rows: [1, 1, 1, 1], him: 1, board: 1, chalk: 1 / 3, clock: 0 });
  if (clock) drawClock(c, CLOCK_AT[0], CLOCK_AT[1], CLOCK_R, clock);
  // what the eraser left, and the date
  const [x, y, w, h] = BOARD_AT;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let i = 0; i < 10; i++) {
    c.save(); c.translate(x + lerp(270, w - 30, hash(i, 31)), y + lerp(20, h - 20, hash(i, 32))); c.rotate(-0.28 + 0.5 * hash(i, 33));
    c.fillStyle = rgba('paper', 0.025 + 0.035 * hash(i, 34)); c.beginPath(); c.ellipse(0, 0, 60 + 80 * hash(i, 35), 11 + 12 * hash(i, 36), 0, 0, TAU); c.fill();
    c.restore();
  }
  c.restore();
  c.font = font(F.hand(500), 22); c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.fillStyle = rgba('paper', 0.88);
  c.fillText('10月9日  星期五', x + w - 14, y + 30); c.textAlign = 'left';
  // the corridor wall, in the light of the windows opposite, and its painted dado
  const wall = (Y0: number, Y1: number, Z0: number, Z1: number) => poly([onLeft(Y1, Z0), onLeft(Y1, Z1), onLeft(Y0, Z1), onLeft(Y0, Z0)]);
  const corner = onLeft(0, FAR)[0], across = (a: string, z: string) => { const g = c.createLinearGradient(corner, 0, corner - 1400, 0); g.addColorStop(0, a); g.addColorStop(1, z); return g; };
  c.fillStyle = across(mix(WALL, 'paper', 0.3), mix(WALL_LOW, 'gold', 0.3)); c.fill(wall(0, CEIL, 700, FAR));
  c.fillStyle = across(mix(DADO, 'paper', 0.15), DADO_LOW); c.fill(wall(0, 330, 700, FAR));
  c.fillStyle = rgba('ink', 0.07); c.fillRect(corner - 4, onLeft(CEIL, FAR)[1], 4, onLeft(0, FAR)[1] - onLeft(CEIL, FAR)[1]);
  // the door: its frame, and the corridor beyond in the afternoon sun (a parapet, the sky over it)
  c.fillStyle = TRIM; c.fill(wall(0, DOOR_H + 30, DOOR[0] - 28, DOOR[1] + 28));
  const open = wall(0, DOOR_H, DOOR[0], DOOR[1]), top = onLeft(DOOR_H, DOOR[0])[1], foot = onLeft(0, DOOR[0])[1];
  fillV(c, top, foot, rgba('paper'), mix('paper', 'gold', 0.5)); c.fill(open);
  c.save(); c.clip(open);
  const k = (LEFT - 420) / LEFT, rail = (Y: number, Z: number) => P3(LEFT - 420, Y, Z * k);
  fillV(c, rail(430, DOOR[0])[1], foot, mix('paper', 'peach', 0.3), mix('gold', 'peach', 0.4));
  c.fill(poly([rail(430, DOOR[0] - 200), rail(430, DOOR[1] + 200), rail(-400, DOOR[1] + 200), rail(-400, DOOR[0] - 200)]));
  c.strokeStyle = rgba('paper', 0.9); c.lineWidth = 3;
  c.beginPath(); c.moveTo(...rail(432, DOOR[0] - 200)); c.lineTo(...rail(432, DOOR[1] + 200)); c.stroke();
  c.restore();
  // its light on the floor of the room
  const a = P3(LEFT, 0, 2875), z = P3(LEFT + 1000, 0, 2700), fg = c.createLinearGradient(a[0], a[1], z[0], z[1]);
  fg.addColorStop(0, mix('gold', 'paper', 0.3, 0.7)); fg.addColorStop(1, mix('gold', 'paper', 0.3, 0));
  c.fillStyle = fg; c.fill(poly([P3(LEFT, 0, DOOR[0]), P3(LEFT, 0, DOOR[1]), P3(LEFT + 1000, 0, DOOR[1] - 120), P3(LEFT + 1000, 0, DOOR[0] - 300)]));
}
/** The windows of the room, for the light layer (in the picture's space): of the nearest, the part beside its curtain. */
export function windowLight(g: Ctx, alpha = 1) {
  g.fillStyle = mix('paper', 'gold', 0.3, 0.075 * alpha);
  WINDOWS.forEach(([Z0, Z1], i) => { const z = i ? Z1 : 1140; g.fill(poly([P3(RIGHT, HEAD, z), P3(RIGHT, HEAD, Z0), P3(RIGHT, SILL, Z0), P3(RIGHT, SILL, z)])); });
}
/** The doorway itself, for the light layer (in the picture's space). */
export function doorLight(g: Ctx, alpha: number) {
  g.fillStyle = mix('paper', 'gold', 0.35, alpha);
  g.fill(poly([onLeft(DOOR_H, DOOR[0]), onLeft(DOOR_H, DOOR[1]), onLeft(0, DOOR[1]), onLeft(0, DOOR[0])]));
}

const kept = new Map<number, { cv: HTMLCanvasElement; y: number; h: number }>(), ROW_X = -720, ROW_W = W + 800;
/**
 * A row's desks and chairs with nobody at them (his own seat is the scene's to paint): painted once, with the
 * air's haze over it, and kept. The far rows of a shot are a little soft for it, as they should be.
 */
export function emptyRow(c: Ctx, r: number) {
  let k = kept.get(r);
  if (!k) {
    const Z = ROWS[r]!, y = Math.floor(VP[1] + (FOC * (EYE - 340)) / (Z - 60)) - 8, h = Math.ceil(VP[1] + (FOC * EYE) / (Z - 70)) + 12 - y, cv = document.createElement('canvas');
    cv.width = Math.round(ROW_W * SCALE); cv.height = Math.round(h * SCALE);
    const x = scaleContext2D(cv.getContext('2d')!, SCALE);
    x.translate(-ROW_X, -y);
    COLS.forEach((X, i) => { const s = seatAt(X, Z); if (!(r === 2 && i === 0)) atDesk(x, s, () => {}); });
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgba(AIR, [0, 0.05, 0.12, 0.22, 0.3][r]!); x.fillRect(ROW_X, y, ROW_W, h);
    kept.set(r, (k = { cv, y, h }));
  }
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(k.cv, ROW_X, k.y, ROW_W, k.h);
}

/** One of the class on the way out: where it is (X across the room, Z from the back wall), and where in its stride. */
export interface Leaver { X: number; Z: number; boy: boolean; tone: number; walk: number; alpha: number }
/** The lanes they leave by: behind each row of desks, the farthest first. */
export const LANES = [2588, 2158, 1728, 1298];
/** A stride of the kit's walk covers this much floor (two steps). */
export const STRIDE = 232;
/**
 * The class leaving at time `t`, `since` the bell: everybody walks off to the corridor (to the left) and is
 * gone once there. `rate` above 1 is the room in fast-forward: they keep coming, one after the other.
 */
export function leavers(t: number, since: number, o: { count?: number; seed?: number; rate?: number } = {}): Leaver[] {
  const n = o.count ?? 16, seed = o.seed ?? 5, rate = o.rate ?? 1, out: Leaver[] = [];
  for (let i = 0; i < n; i++) {
    // (some were up before the bell had finished; the last ones are still at their desks for a while)
    const h = (k: number) => hash(i, seed, k), X0 = lerp(-1500, 500, h(1)), v = 270 * lerp(0.9, 1.15, h(2)) * rate;
    let gone = Math.max(0, v * (t - since + lerp(1.6, -5.5, h(3)))), alpha = 1;
    if (rate > 1) { const span = X0 - LEFT + 300; gone = mod(v * (t - since) + h(3) * span, span); alpha = clamp(gone / 300) * clamp((span - gone) / 240); }
    if (X0 - gone > LEFT - 200) out.push({ X: X0 - gone, Z: LANES[i % LANES.length]!, boy: h(4) < 0.5, tone: 0.15 + 0.6 * h(5), walk: gone / STRIDE, alpha });
  }
  return out;
}
function drawLeaver(c: Ctx, w: Leaver, t: number) {
  const s = seatAt(w.X, w.Z);
  drawStudent(c, 'walk', { x: s.x, y: s.y, scale: s.scale, facing: s.facing - 270, t: t + w.tone * 9, walk: w.walk, boy: w.boy, bag: true, silhouette: mix('frost', 'sky', w.tone), alpha: w.alpha < 1 ? w.alpha : undefined });
}

/**
 * The blur of somebody going by (to the left): the plain shape of a person (head, body and bag, legs) again and
 * again over `len` px behind them, fainter each time. `n` of them under a walking figure are a little motion
 * blur; with `lead` (the shape itself in front) and long, it is all that fast-forward leaves of them.
 */
function drawStreak(c: Ctx, w: Leaver, len: number, n: number, lead: boolean) {
  const seat = seatAt(w.X, w.Z), s = seat.scale * (w.boy ? 1.05 : 1), col = mix('frost', 'sky', w.tone);
  for (let i = n; i >= (lead ? 0 : 1); i--) {
    const x = seat.x + (i / n) * len, y = seat.y;
    c.fillStyle = rgba(col, w.alpha * (i ? 0.12 * (1 - i / (n + 1)) ** 1.4 : 0.6));
    c.beginPath(); c.arc(x - 2 * s, y - 557 * s, 54 * s, 0, TAU); c.roundRect(x - 36 * s, y - 500 * s, 104 * s, 205 * s, 30 * s); c.roundRect(x - 26 * s, y - 306 * s, 52 * s, 306 * s, 20 * s); c.fill();
  }
}

/**
 * Paint `draw` out of focus by about `blur` px, with `haze` of the air's colour over it: small, then enlarged
 * through a blur that takes the steps out of the edges (the kit's layer() alone shows them on what is large and
 * still, as she is in front of her window).
 */
export function soft(c: Ctx, blur: number, draw: (c: Ctx) => void, o: { haze?: number; hazeColor?: string } = {}) {
  const haze = o.haze ?? 0;
  if (blur < 0.6 && haze <= 0) { c.save(); draw(c); c.restore(); return; }
  const s = scratch('soft', blur < 0.6 ? 1 : clamp(Math.round(blur / 2.5), 1, 4)), x = s.c;
  x.save(); draw(x); x.restore();
  if (haze > 0) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgba(o.hazeColor ?? 'paper', haze); x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  if (blur >= 0.6) c.filter = `blur(${(blur * 0.5).toFixed(1)}px)`;
  c.drawImage(s.cv, 0, 0, W, H);
  c.restore();
}

/**
 * The rows of desks and the class leaving between them, far to near, under a camera. The leavers are soft
 * silhouettes with a little motion blur behind them, `streak` long (in units of the room); `fast`: nothing but
 * the streaks (the room in fast-forward). `alpha`: how much of them is there yet. `flat`: paint straight onto
 * `c` (inside a layer of the scene's own), not each lane through a layer. `after(r)` is called once row `r` is
 * painted, for what stands at that depth (him, at row 2).
 */
export function roomRows(c: Ctx, cam: RoomCam, t: number, list: Leaver[], o: { rows?: number[]; streak?: number; fast?: boolean; alpha?: number; flat?: boolean; after?: (r: number) => void } = {}) {
  const rows = o.rows ?? [4, 3, 2, 1];
  const row = (r: number) => { if (rows.includes(r)) { c.save(); place(c, cam); emptyRow(c, r); c.restore(); } o.after?.(r); };
  row(4);
  LANES.forEach((Z, L) => {
    const len = ((o.streak ?? 0) * FOC) / Z, top = onScreen(cam, [0, VP[1] + (FOC * (EYE - 680)) / Z])[1];
    const here = top > H ? [] : list.filter((w) => { const x = onScreen(cam, [seatAt(w.X, Z).x, 0])[0]; return w.Z === Z && x > -160 - len * cam.zoom && x < W + 160; });
    const paint = (x: Ctx) => { x.save(); place(x, cam); for (const w of here) { drawStreak(x, w, len, o.fast ? 14 : 4, !!o.fast); if (!o.fast) drawLeaver(x, w, t); } x.restore(); };
    if (here.length) { if (o.flat) paint(c); else layer(c, { blur: 3.5, alpha: o.alpha ?? 1 }, paint); }
    row(3 - L);
  });
}

// ------------------------------------------------------------------ small things on the desks
const BOOKS = [mix('sky', 'navy', 0.22), mix('blush', 'peach', 0.5), mix('gold', 'paper', 0.3), mix('frost', 'navy', 0.3), mix('dusk', 'paper', 0.3)];
/** An exercise book: held up at (x, y) (its cover to us), or `flat` on a desk (its edge to us, (x, y) the middle of its underside). */
export function drawBook(c: Ctx, x: number, y: number, s: number, o: { rot?: number; tone?: number; flat?: boolean } = {}) {
  c.save(); c.translate(x, y); c.rotate(o.rot ?? 0); c.scale(s, s);
  c.fillStyle = BOOKS[(o.tone ?? 0) % BOOKS.length]!;
  if (o.flat) { c.beginPath(); c.roundRect(-25, -9, 50, 9, 2.5); c.fill(); c.fillStyle = rgba('paper', 0.85); c.fillRect(-23, -6.5, 46, 4); }
  else {
    c.beginPath(); c.roundRect(-19, -25, 38, 50, 3); c.fill();
    c.fillStyle = rgba('paper', 0.9); c.fillRect(15, -22, 3.5, 44);
    c.fillStyle = rgba('paper', 0.55); c.fillRect(-11, -15, 20, 9);
  }
  c.restore();
}
const PENCILS = [mix('gold', 'peach', 0.3), mix('sky', 'navy', 0.2), mix('blush', 'rose', 0.25), mix('gold', 'paper', 0.2), mix('frost', 'navy', 0.25)];
/** A pencil, its middle at (x, y), pointing along `rot` (0 = to the right). */
export function drawPencil(c: Ctx, x: number, y: number, len: number, rot: number, tone = 0) {
  const w = len * 0.075;
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = PENCILS[tone % PENCILS.length]!; c.beginPath(); c.roundRect(-len / 2, -w / 2, len * 0.84, w, w * 0.3); c.fill();
  c.fillStyle = mix('paper', 'peach', 0.4); c.beginPath(); c.moveTo(len * 0.34, -w / 2); c.lineTo(len * 0.47, -w * 0.12); c.lineTo(len * 0.47, w * 0.12); c.lineTo(len * 0.34, w / 2); c.closePath(); c.fill();
  c.fillStyle = rgba('ink'); c.beginPath(); c.moveTo(len * 0.44, -w * 0.2); c.lineTo(len / 2, 0); c.lineTo(len * 0.44, w * 0.2); c.closePath(); c.fill();
  c.fillStyle = rgba('paper', 0.35); c.fillRect(-len / 2, -w / 2, len * 0.84, w * 0.3);
  c.restore();
}
/** Her pencil pouch standing on a desk, (x, y) the middle of its base, `s` px to a unit of the figures: `inside` pencils show over its rim. */
export function drawPouch(c: Ctx, x: number, y: number, s: number, inside: number) {
  const w = 19 * s, h = 60 * s;
  for (let i = 0; i < inside; i++) drawPencil(c, x + (-0.62 + 0.42 * (i % 4)) * w + (i > 3 ? 0.2 * w : 0), y - h - (7 + 4 * hash(i, 5)) * s, 46 * s, -Math.PI / 2 + (hash(i, 6) - 0.5) * 0.3, i);
  fillV(c, y - h, y, mix('blush', 'paper', 0.3), mix('blush', 'peach', 0.55));
  c.beginPath(); c.roundRect(x - w, y - h, w * 2, h, [5 * s, 5 * s, 8 * s, 8 * s]); c.fill();
  c.fillStyle = mix('blush', 'ink', 0.2); c.beginPath(); c.roundRect(x - w, y - h, w * 2, 7 * s, 3.5 * s); c.fill();
  c.fillStyle = rgba('paper', 0.5); c.beginPath(); c.roundRect(x - w * 0.55, y - h * 0.62, w * 1.1, h * 0.3, 3 * s); c.fill();
}

// ------------------------------------------------------------------ her desk, as she sees it
/** Where lines of the desk that run away from her meet (above the frame), and the y of its far edge. */
const DESK_VP: V2 = [960, 50], DESK_FAR = 812;
/** A point of her desk: `xf` is its x measured along the far edge. */
const onDesk = (xf: number, y: number): V2 => [DESK_VP[0] + ((xf - DESK_VP[0]) * (y - DESK_VP[1])) / (DESK_FAR - DESK_VP[1]), y];
/**
 * Her desk across the bottom of the frame, as she sees it over her things: the wood, her notebook with the
 * doodle still unfinished in its margin, her pencil pouch and the pencils not yet in it, and the sun through
 * the blinds across it all. `c`: the picture; `g`: the light layer.
 */
export function drawHerDesk(c: Ctx, g: Ctx, t: number) {
  const top: V2[] = [onDesk(330, DESK_FAR), onDesk(1590, DESK_FAR), onDesk(1590, H + 30), onDesk(330, H + 30)];
  // its shadow on what is behind it, the wood and its grain, the worn far edge
  c.fillStyle = rgba('ink', 0.1); c.fillRect(310, DESK_FAR - 9, 1300, 12);
  fillV(c, DESK_FAR, H, mix(WOOD, 'paper', 0.14), mix(WOOD, WOOD_LOW, 0.5)); quad(c, top); c.fill();
  c.save(); quad(c, top); c.clip();
  c.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const xf = 330 + (1260 * (i + hash(i, 61))) / 22, a = onDesk(xf, DESK_FAR + 300 * hash(i, 62)), z = onDesk(xf + 14 * (hash(i, 63) - 0.5), H + 30);
    c.strokeStyle = mix(WOOD_LOW, 'ink', 0.2, 0.06 + 0.07 * hash(i, 64)); c.lineWidth = 2 + 3 * hash(i, 65);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(z[0], z[1]); c.stroke();
  }
  c.fillStyle = rgba('paper', 0.32); c.fillRect(0, DESK_FAR, W, 5);
  // the notebook: ruled, with the margin and the doodle
  const page: V2[] = [onDesk(372, 838), onDesk(640, 838), onDesk(640, H + 30), onDesk(372, H + 30)];
  c.save(); c.shadowColor = rgba('ink', 0.26); c.shadowBlur = 22; c.shadowOffsetX = -5; c.shadowOffsetY = 7;
  c.fillStyle = rgba('paper'); quad(c, page); c.fill(); c.restore();
  c.save(); quad(c, page); c.clip();
  c.strokeStyle = mix('sky', 'paper', 0.3); c.lineWidth = 2; c.beginPath();
  for (let i = 0; i < 9; i++) { const y = 866 + i * 23 + i * i * 1.4; c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke();
  c.strokeStyle = mix('blush', 'peach', 0.5); c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(...onDesk(424, 838)); c.lineTo(...onDesk(424, H + 30)); c.stroke();
  c.fillStyle = rgba('ink', 0.5);
  for (let i = 0; i < 4; i++) { const y = 880 + i * 27 + i * i * 1.6, a = onDesk(440, y), z = onDesk(480 + 120 * hash(i, 66), y); c.fillRect(a[0], y - 5, z[0] - a[0], 2.6); }
  c.translate(...onDesk(398, 968)); c.transform(1, 0, -0.42, 0.56, 0, 0);
  drawDoodle(c, 0, 0, 26, DOODLE_UNFINISHED, { width: 2.4 });
  c.restore();
  c.save(); quad(c, page); c.clip(); paperGrain(c, { x: 200, y: 830, w: 500, h: 260, alpha: 0.8 }); c.restore();
  // the pouch, and the pencils that are still out
  const [px, py] = onDesk(1392, 1004);
  for (const [dx, dy, rot, tone] of [[-128, 36, 0.16, 0], [-110, 60, -0.07, 3]] as const) {
    c.fillStyle = rgba('ink', 0.14); c.beginPath(); c.ellipse(px + dx - 3, py + dy + 6, 62, 5, rot * 0.55, 0, TAU); c.fill();
    c.save(); c.translate(px + dx, py + dy); c.scale(1, 0.58); drawPencil(c, 0, 0, 124, rot, tone); c.restore();
  }
  c.fillStyle = rgba('ink', 0.16); c.beginPath(); c.ellipse(px - 8, py + 2, 60, 13, 0, 0, TAU); c.fill();
  c.fillStyle = mix('blush', 'ink', 0.3); c.beginPath(); c.ellipse(px, py - 135, 42.7, 10, 0, 0, TAU); c.fill();
  drawPouch(c, px, py, 2.25, 2);
  // the sun between the slats of the blinds
  for (const [x, a] of [[c, 0.2], [g, 0.045]] as [Ctx, number][]) {
    x.save(); quad(x, top); x.clip(); x.fillStyle = mix('gold', 'paper', 0.35, a);
    for (let i = 0; i < 6; i++) { const s = 250 + i * 290 + 6 * Math.sin(t * 0.5); quad(x, [[s, DESK_FAR - 10], [s + 150, DESK_FAR - 10], [s + 150 - 250, H + 20], [s - 250, H + 20]]); x.fill(); }
    x.restore();
  }
  c.restore();
}

// ------------------------------------------------------------------ her window, and the court outside
/** The basketball court from her window: near left, near right, far right, far left. */
const COURT: V2[] = [[292, 748], [1178, 748], [1046, 572], [424, 572]];
/** A point of the court: `u` along it (0..1), `v` across it from the near side line (0) to the far one (1). */
export const onCourt = (u: number, v: number): V2 => { const k = v / (1.42 - 0.42 * v); return [lerp(lerp(COURT[0]![0], COURT[1]![0], u), lerp(COURT[3]![0], COURT[2]![0], u), k), lerp(COURT[0]![1], COURT[3]![1], k)]; };
/** Where the ball is bounced, and the players: where each stands, how it moves, its colour. */
export const DRIBBLE: V2 = [0.44, 0.46];
const PLAYERS: { u: number; v: number; run: number; tone: number; boy: boolean }[] = [
  { u: 0.395, v: 0.5, run: 0, tone: 0.2, boy: true }, { u: 0.53, v: 0.4, run: 0.5, tone: 0.75, boy: true }, { u: 0.7, v: 0.68, run: 1, tone: 0.5, boy: false },
  { u: 0.2, v: 0.3, run: 0.7, tone: 0.9, boy: true }, { u: 0.86, v: 0.36, run: 0.3, tone: 0.35, boy: false },
];

function sky(c: Ctx) {
  const g = c.createLinearGradient(0, -60, 0, 600);
  g.addColorStop(0, mix('sky', 'paper', 0.12)); g.addColorStop(0.34, mix('sky', 'paper', 0.45)); g.addColorStop(0.62, mix('paper', 'gold', 0.32)); g.addColorStop(0.86, mix('gold', 'peach', 0.4)); g.addColorStop(1, mix('peach', 'paper', 0.3));
  c.fillStyle = g; c.fillRect(-200, -200, W + 400, H + 400);
  const s = c.createRadialGradient(330, 40, 0, 330, 40, 900);
  s.addColorStop(0, mix('paper', 'gold', 0.3, 0.95)); s.addColorStop(0.08, mix('paper', 'gold', 0.4, 0.55)); s.addColorStop(0.42, mix('gold', 'paper', 0.3, 0.18)); s.addColorStop(1, mix('gold', 'paper', 0.3, 0));
  c.fillStyle = s; c.fillRect(-200, -200, W + 400, H + 400);
}
function distance(c: Ctx, t: number) {
  // clouds, the hills and roofs in the haze, the far side of the grounds
  const puffs: [number, number, number][] = [[0, 0, 60], [-74, 16, 42], [70, 12, 48], [-28, -26, 44], [34, -30, 38], [132, 24, 30], [-132, 26, 28]];
  for (const [x, y, s] of [[980, 150, 1], [1560, 250, 0.7], [540, 250, 0.55]] as V3[]) for (const [low, col] of [[1, mix('peach', 'blush', 0.5, 0.5)], [0, rgba('paper', 0.92)]] as [number, string][]) {
    c.fillStyle = col; c.beginPath();
    for (const [px, py, r] of puffs) { const cx = x + 4 * t * s + px * s, cy = y + py * s + low * 9 * s; c.moveTo(cx + r * s, cy); c.arc(cx, cy, r * s, 0, TAU); }
    c.fill();
  }
  for (let i = 0; i < 26; i++) { c.fillStyle = mix(mix('dusk', 'peach', 0.45 + 0.3 * hash(i, 71)), 'paper', 0.5); c.beginPath(); c.arc(-200 + i * 96 + 40 * hash(i, 72), 508 + 14 * hash(i, 73), 52 + 44 * hash(i, 74), 0, TAU); c.fill(); }
  c.fillStyle = mix(mix('dusk', 'frost', 0.5), 'paper', 0.45);
  for (const [x, y, w] of [[150, 432, 150], [520, 452, 96], [1250, 440, 170], [1600, 458, 120]]) { c.fillRect(x!, y!, w!, 110); c.fillRect(x! + w! * 0.2, y! - 16, w! * 0.3, 20); }
}
type V3 = [number, number, number];
/** A tree's crown seen from above the yard, dappled by the sun. */
function crown(c: Ctx, x: number, y: number, r: number, t: number, seed: number) {
  const LEAF = mix(mix('gold', 'peach', 0.5), 'ink', 0.12), blobs = new Path2D();
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + seed, d = i ? r * 0.52 : 0, bx = x + Math.cos(a) * d + r * 0.014 * Math.sin(t * 0.7 + i * 1.7 + seed), by = y + Math.sin(a) * d * 0.8, br = r * (i ? 0.56 : 0.86); blobs.moveTo(bx + br, by); blobs.arc(bx, by, br, 0, TAU); }
  const g = c.createLinearGradient(x - r * 0.5, y - r, x + r * 0.4, y + r);
  g.addColorStop(0, mix(LEAF, 'gold', 0.5)); g.addColorStop(0.5, LEAF); g.addColorStop(1, mix(mix('peach', 'rose', 0.22), 'ink', 0.3));
  c.fillStyle = g; c.fill(blobs);
  c.save(); c.clip(blobs);
  for (let i = 0; i < 16; i++) {
    const a = hash(i, seed, 1) * TAU, d = Math.sqrt(hash(i, seed, 2)) * r, lit = hash(i, seed, 3) < 0.62, k = 0.5 + 0.5 * Math.sin(t * (0.7 + hash(i, seed, 4)) + i);
    c.fillStyle = lit ? mix(mix('gold', 'paper', 0.3), 'paper', 0.2, 0.3 + 0.4 * k) : mix('peach', 'ink', 0.4, 0.2);
    c.beginPath(); c.ellipse(x + Math.cos(a) * d - (lit ? r * 0.14 : -r * 0.1), y + Math.sin(a) * d * 0.8 - (lit ? r * 0.12 : -r * 0.14), r * (0.08 + 0.09 * hash(i, seed, 5)), r * (0.05 + 0.05 * hash(i, seed, 6)), a, 0, TAU); c.fill();
  }
  c.restore();
}
/** The grounds below the window: the court and its lines, the hoops, the players, the ball and the noise they make. */
function court(c: Ctx, o: WindowOpts) {
  const { t } = o, line = (pts: V2[], close = false) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (close) c.closePath(); c.stroke(); };
  fillV(c, 500, H, mix(mix('gold', 'peach', 0.5), 'paper', 0.34), mix('peach', 'paper', 0.3)); c.fillRect(-300, 500, W + 600, 700);
  // the far fence and the trees behind it
  for (let i = 0; i < 14; i++) crown(c, -60 + i * 150 + 40 * hash(i, 75), 520 + 8 * hash(i, 76), 46 + 16 * hash(i, 77), t, 30 + i);
  c.strokeStyle = mix('frost', 'navy', 0.3, 0.5); c.lineWidth = 1.5;
  c.beginPath(); for (let x = -100; x <= W + 100; x += 58) { c.moveTo(x, 536); c.lineTo(x, 566); } c.moveTo(-100, 538); c.lineTo(W + 100, 538); c.stroke();
  // the court
  c.fillStyle = mix(mix('peach', 'blush', 0.5), 'rose', 0.08); quad(c, [onCourt(-0.04, -0.1), onCourt(1.04, -0.1), onCourt(1.04, 1.1), onCourt(-0.04, 1.1)]); c.fill();
  c.strokeStyle = rgba('paper', 0.88); c.lineWidth = 3; c.lineJoin = 'round'; c.lineCap = 'round';
  line([onCourt(0, 0), onCourt(1, 0), onCourt(1, 1), onCourt(0, 1)], true); line([onCourt(0.5, 0), onCourt(0.5, 1)]);
  const ring = (u0: number, ru: number, a0: number, a1: number) => line(Array.from({ length: 25 }, (_, i) => { const a = lerp(a0, a1, i / 24); return onCourt(u0 + ru * Math.cos(a), 0.5 + 0.27 * Math.sin(a)); }));
  ring(0.5, 0.075, 0, TAU); ring(0, 0.2, -Math.PI / 2, Math.PI / 2); ring(1, 0.2, Math.PI / 2, Math.PI * 1.5);
  for (const [u, sg] of [[0, 1], [1, -1]] as V2[]) {
    const [x, y] = onCourt(u, 0.5);
    c.strokeStyle = mix('frost', 'navy', 0.35); c.lineWidth = 5; line([[x - sg * 30, y + 4], [x - sg * 30, y - 104], [x - sg * 4, y - 122]]);
    c.strokeStyle = rgba('paper'); c.lineWidth = 7; line([[x - sg * 2, y - 148], [x - sg * 2, y - 98]]);
    c.strokeStyle = mix('peach', 'rose', 0.45); c.lineWidth = 3; line([[x, y - 110], [x + sg * 26, y - 110]]);
    c.strokeStyle = rgba('paper', 0.8); c.lineWidth = 1.5; line([[x + sg * 4, y - 108], [x + sg * 9, y - 90], [x + sg * 19, y - 90], [x + sg * 24, y - 108]]);
  }
  // the players, far ones first; the ball at the first one's hand, bounced on the drum
  const [bx, by] = onCourt(...DRIBBLE);
  PLAYERS.map((p, i) => ({ p, i })).sort((a, z) => z.p.v - a.p.v).forEach(({ p, i }) => {
    const sway = Math.sin(t * (0.8 + 0.3 * p.run) + i * 2.1), [x, y] = onCourt(p.u + (i ? 0.035 * sway : 0), p.v + (i ? 0.05 * Math.cos(t * 0.7 + i) : 0)), s = lerp(0.2, 0.15, p.v);
    c.fillStyle = rgba('ink', 0.16); c.beginPath(); c.ellipse(x + 10, y + 2, 24, 5, 0, 0, TAU); c.fill();
    drawStudent(c, i ? { from: 'stand', to: 'run', k: 0.35 + 0.3 * p.run } : 'stand', { x, y, scale: s, facing: i ? (Math.cos(t * (0.8 + 0.3 * p.run) + i * 2.1) > 0 ? 90 : -90) : 70, t: t + i, walk: t * 1.6 + i * 0.37, boy: p.boy, silhouette: mix(mix('navy', 'frost', 0.35 + 0.4 * p.tone), 'peach', 0.12) });
  });
  c.fillStyle = rgba('ink', 0.2 * (1 - 0.6 * clamp(o.ball / 70))); c.beginPath(); c.ellipse(bx + 4, by + 1, 11 - 4 * clamp(o.ball / 70), 3.4, 0, 0, TAU); c.fill();
  c.fillStyle = mix('peach', 'rose', 0.35); c.beginPath(); c.arc(bx, by - 9 - o.ball, 9, 0, TAU); c.fill();
  c.strokeStyle = mix('peach', 'ink', 0.45, 0.6); c.lineWidth = 1.2; c.beginPath(); c.arc(bx, by - 9 - o.ball, 9, 0.4, 2.2); c.stroke();
  // the noise, as small doodled lines: where the ball lands, and round those who shout
  const fan = (x: number, y: number, dir: number, k: number, r0: number, seed: number) => {
    if (k <= 0.02) return;
    c.strokeStyle = rgba('ink', 0.5 * Math.min(1, k * 1.6)); c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath();
    for (let i = -1; i <= 1; i++) { const a = dir + i * 0.42 + 0.06 * (hash(seed, i) - 0.5), r1 = r0 + (12 + 7 * hash(seed, i, 2)) * (0.5 + 0.5 * k); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
    c.stroke();
  };
  fan(bx, by, -0.35, o.hit, 17, 1); fan(bx, by, Math.PI + 0.35, o.hit, 17, 2);
  PLAYERS.forEach((p, i) => {
    if (!i) return;
    const [x, y] = onCourt(p.u, p.v), k = Math.max(0, Math.sin(t * (2.3 + 0.4 * i) + i * 1.9)) ** 3 * (0.5 + 0.5 * o.hit), sg = i % 2 ? 1 : -1;
    fan(x + sg * 8, y - lerp(0.2, 0.15, p.v) * 590, sg > 0 ? -0.5 : Math.PI + 0.5, k, 15, 10 + i);
  });
  // the crowns of the trees in the yard below, close under the window
  for (const [x, y, r, seed] of [[-10, 876, 190, 1], [330, 934, 150, 2], [1010, 944, 170, 5], [1330, 880, 150, 7]] as const) crown(c, x, y, r, t, seed);
}

/** Her window and what frames it: the bars, the sill, the wall under it, the curtain drawn aside. */
function casement(c: Ctx, t: number) {
  const bar = mix('paper', 'peach', 0.1);
  // a little of the room in the glass
  const sheen = c.createLinearGradient(260, 780, 1100, 100);
  sheen.addColorStop(0.2, rgba('paper', 0)); sheen.addColorStop(0.42, rgba('paper', 0.1)); sheen.addColorStop(0.5, rgba('paper', 0.02)); sheen.addColorStop(0.62, rgba('paper', 0.07)); sheen.addColorStop(0.8, rgba('paper', 0));
  c.fillStyle = sheen; c.fillRect(-200, -200, W + 400, 980);
  c.fillStyle = bar; c.fillRect(-200, 92, W + 400, 22);
  for (const [x, w] of [[226, 34], [1146, 24], [2030, 24]] as V2[]) c.fillRect(x, -200, w, 990);
  c.fillStyle = rgba('ink', 0.1); c.fillRect(-200, 114, W + 400, 5);
  for (const x of [260, 1170]) c.fillRect(x, -200, 5, 990);
  // the sill and the wall under it, in the shade of the room
  fillV(c, 772, 800, mix('paper', 'gold', 0.2), mix('paper', 'peach', 0.3)); c.fillRect(-200, 772, W + 400, 28);
  fillV(c, 800, H + 100, mix(mix(DADO, 'navy', 0.14), 'ink', 0.12), mix(mix(DADO_LOW, 'navy', 0.24), 'ink', 0.22)); c.fillRect(-200, 800, W + 400, 500);
  c.fillStyle = rgba('ink', 0.16); c.fillRect(-200, 800, W + 400, 10);
  // the curtain, its hem lifting a little in the air from outside
  const n = 6, fold = (i: number): V2[] => { const x = -150 + i * 62, air = (0.5 + 0.5 * Math.sin(t * 0.8 + i * 0.9)) * (10 + 16 * (i % 2)) + 5 * Math.sin(t * 1.7 + i * 2.1); return [[x, -200], [x + air * 0.4, 420], [x + air, 850 + 12 * Math.sin(i * 1.9)]]; };
  const folds = Array.from({ length: n + 1 }, (_, i) => fold(i)), cloth = new Path2D();
  folds.forEach(([a], i) => (i ? cloth.lineTo(a![0], a![1]) : cloth.moveTo(a![0], a![1])));
  for (let i = n; i >= 0; i--) { const [, m, b] = folds[i]!; if (i === n) cloth.lineTo(m![0], m![1]); cloth.lineTo(b![0], b![1]); }
  cloth.closePath();
  fillV(c, -100, 860, mix('sky', 'paper', 0.34), mix('sky', 'navy', 0.1)); c.fill(cloth);
  c.lineCap = 'round';
  folds.forEach(([a, m, b], i) => { c.strokeStyle = i % 2 ? mix('sky', 'navy', 0.3, 0.3) : rgba('paper', 0.42); c.lineWidth = 6; c.beginPath(); c.moveTo(a![0], a![1]); c.quadraticCurveTo(m![0], m![1], b![0], b![1]); c.stroke(); });
}

export interface WindowOpts {
  t: number;
  /** The slow camera of the shot. */
  cam: Cam;
  /** 0: the eye is on the court. 1: on her (the court has gone soft, and the frame a little dim). */
  inward: number;
  /** The ball: how high it is off the court (px), and how hard it has just landed (0..1: the noise). */
  ball: number; hit: number;
  /** Paints her at her desk, in the frame's own px (under the camera). */
  her: (c: Ctx) => void;
}
/**
 * Her window from the aisle: the afternoon outside, the court and the noise on it, and her beside it.
 * `c`: the picture (the whole frame is painted); `g`: the light layer.
 */
export function drawWindowView(c: Ctx, g: Ctx, o: WindowOpts) {
  const { t, cam } = o, k = clamp(o.inward), air = mix('paper', 'gold', 0.35);
  layer(c, { cam, depth: 0 }, sky);
  layer(c, { cam, depth: 0.1, blur: 2.5 + 5 * k, haze: 0.14, hazeColor: air }, (b) => distance(b, t));
  soft(c, 9 * k, (b) => { camera(b, cam, 0.22); court(b, o); }, { haze: 0.05 + 0.1 * k, hazeColor: air });
  if (k > 0.003) { c.fillStyle = mix('ink', 'navy', 0.35, 0.16 * k); c.fillRect(0, 0, W, H); }
  layer(c, { cam, depth: 0.8, blur: lerp(2.5, 4, k) }, (b) => casement(b, t));
  soft(c, 6 * (1 - k), (b) => { camera(b, cam, 1); o.her(b); });
  // the light: the sun in the glass, a shaft across the room to her, the dust in it
  const shaft: Shaft = { x: 560, y: 40, angle: 0.66, length: 1350, width: 330, spread: 1.5 };
  lightShaft(c, shaft, { alpha: 0.13, t });
  glow(g, 330, 40, 780, { alpha: 0.5 * (1 - 0.35 * k) });
  lightShaft(g, shaft, { alpha: 0.035, t });
  dustMotes(g, t, { shafts: [shaft], count: 70, seed: 15 });
}

// ------------------------------------------------------------------ the back wall, and her textbook
let wallKept: HTMLCanvasElement | null = null;
const PAD = 140, SOFT = 3;
/** The back of the classroom behind her, out of focus: painted once, small, and kept. */
export function drawBackWall(c: Ctx) {
  if (!wallKept) {
    const cv = (wallKept = document.createElement('canvas'));
    cv.width = Math.ceil(((W + PAD * 2) * SCALE) / SOFT); cv.height = Math.ceil(((H + PAD * 2) * SCALE) / SOFT);
    const x = scaleContext2D(cv.getContext('2d')!, SCALE / SOFT);
    x.translate(PAD, PAD);
    fillV(x, -PAD, 700, WALL, WALL_LOW); x.fillRect(-PAD, -PAD, W + PAD * 2, 700 + PAD);
    fillV(x, 640, H + PAD, DADO, DADO_LOW); x.fillRect(-PAD, 640, W + PAD * 2, H + PAD - 640);
    x.fillStyle = rgba('paper', 0.5); x.fillRect(-PAD, 634, W + PAD * 2, 8);
    // the board at the back, with what the class has pinned on it
    x.fillStyle = TRIM; x.fillRect(396, 120, 1280, 408);
    x.fillStyle = mix('peach', 'paper', 0.4); x.fillRect(410, 134, 1252, 380);
    const sheets = [rgba('paper'), mix('paper', 'blush', 0.5), mix('paper', 'sky', 0.45), mix('paper', 'gold', 0.5)];
    for (let i = 0; i < 12; i++) {
      x.save(); x.translate(500 + (i % 6) * 204 + 30 * hash(i, 81), 226 + Math.floor(i / 6) * 190 + 16 * hash(i, 82)); x.rotate((hash(i, 83) - 0.5) * 0.14);
      x.fillStyle = sheets[Math.floor(hash(i, 84) * sheets.length)]!; x.fillRect(-70, -76, 140, 152);
      x.fillStyle = rgba('ink', 0.14); for (let l = 0; l < 5; l++) x.fillRect(-50, -50 + l * 24, 70 + 30 * hash(i, l), 6);
      x.restore();
    }
    // the window wall beside her, bright, and its curtain
    const win = x.createLinearGradient(-PAD, 0, 300, 0);
    win.addColorStop(0, mix('paper', 'gold', 0.3)); win.addColorStop(0.6, mix('paper', 'gold', 0.4, 0.75)); win.addColorStop(1, mix('paper', 'gold', 0.4, 0));
    x.fillStyle = win; quad(x, [[-PAD, -PAD], [210, -PAD], [150, 760], [-PAD, 880]]); x.fill();
    fillV(x, -PAD, 800, mix('sky', 'paper', 0.3), mix('sky', 'navy', 0.12)); quad(x, [[150, -PAD], [262, -PAD], [236, 740], [130, 770]]); x.fill();
    // the last row either side of her: a desk, a chair pushed in
    for (const sx of [170, 1750]) atDesk(x, { x: sx, y: 1330, scale: 2.1, facing: 4 }, () => {});
  }
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(wallKept, -PAD, -PAD, W + PAD * 2, H + PAD * 2);
}

export interface BookOpts {
  /** The middle of its top edge; the width of one cover, and its height. */
  x: number; y: number; w: number; h: number;
  /** A page on its way over, 0..1 (0 and 1: none). */
  flip: number;
  /** Paints what is written on its cover, between the covers and her fingers. */
  cover?: () => void;
}
/** Her textbook, held open and upright in front of her face, its covers to us; a page turning over behind them; her fingers round its edges. */
export function drawTextbook(c: Ctx, o: BookOpts) {
  const { x, y, w, h } = o, tilt = 9, top = mix('sky', 'paper', 0.42), low = mix('sky', 'navy', 0.12);
  // the pages between the covers, and the one turning: it stands up over the top edge on its way across
  c.fillStyle = mix('paper', 'ink', 0.08); c.fillRect(x - w + 14, y - 9, w * 2 - 28, 16);
  c.fillStyle = rgba('paper'); c.fillRect(x - w + 14, y - 13, w * 2 - 28, 9);
  if (o.flip > 0.01 && o.flip < 0.99) {
    const a = Math.PI * o.flip, tx = x + Math.cos(a) * w * 0.9, ty = y - 8 - Math.sin(a) * w * 0.3, bulge = Math.sin(a) * 36;
    c.beginPath(); c.moveTo(x, y + 30); c.quadraticCurveTo((x + tx) / 2 + bulge * 0.4, (y + ty) / 2 - bulge * 1.5, tx, ty); c.lineTo(tx, ty + 40 + 60 * Math.sin(a)); c.quadraticCurveTo((x + tx) / 2, y + 44, x, y + 60); c.closePath();
    c.fillStyle = rgba('paper'); c.fill(); c.strokeStyle = rgba('ink', 0.16); c.lineWidth = 2; c.stroke();
  }
  // the two covers, leaning back from the spine; a label across them
  for (const sg of [-1, 1]) {
    const cover = new Path2D();
    cover.moveTo(x + sg * 5, y); cover.lineTo(x + sg * w, y + tilt); cover.lineTo(x + sg * w, y + h - tilt); cover.lineTo(x + sg * 5, y + h); cover.closePath();
    fillV(c, y, y + h, sg < 0 ? mix(top, 'navy', 0.05) : top, sg < 0 ? mix(low, 'navy', 0.06) : low); c.fill(cover);
    c.save(); c.clip(cover);
    c.fillStyle = rgba('paper', 0.92); c.fillRect(x - w, y + h * 0.2, w * 2, h * 0.44);
    c.fillStyle = rgba('paper', 0.3); c.fillRect(x - w, y + h * 0.72, w * 2, 10); c.fillRect(x - w, y + h * 0.72 + 22, w * 2, 5);
    const sh = c.createLinearGradient(x, 0, x + sg * 70, 0);
    sh.addColorStop(0, rgba('ink', 0.2)); sh.addColorStop(1, rgba('ink', 0));
    c.fillStyle = sh; c.fillRect(Math.min(x, x + sg * 70), y, 70, h);
    c.restore();
  }
  c.fillStyle = mix(low, 'navy', 0.3); c.fillRect(x - 6, y - 2, 12, h + 2);
  c.fillStyle = rgba('paper', 0.5); c.fillRect(x - 1.5, y - 2, 3, h + 2);
  o.cover?.();
  // her fingers round the outer edges
  for (const sg of [-1, 1]) for (let i = 0; i < 4; i++) {
    const fy = y + h * 0.5 + i * 31 + (i === 3 ? -5 : 0), len = [50, 56, 54, 44][i]!, finger = new Path2D();
    finger.roundRect(sg > 0 ? x + w - len + 12 : x - w - 12, fy, len, 25, 12.5);
    const g = c.createLinearGradient(x + sg * (w - 50), 0, x + sg * (w + 12), 0);
    g.addColorStop(0, SKIN); g.addColorStop(1, SKIN_LOW);
    c.strokeStyle = mix(SKIN_LOW, 'ink', 0.22); c.lineWidth = 2.5; c.stroke(finger); c.fillStyle = g; c.fill(finger);
  }
}
/** The top of her desk under the book, seen from the front. */
export function drawDeskEdge(c: Ctx, y: number) {
  c.fillStyle = rgba('ink', 0.14); c.fillRect(250, y - 8, 1420, 12);
  fillV(c, y, y + 60, mix(WOOD, 'paper', 0.12), WOOD); c.fillRect(230, y, 1460, 60);
  fillV(c, y + 60, H + 40, WOOD_LOW, mix(WOOD_LOW, 'ink', 0.2)); c.fillRect(250, y + 60, 1420, H);
  c.fillStyle = rgba('paper', 0.3); c.fillRect(230, y, 1460, 4);
}
