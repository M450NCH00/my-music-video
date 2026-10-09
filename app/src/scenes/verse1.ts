// VERSE 1 — the bell has rung. One slow take around the classroom, a picture for each line:
//   教室钟慢半拍          the classroom clock gets to four a beat after the tower's
//   粉笔灰飘在你发梢      chalk dust settles on his hair (he has just woken up)
//   你低头收书包          he packs his bag, head down
//   我故意收得比谁都慢    she puts one pen away, as slowly as she can; the others walk out
//   窗外球场在吵          past his head, out of the window: a game on the court
//   我只听见心跳乱跳      the room dims; her heart
//   假装还在翻题目        she holds her exercise book up and turns pages, peeking past it
//   其实在等你回头一笑    he turns round and smiles; she ducks behind the book, her heart jumps
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, lerp, mod, prog, pulse, smoothstep, TAU } from '../engine/util';
import { C, ROOM, fade, heart, ink, rain, tickSeconds } from './_school';
import { boy, emptyDesks, girl, roomShell, BAG_X, BOY_REST, GIRL_REST, PANE, PEN_DOWN, STACK_X, type Boy, type Girl } from './_classroom';
import { walker } from './_people';
import { drawYard, TOWER } from './_yard';
import { Caption } from './_caption';

/** The camera for each line: the room's point at the screen centre, and the zoom. */
const SHOTS: [number, number, number][] = [
  [830, 265, 2.3], // the clock, the tower through the window
  [1200, 400, 2.5], // his head
  [1300, 540, 1.75], // him and his desk
  [700, 540, 1.7], // her and her desk
  [1440, 345, 2.3], // the window, over his head
  [560, 500, 2.3], // her, close
  [660, 500, 2.0], // her and the book
  [910, 520, 1.42], // the two of them
];
/** The classmates walking out behind the desks are further away: their colours go toward the wall's. */
const FAR = fade(ROOM, ROOM.wall, 0.3);
/** The camera leaves for a line this long before it starts and settles this long after. */
const LEAD = 1.2, SETTLE = 0.35;

export default class Verse1 extends Scene {
  private layer = new Layer2D();
  private caption!: Caption;
  private L: Line[] = [];
  /** When each line's shot starts, and the beat of the bell (the scene's start). */
  private T: number[] = [];
  private bell0 = 0;
  private packBeat = 0;
  private gameBeat = 0;
  private bookBeat = 0;
  /** He turns on 回, is smiling by the end of 头, and her heart jumps on 笑. */
  private tTurn = 0;
  private tSmile = 0;
  private tPop = 0;

  override init() {
    const { lyrics, audio, start, end } = this.ctx;
    this.L = lyrics.lines.filter((l) => l.start > start - 0.5 && l.start < end);
    if (this.L.length !== SHOTS.length) throw new Error(`verse1: ${this.L.length} lines in the window, expected ${SHOTS.length}`);
    this.caption = new Caption(this.L);
    this.T = this.L.map((l, i) => (i === 0 ? start : l.start));
    this.bell0 = Math.round(audio.beatAt(start));
    this.packBeat = audio.beatAt(this.T[2]!);
    this.gameBeat = audio.beatAt(this.T[4]!);
    this.bookBeat = audio.beatAt(this.T[6]!);
    const last = this.L[7]!;
    this.tTurn = last.words.find((w) => w.w.includes('回'))?.start ?? last.start + 1;
    this.tSmile = (last.words.find((w) => w.w.includes('头'))?.start ?? last.start + 1.5) + 0.12;
    this.tPop = last.words.find((w) => w.w.includes('笑'))?.start ?? last.start + 2;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, b = f.beat, { T, L: lines } = this;
    /** 0 → 1 as the camera travels to shot i. */
    const tr = (i: number) => (i <= 0 ? 1 : i >= T.length ? 0 : ease.inOutCubic(clamp((t - (T[i]! - LEAD)) / (LEAD + SETTLE))));
    /** How much shot i is on screen. */
    const on = (i: number) => tr(i) - tr(i + 1);

    // ---- the camera: from shot to shot, with a slow drift
    let cx = 0, cy = 0, lz = 0;
    SHOTS.forEach((s, i) => { const k = on(i); cx += s[0] * k; cy += s[1] * k; lz += Math.log(s[2]) * k; });
    cx += 7 * Math.sin(t * 0.41);
    cy += 4 * Math.cos(t * 0.33);
    const zoom = Math.exp(lz) * (1 + 0.012 * Math.sin(t * 0.27));

    // ---- the yard: the tower's clock runs on, the bell rings and dies away; for the court the view tilts down
    const sec = tickSeconds(b, this.bell0, true);
    const ringing = 1 - smoothstep(this.bell0 + 8, this.bell0 + 15, b);
    const yard = {
      h: 3 + (59 + sec / 60) / 60, m: 59 + sec / 60, s: sec,
      bell: -0.28 * Math.cos((b - this.bell0) * Math.PI) * ringing,
      ring: ringing * (0.55 + 0.45 * Math.abs(Math.sin((b - this.bell0) * Math.PI))),
      game: t > T[4]! - 3 ? b - this.gameBeat + 2 : null,
    };
    const L2 = this.layer;
    L2.clear();
    const c = L2.ctx;
    const ez = 0.5 * zoom;
    c.save();
    c.translate((PANE.x - cx) * zoom + W / 2 + (cx - 760) * zoom * 0.12, (PANE.y - cy) * zoom + H / 2 + (cy - 540) * zoom * 0.12);
    c.scale(ez, ez);
    c.translate(-TOWER.x, -lerp(300, 760, on(4)));
    drawYard(c, t, yard);
    c.restore();
    rain(c, t, { n: 340, seed: 1, len: 44 * ez, speed: 1250 * ez, alpha: 0.46, width: 1.8 });

    // ---- the classroom clock: three seconds and one beat behind; it jumps as it gets to four
    const slow = tickSeconds(b - 1, this.bell0, true) - 3;
    const four = this.ctx.audio.timeOfBeat(this.bell0 + 7);

    // ---- the boy: yawns, gets dusted, packs (a book every two beats, then the zip), turns round
    const yawn = Math.min(smoothstep(T[0]! + 0.5, T[0]! + 0.9, t), 1 - smoothstep(T[0]! + 2.0, T[0]! + 2.4, t));
    const q = (b - this.packBeat) / 2;
    const turned = prog(t, this.tTurn - 0.05, this.tTurn + 0.3, ease.inOutCubic);
    const he: Boy = {
      hand: BOY_REST, stack: 3, zip: 0,
      bag: prog(t, T[2]! - 0.9, T[2]! - 0.2, ease.outBack),
      tilt: lerp(lerp(0.04 - 0.14 * yawn, 0.16, prog(t, T[2]! - 0.5, T[2]!, ease.inOutCubic)), 0.02, turned),
      lean: 0.2 * prog(t, T[2]! - 0.6, T[2]! - 0.1, ease.inOutCubic) * (1 - turned),
      turn: 1 - 2 * turned,
      face: {
        eye: yawn > 0.5 ? 'closed' : t < T[1]! + 1.4 ? 'sleepy' : t >= this.tSmile ? 'happy' : 'open',
        mouth: yawn > 0.5 ? 'open' : t >= this.tSmile ? 'smile' : 'flat',
        dust: prog(t, T[1]! + 0.2, lines[1]!.end),
      },
    };
    if (q >= 0 && q < 3) {
      const i = Math.floor(q), u = q - i, top: [number, number] = [STACK_X + 50, 596 - 14 * (2 - i)], into: [number, number] = [BAG_X - 10, 476];
      he.carry = u >= 0.3 && u < 0.72;
      he.stack = 3 - i - (u >= 0.3 ? 1 : 0);
      if (u < 0.3) he.hand = mix(BOY_REST, top, ease.inOutQuad(u / 0.3));
      else if (u < 0.72) he.hand = arc(top, into, ease.inOutQuad((u - 0.3) / 0.42), 46);
      else he.hand = mix(into, BOY_REST, ease.inOutQuad((u - 0.72) / 0.28));
    } else if (q >= 3) {
      he.stack = 0;
      he.zip = prog(q, 3.1, 4.3, ease.inOutQuad);
      const zipAt: [number, number] = [lerp(BAG_X - 84, BAG_X + 8, he.zip), 492];
      he.hand = mix(mix(BOY_REST, zipAt, prog(q, 3, 3.2)), [1036, 590], turned);
    }

    // ---- the girl: looks up at the clock; puts the pen away; her heart; the book; ducks
    const u3 = prog(t, T[3]!, lines[3]!.end);
    // (her hand creeps to the pencil case, stalls, pulls back a little, and only then lets the pen slide in)
    const creep = u3 < 0.4 ? ease.inOutQuad(u3 / 0.4) : u3 < 0.6 ? 1 - 0.3 * Math.sin(((u3 - 0.4) / 0.2) * Math.PI) : 1;
    const slide = prog(u3, 0.62, 0.98, ease.inOutQuad);
    const away = prog(t, lines[3]!.end, lines[3]!.end + 0.7, ease.inOutCubic);
    const up = prog(t, T[6]! - 0.9, T[6]! - 0.3, ease.outBack);
    const duck = prog(t, this.tTurn + 0.25, this.tTurn + 0.6, ease.outCubic);
    const peek = up > 0.5 && mod(b - this.bookBeat, 4) >= 2;
    const flustered = Math.max(on(5), duck);
    const she: Girl = {
      hand: mix(mix(GIRL_REST, [738, 590 - 8 * Math.sin(creep * Math.PI)], creep * (1 - away)), [700, 566 - 24 * duck], up),
      pen: away >= 1 ? null : { angle: lerp(PEN_DOWN, 0.06, creep), grip: lerp(0.15, 1.02, slide), hit: 0 },
      tilt: 0.1 - 0.22 * on(0) + 0.1 * duck,
      duck: 20 * duck,
      face: {
        eye: flustered > 0.5 ? 'wide' : [0.9, 4.1, 9.3, 13.2, 21.4].some((x) => Math.abs(t - T[0]! - x) < 0.07) ? 'closed' : 'open',
        look: on(0) > 0.5 ? [0.0, -0.06] : up > 0.5 && !peek && duck < 0.5 ? [0.02, 0.05] : [0.05, peek ? -0.03 : 0],
        blush: 1 + 0.8 * flustered + 0.5 * tr(5),
        mouth: 'flat',
      },
      book: { up, flip: Math.max(0, b - this.bookBeat + 1) * 2 },
    };

    c.save();
    c.translate(W / 2, H / 2);
    c.scale(zoom, zoom);
    c.translate(-cx, -cy);
    roomShell(c, t, { glass: 1, h: 3 + (59 + slow / 60) / 60, m: 59 + slow / 60, s: slow, pop: 1 + 0.22 * pulse(t, four, 0.1) });
    // the others on their way out, behind the row of desks
    const looks = [{ hair: 'ponytail', skirt: true, bag: FAR.red }, { hair: 'short', bag: FAR.teal }] as const;
    [[-1.3, 470], [0.8, 520]].forEach(([t0, v], i) => {
      const x = -260 + v! * (t - T[3]! - t0!);
      if (x < -400 || x > 2500) return;
      c.save();
      c.translate(x, 892);
      c.scale(1.02, 1.02);
      walker(c, t, FAR, (x / 128) * Math.PI + i, looks[i]!);
      c.restore();
    });
    emptyDesks(c);
    boy(c, t, he);
    // chalk dust in the light of the window, drifting down onto him
    const dust = smoothstep(T[1]! - 1.4, T[1]! - 0.2, t) * (1 - smoothstep(T[2]! + 0.6, T[2]! + 2.2, t));
    if (dust > 0.01) {
      c.fillStyle = C.paper;
      for (let i = 0; i < 60; i++) {
        const u = mod(t * (0.1 + 0.08 * hash(i, 41)) + hash(i, 42), 1);
        const x = 1040 + 560 * hash(i, 43) - 150 * u + 12 * Math.sin(u * 11 + i), y = 170 + (300 + 140 * hash(i, 44)) * u;
        c.globalAlpha = dust * Math.min(smoothstep(0, 0.15, u), 1 - smoothstep(0.75, 1, u)) * 0.85;
        c.beginPath();
        c.arc(x, y, 1.6 + 2.2 * hash(i, 45), 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    // "I only hear my heart": everything but her goes dim
    if (on(5) > 0.01) {
      c.fillStyle = `rgba(30,32,52,${0.5 * on(5)})`;
      c.fillRect(cx - W, cy - H, W * 2, H * 2);
    }
    girl(c, t, she);
    // her heart: a double beat, quicker and quicker; it stays, smaller, and jumps when he smiles
    const show = tr(5);
    if (show > 0.01) {
      const rate = 1 + prog(t, T[5]!, lines[5]!.end) * (1 - tr(6));
      const ph = mod(b * rate, 1);
      const pump = Math.max(Math.exp(-ph * 7), ph > 0.3 ? 0.8 * Math.exp(-(ph - 0.3) * 7) : 0);
      const big = lerp(0.62, 1, on(5)) + 0.7 * pulse(t, this.tPop, 0.25);
      const hx = 586, hy = 598 + 20 * duck, s = 30 * show * big * (1 + 0.32 * pump);
      for (const k of [0, 1]) {
        const r = mod(ph + k * 0.5, 1);
        heart(c, hx, hy, s * (1.3 + 1.5 * r));
        c.globalAlpha = (1 - r) * 0.7 * show * on(5);
        ink(c, null, 4, ROOM.red);
      }
      c.globalAlpha = 1;
      heart(c, hx, hy, s);
      ink(c, C.red, 3);
      // small hearts off her head once he has smiled
      for (let i = 0; i < 4; i++) {
        const u = (t - this.tPop - 0.1 * i) / 1.6;
        if (u <= 0 || u >= 1) continue;
        heart(c, 520 + 46 * i + 14 * Math.sin(u * 6 + i), 300 - 150 * u, 15 * ease.outBack(clamp(u / 0.25)));
        c.globalAlpha = 1 - smoothstep(0.6, 1, u);
        ink(c, C.red, 3);
        c.globalAlpha = 1;
      }
    }
    c.restore();

    this.caption.draw(c, t);
    comp.draw(renderer, L2.upload(), out, { mode: 'replace' });
    return { bloom: 0.3, bloomThreshold: 0.78, halation: 0.04, ca: 0.3, grain: 0.03, vignette: 0.3 };
  }
}

const mix = (a: readonly [number, number], b: readonly [number, number], u: number): [number, number] => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
/** From a to b along an arc `h` px high. */
const arc = (a: readonly [number, number], b: readonly [number, number], u: number, h: number): [number, number] => [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - h * Math.sin(u * Math.PI)];
