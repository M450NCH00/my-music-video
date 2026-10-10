// BRIDGE, the sets — where the four lines are staged (bridge.ts):
//   the front of the school again, as the intro has it (intro-outside.ts), but with no end to it: a wall of classroom
//     windows for as far as the camera can go back, her at one of them in the afternoon, him at another in the evening
//   a sheet of composition paper, which is what that wall lies down into, every window a square: the two of them
//     doodled in two of its squares, the dotted path from hers to his, and the pencil that draws it
//   the front wall of the classroom, its board wiped, for the clock
//   the drop of rain that lands on the clock's glass, and the rain its rings let in: where the finale starts (BRIDGE_RAIN)
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import type { Lyrics } from '../engine/lyrics';
import { mix, rgba } from '../engine/palette';
import { clamp, hash, lerp, smoothstep, TAU } from '../engine/util';
import { DESK_TOP, dottedPath, drawBoy, drawGirl, glow, paperGrain, rain, scratch, soundRing, sparkle, type Ctx, type V2 } from './_love';
import { CLOCK_AT, CLOCK_R, shell } from './intro-classroom';
import { PITCH, WALL, WALL_LOW, WIN, dressing, miniRoom } from './intro-outside';
import { drawPencil } from './verse1-sets';
import { ring, sketch } from './verse2-sets';

// ------------------------------------------------------------------ the grid: a wall of windows, a sheet of squares
/**
 * A look at the grid, which is the wall of windows and then the sheet of paper: column `u`, row `v` of it are in the
 * middle of the frame, a column is `px` wide, and `flat` (0..1) is how far the wall has lain down into paper. On the
 * wall a row is as high as a floor of the intro's building; on the paper it is a square and the strip under it.
 */
export interface GridCam { u: number; v: number; px: number; flat: number }
/** The height of a row, in columns: on the wall, and on the paper. */
const FLOOR = PITCH[1] / PITCH[0], ROW = 1.25;
const rowOf = (px: number, flat: number) => px * lerp(FLOOR, ROW, flat);
/** The look that has cell (i, j) at (x, y) on screen. */
export const lookAt = (px: number, flat: number, [i, j]: V2, [x, y]: V2): GridCam => ({ px, flat, u: i - (x - W / 2) / px, v: j - (y - H / 2) / rowOf(px, flat) });
/** The middle of cell (i, j) on screen. */
export const cellAt = (cam: GridCam, i: number, j: number): V2 => [W / 2 + (i - cam.u) * cam.px, H / 2 + (j - cam.v) * rowOf(cam.px, cam.flat)];
/** The window of a cell: as large in it as the intro's windows are in theirs. */
const windowAt = (cam: GridCam, i: number, j: number) => {
  const [x, y] = cellAt(cam, i, j), w = (WIN.w / PITCH[0]) * cam.px, h = (WIN.h / PITCH[1]) * rowOf(cam.px, cam.flat);
  return { x: x - w / 2, y: y - h / 2, w, h };
};
/**
 * The square a cell's window becomes: the window itself until the wall is half down, then it grows until it is as wide
 * as its column, and as high. `whole`: a square of the paper already (the squares a line is written in, on the wall).
 */
export const squareAt = (cam: GridCam, i: number, j: number, whole = false) => {
  const a = windowAt(cam, i, j), k = whole ? 1 : smoothstep(0.5, 1, cam.flat), w = lerp(a.w, cam.px, k), h = lerp(a.h, cam.px, k);
  return { x: a.x + (a.w - w) / 2, y: a.y + (a.h - h) / 2, w, h };
};

/**
 * The sheet as it lies once the wall has become it: a square is `cell` px wide, and column `u`, row `v` are in the middle
 * of the frame (the rows at y = 150, 320, 490 ...). Her square and his; the first squares of the two lines that are
 * written on it, a character a square; and the squares the dotted path goes through from hers to his.
 */
export const SHEET = {
  cell: 136, u: 6.5, v: 39 / 17,
  her: [2, 4] as V2, him: [11, 1] as V2, line2: [1, 0] as V2, line3: [1, 1] as V2,
  trail: [[2, 4], [3, 4], [4, 4], [5, 4], [5, 3], [6, 3], [7, 3], [8, 3], [8, 2], [9, 2], [10, 2], [11, 2], [11, 1]] as V2[],
};
const REST: GridCam = { u: SHEET.u, v: SHEET.v, px: SHEET.cell, flat: 1 };
/** His square on screen, on the sheet at rest: the paper closes to a circle on it, and the circle is the clock's face. */
export const CLOCK_ON: V2 = cellAt(REST, SHEET.him[0], SHEET.him[1]);

// ------------------------------------------------------------------ the wall
/**
 * The wall repeats every four windows each way: they are painted once, `res` px to a unit of the intro's building, and
 * laid like tiles (a pattern, kept: one made afresh for each frame has its picture copied for each frame).
 */
const N = 4, tiles = new Map<number, CanvasPattern | null>();
function tile(c: Ctx, res: number) {
  if (tiles.has(res)) return tiles.get(res)!;
  const cv = document.createElement('canvas');
  cv.width = Math.round(N * PITCH[0] * res * SCALE); cv.height = Math.round(N * PITCH[1] * res * SCALE);
  const b = scaleContext2D(cv.getContext('2d')!, res * SCALE), x0 = (PITCH[0] - WIN.w) / 2, y0 = (PITCH[1] - WIN.h) / 2;
  // the line of each floor (the one under the lowest row is the one over the top row again)
  for (let j = 0; j <= N; j++) {
    const y = j * PITCH[1] + y0 - 34;
    b.fillStyle = rgba('paper', 0.3); b.fillRect(0, y, N * PITCH[0], 5); b.fillStyle = rgba('ink', 0.07); b.fillRect(0, y + 5, N * PITCH[0], 4);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * PITCH[0] + x0, y = j * PITCH[1] + y0;
    b.fillStyle = rgba('ink', 0.1); b.fillRect(x - 6, y - 7, WIN.w + 9, WIN.h + 10);
    miniRoom(b, x, y, WIN.w, WIN.h, 100 + i * 7 + j * 31);
    dressing(b, x, y, WIN.w, WIN.h);
  }
  const p = c.createPattern(cv, 'repeat');
  tiles.set(res, p);
  return p;
}

/**
 * Who sits at the window of a cell, and what time it is in that room: she in the afternoon, chin in her hand, looking
 * out along the wall; he in the evening, writing under a lamp, his scarf on (each in the pane under the bar, in the
 * middle of the window). `light`: how much of the room's light is on the light layer.
 */
function room(c: Ctx, g: Ctx, cam: GridCam, [i, j]: V2, him: boolean, t: number, light: number) {
  const { x, y, w, h } = windowAt(cam, i, j), z = cam.px / PITCH[0], s = 0.5 * z;
  if (x > W || x + w < 0 || y > H || y + h < 0) return;
  // (the glass is hazy, as every window's is; the one who sits at it is painted clear of that, in the pane's opening)
  const pane = () => { c.restore(); dressing(c, x, y, w, h); c.save(); c.beginPath(); c.rect(x + w * 0.343, y + h * 0.3 + w * 0.0095, w * 0.314, h * 0.7 - w * 0.0245); c.clip(); };
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  miniRoom(c, x, y, w, h, him ? 71 : 137);
  if (him) {
    // (the class is still at its desks, in the dark blue of the evening; the lamp is his)
    const lx = x + w * 0.4, ly = y + h - 6 * z, pool = c.createRadialGradient(lx, ly, 0, lx, ly, w * 0.46);
    c.fillStyle = mix('navy', 'dusk', 0.3, 0.84); c.fillRect(x, y, w, h);
    pool.addColorStop(0, mix('gold', 'paper', 0.3, 0.7)); pool.addColorStop(0.5, rgba('gold', 0.22)); pool.addColorStop(1, rgba('gold', 0));
    c.fillStyle = pool; c.fillRect(x, y, w, h);
    pane();
    drawBoy(c, 'sit-write', { x: x + w * 0.56, y: y + h + (DESK_TOP * 1.05 + 26) * s, scale: s, facing: -62, t, outfit: 'winter', scarf: true, light: [-0.7, 0.5] });
    glow(g, lx, ly, w * 0.4, { alpha: 0.5 * light });
  } else {
    // (the sun is low: it lies across the room behind her, and on her)
    c.fillStyle = mix('gold', 'peach', 0.3, 0.3); c.fillRect(x, y, w, h);
    c.fillStyle = mix('paper', 'gold', 0.5, 0.42);
    c.beginPath(); c.moveTo(x + w * 0.16, y); c.lineTo(x + w * 0.4, y); c.lineTo(x + w * 0.14, y + h); c.lineTo(x - w * 0.1, y + h); c.closePath(); c.fill();
    pane();
    drawGirl(c, 'chin-on-hand', { x: x + w * 0.36, y: y + h + (DESK_TOP + 36) * s, scale: s, facing: 64, t, outfit: 'autumn', headTurn: -30, blush: 0.6, wind: 0.04, light: [0.85, -0.4] });
    glow(g, x + w / 2, y + h / 2, w * 0.95, { alpha: 0.2 * light });
  }
  c.restore();
}

export interface WallOpts {
  t: number; cam: GridCam;
  /** The cells of her window and of his. */
  her: V2; him: V2;
  /** 0..1: how much of the light of their two rooms there is (on the light layer). */
  light?: number;
}
/** The wall of windows. `c`: the picture (the whole frame is painted); `g`: the light layer. */
export function drawWall(c: Ctx, g: Ctx, o: WallOpts) {
  const { t, cam } = o, z = cam.px / PITCH[0], zy = rowOf(cam.px, cam.flat) / PITCH[1], res = z > 1 ? 2 : 1, wall = c.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, WALL); wall.addColorStop(1, WALL_LOW);
  c.fillStyle = wall; c.fillRect(0, 0, W, H);
  // (never less than half its size, nor much over it: plain smoothing is enough)
  const p = tile(c, res), [x0, y0] = cellAt(cam, -0.5, -0.5);
  if (p) {
    p.setTransform(new DOMMatrix().translate(x0, y0).scale(z / (res * SCALE), zy / (res * SCALE)));
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'low'; c.fillStyle = p; c.fillRect(0, 0, W, H); c.restore();
  }
  room(c, g, cam, o.her, false, t, o.light ?? 1); room(c, g, cam, o.him, true, t, o.light ?? 1);
}

// ------------------------------------------------------------------ the sheet of composition paper
export const PAPER = mix('paper', 'frost', 0.22), RULE = mix('rose', 'ink', 0.4, 0.36), GRAPHITE = mix('ink', 'navy', 0.3);
/**
 * The sheet over the whole frame, `alpha` of it there: the paper, and its squares (`ink`: how much of their lines).
 * `whole(i, j)`: the cells that are squares of the paper already while the others are still windows.
 */
export function drawSheet(c: Ctx, cam: GridCam, alpha = 1, o: { ink?: number; whole?: (i: number, j: number) => boolean } = {}) {
  if (alpha <= 0.003) return;
  const row = rowOf(cam.px, cam.flat), di = W / 2 / cam.px + 1, dj = H / 2 / row + 1, squares = new Path2D();
  c.save(); c.globalAlpha *= alpha;
  c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
  paperGrain(c, { alpha: 0.85, scale: 1.5 });
  for (let i = Math.floor(cam.u - di); i <= Math.ceil(cam.u + di); i++) for (let j = Math.floor(cam.v - dj); j <= Math.ceil(cam.v + dj); j++) {
    const r = squareAt(cam, i, j, o.whole?.(i, j));
    squares.rect(r.x, r.y, r.w, r.h);
  }
  c.globalAlpha *= o.ink ?? 1; c.strokeStyle = RULE; c.lineWidth = 1.6; c.stroke(squares);
  c.restore();
}

/** The two of them as she doodles them, each at a desk (in units of a square, round its middle): she looks to the right, he to the left. */
const DOODLE = {
  her: [
    ring(-0.07, -0.19, 0.095, 14), [[-0.14, -0.25], [-0.22, -0.23], [-0.27, -0.13], [-0.23, -0.03]], [[-0.07, -0.09], [-0.2, 0.19], [0.06, 0.19], [-0.07, -0.09]],
    [[-0.04, 0], [0.1, 0.08]], [[-0.12, 0.19], [-0.12, 0.33]], [[-0.02, 0.19], [-0.02, 0.33]], [[0.05, 0.09], [0.31, 0.09]], [[0.27, 0.09], [0.27, 0.33]],
  ] as V2[][],
  him: [
    ring(0.07, -0.19, 0.095, 14), [[-0.02, -0.26], [0.02, -0.34], [0.05, -0.27], [0.09, -0.35], [0.12, -0.27], [0.17, -0.32]], [[0.07, -0.09], [0.07, 0.17]],
    [[0.07, 0.17], [-0.05, 0.17], [-0.05, 0.33]], [[0.07, 0], [-0.1, 0.08]], [[-0.31, 0.09], [-0.05, 0.09]], [[-0.27, 0.09], [-0.27, 0.33]],
  ] as V2[][],
  scarf: [[[0, -0.08], [0.14, -0.08]], [[0.13, -0.08], [0.18, 0.06]]] as V2[][],
};
/** One of the two doodles in the middle of a square `size` px wide. (His scarf is the only rose on the sheet.) */
export function drawDoodled(c: Ctx, who: 'her' | 'him', [x, y]: V2, size: number, alpha = 1) {
  if (alpha <= 0.003) return;
  const w = Math.max(1.5, size * 0.03);
  size *= 1.18;
  sketch(c, DOODLE[who], x, y + size * 0.03, size, 1, { color: rgba(GRAPHITE, 0.82 * alpha), width: w, seed: who === 'her' ? 3 : 5 });
  if (who === 'him') sketch(c, DOODLE.scarf, x, y + size * 0.03, size, 1, { color: rgba('rose', 0.85 * alpha), width: w * 1.6, seed: 7 });
}

/**
 * The dotted path (the kit's) through the squares `cells`, `steps` squares of it drawn so far: it leaves the first
 * square by its side and stops at the edge of the last. Returns where its end is: the point of the pencil.
 */
export function drawTrail(c: Ctx, cam: GridCam, cells: V2[], steps: number, alpha = 1): V2 {
  const pts = cells.map(([i, j]) => cellAt(cam, i, j)), n = pts.length - 1, between = (a: V2, b: V2, k: number): V2 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  pts[0] = between(pts[0]!, pts[1]!, 0.44); pts[n] = between(pts[n - 1]!, pts[n]!, 0.54);
  const len = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1])), s = clamp(steps, 0, n), whole = Math.floor(s);
  const done = len.slice(0, whole).reduce((a, b) => a + b, 0) + (s - whole) * (len[whole] ?? 0);
  return dottedPath(c, pts, done / len.reduce((a, b) => a + b, 0), { color: GRAPHITE, alpha: 0.7 * alpha, width: cam.px * 0.034, gap: cam.px * 0.19, seed: 9 });
}

/** Her pencil, its point on (x, y) of the paper, held from the lower right. `lift` (0..1): off the paper, and away the way it came. */
export function drawPencilAt(c: Ctx, [x, y]: V2, t: number, lift = 0) {
  const len = 470, rot = -2.3 + 0.025 * Math.sin(t * 2.1) * (1 - lift) + 0.16 * lift, tx = x + 620 * lift, ty = y + 520 * lift;
  // (its shadow on the paper: further from it the higher it is held)
  c.save(); c.translate(tx + 5 + 30 * lift, ty + 7 + 36 * lift); c.rotate(rot);
  c.fillStyle = rgba('ink', 0.13 - 0.06 * lift); c.beginPath(); c.roundRect(-len, -len * 0.04, len * 0.97, len * 0.08, len * 0.03); c.fill();
  c.restore();
  drawPencil(c, tx - (len / 2) * Math.cos(rot), ty - (len / 2) * Math.sin(rot), len, rot, 0);
}

// ------------------------------------------------------------------ the clock on the classroom's front wall
/** How large the classroom picture is under the camera of the last line: as it starts, and as it ends. */
export const CLOCK_ZOOM: V2 = [5.3, 5.5];
let front: { cv: HTMLCanvasElement; x: number; y: number; w: number; h: number } | null = null;
/**
 * The front wall of the classroom round its clock, the board wiped: the classroom picture (intro-classroom.ts) under a
 * camera that has the middle of the clock at `at` on screen, `zoom` times its size. Nothing moves on it, so it is painted
 * once (as large as it is ever seen, and as much of it as is ever seen). The clock itself is the scene's to paint.
 */
export function drawFront(c: Ctx, at: V2, zoom: number) {
  if (!front) {
    const [z0, z1] = CLOCK_ZOOM, x = CLOCK_AT[0] - at[0] / z0 - 4, y = CLOCK_AT[1] - at[1] / z0 - 4, w = W / z0 + 8, h = H / z0 + 8, cv = document.createElement('canvas');
    cv.width = Math.round(w * z1 * SCALE); cv.height = Math.round(h * z1 * SCALE);
    const b = scaleContext2D(cv.getContext('2d')!, z1 * SCALE);
    b.translate(-x, -y);
    shell(b, { t: 0, time: 0, sec: 0 }, { rows: [1, 1, 1, 1], him: 1, board: 1, chalk: 0, clock: 0 });
    front = { cv, x, y, w, h };
  }
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(front.cv, at[0] + (front.x - CLOCK_AT[0]) * zoom, at[1] + (front.y - CLOCK_AT[1]) * zoom, front.w * zoom, front.h * zoom);
  c.restore();
}

// ------------------------------------------------------------------ the drop of rain, and the rain
const corners: V2[] = [[0, 0], [W, 0], [0, H], [W, H]], RIM = CLOCK_R * CLOCK_ZOOM[1];
/**
 * The handoff from the bridge to the finale: one drop of rain has landed on the glass of the clock, at `at`, and its
 * first ring has gone out over the whole frame; inside it it rains. The bridge's last frame is `drawRainIn(c, g, { t,
 * since, cover })` and nothing else, with nothing on the light layer: `sky` down the frame (a linear gradient, stops
 * at 0, 0.5 and 1), the kit's rain with `rain` for its options, and three more rings still on their way out. The finale
 * starts on the same call (`since` = `t - rainHit(lyrics)`, `cover` = its own start less `rainHit(lyrics)`, and
 * `null` for `g`), and puts its gate under it.
 */
export const BRIDGE_RAIN = {
  at: [CLOCK_ON[0] - 0.26 * RIM, CLOCK_ON[1] - 0.34 * RIM] as V2,
  sky: [mix(mix('frost', 'sky', 0.3), 'navy', 0.36), mix('frost', 'sky', 0.5), mix('frost', 'paper', 0.4)],
  rain: { count: 150, seed: 61, wind: -0.2 },
};
/** When the drop lands: as the last character of the bridge's last line starts being sung (铃). */
export const rainHit = (ly: Lyrics) => { const w = ly.get('曾经为了谁慢半节下课铃').words; return w[w.length - 1]!.start; };
/** The ring's edge is this soft at most, px; and with that, a ring of radius FAR has the whole frame inside it. */
const SOFT = 70, FAR = Math.max(...corners.map(([x, y]) => Math.hypot(x - BRIDGE_RAIN.at[0], y - BRIDGE_RAIN.at[1]))) + SOFT;
/**
 * How far out the first ring is, `since` s after the drop landed: slowly at first, and over the whole frame a moment
 * before `cover` (the cut: the last frames before it are all rain). The later rings: the same, later.
 */
export const ringAt = (since: number, cover: number) => { const u = Math.max(0, since / (0.93 * cover)); return FAR * (0.42 * u + 0.58 * u ** 3); };

/** The one drop: `since` s after it lands at BRIDGE_RAIN.at (negative: on its way down). Its fall; then the small crown it throws up, and a glint. */
export function drawDrop(c: Ctx, g: Ctx, since: number) {
  const [x, y] = BRIDGE_RAIN.at, FALL = 0.36, col = mix('frost', 'paper', 0.6);
  if (since < -FALL || since > 0.6) return;
  if (since < 0) {
    const u = 1 + since / FALL, yd = lerp(-110, y, u * u), len = lerp(50, 150, u), xd = x + 0.06 * (y - yd), tail = c.createLinearGradient(xd, yd, xd + 0.06 * len, yd - len);
    tail.addColorStop(0, rgba(col, 0.95)); tail.addColorStop(1, rgba(col, 0));
    c.save(); c.strokeStyle = tail; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(xd, yd); c.lineTo(xd + 0.06 * len, yd - len); c.stroke();
    c.fillStyle = rgba('paper', 0.95); c.beginPath(); c.ellipse(xd, yd, 4.5, 7, 0, 0, TAU); c.fill();
    c.restore();
    glow(g, xd, yd, 30, { color: 'paper', alpha: 0.3 });
    return;
  }
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.36 + (hash(i, 31) - 0.5) * 0.2, v = 300 + 220 * hash(i, 32), u = since / (0.34 + 0.2 * hash(i, 33));
    if (u >= 1) continue;
    c.fillStyle = rgba('paper', 0.9 * (1 - u) ** 0.7);
    c.beginPath(); c.arc(x + Math.cos(a) * v * since, y + Math.sin(a) * v * since + 900 * since * since, lerp(5, 2, u) * (0.7 + 0.6 * hash(i, 34)), 0, TAU); c.fill();
  }
  sparkle(g, x, y, 24, 0.8 * Math.sin(Math.PI * clamp(since / 0.4)) ** 0.7, { color: 'paper', rot: 0.3 });
}

/**
 * The rain the drop lets in, `since` s after it landed: a ring goes out from where it landed and is over the whole frame
 * at `cover` s; inside it the rain comes down and the sky of a wet afternoon comes up (it has hidden everything else a
 * little before `cover`), and three more rings follow the first. `c`: the picture (what is outside the ring stays).
 * `g`: the light layer, which is emptied inside the ring as the sky comes up (leave it out to keep it). See BRIDGE_RAIN.
 */
export function drawRainIn(c: Ctx, g: Ctx | null, o: { t: number; since: number; cover: number }) {
  const { t, since, cover } = o, [x, y] = BRIDGE_RAIN.at, r = ringAt(since, cover);
  if (since <= 0 || r <= 1) return;
  const whole = r >= FAR, d = whole ? c : scratch('rain').c, soft = clamp(r * 0.07, 4, SOFT);
  const disc = (x2: Ctx) => { const m = x2.createRadialGradient(x, y, Math.max(0, r - soft), x, y, r); m.addColorStop(0, rgba('paper', 1)); m.addColorStop(1, rgba('paper', 0)); x2.fillStyle = m; x2.fillRect(0, 0, W, H); };
  // (what the drop landed on still shows through the first of it: the sky comes over it as the rings go out)
  const sky = d.createLinearGradient(0, 0, 0, H), wet = smoothstep(0.08, 0.88, since / cover);
  BRIDGE_RAIN.sky.forEach((col, i) => sky.addColorStop(i / 2, col));
  d.save(); d.globalAlpha *= wet; d.fillStyle = sky; d.fillRect(0, 0, W, H); d.restore();
  rain(d, t, { ...BRIDGE_RAIN.rain, alpha: smoothstep(0.1, 0.8, since / cover) });
  for (let j = 1; j <= 3; j++) soundRing(d, x, y, ringAt(since - 0.15 * j, cover), { alpha: 0.5 - 0.11 * j });
  if (!whole) {
    d.save(); d.globalCompositeOperation = 'destination-in'; disc(d); d.restore();
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(d.canvas, 0, 0, W, H); c.restore();
    soundRing(c, x, y, r, { alpha: 0.8 });
  }
  if (g) { g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = wet; disc(g); g.restore(); }
}
