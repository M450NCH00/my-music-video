// The classroom, seen side-on: the window wall, a row of desks, and the two who sit there: the
// girl, and in front of her the classmate she waits for. World px; the floor the furniture
// stands on is at y = 940, the desk tops at y = 612. Scenes pose the two through `Girl` and `Boy`.
import { F, font } from '../engine/type';
import { hash, lerp, mod, smoothstep, TAU } from '../engine/util';
import { C, ROOM as R, clock, ink, joint, limb, poly, rr, type Ctx } from './_school';
import { head, type Face } from './_people';

/** The window opening and the centre of the pane the intro's camera leaves through. */
export const WIN = { x0: 820, y0: 150, x1: 1660, y1: 600 };
export const PANE = { x: 1135, y: 350 };
export const FLOOR = 940, DESK = 612, SEAT = 742;
const WALL_END = 830;
const LINE = C.line;

/** A pen in the hand: its angle (rad, 0 = pointing right, positive = clockwise), where along it it is held (0 = the back end), and the flash of a tap on the desk (0..1). */
export interface Pen { angle: number; grip: number; hit: number }
/** The pen angles of a tap: raised, and tip on the desk. */
export const PEN_RAISE = -0.66, PEN_DOWN = 0.33;

export interface Girl {
  /** The wrist of the arm we see (her seat is at x = 400; the wrist rests at [690, 594]). */
  hand: [number, number];
  pen?: Pen | null;
  /** Head tilt (rad, positive = chin down) and how far she ducks (px). */
  tilt?: number;
  duck?: number;
  face?: Partial<Face>;
  /** The exercise book: `up` 0 = flat on the desk .. 1 = held up in front of her; `flip` = pages turned so far. */
  book?: { up: number; flip: number };
}

export interface Boy {
  /** Face in his arms on the desk (the other fields then don't matter). */
  asleep?: boolean;
  /** The wrist of the arm we see (his seat is at x = 1010; the wrist rests at [1300, 594]). */
  hand?: [number, number];
  tilt?: number;
  /** 1 = facing the front of the class (right) .. -1 = turned round to the desk behind. */
  turn?: number;
  face?: Partial<Face>;
  /** The school bag: 0 = on the floor behind the desk .. 1 = on the desk; `zip` 0 = open .. 1 = closed. */
  bag?: number;
  zip?: number;
  /** How far he leans over his desk (rad). */
  lean?: number;
  /** Books still on the desk, and one in the hand. */
  stack?: number;
  carry?: boolean;
}

export const GIRL_REST: [number, number] = [690, 594];
export const BOY_REST: [number, number] = [1300, 594];

function wall(c: Ctx) {
  c.save();
  c.beginPath();
  c.rect(-3000, -3000, 9000, 9000);
  c.rect(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
  c.clip('evenodd');
  c.fillStyle = R.wall;
  c.fillRect(-3000, -3000, 9000, 3660);
  c.fillStyle = R.dado;
  c.fillRect(-3000, 660, 9000, WALL_END - 660);
  c.fillStyle = R.dadoLine;
  c.fillRect(-3000, 654, 9000, 8);
  c.fillStyle = R.floor;
  c.fillRect(-3000, WALL_END, 9000, 3000);
  c.fillStyle = R.skirting;
  c.fillRect(-3000, WALL_END - 14, 9000, 16);
  c.fillStyle = R.floorLine;
  for (const y of [884, 968, 1040]) c.fillRect(-3000, y, 9000, 3);
  c.restore();
}

/** The glass (its tint, reflections and running drops fade with `glass`) and the frame. */
function windowFrame(c: Ctx, t: number, glass: number) {
  const { x0, y0, x1, y1 } = WIN, w = x1 - x0, h = y1 - y0;
  if (glass > 0.01) {
    c.save();
    c.beginPath();
    c.rect(x0, y0, w, h);
    c.clip();
    c.fillStyle = `rgba(150,175,200,${0.2 * glass})`;
    c.fillRect(x0, y0, w, h);
    c.fillStyle = `rgba(255,255,255,${0.08 * glass})`;
    for (const k of [0.16, 0.5, 0.86]) {
      poly(c, [x0 + w * k, y0, x0 + w * k + 64, y0, x0 + w * k - 70, y1, x0 + w * k - 134, y1]);
      c.fill();
    }
    // drops running down the pane, some faster, each with a short wet trail
    c.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      const x = x0 + hash(i, 31) * w, sp = 8 + 40 * hash(i, 32) * hash(i, 34);
      const y = y0 + mod(hash(i, 33) * h + t * sp, h + 40) - 20;
      const r = 1.6 + 1.8 * hash(i, 35);
      c.strokeStyle = `rgba(232,242,250,${0.16 * glass})`;
      c.lineWidth = r * 0.9;
      c.beginPath();
      c.moveTo(x, y - 6 - sp * 0.5);
      c.lineTo(x, y);
      c.stroke();
      c.fillStyle = `rgba(238,246,252,${0.5 * glass})`;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    c.restore();
  }
  for (let k = 1; k < 4; k++) {
    rr(c, x0 + (w * k) / 4 - 7, y0, 14, h, 0);
    ink(c, R.frame, 3);
  }
  c.beginPath();
  c.rect(x0, y0, w, h);
  c.strokeStyle = LINE;
  c.lineWidth = 24;
  c.lineJoin = 'miter';
  c.stroke();
  c.strokeStyle = R.frame;
  c.lineWidth = 18;
  c.stroke();
  rr(c, x0 - 30, y1 + 6, w + 60, 20, 4);
  ink(c, R.sill, 3);
}

function curtain(c: Ctx, x: number, dir: 1 | -1, t: number) {
  const s = Math.sin(t * 0.8 + x) * 4;
  c.beginPath();
  c.moveTo(x - 34 * dir, 118);
  c.lineTo(x + 86 * dir, 118);
  c.bezierCurveTo(x + 92 * dir, 260, x + 40 * dir, 350, x + 14 * dir, 420);
  c.bezierCurveTo(x + 50 * dir, 480, x + (72 + s) * dir, 560, x + (66 + s) * dir, 634);
  c.lineTo(x - (38 - s) * dir, 634);
  c.bezierCurveTo(x - 30 * dir, 560, x - 22 * dir, 480, x - 26 * dir, 420);
  c.bezierCurveTo(x - 40 * dir, 320, x - 36 * dir, 220, x - 34 * dir, 118);
  c.closePath();
  ink(c, R.curtain, 3);
  c.strokeStyle = R.curtainFold;
  c.lineWidth = 3;
  for (const k of [0.2, 0.55]) {
    c.beginPath();
    c.moveTo(x + (-34 + 120 * k) * dir, 126);
    c.bezierCurveTo(x + (-20 + 80 * k) * dir, 260, x + (-14 + 40 * k) * dir, 350, x + (-10 + 16 * k) * dir, 414);
    c.stroke();
  }
  rr(c, x - 32 * dir - (dir < 0 ? 52 : 0), 410, 52, 16, 6);
  ink(c, R.red, 3);
}

function chair(c: Ctx, x: number) {
  limb(c, [x + 12, SEAT + 8, x + 4, FLOOR], 10, R.metal);
  limb(c, [x + 150, SEAT + 8, x + 156, FLOOR], 10, R.metal);
  limb(c, [x + 8, 872, x + 153, 872], 6, R.metal);
  limb(c, [x + 12, SEAT, x - 4, 556], 10, R.metal);
  rr(c, x - 16, 548, 24, 92, 7);
  ink(c, R.wood, 3);
  rr(c, x - 2, SEAT, 168, 17, 7);
  ink(c, R.wood, 3);
}

function desk(c: Ctx, x: number) {
  limb(c, [x + 30, 676, x + 22, FLOOR], 11, R.metal);
  limb(c, [x + 300, 676, x + 308, FLOOR], 11, R.metal);
  limb(c, [x + 25, 886, x + 305, 886], 7, R.metal);
  rr(c, x + 14, DESK + 18, 302, 50, 5);
  ink(c, R.woodDark, 3);
  rr(c, x - 6, DESK, 342, 22, 6);
  ink(c, R.wood, 3);
}

function books(c: Ctx, x: number, n: number) {
  const cols = [R.teal, R.red, R.paper, R.pen];
  for (let i = 0; i < n; i++) {
    rr(c, x + (i % 2) * 6, DESK - 14 * (i + 1), 120 - i * 8, 14, 3);
    ink(c, cols[i % cols.length]!, 3);
  }
}

/** The wall, the window, the curtains, the clock (scaled by `pop`) and the timetable. */
export function roomShell(c: Ctx, t: number, o: { glass: number; h: number; m: number; s: number; pop?: number }) {
  wall(c);
  windowFrame(c, t, o.glass);
  limb(c, [WIN.x0 - 70, 112, WIN.x1 + 70, 112], 8, R.metal);
  curtain(c, WIN.x0 - 6, -1, t);
  curtain(c, WIN.x1 + 6, 1, t);
  clock(c, 650, 232, 58 * (o.pop ?? 1), o.h, o.m, o.s, { rim: R.navy, face: R.paper, second: R.red });
  rr(c, 130, 236, 216, 250, 6);
  ink(c, R.paper, 3);
  rr(c, 130, 236, 216, 46, [6, 6, 0, 0]);
  ink(c, R.red, 3);
  c.fillStyle = R.paper;
  c.font = font(F.sc(700), 26);
  c.textAlign = 'center';
  c.fillText('课程表', 238, 269);
  c.textAlign = 'left';
  c.strokeStyle = R.dadoLine;
  c.lineWidth = 2;
  c.beginPath();
  for (let i = 1; i < 5; i++) { c.moveTo(130 + i * 43.2, 290); c.lineTo(130 + i * 43.2, 478); }
  for (let i = 1; i < 5; i++) { c.moveTo(138, 282 + i * 40.8); c.lineTo(338, 282 + i * 40.8); }
  c.stroke();
}

/** The desks nobody sits at: the one behind the girl and the one in front of the boy. */
export function emptyDesks(c: Ctx) {
  chair(c, -140);
  desk(c, 60);
  books(c, 150, 2);
  chair(c, 1550);
  desk(c, 1750);
  books(c, 1830, 3);
}

/** The body of a seated student whose chair is at 400 + dx. */
function torso(c: Ctx, dx: number, fill: string) {
  c.beginPath();
  c.moveTo(450 + dx, 744);
  c.bezierCurveTo(430 + dx, 660, 440 + dx, 560, 478 + dx, 514);
  c.lineTo(520 + dx, 498);
  c.lineTo(562 + dx, 508);
  c.bezierCurveTo(592 + dx, 540, 594 + dx, 620, 578 + dx, 700);
  c.lineTo(572 + dx, 744);
  c.closePath();
  ink(c, fill, 3);
  poly(c, [504 + dx, 498, 566 + dx, 506, 588 + dx, 544, 548 + dx, 528, 514 + dx, 534]);
  ink(c, R.shirt, 3);
}

/**
 * A sleeved arm from the shoulder to the wrist and the hand beyond it; the elbow stays on the
 * desk that starts at x = `deskX`. Returns the hand's centre.
 */
function arm(c: Ctx, sx: number, sy: number, wx: number, wy: number, deskX: number): [number, number] {
  let [ex, ey] = joint(sx, sy, wx, wy, 129, 98, wx >= sx ? 1 : -1);
  if (ex > deskX - 6 && ey > DESK - 6) ey = DESK - 6;
  limb(c, [sx, sy, ex, ey, wx, wy], 34, R.shirt);
  const d = Math.hypot(wx - ex, wy - ey) || 1, ux = (wx - ex) / d, uy = (wy - ey) / d;
  limb(c, [wx - ux * 14, wy - uy * 14, wx + ux * 4, wy + uy * 4], 35, R.shirt, 3);
  const hx = wx + ux * 26, hy = wy + uy * 26 - 4;
  c.beginPath();
  c.ellipse(hx, hy, 23, 17, Math.atan2(uy, ux) - 0.1, 0, TAU);
  ink(c, R.skin, 3);
  return [hx, hy];
}

function thumb(c: Ctx, hx: number, hy: number) {
  c.beginPath();
  c.ellipse(hx + 10, hy - 11, 9, 14, 0.5, 0, TAU);
  ink(c, R.skin, 3);
}

/** A pen, from the point it is held at. */
function pen(c: Ctx, x: number, y: number, p: Pen) {
  const L = 118, ax = Math.cos(p.angle), ay = Math.sin(p.angle);
  const at = (k: number): [number, number] => [x + (k - p.grip) * L * ax, y + (k - p.grip) * L * ay];
  limb(c, [...at(0), ...at(1)], 9, R.pen, 2.5);
  limb(c, [...at(0), ...at(0.16)], 9, R.red, 0);
  limb(c, [...at(0.9), ...at(1)], 5, R.shirtShade, 0);
}

/** The exercise book held upright, its foot at (x, DESK): the cover toward us, the pages toward her, one page turning. */
function bookUp(c: Ctx, x: number, up: number, flip: number) {
  c.save();
  c.translate(x, DESK - 2);
  c.rotate((1 - up) * -1.3);
  poly(c, [4, 0, 12, -4, 4, -214, -4, -210]);
  ink(c, R.navyDark, 3);
  poly(c, [-56, -206, -48, 0, -57, 0, -65, -203]);
  ink(c, R.paper, 3);
  // the page being turned, over the top edge
  const u = mod(flip, 1), a = lerp(-0.45, -2.7, u * u * (3 - 2 * u));
  const tx = -28 + Math.cos(a) * 50, ty = -208 + Math.sin(a) * 50;
  c.beginPath();
  c.moveTo(-40, -207);
  c.quadraticCurveTo(-28 + Math.cos(a - 0.5) * 34, -208 + Math.sin(a - 0.5) * 34, tx, ty);
  c.quadraticCurveTo(-28 + Math.cos(a + 0.5) * 34, -208 + Math.sin(a + 0.5) * 34, -14, -209);
  c.closePath();
  ink(c, R.paper, 3);
  poly(c, [-48, 0, 0, 0, -8, -210, -56, -206]);
  ink(c, R.teal, 3);
  rr(c, -44, -150, 30, 44, 4);
  ink(c, R.paper, 2.5);
  c.restore();
}

/** The girl: chair, legs and skirt, her desk and what lies on it, body, head, the arm with the pen or the book. */
export function girl(c: Ctx, t: number, g: Girl) {
  chair(c, 400);
  for (const [dx, skin, sock] of [[-22, R.skinShade, R.shirtShade], [0, R.skin, R.shirt]] as const) {
    limb(c, [672 + dx, 740, 656 + dx, 884], 32, skin);
    limb(c, [656 + dx, 862, 653 + dx, 892], 33, sock);
    rr(c, 628 + dx, 896, 88, 40, [16, 22, 8, 8]);
    ink(c, R.shoe, 3);
  }
  c.beginPath();
  c.moveTo(450, 690);
  c.lineTo(566, 684);
  c.lineTo(690, 708);
  c.quadraticCurveTo(706, 742, 690, 772);
  c.lineTo(600, 750);
  c.lineTo(452, 748);
  c.closePath();
  ink(c, R.navy, 3);
  c.strokeStyle = R.navyDark;
  c.lineWidth = 3;
  for (const [a, b] of [[520, 512], [580, 584], [640, 652]] as const) {
    c.beginPath();
    c.moveTo(a, 690 + (a - 566) * 0.19 * (a > 566 ? 1 : 0));
    c.lineTo(b, b > 600 ? 752 + (b - 600) * 0.24 : 748);
    c.stroke();
  }
  desk(c, 600);
  const up = g.book?.up ?? 0;
  if (up < 0.02) {
    rr(c, 648, DESK - 9, 156, 9, 3);
    ink(c, R.paper, 3);
  }

  c.save();
  c.translate(548, 408 + (g.duck ?? 0));
  c.rotate(g.tilt ?? 0.1);
  c.scale(84, 84);
  head(c, t, R, { hair: 'ponytail', ...g.face });
  c.restore();
  torso(c, 0, R.navy);
  poly(c, [584, 540, 606, 528, 604, 556]);
  ink(c, R.red, 3);
  poly(c, [584, 540, 566, 556, 580, 566]);
  ink(c, R.red, 3);

  if (up >= 0.02) bookUp(c, 742, up, g.book!.flip);
  const [hx, hy] = arm(c, 498, 530, g.hand[0], g.hand[1], 600);
  if (g.pen) pen(c, hx + 16, hy - 8, g.pen);
  thumb(c, hx, hy);
  // the pencil case, in front of whatever goes into it
  rr(c, 862, DESK - 22, 70, 22, 8);
  ink(c, R.teal, 3);
  // a tap of the pen: short strokes where the tip lands
  if (g.pen && g.pen.hit > 0) {
    const k = 1 - g.pen.hit, tx = hx + 16 + 100 * Math.cos(PEN_DOWN), ty = DESK - 2;
    c.strokeStyle = LINE;
    c.lineWidth = 4.5;
    c.lineCap = 'round';
    c.globalAlpha = Math.min(1, g.pen.hit * 1.6);
    for (const a of [-2.55, -1.95, -1.2, -0.6]) {
      c.beginPath();
      c.moveTo(tx + Math.cos(a) * (16 + 22 * k), ty + Math.sin(a) * (16 + 22 * k));
      c.lineTo(tx + Math.cos(a) * (36 + 34 * k), ty + Math.sin(a) * (36 + 34 * k));
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}

/** Where his bag stands on his desk (its middle), and where his books lie. */
export const BAG_X = 1400, STACK_X = 1216;

/** His school bag, its foot at y = `y`. */
function bag(c: Ctx, y: number, zip: number) {
  c.save();
  c.translate(BAG_X - 1476, 0);
  c.beginPath();
  c.arc(1476, y - 128, 22, Math.PI, 0);
  c.strokeStyle = LINE;
  c.lineWidth = 13;
  c.stroke();
  c.strokeStyle = R.pen;
  c.lineWidth = 7;
  c.stroke();
  rr(c, 1418, y - 128, 116, 128, [34, 34, 14, 14]);
  ink(c, R.pen, 3);
  rr(c, 1436, y - 62, 80, 48, 10);
  ink(c, R.pen, 3);
  // the zip: open, the dark of the bag shows
  c.beginPath();
  c.ellipse(1476, y - 96, 46, 9 * (1 - zip) + 0.5, 0, 0, TAU);
  ink(c, R.navyDark, 3);
  rr(c, lerp(1424, 1516, zip), y - 106, 12, 20, 4);
  ink(c, R.red, 2.5);
  c.restore();
}

/** The boy in front of her: asleep on his desk, or awake and posed. */
export function boy(c: Ctx, t: number, b: Boy) {
  const x = 1010;
  chair(c, x);
  limb(c, [x + 60, 752, x + 248, 756, x + 258, 892], 38, R.navyDark);
  limb(c, [x + 70, 750, x + 262, 752, x + 272, 892], 38, R.navy);
  rr(c, x + 246, 896, 92, 40, [16, 22, 8, 8]);
  ink(c, R.shirt, 3);
  if (b.asleep) {
    desk(c, x + 200);
    const breath = Math.sin(t * 1.5) * 3;
    c.beginPath();
    c.moveTo(x + 48, 748);
    c.bezierCurveTo(x + 22, 650, x + 90, 560 - breath, x + 178, 552 - breath);
    c.lineTo(x + 240, 600);
    c.bezierCurveTo(x + 200, 660, x + 130, 720, x + 122, 748);
    c.closePath();
    ink(c, R.shirt, 3);
    limb(c, [x + 176, 578, x + 250, 600, x + 368, 596], 36, R.shirt);
    c.beginPath();
    c.ellipse(x + 262, 590, 20, 14, 0, 0, TAU);
    ink(c, R.skin, 3);
    c.beginPath();
    c.arc(x + 300, 560 - breath * 0.5, 60, 0, TAU);
    ink(c, R.hair, 3);
    c.fillStyle = LINE;
    for (let i = 0; i < 3; i++) {
      const u = mod(t / 3.4 + i / 3, 1);
      c.globalAlpha = Math.min(smoothstep(0, 0.2, u), 1 - smoothstep(0.7, 1, u)) * 0.8;
      c.font = font(F.archivoItalic(100, 800), 24 + 22 * u);
      c.fillText('z', x + 356 + 70 * u + Math.sin(u * 7) * 8, 500 - 150 * u);
    }
    c.globalAlpha = 1;
    return;
  }
  const up = b.bag ?? 0, turn = b.turn ?? 1;
  if (up > 0.001) bag(c, DESK + (1 - up) * 250, b.zip ?? 0);
  desk(c, x + 200);
  books(c, STACK_X, b.stack ?? 0);
  // head and body lean about the hip; the arm reaches from the shoulder wherever that takes it
  const lean = b.lean ?? 0, px = x + 60, py = SEAT + 2;
  c.save();
  c.translate(px, py);
  c.rotate(lean);
  c.translate(-px, -py);
  c.save();
  c.translate(lerp(1128, 1158, (turn + 1) / 2), 408);
  c.rotate((b.tilt ?? 0.06) * (turn < 0 ? -1 : 1));
  c.scale(84 * turn, 84);
  head(c, t, R, { hair: 'short', ...b.face });
  c.restore();
  torso(c, 610, R.shirt);
  c.restore();
  const h = b.hand ?? BOY_REST, dx = 1108 - px, dy = 530 - py;
  const [hx, hy] = arm(c, px + dx * Math.cos(lean) - dy * Math.sin(lean), py + dx * Math.sin(lean) + dy * Math.cos(lean), h[0], h[1], x + 200);
  if (b.carry) {
    rr(c, hx - 30, hy - 2, 112, 14, 3);
    ink(c, R.red, 3);
  }
  thumb(c, hx, hy);
}
