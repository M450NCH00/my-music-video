// INTRO, its one camera move — from her desk, back through the classroom and out of her window, until the school is
// a grid of windows; the outro makes the same move the other way. Where the camera is at each beat of it (viewAt):
// the two scenes paint what is in front of it.
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { clamp, ease, lerp, prog, smoothstep } from '../engine/util';
import { INTRO_RING, type Cam, type Ctx, type V2 } from './_love';
import { PEN_AT } from './intro-desk';
import { HER_HAND, HER_HEAD } from './intro-classroom';
import { BELL, WIN } from './intro-outside';

/** A smooth curve through the knots that never overshoots and is flat at both ends: a move that passes through set values without stopping on the way. */
export function curve(knots: [number, number][]) {
  const n = knots.length, h: number[] = [], d: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h.push(knots[i + 1]![0] - knots[i]![0]); d.push((knots[i + 1]![1] - knots[i]![1]) / h[i]!); }
  for (let i = 1; i < n - 1; i++) if (d[i - 1]! * d[i]! > 0) { const a = 2 * h[i]! + h[i - 1]!, b = h[i]! + 2 * h[i - 1]!; m[i] = (a + b) / (a / d[i - 1]! + b / d[i]!); }
  return (x: number) => {
    if (x <= knots[0]![0]) return knots[0]![1];
    if (x >= knots[n - 1]![0]) return knots[n - 1]![1];
    let i = 0;
    while (x > knots[i + 1]![0]) i++;
    const u = (x - knots[i]![0]) / h[i]!, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * knots[i]![1] + (u3 - 2 * u2 + u) * h[i]! * m[i]! + (3 * u2 - 2 * u3) * knots[i + 1]![1] + (u3 - u2) * h[i]! * m[i + 1]!;
  };
}

// ---- the timing, in beats of the intro: q = 0 on the downbeat four bars before its cut, 16 at the cut (the song starts near -2)
/** The desk: the frame comes out of paper; the camera pushes in, and at PULL starts back; the sun blooms as the desk gives way to the classroom. */
export const FADE_IN: V2 = [-2, -0.2], PULL = 2.6, DESK_OUT: V2 = [2.95, 4];
/**
 * The scale of the classroom picture on screen, by beat: from CLOSE on her at her desk, back until the room
 * fills the frame (1, on OUT), and on out through the window until it is a tenth, one window of the building.
 */
export const CLOSE = 2.6, OUT = 7.5;
const ROOM = curve(([[PULL, CLOSE], [3.6, 2.35], [4.6, 1.85], [5.5, 1.36], [6.1, 1.07], [7, 1.015], [OUT, 1], [8, 0.8], [9, 0.3], [9.7, 0.15], [10.3, 0.108], [11, 0.101], [12, 0.1]] as [number, number][]).map(([q, s]) => [q, Math.log(s)]));
export const roomScale = (q: number) => Math.exp(ROOM(q));
/** From SMALL on the classroom is a small picture in her window: it is painted once, as it is then, and kept. */
export const SMALL = 9;
const CENTRE: V2 = [W / 2, H / 2], WIN_MID: V2 = [WIN.x + WIN.w / 2, WIN.y + WIN.h / 2], WIN_K = W / WIN.w;

/** The camera at one beat of the move, and what goes with it. */
export interface View {
  /** The scale of the classroom picture; whether the camera is outside the window; how much of the desk picture is over the classroom yet (0..1). */
  s: number; outside: boolean; desk: number;
  /** The camera in the classroom. */
  roomCam: Cam;
  /** The camera outside, and the building's plane under it as a scale and an offset (screen = p * S + O); how close that is (1: the building fills the frame as the intro shows it). */
  cam: Cam; S: number; O: V2; Z: number;
  /** Her window, and the bell, on screen. */
  win: { x: number; y: number; w: number; h: number }; bell: V2;
  /** What drawOutside has in and out of focus from here. */
  focus: { blur: number; glass: number; frameBlur: number; near: number; sun: number };
  /** The desk picture: where its pen is on screen, and its scale. */
  pin: V2; a: number;
}
/** The view at beat `q` of the intro's move. `moveIn` (0..1): how far the camera has gone in on the bell, outside (the intro's last beats). */
export function viewAt(q: number, moveIn = 0): View {
  const s = Math.exp(ROOM(q)), desk = 1 - smoothstep(DESK_OUT[0], DESK_OUT[1], q), outside = s < 1;

  // ---- the camera in the classroom: it starts on her hand (where the desk picture's pen is) and rises to her face
  const push = 1 + 0.045 * ease.outSine(prog(q, FADE_IN[0], PULL)), about: V2 = [1000, 600];
  const penOnScreen: V2 = [(PEN_AT[0] - about[0]) * 1.045 + about[0], (PEN_AT[1] - about[1]) * 1.045 + about[1]];
  const from: V2 = [HER_HAND[0] - (penOnScreen[0] - CENTRE[0]) / CLOSE, HER_HAND[1] - (penOnScreen[1] - CENTRE[1]) / CLOSE], to: V2 = [HER_HEAD[0] - 100, HER_HEAD[1]];
  const rise = ease.inOutSine(prog(q, PULL, 4.7)), k = outside ? 0 : ((1 - Math.exp(-3.2 * (1 - 1 / s))) / (1 - Math.exp(-3.2 * (1 - 1 / CLOSE)))) ** 1.6;
  const look: V2 = [CENTRE[0] + (lerp(from[0], to[0], rise) - CENTRE[0]) * k, CENTRE[1] + (lerp(from[1], to[1], rise) - CENTRE[1]) * k];
  const roomCam: Cam = { zoom: Math.max(1, s), x: look[0] - CENTRE[0], y: look[1] - CENTRE[1] };

  // ---- the camera outside: the building's plane, as a scale S and an offset O (screen = p * S + O).
  // Coming out, her window stays in the middle; it slides to its place in the wall as the building comes into view;
  // then the camera moves in on the bell, until the bell is where the ring will end.
  const Z = s * WIN_K, far = smoothstep(0, 1, clamp(1 - Math.log(Math.max(Z, 1)) / Math.log(WIN_K)));
  const mid: V2 = [lerp(CENTRE[0], WIN_MID[0], far), lerp(CENTRE[1], WIN_MID[1], far)];
  let S = Z, O: V2 = [mid[0] - WIN_MID[0] * Z, mid[1] - WIN_MID[1] * Z];
  const z4 = 1 + 0.6 * moveIn;
  const bell0: V2 = [BELL[0] * S + O[0], BELL[1] * S + O[1]], bell: V2 = [lerp(bell0[0], INTRO_RING.x, moveIn), lerp(bell0[1], INTRO_RING.y, moveIn)];
  O = [(O[0] - bell0[0]) * z4 + bell[0], (O[1] - bell0[1]) * z4 + bell[1]]; S *= z4;
  const cam: Cam = { zoom: S, x: (CENTRE[0] - O[0]) / S - CENTRE[0], y: (CENTRE[1] - O[1]) / S - CENTRE[1] };
  const win = { x: WIN.x * S + O[0], y: WIN.y * S + O[1], w: WIN.w * S, h: WIN.h * S };
  const focus = { blur: clamp((Z - 2.2) * 2, 0, 12), glass: 1 - smoothstep(0.45, 1, s), frameBlur: clamp((Z - 1.6) * 2.2, 0, 14), near: 1 - smoothstep(1.3, 3, Z), sun: 1 - smoothstep(1.5, 3.2, Z) };

  // ---- her desk from above: over the classroom until the camera has left it, its pen where her hand is there
  const hs: V2 = [(HER_HAND[0] - look[0]) * s + CENTRE[0], (HER_HAND[1] - look[1]) * s + CENTRE[1]];
  const a = q < PULL ? push : 1.045 * (s / CLOSE) ** 2.2, pin: V2 = q < PULL ? [(PEN_AT[0] - about[0]) * push + about[0], (PEN_AT[1] - about[1]) * push + about[1]] : hs;
  return { s, outside, desk, roomCam, cam, S, O, Z, win, bell, focus, pin, a };
}

/** The glass of her window as the camera goes through it, at beat `q` of the move: the sky slides across it once. */
export function shineOnGlass(c: Ctx, g: Ctx, q: number, win: View['win']) {
  const u = prog(q, OUT + 0.05, OUT + 1.05), shine = Math.sin(Math.PI * u) ** 1.5;
  if (shine > 0.003) for (const [x, a] of [[c, 0.3], [g, 0.09]] as [Ctx, number][]) {
    const gx = lerp(win.x - win.w * 0.4, win.x + win.w * 1.2, u), gr = x.createLinearGradient(gx - win.w * 0.13, win.y + win.h, gx + win.w * 0.3, win.y);
    gr.addColorStop(0, rgba('paper', 0)); gr.addColorStop(0.5, rgba('paper', a * shine)); gr.addColorStop(1, rgba('paper', 0));
    x.fillStyle = gr; x.fillRect(Math.max(0, win.x), Math.max(0, win.y), Math.min(W, win.w), Math.min(H, win.h));
  }
}
