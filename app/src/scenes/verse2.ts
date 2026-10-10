// VERSE 2 — 走廊风吹得好吵 → 我记的却是你眼睛在闪: winter, a wind in the corridor, and his scarf still in her pocket.
//   1  走廊风吹得好吵        the frost goes back from the glass chorus 1 ended on (CHORUS1_FROST): it is a window of the
//                           corridor, and the picture goes back from it and along to her, walking into the wind: the
//                           notices flap on their board, paper goes by; the wind brings the line, a character at a time
//   2  你的围巾还在我外套     her coat pocket, close: the end of his scarf looks out of it and streams in the wind, the
//                           line in small handwriting along it; her hand goes to it, and it is warm
//   3  你问我怎么还不还       the two of them: he has come back for her, and points at it, a "?" by his head; the line is
//                           what he says, in a speech bubble
//   4  我说明天怕你会忘带     she looks away, her cheeks colour, and she answers (her bubble); what she thinks is a doodle
//                           in a thought bubble: the two of them at the gate tomorrow, the scarf round his neck again
//   5  楼梯口人好多          the stairs from below: everybody is on the way down, a river of them, and the two apart in
//                           it; the line down the wall of the stairwell
//   6  我们却刚好走成并排     the others hurry, part round the two and blur; the two come together, in step and side by
//                           side, and on the downbeat the picture is still and symmetrical: half the line over her,
//                           half over him
//   7  你讲老师的新笑话       out of the door into the dusk, still side by side: he talks with both hands, and his joke is
//                           in the air in chalk (the teacher at the board, a squiggle, a "!"); she laughs
//   8  我记的却是你眼睛在闪   all of that goes: the picture closes on his eyes, gold sparkles open in them, and on 闪 they
//                           leave, drift apart, and are the four lamps of an evening street (VERSE2_LAMPS: chorus 2)
// Five pictures (3 + 4, 5 + 6 and 7 + 8 are one shot each), a soft cross-dissolve between them. Everything is timed
// from the lines themselves, found by content, and from the beat grid: `q` counts beats from the cut.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, mod, prog, smoothstep, TAU } from '../engine/util';
import {
  Stage, VERSE2_LAMPS, drawBoy, drawGirl, drawLyric, glow, layer, paperScraps, scratch, snow, sparkle,
  type Anchors, type Cam, type Ctx, type LyricOpts, type PoseArg, type V2,
} from './_love';
import { FLOOR, S, seen } from './chorus-sets';
import {
  DUSK, ON_GLASS, REST, aim, chalked, drawBubble, drawCorridor, drawPocket, drawScarfEnd, drawStairs, drawWalker, drawYard, onStairs, ring, sketch,
  type Walker,
} from './verse2-sets';

/** How hard it blows along the corridor (the kit's wind, well past its 1: to the left), and how far a beat takes her into it: a step. */
const WIND = -2.2, STEP = 0.5 * 232 * S;
/** Along the corridor (x): where she is at the cut, and where the two of them stand once he has come back for her. */
const HER_X = 700, HER_AT = 1200, HIM_AT = 1456;
/** The bubbles over the two of them (the frame's own px): what he says, what she says, what she thinks. */
const HIS = { x: 1420, y: 178, w: 520, h: 204 }, HERS = { x: 540, y: 190, w: 470, h: 204 }, THOUGHT = { x: 1016, y: 160, w: 340, h: 196 };
/**
 * The stairs: a step a beat (they are crowded); the picture falls in with the two over EASE beats; the crowd, which
 * hurries to 1 + RUSH times that, is CROWD strong between TOP and FOOT steps above the picture's line; and the two
 * who are between the two of them at first (across the stairs, and steps above them) are off first, LEAD times as fast.
 */
const PACE = 1, EASE = 1.4, RUSH = 3.4, CROWD = 24, TOP = 22, FOOT = -4.5, LEAD = 8;
const BETWEEN: V2[] = [[-0.07, 0.7], [0.06, 1.4]];
/** Side by side: how far each of the two is from the middle of the stairs (of half their width). */
const APART = 0.146;
/** Her doodle of tomorrow (in units of its size): the gate, the two of them in it; and, in rose, the scarf round his neck. */
const TOMORROW: V2[][] = [
  [[-1.25, 0.72], [1.25, 0.72]],
  [[-0.98, 0.72], [-0.98, -0.62], [-0.74, -0.62], [-0.74, 0.72]], [[0.98, 0.72], [0.98, -0.62], [0.74, -0.62], [0.74, 0.72]], [[-0.86, -0.62], [-0.5, -0.92], [0.5, -0.92], [0.86, -0.62]],
  ring(-0.24, -0.1, 0.15), [[-0.24, 0.06], [-0.44, 0.6], [-0.04, 0.6], [-0.24, 0.06]],             // her: a head, a skirt (as in her margin doodle)
  ring(0.28, -0.18, 0.15), [[0.28, -0.02], [0.28, 0.34]], [[0.17, 0.62], [0.28, 0.34], [0.39, 0.62]],   // him: a head, a body, legs
];
const TOMORROW_SCARF: V2[][] = [[[0.14, 0.01], [0.42, 0.01]], [[0.37, 0.02], [0.41, 0.24]]];
/** His joke, in chalk: the teacher at the board, a squiggle, a "!"; and what her laugh looks like. */
const TEACHER: V2[][] = [
  [[0.52, -0.98], [1.36, -0.98], [1.36, -0.34], [0.52, -0.34], [0.52, -0.98]],
  ring(0, -0.64, 0.2), ring(-0.09, -0.65, 0.07, 8), ring(0.1, -0.65, 0.07, 8),
  [[0, -0.44], [0, 0.2]], [[-0.2, 0.64], [0, 0.2], [0.2, 0.64]],
  [[0, -0.28], [-0.26, -0.06]], [[0, -0.28], [0.3, -0.42], [0.62, -0.66]],
  [[0.64, -0.8], [0.76, -0.62], [0.88, -0.82], [1, -0.6], [1.12, -0.8], [1.24, -0.62]],
];
const SQUIGGLE: V2[][] = [Array.from({ length: 30 }, (_, i): V2 => { const u = i / 29, a = u * TAU * 2.6, r = 0.15 + 0.85 * u; return [r * Math.cos(a), r * Math.sin(a) * 0.8]; })];
const BANG: V2[][] = [[[0, -0.8], [0.03, -0.3], [0.05, 0.2]], ring(0.06, 0.55, 0.06, 8)];
const HAHA: V2[][] = [[[-0.2, -0.5], [-0.75, -0.9]], [[-0.4, -0.05], [-1, -0.1]], [[-0.25, 0.4], [-0.8, 0.75]]];
const CHALK = rgba('paper', 0.92);
const sine = ease.inOutSine;
/** How far something has got by q whose speed goes from 0 to 1 between a and b (beats). */
const ramp = (q: number, a: number, b: number) => { const u = clamp((q - a) / (b - a)); return (b - a) * (u ** 3 - u ** 4 / 2) + Math.max(0, q - b); };
/**
 * Keep the light off something: what `paint` draws (a line of the lyrics) is cut out of the light already on `g`.
 * A window, or the warmth under her hand, must not wash a line out.
 */
const shade = (g: Ctx, paint: (g: Ctx) => void) => { g.save(); g.globalCompositeOperation = 'destination-out'; paint(g); g.restore(); };

type Picture = (c: Ctx, g: Ctx, t: number, q: number) => void;

export default class Verse2 extends Scene {
  private stage = new Stage(this.ctx);
  /** The beat of the cut, and the eight lines. */
  private b0 = 0;
  private L: Line[] = [];
  /** The changes of picture (the middle of each dissolve, and half its length), and what happens inside the pictures: all in beats from the cut. */
  private cuts: { at: number; half: number }[] = [];
  private T = {
    thaw: [0, 0], back: [0, 0], reach: [0, 0], come: [0, 0], point: [0, 0], ask: 0, says: [0, 0], away: [0, 0], answers: [0, 0], thinks: 0, draws: [0, 0],
    sync: 0, lead: [0, 0], rush: [0, 0], close: [0, 0], joke: [0, 0, 0], laugh: 0, push: [0, 0], gone: [0, 0], eyes: 0, flash: 0, go: [0, 0], face: [0, 0], end: 0,
  };
  /** How bright the light layer is added this frame: 2.2 as everywhere, but for the first frames (CHORUS1_FROST has none). */
  private light = 2.2;
  private pictures: Picture[] = [
    (c, g, t, q) => this.corridor(c, g, t, q), (c, g, t, q) => this.pocket(c, g, t, q), (c, g, t, q) => this.two(c, g, t, q),
    (c, g, t, q) => this.stairs(c, g, t, q), (c, g, t, q) => this.dusk(c, g, t, q),
  ];

  override init() {
    const { audio, lyrics } = this.ctx;
    this.b0 = Math.round(audio.beatAt(this.ctx.start));
    const q = (t: number) => audio.beatAt(t) - this.b0;
    const L = (this.L = ['走廊风吹得好吵', '你的围巾还在我外套', '你问我怎么还不还', '我说明天怕你会忘带', '楼梯口人好多', '我们却刚好走成并排', '你讲老师的新笑话', '我记的却是你眼睛在闪'].map((s) => lyrics.get(s)));
    const from = (i: number) => q(L[i]!.start), to = (i: number) => q(L[i]!.end), sung = (i: number, ch: number) => q(L[i]!.words[ch]!.start);
    // the pictures change as line 2 starts, between lines 2 and 3, 4 and 5, 6 and 7
    const pocket = from(1) - 0.05, two = (to(1) + from(2)) / 2, stairs = (to(3) + from(4)) / 2, dusk = (to(5) + from(6)) / 2, end = q(this.ctx.end);
    this.cuts = [{ at: pocket, half: 0.3 }, { at: two, half: 0.3 }, { at: stairs, half: 0.4 }, { at: dusk, half: 0.3 }];
    // (the downbeat inside line 6: where the two are side by side)
    const sync = q(audio.downbeats.find((d) => d > L[5]!.start + 0.05) ?? L[5]!.words[4]!.start);
    this.T = {
      // 1: the frost goes back at once, and the picture with it
      thaw: [0, 0.95], back: [0.12, 1.85],
      // 2: her hand is on its way from 还, and on the scarf by 外套
      reach: [sung(1, 4) - 0.35, sung(1, 7) - 0.05],
      // 3: he is there as the picture comes; he points on 怎么, and the "?" pops on 还; his bubble is open before he is heard
      come: [two - 0.3, from(2) + 0.15], point: [sung(2, 3) - 0.25, to(2) + 0.05], ask: sung(2, 5) - 0.05, says: [from(2) - 0.62, from(2) - 0.2],
      // 4: she looks away as his line ends; her bubble, then (on 明天) what she thinks, drawn until 忘
      away: [to(2) - 0.45, from(3) - 0.05], answers: [from(3) - 0.6, from(3) - 0.2], thinks: sung(3, 2) - 0.45, draws: [sung(3, 2) - 0.05, sung(3, 7) + 0.3],
      // 5, 6: the three between them are off as line 5 ends, and everybody after them as line 6 starts; the two close up, and are side by side on the downbeat
      sync, lead: [to(4) - 1.25, to(4) - 0.45], rush: [from(5) - 0.15, sync + 0.4], close: [sync - 1.55, sync - 0.05],
      // 7: the teacher is drawn on 老师, the squiggle on 新, the "!" on 笑, and she laughs
      joke: [sung(6, 2) - 0.1, sung(6, 5) - 0.1, sung(6, 6) - 0.05], laugh: sung(6, 6) + 0.1,
      // 8: the picture closes on his eyes by 眼, and all the rest is gone by 你; the sparkles open on 眼睛, flare on 闪, and leave for the street; his face goes after them
      push: [from(7) - 0.15, sung(7, 6) - 0.05], gone: [from(7) - 0.05, sung(7, 5)], eyes: sung(7, 6), flash: sung(7, 9), go: [sung(7, 9) + 0.25, end - 0.12], face: [sung(7, 9) + 0.4, end - 0.3],
      end,
    };
  }

  /** The time of a beat counted from the cut. */
  private at(beat: number) { return this.ctx.audio.timeOfBeat(this.b0 + beat); }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { c, g } = this.stage.begin(), q = f.beat - this.b0, cuts = this.cuts;
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
    this.stage.end(out, { light: this.light });
  }

  /** A line of the lyrics on the picture, kept clear of the light. Returns its characters as drawn. */
  private say(c: Ctx, g: Ctx, line: Line, t: number, how: LyricOpts) {
    const chars = drawLyric(c, line, t, how);
    if (chars.length) shade(g, (x) => { drawLyric(x, line, t, how); });
    return chars;
  }

  // ------------------------------------------------------------------ 1: the corridor, the wind
  private corridor(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, back = sine(prog(q, T.back[0]!, T.back[1]!)), xh = HER_X + STEP * q;
    // the camera: on the glass chorus 1 ended on; back from it and along to her; then with her, a little closer
    const zoom = Math.exp(lerp(Math.log(ON_GLASS.zoom!), 0, back)) * (1 + 0.035 * prog(q, T.back[1]!, this.cuts[0]!.at));
    const cam: Cam = { zoom, x: lerp(ON_GLASS.x!, xh - 400 - W / 2, back), y: lerp(ON_GLASS.y!, 0, back) };
    drawCorridor(c, g, {
      t, cam, frost: lerp(1, REST, sine(prog(q, T.thaw[0]!, T.thaw[1]!))), wind: WIND, lit: smoothstep(0, 0.8, q),
      // her: into the wind, her head down, a step a beat; the end of his scarf at her pocket
      who: (x, flat) => {
        const her = drawGirl(x, 'walk', { x: xh, y: FLOOR + 12, scale: S, facing: 90, t, walk: 0.5 * q, outfit: 'winter', wind: WIND, nod: 9, smile: 0.15, blush: 0.65, shadow: flat ? 0 : 0.6, silhouette: flat });
        if (!flat) drawScarfEnd(x, her.pocket, her.scale, t, WIND / 2);
      },
    });
    paperScraps(c, t, { count: 11, wind: -2.5, seed: 5, alpha: smoothstep(0.1, 1, q) });
    this.light = 2.2 * smoothstep(0, 0.7, q);
    // the line: the wind brings it in from the right, a character at a time, each in its place as it starts being sung
    this.say(c, g, this.L[0]!, t, {
      x: 0, y: 0, size: 94, until: this.at(this.cuts[0]!.at + this.cuts[0]!.half), path: (_u, k) => ({ x: 648 + 104 * k, y: 178 }),
      each: (ch) => {
        if (ch.since < 0) {
          // (on its way, turning over; nothing of it before the cut)
          const u = clamp(1 + ch.since / 0.42), e = ease.outCubic(u), r = (k: number) => hash(ch.k, 31, k);
          ch.x += (1 - e) * (760 + 240 * r(1)); ch.y += (1 - e) * (120 * r(2) - 40) + 30 * (1 - u) * Math.sin(u * 5 + ch.k);
          ch.angle = (1 - e) * (1.2 + 1.4 * r(3)); ch.scale = lerp(0.8, 1, e); ch.alpha = smoothstep(0, 0.3, u) * smoothstep(0, 0.25, q);
        } else {
          // (it rocks once and is still, but for the wind)
          const d = Math.exp(-5 * ch.since);
          ch.x -= 16 * d * Math.sin(ch.since * 15); ch.angle = -0.16 * d * Math.sin(ch.since * 13) + 0.025 * Math.sin(t * 3.1 + ch.k * 1.3);
        }
      },
    });
  }

  // ------------------------------------------------------------------ 2: her coat pocket
  private pocket(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, slow = prog(q, this.cuts[0]!.at - 0.3, this.cuts[1]!.at + 0.3), line = this.L[1]!, reach = sine(prog(q, T.reach[0]!, T.reach[1]!));
    drawPocket(c, g, {
      t, cam: aim(1 + 0.05 * slow, [1010 - 22 * slow, 548]), wind: -1, warm: sine(prog(q, T.reach[1]! - 0.15, T.reach[1]! + 0.9)),
      // her, from the chest to the knee, half turned to us: her hand goes to the pocket
      her: (x) => {
        const a = drawGirl(x, 'pocket', { x: 1215, y: 2012, scale: 4.6, facing: 50, t, k: reach, outfit: 'winter', wind: -1.6 });
        return { pocket: a.pocket, hand: a.handR, scale: a.scale };
      },
      // the line, small, in her handwriting, along the scarf
      along: (x, at) => {
        const how: LyricOpts = { x: 0, y: 0, size: 58, style: 'hand', path: (_u, k, n) => at(k / (n - 1)) };
        drawLyric(x, line, t, how);
        shade(g, (y) => { y.setTransform(x.getTransform()); drawLyric(y, line, t, how); });
      },
    });
  }

  // ------------------------------------------------------------------ 3, 4: he asks; she answers
  private two(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, L = this.L, slow = sine(prog(q, this.cuts[1]!.at, this.cuts[2]!.at));
    const cam = aim(lerp(1.64, 1.76, slow), [lerp(1340, 1304, slow), lerp(476, 468, slow)]);
    // him: the last steps of his way back to her; he points at her pocket, and straightens up again when she answers
    const come = 1 - ease.outCubic(prog(q, T.come[0]!, T.come[1]!)), xb = HIM_AT + 210 * come;
    const point = sine(prog(q, T.point[0]!, T.point[0]! + 0.5)) * (1 - sine(prog(q, T.point[1]!, T.point[1]! + 0.6)));
    // her: her eyes go down to the pocket with his finger; then she looks away from him, toward us, and her cheeks colour
    const away = sine(prog(q, T.away[0]!, T.away[1]!));
    let her!: Anchors, him!: Anchors;
    drawCorridor(c, g, {
      t, cam, frost: REST, wind: -0.8, lit: 0.8,
      who: (x, flat) => {
        const b = drawBoy(x, { from: 'point', to: 'walk', k: clamp(come * 4) }, {
          x: xb, y: FLOOR, scale: S, facing: -90, t, walk: -xb / (232 * S * 1.05), k: point, outfit: 'winter', scarf: false, wind: -0.8,
          nod: -4 * away, tilt: 5 * away, smile: 0.35 + 0.13 * away, blush: 0.4, shadow: flat ? 0 : 0.6, silhouette: flat,
        });
        const a = drawGirl(x, 'stand', {
          x: HER_AT, y: FLOOR + 12, scale: S, facing: 90, t, outfit: 'winter', wind: -0.8,
          headTurn: -74 * away, nod: 3 + 10 * point * (1 - away) + 7 * away, smile: 0.2 + 0.3 * away, blush: lerp(0.4, 1, ease.outBack(prog(q, T.away[0]! + 0.15, T.away[1]!))), shadow: flat ? 0 : 0.6, silhouette: flat,
        });
        if (flat) return;
        him = b; her = a;
        drawScarfEnd(x, her.pocket, her.scale, t, -0.5);
      },
    });
    /** A bubble, on the picture and clear of the windows' light. */
    const bubble = (o: Parameters<typeof drawBubble>[1]) => { drawBubble(c, o); shade(g, (x) => { drawBubble(x, o); }); };
    // the "?" by his head
    const ask = prog(q, T.ask, T.ask + 0.4) * (1 - prog(q, T.away[0]! - 0.2, T.away[0]! + 0.2));
    if (ask > 0.003) {
      const [ax, ay] = seen(cam, [him.top[0] - 58, him.top[1] + 2]), s = ease.outBack(clamp(ask), 2.6);
      c.save(); c.translate(ax, ay); c.rotate(-0.2 + 0.07 * Math.sin(t * 5)); c.scale(s, s); c.globalAlpha *= clamp(ask * 3);
      c.fillStyle = rgba('ink', 0.09); c.beginPath(); c.arc(4, 9, 44, 0, TAU); c.fill();
      c.fillStyle = rgba('paper'); c.beginPath(); c.arc(0, 0, 44, 0, TAU); c.fill();
      c.font = font(F.hand(500), 66); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = rgba('ink', 0.85); c.fillText('?', 0, 23);
      c.restore();
    }
    // what he says: 你问我 / 怎么还不还. It goes as she starts to answer
    const says = prog(q, T.says[0]!, T.says[1]!), said = 1 - prog(q, T.answers[0]! - 0.25, T.answers[0]! + 0.1);
    bubble({ ...HIS, to: seen(cam, him.head), k: says, alpha: said });
    drawLyric(c, L[2]!, t, {
      x: 0, y: 0, size: 70, alpha: says * says * said, until: this.at(T.answers[0]! + 0.1),
      path: (_u, k) => (k < 3 ? { x: HIS.x + (k - 1) * 76, y: HIS.y - 45 } : { x: HIS.x + (k - 5) * 76, y: HIS.y + 45 }),
    });
    // what she says: 我说明天 / 怕你会忘带; and what she thinks: tomorrow, at the gate, drawn as she sings it
    const answers = prog(q, T.answers[0]!, T.answers[1]!), thinks = prog(q, T.thinks, T.thinks + 0.45);
    bubble({ ...HERS, to: seen(cam, her.head), k: answers });
    drawLyric(c, L[3]!, t, {
      x: 0, y: 0, size: 70, alpha: answers * answers,
      path: (_u, k) => (k < 4 ? { x: HERS.x + (k - 1.5) * 76, y: HERS.y - 45 } : { x: HERS.x + (k - 6) * 76, y: HERS.y + 45 }),
    });
    bubble({ ...THOUGHT, to: seen(cam, [her.top[0] + 4, her.top[1] - 2]), k: thinks, think: true });
    if (thinks > 0.6) {
      sketch(c, TOMORROW, THOUGHT.x, THOUGHT.y + 12, 74, prog(q, T.draws[0]!, T.draws[1]!), { seed: 3 });
      sketch(c, TOMORROW_SCARF, THOUGHT.x, THOUGHT.y + 12, 74, prog(q, T.draws[1]! - 0.05, T.draws[1]! + 0.4), { seed: 4, color: rgba('rose'), width: 6.5 });
    }
  }

  // ------------------------------------------------------------------ 5, 6: the stairs
  /** How far the picture has gone down the stairs (steps): it stands, falls in with the two, and from the downbeat goes at their pace. */
  private ride(q: number) { return PACE * ramp(q, this.T.sync - EASE, this.T.sync); }
  /** How far up the stairs from the picture's line the two still are (steps): they come down to it, and are on it from the downbeat on. */
  private above(q: number) { return this.ride(q) - PACE * (q - this.T.sync + EASE / 2); }
  /**
   * The others on the stairs, the farthest first: where each is, and `j`, how many steps up from the picture's line.
   * They go at their own pace, and from line 6 on in a hurry. Nobody walks through the two (`lo`..`hi`: where the
   * two are across the stairs): whoever is not well behind them keeps to one side of them.
   */
  private crowd(q: number, j2: number, lo: number, hi: number): (Walker & { j: number })[] {
    const T = this.T, far = PACE * (q + RUSH * ramp(q, T.rush[0]!, T.rush[1]!)), ride = this.ride(q), out: (Walker & { j: number })[] = [];
    const rate = PACE * (1 + RUSH * smoothstep(T.rush[0]!, T.rush[1]!, q)), riding = PACE * smoothstep(T.sync - EASE, T.sync, q), blur = (v: number, k: number) => Math.max(0, v - riding - 1.3) * 29 * k;
    for (let i = 0; i < CROWD; i++) {
      const r = (k: number) => hash(i, 77, k), pace = lerp(0.85, 1.2, r(1)), j = TOP - mod(r(2) * (TOP - FOOT) + pace * far - ride, TOP - FOOT), near = smoothstep(3.6, 1.4, j - j2);
      let X = lerp(-0.97, 0.97, r(3));
      if (near > 0 && X > lo - 0.2 && X < hi + 0.2) X = lerp(X, X < (lo + hi) / 2 ? lo - 0.2 - 0.12 * r(4) : hi + 0.2 + 0.12 * r(4), near);
      const p = onStairs(X, j);
      out.push({ ...p, j, boy: r(5) < 0.5, walk: 0.5 * pace * far + r(6), alpha: clamp((TOP - j) / 4) * clamp(j - FOOT) * lerp(1, 0.5, clamp(j / TOP)), streak: blur(pace * rate, p.k) });
    }
    BETWEEN.forEach(([X, dj], i) => {
      const off = LEAD * ramp(q, T.lead[0]!, T.lead[1]!), j = j2 + dj! - off, p = onStairs(X!, j);
      if (j > FOOT) out.push({ ...p, j, boy: i === 0, walk: 0.5 * (PACE * q + off) + 0.3 * i, alpha: clamp(j - FOOT), streak: blur(PACE + LEAD * smoothstep(T.lead[0]!, T.lead[1]!, q), p.k) });
    });
    return out.sort((a, z) => z.j - a.j);
  }
  private stairs(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, L = this.L, j2 = this.above(q), close = sine(prog(q, T.close[0]!, T.close[1]!)), Xh = lerp(-0.45, -APART, close), Xb = lerp(0.48, APART, close);
    drawStairs(c, g, { t, ride: this.ride(q) });
    // the others: behind the two; about them; and close to the lens, out of focus
    const all = this.crowd(q, j2, Xh, Xb), group = (blur: number, which: (j: number) => boolean) => { const some = all.filter((w) => which(w.j)); if (some.length) layer(c, { blur }, (x) => { for (const w of some) drawWalker(x, w); }); };
    group(2.4, (j) => j > j2 + 0.05);
    // the two, sharp: apart, their eyes on the steps; then side by side and in step, and they look at each other
    const a = onStairs(Xh, j2), b = onStairs(Xb, j2), w = 0.5 * PACE * q, glance = sine(prog(q, T.sync - 0.15, T.sync + 0.9)), glad = sine(prog(q, T.sync + 0.7, T.sync + 1.5));
    const her = drawGirl(c, 'walk', { x: a.x, y: a.y, scale: a.k, facing: 0, t, walk: w, outfit: 'winter', wind: -0.25, headTurn: 22 * glance, nod: 8 * (1 - glance), smile: 0.25 + 0.2 * glance + 0.35 * glad, blush: 0.5 + 0.5 * glance, shadow: 0.5 });
    drawScarfEnd(c, her.pocket, her.scale, t, -0.25);
    drawBoy(c, 'walk', { x: b.x, y: b.y, scale: b.k, facing: 0, t, walk: w + 0.3 * (1 - close), outfit: 'winter', scarf: false, wind: -0.25, headTurn: -22 * glance, nod: 8 * (1 - glance), smile: 0.3 + 0.18 * glance, blush: 0.4 + 0.3 * glance, shadow: 0.5 });
    group(2.4, (j) => j <= j2 + 0.05 && j > j2 - 2.5);
    group(6, (j) => j <= j2 - 2.5);
    // 5: in her handwriting down the wall of the stairwell; 6: half of it over her and half over him
    this.say(c, g, L[4]!, t, { x: 0, y: 0, size: 92, style: 'hand', until: this.at(T.sync + 0.5), path: (_u, k) => ({ x: 196, y: 190 + 104 * k }) });
    this.say(c, g, L[5]!, t, { x: 0, y: 0, size: 84, path: (_u, k) => (k < 5 ? { x: W / 2 - 250 + (k - 2) * 86, y: 224 } : { x: W / 2 + 250 + (k - 6.5) * 86, y: 224 }) });
  }

  // ------------------------------------------------------------------ 7, 8: his joke; his eyes
  private dusk(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, L = this.L, from = this.cuts[3]!.at;
    // (the two are where the stairs left them: side by side on the picture's line)
    const her: V2 = [onStairs(-APART, 0).x, onStairs(0, 0).y], his: V2 = [onStairs(APART, 0).x, her[1]], eyes: V2 = [his[0] - 4, his[1] - 573];
    // the camera: as on the stairs; closer, on the two of them; then all the way in on his eyes
    const near = sine(prog(q, from - 0.3, T.push[0]!)), close = sine(prog(q, T.push[0]!, T.push[1]!));
    const zoom = Math.exp(lerp(lerp(0, Math.log(1.5), near), Math.log(7), close));
    const cam = aim(zoom, [lerp(W / 2, eyes[0], close), lerp(lerp(H / 2, 430, near), eyes[1], close)], [lerp(W / 2, 1210, close), lerp(H / 2, 520, Math.max(near, close))]);
    const there = 1 - sine(prog(q, T.gone[0]!, T.gone[1]!)), go = sine(prog(q, T.go[0]!, T.go[1]!)), face = 1 - sine(prog(q, T.face[0]!, T.face[1]!));
    drawYard(c, { t, cam, late: smoothstep(from, T.eyes, q), there });
    // (they walk on as they came down the stairs, at an easier pace now: two steps a beat)
    const w = 0.5 * PACE * from + (q - from), laugh = sine(prog(q, T.laugh, T.laugh + 0.3)), hop = laugh * Math.abs(Math.sin(TAU * (q - T.laugh))) * Math.exp(-0.9 * Math.max(0, q - T.laugh));
    // her: she listens, and laughs
    if (there > 0.003) layer(c, { cam, alpha: there, haze: 0.1, hazeColor: DUSK }, (x) => {
      const a = drawGirl(x, 'walk', { x: her[0], y: her[1] - 7 * hop, scale: 1, facing: 0, t, walk: w, outfit: 'winter', wind: -0.3, light: null, headTurn: 26, tilt: 5 * laugh, nod: -5 * laugh, smile: lerp(0.45, 1, laugh), blush: 0.7, shadow: 0.5 });
      drawScarfEnd(x, a.pocket, a.scale, t, -0.3);
    });
    // him: he talks with both hands, to her; then he is still, and it is us he looks at
    const talk = sine(prog(q, from - 0.2, from + 0.5)) * (1 - sine(prog(q, T.push[0]! - 0.6, T.push[0]!)));
    const pose: PoseArg = close > 0 ? { from: 'walk', to: 'stand', k: close } : { from: 'walk', to: 'talk', k: talk };
    const got: { him?: Anchors } = {};
    if (go < 1) layer(c, { cam, alpha: face, haze: 0.1, hazeColor: DUSK }, (x) => {
      got.him = drawBoy(x, pose, { x: his[0], y: his[1], scale: 1, facing: 0, t, walk: w, outfit: 'winter', scarf: false, wind: -0.3, light: null, headTurn: lerp(-28, -5, close), tilt: 3 * close, smile: lerp(0.6, 0.85, close), openEyes: true, blush: 0.5 + 0.2 * close, shadow: 0.5 * there });
    });
    snow(c, t, { count: 34, wind: -0.5, alpha: 0.6 * there, seed: 9 });
    // 7: his joke, in the air in chalk: the line, and what it is about; her laugh
    const air = 1 - sine(prog(q, T.push[0]! - 0.1, T.push[0]! + 0.5));
    if (air > 0.003) {
      const boil = Math.floor(frameIdx(t) / 9), [hx, hy] = seen(cam, [her[0] - 70, her[1] - 570]);
      c.save(); c.globalAlpha = air;
      drawLyric(c, L[6]!, t, { x: W / 2, y: 150, size: 88, style: 'chalk' });
      chalked(c, (x) => {
        sketch(x, TEACHER, 300, 322, 150, prog(q, T.joke[0]!, T.joke[0]! + 1.2), { color: CHALK, width: 5.5, seed: 11, boil });
        sketch(x, SQUIGGLE, 1520, 250, 74, prog(q, T.joke[1]!, T.joke[1]! + 0.5), { color: CHALK, width: 5.5, seed: 12, boil });
        sketch(x, BANG, 1668, 300, 104, ease.outBack(prog(q, T.joke[2]!, T.joke[2]! + 0.3)), { color: CHALK, width: 8, seed: 13, boil });
        sketch(x, HAHA, hx, hy, 50, prog(q, T.laugh, T.laugh + 0.25), { color: CHALK, width: 5, seed: 14, boil });
      });
      c.restore();
    }
    // 8: beside his face, glowing softly; 闪 sparkles
    const how: LyricOpts = { x: 0, y: 0, size: 94, dark: true, until: this.at(T.end - 0.08), path: (_u, k) => ({ x: 232 + 104 * (k % 5), y: k < 5 ? 430 : 572 }) };
    const chars = drawLyric(c, L[7]!, t, how), shan = chars[chars.length - 1];
    drawLyric(g, L[7]!, t, { ...how, alpha: 0.2 });
    if (shan && shan.since > 0) for (let i = 0; i < 5; i++) {
      const u = clamp((shan.since - 0.08 * i) / 0.7);
      sparkle(g, shan.x + 34 + 64 * hash(i, 5), shan.y + 30 - 110 * hash(i, 6), 14 + 22 * hash(i, 7), Math.sin(Math.PI * u) ** 0.7, { rot: i + shan.since });
    }
    // his eyes: a sparkle opens in each on 眼睛, and a smaller one on 闪, when they flare; then the four of them leave,
    // drift apart, and are the lamps of the street chorus 2 starts in (VERSE2_LAMPS)
    const open = sine(prog(q, T.eyes, T.eyes + 0.7)), flash = prog(q, T.flash, T.flash + 0.5), flare = Math.sin(Math.PI * flash) ** 0.8, lit = smoothstep(0.3, 1, go);
    if (open <= 0) return;
    const seenEyes = got.him ? got.him.eyes.map((p) => seen(cam, p)).sort((a, z) => a[0] - z[0]) : [[0, 0], [0, 0]];
    VERSE2_LAMPS.at.forEach((lamp, i) => {
      const main = i === 1 || i === 2, eye = seenEyes[i < 2 ? 0 : 1]!, sx = eye[0] + (main ? -1 : 1.1) * zoom, sy = eye[1] + (main ? -1.6 : 1.5) * zoom;
      const x = lerp(sx, lamp[0], go), y = lerp(sy, lamp[1], go) - (main ? 70 : 36) * Math.sin(Math.PI * go), born = main ? open : clamp(flash * 2.5);
      sparkle(g, x, y, (main ? 4.3 : 2.4) * zoom * (1 + 0.6 * flare) * lerp(1, 1.8, go), born * (1 - smoothstep(0.45, 0.95, go)) * (0.85 + 0.15 * Math.sin(t * 7 + i)), { rot: 0.2 * i + 0.6 * flash + 1.2 * go });
      if (lit > 0) { glow(c, x, y, VERSE2_LAMPS.halo, { alpha: VERSE2_LAMPS.soft * lit }); glow(g, x, y, VERSE2_LAMPS.heart, { alpha: 0.9 * lit }); }
    });
  }

  override dispose() { this.stage.dispose(); }
}
