// KARAOKE — a stand-in until the parts of the song have their own scenes: the whole song as plain
// synced type on paper. The line follows the karaoke rule of docs/TREATMENT.md: its characters wait
// at 35% opacity from 0.4 s before the line, each turns rose as it starts being sung, and the line
// settles to ink once it is over. The title shows where nobody sings.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { CJK_MID, F, font, layout, fitSize, type TextLayout } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, smoothstep } from '../engine/util';

const TITLE = '下课再见';
/** A line's characters appear this long before its first one is sung; the sung line stays this long. */
const LEAD = 0.4, HOLD = 1.2;
const MAX_W = 1500, MAX_SIZE = 120;

interface Set { line: Line; lay: TextLayout; size: number; x0: number }

export default class Karaoke extends Scene {
  private bg = new FSPass(/* glsl */ `
    void main() {
      // paper, a little warmer toward the bottom, with a faint fibre texture
      vec3 c = mix(C_PAPER, mix(C_PAPER, C_PEACH, 0.22), smoothstep(0.1, 1.0, 1.0 - vUv.y));
      c *= 1.0 + 0.012 * (0.5 * fbm(FRAG_PX * 0.012, 4) + 0.5 * snoise(FRAG_PX * 0.35));
      fragColor = vec4(c, 1.0);
    }`, {});
  private text = new Layer2D();
  private sets: Set[] = [];

  override init() {
    const family = F.hand(500);
    this.sets = this.ctx.lyrics.lines.map((line) => {
      const size = fitSize(line.text, family, MAX_W, MAX_SIZE);
      const lay = layout(line.text, family, size);
      return { line, lay, size, x0: (W - lay.width) / 2 };
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    this.bg.render(renderer, out);

    const L = this.text; L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    const sets = this.sets;
    // the line on stage: the latest one whose characters have appeared
    let cur = -1;
    for (let i = 0; i < sets.length; i++) if (t >= sets[i]!.line.start - LEAD) cur = i;

    let shown = 0;
    if (cur >= 0) {
      const s = sets[cur]!, { line } = s, next = sets[cur + 1]?.line;
      // gone before the next line's characters need the place
      const gone = next ? Math.min(line.end + HOLD, next.start - LEAD - 0.1) : line.end + HOLD * 2;
      shown = smoothstep(line.start - LEAD, line.start - LEAD + 0.2, t) * (1 - smoothstep(Math.max(line.end, gone - 0.3), Math.max(gone, line.end + 0.05), t));
      if (shown > 0.003) {
        const y = H / 2 + s.size * CJK_MID;
        const settled = smoothstep(line.end, line.end + 0.5, t);
        c.font = font(s.lay.family, s.size);
        s.lay.glyphs.forEach((g, k) => {
          const w = line.chars[k]?.word;
          if (!w) return;
          // (never ahead of the voice: a character changes at its own start, over 80 ms)
          const sung = clamp((t - w.start) / 0.08);
          c.globalAlpha = shown * (0.35 + 0.65 * sung);
          c.fillStyle = sung > 0 ? mix('rose', 'ink', settled) : rgba('ink');
          c.fillText(g.ch, s.x0 + g.x, y);
        });
        c.globalAlpha = 1;
      }
    }
    // the title where nobody sings: before the first line, in long gaps, after the last
    const prevEnd = cur >= 0 ? sets[cur]!.line.end + HOLD * 2 : 0;
    const nextIn = sets[cur + 1] ? sets[cur + 1]!.line.start - LEAD : Infinity;
    const ta = clamp(Math.min(smoothstep(prevEnd, prevEnd + 1.2, t), 1 - smoothstep(nextIn - 1.4, nextIn - 0.5, t), smoothstep(0, 1.2, t))) * (1 - shown);
    if (ta > 0.003) {
      c.textAlign = 'center';
      c.font = font(F.hand(500), 168);
      c.fillStyle = rgba('ink', ta);
      c.letterSpacing = '18px';
      c.fillText(TITLE, W / 2 + 9, H / 2 + 168 * CJK_MID);
      c.letterSpacing = '0px';
      c.textAlign = 'left';
    }
    comp.draw(renderer, L.upload(), out);
  }
}
