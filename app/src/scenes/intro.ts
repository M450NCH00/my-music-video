// INTRO — a girl at her desk twirls her pen and taps it on the desk, waiting for the bell. The
// camera drifts to the rainy window and out through a pane, across the yard to the school's
// tower: the clock ticks up to the hour, the bell starts to swing. Cut on the first line.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { F, font } from '../engine/type';
import { clamp, ease, lerp, mod, prog, smoothstep, TAU } from '../engine/util';
import { C, rain, tickSeconds } from './_school';
import { boy, emptyDesks, girl, roomShell, GIRL_REST, PANE, PEN_DOWN, PEN_RAISE } from './_classroom';
import { drawYard, TOWER } from './_yard';

const TITLE = '下课再见';
/** The opening frame: the room's point at the screen centre, and the zoom. */
const START = { x: 760, y: 540, zoom: 1.25 };
/** Beats (from the song's first beat): the camera leaves, the push at the pane ends (its edges clear the frame a beat earlier, as the band comes in), it settles on the tower. */
const LEAVE = 10, THROUGH = 20.2, SETTLE = 31;
/** The zoom at which nothing of the room is left in frame. */
const ZOOM_OUT = 14;

/**
 * Her pen routine over one bar (`p` = beats into the bar, 0..4): she lifts her hand and twirls the
 * pen once round her thumb, then taps it on the desk on beats 3 and 4. `lift` = how far the hand
 * is off the desk.
 */
function penAt(p: number) {
  const up = Math.min(smoothstep(0, 0.3, p), 1 - smoothstep(1.45, 1.8, p));
  let angle = PEN_RAISE + TAU * ease.inOutCubic(clamp((p - 0.15) / 1.45));
  let hit = 0;
  for (const tap of [2, 3]) {
    const d = p - tap;
    if (d >= -0.22 && d < 0) angle = lerp(PEN_RAISE, PEN_DOWN, ease.inQuad((d + 0.22) / 0.22));
    else if (d >= 0 && d < 0.5) angle = lerp(PEN_DOWN, PEN_RAISE, ease.outCubic(d / 0.5));
    if (d >= 0 && d < 0.3) hit = 1 - d / 0.3;
  }
  return { angle, grip: lerp(0.15, 0.5, up), hit, lift: 36 * up };
}

export default class Intro extends Scene {
  private layer = new Layer2D();
  /** The beat of the cut to the first verse: the clock strikes the hour there. */
  private endBeat = 35;

  override init() {
    this.endBeat = Math.round(this.ctx.audio.beatAt(this.ctx.end));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, b = f.beat, end = this.endBeat;
    const L = this.layer;
    L.clear();
    const c = L.ctx;

    // ---- the camera in the room: a slow creep, then an accelerating push at one pane
    const zoom = Math.exp(Math.log(START.zoom) + 0.004 * (b + 1) + Math.log(ZOOM_OUT / START.zoom) * prog(b, LEAVE, THROUGH, ease.inQuad));
    const u = prog(b, LEAVE, THROUGH - 1.5, ease.inOutCubic);
    // where the pane's centre is on screen: from its place in the opening frame to the middle
    const px = lerp((PANE.x - START.x) * START.zoom + W / 2, W / 2, u), py = lerp((PANE.y - START.y) * START.zoom + H / 2, H / 2, u);
    const glass = 1 - smoothstep(Math.log(3.2), Math.log(9.5), Math.log(zoom));

    // ---- the yard behind it moves less (it is far away), then the camera travels on to the tower
    const w = prog(b, THROUGH - 3, SETTLE, ease.inOutCubic);
    const ez = 0.625 * Math.exp(Math.log(1.6 / 0.625) * prog(b, LEAVE, SETTLE, ease.inOutCubic)) * (1 + 0.004 * Math.max(0, b - LEAVE));
    const fx = TOWER.x, fy = lerp(300, 258, w);
    const gx = lerp(px, 1240, w), gy = lerp(py, 548, w);

    const sec = tickSeconds(b, end);
    const swing = -0.26 * prog(b, end - 4, end - 0.25, ease.inOutCubic) + 0.02 * Math.sin(t * 9) * prog(b, end - 2, end);
    c.save();
    c.translate(gx, gy);
    c.scale(ez, ez);
    c.translate(-fx, -fy);
    drawYard(c, t, { h: 3 + (59 + sec / 60) / 60, m: 59 + sec / 60, s: sec, bell: swing });
    c.restore();
    // rain: fine and far while seen through the window, heavier once the camera is out in it
    rain(c, t, { n: 340, seed: 1, len: 44 * ez, speed: 1250 * ez, alpha: 0.46, width: 1.8 });
    rain(c, t, { n: 90, seed: 2, len: 120, speed: 2300, alpha: 0.3 * smoothstep(THROUGH - 3, THROUGH + 3, b), width: 2.6 });

    if (zoom < ZOOM_OUT) {
      // the classroom clock runs a little behind the tower's
      const slow = tickSeconds(b - 1, end) - 3;
      c.save();
      c.translate(px, py);
      c.scale(zoom, zoom);
      c.translate(-PANE.x, -PANE.y);
      const pen = penAt(mod(b - 3, 4));
      roomShell(c, t, { glass, h: 3 + (59 + slow / 60) / 60, m: 59 + slow / 60, s: slow });
      emptyDesks(c);
      girl(c, t, {
        hand: [GIRL_REST[0], GIRL_REST[1] - pen.lift], pen, tilt: 0.1 + 0.018 * pen.hit,
        face: { eye: [1.35, 4.95, 7.1].some((x) => Math.abs(t - x) < 0.07) ? 'closed' : 'open' },
      });
      // (he sits to the right of the pane the camera leaves through, and the camera passes above his head)
      boy(c, t, { asleep: true });
      c.restore();
    }

    // ---- the title, a character a beat, in the sky beside the tower
    c.font = font(F.sc(900), 156);
    c.textBaseline = 'alphabetic';
    Array.from(TITLE).forEach((ch, i) => {
      const a = prog(b, SETTLE - 4 + i, SETTLE - 3 + i, ease.outCubic);
      if (a <= 0) return;
      c.globalAlpha = a;
      c.fillStyle = C.paper;
      c.fillText(ch, 150 + i * 176, 520 + 26 * (1 - a));
    });
    c.globalAlpha = 1;

    comp.draw(renderer, L.upload(), out, { mode: 'replace' });
    return { bloom: 0.3, bloomThreshold: 0.78, halation: 0.04, ca: 0.3, grain: 0.03, vignette: 0.3 };
  }
}
