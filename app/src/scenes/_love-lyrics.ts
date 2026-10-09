// The lyric renderer: one line, character by character, by the karaoke rule of docs/TREATMENT.md.
//   - its characters wait at 35% opacity from up to 0.4 s before the line;
//   - each turns rose when it starts being sung (never earlier);
//   - after the line they settle to ink, or to paper on dark scenes.
// The lyrics live inside the world, so this only draws a line where and how the scene says:
// as handwriting, in chalk, in composition-paper squares, or floating along a path.
import { CJK_MID, F, font, layout } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { W, H } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { clamp, mulberry32, smoothstep, TAU } from '../engine/util';
import { scratch } from './_love-fx';
import type { Ctx } from './_love-rig';

/** Unsung characters may show this long before their line starts, at GHOST opacity. */
export const LYRIC_LEAD = 0.4, LYRIC_GHOST = 0.35;

export type LyricStyle = 'plain' | 'hand' | 'chalk' | 'grid';
export interface LyricOpts {
  /** Where the line sits: the centre of its block (of both rows when it is broken in two), or its left end with align 'left'. */
  x: number; y: number;
  /** Character size, px. */
  size: number;
  /**
   * plain: the characters change colour. hand: each is written in as it is sung (a stroke-reveal wipe).
   * chalk: written in, in chalk, for a blackboard (dark by default). grid: handwriting in
   * composition-paper squares (作文格), one character a square.
   */
  style?: LyricStyle;
  /** The line settles to paper instead of ink: for dark scenes. */
  dark?: boolean;
  align?: 'center' | 'left';
  /** 2 = break the line into two rows at its space (the natural pause). Default: only if it is wider than maxWidth. */
  rows?: 1 | 2;
  /** The widest a row may be, px (default: the title-safe width); a line still too wide is drawn smaller. */
  maxWidth?: number;
  /** Extra space between characters, px; the distance between rows as a factor of the size (default 1.4). */
  tracking?: number; leading?: number;
  /** Weight of the handwritten face: 300, 400 or 500 (default). */
  weight?: number;
  /** 0..1 overall opacity. */
  alpha?: number;
  /** The line stays this long after its last character, then fades (default: it stays); and a time by which it must be gone. */
  hold?: number; until?: number;
  /** Opacity of characters not yet sung (default 0.35; 0 = they only appear as they are sung). */
  ghost?: number;
  /** Rotate the whole line about (x, y), rad. */
  angle?: number;
  /**
   * Floating text: where character k of n goes instead of on a straight row. `u` (0..1) is its place
   * along the line. Return its centre, and if wanted a rotation (rad) and a scale.
   */
  path?: (u: number, k: number, n: number) => { x: number; y: number; angle?: number; scale?: number };
  /** Called for each character once it is placed, before it is drawn: change its x, y, angle, scale, alpha or color. */
  each?: (ch: LyricChar) => void;
  /** grid: the square's side as a factor of the size (default 1.3), the colour of its lines, and whether to draw the squares at all. */
  cell?: number; gridColor?: string; squares?: boolean;
  /** Other colours than the rule's for the sung character and the settled line (palette tokens or blends). */
  sungColor?: string; restColor?: string;
}
/** One character as it was drawn (returned by drawLyric, for effects that follow the singing). */
export interface LyricChar {
  ch: string; k: number; word: Word | null;
  /** Its centre, rotation and size on screen. */
  x: number; y: number; angle: number; scale: number; size: number;
  /** 0 = not yet sung .. 1 = sung (written in); and seconds since it started being sung (negative before). */
  sung: number; since: number;
  alpha: number; color: string;
}

let chalkTile: HTMLCanvasElement | null = null;
/** What chalk leaves out: specks and short scratches, as a repeating tile. */
function chalkGaps() {
  if (chalkTile) return chalkTile;
  const n = 128, cv = document.createElement('canvas'), c = cv.getContext('2d')!, rnd = mulberry32(88);
  cv.width = cv.height = n;
  c.fillStyle = rgba('ink');
  for (let i = 0; i < 1500; i++) { c.globalAlpha = 0.3 + rnd() * 0.7; c.beginPath(); c.arc(rnd() * n, rnd() * n, 0.35 + rnd() * 1.1, 0, TAU); c.fill(); }
  c.strokeStyle = rgba('ink'); c.lineCap = 'round';
  for (let i = 0; i < 90; i++) { const x = rnd() * n, y = rnd() * n, a = -0.6 + rnd() * 0.5, l = 3 + rnd() * 9; c.globalAlpha = 0.25 + rnd() * 0.4; c.lineWidth = 0.5 + rnd() * 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  return (chalkTile = cv);
}

/**
 * Draw one lyric line at time t by the karaoke rule. Returns its characters as drawn.
 * Call it every frame the line is on screen: it draws nothing before the line's lead-in.
 */
export function drawLyric(c: Ctx, line: Line, t: number, o: LyricOpts): LyricChar[] {
  const style = o.style ?? 'plain', dark = o.dark ?? style === 'chalk', ghost = o.ghost ?? LYRIC_GHOST, grid = style === 'grid';
  const family = F.hand(o.weight ?? 500);
  const shown = smoothstep(line.start - LYRIC_LEAD, line.start - LYRIC_LEAD + 0.25, t);
  const gone = Math.min(o.until ?? Infinity, line.end + (o.hold ?? Infinity));
  const A = (o.alpha ?? 1) * shown * (gone === Infinity ? 1 : 1 - smoothstep(Math.max(line.end, gone - 0.4), Math.max(gone, line.end + 0.05), t));
  if (A <= 0.003) return [];
  const settled = smoothstep(line.end, line.end + 0.5, t);
  const rest = o.restColor ?? (dark ? (style === 'chalk' ? rgba('paper', 0.92) : rgba('paper')) : rgba('ink'));
  const sungCol = mix(o.sungColor ?? (style === 'chalk' ? mix('rose', 'paper', 0.22) : 'rose'), rest, settled);

  // ---- where each character goes
  const chars = line.chars, text = line.text, maxW = o.maxWidth ?? W - 192;
  let size = o.size;
  const cell = size * (o.cell ?? 1.3), lead = grid ? cell : size * (o.leading ?? 1.4);
  const sp = chars.map((ch, k) => (ch.ch === ' ' ? k : -1)).filter((k) => k >= 0);
  const widthOf = (a: number, z: number) => (grid ? (z - a) * cell : layout(chars.slice(a, z).map((x) => x.ch).join(''), family, size, o.tracking ?? 0).width);
  let cut = -1;
  if (!o.path && sp.length && (o.rows === 2 || (o.rows !== 1 && widthOf(0, chars.length) > maxW))) cut = sp.reduce((best, k) => (Math.abs(k - chars.length / 2) < Math.abs(best - chars.length / 2) ? k : best), sp[0]!);
  const rows: [number, number][] = cut < 0 ? [[0, chars.length]] : [[0, cut], [cut + 1, chars.length]];
  if (!grid && !o.path) { const widest = Math.max(...rows.map(([a, z]) => widthOf(a, z))); if (widest > maxW) size *= maxW / widest; }
  const out: LyricChar[] = [];
  const total = o.path ? layout(text, family, size, o.tracking ?? 0) : null;
  rows.forEach(([a, z], r) => {
    const lay = grid ? null : total ?? layout(chars.slice(a, z).map((x) => x.ch).join(''), family, size, o.tracking ?? 0);
    const width = grid ? (z - a) * cell : lay!.width, left = o.align === 'left' ? 0 : -width / 2, y = (r - (rows.length - 1) / 2) * lead;
    for (let k = a; k < z; k++) {
      const ch = chars[k]!, w = ch.word, g = lay?.glyphs[k - a];
      const lx = left + (grid ? (k - a + 0.5) * cell : g!.x + g!.w / 2);
      const since = w ? t - w.start : -Infinity;
      const dur = w ? Math.min(0.45, Math.max(0.12, w.end - w.start)) : 1;
      const sung = clamp(since / (style === 'plain' ? 0.08 : dur));
      let pos = { x: lx, y, angle: 0, scale: 1 };
      if (o.path) { const q = o.path(clamp((lx - left) / Math.max(1, width)), k, chars.length); pos = { x: q.x - o.x, y: q.y - o.y, angle: q.angle ?? 0, scale: q.scale ?? 1 }; }
      out.push({ ch: ch.ch, k, word: w, x: pos.x, y: pos.y, angle: pos.angle, scale: pos.scale, size, sung, since, alpha: 1, color: sung > 0 ? sungCol : rest });
    }
  });
  // to screen space (the line may be rotated about its anchor), then the scene's own say
  const ca = Math.cos(o.angle ?? 0), sa = Math.sin(o.angle ?? 0);
  for (const ch of out) {
    const x = ch.x, y = ch.y;
    ch.x = o.x + x * ca - y * sa; ch.y = o.y + x * sa + y * ca; ch.angle += o.angle ?? 0;
    o.each?.(ch);
  }

  // ---- draw: chalk goes through a spare canvas, where its grain is rubbed out of it
  const chalk = style === 'chalk' ? scratch('chalk') : null, d = chalk ? chalk.c : c;
  if (chalk) d.setTransform(c.getTransform());
  d.save();
  d.font = font(family, size); d.textAlign = 'center'; d.textBaseline = 'alphabetic';
  if (grid && o.squares !== false) {
    d.strokeStyle = o.gridColor ?? rgba('ink', 0.22); d.lineWidth = 1.5; d.globalAlpha = A;
    for (const ch of out) { d.save(); d.translate(ch.x, ch.y); d.rotate(ch.angle); d.strokeRect(-cell / 2, -cell / 2, cell, cell); d.restore(); }
  }
  for (const ch of out) {
    if (!ch.word || ch.ch === ' ') continue;
    d.save(); d.translate(ch.x, ch.y); d.rotate(ch.angle); d.scale(ch.scale, ch.scale);
    const by = CJK_MID * size;
    if (style === 'plain') {
      d.globalAlpha = A * ch.alpha * (ghost + (1 - ghost) * ch.sung); d.fillStyle = ch.color;
      if (d.globalAlpha > 0.003) d.fillText(ch.ch, 0, by);
    } else {
      // the character waiting, then written in over it: the wipe runs the way the strokes do, top left to bottom right
      if (ch.sung < 1 && ghost > 0) { d.globalAlpha = A * ch.alpha * ghost; d.fillStyle = rest; d.fillText(ch.ch, 0, by); }
      if (ch.sung > 0) {
        if (ch.sung < 1) {
          // (a half-plane across the character's square: its edge travels along the diagonal)
          const h = size * 0.66, ex = 0.8214, ey = 0.5704, reach = 2 * h * (ex + ey) * ch.sung, far = size * 3;
          const at = (u: number, v: number): [number, number] => [-h + u * ex - v * ey, -h + u * ey + v * ex];
          d.beginPath();
          [at(-far, -far), at(reach, -far), at(reach, far), at(-far, far)].forEach(([x, y], i) => (i ? d.lineTo(x, y) : d.moveTo(x, y)));
          d.closePath(); d.clip();
        }
        d.globalAlpha = A * ch.alpha; d.fillStyle = ch.color; d.fillText(ch.ch, 0, by);
      }
    }
    d.restore();
  }
  d.restore();
  if (chalk) {
    const p = d.createPattern(chalkGaps(), 'repeat');
    d.setTransform(1, 0, 0, 1, 0, 0);
    if (p) { d.globalCompositeOperation = 'destination-out'; d.fillStyle = p; d.fillRect(0, 0, W, H); d.globalCompositeOperation = 'source-over'; }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(chalk.cv, 0, 0, W, H); c.restore();
  }
  return out;
}
