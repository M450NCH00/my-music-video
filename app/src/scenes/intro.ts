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
import { drawClassroom } from './intro-classroom';
import { drawOutside } from './intro-outside';
import { DESK_OUT, FADE_IN, PULL, SMALL, roomScale, shineOnGlass, viewAt } from './intro-move';

// ---- the timing, in beats: q = 0 on the downbeat four bars before the cut, 16 at the cut (the song starts near -2).
// (The camera's move, from her desk out to the school, and its beats are in intro-move.ts: the outro makes it again, the other way.)
/** The title: written from, gone by. The bell: its strikes (the last one's ring fills the frame), and when the camera moves in on it. */
const TITLE: V2 = [9.85, 12.3], STRIKES = [13, 14, 15], MOVE_IN: V2 = [12.2, 15.6];

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
    // ---- the camera: on her desk, back through the classroom and out of her window, then in on the bell (intro-move.ts)
    const { s, desk, outside, roomCam, cam, S, win, bell, focus, pin, a } = viewAt(q, ease.inOutSine(prog(q, MOVE_IN[0], MOVE_IN[1])));

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
        const k = roomScale(SMALL), cv = (this.small = document.createElement('canvas'));
        cv.width = Math.round(W * k * SCALE); cv.height = Math.round(H * k * SCALE);
        const x = scaleContext2D(cv.getContext('2d')!, k * SCALE);
        drawClassroom(x, x, { ...clock(at(SMALL), this.q0 + SMALL), light: 0, place: () => {} });
      }
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(this.small, win.x, win.y, win.w, win.h);
    };

    if (!outside) { if (q > PULL) room(1 - desk); }
    else {
      drawOutside(c, g, {
        t, cam, ...focus,
        inside: () => {
          if (q >= SMALL) { roomSmall(); return; }
          for (const x of [c, g]) { x.save(); x.beginPath(); x.rect(win.x, win.y, win.w, win.h); x.clip(); }
          room(smoothstep(roomScale(SMALL), 1, s));
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
      shineOnGlass(c, g, q, win);
      glow(g, win.x + win.w / 2, win.y + win.h / 2, win.w * 0.9, { alpha: 0.16 * focus.glass });
      this.rings(c, g, t, q, cam, S, bell, at);
    }

    // ---- her desk from above, over the classroom until the camera has left it
    if (desk > 0.003) {
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
