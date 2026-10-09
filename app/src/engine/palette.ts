import { hexToLinear } from './util';

// The palette of 《下课再见》: the ten tokens of docs/TREATMENT.md ("Palette"). Everything on screen
// is one of these or a blend of them. Nothing is pure black: `ink` is the darkest colour.
export const HEX = {
  paper: '#FBF4E8', // cream base, notebooks, light backgrounds
  ink: '#4A3B36', // warm brown line work and dark type
  blush: '#F6C9C4', // cheeks, soft accents, light leaks
  peach: '#F9B79A', // golden-hour skies, warm walls
  gold: '#FFD58A', // sunlight, lamp light, sparkles
  sky: '#A9D3EA', // daytime sky, uniform shirt shading
  dusk: '#B9A7D6', // blue-hour and evening skies
  navy: '#2F3E5C', // school uniform, night
  frost: '#C7D3DE', // winter light, rain, bridge desaturation
  rose: '#E8707E', // the love colour: the sung lyric character, his scarf, the paper stars, the zipper pull. Sparingly, so it always means something.
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** A token or a '#RRGGBB' colour as its three 0..255 channels. */
function channels(key: PaletteKey | string): [number, number, number] {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** CSS rgba() for Canvas2D: a token ('rose') or a hex colour, with an opacity. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const [r, g, b] = channels(key);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * CSS rgba() of the colour a share k (0..1) of the way from `a` to `b`: for gradients, for moods
 * between two tokens, and for far layers (toward a lighter colour = further away).
 */
export function mix(a: PaletteKey | string, b: PaletteKey | string, k: number, alpha = 1): string {
  const ca = channels(a), cb = channels(b), u = Math.min(1, Math.max(0, k));
  return `rgba(${[0, 1, 2].map((i) => Math.round(ca[i]! + (cb[i]! - ca[i]!) * u)).join(',')},${alpha})`;
}
