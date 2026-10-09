// INTRO, shot 2 — the classroom on a sleepy sunny afternoon, seen from its back wall: her in the last row
// by the window, chin on hand, gazing out; rows of desks and students as soft silhouettes; him two rows
// ahead in a sunbeam, seen from behind; the blackboard, and above it the clock that runs half a beat slow.
// One-point perspective: the kit's figures and desks are placed row by row, smaller and higher toward the front.
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, hash, lerp, TAU } from '../engine/util';
import {
  atDesk, drawBoy, drawChair, drawClock, drawDesk, drawGirl, drawPen, drawStudent, dustMotes, layer, lightShaft,
  type Anchors, type Ctx, type LayerOpts, type Shaft, type V2,
} from './_love';
import { penSpin } from './intro-desk';

// ------------------------------------------------------------------ the room (in the figures' units: 615 = a standing figure)
/** The vanishing point (px of the picture), the focal length, and the camera's height above the floor. */
const VP: V2 = [800, 440], FOC = 1250, EYE = 560;
/** The window wall (x of the right wall), the corridor wall, the front wall, the ceiling; how near the walls are painted. */
const RIGHT = 700, LEFT = -2564, FAR = 3300, CEIL = 1267, NEAR = 520;
/** A point of the room on the picture: X to the right of the camera, Y above the floor, Z ahead. */
const P3 = (X: number, Y: number, Z: number): V2 => [VP[0] + (FOC * X) / Z, VP[1] - (FOC * (Y - EYE)) / Z];
const poly = (pts: V2[]) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
/** A rectangle on the front wall (X0..X1, Y0..Y1) as [x, y, w, h] of the picture. */
const onFront = (X0: number, Y0: number, X1: number, Y1: number): [number, number, number, number] => { const a = P3(X0, Y1, FAR), b = P3(X1, Y0, FAR); return [a[0], a[1], b[0] - a[0], b[1] - a[1]]; };

/** The seats: columns (X, from the window) and rows (Z, from the back). She is at [0][0], he at column 0 of row 2. */
const COLS = [480, 190, -100, -390, -680, -970, -1260, -1550], ROWS = [1000, 1430, 1860, 2290, 2720];
/** A seat on the picture: the floor under it, its scale, and how a figure facing the blackboard is turned to us there. */
const seatAt = (X: number, Z: number) => ({ x: VP[0] + (FOC * X) / Z, y: VP[1] + (FOC * EYE) / Z, scale: FOC / Z, facing: 180 + (Math.atan2(X, Z) * 180) / Math.PI });
/** Her seat and his. */
export const HER = seatAt(COLS[0]!, ROWS[0]!), HIM = seatAt(COLS[0]!, ROWS[2]!);
/** About where her right hand lies on her desk with the pen, and where her head is: for a camera that starts on one and rises to the other. */
export const HER_HAND: V2 = [1490, 771], HER_HEAD: V2 = [1430, 635];

/** The windows of the right wall (Z from, to), the sill and the head of each, and where the blinds of the nearest come down to. */
const WINDOWS: [number, number][] = [[800, 1500], [1680, 2380], [2560, 3200]], SILL = 346, HEAD = 998, BLINDS = 620;
/** The way the sunlight travels (it comes in through the right wall, down and a little toward the front). */
const SUN = [-1, -0.8, 0.15] as const;
/** The sunbeam through a window: its patch on the floor, and a shaft from the middle of the window to the middle of the patch. */
function beam([Z0, Z1]: [number, number], Y0 = SILL, Y1 = HEAD): { win: V2[]; patch: V2[]; shaft: Shaft } {
  const at = [[Y0, Z0], [Y0, Z1], [Y1, Z1], [Y1, Z0]] as const;
  const win = at.map(([Y, Z]) => P3(RIGHT, Y, Z)), patch = at.map(([Y, Z]) => { const k = Y / -SUN[1]; return P3(RIGHT + SUN[0] * k, 0, Z + SUN[2] * k); });
  const mid = (pts: V2[]): V2 => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  const a = mid(win), b = mid(patch), dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), across = win.map((p) => (p[0] * dy - p[1] * dx) / len);
  return { win, patch, shaft: { x: a[0], y: a[1], angle: Math.atan2(dx, dy), length: len * 1.08, width: (Math.max(...across) - Math.min(...across)) * 0.86, spread: 1 } };
}
const BEAMS = [beam(WINDOWS[0]!, SILL, BLINDS), beam(WINDOWS[1]!), beam(WINDOWS[2]!)];

const WALL = mix('paper', 'peach', 0.2), WALL_LOW = mix('paper', 'peach', 0.36);
const DADO = mix('sky', 'paper', 0.4), DADO_LOW = mix(mix('sky', 'paper', 0.25), 'navy', 0.07);
const SIDE = mix(mix('paper', 'peach', 0.4), 'ink', 0.09), SIDE_LOW = mix(mix('paper', 'peach', 0.55), 'ink', 0.2);
const FLOOR = mix(mix('paper', 'peach', 0.42), 'ink', 0.06), FLOOR_LOW = mix(mix('paper', 'peach', 0.68), 'ink', 0.26);
const BOARD = mix('navy', 'ink', 0.3), TRIM = mix('peach', 'ink', 0.35), AIR = mix('paper', 'peach', 0.35);

export interface RoomOpts {
  t: number; beat: number;
  /** Puts a context in the picture's space for a layer `depth` away: 1 = her, the front wall about 0.8. */
  place: (c: Ctx, depth: number) => void;
  /** How far the room has built up, 0..1 each: the rows ahead of her (nearest first), him, the blackboard, the chalk on it, the clock. Default: all of it. */
  build?: { rows: number[]; him: number; board: number; chalk: number; clock: number };
  /** The clock: the hour it shows, and where its second hand is (s). */
  time: number; sec: number;
  /** 0..1: how bright its light is on the light layer. */
  light?: number;
}

// ------------------------------------------------------------------ walls, windows, blackboard
/** What is seen through a window: the sky, and below the horizon the tops of the trees. */
function view(c: Ctx, win: V2[], t: number) {
  c.save(); c.clip(poly(win));
  const g = c.createLinearGradient(0, -300, 0, 820);
  g.addColorStop(0, mix('sky', 'paper', 0.12)); g.addColorStop(0.5, mix('sky', 'paper', 0.55)); g.addColorStop(0.66, mix('paper', 'gold', 0.3)); g.addColorStop(1, mix('gold', 'peach', 0.3));
  c.fillStyle = g; c.fillRect(900, -1300, 1700, 2600);
  for (let i = 0; i < 16; i++) {
    const x = 1020 + i * 78 + 30 * hash(i, 41), y = 560 + 70 * hash(i, 42) + 3 * Math.sin(t * 0.7 + i), r = 52 + 46 * hash(i, 43);
    c.fillStyle = mix(mix('gold', 'peach', 0.3 + 0.4 * hash(i, 44)), 'paper', 0.32); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  c.fillStyle = mix(mix('gold', 'peach', 0.6), 'paper', 0.25); c.fillRect(900, 650, 1700, 900);
  c.restore();
}

/** A curtain drawn half across a window (Z from, to), its hem lifting in the air from outside. */
function curtain(c: Ctx, Z0: number, Z1: number, t: number, seed: number) {
  const n = 8, X = RIGHT - 16, fold = (i: number): [V2, V2, V2] => {
    const Z = lerp(Z0, Z1, i / n), air = (0.5 + 0.5 * Math.sin(t * 0.8 + i * 0.9 + seed)) * (20 + 34 * (i % 2)) + 10 * Math.sin(t * 1.7 + i * 2.1 + seed);
    return [P3(X, 1016, Z), P3(X - air * 0.45, 620, Z + air * 0.2), P3(X - air, 236 + 12 * Math.sin(i * 1.9 + seed), Z + air * 0.5)];
  };
  const folds = Array.from({ length: n + 1 }, (_, i) => fold(i)), cloth = new Path2D();
  folds.forEach(([a], i) => (i ? cloth.lineTo(a[0], a[1]) : cloth.moveTo(a[0], a[1])));
  for (let i = n; i >= 0; i--) { const [, m, b] = folds[i]!; if (i === n) cloth.lineTo(m[0], m[1]); cloth.lineTo(b[0], b[1]); }
  cloth.lineTo(folds[0]![1][0], folds[0]![1][1]); cloth.closePath();
  const ys = folds.flatMap((f) => [f[0][1], f[2][1]]), g = c.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
  g.addColorStop(0, mix('sky', 'paper', 0.34)); g.addColorStop(1, mix('sky', 'navy', 0.07));
  c.fillStyle = g; c.fill(cloth);
  // the pleats: a darker fold, a lighter one
  c.lineCap = 'round';
  folds.forEach(([a, m, b], i) => {
    c.strokeStyle = i % 2 ? mix('sky', 'navy', 0.3, 0.3) : rgba('paper', 0.42); c.lineWidth = lerp(7, 3.5, i / n);
    c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(m[0], m[1], b[0], b[1]); c.stroke();
  });
}

/** The blackboard on the front wall: its frame, what the eraser left, and three lots of chalk written one after the other. */
function board(c: Ctx, shown: number, written: number) {
  if (shown <= 0.003) return;
  const [x, y, w, h] = onFront(-1815, 365, -49, 845);
  c.save(); c.globalAlpha *= shown; c.translate(0, (1 - shown) * 12);
  c.fillStyle = TRIM; c.fillRect(x - 9, y - 9, w + 18, h + 18);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, mix(BOARD, 'navy', 0.3)); g.addColorStop(1, BOARD);
  c.fillStyle = g; c.fillRect(x, y, w, h);
  for (let i = 0; i < 7; i++) { c.fillStyle = rgba('paper', 0.03 + 0.03 * hash(i, 51)); c.beginPath(); c.ellipse(x + w * (0.1 + 0.8 * hash(i, 52)), y + h * (0.25 + 0.55 * hash(i, 53)), 60 + 60 * hash(i, 54), 20 + 16 * hash(i, 55), -0.2, 0, TAU); c.fill(); }
  c.fillStyle = mix(TRIM, 'paper', 0.3); c.fillRect(x - 14, y + h + 9, w + 28, 7);
  c.fillStyle = rgba('paper'); c.fillRect(x + 96, y + h + 5, 20, 5); c.fillRect(x + 330, y + h + 5, 14, 5);
  c.fillStyle = rgba('blush'); c.fillRect(x + 122, y + h + 5, 16, 5);
  c.fillStyle = mix('frost', 'navy', 0.3); c.fillRect(x + w - 120, y + h + 1, 34, 9);
  const lot = (k: number, x0: number, x1: number, draw: () => void) => {
    const u = clamp(written * 3 - k);
    if (u <= 0) return;
    c.save(); c.beginPath(); c.rect(x0, y, u >= 1 ? x1 - x0 + 60 : (x1 - x0) * u, h); c.clip(); draw(); c.restore();
  };
  c.fillStyle = rgba('paper', 0.88); c.strokeStyle = rgba('paper', 0.8); c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  lot(0, x + 18, x + 232, () => {
    c.font = font(F.hand(400), 30); c.fillText('y = ax² + bx + c', x + 22, y + 44);
    c.beginPath(); c.moveTo(x + 40, y + 140); c.lineTo(x + 206, y + 140); c.moveTo(x + 84, y + 166); c.lineTo(x + 84, y + 66);
    for (let i = 0; i <= 20; i++) { const u = lerp(-1, 1, i / 20), px = x + 134 + 52 * u, py = y + 154 - 78 * u * u; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
  });
  lot(1, x + 250, x + 482, () => {
    c.font = font(F.hand(400), 29); c.fillText('△ = b² - 4ac', x + 262, y + 84);
    c.font = font(F.hand(400), 26); c.fillText('x = (-b ± √△) / 2a', x + 252, y + 136);
    c.beginPath(); c.moveTo(x + 250, y + 150); c.lineTo(x + 478, y + 148); c.stroke();
  });
  lot(2, x + 440, x + w - 12, () => {
    c.font = font(F.hand(500), 25); c.textAlign = 'right'; c.fillText('10月9日  星期五', x + w - 16, y + 38); c.textAlign = 'left';
    c.beginPath(); c.moveTo(x + 520, y + 150); c.lineTo(x + 604, y + 150); c.lineTo(x + 520, y + 92); c.closePath(); c.stroke();
    c.font = font(F.hand(400), 22); c.fillText('a² + b² = c²', x + 528, y + 82);
  });
  c.restore();
}

function shell(c: Ctx, o: RoomOpts, b: NonNullable<RoomOpts['build']>) {
  const t = o.t, grad = (x0: number, y0: number, x1: number, y1: number, a: string, z: string) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, z); return g; };
  const far = (X: number, Y: number) => P3(X, Y, FAR), near = (X: number, Y: number) => P3(X, Y, NEAR);
  // ceiling, front wall with its painted dado, floor, the two side walls
  c.fillStyle = grad(0, far(0, CEIL)[1], 0, -600, mix('paper', 'frost', 0.16), mix('paper', 'frost', 0.34));
  c.fill(poly([far(LEFT, CEIL), far(RIGHT, CEIL), near(RIGHT, CEIL), near(LEFT, CEIL)]));
  const [fx, fy, fw, fh] = onFront(LEFT, 0, RIGHT, CEIL), dado = far(0, 330)[1];
  c.fillStyle = grad(0, fy, 0, fy + fh, WALL, WALL_LOW); c.fillRect(fx - 600, fy, fw + 600, fh);
  c.fillStyle = grad(0, dado, 0, fy + fh, DADO, DADO_LOW); c.fillRect(fx - 600, dado, fw + 600, fy + fh - dado);
  c.fillStyle = grad(0, fy + fh, 0, 1400, FLOOR, FLOOR_LOW);
  c.fill(poly([far(LEFT, 0), far(RIGHT, 0), near(RIGHT, 0), near(LEFT, 0)]));
  // (the boards of the floor, running to the front)
  c.strokeStyle = rgba('ink', 0.045); c.lineWidth = 1.5; c.beginPath();
  for (let X = LEFT; X < RIGHT; X += 170) { const a = far(X, 0), z = near(X, 0); c.moveTo(a[0], a[1]); c.lineTo(z[0], z[1]); }
  c.stroke();
  const side = far(RIGHT, 0)[0];
  c.fillStyle = grad(side, 0, 2100, 0, SIDE, SIDE_LOW);
  c.fill(poly([far(RIGHT, CEIL), near(RIGHT, CEIL), near(RIGHT, 0), far(RIGHT, 0)]));
  c.fillStyle = grad(side, 0, 2100, 0, mix(DADO, 'ink', 0.08), mix(DADO_LOW, 'ink', 0.2));
  c.fill(poly([far(RIGHT, 330), near(RIGHT, 330), near(RIGHT, 0), far(RIGHT, 0)]));
  // where the sun lands on the floor
  c.save(); c.filter = 'blur(5px)';
  BEAMS.forEach((bm, i) => { c.fillStyle = mix('gold', 'paper', 0.25, i ? 0.5 : 0.3); c.fill(poly(bm.patch)); });
  c.restore();
  // the front wall: blackboard, the clock above it, a notice board, the teacher's desk
  board(c, b.board, b.chalk);
  if (b.clock > 0.003) { const [cx, cy] = far(-932, 1020), k = b.clock; drawClock(c, cx, cy, 37 * (0.6 + 0.4 * k), { time: o.time, sec: o.sec, alpha: clamp(k * 1.6) }); }
  {
    const [x, y, w, h] = onFront(120, 470, 560, 850);
    c.fillStyle = TRIM; c.fillRect(x - 5, y - 5, w + 10, h + 10);
    c.fillStyle = mix('peach', 'paper', 0.35); c.fillRect(x, y, w, h);
    const sheets = [rgba('paper'), mix('paper', 'blush', 0.5), mix('paper', 'sky', 0.45), rgba('paper'), mix('paper', 'gold', 0.5), rgba('paper')];
    sheets.forEach((col, i) => { c.save(); c.translate(x + 30 + (i % 3) * 53, y + 36 + Math.floor(i / 3) * 68); c.rotate((hash(i, 61) - 0.5) * 0.14); c.fillStyle = col; c.fillRect(-21, -27, 42, 54); c.fillStyle = rgba('ink', 0.16); for (let l = 0; l < 4; l++) c.fillRect(-14, -17 + l * 9, 20 + 8 * hash(i, l), 2); c.restore(); });
    const a = P3(-1162, 346, 2950), z = P3(-702, 0, 2950), top = P3(-1150, 346, 3090), top2 = P3(-714, 346, 3090);
    c.fillStyle = mix(TRIM, 'paper', 0.34); c.fill(poly([a, [z[0], a[1]], top2, top]));
    c.fillStyle = grad(0, a[1], 0, z[1], mix(TRIM, 'paper', 0.16), TRIM); c.fillRect(a[0], a[1], z[0] - a[0], z[1] - a[1]);
  }
  // the windows of the right wall: what is outside, frame and bars, the sill
  WINDOWS.forEach(([Z0, Z1], i) => {
    const q = (Y: number, Z: number) => P3(RIGHT, Y, Z), win = [q(HEAD, Z1), q(HEAD, Z0), q(SILL, Z0), q(SILL, Z1)];
    view(c, win, t);
    if (i === 0) {
      // the nearest one has its blinds down to her eye level: the stripes on her desk
      c.fillStyle = mix('paper', 'frost', 0.25, 0.94);
      for (let Y = HEAD; Y > BLINDS; Y -= 30) c.fill(poly([q(Y, Z1), q(Y, Z0), q(Y - (Y - 30 > BLINDS ? 15 : 24), Z0), q(Y - (Y - 30 > BLINDS ? 15 : 24), Z1)]));
    }
    c.strokeStyle = rgba('paper'); c.lineJoin = 'round'; c.lineCap = 'round';
    const line = (a: V2, z: V2, w: number) => { c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(z[0], z[1]); c.stroke(); };
    const wd = (Z: number) => (FOC / Z) * 20;
    for (const u of [0, 1 / 3, 2 / 3, 1]) { const Z = lerp(Z0, Z1, u); line(q(HEAD, Z), q(SILL, Z), wd(Z) * (u % 1 ? 0.7 : 1)); }
    for (const Y of [HEAD, 810, SILL]) for (let k = 0; k < 6; k++) { const Za = lerp(Z0, Z1, k / 6), Zb = lerp(Z0, Z1, (k + 1) / 6); line(q(Y, Za), q(Y, Zb), wd((Za + Zb) / 2) * (Y === 810 ? 0.6 : 1)); }
    c.fillStyle = mix('paper', 'peach', 0.12); c.fill(poly([q(SILL, Z0 - 30), q(SILL, Z1 + 30), P3(RIGHT - 50, SILL - 4, Z1 + 30), P3(RIGHT - 50, SILL - 4, Z0 - 30)]));
    c.fillStyle = mix(SIDE_LOW, 'ink', 0.1); c.fill(poly([P3(RIGHT - 50, SILL - 4, Z0 - 30), P3(RIGHT - 50, SILL - 4, Z1 + 30), P3(RIGHT - 50, SILL - 26, Z1 + 30), P3(RIGHT - 50, SILL - 26, Z0 - 30)]));
  });
  curtain(c, 2380, 2470, t, 5); curtain(c, 1500, 1610, t, 3);
  curtain(c, 1140, 1500, t, 1);
  // the strip lights (off: it is a sunny afternoon)
  c.fillStyle = rgba('paper', 0.9);
  for (const [X, Z] of [[-300, 1500], [-300, 2500], [-1700, 1500], [-1700, 2500]]) c.fill(poly([P3(X - 240, CEIL - 20, Z), P3(X + 240, CEIL - 20, Z), P3(X + 240, CEIL - 20, Z + 60), P3(X - 240, CEIL - 20, Z + 60)]));
}

// ------------------------------------------------------------------ the people
/** The students of one row and their desks (the seats that are his and hers stay free). */
function row(c: Ctx, r: number, t: number) {
  COLS.forEach((X, k) => {
    const s = seatAt(X, ROWS[r]!);
    if (s.x < -170 || (k === 0 && r === 2)) return;
    const h = (q: number) => hash(r, k, q + 20), boy = h(0) < 0.5, empty = (r === 1 && k === 0) || h(1) < 0.1;
    const p = { ...s, t: t + h(2) * 20 };
    atDesk(c, { ...p, boy }, () => {
      if (empty) return;
      drawStudent(c, h(3) < 0.22 ? 'chin-on-hand' : 'sit-write', { ...p, boy, headTurn: h(3) > 0.8 ? (h(4) - 0.5) * 70 : 0, nod: (h(5) - 0.6) * 22, silhouette: mix('frost', 'sky', 0.15 + 0.6 * h(6)) });
    });
  });
}

const kept = new Map<number, HTMLCanvasElement>(), EDGE = 40;
/**
 * A row far enough from the camera that its students' small movements cannot be seen: painted once, with the
 * air's haze over it, at `res` of the picture's resolution (the soft focus of the far rows), and kept.
 */
function farRow(c: Ctx, r: number, haze: number, res: number) {
  let cv = kept.get(r);
  if (!cv) {
    kept.set(r, (cv = document.createElement('canvas')));
    cv.width = Math.round((W + EDGE * 2) * SCALE * res); cv.height = Math.round((H + EDGE * 2) * SCALE * res);
    const x = scaleContext2D(cv.getContext('2d')!, SCALE * res);
    x.translate(EDGE, EDGE); row(x, r, 0);
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgba(AIR, haze); x.fillRect(-EDGE, -EDGE, W + EDGE * 2, H + EDGE * 2);
  }
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(cv, -EDGE, -EDGE, W + EDGE * 2, H + EDGE * 2);
}

/** Her, at her desk by the window: chin on hand, the pen turning in the other, her face to the light. */
function her(c: Ctx, o: RoomOpts): Anchors {
  const p = { x: HER.x, y: HER.y, scale: HER.scale, facing: 158 }, s = p.scale;
  drawDesk(c, p);
  // (her notebook, open on the desk)
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(p.x + 44 * s, p.y - 287 * s, 84 * s, 5 * s, 2 * s); c.fill();
  const a = drawGirl(c, 'chin-on-hand', { ...p, t: o.t, headTurn: -62, tilt: -3, nod: -2, wind: -0.08 + 0.05 * Math.sin(o.t * 0.7), blush: 0.6, outfit: 'autumn', light: [0.85, -0.5] });
  // the pen, turning flat above the desk (seen from here, an ellipse)
  const turnAt = 0.5 - penSpin(o.beat) * TAU;
  c.save(); c.translate(a.handR[0] + 2 * s, a.handR[1] - 6 * s); c.scale(1, 0.42);
  drawPen(c, -8 * 1.5 * s * Math.sin(turnAt), 8 * 1.5 * s * Math.cos(turnAt), 1.5 * s, turnAt);
  c.restore();
  drawChair(c, p);
  return a;
}

/** Him, two rows ahead of her, seen from behind. */
function him(c: Ctx, t: number): Anchors {
  const p = { ...HIM, t };
  return atDesk(c, { ...p, boy: true }, () => drawBoy(c, 'sit-write', { ...p, outfit: 'autumn', nod: -10, light: [0.9, -0.45] }));
}

// ------------------------------------------------------------------ the picture
const ALL = { rows: [1, 1, 1, 1], him: 1, board: 1, chalk: 1, clock: 1 };
/**
 * The classroom. Paints the picture and well beyond its edges (a camera can start close on her and pull back).
 * `c`: the picture; `g`: the light layer (the windows, the sunbeams, the dust in them).
 */
export function drawClassroom(c: Ctx, g: Ctx, o: RoomOpts) {
  const b = o.build ?? ALL, t = o.t, light = o.light ?? 1;
  const L = (depth: number, opts: LayerOpts, draw: (c: Ctx) => void) => { if ((opts.alpha ?? 1) > 0.003) layer(c, { hazeColor: AIR, ...opts }, (cc) => { o.place(cc, depth); cc.translate(0, (1 - (opts.alpha ?? 1)) * 26); draw(cc); }); };
  L(0.8, {}, (cc) => shell(cc, o, b));
  L(0.84, { alpha: b.rows[3] }, (cc) => farRow(cc, 4, 0.3, 0.5));
  L(0.87, { alpha: b.rows[2] }, (cc) => farRow(cc, 3, 0.22, 0.5));
  // the sunbeams of the two far windows cross the room here; his seat is in the nearer one
  c.save(); o.place(c, 0.9);
  lightShaft(c, BEAMS[2]!.shaft, { alpha: 0.16, t }); lightShaft(c, BEAMS[1]!.shaft, { alpha: 0.24 * (0.4 + 0.6 * b.him), t });
  c.restore();
  L(0.9, { alpha: b.rows[1] }, (cc) => farRow(cc, 2, 0.12, 1));
  L(0.9, { haze: 0.03, alpha: b.him }, (cc) => { him(cc, t); });
  c.save(); o.place(c, 0.9); lightShaft(c, BEAMS[1]!.shaft, { alpha: 0.07 * b.him, t }); c.restore();
  L(0.95, { haze: 0.05, alpha: b.rows[0] }, (cc) => row(cc, 1, t));
  L(1, {}, (cc) => { her(cc, o); });
  if (light <= 0.003) return;
  // the light: the windows themselves, the beams (faintly: they glow), his sunbeam on him, the dust
  g.save(); o.place(g, 0.8); g.globalAlpha *= light;
  // (of the nearest window only the open part beside the curtain: her head is in front of the rest)
  WINDOWS.forEach(([Z0, Z1], i) => { const z = i ? Z1 : 1140; g.fillStyle = mix('paper', 'gold', 0.3, 0.075); g.fill(poly([P3(RIGHT, HEAD, z), P3(RIGHT, HEAD, Z0), P3(RIGHT, SILL, Z0), P3(RIGHT, SILL, z)])); });
  g.restore();
  g.save(); o.place(g, 0.9); g.globalAlpha *= light;
  lightShaft(g, BEAMS[1]!.shaft, { alpha: 0.022, t }); lightShaft(g, BEAMS[2]!.shaft, { alpha: 0.015, t });
  dustMotes(g, t, { shafts: BEAMS.map((bm) => bm.shaft), count: 110, seed: 4 });
  g.restore();
}
