// KARAOKE — the whole song as plain synced type: the line being sung in the middle, lit character
// by character with the voice, the next line waiting below, the title in the gaps without vocals.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, layout, fitSize, type TextLayout } from '../engine/type';
import { Lyrics, type Line } from '../engine/lyrics';
import { clamp, ease, prog, smoothstep } from '../engine/util';

const TITLE = '下课再见';
/** A line appears this long before its first character and stays this long after its last. */
const LEAD = 0.6, HOLD = 1.2;
const MAX_W = 1560, MAX_SIZE = 124;

interface Set { line: Line; lay: TextLayout; size: number; x0: number }

export default class Karaoke extends Scene {
  private bg = new FSPass(/* glsl */ `
    uniform float t, level, beat;
    void main() {
      vec2 p = (vUv - 0.5) * vec2(16.0 / 9.0, 1.0);
      // a slow warm glow behind the type, breathing with the music
      float g = exp(-dot(p - vec2(0.0, 0.02), p - vec2(0.0, 0.02)) * 2.6);
      float n = 0.5 + 0.5 * fbm(p * 1.6 + vec2(t * 0.03, -t * 0.02), 4);
      vec3 c = C_INK + C_SIGNAL * 0.05 * g * (0.55 + 0.45 * n) * (0.6 + 0.6 * level + 0.25 * beat);
      fragColor = vec4(c, 1.0);
    }`, { t: { value: 0 }, level: { value: 0 }, beat: { value: 0 } });
  private text = new Layer2D();
  private sets: Set[] = [];

  override init() {
    const family = F.sc(700);
    this.sets = this.ctx.lyrics.lines.map((line) => {
      const size = fitSize(line.text, family, MAX_W, MAX_SIZE);
      const lay = layout(line.text, family, size);
      return { line, lay, size, x0: (W - lay.width) / 2 };
    });
  }

  /** x (px, from the line's left edge) reached after `chars` characters of the line (fractional). */
  private xAt(lay: TextLayout, chars: number) {
    const g = lay.glyphs;
    if (chars <= 0 || g.length === 0) return 0;
    const i = Math.floor(chars);
    if (i >= g.length) return lay.width;
    return g[i]!.x + g[i]!.w * (chars - i);
  }

  /** Opacity of line i at t: in before its first character, out before the next line needs the place. */
  private alpha(i: number, t: number) {
    const s = this.sets[i]!.line, next = this.sets[i + 1]?.line;
    const out1 = next ? Math.min(s.end + HOLD, next.start - LEAD * 0.5) : s.end + HOLD * 2;
    const out0 = Math.max(s.end, out1 - 0.35);
    return prog(t, s.start - LEAD, s.start - LEAD + 0.3, ease.outCubic) * (1 - smoothstep(out0, Math.max(out1, out0 + 0.05), t));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    this.bg.u.t!.value = t;
    this.bg.u.level!.value = f.a.rms;
    this.bg.u.beat!.value = Math.pow(1 - f.beatPhase, 3);
    this.bg.render(renderer, out);

    const L = this.text; L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    const sets = this.sets;
    // the line on stage: the latest one that has appeared
    let cur = -1;
    for (let i = 0; i < sets.length; i++) if (t >= sets[i]!.line.start - LEAD) cur = i;

    let shown = 0;
    if (cur >= 0) {
      const s = sets[cur]!, a = this.alpha(cur, t);
      shown = a;
      if (a > 0.003) {
        const y = H / 2 + s.size * 0.34;
        c.font = font(s.lay.family, s.size);
        c.globalAlpha = a;
        c.fillStyle = rgba('graphite', 0.9);
        c.fillText(s.line.text, s.x0, y);
        // the sung part, wiped in over the unsung line
        const x = this.xAt(s.lay, Lyrics.lineCharProgress(s.line, t));
        if (x > 0) {
          c.save();
          c.beginPath();
          c.rect(s.x0 - 20, y - s.size * 1.2, x + 20, s.size * 1.7);
          c.clip();
          c.fillStyle = rgba('bone', 1);
          c.fillText(s.line.text, s.x0, y);
          c.restore();
        }
        c.globalAlpha = 1;
      }
    }
    // the next line, small, while the current one is on stage
    const nx = sets[cur + 1];
    if (nx && cur >= 0 && nx.line.start - sets[cur]!.line.end < 6) {
      const a = shown * (1 - prog(t, nx.line.start - LEAD - 0.25, nx.line.start - LEAD));
      if (a > 0.003) {
        const size = nx.size * 0.42;
        c.font = font(F.sc(400), size);
        c.fillStyle = rgba('ash', 0.55 * a);
        c.textAlign = 'center';
        c.fillText(nx.line.text, W / 2, H / 2 + 190);
        c.textAlign = 'left';
      }
    }
    // the title while nobody sings: before the first line, in long gaps, after the last
    const prevEnd = cur >= 0 ? sets[cur]!.line.end + HOLD * 2 : 0;
    const nextIn = sets[cur + 1] ? sets[cur + 1]!.line.start - LEAD : Infinity;
    const ta = clamp(Math.min(smoothstep(prevEnd, prevEnd + 1.2, t), 1 - smoothstep(nextIn - 1.4, nextIn - 0.5, t), smoothstep(0, 1.2, t))) * (1 - shown);
    if (ta > 0.003) {
      c.textAlign = 'center';
      c.font = font(F.sc(900), 168);
      c.fillStyle = rgba('bone', ta);
      c.letterSpacing = '18px';
      c.fillText(TITLE, W / 2 + 9, H / 2 + 56);
      c.letterSpacing = '0px';
      c.textAlign = 'left';
    }
    comp.draw(renderer, L.upload(), out);
    return { bloom: 0.5, grain: 0.5 };
  }
}
