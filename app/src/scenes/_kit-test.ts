// KIT TEST — not on the timeline: open with ?scene=kit (stills: bun scripts/render.ts stills --scene kit --t 4,12,20,...).
// Everything of the shared kit (_love.ts), one sheet per page, PAGE seconds each, so the look of the two
// characters, the particles, the lyric styles and the transitions can be checked and locked before the
// scenes are built. Pages: her poses, his poses, the design sheet, the two together, particles, lyric
// styles, light and depth, transitions.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { W, H, makeRT } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp } from '../engine/util';
import {
  DESK_TOP, POSES, Stage, atDesk, chalkDust, dottedPath, drawBag, drawBoy, drawDesk, drawGirl, drawLyric, drawPen, drawPhone,
  drawStar, drawStudent, drawUmbrella, dustMotes, glow, layer, leaves, lightLeak, lightShaft, paperGrain, paperScraps, paperStars, petals,
  phoneGlow, rain, snow, sparkle, transition, type Cam, type CharParams, type Ctx, type LyricOpts, type Move, type PoseName, type Shaft,
} from './_love';

export const PAGE = 8;
const BOARD = mix('navy', 'ink', 0.3);

export default class KitTest extends Scene {
  private stage = new Stage(this.ctx);
  // two more pictures and a spare target, for the page of transitions
  private picA = new Stage(this.ctx);
  private picB = new Stage(this.ctx);
  private rtA = makeRT();
  private rtB = makeRT();
  private rtT = makeRT();
  private lines: Record<string, Line> = {};

  override init() {
    const ly = this.ctx.lyrics;
    this.lines = { plain: ly.get('等你下课一起走好不好'), rows: ly.get('慢慢走'), hand: ly.get('把喜欢藏在书包拉链口'), chalk: ly.get('教室钟慢半拍'), grid: ly.get('坐在不同的教室格子里'), path: ly.get('走廊风吹得好吵') };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const page = Math.floor(f.t / PAGE) % 8, lt = f.t - Math.floor(f.t / PAGE) * PAGE;
    if (page === 7) { this.transitions(f, out); return; }
    const { c, g } = this.stage.begin();
    this.backdrop(c);
    [() => this.poses(c, f, false), () => this.poses(c, f, true), () => this.sheet(c, f), () => this.together(c, f), () => this.particles(c, g, f), () => this.lyrics(c, g, lt), () => this.depth(c, g, f)][page]!();
    this.stage.end(out);
  }

  private backdrop(c: Ctx, top = rgba('paper'), low = mix('paper', 'peach', 0.2)) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, low);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  private label(c: Ctx, text: string, x: number, y: number, size = 20, color = rgba('ink', 0.7)) {
    c.font = font(F.sans(500), size); c.textAlign = 'center'; c.fillStyle = color;
    c.fillText(text, x, y);
    c.textAlign = 'left';
  }

  /** One figure in one pose, with whatever the pose holds or sits at. */
  private posed(c: Ctx, f: Frame, boy: boolean, pose: PoseName, x: number, y: number, scale: number, more: Partial<CharParams> = {}) {
    const draw = boy ? drawBoy : drawGirl, t = f.t;
    const p: CharParams = { x, y, scale, t, walk: f.beat, wind: 0.25 * Math.sin(t * 0.9), blush: 0.5, ...more };
    switch (pose) {
      case 'sit-write': {
        p.facing ??= 90;
        const a = atDesk(c, { ...p, boy }, () => draw(c, pose, p));
        drawPen(c, a.handR[0], a.handR[1] - 2 * scale, scale, 0.5);
        break;
      }
      case 'chin-on-hand': p.facing ??= 62; atDesk(c, { ...p, boy }, () => draw(c, pose, p)); break;
      case 'pack-bag': {
        p.facing ??= 90; p.k = 0.5 + 0.5 * Math.sin(t * 1.6);
        const q = { ...p, scale: scale * (boy ? 1.05 : 1) };
        drawDesk(c, q);
        draw(c, pose, { ...p, bag: false });
        drawBag(c, { x: x + 160 * q.scale!, y: y - DESK_TOP * q.scale!, scale: q.scale! * 0.8, boy });
        break;
      }
      case 'turn-smile': p.facing ??= 140; p.k = 0.5 - 0.5 * Math.cos(t * 1.2); draw(c, pose, p); break;
      case 'wave': p.facing ??= 12; p.walk = t * 1.5; draw(c, pose, p); break;
      case 'hold-phone': {
        p.facing ??= 90;
        // (the bed)
        c.fillStyle = mix('paper', 'blush', 0.5);
        c.beginPath(); c.roundRect(x - 250 * scale, y - 6 * scale, 600 * scale, 34 * scale, 14 * scale); c.fill();
        const a = draw(c, pose, p);
        drawPhone(c, (a.handL[0] + a.handR[0]) / 2 + 2 * scale, a.handL[1] - 22 * scale, scale, -0.5, 0.85);
        break;
      }
      case 'hold-umbrella': {
        p.facing ??= 90;
        const a = draw(c, pose, p);
        drawUmbrella(c, { x: a.handR[0], y: a.handR[1], scale, tilt: 0.05 });
        break;
      }
      case 'lean-closer': p.facing ??= 20; p.k = Math.sin(t * 1.2); draw(c, pose, p); break;
      case 'face-each-other': p.facing ??= 90; draw(c, pose, p); break;
      case 'stand': p.facing ??= 30; draw(c, pose, p); break;
      default: p.facing ??= 90; draw(c, pose, p);
    }
  }

  /** Every pose, her or him. */
  private poses(c: Ctx, f: Frame, boy: boolean) {
    this.label(c, boy ? 'HIM: every pose' : 'HER: every pose', W / 2, 52, 26);
    POSES.forEach((pose, i) => {
      const col = i % 6, row = Math.floor(i / 6), x = 160 + col * 320, y = 500 + row * 500;
      this.posed(c, f, boy, pose, pose === 'hold-phone' ? x - 80 : pose === 'sit-write' || pose === 'chin-on-hand' || pose === 'pack-bag' ? x - 50 : x, y, 0.56, { outfit: 'autumn' });
      this.label(c, pose, x, y + 44);
    });
  }

  /** The design sheet: both of them large, from every side, in each outfit, and their faces. */
  private sheet(c: Ctx, f: Frame) {
    const t = f.t, y = 660, s = 0.72;
    this.label(c, 'turnaround, outfits, faces', W / 2, 52, 26);
    const views: [number, string][] = [[0, 'front'], [45, '3/4'], [90, 'side'], [180, 'back']];
    views.forEach(([facing, name], i) => {
      drawGirl(c, 'stand', { x: 130 + i * 200, y, scale: s, facing, t, outfit: 'autumn', wind: 0.2, shadow: 1 });
      drawBoy(c, 'stand', { x: 1030 + i * 200, y, scale: s, facing, t, outfit: 'summer', wind: 0.2, shadow: 1 });
      this.label(c, name, 130 + i * 200, y + 40); this.label(c, name, 1030 + i * 200, y + 40);
    });
    (['summer', 'autumn', 'winter'] as const).forEach((outfit, i) => {
      drawGirl(c, 'stand', { x: 120 + i * 150, y: 1010, scale: 0.44, facing: 35, t, outfit, smile: 1 });
      drawBoy(c, 'stand', { x: 1020 + i * 150, y: 1010, scale: 0.44, facing: 35, t, outfit, smile: 1 });
      this.label(c, outfit, 120 + i * 150, 1046, 17); this.label(c, outfit, 1020 + i * 150, 1046, 17);
    });
    // faces: neutral, smile, shy, turned
    const faces: [string, Partial<CharParams>][] = [['neutral', {}], ['smile', { smile: 1 }], ['shy', { smile: 0.4, blush: 1, nod: 14 }], ['turned', { headTurn: 50, smile: 1 }]];
    faces.forEach(([name, more], i) => {
      c.save();
      c.beginPath(); c.rect(560 + i * 108, 760, 108, 250); c.clip();
      drawGirl(c, 'stand', { x: 614 + i * 108, y: 1290, scale: 0.9, facing: 20, t, ...more });
      c.restore();
      c.save();
      c.beginPath(); c.rect(1460 + i * 108, 760, 108, 250); c.clip();
      drawBoy(c, 'stand', { x: 1514 + i * 108, y: 1320, scale: 0.9, facing: 20, t, ...more });
      c.restore();
      this.label(c, name, 614 + i * 108, 1046, 17); this.label(c, name, 1514 + i * 108, 1046, 17);
    });
  }

  /** The two of them as the scenes will show them, and the students behind. */
  private together(c: Ctx, f: Frame) {
    const t = f.t, y = 900;
    this.label(c, 'together', W / 2, 52, 26);
    // students far behind: one colour each, out of focus
    layer(c, { blur: 3, alpha: 0.8 }, (b) => {
      for (let i = 0; i < 7; i++) drawStudent(b, i % 3 ? 'walk' : 'stand', { x: 120 + i * 270 + ((t * 30 * (i % 2 ? 1 : -1)) % 60), y: 560, scale: 0.42, facing: i % 2 ? 90 : -90, t, walk: f.beat + i * 0.3, boy: i % 2 === 0, silhouette: mix('frost', 'sky', i % 2 ? 0.2 : 0.7) });
    });
    // walking home, side by side
    drawBoy(c, 'walk', { x: 250, y, scale: 0.62, facing: 90, t, walk: f.beat, outfit: 'winter', wind: 0.4, shadow: 1 });
    drawGirl(c, 'walk', { x: 400, y: y + 14, scale: 0.62, facing: 90, t, walk: f.beat + 0.5, outfit: 'winter', wind: 0.4, smile: 0.7, headTurn: 18, shadow: 1 });
    this.label(c, 'walk (winter)', 325, y + 60);
    // the umbrella: she leans closer
    const a = drawBoy(c, 'hold-umbrella', { x: 800, y, scale: 0.62, facing: 75, t, outfit: 'autumn', smile: 0.6, shadow: 1 });
    drawGirl(c, 'lean-closer', { x: 700, y: y + 8, scale: 0.62, facing: 75, t, k: -0.6, outfit: 'autumn', smile: 1, blush: 1, shadow: 1 });
    drawUmbrella(c, { x: a.handR[0], y: a.handR[1], scale: 0.62, tilt: -0.12 });
    this.label(c, 'hold-umbrella + lean-closer', 750, y + 60);
    // face each other
    drawGirl(c, 'face-each-other', { x: 1130, y, scale: 0.62, facing: 90, t, outfit: 'autumn', smile: 1, blush: 0.9, nod: 6, shadow: 1 });
    drawBoy(c, 'face-each-other', { x: 1290, y, scale: 0.62, facing: -90, t, outfit: 'autumn', smile: 1, nod: 8, shadow: 1 });
    drawStar(c, 1210, y - 250 + 6 * Math.sin(t * 2), 15, 0.3 * Math.sin(t));
    this.label(c, 'face-each-other', 1210, y + 60);
    // two rows behind him
    atDesk(c, { x: 1560, y: y - 30, scale: 0.5, facing: 150, boy: true }, () => drawBoy(c, 'sit-write', { x: 1560, y: y - 30, scale: 0.5, facing: 150, t }));
    atDesk(c, { x: 1740, y, scale: 0.62, facing: 150 }, () => drawGirl(c, 'chin-on-hand', { x: 1740, y, scale: 0.62, facing: 150, t, headTurn: -20 }));
    this.label(c, 'from behind', 1650, y + 60);
  }

  /** Every particle system in a panel of its own. */
  private particles(c: Ctx, g: Ctx, f: Frame) {
    const t = f.t, pw = 440, ph = 430;
    this.label(c, 'particles', W / 2, 52, 26);
    const panel = (i: number, name: string, top: string, low: string, dark: boolean, draw: (x: number, y: number) => void) => {
      const x = 40 + (i % 4) * (pw + 27), y = 90 + Math.floor(i / 4) * (ph + 60);
      for (const k of [c, g]) { k.save(); k.beginPath(); k.roundRect(x, y, pw, ph, 18); k.clip(); }
      const gr = c.createLinearGradient(0, y, 0, y + ph);
      gr.addColorStop(0, top); gr.addColorStop(1, low);
      c.fillStyle = gr; c.fillRect(x, y, pw, ph);
      draw(x, y);
      c.restore(); g.restore();
      this.label(c, name, x + pw / 2, y + ph + 34, 20, dark ? rgba('ink', 0.7) : rgba('ink', 0.7));
    };
    panel(0, 'dustMotes (in a light shaft)', mix('paper', 'peach', 0.35), mix('peach', 'ink', 0.25), false, (x, y) => {
      const shaft: Shaft = { x: x + 120, y: y - 20, angle: 0.5, length: 620, width: 130, spread: 2 };
      lightShaft(c, shaft, { alpha: 0.5, t }); lightShaft(g, shaft, { alpha: 0.16, t });
      dustMotes(g, t, { x, y, w: pw, h: ph, count: 60, shafts: [shaft], seed: 3 });
    });
    panel(1, 'chalkDust (drifting, and from the chalk)', BOARD, mix(BOARD, 'ink', 0.3), true, (x, y) => {
      chalkDust(c, t, { x, y, w: pw, h: ph, count: 40, alpha: 0.6 });
      const tip = (at: number): [number, number] => [x + 120 + 200 * (0.5 + 0.5 * Math.sin(at * 0.9)), y + 150 + 16 * Math.sin(at * 6)];
      c.strokeStyle = rgba('paper', 0.85); c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x + 120, y + 150); c.lineTo(tip(t)[0], y + 150); c.stroke();
      chalkDust(c, t, { from: tip, count: 44, seed: 5 });
    });
    panel(2, 'petals', mix('paper', 'gold', 0.5), mix('peach', 'blush', 0.4), false, (x, y) => petals(c, t, { x: x - 30, y: y - 30, w: pw + 60, h: ph + 60, count: 14, wind: 0.3, seed: 2 }));
    panel(3, 'leaves', mix('paper', 'peach', 0.3), mix('gold', 'peach', 0.5), false, (x, y) => leaves(c, t, { x: x - 30, y: y - 30, w: pw + 60, h: ph + 60, count: 8, wind: 0.2, seed: 4 }));
    panel(4, 'paperScraps', mix('frost', 'paper', 0.4), rgba('frost'), false, (x, y) => paperScraps(c, t, { x: x - 30, y: y + 40, w: pw + 60, h: ph - 120, count: 6, seed: 6 }));
    panel(5, 'snow', mix('dusk', 'navy', 0.35), mix('navy', 'ink', 0.2), true, (x, y) => {
      glow(g, x + 330, y + 120, 260, { alpha: 0.7 });
      snow(c, t, { x: x - 30, y: y - 30, w: pw + 60, h: ph + 60, count: 46, wind: -0.2, seed: 7 });
    });
    panel(6, 'rain (with splashes)', mix('frost', 'navy', 0.25), mix('frost', 'navy', 0.5), true, (x, y) => {
      c.fillStyle = mix('frost', 'navy', 0.62); c.fillRect(x, y + ph - 60, pw, 60);
      rain(c, t, { x: x - 30, y: y - 30, w: pw + 60, h: ph + 60, count: 46, ground: y + ph - 40, seed: 8 });
    });
    panel(7, 'paperStars (rising, and from a point)', mix('dusk', 'peach', 0.5), mix('peach', 'gold', 0.5), false, (x, y) => {
      paperStars(c, t, { x: x - 30, y: y - 30, w: pw + 60, h: ph + 60, count: 5, seed: 9, alpha: 0.75, size: 0.7 });
      const since = Math.floor(t / PAGE) * PAGE + 0.5, bag = drawBag(c, { x: x + 110, y: y + ph - 16, scale: 0.9, zip: clamp((t - since) * 2) });
      paperStars(c, t, { from: bag.mouth, since: since + 0.5, rate: 1.6, count: 9, seed: 11, size: 0.9 });
      for (let i = 0; i < 3; i++) sparkle(g, x + 250 + i * 60, y + 120 + 40 * i, 16, 0.5 + 0.5 * Math.sin(t * 3 + i * 2));
    });
  }

  /** A lyric line in each style. Each line is run through within the page, so a still shows it half sung. */
  private lyrics(c: Ctx, g: Ctx, lt: number) {
    this.label(c, 'lyric styles: waiting at 35%, rose as it is sung, ink (or paper) once the line is over', W / 2, 52, 24);
    const run = (name: string, o: LyricOpts, note: string, nx: number, ny: number, style = rgba('ink', 0.6)) => {
      const line = this.lines[name]!, t = line.start - 0.9 + (lt / PAGE) * (line.end - line.start + 2.4);
      const chars = drawLyric(c, line, t, o);
      this.label(c, note, nx, ny, 18, style);
      return { chars, t, line };
    };
    run('plain', { x: 480, y: 170, size: 74 }, 'plain', 480, 250);
    run('rows', { x: 1440, y: 190, size: 74, rows: 2 }, 'plain, two rows (broken at the pause)', 1440, 300);
    // handwriting on a notebook page
    c.save(); c.translate(480, 470); c.rotate(-0.03);
    c.fillStyle = rgba('paper'); c.shadowColor = rgba('ink', 0.18); c.shadowBlur = 24; c.shadowOffsetY = 8;
    c.beginPath(); c.roundRect(-400, -110, 800, 220, 8); c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = mix('sky', 'paper', 0.3); c.lineWidth = 1.5;
    for (let i = -1; i <= 2; i++) { c.beginPath(); c.moveTo(-380, i * 56); c.lineTo(380, i * 56); c.stroke(); }
    c.beginPath(); c.roundRect(-400, -110, 800, 220, 8); c.clip();
    paperGrain(c, { x: -400, y: -110, w: 800, h: 220 });
    c.restore();
    const hand = run('hand', { x: 480, y: 462, size: 70, style: 'hand', angle: -0.03 }, 'hand (each character is written in)', 480, 620);
    // (the pen follows the character being written)
    const writing = hand.chars.find((ch) => ch.sung > 0 && ch.sung < 1);
    if (writing) drawPen(c, writing.x - 24 + 48 * writing.sung, writing.y - 20 + 40 * writing.sung, 1.1, 0.6);
    // chalk on the blackboard
    c.fillStyle = BOARD; c.beginPath(); c.roundRect(1010, 370, 860, 220, 10); c.fill();
    c.strokeStyle = mix('peach', 'ink', 0.35); c.lineWidth = 10; c.strokeRect(1010, 370, 860, 220);
    const chalk = run('chalk', { x: 1440, y: 478, size: 92, style: 'chalk' }, 'chalk (dark: settles to paper)', 1440, 620);
    const tip = chalk.chars.find((ch) => ch.sung > 0 && ch.sung < 1);
    if (tip) chalkDust(c, chalk.t, { from: [tip.x, tip.y + 30], count: 14, seed: 2 });
    // composition-paper squares
    c.fillStyle = rgba('paper'); c.fillRect(110, 690, 760, 200);
    paperGrain(c, { x: 110, y: 690, w: 760, h: 200 });
    run('grid', { x: 490, y: 790, size: 58, style: 'grid', gridColor: mix('rose', 'paper', 0.45) }, 'grid (composition-paper squares, one character each)', 490, 930);
    // floating along a path, each character lifting as it is sung
    const path = (u: number) => ({ x: 1090 + 700 * u, y: 800 - 60 * Math.sin(u * Math.PI) + 14 * Math.sin(u * 9 + lt), angle: -0.3 * Math.cos(u * Math.PI) });
    dottedPath(c, Array.from({ length: 9 }, (_, i) => { const q = path(i / 8); return [q.x, q.y + 62] as [number, number]; }), 1, { alpha: 0.3 });
    const fl = run('path', { x: 0, y: 0, size: 66, style: 'hand', path, each: (ch) => { ch.y -= 10 * clamp(ch.since * 3) * clamp(1 - (ch.since - 0.3) * 2); } }, 'path (floating, with a per-character hook)', 1440, 930);
    for (const ch of fl.chars) if (ch.since > 0 && ch.since < 0.5) sparkle(g, ch.x + 30, ch.y - 34, 14, Math.sin((ch.since / 0.5) * Math.PI));
    this.label(c, 'the same line settled (dark scene)', 960, 1050, 18);
    c.fillStyle = mix('navy', 'dusk', 0.2); c.beginPath(); c.roundRect(560, 960, 800, 62, 12); c.fill();
    drawLyric(c, this.lines.plain!, this.lines.plain!.end + 2, { x: 960, y: 992, size: 40, dark: true });
  }

  /** Parallax layers with haze and focus, a light shaft with dust in it, a light leak, the sun on the light layer. */
  private depth(c: Ctx, g: Ctx, f: Frame) {
    const t = f.t, cam: Cam = { x: 60 * Math.sin(t * 0.4), y: 6 * Math.sin(t * 0.3), zoom: 1.03 + 0.02 * Math.sin(t * 0.25) };
    // sky (never moves), far school, trees, the two of them, a leaf close to the lens
    this.backdrop(c, mix('sky', 'paper', 0.35), mix('peach', 'gold', 0.5));
    layer(c, { cam, depth: 0.25, blur: 3, haze: 0.45, hazeColor: mix('paper', 'peach', 0.4) }, (b) => {
      b.fillStyle = mix('peach', 'ink', 0.3); b.fillRect(-200, 430, 1500, 520);
      b.fillStyle = mix('gold', 'paper', 0.4);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) b.fillRect(-150 + i * 118, 480 + r * 130, 70, 78);
    });
    layer(c, { cam, depth: 0.55, blur: 1.5, haze: 0.2, hazeColor: mix('paper', 'peach', 0.4) }, (b) => {
      for (let i = 0; i < 6; i++) {
        const x = 80 + i * 400;
        b.fillStyle = mix('ink', 'peach', 0.35); b.fillRect(x - 9, 640, 18, 330);
        b.fillStyle = mix('gold', 'peach', 0.45); b.beginPath(); b.arc(x, 600, 130, 0, Math.PI * 2); b.arc(x + 90, 660, 90, 0, Math.PI * 2); b.arc(x - 95, 670, 84, 0, Math.PI * 2); b.fill();
      }
    });
    layer(c, { cam, depth: 1 }, (b) => {
      b.fillStyle = mix('peach', 'ink', 0.22); b.fillRect(-300, 960, W + 600, 300);
      dottedPath(b, [[-100, 1010], [500, 1000], [1100, 1016], [2100, 1002]], 1, { color: 'paper', alpha: 0.6 });
      drawBoy(b, 'walk', { x: 880, y: 965, scale: 0.92, facing: 90, t, walk: f.beat, outfit: 'autumn', wind: 0.3, shadow: 1 });
      drawGirl(b, 'walk', { x: 1080, y: 985, scale: 0.92, facing: 90, t, walk: f.beat + 0.5, outfit: 'autumn', wind: 0.3, smile: 0.8, shadow: 1 });
    });
    layer(c, { cam, depth: 1, alpha: 1 }, (b) => leaves(b, t, { count: 7, wind: 0.3, seed: 12 }));
    layer(c, { cam, depth: 1.8, blur: 9, alpha: 0.9 }, (b) => {
      b.fillStyle = mix('gold', 'peach', 0.6);
      b.save(); b.translate(250, 250 + 20 * Math.sin(t * 0.8)); b.rotate(0.5 + 0.1 * Math.sin(t));
      b.beginPath(); b.moveTo(0, -170); b.quadraticCurveTo(150, -30, 0, 190); b.quadraticCurveTo(-150, -30, 0, -170); b.fill();
      b.restore();
      b.fillStyle = mix('peach', 'ink', 0.35); b.fillRect(1500, 0, 140, H);   // a window frame passing close
    });
    // the light: the sun, a shaft with the dust that shows in it, a leak from the corner
    glow(g, 1500, 200, 520);
    const shaft: Shaft = { x: 1400, y: 150, angle: -0.75, length: 1250, width: 230, spread: 2.2 };
    lightShaft(c, shaft, { alpha: 0.3, t }); lightShaft(g, shaft, { alpha: 0.07, t });
    dustMotes(g, t, { count: 90, shafts: [shaft] });
    lightLeak(g, 0.35 + 0.1 * Math.sin(t * 0.5), { from: 2.4, t });
    this.label(c, 'five layers (far ones hazed and out of focus), light shaft + dust, sun and leak on the light layer', W / 2, 1050, 20, rgba('paper', 0.95));
  }

  /** The three transitions from one picture to another, each a quarter, half and three quarters of the way. */
  private transitions(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx, t = f.t, fw = 520, fh = (fw * H) / W;
    // picture A: afternoon; picture B: blue hour
    let s = this.picA.begin();
    this.backdrop(s.c, mix('paper', 'gold', 0.45), rgba('peach'));
    s.c.fillStyle = mix('peach', 'ink', 0.2); s.c.fillRect(0, 900, W, 180);
    drawGirl(s.c, 'wave', { x: 960, y: 930, scale: 1.1, facing: 15, t, walk: t * 1.5, outfit: 'summer', shadow: 1 });
    this.picA.end(this.rtA, { light: 0 });
    s = this.picB.begin();
    this.backdrop(s.c, mix('dusk', 'navy', 0.45), mix('dusk', 'peach', 0.35));
    s.c.fillStyle = mix('navy', 'ink', 0.2); s.c.fillRect(0, 900, W, 180);
    drawBoy(s.c, 'turn-smile', { x: 960, y: 930, scale: 1.1, facing: 140, t, k: 1, outfit: 'winter', shadow: 1 });
    snow(s.c, t, { count: 60 });
    glow(s.g, 1500, 300, 480);
    this.picB.end(this.rtB);
    // the page itself, then the three moves as small frames on it
    s = this.stage.begin();
    this.backdrop(s.c);
    this.label(s.c, 'transitions: 25%, 50% and 75% of the way from one picture to the next', W / 2, 52, 26);
    const moves: [string, Move][] = [['dissolve', { kind: 'dissolve' }], ['leak', { kind: 'leak', from: -0.6 }], ['iris', { kind: 'iris', x: 960, y: 420, soft: 3 }]];
    const at = (row: number, col: number): [number, number] => [250 + col * (fw + 24), 96 + row * (fh + 26)];
    moves.forEach(([name], row) => this.label(s.c, name, 124, at(row, 0)[1] + fh / 2 + 8, 24));
    this.stage.end(out, { light: 0 });
    moves.forEach(([, how], row) => [0.25, 0.5, 0.75].forEach((k, col) => {
      transition(this.ctx, how, this.rtA.texture, this.rtB.texture, this.rtT, k, t);
      // (a small frame at (x, y): the compositor's uv scale and offset)
      const [x, y] = at(row, col), sc = W / fw, cx = (x + fw / 2) / W, cy = (y + fh / 2) / H;
      comp.draw(renderer, this.rtT.texture, out, { scale: [sc, sc], offset: [(0.5 - cx) * sc, (cy - 0.5) * sc], premult: false });
    }));
  }

  override dispose() { for (const s of [this.stage, this.picA, this.picB]) s.dispose(); for (const r of [this.rtA, this.rtB, this.rtT]) r.dispose(); }
}
