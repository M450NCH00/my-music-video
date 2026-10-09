// The few things the two of them sit at, carry and hold, drawn the same soft flat way as the
// figures. Desk and chair live in a seated figure's own space (see _love-rig.ts), so they turn with it.
import { mix, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, lerp, TAU } from '../engine/util';
import { DESK_TOP, SEAT_TOP, bounds, circle, hull, mv, rotY, shape, yawOf, type CharParams, type Ctx, type V2, type V3 } from './_love-rig';

const WOOD = mix(mix('paper', 'peach', 0.55), 'ink', 0.1), WOOD_LOW = mix(mix('paper', 'peach', 0.7), 'ink', 0.3);
const METAL = mix('frost', 'navy', 0.22), METAL_LOW = mix('frost', 'navy', 0.42);
const CREAM = mix('paper', 'gold', 0.3), CREAM_LOW = mix(mix('paper', 'gold', 0.45), 'ink', 0.12);
const SLATE = mix('navy', 'frost', 0.42), SLATE_LOW = mix('navy', 'frost', 0.22);

function fillV(c: Ctx, path: Path2D, top: string, low: string, y0: number, y1: number) {
  if (y1 - y0 < 1 || top === low) c.fillStyle = top;
  else { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, low); c.fillStyle = g; }
  c.fill(path);
}

type Place = Pick<CharParams, 'x' | 'y' | 'scale' | 'facing' | 'silhouette'>;
/** Boxes (centre, half-size) in a figure's space, painted far to near. */
function boxes(c: Ctx, p: Place, list: [V3, V3, string, string][]) {
  const s = p.scale ?? 1, V = rotY(yawOf(p.facing));
  const done = list.map(([c0, h, top, low]) => {
    const pts: V2[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const q = mv(V, [c0[0] + sx * h[0], c0[1] + sy * h[1], c0[2] + sz * h[2]]);
      pts.push(...circle(p.x + q[0] * s, p.y - q[1] * s, 2 * s, 6));
    }
    return { z: mv(V, c0)[2], pts: hull(pts), top, low };
  });
  for (const b of done.sort((a, z) => a.z - z.z)) {
    const [y0, y1] = bounds(b.pts);
    fillV(c, shape(b.pts), p.silhouette ?? b.top, p.silhouette ?? b.low, y0, y1);
  }
}

/** The school desk a seated figure at `p` writes on: its top is DESK_TOP above the floor, in front of the figure. */
export function drawDesk(c: Ctx, p: Place) {
  const T = DESK_TOP, leg = (x: number, z: number): [V3, V3, string, string] => [[x, (T - 12) / 2, z], [2.5, (T - 12) / 2, 2.5], METAL, METAL_LOW];
  boxes(c, p, [leg(52, 108), leg(-52, 108), leg(52, 204), leg(-52, 204), [[0, T - 30, 156], [56, 15, 50], WOOD_LOW, WOOD_LOW], [[0, T - 6, 156], [62, 6, 62], WOOD, WOOD_LOW]]);
}
/** The chair under a seated figure at `p`. */
export function drawChair(c: Ctx, p: Place) {
  const T = SEAT_TOP, leg = (x: number, z: number): [V3, V3, string, string] => [[x, (T - 10) / 2, z], [2.5, (T - 10) / 2, 2.5], METAL, METAL_LOW];
  const post = (x: number): [V3, V3, string, string] => [[x, T + 92, -48], [2.5, 95, 2.5], METAL, METAL_LOW];
  boxes(c, p, [leg(38, -46), leg(-38, -46), leg(38, 30), leg(-38, 30), post(38), post(-38), [[0, T - 5, -8], [42, 5, 42], WOOD, WOOD_LOW], [[0, T + 148, -49], [40, 32, 3.5], WOOD, WOOD_LOW]]);
}
/**
 * A seated figure with its chair and desk, painted in the right order for the way it faces:
 * `figure` draws it (drawGirl / drawBoy with a sitting pose and the same `p`).
 */
export function atDesk<T>(c: Ctx, p: Place & { boy?: boolean; desk?: boolean; chair?: boolean }, figure: () => T): T {
  const q = { ...p, scale: (p.scale ?? 1) * (p.boy ? 1.05 : 1) }, towardUs = Math.cos(yawOf(p.facing)) > -0.2;
  const chair = () => { if (p.chair !== false) drawChair(c, q); }, desk = () => { if (p.desk !== false) drawDesk(c, q); };
  if (towardUs) chair(); else desk();
  const out = figure();
  if (towardUs) desk(); else chair();
  return out;
}

/** A pen in a hand at (x, y), its tip down-left at `angle` (rad from straight down). */
export function drawPen(c: Ctx, x: number, y: number, scale = 1, angle = 0.5) {
  c.save(); c.translate(x, y); c.rotate(angle);
  c.lineCap = 'round';
  c.strokeStyle = mix('navy', 'dusk', 0.25); c.lineWidth = 4.5 * scale;
  c.beginPath(); c.moveTo(0, -30 * scale); c.lineTo(0, 9 * scale); c.stroke();
  c.strokeStyle = rgba('ink'); c.lineWidth = 2 * scale;
  c.beginPath(); c.moveTo(0, 9 * scale); c.lineTo(0, 14 * scale); c.stroke();
  c.restore();
}

/**
 * A phone centred on (x, y): `turn` 0 = seen flat (its screen to us) .. 1 = edge-on. The screen is lit;
 * for it to glow, also draw phoneGlow on the light layer.
 */
export function drawPhone(c: Ctx, x: number, y: number, scale = 1, angle = 0, turn = 0) {
  const w = lerp(34, 5, clamp(turn)) * scale, h = 64 * scale;
  c.save(); c.translate(x, y); c.rotate(angle);
  c.fillStyle = mix('navy', 'ink', 0.3);
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, Math.min(w / 2, 6 * scale)); c.fill();
  if (turn < 0.8) {
    c.fillStyle = mix('paper', 'sky', 0.25);
    c.beginPath(); c.roundRect(-w / 2 + 2.5 * scale, -h / 2 + 4 * scale, w - 5 * scale, h - 8 * scale, 3 * scale); c.fill();
  }
  c.restore();
}
/** The light a phone screen throws, for the light layer. */
export function phoneGlow(g: Ctx, x: number, y: number, scale = 1, amount = 1) {
  const r = 170 * scale, gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [at, k] of [[0, 0.55], [0.12, 0.4], [0.35, 0.14], [1, 0]] as const) gr.addColorStop(at, mix('paper', 'sky', 0.35, k * amount));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * An open umbrella held at (x, y) (the hand): the shaft goes up from there, leaning `tilt` rad.
 * Draw it after the people under it. Returns the middle of its rim, for drips.
 */
export function drawUmbrella(c: Ctx, o: { x: number; y: number; scale?: number; tilt?: number; color?: string; alpha?: number }): V2 {
  const s = o.scale ?? 1, col = o.color ?? mix('sky', 'navy', 0.16), low = mix(col, 'navy', 0.22), R = 190 * s, top = 292 * s, rise = 96 * s;
  c.save(); c.translate(o.x, o.y); c.rotate(o.tilt ?? 0);
  if (o.alpha !== undefined) c.globalAlpha = o.alpha;
  // the canopy: a dome with a scalloped rim
  const dome = new Path2D(), n = 4;
  dome.moveTo(-R, -top + rise);
  dome.bezierCurveTo(-R * 0.94, -top + rise * 0.12, -R * 0.42, -top, 0, -top);
  dome.bezierCurveTo(R * 0.42, -top, R * 0.94, -top + rise * 0.12, R, -top + rise);
  for (let i = n - 1; i >= 0; i--) { const x0 = lerp(-R, R, (i + 1) / n), x1 = lerp(-R, R, i / n); dome.quadraticCurveTo((x0 + x1) / 2, -top + rise - 20 * s, x1, -top + rise); }
  dome.closePath();
  fillV(c, dome, col, low, -top, -top + rise);
  c.strokeStyle = rgba('paper', 0.28); c.lineWidth = 1.5; c.lineCap = 'round';
  for (let i = 1; i < n; i++) { const x = lerp(-R, R, i / n); c.beginPath(); c.moveTo(0, -top); c.quadraticCurveTo(x * 0.62, -top + rise * 0.2, x, -top + rise); c.stroke(); }
  // tip, shaft and the crook of the handle
  c.strokeStyle = mix('ink', 'peach', 0.2); c.lineWidth = 3.2 * s;
  c.beginPath(); c.moveTo(0, -top - 13 * s); c.lineTo(0, -top); c.stroke();
  c.beginPath(); c.moveTo(0, -top + rise - 18 * s); c.lineTo(0, 30 * s); c.arc(-9 * s, 30 * s, 9 * s, 0, Math.PI); c.stroke();
  c.restore();
  const a = o.tilt ?? 0;
  return [o.x + Math.sin(a) * (top - rise), o.y - Math.cos(a) * (top - rise)];
}

/**
 * Where the second hand of the classroom clock is, in seconds, at beat `beat`: it ticks once a beat,
 * `late` beats after it (0.5: the clock that runs half a beat slow; 0: on the beat), with a small bounce.
 */
export function clockTick(beat: number, late = 0.5): number {
  const b = beat - late, n = Math.floor(b);
  return n - 1 + ease.outBack(clamp((b - n) / 0.16), 2.4);
}
/**
 * The round classroom wall clock (TREATMENT, motif 1) centred on (x, y); `r` is the outside of its rim.
 * `time`: the hour it shows (16.5 = half past four). `sec`: where its second hand is, in seconds: clockTick().
 * A large clock (a close-up) also gets its numerals and minute marks.
 */
export function drawClock(c: Ctx, x: number, y: number, r: number, o: { time?: number; sec?: number; alpha?: number } = {}) {
  const time = o.time ?? 16.5, face = r * 0.87, big = r >= 110;
  const disc = (rr: number, style: string | CanvasGradient, dx = 0, dy = 0) => { c.fillStyle = style; c.beginPath(); c.arc(dx, dy, rr, 0, TAU); c.fill(); };
  const grad = (rr: number, top: string, low: string) => { const g = c.createLinearGradient(0, -rr, 0, rr); g.addColorStop(0, top); g.addColorStop(1, low); return g; };
  c.save(); c.translate(x, y);
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
  // its shadow on the wall, the rim, the face (shaded a little under the rim)
  disc(r * 1.02, rgba('ink', 0.14), -r * 0.05, r * 0.1);
  disc(r, grad(r, mix('ink', 'peach', 0.45), mix('ink', 'peach', 0.12)));
  disc(face, grad(face, mix('paper', 'ink', 0.1), mix('paper', 'peach', 0.2)));
  disc(face * 0.97, grad(face, rgba('paper'), mix('paper', 'peach', 0.12)), 0, face * 0.03);
  // the hours (and on a large clock the minutes and the numerals)
  c.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0, quarter = i % 15 === 0;
    if (!hour && !big) continue;
    const a = (i / 60) * TAU, r1 = face * 0.92, r0 = face * (!hour ? 0.88 : big ? 0.85 : quarter ? 0.72 : 0.8);
    c.strokeStyle = rgba('ink', hour ? 0.78 : 0.4); c.lineWidth = Math.max(1, r * (!hour ? 0.01 : quarter && !big ? 0.045 : 0.026));
    c.beginPath(); c.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); c.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1); c.stroke();
  }
  if (big) {
    const size = face * 0.21;
    c.font = font(F.hand(500), size); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = rgba('ink', 0.86);
    for (let n = 1; n <= 12; n++) { const a = (n / 12) * TAU; c.fillText(String(n), Math.sin(a) * face * 0.68, -Math.cos(a) * face * 0.68 + size * 0.34); }
  }
  // the hands: hour and minute in ink, the second hand in rose
  const hand = (turn: number, len: number, w: number, col: string, tail = 0) => {
    const a = turn * TAU;
    c.strokeStyle = col; c.lineWidth = w;
    c.beginPath(); c.moveTo(-Math.sin(a) * tail, Math.cos(a) * tail); c.lineTo(Math.sin(a) * len, -Math.cos(a) * len); c.stroke();
  };
  hand((time % 12) / 12, face * 0.48, Math.max(2, r * 0.07), rgba('ink'), face * 0.06);
  hand(time % 1, face * 0.74, Math.max(1.6, r * 0.046), rgba('ink'), face * 0.08);
  hand((o.sec ?? 0) / 60, face * 0.8, Math.max(1.2, r * 0.018), rgba('rose'), face * 0.2);
  disc(Math.max(2, r * 0.06), rgba('ink')); disc(Math.max(1, r * 0.026), rgba('rose'));
  // the glass: a soft highlight across the top left
  c.strokeStyle = rgba('paper', 0.4); c.lineWidth = Math.max(1, r * 0.045);
  c.beginPath(); c.arc(0, 0, face * 0.5, Math.PI * 1.08, Math.PI * 1.42); c.stroke();
  c.restore();
}

/**
 * A folded paper star (a lucky star) centred on (x, y): the thing she hides in the zipper pocket.
 * Rose by default. `r` is the radius of its points.
 */
export function drawStar(c: Ctx, x: number, y: number, r: number, rot = 0, o: { color?: string; alpha?: number } = {}) {
  const col = o.color ?? rgba('rose'), pts: V2[] = [];
  for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? r * 0.6 : r; pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]); }
  c.save();
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
  c.lineJoin = 'round';
  const path = shape(pts);
  c.fillStyle = col; c.strokeStyle = col; c.lineWidth = r * 0.34;
  c.fill(path); c.stroke(path);
  if (r > 5) {
    // the folds: a lighter face toward the light, creases from the middle
    c.fillStyle = rgba('paper', 0.24);
    c.fill(shape([[x, y], pts[9]!, pts[0]!, pts[1]!, pts[2]!, pts[3]!]));
    c.strokeStyle = mix(col, 'ink', 0.28, 0.5); c.lineWidth = Math.max(1, r * 0.05);
    c.beginPath();
    for (let i = 1; i < 10; i += 2) { c.moveTo(x, y); c.lineTo(pts[i]![0], pts[i]![1]); }
    c.stroke();
  }
  c.restore();
}

/**
 * A school bag seen from its front, standing on (x, y) (the middle of its base): hers (cream, the
 * front zipper pocket with the rose pull) or his (slate). `zip` 0 = the pocket closed .. 1 = open.
 * Returns the mouth of the pocket and where the pull is.
 */
export function drawBag(c: Ctx, o: { x: number; y: number; scale?: number; boy?: boolean; zip?: number; tilt?: number; alpha?: number }): { mouth: V2; pull: V2 } {
  const s = o.scale ?? 1, w = 62 * s, h = 150 * s, zip = clamp(o.zip ?? 0), top = o.boy ? SLATE : CREAM, low = o.boy ? SLATE_LOW : CREAM_LOW;
  c.save(); c.translate(o.x, o.y); c.rotate(o.tilt ?? 0);
  if (o.alpha !== undefined) c.globalAlpha = o.alpha;
  // the handle, the body, the pocket
  c.strokeStyle = low; c.lineWidth = 7 * s; c.lineCap = 'round';
  c.beginPath(); c.arc(0, -h + 4 * s, 17 * s, Math.PI, TAU); c.stroke();
  const body = new Path2D();
  body.roundRect(-w, -h, w * 2, h, [44 * s, 44 * s, 20 * s, 20 * s]);
  fillV(c, body, top, low, -h, 0);
  const pw = 46 * s, py = -74 * s, ph = 60 * s, pocket = new Path2D();
  pocket.roundRect(-pw, py, pw * 2, ph, [10 * s, 10 * s, 16 * s, 16 * s]);
  fillV(c, pocket, mix(top, 'paper', 0.25), low, py, py + ph);
  c.strokeStyle = rgba('ink', 0.22); c.lineWidth = 1.6; c.stroke(pocket);
  // the main zipper round the top, then the pocket's: it opens from the right, and the mouth gapes behind the pull
  c.strokeStyle = rgba('ink', 0.2); c.lineWidth = 2;
  c.beginPath(); c.arc(0, -h + 46 * s, w - 12 * s, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
  const zx0 = -pw + 9 * s, zx1 = pw - 9 * s, zy = py + 11 * s, px = lerp(zx1, zx0, zip);
  if (zip > 0.01) {
    c.fillStyle = mix('ink', 'navy', 0.3, 0.75);
    c.beginPath(); c.moveTo(px, zy); c.quadraticCurveTo((px + zx1) / 2, zy - 11 * s * zip, zx1, zy); c.quadraticCurveTo((px + zx1) / 2, zy + 9 * s * zip, px, zy); c.fill();
  }
  c.strokeStyle = rgba('ink', 0.4); c.lineWidth = 2;
  c.beginPath(); c.moveTo(zx0, zy); c.lineTo(px, zy); c.stroke();
  if (!o.boy) {
    c.strokeStyle = rgba('rose'); c.lineWidth = 2.2 * s;
    c.beginPath(); c.moveTo(px, zy); c.lineTo(px - 2 * s, zy + 9 * s); c.stroke();
    c.fillStyle = rgba('rose'); c.beginPath(); c.arc(px - 2.5 * s, zy + 12 * s, 4.6 * s, 0, TAU); c.fill();
  }
  c.restore();
  const ca = Math.cos(o.tilt ?? 0), sa = Math.sin(o.tilt ?? 0), at = (x: number, y: number): V2 => [o.x + x * ca - y * sa, o.y + x * sa + y * ca];
  return { mouth: at((px + zx1) / 2, zy), pull: at(px, zy + 12 * s) };
}
