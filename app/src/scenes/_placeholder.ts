// PLACEHOLDER — what a part of the song shows until its own scene is built (docs/PROMPTS.md, one
// prompt per part): paper, the part's name, and the lyrics by the karaoke rule, so that the whole
// song plays end to end. A part's scene file (intro.ts, verse1.ts, ...) is one line of this until
// its prompt replaces the file. When no scene imports this any more, delete it.
import * as THREE from 'three';
import { Scene, type Frame, type SceneClass } from '../engine/scene';
import { W, H } from '../engine/gl';
import { mix, rgba } from '../engine/palette';
import { CJK_MID, F, font } from '../engine/type';
import { smoothstep } from '../engine/util';
import { LYRIC_LEAD, Stage, drawLyric } from './_love';

const TITLE = '《下课再见》';
/** A sung line stays this long after its last character, unless its place is needed sooner. */
const HOLD = 1.6;
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/**
 * The placeholder scene of a part. `name`: the part's name, or a function giving it from the
 * timeline entry's params (for a module that serves two entries). `file`: its scene file.
 */
export function placeholder(name: string | ((params: Record<string, any>) => string), file: string): SceneClass {
  return class Placeholder extends Scene {
    stage = new Stage(this.ctx);
    label = typeof name === 'string' ? name : name(this.ctx.params);

    render(f: Frame, out: THREE.WebGLRenderTarget) {
      const { lyrics, audio } = this.ctx, t = f.t, { c } = this.stage.begin();
      // paper, a little warmer toward the bottom
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba('paper')); g.addColorStop(1, mix('paper', 'peach', 0.2));
      c.fillStyle = g; c.fillRect(0, 0, W, H);

      // the part, and where it is in the song
      c.textBaseline = 'alphabetic';
      c.font = font(F.sans(700), 40); c.fillStyle = rgba('ink', 0.6);
      c.fillText(this.label, 96, 140);
      c.font = font(F.sans(400), 22); c.fillStyle = rgba('ink', 0.4);
      c.fillText(`placeholder for scenes/${file}.ts, ${clock(f.start)} to ${clock(f.end)}`, 96, 178);

      // the lyrics, in two places taken in turn, so that the next line can wait under (or over) the one
      // being sung. Lines are drawn by time, whichever part they belong to: at a cut the line carries on.
      const lines = lyrics.lines;
      let quiet = Infinity;   // how far t is from any line on screen, s
      lines.forEach((line, i) => {
        const again = lines[i + 2], from = line.start - LYRIC_LEAD;
        const until = again ? again.start - LYRIC_LEAD - 0.08 : Infinity, gone = Math.min(line.end + HOLD, until);
        quiet = Math.min(quiet, t < from ? from - t : t > gone ? t - gone : 0);
        if (t < from || t > gone + 0.1) return;
        drawLyric(c, line, t, { x: W / 2, y: H / 2 + (i % 2 ? 84 : -84), size: 104, maxWidth: 1560, hold: HOLD, until });
      });
      // the title where nobody sings; it comes out of the paper at the start and goes back into it at the end
      const a = smoothstep(0.3, 1.5, quiet) * smoothstep(0, 1.2, t) * (1 - smoothstep(audio.duration - 2.2, audio.duration - 0.4, t));
      if (a > 0.003) {
        c.font = font(F.hand(500), 150); c.textAlign = 'center'; c.fillStyle = rgba('ink', a);
        c.fillText(TITLE, W / 2, H / 2 + 150 * CJK_MID);
        c.textAlign = 'left';
      }
      this.stage.end(out, { light: 0 });
    }

    override dispose() { this.stage.dispose(); }
  };
}
