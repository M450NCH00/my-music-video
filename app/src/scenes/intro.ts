// INTRO — instrumental, from the start of the song to the cut before 教室钟慢半拍: a sleepy, sunny
// afternoon class, in one camera move.
//   1  her desk from above: the pen turning round her thumb once a beat, the notebook, the unfinished doodle
//   2  the camera pulls back and rises: her in profile at the window, and the classroom builds up behind her
//   3  it goes on out through the window, and the school is a grid of windows under a golden sky; the title
//   4  the bell on the wall rings out the last three beats; its last ring grows into the soft paper circle
//      that verse 1 starts from (INTRO_RING)
// Everything is timed in beats counted back from the cut (`q`), so it follows the song's own grid.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import { rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, smoothstep } from '../engine/util';
import { INTRO_RING, Stage, camera, clockTick, drawLyric, glow, layer, leaves, lightLeak, soundRing, type Cam, type Ctx, type V2 } from './_love';
import { PEN_AT, deskLight, drawDeskTop } from './intro-desk';
import { HER_HAND, HER_HEAD, drawClassroom } from './intro-classroom';
import { BELL, WIN, drawOutside } from './intro-outside';

/** A smooth curve through the knots that never overshoots and is flat at both ends: a move that passes through set values without stopping on the way. */
function curve(knots: [number, number][]) {
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

// ---- the timing, in beats: q = 0 on the downbeat four bars before the cut, 16 at the cut (the song starts near -2)
/** The desk: the frame comes out of paper; the camera pushes in, and at PULL starts back; the sun blooms as the desk gives way to the classroom. */
const FADE_IN: V2 = [-2, -0.2], PULL = 2.6, DESK_OUT: V2 = [2.95, 4];
/**
 * The scale of the classroom picture on screen, by beat: from CLOSE on her at her desk, back until the room
 * fills the frame (1, on OUT), and on out through the window until it is a tenth, one window of the building.
 */
const CLOSE = 2.6, OUT = 7.5;
const ROOM = curve(([[PULL, CLOSE], [3.6, 2.35], [4.6, 1.85], [5.5, 1.36], [6.1, 1.07], [7, 1.015], [OUT, 1], [8, 0.8], [9, 0.3], [9.7, 0.15], [10.3, 0.108], [11, 0.101], [12, 0.1]] as [number, number][]).map(([q, s]) => [q, Math.log(s)]));
/** From SMALL on the classroom is a small picture in her window: it is painted once, as it is then, and kept. */
const SMALL = 9;
/** The title: written from, gone by. The bell: its strikes (the last one's ring fills the frame), and when the camera moves in on it. */
const TITLE: V2 = [9.85, 12.3], STRIKES = [13, 14, 15], MOVE_IN: V2 = [12.2, 15.6];
const CENTRE: V2 = [W / 2, H / 2], WIN_MID: V2 = [WIN.x + WIN.w / 2, WIN.y + WIN.h / 2], WIN_K = W / WIN.w;

export default class Intro extends Scene {
  private stage = new Stage(this.ctx);
  /** The beat on which q = 0. */
  private q0 = 0;
  private title!: Line;
  private small: HTMLCanvasElement | null = null;

  override init() {
    const { audio } = this.ctx;
    this.q0 = Math.round(audio.beatAt(this.ctx.end)) - 16;
    // the title as a line of its own, so that the lyric renderer writes it by hand, character by character
    const text = '《下课再见》', chars = Array.from(text), at = (i: number) => audio.timeOfBeat(this.q0 + TITLE[0] + i * 0.14);
    const words = chars.map((w, i) => ({ w, start: at(i), end: at(i + 1.9), line: -1, index: i, at: i, gi: -1 }));
    this.title = { i: -1, text, start: at(0), end: at(chars.length + 0.6), words, chars: chars.map((ch, i) => ({ ch, at: i, word: words[i]! })) };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { audio } = this.ctx, { c, g } = this.stage.begin(), t = f.t, q = f.beat - this.q0;
    const at = (beat: number) => audio.timeOfBeat(this.q0 + beat);
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
    const moveIn = ease.inOutSine(prog(q, MOVE_IN[0], MOVE_IN[1])), z4 = 1 + 0.6 * moveIn;
    const bell0: V2 = [BELL[0] * S + O[0], BELL[1] * S + O[1]], bell: V2 = [lerp(bell0[0], INTRO_RING.x, moveIn), lerp(bell0[1], INTRO_RING.y, moveIn)];
    O = [(O[0] - bell0[0]) * z4 + bell[0], (O[1] - bell0[1]) * z4 + bell[1]]; S *= z4;
    const cam: Cam = { zoom: S, x: (CENTRE[0] - O[0]) / S - CENTRE[0], y: (CENTRE[1] - O[1]) / S - CENTRE[1] };
    /** Her window on screen. */
    const win = { x: WIN.x * S + O[0], y: WIN.y * S + O[1], w: WIN.w * S, h: WIN.h * S };

    // ---- the classroom: filling the frame, or (outside) the picture in her window
    const up = (a: number, d = 0.6) => ease.outCubic(prog(q, a, a + d));
    // (it will be half past four when the bell goes, and the second hand comes up to twelve half a beat after)
    const clock = (time: number, beat: number) => ({ t: time, beat, time: 16.5 - (this.ctx.end - time) / 3600, sec: clockTick(beat) - (this.q0 + 16) });
    const room = (light: number) => drawClassroom(c, g, {
      ...clock(t, f.beat), light,
      place: (x, depth) => { if (outside) { x.translate(win.x, win.y); x.scale(win.w / W, win.w / W); } else camera(x, roomCam, depth); },
      build: q > 6.1 ? undefined : { rows: [up(3.9), up(4.2), up(4.6), up(4.9)], him: up(4.4, 0.8), board: up(5.2), chalk: prog(q, 5.3, 5.95), clock: ease.outBack(prog(q, 5.7, 6)) },
    });
    const roomSmall = () => {
      if (!this.small) {
        const k = Math.exp(ROOM(SMALL)), cv = (this.small = document.createElement('canvas'));
        cv.width = Math.round(W * k * SCALE); cv.height = Math.round(H * k * SCALE);
        const x = scaleContext2D(cv.getContext('2d')!, k * SCALE);
        drawClassroom(x, x, { ...clock(at(SMALL), this.q0 + SMALL), light: 0, place: () => {} });
      }
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(this.small, win.x, win.y, win.w, win.h);
    };

    if (!outside) { if (q > PULL) room(1 - desk); }
    else {
      const glass = 1 - smoothstep(0.45, 1, s);
      drawOutside(c, g, {
        t, cam, blur: clamp((Z - 2.2) * 2, 0, 12), glass, frameBlur: clamp((Z - 1.6) * 2.2, 0, 14), near: 1 - smoothstep(1.3, 3, Z), sun: 1 - smoothstep(1.5, 3.2, Z),
        inside: () => {
          if (q >= SMALL) { roomSmall(); return; }
          for (const x of [c, g]) { x.save(); x.beginPath(); x.rect(win.x, win.y, win.w, win.h); x.clip(); }
          room(smoothstep(Math.exp(ROOM(SMALL)), 1, s));
          c.restore(); g.restore();
        },
        // the title, written by hand in the open sky
        written: () => {
          if (q < TITLE[0] - 1 || q > TITLE[1] + 0.2) return;
          c.save(); camera(c, cam, 0.05);
          drawLyric(c, this.title, t, { x: 1496, y: 352, size: 108, style: 'hand', ghost: 0, sungColor: 'ink', until: at(TITLE[1]) });
          c.restore();
        },
        ...this.bell(q), birdsAt: at(STRIKES[0]!),
      });
      // the glass we come out through: the sky slides across it once
      const u = prog(q, OUT + 0.05, OUT + 1.05), shine = Math.sin(Math.PI * u) ** 1.5;
      if (shine > 0.003) for (const [x, a] of [[c, 0.3], [g, 0.09]] as [Ctx, number][]) {
        const gx = lerp(win.x - win.w * 0.4, win.x + win.w * 1.2, u), gr = x.createLinearGradient(gx - win.w * 0.13, win.y + win.h, gx + win.w * 0.3, win.y);
        gr.addColorStop(0, rgba('paper', 0)); gr.addColorStop(0.5, rgba('paper', a * shine)); gr.addColorStop(1, rgba('paper', 0));
        x.fillStyle = gr; x.fillRect(Math.max(0, win.x), Math.max(0, win.y), Math.min(W, win.w), Math.min(H, win.h));
      }
      glow(g, win.x + win.w / 2, win.y + win.h / 2, win.w * 0.9, { alpha: 0.16 * glass });
      this.rings(c, g, t, q, cam, S, bell, at);
    }

    // ---- her desk from above, over the classroom until the camera has left it
    if (desk > 0.003) {
      const hs: V2 = [(HER_HAND[0] - look[0]) * s + CENTRE[0], (HER_HAND[1] - look[1]) * s + CENTRE[1]];
      const a = q < PULL ? push : 1.045 * (s / CLOSE) ** 2.2, pin: V2 = q < PULL ? [(PEN_AT[0] - about[0]) * push + about[0], (PEN_AT[1] - about[1]) * push + about[1]] : hs;
      layer(c, { alpha: desk }, (x) => { x.translate(pin[0], pin[1]); x.scale(a, a); x.translate(-PEN_AT[0], -PEN_AT[1]); drawDeskTop(x, { t, beat: f.beat }); });
      g.save(); g.translate(pin[0], pin[1]); g.scale(a, a); g.translate(-PEN_AT[0], -PEN_AT[1]); deskLight(g, t, desk); g.restore();
      // the sun from the window swells over the change of view
      lightLeak(g, 0.62 * Math.sin(Math.PI * prog(q, PULL + 0.1, DESK_OUT[1] + 0.2)) ** 1.5, { from: -0.35, t, color: 'gold', color2: 'peach' });
    }

    // ---- out of paper at the start
    const shown = ease.inOutSine(prog(q, FADE_IN[0], FADE_IN[1]));
    if (shown < 1) { c.fillStyle = rgba('paper', 1 - shown); c.fillRect(0, 0, W, H); }
    this.stage.end(out, { light: 2.2 * shown });
  }

  /** The bell: it draws back, then swings from side to side, at the end of its swing on each of the last beats. */
  private bell(q: number): { swing: number; clapper: number } {
    const A = 0.44, first = STRIKES[0]!, on = prog(q, first - 0.55, first, ease.inOutSine);
    return { swing: q < first ? A * on : A * Math.cos(Math.PI * (q - first)), clapper: -0.6 * A * on * Math.cos(Math.PI * (q - first) - 0.8) };
  }

  /** What the bell sends out: a few leaves off the trees, and its sound as rings. */
  private rings(c: Ctx, g: Ctx, t: number, q: number, cam: Cam, S: number, bell: V2, at: (beat: number) => number) {
    // a few leaves let go as the bell starts
    const first = at(STRIKES[0]!);
    if (t > first) { c.save(); camera(c, cam, 1.1); leaves(c, t - first, { x: 700, y: 380, w: 900, h: 640, count: 7, wind: 0.55, seed: 21, alpha: smoothstep(0, 0.5, t - first) }); c.restore(); }
    // the rings of the first strikes ripple out across the sky, two to a strike
    for (const strike of STRIKES.slice(0, -1)) for (const j of [0, 1]) {
      const age = t - at(strike) - 0.2 * j;
      if (age <= 0 || age > 2.6) continue;
      const r = (46 + 560 * age - 44 * age * age) * S, a = clamp(age / 0.08) * (1 - age / 2.6) ** 1.5 * (j ? 0.55 : 1);
      soundRing(c, bell[0], bell[1], r, { alpha: 0.62 * a }); soundRing(g, bell[0], bell[1], r, { alpha: 0.2 * a });
    }
    // the last one keeps growing: a soft paper circle that covers the frame by the cut (and the light under it goes out)
    const last = STRIKES[STRIKES.length - 1]!, u = clamp((q - last) / 0.95);
    if (q > last) {
      const x = lerp(bell[0], INTRO_RING.x, smoothstep(0, 0.7, u)), y = lerp(bell[1], INTRO_RING.y, smoothstep(0, 0.7, u));
      const r = lerp(46 * S, INTRO_RING.r, 0.42 * u + 0.58 * u ** 3), fill = smoothstep(0.04, 0.97, u) ** 1.2;
      soundRing(c, x, y, r, { fill });
      g.save(); g.globalCompositeOperation = 'destination-out'; soundRing(g, x, y, r, { fill }); g.restore();
      soundRing(g, x, y, r, { alpha: 0.2 * (1 - fill) });
    }
  }

  override dispose() { this.stage.dispose(); }
}
