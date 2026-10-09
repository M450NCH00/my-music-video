// The people of the school, seen from the side: the head every character shares (hair and
// expression vary) and a simple walking or running figure for classmates in the background.
import { hash, lerp, TAU } from '../engine/util';
import { C, ink, joint, limb, poly, rr, type Ctx, type Pal } from './_school';

const LINE = C.line;

export interface Face {
  hair: 'ponytail' | 'short';
  eye?: 'open' | 'sleepy' | 'closed' | 'happy' | 'wide';
  /** Where the eye looks, in head units: +x ahead, +y down (about ±0.05). */
  look?: [number, number];
  mouth?: 'flat' | 'smile' | 'open';
  /** 1 = the usual blush, 2 = flustered. */
  blush?: number;
  /** Chalk dust settled on the hair, 0..1. */
  dust?: number;
}

/**
 * A head in profile, in units of its radius, centred on the skull: x toward the face (looking
 * right), y down. The neck hangs below it, to be covered by the collar.
 */
export function head(c: Ctx, t: number, P: Pal, f: Face) {
  const [lx, ly] = f.look ?? [0, 0];
  const eye = f.eye ?? 'open', bl = f.blush ?? 1;
  c.beginPath();
  c.moveTo(0.05, -1);
  c.bezierCurveTo(0.55, -1, 0.92, -0.62, 0.95, -0.18);
  c.quadraticCurveTo(0.96, -0.02, 0.93, 0.05);
  c.lineTo(1.04, 0.2);
  c.quadraticCurveTo(1.03, 0.27, 0.95, 0.28);
  c.quadraticCurveTo(0.93, 0.34, 0.94, 0.4);
  c.lineTo(0.9, 0.45);
  c.quadraticCurveTo(0.93, 0.52, 0.9, 0.6);
  c.quadraticCurveTo(0.9, 0.8, 0.7, 0.9);
  c.quadraticCurveTo(0.42, 0.98, 0.18, 0.84);
  c.lineTo(0.1, 1.2);
  c.lineTo(-0.44, 1.2);
  c.lineTo(-0.4, 0.6);
  c.bezierCurveTo(-0.95, 0.55, -1, -0.2, -0.85, -0.5);
  c.bezierCurveTo(-0.7, -0.9, -0.3, -1, 0.05, -1);
  c.closePath();
  ink(c, P.skin, 0.036);
  c.fillStyle = P.blush;
  c.globalAlpha = Math.min(1, 0.55 * bl);
  c.beginPath();
  c.ellipse(0.56, 0.36, 0.13 + 0.03 * bl, 0.07 + 0.02 * bl, 0, 0, TAU);
  c.fill();
  c.globalAlpha = 1;

  c.strokeStyle = LINE;
  c.lineCap = 'round';
  if (eye === 'closed') {
    c.lineWidth = 0.045;
    c.beginPath();
    c.moveTo(0.46, 0.05);
    c.quadraticCurveTo(0.6, 0.13, 0.74, 0.04);
    c.stroke();
  } else if (eye === 'happy') {
    c.lineWidth = 0.05;
    c.beginPath();
    c.moveTo(0.46, 0.12);
    c.quadraticCurveTo(0.6, -0.06, 0.75, 0.1);
    c.stroke();
  } else {
    const k = eye === 'wide' ? 1.2 : 1, top = eye === 'sleepy' ? 0.04 : -0.04;
    c.save();
    c.translate(0.61 + lx, 0.09 + ly);
    c.scale(k, k);
    c.beginPath();
    c.moveTo(-0.13, top - 0.09);
    if (eye === 'sleepy') c.lineTo(0.12, top - 0.09);
    else c.quadraticCurveTo(-0.01, -0.24, 0.12, -0.14);
    c.quadraticCurveTo(0.15, 0.13, 0, 0.14);
    c.quadraticCurveTo(-0.15, 0.13, -0.13, top - 0.09);
    c.closePath();
    c.fillStyle = '#3A2F45';
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(0.045 + lx * 0.6, (eye === 'sleepy' ? 0.02 : -0.07) + ly * 0.6, eye === 'wide' ? 0.05 : 0.045, 0, TAU);
    c.fill();
    c.restore();
    c.lineWidth = 0.05;
    c.beginPath();
    if (eye === 'sleepy') {
      c.moveTo(0.42 + lx, 0.03 + ly);
      c.lineTo(0.77 + lx, 0.03 + ly);
    } else {
      c.moveTo(0.41 + lx, 0.0 + ly);
      c.quadraticCurveTo(0.58 + lx, -0.17 * k + ly, 0.76 + lx, -0.06 + ly);
    }
    c.stroke();
  }
  const brow = eye === 'wide' ? -0.07 : eye === 'sleepy' ? 0.03 : 0;
  c.lineWidth = 0.035;
  c.beginPath();
  c.moveTo(0.48, -0.28 + brow);
  c.quadraticCurveTo(0.62, -0.33 + brow, 0.78, -0.3 + brow);
  c.stroke();
  if (f.mouth === 'open') {
    c.beginPath();
    c.ellipse(0.86, 0.5, 0.05, 0.085, 0.2, 0, TAU);
    ink(c, P.mouth, 0.03);
  } else {
    c.lineWidth = f.mouth === 'smile' ? 0.036 : 0.03;
    c.beginPath();
    if (f.mouth === 'smile') {
      c.moveTo(0.76, 0.44);
      c.quadraticCurveTo(0.84, 0.57, 0.925, 0.45);
    } else {
      c.moveTo(0.82, 0.47);
      c.lineTo(0.9, 0.455);
    }
    c.stroke();
  }

  if (f.hair === 'ponytail') {
    // the tail, swaying a little
    c.save();
    c.translate(-0.8, -0.36);
    c.rotate(Math.sin(t * 1.4) * 0.035);
    c.beginPath();
    c.moveTo(0.02, -0.14);
    c.bezierCurveTo(-0.66, -0.16, -0.84, 0.78, -0.46, 1.44);
    c.bezierCurveTo(-0.36, 1.52, -0.26, 1.44, -0.22, 1.34);
    c.bezierCurveTo(-0.36, 0.78, -0.3, 0.32, 0.04, 0.14);
    c.closePath();
    ink(c, P.hair, 0.036);
    c.restore();
    // over the skull, a fringe above the brow, a lock in front of the ear
    c.beginPath();
    c.moveTo(0.94, -0.5);
    c.bezierCurveTo(0.74, -1.08, -0.2, -1.27, -0.8, -0.76);
    c.bezierCurveTo(-1.16, -0.4, -1.1, 0.3, -0.8, 0.64);
    c.lineTo(-0.42, 0.68);
    c.bezierCurveTo(-0.3, 0.32, -0.14, 0.18, 0.0, 0.22);
    c.quadraticCurveTo(0.04, 0.52, 0.17, 0.72);
    c.quadraticCurveTo(0.27, 0.3, 0.34, -0.3);
    c.quadraticCurveTo(0.62, -0.46, 0.95, -0.46);
    c.closePath();
    ink(c, P.hair, 0.036);
  } else {
    // short: a tuft that stands up at the back, a few spikes for a fringe, the ear showing
    poly(c, [-0.4, -1.06, -0.5, -1.24, -0.2, -1.13]);
    ink(c, P.hair, 0.036);
    c.beginPath();
    c.moveTo(0.95, -0.46);
    c.bezierCurveTo(0.78, -1.1, -0.25, -1.3, -0.82, -0.78);
    c.bezierCurveTo(-1.12, -0.45, -1.08, 0.1, -0.86, 0.42);
    c.lineTo(-0.52, 0.5);
    c.bezierCurveTo(-0.46, 0.2, -0.34, 0.02, -0.2, -0.06);
    c.lineTo(-0.02, -0.06);
    c.quadraticCurveTo(0.08, 0.16, 0.17, 0.32);
    c.quadraticCurveTo(0.26, 0.04, 0.36, -0.3);
    c.quadraticCurveTo(0.5, -0.2, 0.6, -0.42);
    c.quadraticCurveTo(0.7, -0.26, 0.8, -0.44);
    c.quadraticCurveTo(0.88, -0.38, 0.95, -0.46);
    c.closePath();
    ink(c, P.hair, 0.036);
    c.beginPath();
    c.ellipse(-0.17, 0.19, 0.085, 0.13, 0.15, 0, TAU);
    ink(c, P.skin, 0.036);
  }
  c.strokeStyle = P.hairLight;
  c.lineWidth = 0.035;
  c.beginPath();
  c.moveTo(0.1, -0.92);
  c.bezierCurveTo(0.42, -0.86, 0.6, -0.66, 0.68, -0.52);
  c.moveTo(-0.3, -0.98);
  c.bezierCurveTo(-0.62, -0.84, -0.86, -0.5, -0.9, -0.1);
  c.stroke();
  if (f.hair === 'ponytail') {
    c.beginPath();
    c.arc(-0.82, -0.36, 0.11, 0, TAU);
    ink(c, P.red, 0.036);
  }
  const specks = Math.round((f.dust ?? 0) * 22);
  c.fillStyle = C.paper;
  for (let i = 0; i < specks; i++) {
    const a = -2.95 + 2.45 * hash(i, 71), r = 0.64 + 0.36 * hash(i, 72);
    c.beginPath();
    c.arc(Math.cos(a) * r, Math.sin(a) * r, 0.016 + 0.022 * hash(i, 73), 0, TAU);
    c.fill();
  }
}

export interface Walker {
  hair: 'ponytail' | 'short';
  shirt?: string;
  legs?: string;
  skirt?: boolean;
  /** Colour of the bag on the back, or null for none. */
  bag?: string | null;
  run?: boolean;
  /** 0..1: both arms thrown up. */
  armsUp?: number;
  face?: Partial<Face>;
}

/**
 * A figure walking (or running) to the right, about 560 px tall, its feet around (0, 0).
 * `phase` advances the stride (one step per π).
 */
export function walker(c: Ctx, t: number, P: Pal, phase: number, o: Walker) {
  const run = !!o.run, A = run ? 92 : 56, lift = run ? 50 : 26;
  const hipY = -236 - Math.abs(Math.cos(phase)) * (run ? 14 : 7);
  const legs = o.legs ?? P.navy, shirt = o.shirt ?? P.shirt, up = o.armsUp ?? 0;
  for (const k of [-1, 1]) {
    const fx = k * Math.sin(phase) * A, fy = -Math.max(0, k * Math.cos(phase)) * lift - 14;
    const [kx, ky] = joint(0, hipY, fx, fy, 122, 122, -1);
    limb(c, [0, hipY, kx, ky, fx, fy], 30, o.skirt ? (k < 0 ? P.skinShade : P.skin) : k < 0 ? P.navyDark : legs);
    rr(c, fx - 22, fy - 10, 64, 26, [10, 14, 6, 6]);
    ink(c, P.shoe, 3);
  }
  c.save();
  c.translate(0, hipY);
  c.rotate(run ? 0.2 : 0.04);
  if (o.bag) {
    rr(c, -82, -196, 52, 124, 18);
    ink(c, o.bag, 3);
  }
  c.save();
  c.translate(8, -262);
  c.scale(62, 62);
  head(c, t, P, { hair: o.hair, ...o.face });
  c.restore();
  rr(c, -40, -202, 80, 216, 30);
  ink(c, shirt, 3);
  if (o.skirt) {
    poly(c, [-42, -44, 42, -44, 58, 46, -58, 46]);
    ink(c, P.navy, 3);
  }
  const hx = lerp(Math.sin(phase + Math.PI) * (run ? 70 : 46), 46, up), hy = lerp(run ? 96 : 124, -150, up);
  const reach = up > 0.5 ? 80 : 68;
  const [ex, ey] = joint(0, -172, hx, -172 + hy, reach, reach, up > 0.5 ? -1 : 1);
  limb(c, [0, -172, ex, ey, hx, -172 + hy], 24, shirt);
  c.beginPath();
  c.arc(hx, -172 + hy, 13, 0, TAU);
  ink(c, P.skin, 3);
  c.restore();
}
