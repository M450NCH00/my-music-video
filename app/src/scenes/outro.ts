// OUTRO — instrumental, from the end of 把喜欢一点一点说出口 to the end of the song: the intro's one camera move,
// made the other way, at sunset.
//   1  the sky the finale ends in (FINALE_SKY): its stars go up and are gone as the camera looks down again, onto
//      the school from outside, as the intro left it; but the sun is low now, and nobody is at the windows
//   2  the bell rings three times more, and its rings are gold
//   3  in through her window, the way the intro came out: the classroom after school, the chairs up on the desks,
//      all but two side by side; the clock over the board ticks on the beat now
//   4  on in to her desk, and the desk from above: the doodle in the margin is finished, the two of them under the
//      umbrella; her pen lies on the page, rolls a little and stops
//   5  the title is written on the page in her hand, and the credit line under it
//   6  out into paper, as the intro came out of it: the video can start again
// Everything is timed in beats from the cut (`q`). The camera is the intro's (intro-move.ts), at beat `move(q)` of its move.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, SCALE, W, H, makeRT, scaleContext2D } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, keys, lerp, prog, smoothstep } from '../engine/util';
import { Stage, camera, clockTick, drawLyric, glow, layer, leaves, lightLeak, soundRing, type Cam, type Ctx, type V2 } from './_love';
import { TILT, drawSky, drawStarsUp, risingOf, type Rising } from './finale-sets';
import { CLOCK_AT, CLOCK_R, drawClassroom } from './intro-classroom';
import { PAGE, PEN_AT, deskLight, drawDeskTop } from './intro-desk';
import { DESK_OUT, FADE_IN, OUT, PULL, SMALL, roomScale, shineOnGlass, viewAt } from './intro-move';
import { drawOutside } from './intro-outside';

const sine = ease.inOutSine;
// ---- the timing, in beats from the cut (the song ends at 18)
/** The camera looks down from the sky: from, to. The bell's strikes. */
const LOOK: V2 = [0.35, 2], STRIKES = [2, 3, 4];
/** The move back: in through the window (from, to); in the room until; on her desk from. And out into paper: from, to. */
const IN: V2 = [4.3, 7.3], ROOM = 8.6, DESK = 11.2, FADE: V2 = [16.1, 17.85];
/** On the desk: her pen rolls (from, to); the title is written from; the credit line under it from. */
const ROLL: V2 = [11, 12.5], TITLE = 11.4, CREDIT = 12.8;
/** The sun, low over the far side of the school grounds (in the picture, as the intro's exterior shot has it). */
const SUN: V2 = [1560, 640];
/** What is written on the page at the end; and where, in the notebook's own space: the left end of each, and its size. */
const NAME = '《下课再见》', MADE = '音乐由 Suno AI 生成 · 画面由代码绘制';
const NAME_AT = { x: PAGE.margin + 46, y: PAGE.rule0 + 11 * PAGE.rule - 12, size: 104 }, MADE_AT = { x: PAGE.margin + 58, y: PAGE.rule0 + 12 * PAGE.rule - 9, size: 38 };
/** Her pen on the page (px of the desk picture): where it lies at first, the way it points, and how far it rolls (px, across itself). */
const PEN = { x: 1146, y: 600, a: (120 * Math.PI) / 180, far: 58 };

/** The low sun on everything that is not bright already (as in the finale: finale.ts). With `warm` at 0 the picture is as it was painted. */
const GRADE = /* glsl */ `
  uniform sampler2D tex; uniform float warm;
  void main() {
    vec3 col = texture(tex, vUv).rgb, luma = vec3(0.2126, 0.7152, 0.0722);
    fragColor = vec4(mix(col, col * mix(vec3(1.0), C_GOLD / dot(C_GOLD, luma), 0.34 * (1.0 - smoothstep(0.35, 0.95, dot(col, luma)))), warm), 1.0);
  }`;

export default class Outro extends Scene {
  private stage = new Stage(this.ctx);
  /** The picture before its grade, and the grade. */
  private own = makeRT();
  private grade = new FSPass(GRADE, { tex: { value: null }, warm: { value: 0 } });
  /** The beat of the cut. */
  private b0 = 0;
  /** The finale's last line and its stars (finale-sets.ts): the outro starts on them. */
  private rising: Rising = { line: null as unknown as Line, look: [0, 1], more: [] };
  /** The title and the credit line, as lines of their own: the lyric renderer writes them by hand, character by character. */
  private name!: Line;
  private made!: Line;
  /** The classroom as a small picture in her window, painted once. */
  private small: HTMLCanvasElement | null = null;

  override init() {
    const { audio, lyrics } = this.ctx;
    this.b0 = Math.round(audio.beatAt(this.ctx.start));
    this.rising = risingOf(lyrics, audio);
    const written = (text: string, from: number, step: number, each: number): Line => {
      const chars = Array.from(text), at = (i: number) => audio.timeOfBeat(this.b0 + from + i * step);
      const words = chars.map((w, i) => ({ w, start: at(i), end: at(i + each), line: -1, index: i, at: i, gi: -1 }));
      return { i: -1, text, start: at(0), end: at(chars.length + each), words: words.filter((w) => w.w !== ' '), chars: chars.map((ch, i) => ({ ch, at: i, word: ch === ' ' ? null : words[i]! })) };
    };
    this.name = written(NAME, TITLE, 0.14, 1.9); this.made = written(MADE, CREDIT, 0.036, 3);
  }

  /** The beat of the intro's move the camera is at, at beat q: outside, as the intro leaves the school (12); in through the window (OUT); a while in the room; in on her desk (PULL); and the desk from above, back to where the intro starts. */
  private move(q: number) { return keys(q, [[IN[0], 12], [IN[1], OUT, sine], [ROOM, 7, sine], [DESK, PULL, sine], [18, FADE_IN[0], sine]]); }
  /** The bell: it draws back, swings from side to side, at the end of its swing on each strike, and comes to rest after the last. */
  private bell(q: number): { swing: number; clapper: number } {
    const A = 0.44 * Math.exp(-0.8 * Math.max(0, q - STRIKES[STRIKES.length - 1]!)), first = STRIKES[0]!, on = prog(q, first - 0.55, first, sine);
    return { swing: q < first ? A * on : A * Math.cos(Math.PI * (q - first)), clapper: -0.6 * A * on * Math.cos(Math.PI * (q - first) - 0.8) };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { audio } = this.ctx, { c, g } = this.stage.begin(), t = f.t, q = f.beat - this.b0, m = this.move(q);
    const at = (beat: number) => audio.timeOfBeat(this.b0 + beat);
    // ---- the camera: the intro's, at beat m of its move; and at first it looks up, at the sky the finale left it in
    const v = viewAt(m), { s, desk, outside, roomCam, S, focus } = v, look = TILT * (1 - sine(prog(q, LOOK[0], LOOK[1])));
    const cam: Cam = { ...v.cam, y: v.cam.y! - look / S }, win = { ...v.win, y: v.win.y + look }, bell: V2 = [v.bell[0], v.bell[1] + look];

    // ---- the classroom after school, at sunset: filling the frame, or (outside) the picture in her window.
    // (Its clock is on the beat: the second hand comes up to twelve as a bar starts.)
    const hour = { time: 18.2, sec: clockTick(f.beat, 0) - (this.b0 + 10) }, after = { empty: true, evening: 1, build: { rows: [1, 1, 1, 1], him: 0, board: 1, chalk: 0, clock: 1 } };
    const room = (light: number) => drawClassroom(c, g, { t, beat: f.beat, ...hour, ...after, light, place: (x, depth) => { if (outside) { x.translate(win.x, win.y); x.scale(win.w / W, win.w / W); } else camera(x, roomCam, depth); } });
    const roomSmall = () => {
      if (!this.small) {
        const k = roomScale(SMALL), cv = (this.small = document.createElement('canvas'));
        cv.width = Math.round(W * k * SCALE); cv.height = Math.round(H * k * SCALE);
        const x = scaleContext2D(cv.getContext('2d')!, k * SCALE);
        drawClassroom(x, x, { t: 0, beat: 0, ...hour, ...after, light: 0, place: () => {} });
      }
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(this.small, win.x, win.y, win.w, win.h);
    };

    if (!outside) {
      if (m > PULL) room(1 - desk);
      this.ticks(c, g, q, roomCam, 1 - desk);
    } else {
      drawOutside(c, g, {
        t, cam, ...focus, sun: 0, empty: true,
        // the finale's sky (the outro starts high in it), and the sun low in it
        sky: (x) => { x.save(); x.translate(0, look); drawSky(x, { t, clear: 1, sun: SUN, shine: 1 }); x.restore(); },
        inside: () => {
          if (m >= SMALL) { roomSmall(); return; }
          for (const x of [c, g]) { x.save(); x.beginPath(); x.rect(win.x, win.y, win.w, win.h); x.clip(); }
          room(smoothstep(roomScale(SMALL), 1, s));
          c.restore(); g.restore();
        },
        ...this.bell(q),
      });
      glow(g, SUN[0], SUN[1] + look, 340, { alpha: 0.4 * focus.sun });
      // the glass we go in through: the sky slides across it once
      shineOnGlass(c, g, m, win);
      glow(g, win.x + win.w / 2, win.y + win.h / 2, win.w * 0.9, { alpha: 0.16 * focus.glass });
      this.rings(c, g, t, q, cam, S, bell, at);
      // the finale's stars, and its last line: they go up with the sky, and are gone
      const stars = 1 - sine(prog(q, 0.5, 1.8));
      if (stars > 0.003) {
        for (const x of [c, g]) { x.save(); x.translate(0, look - TILT); }
        drawStarsUp(c, g, { t, rising: this.rising, alpha: stars });
        c.restore(); g.restore();
      }
    }

    // ---- her desk from above, over the classroom as the camera comes to it: the notebook, the doodle finished, her pen
    if (desk > 0.003) {
      // (once it is the desk alone the camera goes back a little, and down the page to what is being written there; then it all but rests)
      const e = 0.86 * sine(prog(q, DESK - 0.4, DESK + 2.4)) + 0.14 * prog(q, DESK - 0.4, FADE[1]), k = lerp(1, 0.955, e), a = v.a * k, pin: V2 = [(v.pin[0] - 1000) * k + 1000, (v.pin[1] - 600) * k + 600 - 96 * e];
      const u = prog(q, ROLL[0], ROLL[1]), rolled = (1 - (1 - u) ** 2.4 + 0.02 * Math.sin(u * Math.PI * 3) * (1 - u)) * PEN.far;
      const pen = { x: PEN.x + Math.sin(PEN.a) * rolled, y: PEN.y - Math.cos(PEN.a) * rolled, a: PEN.a, roll: -rolled / (Math.PI * 24) };
      layer(c, { alpha: desk }, (x) => {
        x.translate(pin[0], pin[1]); x.scale(a, a); x.translate(-PEN_AT[0], -PEN_AT[1]);
        drawDeskTop(x, { t, beat: f.beat, doodle: Infinity, hand: false, pen, written: (p) => this.written(p, t) });
      });
      g.save(); g.translate(pin[0], pin[1]); g.scale(a, a); g.translate(-PEN_AT[0], -PEN_AT[1]); deskLight(g, t, desk); g.restore();
      // the sun from the window swells over the change of view
      lightLeak(g, 0.62 * Math.sin(Math.PI * prog(m, PULL + 0.1, DESK_OUT[1] + 0.2)) ** 1.5, { from: -0.35, t, color: 'gold', color2: 'peach' });
    }

    // ---- out into paper at the end (the intro's first frame); the low sun is on all of it but the sky it starts in, and the paper it ends in
    const shown = 1 - sine(prog(q, FADE[0], FADE[1]));
    if (shown < 1) { c.fillStyle = rgba('paper', 1 - shown); c.fillRect(0, 0, W, H); }
    this.stage.end(this.own, { light: 2.2 * shown });
    this.grade.u.tex!.value = this.own.texture; this.grade.u.warm!.value = sine(prog(q, 0.3, 1.8)) * shown;
    this.grade.render(this.ctx.renderer, out);
  }

  /** What is written on the page at the end, in the notebook's own space: the title, in her hand, and the credit line under it. */
  private written(c: Ctx, t: number) {
    drawLyric(c, this.name, t, { x: NAME_AT.x, y: NAME_AT.y - 0.36 * NAME_AT.size, size: NAME_AT.size, style: 'hand', align: 'left', ghost: 0, sungColor: 'ink', restColor: rgba('ink', 0.9) });
    drawLyric(c, this.made, t, { x: MADE_AT.x, y: MADE_AT.y - 0.36 * MADE_AT.size, size: MADE_AT.size, style: 'hand', align: 'left', ghost: 0, weight: 400, sungColor: 'ink', restColor: rgba('ink', 0.8), alpha: 0.9 });
  }

  /** The clock over the board, now that it is on the beat: a small ring goes out from it with each tick, while the room is the picture. */
  private ticks(c: Ctx, g: Ctx, q: number, cam: Cam, alpha: number) {
    const z = 1 + (cam.zoom! - 1) * 0.8, x = (CLOCK_AT[0] - W / 2 - cam.x! * 0.8) * z + W / 2, y = (CLOCK_AT[1] - H / 2 - cam.y! * 0.8) * z + H / 2;
    for (const n of [Math.floor(q), Math.floor(q) - 1]) {
      const age = q - n, a = alpha * smoothstep(IN[1] - 0.4, IN[1] + 0.3, n) * (1 - smoothstep(ROOM + 0.4, ROOM + 1.6, n)) * clamp(age / 0.06) * (1 - age / 1.6) ** 1.6;
      if (age < 0 || age > 1.6 || a <= 0.003) continue;
      const r = (CLOCK_R + 4 + 62 * age - 14 * age * age) * z, gold = mix('gold', 'paper', 0.3);
      soundRing(c, x, y, r, { alpha: 0.55 * a, color: gold, width: clamp(r * 0.1, 3, 12) }); soundRing(g, x, y, r, { alpha: 0.16 * a, color: 'gold', width: clamp(r * 0.1, 3, 12) });
    }
  }

  /** What the bell sends out: a few leaves off the trees, and its sound as rings, gold in this light: two to a strike, rippling out across the sky. */
  private rings(c: Ctx, g: Ctx, t: number, q: number, cam: Cam, S: number, bell: V2, at: (beat: number) => number) {
    const first = at(STRIKES[0]!), gold = mix('gold', 'paper', 0.25);
    if (t > first && q < IN[1]) { c.save(); camera(c, cam, 1.1); leaves(c, t - first, { x: 700, y: 380, w: 900, h: 640, count: 7, wind: 0.55, seed: 21, alpha: smoothstep(0, 0.5, t - first) }); c.restore(); }
    for (const strike of STRIKES) for (const j of [0, 1]) {
      const age = t - at(strike) - 0.2 * j;
      if (age <= 0 || age > 2.6) continue;
      const r = (46 + 560 * age - 44 * age * age) * S, a = clamp(age / 0.08) * (1 - age / 2.6) ** 1.5 * (j ? 0.55 : 1);
      soundRing(c, bell[0], bell[1], r, { alpha: 0.66 * a, color: gold }); soundRing(g, bell[0], bell[1], r, { alpha: 0.24 * a, color: 'gold' });
    }
  }

  override dispose() { this.stage.dispose(); this.own.dispose(); this.grade.mat.dispose(); }
}
