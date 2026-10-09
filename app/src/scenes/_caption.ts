// The sung line over a cartoon scene: one line at the foot of the frame, outlined like the
// drawing, each character turning from grey to white with a small hop as it is sung.
import { W } from '../engine/gl';
import { F, font, layout, fitSize, type TextLayout } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, prog, ease, smoothstep } from '../engine/util';
import { C, type Ctx } from './_school';

/** A line appears this long before its first character and stays this long after its last. */
const LEAD = 0.45, HOLD = 1.0;
const UNSUNG = '#98A3B6';

export class Caption {
  private sets: { line: Line; lay: TextLayout; size: number; x0: number }[];

  constructor(lines: Line[], private y = 1004, size = 68, maxWidth = 1500) {
    const family = F.sc(700);
    this.sets = lines.map((line) => {
      const s = fitSize(line.text, family, maxWidth, size);
      const lay = layout(line.text, family, s);
      return { line, lay, size: s, x0: (W - lay.width) / 2 };
    });
  }

  draw(c: Ctx, t: number) {
    this.sets.forEach((s, i) => {
      const { line } = s, next = this.sets[i + 1]?.line;
      const out = next ? Math.min(line.end + HOLD, next.start - LEAD - 0.1) : line.end + HOLD;
      const a = prog(t, line.start - LEAD, line.start - LEAD + 0.25, ease.outCubic) * (1 - smoothstep(Math.max(line.end, out - 0.25), Math.max(out, line.end + 0.05), t));
      if (a <= 0.003) return;
      c.save();
      c.globalAlpha = a;
      c.font = font(s.lay.family, s.size);
      c.textBaseline = 'alphabetic';
      c.lineJoin = 'round';
      const glyphs = Array.from(line.text).map((ch, k) => ({ ch, g: s.lay.glyphs[k]! }));
      // which word (sung character) each glyph belongs to: glyph index = code-point index
      const at = (k: number) => {
        let u = 0, n = 0;
        for (const ch of line.text) { if (n === k) break; u += ch.length; n++; }
        return line.words.find((w) => u >= w.at && u < w.at + w.w.length);
      };
      const state = glyphs.map(({ ch, g }, k) => {
        const w = at(k), since = w ? t - w.start : -1;
        const hop = since >= 0 ? Math.pow(1 - clamp(since / 0.24), 2) : 0;
        return { ch, x: s.x0 + g.x + g.w / 2, w: g.w, sung: since >= 0, hop };
      });
      for (const pass of [0, 1]) {
        for (const g of state) {
          if (g.ch === ' ') continue;
          c.save();
          c.translate(g.x, this.y - 12 * g.hop);
          c.scale(1 + 0.2 * g.hop, 1 + 0.2 * g.hop);
          if (pass === 0) {
            c.strokeStyle = C.line;
            c.lineWidth = s.size * 0.16;
            c.strokeText(g.ch, -g.w / 2, 0);
          } else {
            c.fillStyle = g.sung ? C.paper : UNSUNG;
            c.fillText(g.ch, -g.w / 2, 0);
          }
          c.restore();
        }
      }
      c.restore();
    });
  }
}
