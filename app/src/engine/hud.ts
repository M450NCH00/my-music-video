// Global overlay drawn over every scene: the crop-mark frame. It is hidden by default
// (PostParams.hud = 0); a scene that wants it returns `hud: 1` and a `frame` amount.
import { Layer2D, W, H } from './gl';
import { rgba } from './palette';
import { clamp, ease, lerp } from './util';

export interface HudState {
  /** Opacity of the whole overlay (PostParams.hud). */
  opacity: number;
  /** 0..1 the crop-mark frame: 1 in place, 0 flown out past the edges (see PostParams.frame). */
  frame: number;
  /** 0..1: the frame is light (paper) — draw the crop marks in ink. */
  paper: number;
}

export class Hud {
  layer = new Layer2D();

  draw(st: HudState) {
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    if (st.opacity <= 0.001) return L.upload();
    c.globalAlpha = st.opacity;
    if (st.frame > 0.001) this.cropMarks(c, st.frame, st.paper > 0.5);
    return L.upload();
  }

  /** Corner marks; as `k` drops they fly out along the diagonals and past the edges. */
  private cropMarks(c: CanvasRenderingContext2D, k: number, ink: boolean) {
    const e = ease.inOutCubic(clamp(k));
    c.save();
    c.globalAlpha *= clamp(k * 3);
    c.strokeStyle = ink ? rgba('ink', 0.45) : rgba('bone', 0.34);
    c.lineWidth = 1.25;
    const m = lerp(-40, 36, e), l = 22;
    c.beginPath();
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as const) {
      c.moveTo(x + sx * l, y + 0.5 * sy); c.lineTo(x, y + 0.5 * sy); c.lineTo(x, y + sy * l);
    }
    c.stroke();
    c.restore();
  }
}
