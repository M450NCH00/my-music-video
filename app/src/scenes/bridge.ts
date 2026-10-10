// BRIDGE — 哪天如果我们 → 曾经为了谁慢半节下课铃: at her desk that night she wonders what will be left of all this.
// The colour drains out of the picture toward frost, and everything in it slows.
//   1  哪天如果我们            her desk under its lamp, where chorus 2 ends (CHORUS2_DESK): the lamp's light cools, the dust
//                             in the air (and the snow in her window) slows almost to a stop, and the camera goes on back and
//                             up, to her window; the line down the wall, in her handwriting
//   2  坐在不同的教室格子里     her window is a window of the school, she at it in the afternoon; back, and back: the wall of
//                             classroom windows has no end, and far along it he sits at another, in the evening. The line is
//                             written in a row of composition squares; on 格 the windows have come to rest, one in each, and
//                             from 里 the wall lies down flat: on the downbeat it is the paper, every window a square
//   3  会不会还记得            the two of them doodled in their two squares, the line in the squares beside him, each character
//                             written as slowly as it is sung; her pencil draws the dotted path from her square toward his, a
//                             square every half beat (before the last it waits half a beat), and is there as the line ends
//   4  曾经为了谁慢半节下课铃   the paper closes to a circle on his square, and the circle is the face of the classroom clock
//                             (as the bell's ring was in verse 1); the line in chalk on the wiped board under it, fainter. On
//                             慢 its second hand starts on its tick and cannot finish: it waits half a beat, and makes up for it
//   out                       on 铃 one drop of rain lands on the clock's glass: its ring goes out over the whole frame, and
//                             inside the ring it rains, in colour again (BRIDGE_RAIN: where the finale starts)
// Three pictures: her room; the grid, which is the wall and then the paper; the clock. Everything is timed from the lines
// themselves, found by content, and from the beat grid: `q` counts beats from the cut.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, W, H, makeRT } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, keys, lerp, prog, smoothstep } from '../engine/util';
import { LYRIC_LEAD, Stage, camera, drawClock, drawLyric, dustMotes, glow, scratch, soundRing, type Cam, type Ctx, type V2 } from './_love';
import {
  BRIDGE_RAIN, CLOCK_ON, CLOCK_ZOOM, PAPER, RULE, SHEET, cellAt, drawDoodled, drawDrop, drawFront, drawPencilAt, drawRainIn, drawSheet, drawTrail, drawWall, lookAt, rainHit, ringAt, squareAt,
  type GridCam,
} from './bridge-sets';
import { CHORUS2_DESK, DESK_WINDOW, drawBagShot, seen } from './chorus-sets';
import { BOARD_AT, CLOCK_AT, CLOCK_R } from './intro-classroom';

const sine = ease.inOutSine;
/** Half the length of the change from her room to the school's front, in beats. */
const OUT = 0.42;
/** How small her room is in the end (the camera's zoom), and where her window then is on screen: the window of the school's wall takes its place. */
const BACK = 0.28, WINDOW_AT: V2 = [800, 620];
/**
 * The wall: how wide a column of it is when her window is all there is to see (px); how much larger than the paper's
 * squares its windows are when they come to rest under the line; and how much closer the paper is looked at by the end.
 */
const NEAR = 552, LOOSE = 1.03, PUSH = 0.035;
/** A character is this large in its square; and this much of the wall is hidden under the squares of line 2. */
const SIZE = 0.72, VEIL = 0.5;
/** By the end of line 1 the air all but stands still: this much of its speed is left. */
const STILL = 0.1;
/** Where the dust is that the lamp on her desk lights (the room's own px: chorus-sets.ts). */
const LAMP_AIR = { x: 1380, y: 60, w: 1000, h: 520 };
/** The last line on the board: its middle and its size, in px of the classroom picture, from the board's corner. */
const CHALK = { x: 225, y: 34, size: 26 };

/**
 * The bridge's own grade, over the finished picture: the colour drained toward frost (`drain`, 0..1: a photograph that
 * has faded), but not inside the ring of the rain (`ring`: its middle and its radius, px), where the colour is back;
 * and the ring's rim bends what is seen through it by `bend` px, as water on glass does.
 */
const GRADE = /* glsl */ `
  uniform sampler2D tex; uniform float drain; uniform vec3 ring; uniform float bend;
  void main() {
    vec2 size = vec2(${W}.0, ${H}.0), off = vec2(vUv.x, 1.0 - vUv.y) * size - ring.xy;
    float d = length(off), e = (d - ring.z) / 30.0, wet = ring.z > 0.0 ? 1.0 : 0.0;
    vec3 col = texture(tex, vUv - wet * bend * exp(-e * e) * normalize(off + 1e-4) * vec2(1.0, -1.0) / size).rgb;
    vec3 luma = vec3(0.2126, 0.7152, 0.0722), pale = mix(mix(col, dot(col, luma) * C_FROST / dot(C_FROST, luma), 0.72), C_FROST * 0.8, 0.1);
    fragColor = vec4(mix(col, pale, drain * (1.0 - wet * (1.0 - smoothstep(ring.z - 30.0, ring.z + 10.0, d)))), 1.0);
  }`;

export default class Bridge extends Scene {
  private stage = new Stage(this.ctx);
  /** The picture before its grade, and the grade. */
  private own = makeRT();
  private grade = new FSPass(GRADE, { tex: { value: null }, drain: { value: 0 }, ring: { value: new THREE.Vector3() }, bend: { value: 0 } });
  /** The beat of the cut, and the four lines. */
  private b0 = 0;
  private L: Line[] = [];
  /** The change of picture, and what happens inside the pictures: all in beats from the cut. */
  private T = { cool: [0, 0], out: 0, pull: [0, 0], flat: [0, 0], pencil: [0, 0], done: 0, close: [0, 0], late: 0, end: 0 };
  /** When the drop lands (s), and how long after that the bridge ends. */
  private hit = 0;
  private cover = 1;
  /** Her window on screen: at the cut, and when the school's wall takes her room's place. */
  private win0: V2 = [0, 0];
  private win1: V2 = [0, 0];
  /** What the grade is told this frame: the ring of the rain (x, y, radius), and how much its rim bends the picture. */
  private ring: [number, number, number] = [0, 0, 0];
  private bend = 0;

  override init() {
    const { audio, lyrics } = this.ctx;
    this.b0 = Math.round(audio.beatAt(this.ctx.start));
    const q = (t: number) => audio.beatAt(t) - this.b0;
    const L = (this.L = ['哪天如果我们', '坐在不同的教室格子里', '会不会还记得', '曾经为了谁慢半节下课铃'].map((s) => lyrics.get(s)));
    const from = (i: number) => q(L[i]!.start), to = (i: number) => q(L[i]!.end), sung = (i: number, ch: number) => q(L[i]!.words[ch]!.start);
    // (the wall lies down on the first downbeat after line 2; the pencil has a half beat for each square of the path: one to each step, and one to wait)
    const down = Math.round(q(audio.downbeats.find((d) => d > L[1]!.end) ?? L[1]!.end)), draws = SHEET.trail.length / 2;
    this.T = {
      // 1: the lamp cools through the line; her room gives way to the school between the lines
      cool: [0.15, to(0)], out: (to(0) + from(1)) / 2,
      // 2: back from her window until, on 格, a window sits in every square of the line; from 里 the wall lies down, and is paper on the downbeat
      pull: [from(1) - 0.45, sung(1, 7)], flat: [sung(1, 9), down],
      // 3: the pencil comes, and is at his square as the line ends
      pencil: [to(2) - draws - 0.6, to(2) - draws], done: to(2),
      // 4: the paper closes on his square as line 3 ends, in the time the bell's ring took in verse 1; the tick that 慢 is sung on is the late one
      close: [to(2) - 0.08, to(2) + 0.87], late: Math.round(sung(3, 5) - 0.5) + 0.5, end: q(this.ctx.end),
    };
    this.hit = rainHit(lyrics); this.cover = this.ctx.end - this.hit;
    const w = DESK_WINDOW, mid: V2 = [w.x + w.w / 2, w.y + w.h / 2];
    this.win0 = seen(CHORUS2_DESK.cam, mid, w.depth);
    this.win1 = seen(this.deskCam(this.T.out), mid, w.depth);
  }

  /** The time of a beat counted from the cut. */
  private at(beat: number) { return this.ctx.audio.timeOfBeat(this.b0 + beat); }
  /** The time the air keeps (dust, snow): it runs with the song at the cut, slows through line 1, and all but stands still from then on. */
  private air(t: number) {
    const t0 = this.ctx.start, D = this.at(this.T.cool[1]) - t0, u = clamp((t - t0) / D);
    return t0 + D * (u - (1 - STILL) * (u ** 3 - u ** 4 / 2)) + STILL * Math.max(0, t - t0 - D);
  }
  /** How far the colour has drained at beat q: a little by the end of line 1, most of it once the wall is paper; the classroom she remembers keeps a little more. */
  private drain(q: number) { const T = this.T; return keys(q, [[0, 0], [T.cool[1], 0.5, sine], [T.pull[1], 0.76, sine], [T.flat[1], 0.86, sine], [T.close[0], 0.86], [T.close[1], 0.68, sine]]); }
  /**
   * The camera in her room at beat q: from where chorus 2 left it (at rest), on back and up, so that her window comes
   * down the frame to WINDOW_AT.
   */
  private deskCam(q: number): Cam {
    const a = CHORUS2_DESK.cam, w = DESK_WINDOW, e = sine(prog(q, 0, this.T.out + OUT + 0.3)), zoom = Math.exp(lerp(Math.log(a.zoom), Math.log(BACK), e)), z = 1 + (zoom - 1) * w.depth;
    const x = lerp(this.win0[0], WINDOW_AT[0], e), y = lerp(this.win0[1], WINDOW_AT[1], e);
    return { zoom, x: (w.x + w.w / 2 - W / 2 - (x - W / 2) / z) / w.depth, y: (w.y + w.h / 2 - H / 2 - (y - H / 2) / z) / w.depth };
  }
  /**
   * The look at the grid at beat q. Back from her window, which goes straight from where her room's window was to its
   * place on the sheet, until the windows are as wide as the squares of the line; then on back a little, slowly, while
   * the wall lies down, to where the paper rests; and from there slowly in again on his square, which stays where it is.
   */
  private gridCam(q: number): GridCam {
    const T = this.T, S = SHEET, flat = sine(prog(q, T.flat[0], T.flat[1])), rest = S.cell * LOOSE;
    const px = Math.exp(lerp(Math.log(NEAR), Math.log(rest), sine(prog(q, T.pull[0], T.pull[1])))) * lerp(1, 1 / LOOSE, sine(prog(q, T.pull[1], T.flat[1]))) * (1 + PUSH * sine(prog(q, T.flat[1], T.close[1])));
    if (q > T.flat[1]) return lookAt(px, flat, S.him, CLOCK_ON);
    if (q > T.pull[1]) return { px, flat, u: S.u, v: S.v };
    const [x, y] = cellAt({ px: rest, flat: 0, u: S.u, v: S.v }, S.her[0], S.her[1]), k = (px - NEAR) / (rest - NEAR);
    return lookAt(px, flat, S.her, [lerp(this.win1[0], x, k), lerp(this.win1[1], y, k)]);
  }
  /** How far the pencil has come at beat q, in squares: one every half beat, begun gently and ended gently; before the last one it waits a half beat. */
  private steps(q: number) {
    const n = SHEET.trail.length - 1, from = this.T.pencil[1];
    let s = 0;
    for (let k = 0; k < n; k++) { const at = from + (k < n - 1 ? k : n) / 2; s += sine(prog(q, at, at + 0.5)); }
    return s;
  }
  /**
   * The clock's second hand at beat q, in seconds: a tick a beat, half a beat late, as ever (the kit's clockTick). But
   * the tick before the late one is slow already; the late one starts, gets not quite half way, loses heart and sinks
   * back a little, and waits: it lands exactly half a beat after its time. The next comes on its own time, and is on
   * the twelve.
   */
  private hand(q: number) {
    const b = q - 0.5, n = Math.floor(b), u = b - n, late = this.T.late - 0.5;
    const stuck = keys(u, [[0, 0], [0.24, 0.44, ease.outSine], [0.5, 0.26, sine]]);
    const k = n === late ? (u < 0.5 ? stuck : lerp(stuck, 1, ease.outBack(clamp((u - 0.5) / 0.16), 2.4))) : ease.outBack(clamp(u / (n === late - 1 ? 0.3 : 0.16)), n === late - 1 ? 1.1 : 2.4);
    return 58 + n - late + k;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { c, g } = this.stage.begin(), q = f.beat - this.b0, t = f.t, T = this.T;
    this.ring = [0, 0, 0]; this.bend = 0;
    if (q >= T.close[0]) this.clock(c, g, t, q);
    else {
      // her room gives way to the school's front: the wall comes up over it, on a canvas of its own
      const k = sine(clamp((q - T.out + OUT) / (2 * OUT)));
      if (k < 1) { g.save(); g.globalAlpha = 1 - k; this.desk(c, g, t, q); g.restore(); }
      if (k >= 1) this.grid(c, g, t, q);
      else if (k > 0) {
        const next = scratch('picture');
        g.save(); g.globalAlpha = k; this.grid(next.c, g, t, q); g.restore();
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = k; c.drawImage(next.cv, 0, 0, W, H); c.restore();
      }
    }
    // the picture, and over it the grade
    this.stage.end(this.own);
    const u = this.grade.u;
    u.tex!.value = this.own.texture; u.drain!.value = this.drain(q); u.bend!.value = this.bend; (u.ring!.value as THREE.Vector3).set(...this.ring);
    this.grade.render(this.ctx.renderer, out);
  }

  // ------------------------------------------------------------------ 1: her desk under the lamp
  private desk(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, cam = this.deskCam(q), air = this.air(t), warm = 1 - sine(prog(q, T.cool[0], T.cool[1]));
    drawBagShot(c, g, { t: air, cam, zip: CHORUS2_DESK.zip, room: { sharp: 1, warm } });
    // the dust in the lamp's light: it is seen as the eye gets used to the room, astir at first, and then it hangs there
    g.save(); camera(g, cam, DESK_WINDOW.depth);
    dustMotes(g, air * 3, { ...LAMP_AIR, count: 46, seed: 52, size: 2, alpha: 0.75 * smoothstep(0, 0.7, q), color: mix('frost', 'gold', warm) });
    g.restore();
    // the line, down the wall beside her desk, in her handwriting. (It starts on the cut: the characters that wait come up, they do not start there.)
    drawLyric(c, this.L[0]!, t, { x: 0, y: 0, size: 88, style: 'hand', dark: true, path: (_u, k) => ({ x: 1748 + 5 * Math.sin(t * 0.5 + k * 0.6), y: 172 + 106 * k }), each: (ch) => { if (ch.sung <= 0) ch.alpha = smoothstep(0, 0.45, q); } });
  }

  // ------------------------------------------------------------------ 2, 3: the wall of windows; the sheet of squares
  /** `ink`: how much of what is written and drawn on the paper is there (it goes as the paper closes on his square). */
  private grid(c: Ctx, g: Ctx, t: number, q: number, ink = 1) {
    const T = this.T, L = this.L, S = SHEET, cam = this.gridCam(q), sheet = smoothstep(0.08, 0.75, cam.flat), air = this.air(t);
    // the squares of line 2 are squares of the paper from the start: a strip of it, still, while the wall goes back under
    // it; then the windows have come to rest in them, and it goes with the wall
    const strip = q < T.pull[1] ? this.gridCam(T.pull[1]) : cam, n = L[1]!.chars.length, inStrip = (i: number, j: number) => j === S.line2[1] && i >= S.line2[0] && i < S.line2[0] + n;
    if (sheet < 1) drawWall(c, g, { t: air, cam, her: S.her, him: S.him, light: 1 - sheet });
    drawSheet(c, cam, sheet, { ink, whole: inStrip });
    const lead = smoothstep(L[1]!.start - LYRIC_LEAD, L[1]!.start - LYRIC_LEAD + 0.25, t) * (1 - sheet);
    if (lead > 0.003) {
      const squares = new Path2D();
      for (let k = 0; k < n; k++) { const r = squareAt(strip, S.line2[0] + k, S.line2[1], true); squares.rect(r.x, r.y, r.w, r.h); }
      c.save(); c.globalAlpha *= lead; c.fillStyle = rgba(PAPER, VEIL); c.fill(squares); c.strokeStyle = RULE; c.lineWidth = 1.6; c.stroke(squares); c.restore();
    }
    drawLyric(c, L[1]!, t, { x: 0, y: 0, size: SIZE * strip.px, style: 'grid', squares: false, alpha: ink, until: this.at(T.flat[1] + 1.4), path: (_u, k) => { const [x, y] = cellAt(strip, S.line2[0] + k, S.line2[1]); return { x, y }; } });
    if (sheet <= 0.003) return;
    // the two of them, doodled where they sat; the dotted path from her square toward his, and the pencil that draws it
    const size = squareAt(cam, S.her[0], S.her[1]).h, there = sheet * ink;
    drawDoodled(c, 'her', cellAt(cam, S.her[0], S.her[1]), size, there); drawDoodled(c, 'him', cellAt(cam, S.him[0], S.him[1]), size, there);
    // line 3 in the squares beside him: each character is as long in the writing as it is in the singing
    drawLyric(c, L[2]!, t, {
      x: 0, y: 0, size: SIZE * squareAt(cam, S.line3[0], S.line3[1]).h, style: 'grid', squares: false, slow: true, alpha: ink,
      path: (_u, k) => { const [x, y] = cellAt(cam, S.line3[0] + k, S.line3[1]); return { x, y }; }, each: (ch) => { if (ch.sung <= 0) ch.alpha = sheet; },
    });
    if (q > T.pencil[0]) {
      const tip = drawTrail(c, cam, S.trail, this.steps(q), there), away = Math.max(1 - sine(prog(q, T.pencil[0], T.pencil[1])), sine(prog(q, T.done + 0.1, T.done + 0.9)));
      if (away < 1) drawPencilAt(c, tip, t, away);
    }
    dustMotes(g, air, { count: 14, seed: 77, alpha: 0.4 * sheet });
  }

  // ------------------------------------------------------------------ 4: the clock; the drop of rain
  private clock(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, at = CLOCK_ON, zoom = lerp(CLOCK_ZOOM[0], CLOCK_ZOOM[1], prog(q, T.close[0], T.end)), R = CLOCK_R * zoom, [bx, by] = BOARD_AT;
    const v = 1 - (q - T.close[0]) / (T.close[1] - T.close[0]);
    // the front wall of the classroom, its board wiped; the clock; the line in chalk under it, fainter than it was
    drawFront(c, at, zoom);
    drawClock(c, at[0], at[1], R, { time: 16.5, sec: this.hand(q), alpha: smoothstep(0, 0.45, 1 - v) });
    c.save(); c.translate(at[0], at[1]); c.scale(zoom, zoom); c.translate(-CLOCK_AT[0], -CLOCK_AT[1]);
    drawLyric(c, this.L[3]!, t, { x: bx + CHALK.x, y: by + CHALK.y, size: CHALK.size, style: 'chalk', alpha: 0.76 });
    c.restore();
    // the light of that afternoon, as she remembers it; the dust in it hardly moves
    glow(g, W + 240, 260, 1000, { alpha: 0.3 });
    dustMotes(g, this.air(t), { count: 30, seed: 3, alpha: 0.32 });
    // the paper closes on his square, a circle, and comes in onto the rim of the clock: what was written on it goes
    if (v > -0.4) {
      const far = Math.hypot(Math.max(at[0], W - at[0]), Math.max(at[1], H - at[1])) + 90, k = Math.max(0, v), r = lerp(R, far, 0.42 * k + 0.58 * k ** 3), fill = smoothstep(0, 0.16, v), soft = clamp(r * 0.07, 6, 80);
      const disc = (x: Ctx) => { const m = x.createRadialGradient(at[0], at[1], Math.max(0, r - soft), at[0], at[1], r + soft * 0.5); m.addColorStop(0, rgba('paper', 1)); m.addColorStop(1, rgba('paper', 0)); x.fillStyle = m; x.fillRect(0, 0, W, H); };
      if (fill > 0.003) {
        const page = scratch('picture'), p = page.c;
        this.grid(p, scratch('unlit', 4).c, t, q, smoothstep(0.1, 0.6, v));
        p.setTransform(1, 0, 0, 1, 0, 0); p.globalAlpha = 1; p.globalCompositeOperation = 'destination-in'; disc(p); p.globalCompositeOperation = 'source-over';
        c.save(); c.globalAlpha = fill; c.drawImage(page.cv, 0, 0, W, H); c.restore();
        g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = fill; disc(g); g.restore();
      }
      soundRing(c, at[0], at[1], r, { alpha: 0.9 * smoothstep(-0.35, 0.02, v) });
    }
    // one drop comes down on the glass; its ring goes out, and inside it it rains (the grade lets the colour back there)
    const since = t - this.hit;
    if (since > 0) {
      drawRainIn(c, g, { t, since, cover: this.cover });
      this.ring = [BRIDGE_RAIN.at[0], BRIDGE_RAIN.at[1], ringAt(since, this.cover)];
      this.bend = 6 * smoothstep(0.1, 0.3, since / this.cover) * (1 - smoothstep(0.5, 0.9, since / this.cover));
    }
    drawDrop(c, g, since);
  }

  override dispose() { this.stage.dispose(); this.own.dispose(); this.grade.mat.dispose(); }
}
