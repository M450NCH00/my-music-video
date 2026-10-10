// The frame every scene is built in, and the ways in from the scene before.
//   Stage: a picture layer and a light layer, composited the same way everywhere (a paper texture
//   under the picture; the light added brighter than white, so only light sources bloom).
//   Transitions: a soft cross-dissolve, a light-leak dissolve, a circular iris (for match cuts).
import * as THREE from 'three';
import { FSPass, Layer2D, W, H, makeRT } from '../engine/gl';
import { LIN, mix, type PaletteKey } from '../engine/palette';
import type { Frame, SceneCtx } from '../engine/scene';
import { clamp, ease } from '../engine/util';
import type { Ctx } from './_love-rig';

let paperPass: FSPass | null = null, movePass: FSPass | null = null;
const passes = () => {
  // the picture over paper, with the sheet's texture in it: soft blotches, a fine tooth, faint slanting fibres
  paperPass ??= new FSPass(/* glsl */ `
    uniform sampler2D tex; uniform float amount;
    void main() {
      vec4 c = texture(tex, vUv);
      vec3 col = mix(C_PAPER, toLinear(c.rgb), c.a);   // (the layer's texture holds sRGB values)
      // (the tooth is plain per-pixel noise: noise on a fine lattice reads as a weave)
      float n = 0.55 * fbm(FRAG_PX * 0.011, 4) + 0.5 * (hash12(floor(FRAG_PX)) - 0.5) + 0.2 * snoise(vec2(FRAG_PX.x * 0.021 + FRAG_PX.y * 0.012, FRAG_PX.y * 0.16 - FRAG_PX.x * 0.03) + 31.0);
      fragColor = vec4(col * (1.0 + 0.016 * amount * n), 1.0);
    }`, { tex: { value: null }, amount: { value: 1 } });
  movePass ??= new FSPass(/* glsl */ `
    uniform sampler2D a; uniform sampler2D b; uniform float k; uniform int mode; uniform float t;
    uniform vec3 tint; uniform vec3 tint2; uniform vec2 dir; uniform vec3 circle; uniform float soft;
    void main() {
      vec3 A = texture(a, vUv).rgb, B = texture(b, vUv).rgb, col;
      vec2 px = vec2(vUv.x, 1.0 - vUv.y) * vec2(${W}.0, ${H}.0);
      if (mode == 0) col = mix(A, B, k);
      else if (mode == 1) {
        // light blooms in from one side until it washes the frame (k = 0.5), then clears to b
        float amt = sin(3.14159265 * k); amt *= amt;
        float g = 0.5 - dot(vec2(vUv.x - 0.5, 0.5 - vUv.y), dir);            // 0 on the side the light comes from
        float n = 0.14 * snoise(vUv * vec2(1.6, 0.9) + t * 0.05) * amt;
        float front = amt * 1.75 - 0.36 + n;                                  // how far across the frame the light has come
        float light = 1.0 - smoothstep(front - 0.36, front + 0.36, g);
        vec3 leak = mix(mix(tint, tint2, sat(g * 1.2 + n)), C_PAPER, 0.3) * 1.22;   // brighter than white at its heart: it blooms
        col = mix(mix(A, B, smoothstep(0.46, 0.54, k)), leak, light);
      } else {
        // b inside the circle, a outside
        float d = length(px - circle.xy);
        col = mix(A, B, 1.0 - smoothstep(circle.z - soft, circle.z + soft, d));
      }
      fragColor = vec4(col, 1.0);
    }`, {
    a: { value: null }, b: { value: null }, k: { value: 0 }, mode: { value: 0 }, t: { value: 0 },
    tint: { value: new THREE.Vector3() }, tint2: { value: new THREE.Vector3() }, dir: { value: new THREE.Vector2(1, 0) },
    circle: { value: new THREE.Vector3() }, soft: { value: 2 },
  });
  return { paper: paperPass, move: movePass };
};

/**
 * The handoff from the intro to verse 1: the bell's last sound ring, grown into a soft paper circle
 * that covers the frame (`soundRing(c, x, y, r, { fill: 1 })`: the intro's last frame is all paper).
 * Its centre is where verse 1's clock face is; verse 1 starts on this circle and shrinks it onto the clock's rim.
 */
export const INTRO_RING = { x: W / 2, y: H / 2, r: 1200 } as const;
/**
 * The handoff from verse 1 to chorus 1: the frame washed to warm light. Verse 1's last frame is one flat colour,
 * `VERSE1_WASH.under`, and nothing on the light layer (light brighter than white would burn it out to plain
 * white). The light that washed it there was `lightLeak(g, amount, VERSE1_WASH)`; chorus 1 starts on the flat
 * colour and lets a leak of the same colours clear off its own picture.
 */
export const VERSE1_WASH = { color: 'gold', color2: 'peach', under: mix('paper', 'gold', 0.4) } as const;
/**
 * The handoff from chorus 1 to verse 2: her bedroom window frosted over, so close that its glass covers the frame.
 * `x, y, w, h` is the glass on screen (larger than the frame: the window's own frame is outside it). Chorus 1's
 * last frame is `frost(c, CHORUS1_FROST, 1, CHORUS1_FROST)` (the kit's frost, closed: nothing shows through), and
 * over it the cross of the window's bars: one upright and one level, `bar` px wide, in the flat colour `trim`,
 * through the middle of the glass. Nothing is on the light layer. Verse 2 starts on the same glass and the same
 * cross as its corridor window, and lets the frost go back from there.
 */
export const CHORUS1_FROST = { x: -96, y: -54, w: W + 192, h: H + 108, bar: 40, seed: 7, trim: mix('paper', 'peach', 0.1) } as const;
/**
 * The handoff from verse 2 to chorus 2: the sparkles in his eyes have left them, drifted apart, and are the lamps of
 * an evening street. Verse 2's last frame is the sky of the blue hour and four lamps alight in it, nothing else: the
 * frame filled from its top to its foot with `sky` (a linear gradient, stops at 0, 0.55 and 1), and for each lamp of
 * `at` its soft light on the picture, `glow(c, x, y, halo, { alpha: soft })`, and its bright heart on the light layer,
 * `glow(g, x, y, heart)` (the light layer added at 2.2, as everywhere). Chorus 2 starts on the same sky and the same
 * four lights, and puts its street under them.
 */
export const VERSE2_LAMPS = {
  sky: [mix('navy', 'dusk', 0.4), mix('dusk', 'navy', 0.25), mix('dusk', 'blush', 0.4)],
  at: [[300, 330], [740, 330], [1180, 330], [1620, 330]],
  halo: 330, soft: 0.5, heart: 96,
} as const;

/** How one picture gives way to the next. */
export type Move =
  /** A soft cross-dissolve. */
  | { kind: 'dissolve' }
  /** Light blooms in from one side (`from`, rad: 0 = the right edge, PI / 2 = the bottom, -PI / 2 = the top), washes the frame, and clears to the new picture. */
  | { kind: 'leak'; from?: number; color?: PaletteKey; color2?: PaletteKey }
  /**
   * The new picture inside a circle at (x, y), the old one outside: for match cuts on a round shape
   * (a sound ring into a clock face). Give `r` each frame to drive it; without it the circle opens
   * from the point until it covers the frame. `soft`: the width of its edge, px. `close`: the old
   * picture is the one inside, and the circle closes.
   */
  | { kind: 'iris'; x: number; y: number; r?: number; soft?: number; close?: boolean };

/** Composite picture `a` to picture `b` into `out`, `k` (0..1) of the way through the move. */
export function transition(ctx: SceneCtx, how: Move, a: THREE.Texture, b: THREE.Texture, out: THREE.WebGLRenderTarget | null, k: number, t = 0) {
  const p = passes().move, u = p.u;
  k = clamp(k);
  u.a!.value = a; u.b!.value = b; u.k!.value = k; u.t!.value = t;
  if (how.kind === 'dissolve') u.mode!.value = 0;
  else if (how.kind === 'leak') {
    const from = how.from ?? -0.6;
    u.mode!.value = 1;
    (u.tint!.value as THREE.Vector3).set(...LIN[how.color ?? 'gold']); (u.tint2!.value as THREE.Vector3).set(...LIN[how.color2 ?? 'peach']);
    (u.dir!.value as THREE.Vector2).set(Math.cos(from), Math.sin(from));
  } else {
    const reach = Math.max(Math.hypot(how.x, how.y), Math.hypot(W - how.x, how.y), Math.hypot(how.x, H - how.y), Math.hypot(W - how.x, H - how.y));
    const soft = how.soft ?? 2, r = how.r ?? (how.close ? 1 - k : k) * (reach + 2 * soft) - soft;
    u.mode!.value = 2;
    if (how.close) { u.a!.value = b; u.b!.value = a; }
    (u.circle!.value as THREE.Vector3).set(how.x, how.y, r); u.soft!.value = soft;
  }
  p.render(ctx.renderer, out);
}

/**
 * The two layers of a scene. Each frame: `const { c, g } = stage.begin()`, paint the picture on `c`
 * (the whole frame) and the light sources on `g` (sun, lamps, a phone screen, sparkles, light
 * shafts, leaks: anything that should glow), then `stage.end(out)`, or `stage.enter(f, out, how)`
 * in a scene that sets `handlesTransition = true` and comes in from the one before.
 */
export class Stage {
  readonly base = new Layer2D();
  readonly glow = new Layer2D();
  private own: THREE.WebGLRenderTarget | null = null;
  constructor(private ctx: SceneCtx) {}

  /** Clear both layers. `c`: the picture. `g`: the light. */
  begin(): { c: Ctx; g: Ctx } {
    this.base.clear(); this.glow.clear();
    return { c: this.base.ctx, g: this.glow.ctx };
  }
  /**
   * Composite into `out`. `light`: how bright the light layer is added (default 2.2: its full
   * colours are over twice white, and bloom; 0 if nothing was painted on it). `paper`: the strength
   * of the paper texture (default 1).
   */
  end(out: THREE.WebGLRenderTarget | null, o: { light?: number; paper?: number } = {}) {
    const { renderer, comp } = this.ctx, p = passes().paper, L = o.light ?? 2.2;
    p.u.tex!.value = this.base.upload(); p.u.amount!.value = o.paper ?? 1;
    p.render(renderer, out);
    if (L > 0) comp.draw(renderer, this.glow.upload(), out, { mode: 'add', tint: [L, L, L] });
  }
  /**
   * As end(), but while this scene overlaps the previous one (f.under) it comes in through `how`,
   * eased over the overlap. Outside the overlap it is end().
   */
  enter(f: Frame, out: THREE.WebGLRenderTarget, how: Move, o: { light?: number; paper?: number; ease?: (k: number) => number } = {}) {
    if (!f.under || f.tin >= 1) { this.end(out, o); return; }
    this.own ??= makeRT();
    this.end(this.own, o);
    transition(this.ctx, how, f.under, this.own.texture, out, (o.ease ?? ease.inOutSine)(f.tin), f.t);
  }
  dispose() { this.own?.dispose(); this.base.texture.dispose(); this.glow.texture.dispose(); }
}
