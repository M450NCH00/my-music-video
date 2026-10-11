// FINALE — the last chorus, 等你下课一起走好不好 → 把喜欢一点一点说出口: it rains, one small umbrella is not enough, he comes
// closer, and at the bus stop, when the rain has stopped, she says it. The colour goes with it: the frost of the rain at
// the gate, a little warmer with every line, and a gold sunset for the last. Four pictures:
//   the gate of the school (the chorus's way home, drawWay), where the bridge's drop of rain has let the rain in (BRIDGE_RAIN):
//     1  等你下课一起走好不好        the gate comes up under the rain. He has no umbrella; she puts hers up, a small clear one,
//                                   and holds it out over him, out in the rain herself; he turns round to her. The line on
//                                   the wet glass the picture is seen through, drops running down through it
//   the small road under the trees in flower, from behind the two (drawLane):
//     2  就算雨下到伞都不够大了      she holds it over both, and it covers neither: the rain lands on her far shoulder and on his
//     3  你靠过来一点我就觉得刚刚好  he comes closer, a little with every step; on 刚 their shoulders meet, it glows where they
//                                   do, the rain on the umbrella glints, and none of it lands on them any more
//   the same road from high above (drawMini):
//     4  把全世界都缩进这条小路      the camera goes up over the umbrella; the world goes soft and draws in to a round drop,
//                                   and in it there is only the little road from the school's gate to the bus stop, the two
//                                   on it, and the dotted path along it; the line goes round the drop. Then the drop falls
//   the bus stop (drawWay again), where it lands:
//     5  等你下课再见一面就好        they stand at the stop under the umbrella, which is in his hand now; the rain eases;
//                                   he turns round to her
//     6  就算只说一句“明天见”也够    his 明天见, in a speech bubble; she smiles
//     7  慢慢走 慢慢讲               the rain stops; the clouds part, and the sun is low between the two of them; the
//                                   water on the pavement shows them both; he shuts the umbrella
//     8  把喜欢一点一点说出口        she takes her bag in her arms and opens the pocket: a paper star comes out of it for each
//                                   character as it is sung, and takes the character up with it; they stand dark against the sun
//   out                           more stars follow, and the camera looks up after them into the sky (FINALE_SKY: where the outro starts)
// Everything is timed from the lines themselves, found by content, and from the beat grid: `q` counts beats from the cut.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H, makeRT } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, keys, lerp, prog, smoothstep, TAU } from '../engine/util';
import {
  Stage, UMBRELLA_CLEAR, drawBag, drawBoy, drawGirl, drawLyric, drawUmbrella, glow, layer, lightLeak, rain, scratch, soundRing, sparkle,
  type Anchors, type Cam, type Ctx, type LyricOpts, type V2,
} from './_love';
import { BRIDGE_RAIN, rainHit, ringAt } from './bridge-sets';
import { GROUND, S, drawWay, inView, seen } from './chorus-sets';
import { LANE, LANE_FLOOR, LANE_SCALE, SPRING, drawGlass, drawLane, drawMini, drawSky, drawStarsUp, drawWet, lookUp, risingOf, skyLow, TILT, type Rising } from './finale-sets';
import { aim, drawBubble, sketch } from './verse2-sets';

const sine = ease.inOutSine;
/** The eight lines: what each starts with, and which singing of it this is. */
const LINES: [string, number][] = [['等你下课一起走好不好', 2], ['就算雨下到伞都不够大了', 0], ['你靠过来一点我就觉得刚刚好', 0], ['把全世界都缩进这条小路', 0], ['等你下课再见一面就好', 2], ['就算只说一句', 0], ['慢慢走', 2], ['把喜欢一点一点说出口', 0]];
/** The two rows the lines take in the sky (y). */
const ROW_A = 136, ROW_B = 230;
/** At the gate (x of the way): where she stands and he, and what the camera is on. */
const GATE = { her: 3205, him: 3380, on: 3290 };
/** At the bus stop (x of the way): where she stands, where he does (beside her, and when he has turned round to her), and where the drop comes down on the pavement. */
const STOP = { her: 4350, him: [4450, 4508], land: [4236, GROUND + 78] as V2 };
/** The drop the world goes into: where it hangs in the frame and how large; how far outside it the line goes round it; how large the ring is that closes to it, and where the umbrella is in the frame when it starts to. */
const DROP = { x: 960, y: 600, r: 372, text: 70, far: 1340, from: [944, 404] };
/** The sun at the end, in the picture: low, between the two of them. */
const SUN: V2 = [962, 404];
/** His bubble in the frame; and the marks round what he says, drawn by hand (strokes for the kit's sketch). */
const BUBBLE = { x: 1036, y: 228, w: 404, h: 166 };
const MARK: V2[] = [[0.1, -0.24], [-0.02, -0.1], [-0.06, 0.04], [0, 0.12], [0.08, 0.06], [0.02, -0.02]];
const OPEN: V2[][] = [-0.15, 0.15].map((dx) => MARK.map(([x, y]) => [x + dx, y] as V2)), CLOSE: V2[][] = OPEN.map((s) => s.map(([x, y]) => [-x, -y] as V2));
/** Against the sun they are this colour, nearly. */
const DARK = mix('navy', 'dusk', 0.2);

/**
 * The finale's own grade, over the finished picture. `cool` (0..1): the rain, the colour drawn toward frost (but the
 * rose). `warm` (0..1): the low sun, on everything that is not bright already. And the drop of line 4, `drop` (its
 * middle and its radius, px): what is inside it is seen as through a lens, larger at its middle and crowded at its rim
 * (`lens.x`), and it is a drop, with the light on it and its shade under it (`lens.y`). With all of that at 0 the
 * picture is as it was painted (the first frame: BRIDGE_RAIN; the last: FINALE_SKY).
 */
const GRADE = /* glsl */ `
  uniform sampler2D tex; uniform float cool; uniform float warm; uniform vec3 drop; uniform vec2 lens;
  void main() {
    vec2 size = vec2(${W}.0, ${H}.0), px = vec2(vUv.x, 1.0 - vUv.y) * size, off = px - drop.xy;
    float R = max(drop.z, 1.0), d = length(off), u = d / R, inside = drop.z > 0.0 && u < 1.0 ? 1.0 : 0.0;
    vec2 at = drop.xy + off * mix(1.0, 0.7 + 0.3 * u * u, lens.x * inside);
    vec3 col = texture(tex, drop.z > 0.0 ? vec2(at.x, size.y - at.y) / size : vUv).rgb;
    if (drop.z > 0.0) {
      vec2 n = off / max(d, 1e-3);
      float up = max(0.0, dot(n, vec2(-0.6, -0.8))), dn = max(0.0, dot(n, vec2(0.6, 0.8)));
      float deep = inside * smoothstep(0.6, 1.0, u), edge = 1.0 - smoothstep(0.0, 2.5, abs(d - R));
      float hi = inside * pow(up, 4.0) * smoothstep(0.76, 0.87, u) * (1.0 - smoothstep(0.9, 0.97, u));
      float lo = inside * dn * dn * smoothstep(0.8, 0.98, u);
      float shade = (1.0 - inside) * (1.0 - smoothstep(0.0, 0.11, u - 1.0)) * dn;
      col = col * (1.0 - lens.y * (0.12 * deep + 0.22 * shade + 0.3 * edge * dn)) + lens.y * (0.9 * hi + 0.2 * lo + 0.5 * edge * up) * C_PAPER;
    }
    vec3 luma = vec3(0.2126, 0.7152, 0.0722);
    float l = dot(col, luma), rose = smoothstep(0.25, 0.5, col.r - max(col.g, col.b));
    vec3 wet = mix(mix(col, l * C_FROST / dot(C_FROST, luma), 0.5), C_FROST * 0.86, 0.07);
    col = mix(col, wet, cool * (1.0 - 0.85 * rose));
    col = mix(col, col * mix(vec3(1.0), C_GOLD / dot(C_GOLD, luma), 0.3 * (1.0 - smoothstep(0.35, 0.95, l))), warm);
    fragColor = vec4(col, 1.0);
  }`;

/** Rain landing at (x, y): a drop bursts there every 0.4 s or so, three beads of it thrown up. `a`: how much of it (0..1). */
function splash(c: Ctx, x: number, y: number, t: number, seed: number, a: number, s = 1) {
  const p = t * 2.6 + hash(seed, 1), n = Math.floor(p), v = (p - n) / 0.7;
  if (a <= 0.01 || v >= 1) return;
  const dx = (hash(seed, n) - 0.5) * 26 * s;
  // (each bead pale, on a little of the rain's shade: it shows on his white shirt too)
  for (const [col, more] of [[mix('frost', 'navy', 0.4, 0.6 * a * (1 - v)), 1.7], [rgba('paper', 0.95 * a * (1 - v)), 0]] as [string, number][]) {
    c.fillStyle = col;
    for (const sg of [-1, 0, 1]) { c.beginPath(); c.arc(x + dx + sg * (6 + 17 * v) * s, y - (sg ? 28 : 38) * v * (1 - 0.62 * v) * s, (3.4 - 1.5 * v) * s + more, 0, TAU); c.fill(); }
  }
}

type Picture = (c: Ctx, g: Ctx, t: number, q: number) => void;
/** The two at the bus stop as drawn: where they are, and (once her bag is in her arms) the mouth of its pocket and the pull of its zip. */
type Pair = { him: Anchors; her: Anchors; mouth: V2 | null; pull: V2 | null };

export default class Finale extends Scene {
  private stage = new Stage(this.ctx);
  /** The picture before its grade, and the grade; and what is written over the grade (line 4, which goes round the drop, not through it). */
  private own = makeRT();
  private grade = new FSPass(GRADE, { tex: { value: null }, cool: { value: 0 }, warm: { value: 0 }, drop: { value: new THREE.Vector3() }, lens: { value: new THREE.Vector2() } });
  private over = new Layer2D();
  private wrote = false;
  /** The beat of the cut; the eight lines, and where each starts and ends (beats from the cut). */
  private b0 = 0;
  private L: Line[] = [];
  private F: number[] = [];
  private E: number[] = [];
  /** The changes of picture that are dissolves (the middle of each, and half its length), and what happens inside the pictures: all in beats from the cut. */
  private cuts: { at: number; half: number }[] = [];
  private T = { there: [0, 0], up: [0, 0], offer: [0, 0], turn: [0, 0], under: [0, 0], closer: [0, 0], touch: 0, rise: [0, 0], held: 0, path: [0, 0], fall: [0, 0], face: [0, 0], says: 0, said: 0, glad: [0, 0], shut: [0, 0], front: [0, 0], unzip: [0, 0], end: 0 };
  /** When the bridge's drop landed (s), and how long after that the finale starts. */
  private hit = 0;
  private cover = 1;
  /** The last line's stars, and the look up after them (finale-sets.ts). */
  private rising: Rising = { line: null as unknown as Line, look: [0, 1], more: [] };
  /** What the grade is told this frame: the drop (x, y, radius), and how much of a lens and of a drop it is. */
  private drop: [number, number, number] = [0, 0, 0];
  private lens: [number, number] = [0, 0];
  /** How much of the frame the picture being painted has (1, but while one dissolves into the next). */
  private shown = 1;
  private pictures: Picture[] = [(c, g, t, q) => this.gate(c, g, t, q), (c, g, t, q) => this.lane(c, g, t, q), (c, g, t, q) => this.mini(c, g, t, q), (c, g, t, q) => this.stop(c, g, t, q)];

  override init() {
    const { audio, lyrics } = this.ctx;
    this.b0 = Math.round(audio.beatAt(this.ctx.start));
    const q = (t: number) => audio.beatAt(t) - this.b0;
    const L = (this.L = LINES.map(([s, n]) => lyrics.get(s, n))), F = (this.F = L.map((l) => q(l.start))), E = (this.E = L.map((l) => q(l.end))), sung = (i: number, ch: number) => q(L[i]!.words[ch]!.start);
    // the pictures change as line 2 starts and as line 4 starts (the drop falls by itself: it lands as line 5 starts)
    this.cuts = [{ at: F[1]! - 0.13, half: 0.3 }, { at: F[3]!, half: 0.35 }];
    this.T = {
      // 1: the gate comes up under the rain; her umbrella goes up on 课; she holds it out over 一起, and he turns round on 起走; over 好不好 they are both under it
      there: [0.05, 1.1], up: [sung(0, 3) - 0.3, sung(0, 3) + 0.12], offer: [sung(0, 4) + 0.2, sung(0, 6)], turn: [sung(0, 5), sung(0, 6) + 0.3], under: [sung(0, 7), E[0]!],
      // 3: he comes closer from 靠 on; their shoulders meet on the first 刚
      closer: [sung(2, 1) - 0.1, sung(2, 10)], touch: sung(2, 10),
      // 4: up over the umbrella; the world has drawn in to the drop by 缩; the dotted path runs along the road over 缩进这条小路; the drop falls, and is down as line 5 starts
      rise: [F[3]! - 0.35, sung(3, 5)], path: [sung(3, 5) - 0.1, E[3]!], fall: [E[3]! - 0.3, F[4]! + 0.04],
      // 5: he turns round to her over 就好
      face: [sung(4, 8) - 0.15, E[4]! + 0.15],
      // 6: his bubble opens just before 明, and goes as line 7 starts; she is glad of it over 也够
      says: sung(5, 6) - 0.35, said: F[6]! - 0.35, glad: [sung(5, 9), sung(5, 10) + 0.3],
      // 7: he shuts the umbrella over 慢慢走
      shut: [F[6]! + 0.15, sung(6, 2) + 0.7],
      // 8: over 讲 she takes her bag in her arms; between the lines she draws the zip open: the pocket is open as 把 starts
      front: [sung(6, 5) - 0.1, sung(6, 5) + 0.6], unzip: [sung(6, 5) + 0.62, F[7]! - 0.06],
      // (and the camera has come in on them by 口, which is held while it looks up)
      held: sung(7, 9), end: q(this.ctx.end),
    };
    this.hit = rainHit(lyrics); this.cover = this.ctx.start - this.hit;
    this.rising = risingOf(lyrics, audio);
  }

  /** The time of a beat counted from the cut. */
  private at(beat: number) { return this.ctx.audio.timeOfBeat(this.b0 + beat); }
  /** How hard it rains at beat q: it eases through line 5, and has stopped soon after line 7 starts. */
  private rains(q: number) { const F = this.F, E = this.E; return keys(q, [[F[4]!, 1], [E[4]!, 0.55, sine], [F[6]! - 0.2, 0.3, sine], [F[6]! + 0.7, 0, sine]]); }
  /** How far the sky has cleared at beat q (0 = the rain .. 1 = sunset): a little light comes into it through line 6; the clouds part through line 7. */
  private clear(q: number) { const F = this.F, E = this.E; return keys(q, [[F[5]!, 0], [E[5]!, 0.3, sine], [E[6]!, 0.92, sine], [F[7]! + 0.8, 1, sine]]); }
  /** The grade at beat q: the rain's frost comes with the gate and goes line by line; the sun's gold comes with the sunset (and is out of the picture again when the camera has looked up, at the cut). */
  private cool(q: number) { const F = this.F, E = this.E; return keys(q, [[0, 0], [this.T.there[1]!, 1, sine], [F[2]!, 0.92, sine], [F[3]!, 0.82, sine], [F[4]!, 0.68, sine], [F[5]!, 0.5, sine], [E[5]!, 0.3, sine], [E[6]!, 0.04, sine], [F[7]!, 0, sine]]); }
  private warm(q: number, t: number) { const F = this.F, E = this.E; return keys(q, [[F[5]!, 0], [E[5]!, 0.16, sine], [E[6]!, 0.8, sine], [F[7]! + 1, 1, sine]]) * (1 - lookUp(this.rising, t) / TILT); }
  /** The camera at the bus stop at beat q: on the two of them; in for what he says; back and a little down for the sunset and the water; in again for what she says. */
  private stopCam(q: number): Cam {
    const T = this.T, F = this.F, E = this.E, on = (STOP.her + lerp(STOP.him[0]!, STOP.him[1]!, sine(prog(q, T.face[0]!, T.face[1]!)))) / 2;
    const zoom = keys(q, [[F[4]!, 0.9], [E[4]!, 0.93, sine], [T.says + 1, 0.97, sine], [F[6]!, 0.97], [F[6]! + 1.8, 0.92, sine], [F[7]! - 0.3, 0.93, sine], [T.held, 1.12, sine]]);
    // (in on them for the last line their heads stay where they are in the frame, either side of the sun)
    return aim(zoom, [on, GROUND], [960, keys(q, [[F[6]!, 938], [F[6]! + 1.8, 900, sine], [F[7]! - 0.3, 900], [T.held, 1004, sine]])]);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx, { c, g } = this.stage.begin(), q = f.beat - this.b0, t = f.t, cuts = this.cuts;
    this.drop = [0, 0, 0]; this.lens = [0, 0]; this.wrote = false;
    // which picture; round a cut the next one comes up over it, on a canvas of its own. (The drop falls onto the bus stop by itself: mini().)
    let i = 0;
    while (i < cuts.length && q >= cuts[i]!.at + cuts[i]!.half) i++;
    if (i === 2 && q >= this.T.fall[1]!) i = 3;
    const cut = cuts[i], k = cut ? sine(clamp((q - cut.at + cut.half) / (2 * cut.half))) : 0;
    this.shown = 1 - k;
    g.save(); g.globalAlpha = 1 - k; this.pictures[i]!(c, g, t, q); g.restore();
    if (k > 0) {
      const next = scratch('picture');
      this.shown = k;
      g.save(); g.globalAlpha = k; this.pictures[i + 1]!(next.c, g, t, q); g.restore();
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = k; c.drawImage(next.cv, 0, 0, W, H); c.restore();
    }
    // the picture, and over it the grade; and over that what is written round the drop
    this.stage.end(this.own);
    const u = this.grade.u;
    u.tex!.value = this.own.texture; u.cool!.value = this.cool(q); u.warm!.value = this.warm(q, t);
    (u.drop!.value as THREE.Vector3).set(...this.drop); (u.lens!.value as THREE.Vector2).set(...this.lens);
    this.grade.render(renderer, out);
    if (this.wrote) comp.draw(renderer, this.over.upload(), out);
  }

  /** A line of the lyrics on the picture, a little paper behind it so that it reads over whatever is there, and the light kept off it. Returns its characters as drawn. */
  private say(c: Ctx, g: Ctx | null, line: Line, t: number, how: LyricOpts) {
    c.save(); c.shadowColor = rgba('paper', 0.9); c.shadowBlur = 16;
    const chars = drawLyric(c, line, t, how);
    c.restore();
    if (g && chars.length) { g.save(); g.globalCompositeOperation = 'destination-out'; drawLyric(g, line, t, how); g.restore(); }
    return chars;
  }

  /**
   * The rain over a picture, `k` (0..1) of it: the bridge's rain (BRIDGE_RAIN), and with it, since it is seen against
   * a place now, more of it, finer and paler. `floor`: where it lands (y), if it does in this picture.
   */
  private pour(c: Ctx, t: number, k: number, floor?: number) {
    if (k <= 0.003) return;
    rain(c, t, { count: 210, seed: 63, wind: -0.2, size: 0.72, alpha: 0.62 * k, color: 'paper' });
    rain(c, t, { ...BRIDGE_RAIN.rain, alpha: k, ground: floor });
  }

  // ------------------------------------------------------------------ 1: the gate
  private gate(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, there = sine(prog(q, T.there[0]!, T.there[1]!)), since = t - this.hit;
    const cam = aim(1 + 0.03 * prog(q, 0, this.cuts[0]!.at + 0.3), [GATE.on + 8 * Math.sin(t * 0.3), GROUND], [1180, 940]);
    // her umbrella goes up, and opens; she holds it out over him, in both hands; he turns round to her; then they are both under it
    const up = sine(prog(q, T.up[0]!, T.up[1]!)), open = ease.outBack(prog(q, T.up[1]! - 0.1, T.up[1]! + 0.32), 1.3), offer = sine(prog(q, T.offer[0]!, T.offer[1]!));
    const turn = sine(prog(q, T.turn[0]!, T.turn[1]!)), under = sine(prog(q, T.under[0]!, T.under[1]!)), out = offer * (1 - 0.45 * under);
    const two = (x: Ctx) => {
      const him = drawBoy(x, 'turn-smile', { x: GATE.him, y: GROUND, scale: S, facing: 90, t, k: turn, outfit: 'autumn', wind: -0.1, nod: -13 * (1 - turn), smile: 0.1 + 0.5 * under, blush: 0.25 + 0.55 * under, light: [0, -1], shadow: 0.5 });
      const her = drawGirl(x, up < 1 ? { from: 'stand', to: 'hold-umbrella', k: up } : { from: 'hold-umbrella', to: 'reach', k: 0.55 * out }, {
        x: GATE.her, y: GROUND + 12, scale: S, facing: 90, t, outfit: 'autumn', wind: -0.1, nod: 7 * (1 - offer) - 5 * offer, smile: 0.3 + 0.55 * under, blush: 0.55 + 0.45 * offer, light: [0, -1], shadow: 0.5,
      });
      drawUmbrella(x, { x: her.handR[0], y: her.handR[1], scale: S, tilt: lerp(2.55, 0.05, up) + 0.13 * out + 0.015 * Math.sin(t * 1.7), clear: true, open });
      // the rain lands on him, until it is over him; and on her, who is out in it now
      for (const [sx, sy, seed] of [[him.top[0], him.top[1] + 6, 1], [him.neck[0] - 40, him.neck[1] + 16, 2], [him.neck[0] + 38, him.neck[1] + 18, 3]]) splash(x, sx!, sy!, t, seed!, 1 - smoothstep(0.3, 0.8, offer));
      for (const [sx, sy, seed] of [[her.top[0] - 4, her.top[1] + 6, 4], [her.neck[0] - 42, her.neck[1] + 18, 5]]) splash(x, sx!, sy!, t, seed!, Math.max(1 - smoothstep(0.7, 1, open), smoothstep(0.5, 1, offer) * (1 - under)));
    };
    drawWay(c, g, { t, cam, season: SPRING, late: 0, dust: [], stars: [], two, there, sky: (x) => drawSky(x, { t, clear: 0, sun: SUN, shine: 0 }) });
    // the rain, as the bridge leaves it (BRIDGE_RAIN): it lands on the ground once the ground is there; and the last rings of the drop that let it in
    const floor = seen(cam, [0, GROUND + 50])[1];
    if (there < 1) rain(c, t, { ...BRIDGE_RAIN.rain, alpha: 1 - there });
    this.pour(c, t, there, floor);
    if (since < 3 * this.cover + 1) for (let j = 1; j <= 3; j++) soundRing(c, BRIDGE_RAIN.at[0], BRIDGE_RAIN.at[1], ringAt(since - 0.15 * j, this.cover), { alpha: 0.5 - 0.11 * j });
    // the line, on the wet glass the picture is seen through: breath on the glass, the characters written in it with a
    // finger, a drop running down from under one and another, and the rain's drops running down through them
    const band = { x: 500, y: ROW_A + 64, w: 920 }, wet = smoothstep(0, 0.6, q), mist = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    mist.addColorStop(0, rgba('paper', 0.36 * wet)); mist.addColorStop(0.6, rgba('paper', 0.22 * wet)); mist.addColorStop(1, rgba('paper', 0));
    c.save(); c.translate(W / 2, band.y); c.scale(band.w * 0.66, 150); c.fillStyle = mist; c.fillRect(-1, -1, 2, 2); c.restore();
    const chars = drawLyric(c, this.L[0]!, t, { x: W / 2, y: band.y, size: 92, style: 'hand', each: (ch) => { if (ch.sung <= 0) ch.alpha = smoothstep(0, 0.45, q); } });
    c.save(); c.lineCap = 'round'; c.lineWidth = 3.2;
    for (const ch of chars) {
      if (ch.since <= 0.1 || hash(ch.k, 7) < 0.3) continue;
      const x = ch.x + (hash(ch.k, 8) - 0.5) * 36, y0 = ch.y + 36, y1 = y0 + (22 + 74 * hash(ch.k, 9)) * ease.outCubic(clamp((ch.since - 0.1) / 2.4));
      c.strokeStyle = c.fillStyle = ch.color; c.globalAlpha = 0.8;
      c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); c.beginPath(); c.arc(x, y1 + 1, 3.6, 0, TAU); c.fill();
    }
    c.restore();
    drawGlass(c, t, wet, band);
  }

  // ------------------------------------------------------------------ 2, 3: the small road, from behind them
  private lane(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, L = this.L, from = this.cuts[0]!.at - this.cuts[0]!.half, to = this.cuts[1]!.at + this.cuts[1]!.half, s = LANE_SCALE, y = LANE_FLOOR;
    // he comes closer, until their shoulders meet (he is a little the taller: her shoulder is against his arm)
    const near = sine(prog(q, T.closer[0]!, T.touch)), met = prog(q, T.touch, T.touch + 0.6), gap = lerp(184, 118, near) * s, wetting = 1 - smoothstep(0, 1, met);
    // the camera goes after them, a little nearer all the while; and back and up from them as line 4 comes
    const zoom = lerp(1, 1.05, prog(q, from, T.touch + 1)) * lerp(1, 0.96, sine(prog(q, T.rise[0]!, to))), pivot: V2 = [LANE.x, 560], on = (p: V2): V2 => [pivot[0] + (p[0] - pivot[0]) * zoom, pivot[1] + (p[1] - pivot[1]) * zoom];
    let her: Anchors | null = null, him: Anchors | null = null, tilt = 0;
    const two = (x: Ctx) => {
      // (the wet road shows them, darkly)
      const sh = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      sh.addColorStop(0, rgba('ink', 0.26)); sh.addColorStop(1, rgba('ink', 0));
      x.save(); x.translate(LANE.x, y + 14); x.scale(gap * 0.5 + 120, 46); x.fillStyle = sh; x.fillRect(-1, -1, 2, 2); x.restore();
      him = drawBoy(x, 'lean-closer', { x: LANE.x + gap * 0.52, y, scale: s, facing: 180, t, walk: q, k: 0.9 * near, outfit: 'autumn', wind: -0.08, headTurn: 16 * near, light: [0, -1], shadow: 0 });
      her = drawGirl(x, 'hold-umbrella', { x: LANE.x - gap * 0.48, y, scale: s, facing: 180, t, walk: q, outfit: 'autumn', wind: -0.08, headTurn: -12 * near, tilt: -7 * near, light: [0, -1], shadow: 0 });
      tilt = 0.17 - 0.06 * near + 0.014 * Math.sin(q * TAU);
      drawUmbrella(x, { x: her.handR[0], y: her.handR[1], scale: s, tilt, clear: true });
      // the rain lands on the shoulder each of them has outside it: until they are close enough
      for (const [sx, sy, seed] of [[her.neck[0] - 47 * s, her.neck[1] + 15 * s, 11], [her.neck[0] - 30 * s, her.neck[1] + 9 * s, 12], [him.neck[0] + 58 * s, him.neck[1] + 15 * s, 13], [him.neck[0] + 38 * s, him.neck[1] + 8 * s, 14]]) splash(x, sx!, sy!, t, seed!, wetting, 1.7);
    };
    c.save(); c.translate(pivot[0], pivot[1]); c.scale(zoom, zoom); c.translate(-pivot[0], -pivot[1]);
    drawLane(c, { t, walked: 0.46 * (q - from), rain: 1, two });
    c.restore();
    if (her && him) {
      const a = her as Anchors, b = him as Anchors, hand = on(a.handR), k = s * zoom, D = UMBRELLA_CLEAR;
      /** A point of the umbrella's canopy on screen: `u` (0..1) along it from one side of its rim over the top to the other. */
      const dome = (u: number): V2 => { const an = Math.PI * (1 + u), x = D.r * Math.cos(an) * k, yy = (-(D.top - D.rise) + D.rise * Math.sin(an)) * k; return [hand[0] + x * Math.cos(tilt) - yy * Math.sin(tilt), hand[1] + x * Math.sin(tilt) + yy * Math.cos(tilt)]; };
      // the rain runs off its rim
      c.strokeStyle = rgba('paper', 0.75); c.lineWidth = 2.4; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const p = t * 1.3 + hash(i, 21), n = Math.floor(p), v = p - n, [dx, dy] = dome(i < 2 ? 0.02 : 0.98), x = dx + (hash(i, n) - 0.5) * 8, yy = dy + 190 * v * v;
        c.globalAlpha = 1 - v; c.beginPath(); c.moveTo(x, yy); c.lineTo(x, yy - 10 - 16 * v); c.stroke();
      }
      c.globalAlpha = 1;
      // where their shoulders meet it glows; and the rain on the umbrella glints, one drop after another
      if (met > 0) {
        const [mx, my] = on([(a.neck[0] + b.neck[0]) / 2 + 6 * s, (a.neck[1] + b.neck[1]) / 2 + 46 * s]), w = sine(clamp(met * 1.6));
        glow(c, mx, my, 170 * k, { color: 'blush', alpha: 0.5 * w });
        glow(g, mx, my, 150 * k, { color: 'blush', alpha: 0.1 * w });
        for (let i = 0; i < 7; i++) {
          const at = dome(0.1 + 0.8 * hash(i, 23)), came = clamp((q - T.touch - 0.13 * i) / 0.9);
          sparkle(g, at[0], at[1], (26 + 16 * hash(i, 24)) * k, Math.max(Math.sin(Math.PI * came) ** 0.7, 0.7 * came * Math.max(0, Math.sin(t * 3.1 + i * 2.2)) ** 8), { color: 'paper', rot: i + t * 0.4 });
        }
      }
    }
    // the rain: all of it; and a few drops close to the lens, out of focus
    this.pour(c, t, 1);
    layer(c, { blur: 6 }, (x) => { rain(x, t, { count: 24, seed: 67, wind: -0.2, size: 2.4, alpha: 0.55 }); });
    // the lines, over them, a row each. 2: each character comes down into its place as it is sung, like a drop
    this.say(c, g, L[1]!, t, { x: W / 2, y: ROW_A, size: 82, style: 'hand', hold: 0.5, each: (ch) => { if (ch.since > 0) ch.y -= 18 * (1 - ease.outCubic(clamp(ch.since / 0.3))); } });
    // 3: 刚刚好 swells a little as it is sung, with the glow
    this.say(c, g, L[2]!, t, { x: W / 2, y: ROW_B, size: 76, style: 'hand', each: (ch) => { if (ch.k >= 10 && ch.since > 0) ch.scale = 1 + 0.14 * Math.sin(Math.PI * clamp(ch.since / 0.42)); } });
  }

  // ------------------------------------------------------------------ 4: the whole way in a drop
  private mini(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, into = sine(prog(q, T.rise[0]!, T.rise[1]!)), fall = prog(q, T.fall[0]!, T.fall[1]!), soft = smoothstep(0.1, 0.85, into), gone = smoothstep(0, 0.5, fall);
    // the camera goes up from them: the little world gets small; it draws in to the drop; and the drop falls, its world in it
    const high = Math.exp(lerp(Math.log(3.2), 0, into)), land = seen(this.stopCam(T.fall[1]!), STOP.land);
    // (the umbrella is where it was in the frame when it was seen from behind, and goes to the middle of the drop as the camera goes up)
    const hang: V2 = [lerp(DROP.from[0]!, DROP.x, into), lerp(DROP.from[1]!, DROP.y, into)];
    const R = lerp(lerp(DROP.far, DROP.r, into), 15, sine(prog(fall, 0, 0.85))), x = lerp(hang[0], land[0], sine(fall)), y = lerp(hang[1], land[1], fall * fall);
    const world = (b: Ctx, at: V2, zoom: number) => drawMini(b, { t, at, zoom, u: 0.4 + 0.012 * (q - T.rise[0]!), path: sine(prog(q, T.path[0]!, T.path[1]!)), rain: 1 });
    // outside the drop: the same world, out of focus and pale (the bus stop under it already, as the drop falls)
    if (fall > 0) this.stop(c, g, t, q);
    else if (soft < 1) world(c, hang, high);
    if (soft > 0 && gone < 1) {
      c.save(); c.beginPath(); c.rect(0, 0, W, H); c.arc(x, y, R, 0, TAU); c.clip('evenodd');
      layer(c, { blur: 12, haze: 0.42, hazeColor: mix('frost', 'paper', 0.5), alpha: soft * (1 - gone) }, (b) => world(b, hang, high));
      c.restore();
    }
    if (fall <= 0) this.pour(c, t, soft < 1 ? 1 : 0.85);
    if (R < DROP.far - 1) {
      // inside it: the world in focus (it is there already, until the world outside has gone soft altogether)
      if (soft >= 1) { c.save(); c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip(); world(c, [x, y], (high * Math.min(R, DROP.r)) / DROP.r); c.restore(); }
      this.drop = [x, y, R]; this.lens = [1 - smoothstep(DROP.r + 30, DROP.r + 300, R), smoothstep(0.3, 1, into)];
    }
    // the line, round the drop (over the grade: it is not seen through the drop, even while the ring closes over it)
    const o = this.over.ctx, line = this.L[3]!, n = line.chars.length, rad = DROP.r + DROP.text, step = 86 / rad;
    this.over.clear(); this.wrote = true;
    this.say(o, null, line, t, {
      x: 0, y: 0, size: 78, alpha: this.shown ** 2, until: this.at(T.fall[0]! + 0.3),
      path: (_u, k) => { const a = -Math.PI / 2 + (k - (n - 1) / 2) * step; return { x: DROP.x + Math.cos(a) * rad, y: DROP.y + Math.sin(a) * rad, angle: a + Math.PI / 2 }; },
    });
  }

  // ------------------------------------------------------------------ 5 to 8: the bus stop
  /**
   * The two at the bus stop, under the camera of the way: she, he, the umbrella in his hand, and her bag when she has
   * it in her arms. `flat`: the two alone, in one colour (what the water shows of them). Returns where things are.
   */
  private pair(x: Ctx, t: number, q: number, flat?: string): Pair {
    const T = this.T, F = this.F, L = this.L, at = (i: number, ch: number) => this.ctx.audio.beatAt(L[i]!.words[ch]!.start) - this.b0, shine = sine(prog(q, F[6]! + 0.4, F[6]! + 2.8));
    const face = sine(prog(q, T.face[0]!, T.face[1]!)), shut = sine(prog(q, T.shut[0]!, T.shut[1]!)), front = sine(prog(q, T.front[0]!, T.front[1]!)), zip = ease.inOutCubic(prog(q, T.unzip[0]!, T.unzip[1]!));
    // what they do with their heads: he looks round at her, once; nods his three words; they look up when the rain stops; she looks down at her bag, and up at him; his eyes go up after the stars
    const glance = sine(prog(q, F[4]! + 1.2, F[4]! + 1.7)) * (1 - face), nods = [6, 7, 8].reduce((n, ch) => n + Math.sin(Math.PI * clamp((q - at(5, ch)) / 0.3)), 0), glad = sine(prog(q, T.glad[0]!, T.glad[1]!));
    const skyward = sine(prog(q, F[6]! + 0.1, F[6]! + 0.8)) * (1 - sine(prog(q, F[6]! + 1.9, F[6]! + 2.6))), down = sine(prog(q, T.front[0]!, T.front[1]!)) * (1 - sine(prog(q, F[7]! + 0.2, F[7]! + 1))), after = sine(prog(q, at(7, 3), at(7, 9) + 0.6));
    const xb = lerp(STOP.him[0]!, STOP.him[1]!, face), told = sine(prog(q, F[7]!, F[7]! + 1.2));
    const him = drawBoy(x, shut > 0 ? { from: 'hold-umbrella', to: 'stand', k: shut } : 'hold-umbrella', {
      x: xb, y: GROUND, scale: S, facing: lerp(78, -90, face), t, outfit: 'autumn', wind: -0.06, headTurn: -46 * glance, nod: 8 * nods - 15 * skyward - 15 * after, smile: 0.3 + 0.3 * face + 0.3 * glad + 0.3 * told, blush: 0.3 + 0.3 * glad + 0.4 * told,
      light: [-0.9 * shine, lerp(-1, -0.35, shine)], shadow: flat ? 0 : 0.6, silhouette: flat,
    });
    const her = drawGirl(x, front > 0 ? { from: 'face-each-other', to: 'reach', k: 0.3 * front } : { from: 'stand', to: 'face-each-other', k: face }, {
      x: STOP.her, y: GROUND + 12, scale: S, facing: lerp(78, 90, face), t, outfit: 'autumn', wind: -0.06, bag: front < 0.45, nod: -7 * face - 13 * skyward + 6 * glad * (1 - skyward) + 22 * down, smile: 0.3 + 0.62 * glad * (1 - 0.5 * told), blush: 0.6 + 0.4 * Math.max(glad, told),
      light: [0.9 * shine, lerp(-1, -0.35, shine)], shadow: flat ? 0 : 0.6, silhouette: flat,
    });
    if (flat) return { him, her, mouth: null, pull: null };
    // the umbrella, over them both, more or less; he brings it down to his side, shut
    drawUmbrella(x, { x: him.handR[0], y: him.handR[1], scale: S, tilt: lerp(lerp(-0.33, -0.2, face), 3, shut) + 0.012 * Math.sin(t * 1.5), clear: true, open: 1 - sine(prog(shut, 0.12, 0.72)) });
    // her bag: off her back and round into her arms, its pocket to us; and the zip of the pocket, drawn open
    if (front < 0.4) return { him, her, mouth: null, pull: null };
    const k = smoothstep(0.4, 1, front), hx = (her.handL[0] + her.handR[0]) / 2 - 8 * S, hy = Math.max(her.handL[1], her.handR[1]) + 36 * S;
    return { him, her, ...drawBag(x, { x: lerp(her.chest[0] - 30 * S, hx, k), y: lerp(her.chest[1] + 50 * S, hy, k), scale: lerp(0.45, 0.6, k) * S, zip, tilt: 0.5 * (1 - k), alpha: clamp(k * 4) }) };
  }

  private stop(c: Ctx, g: Ctx, t: number, q: number) {
    const T = this.T, F = this.F, E = this.E, L = this.L, cam = this.stopCam(q), z = cam.zoom!, dy = lookUp(this.rising, t), rains = this.rains(q), clear = this.clear(q);
    const shine = sine(prog(q, F[6]! + 0.4, F[6]! + 2.8)), dark = 0.8 * sine(prog(q, F[6]! + 1.6, F[7]! + 0.6)), still = lerp(0.3, 1, sine(prog(q, F[6]!, F[6]! + 1.6)));
    /** A point of the way on screen (the look up at the end takes it down the frame). */
    const scr = (p: V2): V2 => { const [x, y] = seen(cam, p); return [x, y + dy]; };
    let got: Pair | null = null, fig: HTMLCanvasElement | null = null;
    const two = (x: Ctx) => {
      // the wet, and what the water shows of them
      drawWet(x, { t, view: inView(cam), sky: skyLow(clear), rain: rains, still, foot: GROUND + 6, mirror: (m) => { this.pair(m, t, q, DARK); }, sun: { x: (STOP.her + STOP.him[1]!) / 2, k: shine } });
      // the two, on a canvas of their own: against the sun they go dark, and its light is kept off them
      const own = scratch('pair'), f = own.c;
      f.setTransform(x.getTransform()); got = this.pair(f, t, q);
      f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-atop'; f.fillStyle = rgba(DARK, dark); f.fillRect(0, 0, W, H);
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(own.cv, 0, 0, W, H); x.restore();
      fig = own.cv;
    };
    c.save(); c.translate(0, dy); g.save(); g.translate(0, dy);
    drawWay(c, g, { t, cam, season: SPRING, late: 0, dust: [], stars: [], two, sky: (x) => drawSky(x, { t, clear, sun: SUN, shine }) });
    // the sun on the light layer
    glow(g, SUN[0], SUN[1], 470, { alpha: 0.62 * shine });
    c.restore(); g.restore();
    const had = got as Pair | null, cv = fig as HTMLCanvasElement | null;
    if (cv && shine > 0.003) {
      // (the light does not shine through the two of them; but it is on their edges, on the side the sun is)
      g.save(); g.globalCompositeOperation = 'destination-out'; g.drawImage(cv, 0, 0, W, H); g.restore();
      const rim = scratch('rim'), r = rim.c, mid = scr([(STOP.her + STOP.him[1]!) / 2, 0])[0];
      r.drawImage(cv, 0, 0, W, H); r.globalCompositeOperation = 'source-in'; r.fillStyle = mix('gold', 'paper', 0.4); r.fillRect(0, 0, W, H); r.globalCompositeOperation = 'destination-out';
      for (const sg of [-1, 1]) { r.save(); r.beginPath(); r.rect(sg < 0 ? 0 : mid, 0, sg < 0 ? mid : W - mid, H); r.clip(); r.drawImage(cv, sg * 4.5, 2.5, W, H); r.restore(); }
      c.save(); c.globalAlpha = shine; c.drawImage(rim.cv, 0, 0, W, H); c.restore();
      g.save(); g.globalAlpha = 0.4 * shine; g.drawImage(rim.cv, 0, 0, W, H); g.restore();
    }
    // the rain, while it lasts; where the drop came down: its rings on the wet pavement, and what it threw up
    this.pour(c, t, rains, scr([0, GROUND + 50])[1]);
    const since = q - T.fall[1]!;
    if (since > 0 && since < 2.4) {
      const [lx, ly] = scr(STOP.land);
      c.save(); c.translate(lx, ly); c.scale(1, 0.26);
      for (let j = 0; j < 3; j++) { const u = clamp((since - 0.24 * j) / 1.7); if (u > 0 && u < 1) soundRing(c, 0, 0, 170 * z * ease.outCubic(u), { alpha: 0.75 * (1 - u), width: 11 }); }
      c.restore();
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.34, v = (150 + 110 * hash(i, 32)) * z, s = since * 0.86, u = s / 0.5;
        if (u < 1) { c.fillStyle = rgba('paper', 0.9 * (1 - u)); c.beginPath(); c.arc(lx + Math.cos(a) * v * s, ly + Math.sin(a) * v * s + 900 * s * s * z, 4.5 - 2 * u, 0, TAU); c.fill(); }
      }
    }
    // what glows at her pocket once it is open; a glint on its pull as the zip comes
    if (had?.mouth && had.pull) {
      const open = prog(q, T.unzip[0]!, T.unzip[1]!), [mx, my] = scr(had.mouth), [px, py] = scr(had.pull);
      glow(g, mx, my, 120 * z, { color: 'blush', alpha: 0.34 * open });
      sparkle(g, px, py, 42 * z, Math.sin(Math.PI * clamp(prog(q, T.unzip[0]! + 0.1, T.unzip[1]! + 0.5))) ** 0.7, { rot: open });
    }
    // the sunset blooms in from the side, at its height
    lightLeak(g, 0.36 * sine(prog(q, F[7]! + 0.9, F[7]! + 2.7)) * (1 - sine(prog(q, F[7]! + 3.3, E[7]! - 0.3))), { from: -0.4, t });
    // the lines, in the sky. 5: in her handwriting
    this.say(c, g, L[4]!, t, { x: W / 2, y: ROW_A, size: 84, style: 'hand', hold: 0.3, each: (ch) => { if (ch.sung <= 0) ch.alpha = smoothstep(0, 0.4, since + 0.5); } });
    // 6: 就算只说一句 in a row; what he says in his bubble, larger, and it stays rose; the marks round it drawn by hand; 也够 after it
    const line = L[5]!, says = prog(q, T.says, T.says + 0.45), said = 1 - prog(q, T.said, T.said + 0.35), gone = this.at(T.said + 0.4), head = had ? scr(had.him.head)[0] : W / 2;
    const bubble = { ...BUBBLE, to: [head, BUBBLE.y + 160] as V2, k: says, alpha: said };
    drawBubble(c, bubble);
    g.save(); g.globalCompositeOperation = 'destination-out'; drawBubble(g, bubble); g.restore();
    this.say(c, g, line, t, {
      x: 0, y: 0, size: 76, until: gone,
      path: (_u, k) => (k < 6 ? { x: 322 + 80 * k, y: ROW_B } : k <= 10 ? { x: BUBBLE.x + (k - 8) * 106, y: BUBBLE.y, scale: 1.28 } : { x: 1330 + 82 * (k - 11), y: ROW_B }),
      each: (ch) => { if (ch.k < 6 || ch.k > 10) return; ch.alpha = ch.k === 6 || ch.k === 10 ? 0 : says * says; if (ch.sung > 0) ch.color = rgba('rose'); },
    });
    if (said > 0.003) for (const [k, marks, sg] of [[6, OPEN, -1], [10, CLOSE, 1]] as [number, V2[][], number][]) {
      const w = line.chars[k]!.word!;
      sketch(c, marks, BUBBLE.x + sg * 172, BUBBLE.y - 34, 46, clamp((t - (sg < 0 ? w.start - 0.06 : w.start + 0.12)) / 0.16), { color: rgba('rose', said * smoothstep(gone, gone - 0.4, t)), width: 5.2, seed: 5 + k });
    }
    // 7: one half to either side of the sun, as the clouds leave the sky to it
    // (in the top row: line 6 is still going from the one under it)
    this.say(c, g, L[6]!, t, { x: 0, y: 0, size: 88, style: 'hand', hold: 0.25, path: (_u, k) => ({ x: (k < 3 ? 456 : 1288) + 92 * (k < 3 ? k : k - 4), y: ROW_A + 10 }) });
    // 8: the stars out of her pocket, and the line they take up with them
    if (q > F[7]! - 0.6) drawStarsUp(c, g, { t, rising: this.rising, from: had?.mouth ? scr(had.mouth) : [W / 2, H + 200], gap: scr([(STOP.her + STOP.him[1]!) / 2, 0])[0] });
  }

  override dispose() { this.stage.dispose(); this.own.dispose(); this.grade.mat.dispose(); this.over.texture.dispose(); }
}
