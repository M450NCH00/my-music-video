// CHORUS — one module for two timeline entries, told apart by ctx.params.n:
//   n = 1  chorus 1 and the interlude after it: built here (Prompt 3 of docs/PROMPTS.md)
//   n = 2  chorus 2: still the placeholder, until Prompt 5 builds it on the same pictures, in winter
//
// Chorus 1, 等你下课一起走好不好 → 把喜欢藏在书包拉链口, then the instrumental up to verse 2. Four pictures:
//   the way home, one shot from the side that follows the two of them (drawWay):
//     1  等你下课一起走好不好        the light verse 1 ended in clears off the corridor (VERSE1_WASH); she runs in from the
//                                   left, catches him up and falls into step
//     2  从黑板到校门只要一条小跑    a little run: the corridor's windows, the steps, the yard, the gate go by, dust at
//                                   their heels; the line's characters skip along over their heads
//     3  你说要回家我就陪你到车站口  out in the street, at a walk again: the low shops across the road, the sun going down
//     4  多走几步都算偷到            her steps get small; each of them leaves a gold star on the pavement
//     5  等你下课再见一面就好        the bus stop: he gets on, waves from his window, and she waves the bus out of sight
//   her room that night (drawRoom):
//     6  把今天没说完的写在晚安后    her 晚安 is sent; the line is what she types after it, a character as each is sung
//     7  慢慢走 慢慢讲               photographs of the walk come up round her, half the line written under one and half
//                                   under another; she takes the message out again, slowly, and types 明天见噢 instead
//   her school bag, close up (drawBagShot):
//     8  把喜欢藏在书包拉链口        a folded paper star goes into the front pocket, the line after it, and the zip is
//                                   shut on the downbeat
//   her window (drawRoom again), through the interlude: the moon goes over, morning comes, the leaves of the tree
//     turn and come down on the beat, the calendar loses two pages, the first snow falls, and frost closes over the
//     glass as the camera goes in on it: the last frame is CHORUS1_FROST, where verse 2 starts.
// Everything is timed from the lines themselves, found by content, and from the beat grid: `q` counts beats from the cut.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { SCALE, W, H, scaleContext2D } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { CJK_MID, F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, keys, lerp, prog, smoothstep } from '../engine/util';
import {
  CHORUS1_FROST, Stage, VERSE1_WASH, camera, drawBoy, drawGirl, drawLyric, drawPhone, drawStar, glow, lightLeak, phoneGlow, scratch, sparkle,
  type Cam, type Ctx, type LyricOpts, type PoseArg, type V2,
} from './_love';
import { BAG, BUS, CHAT, FLOOR, ROOM, S, SEASONS, WAY, drawBagShot, drawChat, drawPhoto, drawRoom, drawWay, groundAt, inView, openings, seen } from './chorus-sets';
import { placeholder } from './_placeholder';

/** Chorus 2 is Prompt 5's: until then its entry of the timeline shows the placeholder. */
const Chorus2 = placeholder('Chorus 2', 'chorus');
/**
 * On the way, px a beat. A walk is two steps a beat (a stride of the kit's walk, two steps, is 232 units; of its
 * run, 400), the little run three; her small steps are three a beat as well, each SMALL of a step long.
 */
const WALK = 232 * S, STRIDE_RUN = 400 * S, RUN = 1.5 * STRIDE_RUN, SMALL = 0.36, TINY = 1.5 * SMALL * WALK;
/** Where the two are on the way is tabled once: from beat Q0 on, every DQ beats. */
const Q0 = -1, DQ = 0.01, QN = 2300;
/** The two rows the lines of the walk take in turn, over their heads (y). */
const ROW_A = 136, ROW_B = 232;
/** The three photographs round her: where each floats (its middle), its width, its lean, and the part of the frame it is a print of (see drawPhoto). */
const PHOTOS: { x: number; y: number; w: number; rot: number; crop: [number, number, number] }[] = [
  { x: 372, y: 300, w: 330, rot: -0.07, crop: [960, 640, 900] }, { x: 812, y: 236, w: 286, rot: 0.05, crop: [1010, 650, 900] }, { x: 1226, y: 322, w: 322, rot: 0.085, crop: [930, 560, 960] },
];
/** What she types in the end, in place of all she did not say. (Not a line of the song: it is plain ink, and 噢 is in the fonts for it: analysis/make_fonts.py.) */
const NOTE = '明天见噢';
/** The sky in her window, top to bottom: at night, at dawn, by day, and when the snow comes. */
const NIGHT_SKY = [mix('navy', 'ink', 0.1), mix('navy', 'dusk', 0.35), mix('dusk', 'navy', 0.3)], DAWN_SKY = [mix('dusk', 'sky', 0.3), mix('blush', 'peach', 0.5), mix('gold', 'peach', 0.4)];
const DAY_SKY = [mix('sky', 'paper', 0.15), mix('sky', 'paper', 0.5), mix('paper', 'gold', 0.3)], SNOW_SKY = [mix('frost', 'sky', 0.3), mix('frost', 'paper', 0.5), mix('paper', 'frost', 0.25)];
const blend = (a: string[], b: string[], k: number) => a.map((col, i) => mix(col, b[i]!, k));
const sine = ease.inOutSine;
/**
 * Keep the light off something: what `paint` draws (a figure again, as a flat shape in SHADE; a line of the lyrics)
 * is cut out of the light already on `g`. The low sun must not shine through the two of them, or wash a line out.
 */
const shade = (g: Ctx, paint: (g: Ctx) => void) => { g.save(); g.globalCompositeOperation = 'destination-out'; paint(g); g.restore(); };
const SHADE = rgba('ink');

type Picture = (c: Ctx, g: Ctx, t: number, q: number) => void;

export default class Chorus extends Scene {
  private later = this.ctx.params.n === 2 ? new Chorus2(this.ctx) : null;
  private stage = this.later ? null : new Stage(this.ctx);
  /** The season: its colours, clothes and air (chorus-sets.ts keeps what depends on it in one place). */
  private season = SEASONS[1]!;
  /** The beat of the cut, and the eight lines. */
  private b0 = 0;
  private L: Line[] = [];
  /** The changes of picture (the middle of each dissolve, and half its length), and what happens inside the pictures: all in beats from the cut. */
  private cuts: { at: number; half: number }[] = [];
  private T = {
    clear: 0, step: [0, 0], run: [0, 0], tiny: [0, 0], stop: 0, bus: [0, 0], look: [0, 0], board: [0, 0], window: 0, leave: 0,
    sent: 0, erase: [0, 0], again: [0, 0], photos: [0, 0, 0], shots: [0, 0, 0], star: [0, 0], pull: [0, 0], flow: 0, zipped: 0, falls: [0, 0, 0], flips: [0, 0], end: 0,
  };
  /** Where she and he are on the way (x), and where each is in their stride (cycles of two steps), by beat: see Q0. */
  private xh = new Float64Array(QN); private xb = new Float64Array(QN); private ph = new Float64Array(QN); private pb = new Float64Array(QN);
  /** The star marks of her small steps: where each foot comes down (x), and when (beat). */
  private stars: { x: number; q: number }[] = [];
  /** The dust of their run: where each foot comes down (x, y of the way), and when (s). */
  private dust: { x: number; y: number; t: number }[] = [];
  /** The frames the photographs are prints of. */
  private kept: HTMLCanvasElement[] | null = null;
  /** How bright the light layer is added this frame: 2.2 as everywhere, but for the first frames (VERSE1_WASH) and the last (CHORUS1_FROST). */
  private light = 2.2;
  private pictures: Picture[] = [(c, g, t, q) => this.walk(c, g, t, q), (c, g, t, q) => this.room(c, g, t, q), (c, g, t, q) => this.bag(c, g, t, q), (c, g, t, q) => this.window(c, g, t, q)];

  override init() {
    if (this.later) return this.later.init();
    const { audio, lyrics } = this.ctx, nth = (this.ctx.params.n ?? 1) - 1;
    this.b0 = Math.round(audio.beatAt(this.ctx.start));
    const q = (t: number) => audio.beatAt(t) - this.b0;
    const L = (this.L = ['等你下课一起走好不好', '从黑板到校门只要一条小跑', '你说要回家我就陪你到车站口', '多走几步都算偷到', '等你下课再见一面就好', '把今天没说完的写在晚安后', '慢慢走', '把喜欢藏在书包拉链口'].map((s) => lyrics.get(s, nth)));
    const from = (i: number) => q(L[i]!.start), to = (i: number) => q(L[i]!.end), sung = (i: number, ch: number) => q(L[i]!.words[ch]!.start);
    // the pictures change as line 6 starts, as line 8 starts, and half a beat after the zip is shut: on the first downbeat after line 8
    const zipped = q(audio.downbeats.find((d) => d > L[7]!.end - 0.02) ?? L[7]!.end), room = from(5) - 0.2, bag = from(7) - 0.25, win = zipped + 0.55;
    this.cuts = [{ at: room, half: 0.45 }, { at: bag, half: 0.3 }, { at: win, half: 0.45 }];
    const stop = to(3), halt = stop + 1, falls = Math.ceil(win + 2.3), flips = Math.ceil(win + 1.2);
    const T = (this.T = {
      // 1: verse 1's light is off the picture soon after 课; she has caught him up, and is in step with him on 走
      clear: sung(0, 3) + 0.5, step: [sung(0, 4) + 0.35, sung(0, 6)],
      // 2: off at a run as the line starts, at a walk again as it ends, at the gate
      run: [from(1), to(1) + 0.1],
      // 4: her steps get small as the line starts; they stop as it ends
      tiny: [from(3) - 0.1, from(3) + 0.35], stop,
      // 5: the bus comes in behind them and has stopped a beat on; he looks back at her, gets on, is at his window on 见; the bus leaves on 一面
      bus: [stop - 0.35, halt], look: [from(4) - 0.1, from(4) + 0.3], board: [halt + 0.1, sung(4, 4) + 0.25], window: sung(4, 5), leave: sung(4, 6) + 0.15,
      // 6, 7: her 晚安 goes as the room comes up; over 慢慢走 she takes the message out again, and into 慢慢讲 she types NOTE instead; the photographs come up one after the other
      sent: room - 0.15, erase: [from(6) + 0.05, sung(6, 2) + 0.4], again: [sung(6, 3) - 0.45, sung(6, 4) + 0.3], photos: [from(6) - 0.65, from(6) + 0.3, sung(6, 3) - 0.75],
      // (what they are photographs of: the corridor, the gate as they run out of it, his wave from the bus)
      shots: [sung(0, 9) + 0.2, to(1) - 0.2, sung(4, 6) + 0.35],
      // 8: the star goes in on 藏; her hand is back for the pull on 拉链; the line goes in after the star, and the zip is shut on the downbeat
      star: [sung(7, 3) - 0.12, sung(7, 3) + 0.5], pull: [sung(7, 7) - 0.25, sung(7, 8) + 0.1], flow: to(7) - 0.85, zipped,
      // the interlude: the leaves let go on three beats, the calendar turns a page on two
      falls: [falls, falls + 1, falls + 2], flips: [flips, flips + 2],
      end: q(this.ctx.end),
    });
    // where they are, beat by beat: how fast each goes, and so how far along the way and how far through a stride
    const run = (v: number) => clamp((v - WALK) / (RUN - WALK));
    let dh = 0, db = 0, wh = 0, wb = 0;
    for (let i = 0; i < QN; i++) {
      const x = Q0 + i * DQ, vh = this.speed(x, false), vb = this.speed(x, true);
      this.xh[i] = dh; this.xb[i] = db; this.ph[i] = wh; this.pb[i] = wb;
      dh += vh * DQ; db += vb * DQ;
      wh += (vh / (lerp(WALK, STRIDE_RUN, run(vh)) * lerp(1, SMALL, sine(prog(x, T.tiny[0]!, T.tiny[1]!))))) * DQ;
      wb += (vb / lerp(WALK, STRIDE_RUN, run(vb))) * DQ;
    }
    // (they end at the bus stop; his feet pass each other on the beat, as the kit's walk has it, and hers are the other way about)
    const at = (a: Float64Array, x: number) => a[Math.round((x - Q0) / DQ)]!, shift = (a: Float64Array, d: number) => { for (let i = 0; i < QN; i++) a[i]! += d; };
    shift(this.xh, WAY.her - at(this.xh, stop + 0.5)); shift(this.xb, WAY.him - at(this.xb, stop + 0.5));
    shift(this.pb, -at(this.pb, 0)); shift(this.ph, 0.5 - ((at(this.ph, T.step[1]! + 0.6) - at(this.pb, T.step[1]! + 0.6)) % 1));
    // their run: a little dust where each foot comes down (in the kit's run a foot lands 0.14 and 0.64 of the way through a stride, well ahead of the body)
    for (const [xs, ps, him] of [[this.xh, this.ph, false], [this.xb, this.pb, true]] as [Float64Array, Float64Array, boolean][]) for (let i = 1; i < QN; i++) {
      const x = Q0 + i * DQ, fx = xs[i]! + 70 * S;
      if (x > 0 && run(this.speed(x, him)) > 0.35 && Math.floor(ps[i]! * 2 - 0.28) !== Math.floor(ps[i - 1]! * 2 - 0.28)) this.dust.push({ x: fx, y: groundAt(fx) + (him ? 0 : 12), t: this.at(x) });
    }
    // her small steps: a star where each foot comes down
    for (let i = 1; i < QN; i++) {
      const x = Q0 + i * DQ;
      if (x > T.tiny[1]! && x < stop - 0.1 && Math.floor(this.ph[i]! * 2 - 0.5) !== Math.floor(this.ph[i - 1]! * 2 - 0.5)) this.stars.push({ x: this.xh[i]! + 58 * SMALL * S, q: x });
    }
  }

  /** The time of a beat counted from the cut. */
  private at(beat: number) { return this.ctx.audio.timeOfBeat(this.b0 + beat); }
  /** A value of one of the tables of the way at beat q. */
  private tab(a: Float64Array, q: number) { const f = clamp((q - Q0) / DQ, 0, QN - 1.001), i = Math.floor(f); return lerp(a[i]!, a[i + 1]!, f - i); }
  /**
   * How fast she, or he, goes along the way at beat q (px a beat). She runs in and falls into step; both run through
   * line 2 (she is off first and slows first, and so closer behind him for it), walk, go slowly
   * with her small steps, and stop.
   */
  private speed(q: number, him: boolean) {
    const T = this.T, late = him ? [0.15, 0.15] : [0, 0];
    if (!him && q < T.step[1]!) return lerp(RUN, WALK, sine(prog(q, T.step[0]!, T.step[1]!)));
    return keys(q, [
      [T.run[0]! + late[0]!, WALK], [T.run[0]! + late[0]! + 0.4, RUN, sine], [T.run[1]! - 0.55 + late[1]!, RUN], [T.run[1]! + late[1]!, WALK, sine],
      [T.tiny[0]!, WALK], [T.tiny[1]!, TINY, sine], [T.stop - 0.5, TINY], [T.stop, 0, sine],
    ]);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    if (this.later) return this.later.render(f, out);
    const { c, g } = this.stage!.begin(), q = f.beat - this.b0, cuts = this.cuts;
    // which picture; round a cut the next one comes up over it, on a canvas of its own
    let i = 0;
    while (i < cuts.length && q >= cuts[i]!.at + cuts[i]!.half) i++;
    this.light = 2.2;
    const cut = cuts[i], k = cut ? sine(clamp((q - cut.at + cut.half) / (2 * cut.half))) : 0;
    g.save(); g.globalAlpha = 1 - k; this.pictures[i]!(c, g, f.t, q); g.restore();
    if (k > 0) {
      const next = scratch('picture');
      g.save(); g.globalAlpha = k; this.pictures[i + 1]!(next.c, g, f.t, q); g.restore();
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = k; c.drawImage(next.cv, 0, 0, W, H); c.restore();
    }
    this.stage!.end(out, { light: this.light });
  }

  /** A line of the lyrics on the picture, kept clear of the light. Returns its characters as drawn. */
  private say(c: Ctx, g: Ctx, line: Line, t: number, how: LyricOpts) {
    const chars = drawLyric(c, line, t, how);
    if (chars.length) shade(g, (x) => { drawLyric(x, line, t, how); });
    return chars;
  }

  // ------------------------------------------------------------------ 1 to 5: the way home
  /** `bare`: the picture without its lines (for the photographs of it). */
  private walk(c: Ctx, g: Ctx, t: number, q: number, bare = false) {
    const T = this.T, s = this.season, L = this.L;
    const xh = this.tab(this.xh, q), xb = this.tab(this.xb, q), ph = this.tab(this.ph, q), pb = this.tab(this.pb, q), vh = this.speed(q, false), vb = this.speed(q, true);
    const runH = clamp((vh - WALK) / (RUN - WALK)), runB = clamp((vb - WALK) / (RUN - WALK)), small = sine(prog(q, T.tiny[0]!, T.tiny[1]!)), stopped = q >= T.stop;
    // the camera: on him until she has caught up; back a little and ahead of them while they run; back again for the bus stop
    const on = lerp(xb - 40, (xh + xb) / 2, sine(prog(q, 0.2, T.step[1]!))), ground = lerp(groundAt(WAY.steps), groundAt(WAY.yard), smoothstep(WAY.steps - 220, WAY.yard + 240, on + 60));
    const zoom = keys(q, [[T.run[0]!, 1], [T.run[0]! + 1, 0.9, sine], [T.run[1]! - 0.8, 0.9], [T.run[1]! + 0.6, 1, sine], [T.stop - 0.4, 1], [T.bus[1]! + 0.2, 0.82, sine]]) * (1 + 0.012 * prog(q, T.bus[1]!, this.cuts[0]!.at + 0.5));
    const sx = keys(q, [[0, 650], [T.step[1]! + 0.4, 960, sine], [T.run[0]!, 960], [T.run[0]! + 1.1, 800, sine], [T.run[1]! - 0.6, 800], [T.run[1]! + 0.9, 960, sine], [T.stop - 0.4, 960], [T.bus[1]! + 0.2, 780, sine]]);
    const sy = keys(q, [[T.stop - 0.4, FLOOR], [T.bus[1]! + 0.2, 884, sine]]);
    const cam: Cam = { zoom, x: on - W / 2 - (sx - W / 2) / zoom, y: ground - H / 2 - (sy - H / 2) / zoom };
    // the bus: in from behind them, slowing; and off again
    const door = (BUS.door[0] + BUS.door[1]) / 2, busX = WAY.door - door * BUS.k - 2000 * (1 - prog(q, T.bus[0]!, T.bus[1]!)) ** 2 + 520 * Math.max(0, q - T.leave) ** 2;
    const doors = sine(prog(q, T.bus[1]! - 0.1, T.bus[1]! + 0.25)) * (1 - sine(prog(q, T.window - 0.05, T.window + 0.3)));
    // him: he sees her come, talks along the street, wonders at her small steps; at the stop he looks back at her
    // once, gets on (away from us, up the step), and goes to his window
    const notice = sine(prog(q, T.step[0]!, T.step[1]! + 0.3)) * (1 - sine(prog(q, T.run[0]! - 0.5, T.run[0]! + 0.1))), chat = sine(prog(q, T.run[1]! + 0.5, T.run[1]! + 1.2)) * (1 - sine(prog(q, T.tiny[0]! - 0.5, T.tiny[0]!)));
    const wonder = sine(prog(q, T.tiny[1]!, T.tiny[1]! + 0.5)) * (1 - sine(prog(q, T.stop - 1, T.stop - 0.3))), look = sine(prog(q, T.look[0]!, T.look[0]! + 0.3)) * (1 - sine(prog(q, T.look[1]!, T.look[1]! + 0.3)));
    const on1 = sine(prog(q, T.board[0]!, T.board[1]!)), inside = q >= T.board[1]!;
    const he = (x: Ctx, silhouette?: string) => {
      if (inside) return;
      const pose: PoseArg = on1 > 0 ? { from: 'stand', to: 'walk', k: Math.sin(Math.PI * on1) } : stopped ? 'turn-smile' : q < T.tiny[0]! ? { from: 'walk', to: 'run', k: runB } : { from: 'stand', to: 'walk', k: clamp(vb / TINY) };
      drawBoy(x, pose, {
        x: lerp(xb, busX + door * BUS.k, on1), y: lerp(groundAt(xb), BUS.road - BUS.floor * BUS.k, smoothstep(0.4, 0.95, on1)), scale: S * lerp(1, BUS.k, on1), facing: 90 + 90 * smoothstep(0, 0.55, on1),
        t, walk: pb + 1.5 * on1, k: look, outfit: s.outfit, wind: -0.1 - 0.45 * runB, headTurn: -30 * notice - 20 * chat - 38 * wonder, smile: 0.45 + 0.4 * notice, blush: 0.4,
        light: [0.85, -0.35], shadow: silhouette ? 0 : 0.7 * (1 - on1), silhouette,
      });
    };
    // her: running in, in step, running, her small steps (her eyes on her feet); at the stop she turns to the bus and waves it off
    const turn = sine(prog(q, T.board[0]! + 0.1, T.window)), wave = sine(prog(q, T.window - 0.15, T.window + 0.3)), after = sine(prog(q, T.leave, T.leave + 1.2));
    const she = (x: Ctx, silhouette?: string) => {
      const pose: PoseArg = wave > 0 ? { from: 'stand', to: 'wave', k: wave } : q < T.tiny[0]! ? { from: 'walk', to: 'run', k: runH } : { from: 'stand', to: 'walk', k: lerp(1, SMALL, small) * clamp(vh / TINY) };
      drawGirl(x, pose, {
        x: xh, y: groundAt(xh) + 12, scale: S, facing: 90 + 60 * turn, t, walk: wave > 0 ? t * 1.5 : ph, outfit: s.outfit, wind: -0.12 - 0.5 * runH,
        headTurn: -56 * turn - 6 * after, nod: 12 * small * (1 - sine(prog(q, T.stop - 0.4, T.stop + 0.3))) - 8 * turn, smile: 0.48 + 0.5 * Math.max(runH, small * (1 - turn)), blush: 0.7 + 0.3 * small,
        light: [0.85, -0.35], shadow: silhouette ? 0 : 0.7, silhouette,
      });
    };
    const two = (x: Ctx, silhouette?: string) => { he(x, silhouette); she(x, silhouette); };
    drawWay(c, g, {
      t, cam, season: s, late: smoothstep(T.run[0]!, T.stop + 2.5, q), dust: this.dust.filter((d) => t > d.t && t - d.t < 0.62).map((d) => ({ x: d.x, y: d.y, age: t - d.t })),
      stars: this.stars.map((st) => ({ x: st.x, age: t - this.at(st.q) })), two,
      bus: q <= T.bus[0]! ? undefined : {
        x: busX, door: doors,
        inside: !inside ? undefined : (x) => {
          const along = sine(prog(q, T.board[1]!, T.window));
          drawBoy(x, { from: 'stand', to: 'wave', k: sine(prog(q, T.window - 0.1, T.window + 0.3)) }, { x: lerp(door, (BUS.win[0] + BUS.win[1]) / 2, along), y: -BUS.floor, scale: S, facing: lerp(180, 12, along), t, walk: t * 1.6, outfit: s.outfit, smile: along, light: null });
        },
      },
    });
    // (in the corridor the bright windows are behind them)
    if (openings(inView(cam)).length) shade(g, (x) => { camera(x, cam, 1); two(x, SHADE); });
    // the light verse 1 ended in goes back toward the sun, and the corridor is there (VERSE1_WASH)
    const leak = (1 - prog(q, 0, T.clear)) ** 1.4, flat = smoothstep(0.3, 1, leak);
    lightLeak(g, leak, { from: -0.2, t, ...VERSE1_WASH });
    if (flat > 0) { c.fillStyle = rgba(VERSE1_WASH.under, flat); c.fillRect(0, 0, W, H); }
    this.light = Math.min(this.light, 2.2 * (1 - smoothstep(0.2, 0.95, leak)));
    if (bare) return;
    // the lines, over their heads, in two rows taken in turn. 1: in her handwriting, drifting with the camera
    const drift = 14 * Math.sin(t * 0.45), wavy = (k: number, a: number) => a * Math.sin(t * 0.9 + k * 0.7);
    // (the line starts on the cut: the characters that wait come up out of the light, they do not start there)
    this.say(c, g, L[0]!, t, { x: 0, y: 0, size: 86, style: 'hand', until: this.at(T.run[0]! + 0.55), path: (_u, k) => ({ x: 564 + 88 * k + drift, y: ROW_A + wavy(k, 9) }), each: (ch) => { if (ch.sung <= 0) ch.alpha = smoothstep(0, 0.45, q); } });
    // 2: its characters skip along, as the two of them do
    this.say(c, g, L[1]!, t, {
      x: 0, y: 0, size: 84, hold: 0.9, path: (_u, k) => ({ x: 454 + 92 * k, y: ROW_B - 8 * Math.sin(k * 0.9) }),
      each: (ch) => { ch.y -= 34 * Math.sin(Math.PI * clamp(ch.since / 0.34)) ** 0.8 + (ch.since > 0.34 ? 8 * Math.abs(Math.sin(Math.PI * (q * 1.5 + ch.k * 0.5))) : 0); },
    });
    // 3: written by hand again, at a walk
    this.say(c, g, L[2]!, t, { x: 0, y: 0, size: 80, style: 'hand', hold: 0.9, path: (_u, k) => ({ x: 456 + 84 * k + drift, y: ROW_A + wavy(k, 7) }) });
    // 4: a glint over each character as it is sung, like the marks on the pavement
    for (const ch of this.say(c, g, L[3]!, t, { x: 0, y: 0, size: 84, until: this.at(T.stop + 0.4), path: (_u, k) => ({ x: 638 + 92 * k, y: ROW_B + wavy(k, 5) }) })) {
      if (ch.since > 0 && ch.since < 0.6) sparkle(g, ch.x + 36, ch.y - 48, 24, Math.sin(Math.PI * (ch.since / 0.6)), { rot: ch.k });
    }
    // 5: in the sky over the bus
    this.say(c, g, L[4]!, t, { x: 0, y: 0, size: 86, style: 'hand', path: (_u, k) => ({ x: 564 + 88 * k, y: ROW_A + wavy(k, 7) }) });
  }

  // ------------------------------------------------------------------ 6, 7: her room that night
  private room(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, L = this.L, wide = sine(prog(q, T.photos[0]! - 0.4, T.photos[0]! + 0.8));
    const cam: Cam = { zoom: lerp(1.45 + 0.05 * prog(q, this.cuts[0]!.at, T.photos[0]!), 1.3, wide), x: lerp(978, 960, wide) - W / 2, y: lerp(640, 600, wide) - H / 2 };
    let phone: V2 = [0, 0];
    drawRoom(c, g, {
      t, cam, day: 0, sky: NIGHT_SKY, stars: 1, moon: [190, 252], moonlight: 1, sun: 0, turned: 0, falls: [], first: -1, snow: 0, frost: 0, month: 10, flip: 0,
      her: (x) => {
        const a = drawGirl(x, 'hold-phone', { x: ROOM.her, y: ROOM.bed + 6, scale: 1, facing: 90, t, outfit: this.season.outfit, blush: 0.9, smile: 0.4, light: [0.8, 0.1] });
        phone = [(a.handL[0] + a.handR[0]) / 2 + 2, a.handL[1] - 22];
        drawPhone(x, phone[0], phone[1], 1, -0.5, 0.85);
      },
    });
    // her phone lights her: softly on the picture, and the screen itself on the light layer
    const [px, py] = seen(cam, phone);
    glow(c, px, py, 330 * cam.zoom!, { color: mix('paper', 'sky', 0.35), alpha: 0.3 });
    phoneGlow(g, px, py, 0.6 * cam.zoom!, 0.5);
    // her phone's screen, large beside her: the line is what she types, a character as each is sung; once it is
    // sung she takes it out again, and types NOTE instead
    const typed = this.typed(q), said = Math.min(NOTE.length, Math.floor((NOTE.length + 1) * prog(q, T.again[0]!, T.again[1]!)));
    const field = CHAT.field, slot = (k: number): V2 => [field.x + (k < 7 ? k : k - 7) * field.step, k < 7 ? field.y : field.y + field.lead];
    const caret = slot(said || Math.min(typed, L[5]!.chars.filter((ch) => ch.word && t >= ch.word.start).length));
    drawChat(c, g, {
      x: lerp(1470, 1672, wide), y: lerp(548, 632, wide), scale: lerp(1, 0.6, wide), tilt: 0.03, sent: ease.outBack(prog(q, T.sent, T.sent + 0.45)),
      typed: (x) => {
        drawLyric(x, L[5]!, t, { x: 0, y: 0, size: 62, ghost: 0, path: (_u, k) => ({ x: slot(k)[0], y: slot(k)[1] }), each: (ch) => { if (ch.k >= typed) ch.alpha = 0; } });
        x.font = font(F.hand(500), 62); x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = rgba('ink');
        for (let k = 0; k < said; k++) x.fillText(NOTE[k]!, slot(k)[0], slot(k)[1] + CJK_MID * 62);
      },
      caret: [caret[0] - field.step / 2 + 3, caret[1]], blink: smoothstep(-0.3, 0.3, Math.sin(t * 7)),
    });
    // the photographs of the walk come up round her; the line is written under two of them, half and half
    if (q <= T.photos[0]! - 0.05) return;
    const shots = this.photos(), frames = PHOTOS.map((p, i) => {
      const k = prog(q, T.photos[i]!, T.photos[i]! + 0.5);
      return { x: p.x + 10 * Math.sin(t * 0.6 + i * 2), y: p.y + 8 * Math.sin(t * 0.5 + i * 1.3) + 34 * (1 - ease.outCubic(k)), rot: p.rot + 0.02 * Math.sin(t * 0.4 + i), k };
    });
    frames.forEach((fr, i) => {
      if (fr.k <= 0) return;
      const w = PHOTOS[i]!.w, card = (x: Ctx) => { x.translate(fr.x, fr.y); x.rotate(fr.rot); x.globalAlpha *= clamp(fr.k * 2.5); x.fillStyle = SHADE; x.fillRect(-w / 2, -w * 0.6, w, w * 1.2); };
      drawPhoto(c, { x: fr.x, y: fr.y, w, rot: fr.rot, scale: 0.8 + 0.2 * ease.outBack(fr.k), alpha: clamp(fr.k * 2.5), img: shots[i]!, crop: PHOTOS[i]!.crop });
      shade(g, card);   // (the moon is behind them: it does not shine through)
    });
    drawLyric(c, L[6]!, t, {
      x: 0, y: 0, size: 60,
      path: (_u, k) => { const i = k < 3 ? 0 : 2, fr = frames[i]!, dx = ((k < 3 ? k : k - 4) - 1) * 66, dy = 0.38 * PHOTOS[i]!.w, ca = Math.cos(fr.rot), sa = Math.sin(fr.rot); return { x: fr.x + dx * ca - dy * sa, y: fr.y + dx * sa + dy * ca, angle: fr.rot }; },
      each: (ch) => { ch.alpha = clamp(frames[ch.k < 3 ? 0 : 2]!.k * 2.5); },
    });
  }
  /** How many characters of the line are in the field: all of them, until she takes them out one by one. */
  private typed(q: number) {
    const T = this.T, n = this.L[5]!.chars.length;
    return q < T.erase[0]! ? n : Math.ceil(n * (1 - prog(q, T.erase[0]!, T.erase[1]!)));
  }
  /** Three moments of the walk as she remembers them: each a whole frame of it, painted once, small, and kept. */
  private photos(): HTMLCanvasElement[] {
    return (this.kept ??= this.T.shots.map((q) => {
      const k = 0.4, cv = document.createElement('canvas'), light = this.light;
      cv.width = Math.round(W * k * SCALE); cv.height = Math.round(H * k * SCALE);
      this.walk(scaleContext2D(cv.getContext('2d')!, k * SCALE), scratch('unlit', 4).c, this.at(q), q, true);
      this.light = light;
      return cv;
    }));
  }

  // ------------------------------------------------------------------ 8: the zipper pocket
  private bag(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, line = this.L[7]!, from = this.cuts[1]!.at, s = BAG.scale, slow = prog(q, from, T.zipped + 1);
    const cam: Cam = { zoom: 1 + 0.045 * slow, x: 12 * slow, y: 6 * slow };
    // the pocket's zip: open until the line is in, shut on the downbeat. (The kit's bag: its pull runs from x0, open, to x1.)
    const zip = 1 - ease.inOutCubic(prog(q, T.zipped - 0.5, T.zipped)), zy = BAG.y - 63 * s, x0 = BAG.x - 37 * s, x1 = BAG.x + 37 * s, pull: V2 = [lerp(x1, x0, zip) + 4, zy + 12 * s - 16];
    // her hand brings the star, lowers it into the pocket and lets it go; comes back for the pull, draws it shut, and goes
    const away: V2 = [2060, -90], come = sine(prog(q, from - 0.2, T.star[0]! - 0.3)), put = prog(q, T.star[0]!, T.star[1]!), off = sine(prog(q, lerp(T.star[0]!, T.star[1]!, 0.62), T.star[1]! + 0.7));
    const back = sine(prog(q, T.pull[0]!, T.pull[1]!)), gone = sine(prog(q, T.zipped + 0.1, T.zipped + 0.75));
    const over: V2 = [lerp(away[0] - 60, BAG.x + 8, come), lerp(away[1], zy - 150, come)], star: V2 = [over[0], lerp(over[1], zy + 72, sine(put))];
    let hand: V2 = [over[0] + 24, lerp(over[1], zy + 72, sine(Math.min(put, 0.62))) - 36];
    for (const [to, k] of [[away, off], [pull, back], [[away[0], away[1] + 260], gone]] as [V2, number][]) hand = [lerp(hand[0], to[0], k), lerp(hand[1], to[1], k)];
    const shot = drawBagShot(c, g, {
      t, cam, zip, hand: { x: hand[0], y: hand[1], rot: 0.12 + 0.2 * back },
      into: (x) => {
        if (put < 1) drawStar(x, star[0], star[1], 52, lerp(0.35, -0.25, sine(put)) + 0.08 * Math.sin(t * 2) * (1 - put));
        // the line, in the dark beside the bag; then its characters go one after the other into the pocket, after the star
        drawLyric(x, line, t, {
          x: 0, y: 0, size: 96, dark: true, path: (_u, k) => ({ x: 250 + 100 * (k % 5), y: k < 5 ? 318 : 452 }),
          each: (ch) => {
            const u = sine(prog(q, T.flow + 0.045 * ch.k, T.flow + 0.045 * ch.k + 0.42)), v = 1 - u, mx = BAG.x + 10, my = zy + 44, cx = lerp(ch.x, mx, 0.55), cy = Math.min(ch.y, zy) - 200;
            if (u <= 0) return;
            ch.x = v * v * ch.x + 2 * u * v * cx + u * u * mx; ch.y = v * v * ch.y + 2 * u * v * cy + u * u * my; ch.scale = lerp(1, 0.3, u); ch.angle = 0.6 * u;
          },
        });
      },
    });
    // the pull lands: a glint on it, and the pocket keeps a little warmth
    const landed = prog(q, T.zipped - 0.03, T.zipped + 0.55), [gx, gy] = seen(cam, shot.pull), [bx, by] = seen(cam, [BAG.x, zy + 130]);
    sparkle(g, gx, gy, 84, Math.sin(Math.PI * landed) ** 0.7, { rot: 0.4 * landed });
    glow(g, bx, by, 380, { color: 'blush', alpha: 0.22 * smoothstep(T.zipped - 0.2, T.zipped + 0.6, q) });
  }

  // ------------------------------------------------------------------ the interlude: her window, as the season turns
  private window(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, from = this.cuts[2]!.at, { x, y, w, h } = ROOM.win, falls = T.falls[0]!;
    // the camera goes in on the window, slowly at first, until its glass covers the frame (CHORUS1_FROST)
    const near = sine(prog(q, from - 0.45, T.end - 0.3)) ** 1.6, zoom = Math.exp(lerp(Math.log(1.25), Math.log(CHORUS1_FROST.w / w), near));
    const dawn = prog(q, from + 1.2, from + 2.4), winter = smoothstep(falls + 1.8, falls + 3.6, q), over = prog(q, from - 0.5, from + 1.9), flips = T.flips.map((f) => prog(q, f, f + 0.6));
    drawRoom(c, g, {
      t, cam: { zoom, x: x + w / 2 + 140 * (1 - near) - W / 2, y: y + h / 2 - H / 2 }, day: smoothstep(0, 1, dawn),
      sky: blend(blend(blend(NIGHT_SKY, DAWN_SKY, smoothstep(0, 0.55, dawn)), DAY_SKY, smoothstep(0.45, 1, dawn)), SNOW_SKY, winter), stars: 1 - smoothstep(0, 0.5, dawn),
      moon: [lerp(150, 610, over), 310 - 240 * Math.sin(Math.PI * (0.12 + 0.76 * over))], moonlight: 1 - smoothstep(0.72, 1, over), sun: smoothstep(0.5, 1, dawn) * (1 - winter),
      turned: smoothstep(from + 1.8, falls + 1.5, q), falls: T.falls.map((f) => this.at(f)), first: t - this.at(falls + 2.55), snow: smoothstep(falls + 2.9, falls + 4, q),
      frost: sine(prog(q, T.end - 2.4, T.end - 0.25)), month: 10 + flips.filter((f) => f >= 1).length, flip: flips.find((f) => f > 0 && f < 1) ?? 0,
    });
    this.light = Math.min(this.light, 2.2 * (1 - smoothstep(T.end - 0.7, T.end - 0.15, q)));
  }

  override dispose() { this.stage?.dispose(); this.later?.dispose(); }
}
