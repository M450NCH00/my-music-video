// VERSE 1 — 教室钟慢半拍 → 其实在等你回头一笑: class is over, the light is gold, and she takes her time.
//   1  教室钟慢半拍        the bell's last ring closes onto the wall clock (INTRO_RING), whose second hand ticks half a
//                         beat late; the line in chalk on the board under it; then back, to the class on its way out
//   2  粉笔灰飘在你发梢     his hair from two rows behind, in the sunbeam: chalk dust comes down through the light onto
//                         it, and the line condenses out of the dust
//   3  你低头收书包        back from him as he gets up and packs his bag, a book on each beat; the line lies on her desk
//   4  我故意收得比谁都慢   her, one pencil at a time, while the room behind her goes by in fast-forward
//   5  窗外球场在吵        her window: the court outside, the ball bounced on the kick drum, the line hopping with it
//   6  我只听见心跳乱跳     the same shot turns to her: the court goes soft, the frame dims, her heart glows on each kick
//   7  假装还在翻题目       her textbook up in front of her face, a page over on each beat, her eyes over its top edge
//   8  其实在等你回头一笑   over her shoulder to the door: he stops, looks back and smiles, and the light behind him
//                         swells until it has washed the frame (VERSE1_WASH: where chorus 1 starts)
// Six pictures (2 + 3 and 5 + 6 are one camera move each), a soft cross-dissolve between them. Everything is timed
// from the lines themselves, found by content, and from the beat grid: `q` counts beats from the cut.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { W, H } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { CJK_MID, F, textPoints } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, keys, lerp, prog, smoothstep, TAU } from '../engine/util';
import {
  DESK_TOP, INTRO_RING, LYRIC_LEAD, Stage, VERSE1_WASH, atDesk, camera, chalkDust, clockTick, drawBag, drawBoy, drawChair, drawClock, drawDesk, drawGirl,
  drawLyric, dustMotes, glow, layer, lightLeak, lightShaft, scratch, soundRing, sparkle,
  type Anchors, type Cam, type Ctx, type LyricChar, type LyricOpts, type PoseArg, type Shaft, type V2,
} from './_love';
import { BEAMS, BOARD_AT, CLOCK_AT, CLOCK_R, HER, HIM, seatAt } from './intro-classroom';
import {
  DOORWAY, DOOR_STEP, STRIDE, afterClass, doorLight, drawBackWall, drawBook, drawDeskEdge, drawHerDesk, drawPencil, drawPouch, drawTextbook, drawWindowView,
  leavers, onScreen, place, roomRows, shaftOn, soft, windowLight, type RoomCam,
} from './verse1-sets';

/** Half the length of a change of picture, in beats. */
const HALF = 0.28;
/** His head while he sits (px of the classroom picture). */
const HIS_HEAD: V2 = [1114, 528];
/** Where one stands to pack, in the aisle beside one's desk and facing it (and the window): his place and hers. */
const beside = (X: number, Z: number) => { const s = seatAt(X, Z); return { x: s.x, y: s.y, scale: s.scale, facing: s.facing - 90 }; };
const HIS_SPOT = beside(324, 2016), HER_SPOT = beside(324, 1156);
/** The sunbeam on him, close up: a narrow one, as through a gap in the curtains (the frame's own px). */
const BEAM: Shaft = { x: 1560, y: -80, angle: -0.93, length: 1380, width: 290, spread: 1.4 };
/** The textbook she hides behind: the middle of its top edge, the width of a cover, its height. */
const BOOK = { x: 960, y: 404, w: 400, h: 540 };
const disc = (c: Ctx, x: number, y: number, r: number, style: string) => { c.fillStyle = style; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
/**
 * Keep the light off someone: what `paint` draws (the figure again, as a flat shape in SHADE) is cut out of the
 * light already on `g`. A bright window behind the two of them must not shine through them.
 */
const shade = (g: Ctx, paint: (g: Ctx) => void) => { g.save(); g.globalCompositeOperation = 'destination-out'; paint(g); g.restore(); };
const SHADE = rgba('ink');

type Picture = (c: Ctx, g: Ctx, f: Frame, q: number) => void;

export default class Verse1 extends Scene {
  private stage = new Stage(this.ctx);
  /** It starts on the intro's last ring by itself (INTRO_RING, a frame of paper): nothing of the intro is wanted under it. */
  override handlesTransition = true;
  /** The beat of the cut, and the eight lines. */
  private b0 = 0;
  private L: Line[] = [];
  /** The changes of picture (the middle of each dissolve), and what happens inside the pictures: all in beats from the cut. */
  private cuts: number[] = [];
  private T = { wide: [0, 0], pull: [0, 0], up: [0, 0], over: [0, 0], bend: [0, 0], done: 0, turn: [0, 0], duck: 0, again: 0, stop: 0, turned: 0, smile: 0, end: 0 };
  /** The strong kicks of the drum under lines 5 and 6 (s): the ball lands on them, her heart beats on them. */
  private kicks: number[] = [];
  /** How bright the light layer is added this frame: 2.2 as everywhere, until the last light settles into VERSE1_WASH. */
  private light = 2.2;
  /** The points that fill each character of line 2: the dust it condenses out of. */
  private motes: { x: number; y: number }[][] | null = null;
  private pictures: Picture[] = [
    (c, g, f, q) => this.clock(c, g, f, q), (c, g, f, q) => this.him(c, g, f, q), (c, g, f, q) => this.her(c, g, f, q),
    (c, g, f, q) => this.window(c, g, f, q), (c, g, f, q) => this.book(c, g, f, q), (c, g, f, q) => this.door(c, g, f, q),
  ];

  override init() {
    const { audio, lyrics } = this.ctx;
    this.b0 = Math.round(audio.beatAt(this.ctx.start));
    const q = (t: number) => audio.beatAt(t) - this.b0;
    const L = (this.L = ['教室钟慢半拍', '粉笔灰飘在你发梢', '你低头收书包', '我故意收得比谁都慢', '窗外球场在吵', '我只听见心跳乱跳', '假装还在翻题目', '其实在等你回头一笑'].map((s) => lyrics.get(s)));
    const from = (i: number) => q(L[i]!.start), to = (i: number) => q(L[i]!.end), sung = (i: number, ch: number) => q(L[i]!.words[ch]!.start);
    this.cuts = [from(1) - 0.12, from(3) - 0.2, (to(3) + from(4)) / 2, (to(5) + from(6)) / 2, (to(6) + from(7)) / 2];
    this.T = {
      // 1: the camera goes back from the clock once 慢 is being written
      wide: [sung(0, 3) + 0.15, to(0) - 0.3],
      // 2, 3: back from his hair over the end of 梢; he gets up, goes round to his bag, and bends to it on 低头; done by 比 (of line 4)
      pull: [to(1) - 0.75, from(2) + 0.15], up: [to(1) - 0.35, to(1) + 0.25], over: [to(1) - 0.05, from(2) + 0.05], bend: [sung(2, 1) - 0.25, sung(2, 1) + 0.3], done: sung(3, 5),
      // 5, 6: the eye turns from the court to her as line 6 starts
      turn: [from(5) - 0.3, from(5) + 0.5],
      // 7: she ducks on 翻 and looks again on 题
      duck: sung(6, 4), again: sung(6, 5),
      // 8: he stops on 回, has turned by 一, and the light swells from 笑 to the cut
      stop: sung(7, 5), turned: sung(7, 7), smile: sung(7, 8), end: q(this.ctx.end),
    };
    let last = -1;
    this.kicks = audio.events('kick', this.at(this.cuts[2]!) - 3, this.at(this.cuts[3]!) + 2).filter(([t, s]) => s > 0.4 && t - last > 0.3 && ((last = t), true)).map(([t]) => t);
  }

  /** The time of a beat counted from the cut. */
  private at(beat: number) { return this.ctx.audio.timeOfBeat(this.b0 + beat); }
  /** The clock: it was half past four when the bell went, and it ticks half a beat late. */
  private now(f: Frame) { return { time: 16.5 + (f.t - this.ctx.start) / 3600, sec: clockTick(f.beat) - this.b0 }; }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { c, g } = this.stage.begin(), q = f.beat - this.b0, cuts = this.cuts;
    // which picture; round a cut the next one comes up over it, on a canvas of its own
    let i = 0;
    while (i < cuts.length && q >= cuts[i]! + HALF) i++;
    this.light = 2.2;
    const k = i < cuts.length ? ease.inOutSine(clamp((q - cuts[i]! + HALF) / (2 * HALF))) : 0;
    g.save(); g.globalAlpha = 1 - k; this.pictures[i]!(c, g, f, q); g.restore();
    if (k > 0) {
      const next = scratch('picture');
      g.save(); g.globalAlpha = k; this.pictures[i + 1]!(next.c, g, f, q); g.restore();
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = k; c.drawImage(next.cv, 0, 0, W, H); c.restore();
    }
    this.stage.end(out, { light: this.light });
  }

  // ------------------------------------------------------------------ 1: the clock, the board, the class leaving
  private clock(c: Ctx, g: Ctx, f: Frame, q: number) {
    const t = f.t, T = this.T, [bx, by] = BOARD_AT, now = this.now(f);
    // the camera: on the clock, where the ring closes; down to the line being written under it; back, to the room
    const down = ease.outCubic(clamp(q / 0.85)), back = ease.inOutSine(prog(q, T.wide[0], T.wide[1]));
    const cam: RoomCam = { zoom: Math.exp(lerp(lerp(Math.log(6.2), Math.log(4.9), down), Math.log(2.3), back)) * (1 - 0.005 * q), at: CLOCK_AT, to: [lerp(lerp(INTRO_RING.x, 870, down), 900, back), lerp(lerp(INTRO_RING.y, 232, down), 228, back)] };
    c.save(); place(c, cam);
    afterClass(c, t);
    // the line, in chalk beside what is left on the board, and the dust that comes off the chalk
    chalkOff(c, drawLyric(c, this.L[0]!, t, { x: bx + 380, y: by + 50, size: 36, style: 'chalk' }));
    c.restore();
    // the front desks, and the class going out past them: they come into the picture as the camera goes back
    const out = smoothstep(T.wide[0] - 0.25, T.wide[0] + 0.45, q);
    if (out > 0) roomRows(c, cam, t, leavers(t, this.ctx.start).filter((w) => w.Z > 2100), { rows: [4, 3], streak: 60, alpha: out });
    // the ring comes in onto the clock's rim (it was a frame of paper at the cut), and the clock comes up in it:
    // on the wall as the intro has it, and close up with its numerals
    const [sx, sy] = onScreen(cam, CLOCK_AT), R = CLOCK_R * cam.zoom, close = smoothstep(110, 180, R), shown = smoothstep(0, 0.45, q);
    const v = 1 - q / 0.95, ring = { r: lerp(R, INTRO_RING.r, 0.42 * Math.max(0, v) + 0.58 * Math.max(0, v) ** 3), fill: smoothstep(0, 0.16, v), alpha: smoothstep(-0.35, 0.02, v) };
    soundRing(c, sx, sy, ring.r, ring);
    if (close < 1) { c.save(); c.translate(sx, sy); c.scale(cam.zoom, cam.zoom); drawClock(c, 0, 0, CLOCK_R, { ...now, alpha: shown }); c.restore(); }
    if (close > 0) drawClock(c, sx, sy, R, { ...now, alpha: shown * close });
    // the light: the afternoon from the windows on the right, the dust in the air; none of it under the ring
    glow(g, W + 240, 260, 1000, { alpha: 0.42 });
    dustMotes(g, t, { count: 40, seed: 3, alpha: 0.7 });
    g.save(); g.globalCompositeOperation = 'destination-out'; soundRing(g, sx, sy, ring.r, ring); g.restore();
  }

  // ------------------------------------------------------------------ 2, 3: his hair in the sunbeam; he packs his bag
  private him(c: Ctx, g: Ctx, f: Frame, q: number) {
    const t = f.t, T = this.T, back = ease.inOutSine(prog(q, T.pull[0], T.pull[1])), close = 1 - back;
    const cam: RoomCam = { zoom: Math.exp(lerp(Math.log(lerp(5, 5.3, prog(q, this.cuts[0]! - HALF, T.pull[0]))), Math.log(1.75), back)) * (1 + 0.025 * prog(q, T.pull[1], this.cuts[1]!)), at: HIS_HEAD, to: [lerp(700, 888, back), lerp(600, 447, back)] };
    const beam = shaftOn(cam, BEAMS[1]!.shaft);
    // the room beyond him, out of focus, and the beam he is in
    layer(c, { blur: lerp(7.5, 3, back) }, (b) => { place(b, cam); afterClass(b, t, this.now(f)); });
    lightShaft(c, BEAM, { alpha: 0.36 * close, t }); lightShaft(c, beam, { alpha: 0.24 * back, t });
    let his!: Anchors;
    roomRows(c, cam, t, back > 0.1 ? leavers(t, this.ctx.start).filter((w) => w.Z > 2100) : [], { streak: 60, alpha: smoothstep(0.1, 0.5, back), after: (r) => { if (r === 2) { c.save(); place(c, cam); his = this.hisDesk(c, f, q); c.restore(); } } });
    lightShaft(c, BEAM, { alpha: 0.1 * close, t }); lightShaft(c, beam, { alpha: 0.07 * back, t });
    // the light: the windows (not through him), the beam, the dust in it
    g.save(); place(g, cam); windowLight(g); g.restore();
    shade(g, (x) => { place(x, cam); this.hisDesk(x, f, q, true); });
    lightShaft(g, BEAM, { alpha: 0.035 * close, t }); lightShaft(g, beam, { alpha: 0.022 * back, t });
    dustMotes(g, t, { shafts: [BEAM, beam], count: 90, seed: 8, size: lerp(1, 1.4, close) });
    // close up: chalk dust comes down through the beam and settles on his hair, and the line condenses out of it
    if (close > 0.02) {
      const R = 49 * 1.09 * his.scale, top = onScreen(cam, [his.top[0], his.top[1] + R]);
      chalkDust(c, t, { count: 70, alpha: 0.5 * close, size: 1.5, seed: 4, wind: -0.3 });
      this.settling(c, g, t, top, R * cam.zoom, close);
      this.dustLine(c, g, t, close);
    }
    // from further back: her desk comes up under the frame, and line 3 lies on it
    if (back > 0.02) {
      const dy = (1 - back) * 340;
      for (const x of [c, g]) { x.save(); x.translate(0, dy); }
      drawHerDesk(c, g, t);
      c.translate(960, 946); c.transform(1, 0, 0, 0.58, 0, 0);
      drawLyric(c, this.L[2]!, t, { x: 0, y: 0, size: 116, style: 'hand' });
      c.restore(); g.restore();
    }
  }

  /**
   * Him at his desk, two rows ahead (in the picture's space): sitting; then up and round to his bag; packing it,
   * a book in on each beat; then done, the bag on his shoulder. `solo`: only him, as a flat shape (see shade()).
   */
  private hisDesk(c: Ctx, f: Frame, q: number, solo = false): Anchors {
    const T = this.T, t = f.t, s = HIM.scale * 1.05, sine = ease.inOutSine;
    const up = sine(prog(q, T.up[0], T.up[1])), over = sine(prog(q, T.over[0], T.over[1])), bent = sine(prog(q, T.bend[0], T.bend[1])), done = sine(prog(q, T.done, T.done + 0.6));
    // a beat of packing: the hand comes back for the next book, lifts it through the second half, and it is in on the beat
    const m = Math.floor(q), u = q - m, m1 = Math.ceil(T.bend[1] - 0.45), books = Math.max(0, Math.floor(T.done) - m1), busy = (n: number) => n >= m1 && n < m1 + books;
    const k = u >= 0.5 ? (busy(m) ? sine((u - 0.5) / 0.5) : 0) : busy(m - 1) ? 1 - sine(clamp((u - 0.1) / 0.3)) : 0;
    const packed = clamp(m - m1, 0, books), held = u >= 0.46 && busy(m);
    const spot = { x: lerp(HIM.x, HIS_SPOT.x, over), y: lerp(HIM.y, HIS_SPOT.y, over), scale: lerp(HIM.scale, HIS_SPOT.scale, over), facing: lerp(HIM.facing, HIS_SPOT.facing, over) };
    const seat = { x: HIM.x, y: HIM.y, scale: s, facing: HIM.facing }, desk: V2 = [HIM.x + Math.sin((HIM.facing * Math.PI) / 180) * 156 * s, HIM.y - DESK_TOP * s];
    const pose: PoseArg = up < 1 ? { from: 'sit-write', to: 'stand', k: up } : { from: 'stand', to: 'pack-bag', k: bent * (1 - done) };
    const he = (silhouette?: string) => drawBoy(c, pose, { ...spot, t, k, outfit: 'autumn', bag: done > 0.5, nod: lerp(-8, 0, up), light: [0.9, -0.45], silhouette });
    if (solo) return he(SHADE);
    // (while he sits, his bag is on the desk beyond him; once he is round at its side, his hand goes in behind it)
    const bag = () => { if (done <= 0.5) drawBag(c, { x: desk[0] + 18 * s, y: desk[1], scale: s * 0.8, boy: true }); };
    drawDesk(c, seat);
    for (let i = 0; i < books - packed - (held ? 1 : 0); i++) drawBook(c, desk[0] - 40 * s, desk[1] - i * 9 * s, s, { flat: true, tone: i + 1 });
    if (over < 0.75) bag();
    const a = he();
    if (held) drawBook(c, a.handR[0] + 3 * s, a.handR[1] - 14 * s, s * 0.9, { rot: lerp(-0.6, 0.1, k), tone: books - packed });
    if (over >= 0.75) bag();
    drawChair(c, seat);
    return a;
  }

  /** Chalk dust coming to rest on his hair, speck after speck: the top of his hair is a disc of radius `R` round (x, y). */
  private settling(c: Ctx, g: Ctx, t: number, [x0, y0]: V2, R: number, A: number) {
    const since = t - this.at(this.cuts[0]!);
    for (let i = 0; i < 34; i++) {
      const r = (k: number) => hash(i, 91, k), fall = 0.3 + i * 0.085 + 0.3 * r(1) - since;
      if (fall > 2.4) continue;
      const a = (r(2) - 0.5) * 2.2, d = lerp(0.3, 0.97, Math.sqrt(r(3))), up = Math.max(0, fall), lit = 0.6 + 0.4 * Math.sin(t * (1.5 + 2 * r(4)) + i);
      const x = x0 + Math.sin(a) * d * R + up * 105 + 18 * Math.sin(up * 2.3 + i) * Math.min(1, up), y = y0 - Math.cos(a) * d * R * 0.96 - up * 150, size = lerp(2.2, 4.4, r(5));
      const alpha = A * (fall > 0 ? 0.8 * clamp((2.4 - fall) * 3) : 0.9);
      disc(c, x, y, size, rgba('paper', alpha));
      disc(g, x, y, size * 1.6, mix('paper', 'gold', 0.4, 0.3 * alpha * lit));
    }
  }

  /** Line 2: each character condenses out of floating chalk dust as it is sung, then shimmers. */
  private dustLine(c: Ctx, g: Ctx, t: number, A: number) {
    const line = this.L[1]!, size = 92;
    const motes = (this.motes ??= line.chars.map((ch, k) => textPoints(ch.ch, F.hand(500), size, 5, 11 + k)));
    const how: LyricOpts = {
      x: 0, y: 0, size, ghost: 0, alpha: A, path: (_u, k) => ({ x: 1030 + 96 * k, y: 322 - 44 * Math.sin((k / 7) * Math.PI) }),
      each: (ch) => { ch.y += 4 * Math.sin(t * 1.3 + ch.k); ch.alpha = smoothstep(0.1, 0.42, ch.since); },
    };
    const chars = drawLyric(c, line, t, how);
    shade(g, (x) => { drawLyric(x, line, t, how); });
    for (const ch of chars) {
      const pts = motes[ch.k];
      if (!pts || ch.since < -LYRIC_LEAD - 0.25 || ch.since > 1.7) continue;
      // the dust of this character: afloat before it is sung, drawn together into its strokes as it is, then gone into them
      const gather = ease.outCubic(clamp(ch.since / 0.4)), seen = A * smoothstep(-LYRIC_LEAD - 0.25, -0.1, ch.since) * (1 - smoothstep(0.42, 0.9, ch.since));
      if (seen > 0.003) pts.forEach((p, j) => {
        const r = (k: number) => hash(ch.k, j, k), a = r(1) * TAU + t * (0.3 + 0.5 * r(2)), d = 24 + 80 * r(3);
        const x = lerp(ch.x + Math.cos(a) * d, ch.x + p.x - size / 2, gather), y = lerp(ch.y + Math.sin(a) * d * 0.8 - 30 + 14 * Math.sin(t * 0.9 + j), ch.y + p.y + CJK_MID * size, gather);
        disc(c, x, y, lerp(2.3, 1.7, gather) * (0.7 + 0.6 * r(5)), rgba('paper', (0.5 + 0.4 * gather) * seen));
        if (j % 3 === 0) disc(g, x, y, 3.2, mix('paper', 'gold', 0.4, 0.4 * seen));
      });
      // the shimmer once it is written
      const lit = A * smoothstep(0.25, 0.5, ch.since) * (1 - smoothstep(1.0, 1.7, ch.since));
      if (lit > 0.003) for (let j = 0; j < 6; j++) { const p = pts[Math.floor(hash(ch.k, j, 7) * pts.length)]!; sparkle(g, ch.x + p.x - size / 2, ch.y + p.y + CJK_MID * size, 15, lit * (0.5 + 0.5 * Math.sin(t * 9 + j * 2.4 + ch.k)) ** 2, { rot: j }); }
    }
  }

  // ------------------------------------------------------------------ 4: her, one pencil at a time
  private her(c: Ctx, g: Ctx, f: Frame, q: number) {
    const t = f.t, T = this.T, s = HER_SPOT, slow = prog(q, this.cuts[1]!, this.cuts[2]!);
    const cam: RoomCam = { zoom: 1.3 * (1 + 0.04 * slow), at: [s.x, s.y], to: [1060 - 24 * slow, 1012] };
    // the room behind her, a little soft, in fast-forward: everyone else is a streak, and he packs at his own speed
    layer(c, { blur: 3 }, (b) => {
      b.save(); place(b, cam); afterClass(b, t, this.now(f)); b.restore();
      lightShaft(b, shaftOn(cam, BEAMS[1]!.shaft), { alpha: 0.22, t });
      roomRows(b, cam, t, leavers(t, this.ctx.start, { rate: 3.2, count: 13, seed: 9 }), { streak: 430, fast: true, flat: true, after: (r) => { if (r === 2) { b.save(); place(b, cam); this.hisDesk(b, f, q); b.restore(); } } });
    });
    // a pencil every two beats: lifted slowly through most of them, let go into the pouch on the second
    const m = Math.floor(q / 2), u = q / 2 - m, m1 = Math.ceil(this.cuts[1]! / 2), k = u >= 0.25 ? ease.inOutSine((u - 0.25) / 0.75) : 1 - ease.inOutSine(clamp((u - 0.03) / 0.17));
    const landed = clamp(m - m1 + 1, 0, 3), held = u >= 0.22 && landed < 3, out = 3 - landed - (held ? 1 : 0);
    // she looks up from them once, his way
    const glance = ease.inOutSine(prog(q, T.done - 0.5, T.done + 0.1)) * (1 - ease.inOutSine(prog(q, T.done + 0.7, T.done + 1.4)));
    c.save(); place(c, cam);
    const top: V2 = [s.x + Math.sin((s.facing * Math.PI) / 180) * 156 * s.scale, s.y - DESK_TOP * s.scale];
    drawDesk(c, s);
    for (let i = 0; i < out; i++) drawPencil(c, top[0] - (48 - i * 7) * s.scale, top[1] - (2.6 + i * 3.4) * s.scale, 46 * s.scale, 0.02 * (i - 1), i + 2);
    const she = (x: Ctx, silhouette?: string) => drawGirl(x, 'pack-bag', { ...s, t, k: held ? k : k * (landed < 3 ? 1 : 0), outfit: 'autumn', bag: false, headTurn: 34 * glance, nod: -14 * glance, blush: 0.6 + 0.4 * glance, wind: -0.06, light: [0.85, -0.5], shadow: silhouette ? 0 : 0.7, silhouette });
    const a = she(c);
    if (held) drawPencil(c, a.handR[0] + 1 * s.scale, a.handR[1] + 13 * s.scale, 46 * s.scale, lerp(0.25, Math.PI / 2, ease.outCubic(clamp(k * 1.6))), landed + 2);
    drawPouch(c, top[0] + 12 * s.scale, top[1], s.scale, 2 + landed);
    drawChair(c, { x: HER.x, y: HER.y, scale: HER.scale, facing: HER.facing });
    c.restore();
    // the light on her: her own window, and its beam across the desk
    const beam = shaftOn(cam, BEAMS[0]!.shaft);
    lightShaft(c, beam, { alpha: 0.1, t });
    g.save(); place(g, cam); windowLight(g, 1.3); g.restore();
    lightShaft(g, beam, { alpha: 0.03, t }); lightShaft(g, shaftOn(cam, BEAMS[1]!.shaft), { alpha: 0.02, t });
    // the line, in her handwriting down the window beside her (two columns, the first on the right): calm and steady
    const how: LyricOpts = { x: 0, y: 0, size: 86, style: 'hand', path: (_u, k) => (k < 5 ? { x: 1772, y: 152 + 94 * k } : { x: 1664, y: 152 + 94 * (k - 5) }) };
    drawLyric(c, this.L[3]!, t, how);
    shade(g, (x) => { drawLyric(x, this.L[3]!, t, how); place(x, cam); she(x, SHADE); this.hisDesk(x, f, q, true); });
    dustMotes(g, t, { shafts: [beam], count: 70, seed: 6 });
  }

  // ------------------------------------------------------------------ 5, 6: the court outside; her heartbeat
  private window(c: Ctx, g: Ctx, f: Frame, q: number) {
    const t = f.t, T = this.T, inward = ease.inOutSine(prog(q, T.turn[0], T.turn[1])), slow = prog(q, this.cuts[2]!, this.cuts[3]!);
    const cam: Cam = { x: lerp(-24, 30, slow) + 50 * inward, y: 10 * inward, zoom: 1.02 + 0.03 * slow + 0.035 * inward };
    let chest: V2 = [0, 0];
    drawWindowView(c, g, { t, cam, inward, ...this.bounce(t), her: (b) => { chest = this.atWindow(b, f, inward); } });
    // her heart: a soft glow from her chest on each kick, and its echo
    const beat = Math.max(this.heart(t), 0.55 * this.heart(t - 0.15)) * inward, z = cam.zoom!, hx = (chest[0] - 44 - W / 2 - cam.x!) * z + W / 2, hy = (chest[1] - H / 2 - cam.y!) * z + H / 2;
    if (inward > 0.01) for (const [x, r, a] of [[c, 170 + 110 * beat, 0.2 + 0.3 * beat], [g, 250 + 200 * beat, 0.06 + 0.12 * beat]] as [Ctx, number, number][]) {
      const warm = x.createRadialGradient(hx, hy, 0, hx, hy, r), col = mix('blush', 'rose', 0.3);
      warm.addColorStop(0, rgba(col, a * inward)); warm.addColorStop(0.4, rgba(col, a * 0.5 * inward)); warm.addColorStop(1, rgba(col, 0));
      x.fillStyle = warm; x.fillRect(hx - r, hy - r, r * 2, r * 2);
    }
    // line 5 over the court, hopping with the ball; line 6 in the hush beside her, each character at a height of its own
    drawLyric(c, this.L[4]!, t, { x: 700, y: 300, size: 100, hold: 0.4, each: (ch) => { ch.y -= 0.45 * this.bounce(t - 0.04 * ch.k).ball; } });
    drawLyric(c, this.L[5]!, t, {
      x: 690, y: 452, size: 96,
      each: (ch) => { const jump = Math.sin(Math.PI * clamp(ch.since / 0.34)) ** 0.8; ch.y += (hash(ch.k, 7) - 0.5) * 36 - (26 + 44 * hash(ch.k, 8)) * jump - (ch.since > 0.34 ? (5 + 13 * hash(ch.k, 9)) * beat : 0); ch.angle = (hash(ch.k, 10) - 0.5) * 0.12; },
    });
  }
  /** Her at her desk by the window, seen from the aisle: gazing out, chin on hand; then her eyes come down to the desk. Returns where her heart is. */
  private atWindow(c: Ctx, f: Frame, inward: number): V2 {
    const p = { x: 1570, y: 1392, scale: 1.9, facing: -90 };
    return atDesk(c, p, () => drawGirl(c, { from: 'chin-on-hand', to: 'sit-write', k: inward }, { ...p, t: f.t, outfit: 'autumn', headTurn: lerp(-48, 8, inward), nod: lerp(-4, 6, inward), blush: lerp(0.5, 1, inward), wind: -0.1, light: [-0.75, -0.6] })).chest;
  }
  /** The ball: how high it is off the court (px) and how hard it has just landed (0..1). It lands on the kick drum. */
  private bounce(t: number): { ball: number; hit: number } {
    const ks = this.kicks;
    let i = 0;
    while (i < ks.length - 1 && ks[i + 1]! <= t) i++;
    const a = ks[i] ?? 0, span = (ks[i + 1] ?? a + 0.8) - a, u = clamp((t - a) / span);
    return { ball: 4 * u * (1 - u) * Math.min(110, 150 * span * span), hit: t < a ? 0 : Math.pow(0.5, (t - a) / 0.16) };
  }
  /** Her heartbeat at time t, 0..1: it goes with the kick drum. */
  private heart(t: number) { return Math.min(1, 1.5 * this.ctx.audio.hit('kick', t, 0.17)); }

  // ------------------------------------------------------------------ 7: behind her textbook
  private book(c: Ctx, g: Ctx, f: Frame, q: number) {
    const t = f.t, T = this.T, B = BOOK, cam: Cam = { zoom: 1.03 + 0.04 * prog(q, this.cuts[3]!, this.cuts[4]!) }, u = f.beat - Math.floor(f.beat);
    c.save(); camera(c, cam, 0.5); drawBackWall(c); c.restore();
    const shaft: Shaft = { x: 90, y: -60, angle: 0.88, length: 1600, width: 300, spread: 1.5 };
    lightShaft(c, shaft, { alpha: 0.2, t });
    // her eyes come up over the book, go down behind it on 翻, and come up again: she is looking his way
    const from = this.cuts[3]!, sine = ease.inOutSine;
    const head = keys(q, [[from, 400], [from + 0.9, 338, sine], [T.duck - 0.1, 338], [T.duck + 0.25, 402, sine], [T.again + 0.15, 402], [T.again + 0.95, 336, sine], [this.cuts[4]!, 330, sine]]);
    c.save(); camera(c, cam, 1);
    drawGirl(c, 'stand', { x: B.x, y: head + 557 * 2.6, scale: 2.6, facing: 0, t, outfit: 'autumn', bag: false, headTurn: 9, tilt: -2, blush: 1, wind: 0.04, light: [-0.8, -0.5] });
    // a page over on each beat, and the line across the cover
    drawTextbook(c, { ...B, flip: sine(clamp(u / 0.42)), cover: () => { drawLyric(c, this.L[6]!, t, { x: B.x, y: B.y + B.h * 0.42, size: 96, style: 'hand' }); } });
    drawDeskEdge(c, B.y + B.h);
    c.restore();
    glow(g, -140, 260, 950, { alpha: 0.5 });
    lightShaft(g, shaft, { alpha: 0.04, t });
    dustMotes(g, t, { shafts: [shaft], count: 70, seed: 19 });
  }

  // ------------------------------------------------------------------ 8: he looks back from the door
  private door(c: Ctx, g: Ctx, f: Frame, q: number) {
    const t = f.t, T = this.T, step = seatAt(DOOR_STEP[0], DOOR_STEP[1]);
    // (the camera is on where his face will be, when he has stopped)
    const cam: RoomCam = { zoom: 4.2 * (1 + 0.045 * prog(q, this.cuts[4]!, T.end)), at: [step.x, step.y - 557 * 1.05 * step.scale], to: [690, 392] };
    c.save(); place(c, cam); afterClass(c, t, this.now(f)); c.restore();
    roomRows(c, cam, t, [], { rows: [3] });
    // he walks to the door, stops on 回, and looks back over his shoulder: the smile, his head a little to one side
    const left = 1.3 * (1 - ease.outQuad(prog(q, T.stop - 1.9, T.stop))), turn = ease.inOutCubic(prog(q, T.stop, T.turned)), at = seatAt(DOOR_STEP[0] + STRIDE * left, DOOR_STEP[1]);
    c.save(); place(c, cam);
    // (he turns a little with it, so that it is her he is smiling at: we are looking over her shoulder)
    const he = (x: Ctx, silhouette?: string) => drawBoy(x, { from: 'walk', to: 'turn-smile', k: 1 - smoothstep(0, 0.3, left) }, { x: at.x, y: at.y, scale: at.scale, facing: at.facing - 270 + 34 * turn, t, walk: -left, k: turn, headTurn: 12 * turn, tilt: 5 * turn, outfit: 'autumn', bag: true, blush: 0.5 + 0.3 * turn, light: [-0.85, -0.4], shadow: silhouette ? 0 : 0.7, silhouette });
    const a = he(c);
    c.restore();
    const [dx, dy] = onScreen(cam, DOORWAY), [hx, hy] = onScreen(cam, a.head);
    // the line, large and soft, in the light the doorway throws along the wall; 笑 gets its sparkle
    const how: LyricOpts = { x: 0, y: 0, size: 100, weight: 400, path: (_u, k) => (k < 5 ? { x: 1340 + k * 100, y: 300 } : { x: 1390 + (k - 5) * 100, y: 300 + 140 }) };
    const chars = drawLyric(c, this.L[7]!, t, how);
    glow(g, 1540, 370, 600, { alpha: 0.2 });
    const xiao = chars[chars.length - 1];
    if (xiao && xiao.since > 0) {
      const pop = Math.sin(Math.PI * clamp(xiao.since / 0.7)) ** 0.7;
      sparkle(g, xiao.x + 60, xiao.y - 62, 36, pop, { rot: 0.3 * xiao.since }); sparkle(g, xiao.x + 88, xiao.y - 22, 17, Math.sin(Math.PI * clamp((xiao.since - 0.12) / 0.6)), { rot: 0.5 });
    }
    // her, close to the camera and out of focus: it is over her shoulder that we see him
    soft(c, 9, (b) => { drawGirl(b, 'stand', { x: 1730, y: 900 + 557 * 3, scale: 3, facing: 197, t, outfit: 'autumn', bag: false, headTurn: 14, wind: 0.05, light: [-0.8, -0.5] }); }, { haze: 0.14, hazeColor: mix('ink', 'peach', 0.3) });
    // the light of the doorway, the sun flaring behind him as he turns; and from his smile it swells until it has
    // washed the frame: the warm light chorus 1 starts in (VERSE1_WASH)
    const leak = clamp((q - T.smile) / (T.end - 0.1 - T.smile)) ** 1.8;
    g.save(); place(g, cam); doorLight(g, 0.24); g.restore();
    glow(g, dx, dy, 760 + 2400 * leak, { alpha: 0.42 + 0.58 * leak });
    shade(g, (x) => { drawLyric(x, this.L[7]!, t, { ...how, alpha: 0.6 }); x.globalAlpha *= 1 - leak; place(x, cam); he(x, SHADE); });
    sparkle(g, hx - 84, hy - 104, 210 * (0.4 + 0.6 * turn), 0.5 * turn + 0.5 * leak, { rot: 0.2 });
    dustMotes(g, t, { count: 50, seed: 23, alpha: 0.8 });
    lightLeak(g, leak, { from: Math.PI * 0.96, t, ...VERSE1_WASH });
    const flat = smoothstep(0.3, 1, leak);
    if (flat > 0) { c.fillStyle = rgba(VERSE1_WASH.under, flat); c.fillRect(0, 0, W, H); }
    this.light = 2.2 * (1 - smoothstep(0.2, 0.95, leak));
  }

  override dispose() { this.stage.dispose(); }
}

/** The dust that comes off the chalk as each character is written: small puffs that spread and fall (in the space the line was drawn in). */
function chalkOff(c: Ctx, chars: LyricChar[]) {
  for (const ch of chars) {
    if (!ch.word || ch.since <= 0 || ch.since > 1.8) continue;
    const size = ch.size, took = clamp(ch.word.end - ch.word.start, 0.12, 0.45);
    for (let j = 0; j < 8; j++) {
      const r = (k: number) => hash(ch.k, j, k), age = ch.since - (j / 8) * took, life = 0.8 + 0.6 * r(1);
      if (age <= 0 || age >= life) continue;
      const u = age / life, along = j / 7 - 0.5, push = 1 - Math.exp(-2.4 * age);
      disc(c, ch.x + (along * 0.62 + (r(2) - 0.5) * 0.5 * push) * size, ch.y + (along * 0.5 + 0.12 + (0.25 + 0.4 * r(3)) * age) * size, lerp(0.03, 0.1, u) * (0.6 + 0.8 * r(4)) * size, rgba('paper', 0.5 * (1 - u) ** 1.6 * Math.min(1, age * 9)));
    }
  }
}
