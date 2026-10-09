// The two of them (docs/TREATMENT.md, "Characters"), as one jointed puppet drawn in soft flat
// shapes. A pose is a handful of joint targets in the character's own space (x to its left,
// y up, z the way it faces; about 615 units tall); the limbs are solved from them and every
// part is projected for the direction the character faces. So each pose can be seen from the
// side, the front, the back or in between, and her and him look the same in every scene.
//
// Use drawGirl / drawBoy / drawStudent from _love.ts; nothing else here is meant for scenes.
import { mix, rgba } from '../engine/palette';
import { clamp, lerp, TAU } from '../engine/util';

export type Ctx = CanvasRenderingContext2D;
export type V2 = [number, number];
export type V3 = [number, number, number];
type M3 = [number, number, number, number, number, number, number, number, number];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mixv = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const rotX = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
export const rotY = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mm = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];
const tr = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
export const mv = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const DEG = Math.PI / 180;

// ------------------------------------------------------------------ colours (blends of the palette)
const SKIN = mix('paper', 'peach', 0.4), SKIN_LOW = mix('paper', 'peach', 0.64);
const SHIRT = rgba('paper'), SHIRT_LOW = mix('paper', 'sky', 0.3);
const NAVY = mix('navy', 'dusk', 0.12), NAVY_LOW = mix('navy', 'ink', 0.25);
const BEIGE = mix(mix('paper', 'gold', 0.4), 'ink', 0.08), BEIGE_LOW = mix(mix('paper', 'peach', 0.5), 'ink', 0.18);
const CREAM = mix('paper', 'gold', 0.3), CREAM_LOW = mix(mix('paper', 'gold', 0.45), 'ink', 0.12);
const SLATE = mix('navy', 'frost', 0.45), SLATE_LOW = mix('navy', 'frost', 0.24);
const HAIR_HER = rgba('ink'), HAIR_HER_LIGHT = mix('ink', 'peach', 0.36);
const HAIR_HIS = mix('ink', 'navy', 0.38), HAIR_HIS_LIGHT = mix('ink', 'frost', 0.4);
const SHOE_HER = mix('ink', 'peach', 0.14), SHOE_HIS = mix('paper', 'frost', 0.35);
const ROSE = rgba('rose'), ROSE_LOW = mix('rose', 'ink', 0.16);
const BLUSH = mix('blush', 'rose', 0.4);

// ------------------------------------------------------------------ poses
export type PoseName =
  | 'stand' | 'walk' | 'run' | 'sit-write' | 'chin-on-hand' | 'pack-bag' | 'turn-smile' | 'wave'
  | 'hold-phone' | 'hold-umbrella' | 'lean-closer' | 'face-each-other';
export const POSES: PoseName[] = ['stand', 'walk', 'run', 'sit-write', 'chin-on-hand', 'pack-bag', 'turn-smile', 'wave', 'hold-phone', 'hold-umbrella', 'lean-closer', 'face-each-other'];
/** A pose, or a blend of two (k = 0: `from`, k = 1: `to`) for easing from one into the other. */
export type PoseArg = PoseName | { from: PoseName; to: PoseName; k: number };

interface Pose {
  hip: V3;            // the pelvis
  lean: number;       // torso forward (rad): 0 upright, PI / 2 lying face down
  side: number;       // torso sideways (rad), + = toward its left
  twist: number;      // shoulders turned against the hips (rad), + = toward its left
  head: V3;           // yaw (against the body, + = toward its left), pitch (+ = looking down), roll (+ = toward its left)
  handL: V3; handR: V3; elbowL: V3; elbowR: V3;   // wrists, and which way each elbow points
  footL: V3; footR: V3; kneeL: V3; kneeR: V3;     // ankles, and which way each knee points
  smile: number;      // what the pose itself adds to params.smile
  over: string;       // the arms drawn in front of the head: '', 'L', 'R' or 'LR'
}

interface Build {
  tall: number; sw: number; hj: number; R: number; neck: number;
  arm: [number, number, number, number];   // radii at the shoulder, elbow and wrist, and of the hand
  leg: [number, number, number];           // radii at the hip, knee and ankle
  shoe: [number, number];                  // length and radius
  st: [number, number, number][];          // the torso's sections: height above the hips, half-width, half-depth
}
const GIRL: Build = { tall: 1, sw: 39, hj: 16, R: 49, neck: 10.5, arm: [13, 11, 9.5, 10.5], leg: [22, 16, 11], shoe: [31, 12], st: [[0, 35, 22], [62, 29, 18], [130, 35, 20], [170, 38, 16]] };
const BOY: Build = { tall: 1.05, sw: 47, hj: 17, R: 49, neck: 12.5, arm: [15, 13, 11, 11.5], leg: [26, 22, 18], shoe: [38, 13.5], st: [[0, 34, 22], [64, 33, 19], [132, 43, 22], [172, 46, 17]] };
// lengths: the legs are straight when it stands
const THIGH = 144, SHIN = 142, ANKLE = 22, HIP = THIGH + SHIN + ANKLE + 4;
const UPPER = 102, FORE = 92, SHOULDER = 174, NECK = 190, SH = HIP + SHOULDER, SEAT = SHIN + ANKLE + 5;
/** Heights (in the figure's units, above the floor) that the furniture of _love-props.ts is built to. */
export const SEAT_TOP = SEAT - 23, DESK_TOP = 282;

type Q = { walk: number; k: number; t: number; yaw: number };
const base = (b: Build): Pose => ({
  hip: [0, HIP, 0], lean: 0.02, side: 0, twist: 0, head: [0, 0.03, 0],
  handL: [b.sw + 9, HIP - 20, 10], handR: [-b.sw - 9, HIP - 20, 4], elbowL: [0.3, -0.4, -1], elbowR: [-0.3, -0.4, -1],
  footL: [b.hj + 2, ANKLE, 8], footR: [-b.hj - 2, ANKLE, -6], kneeL: [0, 0.15, 1], kneeR: [0, 0.15, 1], smile: 0, over: '',
});
/** Legs and arms of a stride: `ph` in cycles (one cycle = two steps). */
function stride(b: Build, ph: number, S: number, lift: number, bob: number, arm: number, kick = 0): Pose {
  const a = ph * TAU, p = base(b);
  // (kick: the foot comes off the floor early and highest behind the body, as in a run)
  const foot = (sg: number, th: number): V3 => [sg * (b.hj + 1), ANKLE + lift * Math.max(0, Math.cos(th + kick)) ** 1.3, S * Math.sin(th)];
  p.footL = foot(1, a); p.footR = foot(-1, a + Math.PI);
  p.hip = [0, HIP - bob * Math.sin(a) ** 2, 0];
  p.handL = [b.sw + 8, HIP - 20 + 12 * Math.abs(Math.sin(a)), 6 - arm * Math.sin(a)];
  p.handR = [-b.sw - 8, HIP - 20 + 12 * Math.abs(Math.sin(a)), 6 + arm * Math.sin(a)];
  p.lean = 0.05;
  p.head = [0, 0.02, 0];
  return p;
}
function seated(b: Build): Pose {
  const p = base(b);
  p.hip = [0, SEAT, 0];
  p.footL = [b.hj + 1, ANKLE, THIGH - 6]; p.footR = [-b.hj - 1, ANKLE, THIGH - 18];
  p.kneeL = [0, 1, 0.5]; p.kneeR = [0, 1, 0.5];
  return p;
}
const MAKE: Record<PoseName, (b: Build, q: Q) => Pose> = {
  stand: (b) => base(b),
  walk: (b, q) => stride(b, q.walk, 58, 30, 6, 38),
  run: (b, q) => {
    const p = stride(b, q.walk, 100, 92, 14, 0, 0.7), sa = Math.sin(q.walk * TAU);
    p.lean = 0.28;
    p.kneeL = [0, 0.4, 1]; p.kneeR = [0, 0.4, 1];
    p.handL = [b.sw + 4, SH - 124 - 30 * sa, 54 - 64 * sa]; p.handR = [-b.sw - 4, SH - 124 + 30 * sa, 54 + 64 * sa];
    p.elbowL = [0.4, -0.3, -1]; p.elbowR = [-0.4, -0.3, -1];
    return p;
  },
  // at the desk, writing (the desk of _love-props.ts: its top DESK_TOP up, in front of the figure)
  'sit-write': (b, q) => {
    const p = seated(b);
    p.lean = 0.22; p.head = [0, 0.36, 0];
    p.handR = [-14 + 5 * Math.sin(q.t * 5.1), DESK_TOP + 10, 150 + 3 * Math.sin(q.t * 7.3)];
    p.handL = [26, DESK_TOP + 9, 132];
    return p;
  },
  // elbow on the desk, chin in its left hand
  'chin-on-hand': (b) => {
    const p = seated(b);
    p.lean = 0.3; p.head = [0, 0.02, 0.14];
    p.handL = [15, DESK_TOP + 82, 97]; p.elbowL = [0.5, -1, 0.4];
    p.handR = [-22, DESK_TOP + 9, 136];
    p.over = 'L';
    return p;
  },
  // standing at the desk, head down, putting a book in the bag: k = 0 picking it up .. 1 it is in
  'pack-bag': (b, q) => {
    const p = base(b), u = q.k;
    p.lean = 0.3; p.head = [0, 0.4, 0];
    p.handR = mixv([-32, DESK_TOP + 14, 112], [-8, DESK_TOP + 56 + 26 * Math.sin(u * Math.PI), 152], u);
    p.handL = [26, DESK_TOP + 44, 150];
    return p;
  },
  // he stops and looks back over his shoulder, the one on the camera's side: k = 0 not yet .. 1 turned, smiling
  'turn-smile': (b, q) => {
    const p = base(b), u = q.k, sg = Math.sin(q.yaw) >= 0 ? -1 : 1;
    p.twist = 0.5 * u * sg; p.head = [1.45 * u * sg, 0.02, 0.1 * u * sg];
    p.handR = mixv(p.handR, [-b.sw + 9, SH - 52, 22], u); p.elbowR = [-0.6, -1, -0.2];
    p.smile = u;
    return p;
  },
  // walk = the swing of the hand, in cycles
  wave: (b, q) => {
    const p = base(b);
    p.handR = [-(b.sw + 50) + 20 * Math.sin(q.walk * TAU), SH + 104 + 5 * Math.cos(q.walk * TAU * 2), 22];
    p.elbowR = [-1, -0.8, -0.1];
    p.head = [0, -0.02, -0.07];
    p.smile = 1;
    return p;
  },
  // lying on its front on the bed, on its elbows, the phone in both hands, feet in the air
  'hold-phone': (b, q) => {
    const p = base(b), sw = Math.sin(q.t * 1.3);
    p.hip = [0, 24, 0]; p.lean = 1.2; p.head = [0, 0.45, 0];
    p.handL = [9, 100, 280]; p.handR = [-9, 100, 280];
    p.elbowL = [0.5, -1, 0]; p.elbowR = [-0.5, -1, 0];
    p.footL = [b.hj, 150 + 26 * sw, -186 + 44 * sw]; p.footR = [-b.hj, 150 - 26 * sw, -186 - 44 * sw];
    p.kneeL = [0, -1, -0.3]; p.kneeR = [0, -1, -0.3];
    return p;
  },
  // the handle in the right hand; legs walk if params.walk is set
  'hold-umbrella': (b, q) => {
    const p = q.walk >= 0 ? stride(b, q.walk, 44, 24, 4, 24) : base(b);
    p.handR = [-(b.sw - 8), SH - 80, 52]; p.elbowR = [-0.5, -1, -0.4];
    return p;
  },
  // k = how far, -1..1: + leans to its left
  'lean-closer': (b, q) => {
    const p = q.walk >= 0 ? stride(b, q.walk, 44, 24, 4, 24) : base(b);
    p.side = 0.13 * q.k; p.head = [0.25 * q.k, 0.04, 0.2 * q.k];
    return p;
  },
  'face-each-other': (b) => {
    const p = base(b);
    p.handL = [10, HIP - 4, 34]; p.handR = [-10, HIP - 6, 36];
    p.elbowL = [1, -0.5, -0.4]; p.elbowR = [-1, -0.5, -0.4];
    p.lean = 0.04;
    return p;
  },
};
const POSE_KEYS = ['hip', 'head', 'handL', 'handR', 'elbowL', 'elbowR', 'footL', 'footR', 'kneeL', 'kneeR'] as const;
function resolve(b: Build, arg: PoseArg, q: Q): Pose {
  if (typeof arg === 'string') return MAKE[arg](b, q);
  const a = MAKE[arg.from](b, q), z = MAKE[arg.to](b, q), k = clamp(arg.k), out = { ...a };
  for (const key of POSE_KEYS) out[key] = mixv(a[key], z[key], k);
  out.lean = lerp(a.lean, z.lean, k); out.side = lerp(a.side, z.side, k); out.twist = lerp(a.twist, z.twist, k); out.smile = lerp(a.smile, z.smile, k);
  out.over = k < 0.5 ? a.over : z.over;
  return out;
}

/** The middle joint of a two-bone limb from `s` to `t` (bone lengths a, b), bending toward `pole`; and where the limb ends (it stops short of a target out of reach). */
function ik(s: V3, t: V3, a: number, b: number, pole: V3): [V3, V3] {
  const d = sub(t, s), L = clamp(len(d), Math.abs(a - b) + 1, a + b - 0.02), u = norm(d);
  const x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x));
  let p = sub(pole, mul(u, dot(pole, u)));
  if (len(p) < 1e-3) p = cross(u, [1, 0, 0]);
  return [add(s, add(mul(u, x), mul(norm(p), h))), add(s, mul(u, L))];
}

// ------------------------------------------------------------------ drawing helpers
export function hull(pts: V2[]): V2[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: V2[] = [], up: V2[] = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]!; while (up.length >= 2 && cr(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}
export function shape(pts: V2[]): Path2D {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}
export const circle = (x: number, y: number, r: number, n = 12): V2[] => Array.from({ length: n }, (_, i) => [x + r * Math.cos((i / n) * TAU), y + r * Math.sin((i / n) * TAU)] as V2);
export const bounds = (pts: V2[]): [number, number] => [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];

/** Fills, lines and rim light for one figure; `flat` paints everything in one colour (a silhouette). */
class Brush {
  constructor(private c: Ctx, private flat: string | null, private light: V2 | null) {}
  get plain() { return this.flat !== null; }
  fill(path: Path2D, top: string, low: string, y0: number, y1: number, rule: CanvasFillRule = 'nonzero') {
    const c = this.c;
    if (this.flat) c.fillStyle = this.flat;
    else if (top === low || y1 - y0 < 1) c.fillStyle = top;
    else { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, low); c.fillStyle = g; }
    c.fill(path, rule);
  }
  /** A soft ink line, 1.5 to 3 px. */
  line(path: Path2D, alpha = 0.3, w = 1.8) {
    if (this.flat) return;
    const c = this.c;
    c.strokeStyle = rgba('ink', alpha); c.lineWidth = clamp(w, 1.5, 3); c.lineJoin = 'round'; c.lineCap = 'round';
    c.stroke(path);
  }
  /** Light along the edge of `path` that faces the light, `w` px wide. */
  rim(path: Path2D, w: number, col: string) {
    if (this.flat || !this.light) return;
    const c = this.c, big = new Path2D();
    big.rect(-1e4, -1e4, 3e4, 3e4);
    big.addPath(path, new DOMMatrix().translate(-this.light[0] * w, -this.light[1] * w));
    c.save(); c.clip(path); c.fillStyle = col; c.fill(big, 'evenodd'); c.restore();
  }
  /** Darken `path` a little: the limbs on the far side. */
  shade(path: Path2D, alpha: number) {
    if (this.flat) return;
    this.c.fillStyle = rgba('ink', alpha); this.c.fill(path);
  }
}

// ------------------------------------------------------------------ the figure
export type Outfit = 'summer' | 'autumn' | 'winter';
export interface CharParams {
  /** Where the floor under its hips is, px. */
  x: number; y: number;
  /** 1 = about 615 px tall (he is 5% taller). */
  scale?: number;
  /** Which way the body faces: 'right' | 'left' | 'front' (the camera) | 'back', or degrees (0 = front, 90 = right, 180 = back, -90 = left). */
  facing?: number | 'right' | 'left' | 'front' | 'back';
  /** Time (s): breathing, sway. */
  t?: number;
  /** -1..1: hair, skirt, ribbon and scarf lean with it (+ = blowing to screen right). */
  wind?: number;
  /** summer: short sleeves. autumn (the default): her beige cardigan, his long sleeves. winter: her long beige coat, his jacket and the rose scarf. */
  outfit?: Outfit;
  /** The rose scarf (default: he wears it in winter). false when she is keeping it; true on her when she wears it. */
  scarf?: boolean;
  /** 0..1 cheeks. */
  blush?: number;
  /** Stride phase in cycles, one cycle = two steps (2 steps per beat: pass f.beat). Also the swing of 'wave'. */
  walk?: number;
  /** Head turned against the body, degrees (+ = toward its own left), and nod (+ = down), tilt (+ = toward its left). */
  headTurn?: number; nod?: number; tilt?: number;
  /** 0..1: above 0.5 the eyes close into ◡ curves. */
  smile?: number;
  /** The pose's own progress or amount (see each pose). */
  k?: number;
  /** Wear the backpack (default true except when sitting or lying). */
  bag?: boolean;
  /** A single flat (opaque) colour instead of the drawing: background students. */
  silhouette?: string;
  /** Where the light comes from, on screen (x, y; y down): the rim light on hair and shoulders. null = none. */
  light?: V2 | null;
  /** 0..1: a soft shadow on the floor under it. */
  shadow?: number;
  /** 0..1 the whole figure. */
  alpha?: number;
}
/** Screen positions (px) of the parts a scene attaches things to. */
export interface Anchors {
  head: V2; top: V2; chin: V2; neck: V2; chest: V2; hip: V2;
  handL: V2; handR: V2; footL: V2; footR: V2;
  /** The eyes (its left, its right), and how much each faces us (0 = hidden). */
  eyes: [V2, V2]; eyesSeen: [number, number];
  /** The pull of the bag's zipper pocket, and the pocket of her coat. */
  zip: V2; pocket: V2;
  scale: number;
}

export const yawOf = (f: CharParams['facing']) => (f === undefined || f === 'right' ? 90 : f === 'left' ? -90 : f === 'front' ? 0 : f === 'back' ? 180 : f) * DEG;

function figure(c: Ctx, who: 'girl' | 'boy', poseArg: PoseArg, p: CharParams): Anchors {
  const b = who === 'girl' ? GIRL : BOY, girl = who === 'girl';
  const s = (p.scale ?? 1) * b.tall, t = p.t ?? 0, wind = p.wind ?? 0, outfit = p.outfit ?? 'autumn', A0 = p.alpha ?? 1;
  const name = typeof poseArg === 'string' ? poseArg : poseArg.k < 0.5 ? poseArg.from : poseArg.to;
  const pose = resolve(b, poseArg, { walk: p.walk ?? (name === 'hold-umbrella' || name === 'lean-closer' ? -1 : 0), k: p.k ?? (name === 'lean-closer' ? 0 : 1), t, yaw: yawOf(p.facing) });
  const down = name === 'sit-write' || name === 'chin-on-hand' || name === 'hold-phone';
  const V = rotY(yawOf(p.facing));
  const P = (v: V3): V3 => mv(V, v);
  const S = (q: V3): V2 => [p.x + q[0] * s, p.y - q[1] * s];
  const PS = (v: V3): V2 => S(P(v));
  const light = p.light === undefined ? ([-0.6, -0.8] as V2) : p.light;
  const br = new Brush(c, p.silhouette ?? null, light);
  const gust = wind * (0.75 + 0.25 * Math.sin(t * 2.3 + (girl ? 0 : 1.7))) + 0.05 * Math.sin(t * 1.1 + (girl ? 0.4 : 2));
  const breath = (1.4 / s) * Math.sin(t * 1.7 + (girl ? 0 : 1.3));

  // ---- the skeleton, in its own space
  const { lean, side, twist } = pose;
  const up: V3 = norm([Math.sin(side), Math.cos(lean) * Math.cos(side), Math.sin(lean) * Math.cos(side)]);
  const fwd: V3 = [0, -Math.sin(lean), Math.cos(lean)];
  const lat: V3 = [Math.cos(side), -Math.sin(side) * Math.cos(lean), -Math.sin(side) * Math.sin(lean)];
  const axes = (h: number): [V3, V3] => {
    const a = twist * clamp(h / SHOULDER), ca = Math.cos(a), sa = Math.sin(a);
    return [add(mul(lat, ca), mul(fwd, -sa)), add(mul(fwd, ca), mul(lat, sa))];
  };
  const hip = pose.hip;
  const spine = (h: number): V3 => add(hip, mul(up, h + (h > 100 ? breath : 0)));
  const [latS] = axes(SHOULDER);
  const shL = add(spine(SHOULDER), mul(latS, b.sw)), shR = add(spine(SHOULDER), mul(latS, -b.sw));
  const hjL: V3 = add(hip, [b.hj, -4, 0]), hjR: V3 = add(hip, [-b.hj, -4, 0]);
  const [elL, haL] = ik(shL, pose.handL, UPPER, FORE, pose.elbowL), [elR, haR] = ik(shR, pose.handR, UPPER, FORE, pose.elbowR);
  const [knL, anL] = ik(hjL, pose.footL, THIGH, SHIN, pose.kneeL), [knR, anR] = ik(hjR, pose.footR, THIGH, SHIN, pose.kneeR);
  const neck = spine(NECK);
  const headC = add(neck, mul(norm(mixv(up, [0, 1, 0], 0.5)), b.R + 6));
  const H = mm(rotY(yawOf(p.facing) + pose.head[0] + (p.headTurn ?? 0) * DEG), mm(rotX(pose.head[1] + (p.nod ?? 0) * DEG), rotZ(-(pose.head[2] + (p.tilt ?? 0) * DEG))));
  const HT = tr(H);
  const smile = clamp((p.smile ?? 0) + pose.smile);

  // ---- parts of the picture
  const ring = (c0: V3, A: V3, F: V3, w: number, d: number, n = 14): V2[] =>
    Array.from({ length: n }, (_, i) => PS(add(c0, add(mul(A, w * Math.cos((i / n) * TAU)), mul(F, d * Math.sin((i / n) * TAU))))));
  const tube = (a: V3, ra: number, z: V3, rz: number): V2[] => { const A = PS(a), Z = PS(z); return hull([...circle(A[0], A[1], ra * s), ...circle(Z[0], Z[1], rz * s)]); };
  const far = (v: V3) => P(v)[2] < -6;
  const rimW = 1.6 * Math.sqrt(s) + 0.9;
  const part = (pts: V2[], top: string, low: string, o: { line?: number; rim?: boolean; shade?: boolean; yr?: [number, number] } = {}) => {
    const path = shape(pts), [y0, y1] = o.yr ?? bounds(pts);
    br.fill(path, top, low, y0, y1);
    if (o.shade) br.shade(path, 0.1);
    if (o.rim) br.rim(path, rimW, mix(top, 'gold', 0.6, 0.85));
    if (o.line) br.line(path, o.line);
    return path;
  };
  const span = (pad: number, ...vs: V3[]): [number, number] => { const ys = vs.map((v) => PS(v)[1]); return [Math.min(...ys) - pad * s, Math.max(...ys) + pad * s]; };

  const winter = outfit === 'winter', autumn = outfit === 'autumn';
  const legTop = girl ? (winter ? NAVY_LOW : SKIN) : NAVY, legLow = girl ? (winter ? mix('navy', 'ink', 0.42) : SKIN_LOW) : NAVY_LOW;
  const sleeve = girl ? (winter || autumn ? BEIGE : SHIRT) : winter ? NAVY : SHIRT;
  const sleeveLow = girl ? (winter || autumn ? BEIGE_LOW : SHIRT_LOW) : winter ? NAVY_LOW : SHIRT_LOW;
  const longSleeve = outfit !== 'summer';
  const legYr = span(14, spine(50), knL, knR, anL, anR);

  const leg = (hj: V3, kn: V3, an: V3, pole: V3) => {
    const sh = far(kn);
    part(tube(hj, b.leg[0], kn, b.leg[1]), legTop, legLow, { shade: sh, yr: legYr });
    part(tube(kn, b.leg[1], an, b.leg[2]), legTop, legLow, { shade: sh, yr: legYr });
    if (girl && !winter) part(tube(mixv(kn, an, 0.72), b.leg[2] + 1.6, an, b.leg[2] + 1.3), SHIRT, SHIRT_LOW, { shade: sh });
    // the shoe: flat on the floor and pointing the way the body faces, or off the floor hanging square from the shin
    const shin = norm(sub(an, kn)), free = clamp((an[1] - ANKLE - 6) / 54);
    const fwdDir = sub(pole, mul(shin, dot(pole, shin)));
    const dir = norm(mixv([0, 0, 1], len(fwdDir) > 1e-3 ? norm(fwdDir) : [0, 0, 1], free)), dn = norm(mixv([0, -1, 0], shin, free));
    const sole = add(an, mul(dn, ANKLE - b.shoe[1])), toe = add(sole, mul(dir, b.shoe[0])), heel = add(sole, mul(dir, -9));
    part(tube(heel, b.shoe[1], toe, b.shoe[1] * 0.86), girl ? SHOE_HER : SHOE_HIS, girl ? mix('ink', 'navy', 0.3) : mix('paper', 'frost', 0.8), { shade: sh });
  };
  const arm = (sh: V3, el: V3, ha: V3) => {
    const dim = far(el), tip = add(ha, mul(norm(sub(ha, el)), 7)), yr = span(14, sh, el, ha), h2 = PS(tip);
    part(circle(h2[0], h2[1], b.arm[3] * s), SKIN, SKIN_LOW, { shade: dim });
    if (longSleeve) {
      part(tube(sh, b.arm[0] + 1.5, el, b.arm[1] + 1.5), sleeve, sleeveLow, { shade: dim, rim: !dim, yr });
      part(tube(el, b.arm[1] + 1.5, ha, b.arm[2] + 1.5), sleeve, sleeveLow, { shade: dim, yr });
    } else {
      part(tube(sh, b.arm[0], el, b.arm[1]), SKIN, SKIN_LOW, { shade: dim, yr });
      part(tube(el, b.arm[1], ha, b.arm[2]), SKIN, SKIN_LOW, { shade: dim, yr });
      part(tube(sh, b.arm[0] + 2.5, mixv(sh, el, 0.52), b.arm[0] + 2.5), SHIRT, SHIRT_LOW, { shade: dim, rim: !dim });
    }
  };

  // the torso's cross-sections, and what covers them
  const section = (h: number, grow = 0, k = 1): V2[] => {
    const st = b.st, j = st.findIndex((x) => x[0] >= h), i = j < 0 ? st.length - 1 : j;
    const hi = st[i]!, lo = st[Math.max(0, i - 1)]!, u = hi[0] === lo[0] ? 0 : clamp((h - lo[0]) / (hi[0] - lo[0]));
    const w = lerp(lo[1], hi[1], u) + grow, d = lerp(lo[2], hi[2], u) + grow;
    const [A, F] = axes(h);
    return ring(spine(h), A, F, w * k, d * k);
  };
  const shoulders = (grow = 0) => [...section(170, grow), ...section(184, grow, 0.84)];
  /**
   * A ring of her skirt (or coat) round a thigh, `at` along it from the hip. Where the thigh is level
   * (sitting, lying) the cloth rests on top of it and hangs below; it never goes through what she is on.
   */
  const hem = (hj: V3, kn: V3, at: number, w: number, d: number): V2[] => {
    const dir = norm(sub(kn, hj)), c0 = add(hj, mul(dir, at));
    const drop = Math.max(0, d - lerp(b.leg[0], b.leg[1], clamp(at / THIGH)) - 3) * clamp(1 + dir[1]);
    return ring(add(c0, [0, -drop, 0]), [1, 0, 0], cross(dir, [1, 0, 0]), w, d).map(([x, y]) => [x + gust * 8 * s, Math.min(y, p.y)] as V2);
  };
  /** The round of each hip, a little larger than the thigh that starts there: what a skirt or a coat must cover when she sits. */
  const hips = (grow: number): V2[] => [hjL, hjR].flatMap((hj) => { const q = PS(hj); return circle(q[0], q[1], (b.leg[0] + grow) * s, 16).map(([x, y]) => [x, Math.min(y, p.y)] as V2); });
  const torsoZ = P(spine(120))[2];
  const surf = (h: number, x: number, out = 0): V2 => { const [A, F] = axes(h), st = b.st, d = (h > 150 ? st[3]![2] + 1 : st[2]![2] + 2) + out; return PS(add(spine(h), add(mul(A, x), mul(F, d)))); };
  /** A strip down the front of the chest (the shirt between the edges of a cardigan or jacket), if the chest faces us. */
  const front = (halfW: number, h0: number, h1: number, top: string, low: string, out = 1) => {
    if (P(axes(140)[1])[2] < 0.2) return false;
    part([surf(h1, -halfW, out), surf(h1, halfW, out), surf(h0, halfW * 0.8, out), surf(h0, -halfW * 0.8, out)], top, low);
    return true;
  };
  const buttons = (hs: number[], x: number, out: number) => {
    if (br.plain) return;
    for (const h of hs) { const q = surf(h, x, out); br.fill(shape(circle(q[0], q[1], 2.3 * s, 8)), rgba('ink', 0.38), rgba('ink', 0.38), 0, 1); }
  };

  const drawTorso = () => {
    // the neck first: collars go over it
    part(tube(spine(NECK - 8), b.neck, add(headC, [0, -b.R * 0.5, 0]), b.neck * 0.94), SKIN_LOW, SKIN_LOW);
    if (girl) {
      if (winter) {
        // the long coat, over everything down to the knees: its body, and its skirts round the thighs (in two
        // parts that meet at the hips, like the skirt below)
        const round = hips(5), body = hull([...shoulders(4), ...section(130, 4), ...section(0, 6), ...round]);
        const skirts = hull([...round, ...hem(hjL, knL, 146, 26, 28), ...hem(hjR, knR, 146, 26, 28)]), yr = bounds([...body, ...skirts]);
        part(skirts, BEIGE, BEIGE_LOW, { yr }); part(body, BEIGE, BEIGE_LOW, { rim: true, yr });
        if (front(1.1, 16, 166, rgba('ink', 0.2), rgba('ink', 0.2), 5)) buttons([58, 98, 138], 7, 5);
        return;
      }
      if (!autumn) part(hull([...shoulders(0), ...section(130), ...section(40)]), SHIRT, SHIRT_LOW, { rim: true });
      // the skirt in two parts that meet at the hips: round the waist and the seat, and round the thighs down to
      // the hem. (As one shape from waist to hem it bridged over a raised thigh: sitting, it lay on her lap
      // with the hip and the underside of the thigh bare.)
      const round = hips(1), waist = hull([...section(50, 1.5), ...section(0, 3), ...round]);
      const lap = hull([...round, ...hem(hjL, knL, 108, 25, 27), ...hem(hjR, knR, 108, 25, 27)]), sk = [...waist, ...lap], yr = bounds(sk);
      part(waist, NAVY, NAVY_LOW, { yr }); part(lap, NAVY, NAVY_LOW, { yr });
      if (!br.plain) {
        // pleats: from the waist down to the hem
        const skPath = new Path2D();
        skPath.addPath(shape(waist)); skPath.addPath(shape(lap));
        const [ty, by] = yr, top = sk.filter((q) => q[1] < ty + 14 * s), bot = sk.filter((q) => q[1] > by - 24 * s);
        const tx0 = Math.min(...top.map((q) => q[0])), tx1 = Math.max(...top.map((q) => q[0])), bx0 = Math.min(...bot.map((q) => q[0])), bx1 = Math.max(...bot.map((q) => q[0]));
        c.save(); c.clip(skPath);
        const pl = new Path2D();
        for (let i = 1; i < 6; i++) { pl.moveTo(lerp(tx0, tx1, i / 6), ty); pl.lineTo(lerp(bx0, bx1, i / 6), by); }
        c.strokeStyle = rgba('paper', 0.14); c.lineWidth = 1.5; c.stroke(pl);
        c.restore();
      }
      if (autumn) {
        part(hull([...shoulders(3), ...section(130, 3), ...section(-14, 4.5)]), BEIGE, BEIGE_LOW, { rim: true });
        if (front(7, -10, 168, SHIRT, SHIRT_LOW, 3)) buttons([6, 40, 74], 11, 4);
      }
      return;
    }
    // him: the trousers' top, the shirt over it, and in winter a jacket open over the shirt
    part(hull([...section(50, 0.5), ...section(-12, 1.5)]), NAVY, NAVY_LOW, { yr: legYr });
    part(hull([...shoulders(0), ...section(132), ...section(34, 1)]), SHIRT, SHIRT_LOW, { rim: true });
    if (winter) {
      part(hull([...shoulders(4), ...section(132, 4), ...section(-20, 4)]), NAVY, NAVY_LOW, { rim: true });
      front(9, -14, 166, SHIRT, SHIRT_LOW, 4);
    }
  };

  /** The collar, and her ribbon, on the front of the neck. */
  const collar = () => {
    if (br.plain) return;
    const [A, F] = axes(182);
    if (P(F)[2] < -0.25) return;
    const at = (x: number, h: number, z: number): V2 => PS(add(spine(h), add(mul(A, x), mul(F, z))));
    const d = b.st[3]![2];
    for (const sg of [1, -1]) {
      const path = shape([at(sg * 2, 186, d + 3), at(sg * (b.neck + 9), 189, d - 4), at(sg * (b.neck + 4), 168, d + 5)]);
      br.fill(path, SHIRT, SHIRT, 0, 1); br.line(path, 0.22, 1.5);
    }
    if (girl && !(p.scarf ?? false)) {
      const k0 = at(0, 166, d + 6), sw = gust * 7 * s;
      for (const sg of [1, -1]) br.fill(shape([k0, [k0[0] + sg * 13 * s, k0[1] - 6 * s], [k0[0] + sg * 14 * s, k0[1] + 7 * s]]), NAVY, NAVY_LOW, k0[1] - 6 * s, k0[1] + 8 * s);
      for (const sg of [1, -1]) br.fill(shape([k0, [k0[0] + sg * 9 * s + sw, k0[1] + 24 * s], [k0[0] + sg * 2 * s + sw, k0[1] + 22 * s]]), NAVY, NAVY_LOW, k0[1], k0[1] + 24 * s);
      br.fill(shape(circle(k0[0], k0[1], 3.6 * s, 8)), NAVY_LOW, NAVY_LOW, 0, 1);
    }
  };

  /** The rose scarf: a soft ring round the neck and one end hanging down the front. */
  const scarf = () => {
    if (!(p.scarf ?? (!girl && winter))) return;
    const [A, F] = axes(188), c0 = add(spine(188), mul(up, 6));
    const k0 = PS(add(c0, add(mul(A, 9), mul(F, b.neck + 9))));
    if (P(F)[2] > -0.15) {
      const sw = gust * 26 * s, w = 12 * s, l = 80 * s;
      const end = shape([[k0[0] - w, k0[1]], [k0[0] + w, k0[1]], [k0[0] + w + sw, k0[1] + l], [k0[0] - w + sw, k0[1] + l]]);
      br.fill(end, ROSE, ROSE_LOW, k0[1], k0[1] + l);
      if (!br.plain) {
        // knit: a few short strokes across it, and a fringe
        const kn = new Path2D();
        for (let i = 1; i < 6; i++) { const u = i / 6; kn.moveTo(k0[0] - w * 0.6 + sw * u, k0[1] + l * u); kn.lineTo(k0[0] + w * 0.6 + sw * u, k0[1] + l * u); }
        for (let i = 0; i < 4; i++) { const x = k0[0] - w + sw + (w * 2 * (i + 0.5)) / 4; kn.moveTo(x, k0[1] + l); kn.lineTo(x, k0[1] + l + 7 * s); }
        c.strokeStyle = rgba('paper', 0.3); c.lineWidth = 1.5; c.lineCap = 'round'; c.stroke(kn);
      }
    }
    part(hull([...ring(c0, A, F, b.neck + 14, b.neck + 13), ...ring(add(c0, mul(up, 15)), A, F, b.neck + 10, b.neck + 10)]), ROSE, ROSE_LOW, { rim: true });
  };

  /** The backpack: hers on both shoulders, cream with the zipper pocket and its rose pull; his slung on the right one. */
  let zip: V2 = PS(spine(110));
  const bagBox = () => {
    const d = b.st[2]![2], [A, F] = axes(120), cx = girl ? 0 : -13, w = girl ? 29 : 27, hgt = girl ? 46 : 45, dep = girl ? 17 : 15;
    const c0 = add(spine(girl ? 108 : 104), add(mul(A, cx), mul(F, -(d + dep - 2))));
    const pts: V2[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const q = PS(add(c0, add(mul(A, sx * (w - 8)), add(mul(up, sy * (hgt - 8 - (sy > 0 ? 6 : 0))), mul(F, sz * (dep - 8))))));
      pts.push(...circle(q[0], q[1], (sy > 0 ? 14 : 9) * s, 10));
    }
    part(hull(pts), girl ? CREAM : SLATE, girl ? CREAM_LOW : SLATE_LOW, { rim: true });
    // the front pocket is on the face away from the back
    const out = P(F)[2], pc = add(c0, add(mul(F, -(dep + 2)), mul(up, -14)));
    const q = (x: number, y: number): V2 => PS(add(pc, add(mul(A, x), mul(up, y))));
    zip = q(-w + 9, 18);
    if (!br.plain && out < 0.35) {
      if (out < -0.2) part(hull([...circle(...q(-w + 8, -20), 5 * s, 8), ...circle(...q(w - 8, -20), 5 * s, 8), ...circle(...q(-w + 8, 20), 5 * s, 8), ...circle(...q(w - 8, 20), 5 * s, 8)]), girl ? mix(CREAM, 'paper', 0.3) : SLATE, girl ? CREAM_LOW : SLATE_LOW, { line: 0.22 });
      const z0 = q(-w + 9, 18), z1 = q(w - 9, 18), line = new Path2D();
      line.moveTo(z0[0], z0[1]); line.lineTo(z1[0], z1[1]);
      br.line(line, 0.36, 1.8);
      if (girl) {
        c.strokeStyle = ROSE; c.lineWidth = Math.max(1.5, 2 * s); c.lineCap = 'round';
        c.beginPath(); c.moveTo(z0[0], z0[1]); c.lineTo(z0[0] - 1.5 * s, z0[1] + 7 * s); c.stroke();
        br.fill(shape(circle(z0[0] - 2 * s, z0[1] + 9 * s, 3.8 * s, 10)), ROSE, ROSE, 0, 1);
      }
    }
  };
  const straps = () => {
    if (br.plain) return;
    const d = b.st[3]![2], [A, F] = axes(170);
    for (const sg of girl ? [1, -1] : [-1]) {
      const x = sg * (b.sw - 11);
      if (P(add(mul(A, x), mul(F, 4)))[2] < -4) continue;
      const pts = [add(spine(176), add(mul(A, x), mul(F, -d))), add(spine(187), mul(A, x)), add(spine(168), add(mul(A, x * 0.96), mul(F, d + 1))), add(spine(112), add(mul(A, x * 0.9), mul(F, d + 3)))].map(PS);
      const path = new Path2D();
      pts.forEach((q, i) => (i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
      c.strokeStyle = girl ? CREAM_LOW : SLATE_LOW; c.lineWidth = 6.5 * s; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(path);
    }
  };

  // ---- the head: a skull of radius R, and regions of it (hair, face) by direction
  const hc = P(headC), R = b.R, C = S(hc);
  const dirOf = (lon: number, la: number): V3 => [Math.sin(lon * DEG) * Math.cos(la * DEG), Math.sin(la * DEG), Math.cos(lon * DEG) * Math.cos(la * DEG)];
  /** A direction of the head (longitude: 0 = the nose, + = its left; latitude) on screen, with how much it faces us (-1..1). */
  const on = (lon: number, la: number, r = 1): { q: V2; z: number } => { const d = mv(H, dirOf(lon, la)); return { q: S(add(hc, mul(d, R * r))), z: d[2] }; };
  const scr = (d: V3, r = 1): V2 => S(add(hc, mul(d, R * r)));
  const hairCol = girl ? HAIR_HER : HAIR_HIS, hairLight = girl ? HAIR_HER_LIGHT : HAIR_HIS_LIGHT;
  const hairC = scr(mv(H, [0, 0.07, -0.05])), hairR = R * 1.09 * s;
  const back = mv(H, [0, 0, -1]);                                  // which way the back of the head points, in view space
  const tie = add(hc, mul(mv(H, [0, -0.7, -0.66]), R));
  /**
   * The part of a region of the skull that faces us, as a screen polygon: `loop` is its edge (directions of
   * the head, in order) and `inside` says whether a direction is in it. Where the region goes round the
   * back of the head the polygon is closed outside the outline.
   */
  const seen = (loop: V3[], inside: (d: V3) => boolean): V2[] | null => {
    const vd = loop.map((d) => mv(H, d)), n = vd.length, vis = vd.map((d) => d[2] >= 0), count = vis.filter(Boolean).length;
    if (count === n) return vd.map((d) => scr(d));
    const N = 72, rim = Array.from({ length: N }, (_, k) => inside(mv(HT, [Math.cos((k / N) * TAU), Math.sin((k / N) * TAU), 0])));
    if (count === 0) return rim.every(Boolean) ? circle(C[0], C[1], R * 1.6 * s, 24) : null;
    let i0 = 0;
    while (!(vis[i0] && !vis[(i0 + n - 1) % n])) i0++;
    const pts: V2[] = [];
    let last = vd[i0]!;
    for (let k = 0; k < n && vis[(i0 + k) % n]; k++) { last = vd[(i0 + k) % n]!; pts.push(scr(last)); }
    if (!rim.some(Boolean) || rim.every(Boolean)) return pts;
    let k0 = 0;
    while (!(rim[k0] && !rim[(k0 + N - 1) % N])) k0++;
    const arc: number[] = [];
    for (let k = 0; k < N && rim[(k0 + k) % N]; k++) arc.push((((k0 + k) % N) / N) * TAU);
    const aB = Math.atan2(last[1], last[0]), away = (a: number) => Math.abs(Math.atan2(Math.sin(a - aB), Math.cos(a - aB)));
    if (away(arc[0]!) > away(arc[arc.length - 1]!)) arc.reverse();
    for (const a of arc) pts.push(scr([Math.cos(a), Math.sin(a), 0], 1.6));
    return pts;
  };
  // the face: a rounded patch of the front of the skull; and what is bare under the hair, lower toward the nape
  const FA = girl ? 60 : 72, FC = girl ? -32 : -30, FB = girl ? 50 : 55, FN = 2.6;
  const inFace = (d: V3) => { const lon = Math.atan2(d[0], d[2]) / DEG, la = Math.asin(clamp(d[1], -1, 1)) / DEG; return Math.abs(lon / FA) ** FN + Math.abs((la - FC) / FB) ** FN < 1; };
  const faceLoop = Array.from({ length: 64 }, (_, i) => { const th = (i / 64) * TAU, cx = Math.cos(th), sy = Math.sin(th); return dirOf(FA * Math.sign(cx) * Math.abs(cx) ** (2 / FN), FC + FB * Math.sign(sy) * Math.abs(sy) ** (2 / FN)); });
  const UA = dirOf(0, girl ? -60 : -62), UR = (girl ? 61 : 63) * DEG;
  const inUnder = (d: V3) => dot(d, UA) > Math.cos(UR);
  const u0 = norm(cross(UA, [1, 0, 0])), v0 = cross(UA, u0);
  const underLoop = Array.from({ length: 64 }, (_, i) => { const f = (i / 64) * TAU; return add(mul(UA, Math.cos(UR)), add(mul(u0, Math.sin(UR) * Math.cos(f)), mul(v0, Math.sin(UR) * Math.sin(f)))); });
  /** A lock of hair between two points of the hairline and a tip, by direction; drawn if its tip faces us. */
  const lock = (lon0: number, lon1: number, top: number, tipLon: number, tipLa: number, r = 1.02) => {
    const a = on(lon0, top, r), z = on(lon1, top, r), tip = on(tipLon, tipLa, r);
    if (tip.z < 0.06 || (a.z < 0 && z.z < 0)) return;
    const c1 = on(lon0 + (tipLon - lon0) * 0.25, tipLa + (top - tipLa) * 0.3, r), c2 = on(lon1 + (tipLon - lon1) * 0.25, tipLa + (top - tipLa) * 0.3, r);
    const path = new Path2D();
    path.moveTo(a.q[0], a.q[1]); path.quadraticCurveTo(c1.q[0], c1.q[1], tip.q[0], tip.q[1]); path.quadraticCurveTo(c2.q[0], c2.q[1], z.q[0], z.q[1]); path.closePath();
    br.fill(path, hairCol, hairCol, 0, 1);
    if (!br.plain) { c.strokeStyle = hairCol; c.lineWidth = 2 * s; c.lineJoin = 'round'; c.stroke(path); }
  };

  const ponytail = () => {
    if (!girl) return;
    const T = S(tie), bx = back[0], sw = (gust * 0.55 + 0.02 * Math.sin(t * 1.9)) * R * s, L = 1.95 * R * s, pts: V2[] = [];
    // a tapering ribbon of hair from the tie down the back, fuller in the middle
    const mid = (u: number): V2 => [T[0] + bx * R * s * 0.42 * Math.sin(u * 2.4) * (1 - u * 0.45) + sw * u * u, T[1] + L * u];
    const wide = (u: number) => (0.13 + 0.2 * Math.sin(Math.min(1, u * 1.25) * Math.PI) ** 0.8 * (1 - u * 0.35)) * R * s;
    for (let i = 0; i <= 12; i++) { const u = i / 12, q = mid(u); pts.push([q[0] - wide(u), q[1]]); }
    for (let i = 12; i >= 0; i--) { const u = i / 12, q = mid(u); pts.push([q[0] + wide(u), q[1]]); }
    const path = part(pts, hairCol, hairCol);
    if (!br.plain) { c.strokeStyle = hairCol; c.lineWidth = 2.5 * s; c.lineJoin = 'round'; c.stroke(path); br.rim(path, rimW, mix(hairCol, 'gold', 0.5, 0.6)); }
    part(circle(T[0], T[1] + 2 * s, 5.2 * s, 10), NAVY, NAVY_LOW);
  };

  const eyes: [V2, V2] = [on(21, -13).q, on(-21, -13).q], eyesSeen: [number, number] = [clamp(on(21, -13).z * 2), clamp(on(-21, -13).z * 2)];
  const head = () => {
    const disc = shape(circle(hairC[0], hairC[1], hairR, 40));
    if (girl) {
      // the hair behind: down the nape to where it is tied
      const T = S(tie);
      part(hull([...circle(hairC[0], hairC[1], hairR, 24), ...circle(T[0], T[1], 0.36 * R * s, 10)]), hairCol, hairCol);
    }
    // the skull and the jaw as one skin shape, a hint of a nose for the profile
    const jaw = scr(mv(H, [0, -0.36, 0.13])), jawR = R * 0.72 * s, nose = on(0, -25, 1.03);
    const skin = new Path2D();
    skin.arc(C[0], C[1], R * s, 0, TAU); skin.closePath();
    skin.moveTo(jaw[0] + jawR, jaw[1]); skin.arc(jaw[0], jaw[1], jawR, 0, TAU); skin.closePath();
    skin.moveTo(nose.q[0] + 0.09 * R * s, nose.q[1]); skin.arc(nose.q[0], nose.q[1], 0.09 * R * s, 0, TAU);
    br.fill(skin, SKIN, SKIN_LOW, C[1] - R * s, jaw[1] + jawR + 14 * s);
    // the face: only what is turned toward us
    if (!br.plain) {
      const bl = clamp(p.blush ?? 0.5);
      for (const sg of [1, -1]) {
        const k = on(sg * 37, -31);
        if (k.z > 0.1 && bl > 0.01) { c.fillStyle = BLUSH; c.globalAlpha = A0 * 0.62 * bl * clamp(k.z * 2); c.beginPath(); c.ellipse(k.q[0], k.q[1], 10 * s * clamp(k.z + 0.25), 5.8 * s, 0, 0, TAU); c.fill(); c.globalAlpha = A0; }
        const e = on(sg * 21, -13);
        if (e.z > 0.16) {
          c.strokeStyle = rgba('ink', 0.92); c.fillStyle = rgba('ink', 0.94); c.lineWidth = clamp(2.2 * s, 1.5, 3); c.lineCap = 'round';
          if (smile > 0.5) { c.beginPath(); c.ellipse(e.q[0], e.q[1] - 2.5 * s, 5.6 * s * clamp(e.z + 0.2), 4.8 * s, 0, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke(); }
          else { c.beginPath(); c.ellipse(e.q[0], e.q[1], 3.4 * s * clamp(e.z + 0.25), 4.5 * s, 0, 0, TAU); c.fill(); }
        }
      }
      const m = on(0, -47);
      if (m.z > 0.3 && smile > 0.15) {
        c.strokeStyle = rgba('ink', 0.6 * clamp(smile * 1.4)); c.lineWidth = clamp(1.9 * s, 1.5, 2.6); c.lineCap = 'round';
        c.beginPath(); c.ellipse(m.q[0], m.q[1] - 3 * s, 5.5 * s * clamp(m.z), 4 * s, 0, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
      }
    }
    // the hair over it: all of the head's outline but the face and what is bare under the hairline
    c.save();
    if (!br.plain) for (const hole of [seen(faceLoop, inFace), seen(underLoop, inUnder)]) {
      if (!hole) continue;
      const m = new Path2D();
      m.rect(hairC[0] - hairR * 4, hairC[1] - hairR * 4, hairR * 8, hairR * 8); m.addPath(shape(hole));
      c.clip(m, 'evenodd');
    }
    br.fill(disc, hairCol, hairCol, 0, 1);
    if (!br.plain) {
      // a soft sheen across the top, and the light on its edge
      const a0 = Math.atan2(-mv(H, [0, 1, 0])[1], mv(H, [0, 1, 0])[0]);
      c.strokeStyle = hairLight; c.globalAlpha = A0 * 0.5; c.lineWidth = 4.5 * s; c.lineCap = 'round';
      c.beginPath(); c.arc(hairC[0] + (light ? light[0] : -0.5) * 7 * s, hairC[1] + 9 * s, hairR * 0.74, a0 - 0.95, a0 + 0.45); c.stroke();
      c.globalAlpha = A0;
      br.rim(disc, rimW * 1.25, mix(hairCol, 'gold', 0.62, 0.8));
    }
    c.restore();
    if (girl) {
      // her fringe: soft locks, longer toward the temples; and the loose strands in front of each ear
      const tips = [-7, 1, 4, 0, -8];
      [-46, -23, 0, 23, 46].forEach((lon, i) => lock(lon - 15, lon + 15, 30, lon + 4, tips[i]!));
      for (const sg of [1, -1]) {
        const k = on(sg * 63, 6, 1.03);
        if (k.z < -0.12) continue;
        const sw = gust * 0.3 * R * s, L = 1.16 * R * s, w = 0.085 * R * s, a = k.q, st = new Path2D();
        st.moveTo(a[0] - w, a[1]);
        st.quadraticCurveTo(a[0] - w * 0.4 + sw * 0.3, a[1] + L * 0.6, a[0] + sw, a[1] + L);
        st.quadraticCurveTo(a[0] + w * 1.5 + sw * 0.3, a[1] + L * 0.5, a[0] + w, a[1]);
        st.closePath();
        br.fill(st, hairCol, hairCol, 0, 1);
      }
    } else {
      // his: an uneven fringe swept to one side, tufts that stand off the outline, and his ears showing
      const tips = [9, 16, 6, 14];
      [-42, -17, 8, 33].forEach((lon, i) => lock(lon - 15, lon + 15, 38, lon + 9, tips[i]!));
      for (const [lon, la, k] of [[150, 55, 1], [-155, 34, 0.9], [62, 72, 0.8], [-66, 64, 0.95], [-118, 16, 0.7], [172, 14, 0.75]] as const) {
        const d = mv(H, dirOf(lon, la)), l = Math.hypot(d[0], d[1]);
        if (l < 0.55) continue;
        const nx = d[0] / l, ny = -d[1] / l, bx = hairC[0] + nx * hairR * 0.95, by = hairC[1] + ny * hairR * 0.95, r = 0.21 * R * s * k;
        const tx = bx + (nx * 1.45 + gust * 0.4) * r + ny * r * 0.55, ty = by + ny * 1.45 * r - nx * r * 0.55;
        const tuft = shape([[bx - ny * r, by + nx * r], [tx, ty], [bx + ny * r, by - nx * r]]);
        br.fill(tuft, hairCol, hairCol, 0, 1);
        if (!br.plain) { c.strokeStyle = hairCol; c.lineWidth = 2.4 * s; c.lineJoin = 'round'; c.stroke(tuft); }
      }
      if (!br.plain) for (const sg of [1, -1]) {
        const e = on(sg * 88, -22, 1.0);
        if (e.z > -0.35 && Math.abs(e.z) < 0.9) part(circle(e.q[0], e.q[1], 0.15 * R * s, 12), SKIN, SKIN_LOW);
      }
    }
  };

  // ---- paint it, far things first
  if (p.shadow && !br.plain) {
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 70 * s);
    g.addColorStop(0, rgba('ink', 0.3 * p.shadow * A0)); g.addColorStop(1, rgba('ink', 0));
    c.save(); c.translate(p.x, p.y + 2 * s); c.scale(1, 0.16); c.translate(-p.x, -p.y);
    c.fillStyle = g; c.fillRect(p.x - 70 * s, p.y - 70 * s, 140 * s, 140 * s);
    c.restore();
  }
  if (p.alpha !== undefined) { c.save(); c.globalAlpha = p.alpha; }
  const wears = p.bag ?? !down;
  const bagZ = P(add(spine(110), mul(axes(110)[1], -40)))[2];
  const armZ = (el: V3, k: string) => (pose.over.includes(k) ? torsoZ + 400 : P(el)[2] < -6 ? P(el)[2] - 100 : P(el)[2] + 100);
  const order: { z: number; draw: () => void }[] = [
    { z: P(knL)[2] - 200, draw: () => leg(hjL, knL, anL, pose.kneeL) },
    { z: P(knR)[2] - 200, draw: () => leg(hjR, knR, anR, pose.kneeR) },
    { z: armZ(elL, 'L'), draw: () => arm(shL, elL, haL) },
    { z: armZ(elR, 'R'), draw: () => arm(shR, elR, haR) },
    { z: torsoZ, draw: () => { drawTorso(); if (wears) straps(); collar(); scarf(); } },
    { z: back[2] > 0.3 ? torsoZ + 320 : back[2] < -0.45 ? torsoZ - 320 : torsoZ + 40, draw: ponytail },
    { z: torsoZ + 300, draw: head },
  ];
  if (wears) order.push({ z: bagZ < -8 ? torsoZ - 250 : bagZ > 8 ? torsoZ + 150 : torsoZ - 20, draw: bagBox });
  order.sort((a, z) => a.z - z.z).forEach((o) => o.draw());
  if (p.alpha !== undefined) c.restore();

  const [A8, F8] = axes(8);
  return {
    head: C, top: [hairC[0], hairC[1] - hairR], chin: scr(mv(H, [0, -1.08, 0.13])), neck: PS(spine(NECK)), chest: PS(spine(130)), hip: PS(hip),
    handL: PS(add(haL, mul(norm(sub(haL, elL)), 7))), handR: PS(add(haR, mul(norm(sub(haR, elR)), 7))), footL: PS(anL), footR: PS(anR),
    eyes, eyesSeen, zip, pocket: PS(add(spine(8), add(mul(A8, -(b.sw - 6)), mul(F8, 14)))), scale: s,
  };
}

/** Her: long dark-brown hair in a low ponytail, white shirt and navy ribbon, navy pleated skirt, a beige cardigan in autumn or a long beige coat in winter. */
export const drawGirl = (c: Ctx, pose: PoseArg, p: CharParams) => figure(c, 'girl', pose, p);
/** Him: short messy dark hair, white shirt, navy trousers, the bag on one shoulder, a rose scarf in winter. */
export const drawBoy = (c: Ctx, pose: PoseArg, p: CharParams) => figure(c, 'boy', pose, p);
/** A background student: either build, as a soft single-colour silhouette (between frost and sky by default; blur the layer it is on). */
export const drawStudent = (c: Ctx, pose: PoseArg, p: CharParams & { boy?: boolean }) =>
  figure(c, p.boy ? 'boy' : 'girl', pose, { ...p, silhouette: p.silhouette ?? mix('frost', 'sky', 0.4), light: null, bag: p.bag ?? false });
