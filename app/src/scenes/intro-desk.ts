// INTRO, shot 1 — her desk from above: the open notebook (neat maths in ink and, in the margin, the
// umbrella doodle that the outro finishes), her right hand spinning a pen round its thumb, and the sun
// through the window blinds lying across the page in stripes. The outro closes on this same desk.
import { mix, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, hash, lerp, mod, smoothstep, TAU } from '../engine/util';
import { dustMotes, paperGrain, type Ctx, type V2 } from './_love';

// (the figure's own blends, _love-rig.ts and _love-props.ts: this is her hand, her cardigan and her desk)
const SKIN = mix('paper', 'peach', 0.4), SKIN_LOW = mix('paper', 'peach', 0.64);
const BEIGE = mix(mix('paper', 'gold', 0.4), 'ink', 0.08), BEIGE_LOW = mix(mix('paper', 'peach', 0.5), 'ink', 0.18);
const WOOD = mix(mix('paper', 'peach', 0.55), 'ink', 0.1), WOOD_LOW = mix(mix('paper', 'peach', 0.7), 'ink', 0.3);
const PEN = mix('navy', 'dusk', 0.25);

/**
 * How far the pen has turned round her thumb at beat `beat`, in turns: one full spin a beat, flicked in the
 * second half of the beat and caught on it. Every fourth catch is a little off: the pen wobbles, then settles.
 */
export function penSpin(beat: number): number {
  const n = Math.floor(beat), u = beat - n;
  const wobble = mod(n, 4) === 2 ? 0.05 * Math.exp(-5 * u) * Math.sin(u * TAU * 2.5) : 0;
  return n + ease.inOutSine(clamp((u - 0.42) / 0.58)) + wobble;
}

// ------------------------------------------------------------------ the doodle in the margin
/** The umbrella, then the two small figures under it, stroke by stroke (the umbrella is 2 units wide, its rim at y = 0). */
const DOODLE: V2[][] = (() => {
  const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 18): V2[] => Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n); return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as V2; });
  const curve = (a: V2, m: V2, b: V2, n = 10): V2[] => Array.from({ length: n + 1 }, (_, i) => { const u = i / n; return [(1 - u) ** 2 * a[0] + 2 * u * (1 - u) * m[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * m[1] + u * u * b[1]] as V2; });
  return [
    arc(0, 0, 1, 0.95, Math.PI, TAU, 24),                                                   // the canopy
    arc(-2 / 3, 0, 1 / 3, 0.16, Math.PI, TAU, 8), arc(0, 0, 1 / 3, 0.16, Math.PI, TAU, 8), arc(2 / 3, 0, 1 / 3, 0.16, Math.PI, TAU, 8),   // its scalloped rim
    [[0, -0.95], [0, -1.13]],                                                               // the tip
    curve([0, -0.95], [-0.38, -0.62], [-1 / 3, -0.14]),                                     // a rib
    [[0, -0.12], [0, 1.2]],                                                                 // the shaft: the intro stops part of the way down it
    arc(-0.17, 1.2, 0.17, 0.17, 0, Math.PI, 8),                                             // the crook of the handle
    curve([0, -0.95], [0.38, -0.62], [1 / 3, -0.14]),                                       // the other rib
    arc(-0.43, 0.42, 0.16, 0.16, -Math.PI / 2, TAU - Math.PI / 2, 14), [[-0.43, 0.6], [-0.66, 1.16], [-0.2, 1.16], [-0.43, 0.6]],             // her: a head, a skirt
    arc(0.4, 0.36, 0.16, 0.16, -Math.PI / 2, TAU - Math.PI / 2, 14), [[0.4, 0.54], [0.4, 0.94]], [[0.28, 1.2], [0.4, 0.94], [0.52, 1.2]],     // him: a head, a body, legs
  ];
})();
/** How much of the doodle the intro shows: the canopy, one rib, and the shaft begun. The outro draws the rest. */
export const DOODLE_UNFINISHED = 6.42;
/**
 * The margin doodle at (x, y) (the middle of the umbrella's rim), `size` px from the rim to its top:
 * `strokes` of it drawn (6.42 = six strokes and part of the seventh; Infinity = finished, with the two figures).
 */
export function drawDoodle(c: Ctx, x: number, y: number, size: number, strokes = Infinity, o: { color?: string; width?: number } = {}) {
  c.save();
  c.strokeStyle = o.color ?? rgba('ink', 0.78); c.lineWidth = o.width ?? Math.max(1.5, size * 0.05); c.lineCap = 'round'; c.lineJoin = 'round';
  DOODLE.forEach((pts, i) => {
    const k = clamp(strokes - i);
    if (k <= 0) return;
    const reach = k * (pts.length - 1);
    c.beginPath();
    for (let j = 0; j <= Math.ceil(reach); j++) {
      const u = Math.min(j, reach), a = pts[Math.floor(u)]!, b = pts[Math.min(pts.length - 1, Math.floor(u) + 1)]!, f = u - Math.floor(u);
      // (a hand drew it: nothing is quite where it should be)
      const px = x + (lerp(a[0], b[0], f) + (hash(i, j, 1) - 0.5) * 0.035) * size, py = y + (lerp(a[1], b[1], f) + (hash(i, j, 2) - 0.5) * 0.035) * size;
      if (j) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.stroke();
  });
  c.restore();
}

// ------------------------------------------------------------------ the notebook
/** The open notebook: where its spine starts (px of the picture), how it lies, the width of a page, and its ruling. */
const BOOK = { x: 450, y: 70, rot: -0.105, w: 1080, top: -40, bottom: 1500, rule0: 120, rule: 74, margin: 150 };
/** Her working, line by line: [ruled line, x from the margin rule, text]. */
const WORK: [number, number, string][] = [
  [0, 26, '1.'], [0, 92, 'x² - 5x + 6 = 0'], [1, 92, '(x - 2)(x - 3) = 0'], [2, 92, 'x = 2,  x = 3'],
  [4, 26, '2.'], [4, 92, 'Rt△ABC,  a = 3,  b = 4'], [5, 92, 'c² = a² + b² = 9 + 16 = 25'], [6, 92, 'c = √25 = 5'],
  [8, 26, '3.'], [8, 92, 'y = x² - 4x + 3'], [9, 130, '= (x - 2)² - 1'],
];
/** What is left of the page before: [ruled line, x from the spine (negative: on the left page), text]. */
const BEFORE: [number, number, string][] = [[1, -410, 'S = πr²'], [2, -372, '= π × 6²'], [3, -372, '= 36π ≈ 113.1'], [5, -410, 'C = 2πr'], [6, -372, '= 12π ≈ 37.7'], [8, -410, 'V = πr²h'], [9, -372, '= 36π × 5'], [10, -372, '= 180π']];

function notebook(c: Ctx, doodle: number) {
  const B = BOOK, h = B.bottom - B.top;
  c.save(); c.translate(B.x, B.y); c.rotate(B.rot);
  // the pages, with their shadow on the desk; a few more sheets showing under their outer edges
  c.save();
  c.shadowColor = rgba('ink', 0.3); c.shadowBlur = 44; c.shadowOffsetX = -10; c.shadowOffsetY = 16;
  c.fillStyle = mix('paper', 'ink', 0.12); c.beginPath(); c.roundRect(-B.w - 14, B.top + 8, B.w * 2 + 28, h, 10); c.fill();
  c.restore();
  c.fillStyle = mix('paper', 'ink', 0.05); c.beginPath(); c.roundRect(-B.w - 7, B.top + 4, B.w * 2 + 14, h, 8); c.fill();
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(-B.w, B.top, B.w * 2, h, 6); c.fill();
  c.save(); c.beginPath(); c.roundRect(-B.w, B.top, B.w * 2, h, 6); c.clip();
  // ruling: the lines, and each page's margin
  c.strokeStyle = mix('sky', 'paper', 0.3); c.lineWidth = 2;
  c.beginPath();
  for (let y = B.rule0; y < B.bottom; y += B.rule) { c.moveTo(-B.w, y); c.lineTo(B.w, y); }
  c.stroke();
  c.strokeStyle = mix('blush', 'peach', 0.5); c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(B.margin, B.top); c.lineTo(B.margin, B.bottom); c.moveTo(-B.w + B.margin, B.top); c.lineTo(-B.w + B.margin, B.bottom); c.stroke();
  // her working, in ink
  c.fillStyle = rgba('ink', 0.88); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = font(F.hand(400), 47);
  for (const [line, x, text] of WORK) c.fillText(text, B.margin + x, B.rule0 + line * B.rule - 11 + (hash(line, x) - 0.5) * 4);
  for (const [line, x, text] of BEFORE) c.fillText(text, x, B.rule0 + line * B.rule - 11 + (hash(line, x, 3) - 0.5) * 4);
  c.strokeStyle = rgba('ink', 0.8); c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
  c.font = font(F.hand(400), 30);
  // (problem 1: the parabola through 2 and 3)
  c.save(); c.translate(868, 150);
  const X = (x: number) => -62 + 34 * x, Y = (y: number) => 62 - 34 * y;
  c.beginPath();
  c.moveTo(-96, 62); c.lineTo(116, 62); c.moveTo(104, 55); c.lineTo(116, 62); c.lineTo(104, 69);
  c.moveTo(-62, 96); c.lineTo(-62, -92); c.moveTo(-69, -80); c.lineTo(-62, -92); c.lineTo(-55, -80);
  for (let i = 0; i <= 30; i++) { const x = lerp(0.72, 4.28, i / 30), y = (x - 2) * (x - 3); if (i) c.lineTo(X(x), Y(y)); else c.moveTo(X(x), Y(y)); }
  c.stroke();
  c.fillText('x', 122, 74); c.fillText('y', -56, -98); c.fillText('O', -90, 92); c.fillText('2', X(2) - 7, 94); c.fillText('3', X(3) - 5, 94);
  for (const r of [2, 3]) { c.beginPath(); c.arc(X(r), 62, 4.5, 0, TAU); c.fill(); }
  c.restore();
  // (problem 2: the right-angled triangle)
  c.save(); c.translate(905, 450);
  c.beginPath(); c.moveTo(0, 58); c.lineTo(90, 58); c.lineTo(0, -62); c.closePath(); c.moveTo(0, 44); c.lineTo(14, 44); c.lineTo(14, 58); c.stroke();
  c.fillText('C', -30, 76); c.fillText('B', 98, 76); c.fillText('A', -28, -58); c.fillText('3', 38, 90); c.fillText('4', -28, 10); c.fillText('c', 54, -10);
  c.restore();
  // the doodle, in the margin beside it all
  drawDoodle(c, 77, 648, 58, doodle);
  paperGrain(c, { x: -B.w, y: B.top, w: B.w * 2, h, alpha: 0.9, scale: 1.6 });
  // the pages curve down into the spine
  for (const sg of [1, -1]) {
    const g = c.createLinearGradient(0, 0, sg * 120, 0);
    g.addColorStop(0, rgba('ink', sg > 0 ? 0.2 : 0.26)); g.addColorStop(0.3, rgba('ink', 0.07)); g.addColorStop(1, rgba('ink', 0));
    c.fillStyle = g; c.fillRect(sg > 0 ? 0 : -120, B.top, 120, h);
  }
  c.restore();
  c.restore();
}

// ------------------------------------------------------------------ her hand and the pen
/** Where the pen turns: on her thumb. Px of the picture. */
export const PEN_AT: V2 = [1090, 700];
const PEN_REST = (120 * Math.PI) / 180;

/** A rounded limb from `a` (radius ra) to `b` (radius rb). */
function capsule(p: Path2D, a: V2, b: V2, ra: number, rb: number) {
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]), d = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.asin(clamp((ra - rb) / Math.max(d, 1e-3), -1, 1));
  p.moveTo(a[0] + ra * Math.cos(th + Math.PI / 2 - k), a[1] + ra * Math.sin(th + Math.PI / 2 - k));
  p.arc(a[0], a[1], ra, th + Math.PI / 2 - k, th - Math.PI / 2 + k);
  p.arc(b[0], b[1], rb, th - Math.PI / 2 + k, th + Math.PI / 2 - k);
  p.closePath();
}
const turn = (p: V2, about: V2, a: number): V2 => { const ca = Math.cos(a), sa = Math.sin(a), x = p[0] - about[0], y = p[1] - about[1]; return [about[0] + x * ca - y * sa, about[1] + x * sa + y * ca]; };

function drawPenBig(c: Ctx, angle: number, alpha = 1) {
  // (along +x: its point at 150, its end at -180)
  c.save(); c.rotate(angle); c.globalAlpha *= alpha; c.lineCap = 'round';
  const body = new Path2D(); body.roundRect(-180, -12, 292, 24, 11);
  const g = c.createLinearGradient(0, -12, 0, 12);
  g.addColorStop(0, mix(PEN, 'paper', 0.22)); g.addColorStop(0.45, PEN); g.addColorStop(1, mix(PEN, 'ink', 0.3));
  c.fillStyle = g; c.fill(body);
  c.fillStyle = mix('frost', 'navy', 0.28); c.beginPath(); c.moveTo(110, -11); c.lineTo(141, -3.5); c.lineTo(141, 3.5); c.lineTo(110, 11); c.closePath(); c.fill();   // the cone
  c.fillStyle = rgba('ink'); c.beginPath(); c.moveTo(141, -3.5); c.lineTo(151, 0); c.lineTo(141, 3.5); c.closePath(); c.fill();                                    // the point
  c.fillStyle = mix(PEN, 'ink', 0.25); c.fillRect(64, -12, 44, 24);                                                                                               // the grip
  c.fillStyle = mix('frost', 'paper', 0.3); c.fillRect(-150, -12, 7, 24);                                                                                         // a ring near the end
  c.strokeStyle = mix('frost', 'paper', 0.3); c.lineWidth = 5; c.beginPath(); c.moveTo(-172, -13); c.lineTo(-92, -13); c.stroke();                                // the clip
  c.strokeStyle = rgba('paper', 0.4); c.lineWidth = 2.5; c.beginPath(); c.moveTo(-136, -6.5); c.lineTo(58, -6.5); c.stroke();                                     // the light along it
  c.restore();
}

function hand(c: Ctx, t: number, beat: number) {
  const n = Math.floor(beat), u = beat - n, spin = penSpin(beat), bump = (x: number) => Math.exp(-x * x * 4);
  // the flick that starts each spin, the small give as the pen is caught, and (after a bad catch) the fumble
  const flick = bump((u - 0.44) / 0.09), caught = bump(u / 0.12), fumble = mod(n, 4) === 2 ? Math.exp(-5 * u) * Math.sin(u * TAU * 2.5) : 0;
  const O = PEN_AT, wrist: V2 = [392, 162];
  c.save(); c.translate(O[0], O[1]);
  c.translate(wrist[0], wrist[1]); c.rotate(0.006 * Math.sin(t * 0.9) + 0.012 * fumble - 0.006 * caught); c.translate(-wrist[0], -wrist[1]);
  const fill = (p: Path2D, top = SKIN, low = SKIN_LOW, line = 0.26) => {
    const g = c.createLinearGradient(330, -230, 40, 150);   // lit from the window, up and to the right
    g.addColorStop(0, top); g.addColorStop(1, low);
    if (line) { c.strokeStyle = mix(low, 'ink', line * 1.5); c.lineWidth = 4.5; c.lineJoin = 'round'; c.stroke(p); }
    c.fillStyle = g; c.fill(p);
  };
  /** A finger from its knuckle: two joints, curled by `curl` rad. */
  const finger = (k: V2, tip: V2, r: number, curl: number) => {
    const mid: V2 = [lerp(k[0], tip[0], 0.52), lerp(k[1], tip[1], 0.52)], m = turn(mid, k, curl), e = turn(turn(tip, k, curl), m, curl * 1.3), p = new Path2D();
    capsule(p, k, m, r, r * 0.9); capsule(p, m, e, r * 0.9, r * 0.78);
    fill(p);
  };
  // its shadow on the page
  c.save(); c.translate(-26, 20); c.fillStyle = rgba('ink', 0.16); c.filter = 'blur(14px)';
  const sh = new Path2D();
  sh.moveTo(60, -30); sh.lineTo(-70, -130); sh.lineTo(30, -210); sh.lineTo(210, -230); sh.lineTo(330, -160); sh.lineTo(440, -20); sh.lineTo(900, 330); sh.lineTo(700, 620); sh.lineTo(330, 215); sh.lineTo(150, 120); sh.lineTo(-40, -10); sh.closePath();
  c.fill(sh); c.restore();
  // the sleeve of her cardigan, a line of shirt cuff, then the hand: the far fingers first
  const cuff = new Path2D();
  cuff.moveTo(452, 62); cuff.lineTo(1180, 608); cuff.lineTo(1040, 800); cuff.lineTo(310, 252); cuff.closePath();
  const sg = c.createLinearGradient(520, 40, 360, 260);
  sg.addColorStop(0, BEIGE); sg.addColorStop(1, BEIGE_LOW);
  finger([292, -118], [205, -212], 25, -0.2 - 0.05 * flick);
  finger([228, -118], [100, -222], 29, -0.17 - 0.08 * flick);
  finger([160, -92], [0, -186], 31, -0.13 - 0.14 * flick + 0.03 * caught);
  const back = new Path2D();
  back.moveTo(58, -6); back.quadraticCurveTo(52, -82, 112, -88); back.lineTo(300, -150); back.quadraticCurveTo(392, -128, 418, -40);
  back.lineTo(462, 100); back.lineTo(326, 222); back.quadraticCurveTo(214, 196, 150, 124); back.quadraticCurveTo(78, 72, 58, -6); back.closePath();
  fill(back);
  finger([95, -50], [-78, -122], 31, -0.06 + 0.1 * flick - 0.04 * caught);
  // (the knuckles: three soft marks)
  c.strokeStyle = rgba('ink', 0.1); c.lineWidth = 3; c.lineCap = 'round';
  for (const [x, y] of [[176, -84], [240, -108], [300, -112]] as V2[]) { c.beginPath(); c.arc(x, y, 17, Math.PI * 0.95, Math.PI * 1.75); c.stroke(); }
  const shirt = new Path2D(); shirt.roundRect(-34, -110, 44, 220, 14);
  c.save(); c.translate(392, 162); c.rotate(Math.atan2(0.6, 0.8));
  c.fillStyle = mix('paper', 'sky', 0.12); c.fill(shirt); c.strokeStyle = rgba('ink', 0.16); c.lineWidth = 2; c.stroke(shirt);
  c.restore();
  c.fillStyle = sg; c.fill(cuff);
  c.strokeStyle = rgba('ink', 0.14); c.lineWidth = 2.5;
  for (const k of [0.045, 0.075]) { c.beginPath(); c.moveTo(lerp(452, 1180, k), lerp(62, 608, k)); c.lineTo(lerp(310, 1040, k), lerp(252, 800, k)); c.stroke(); }
  // the thumb, and the pen that turns on it: its shadow, a smear of where it has just been, then the pen
  finger([165, 100], [-32, -18], 37, -0.02 * flick + 0.03 * caught);
  const a = PEN_REST - spin * TAU, speed = (penSpin(beat) - penSpin(beat - 0.02)) / 0.02;
  c.save(); c.translate(-9, 13); c.filter = 'blur(5px)'; c.globalAlpha = 0.22;
  c.rotate(a); c.fillStyle = rgba('ink'); c.beginPath(); c.roundRect(-180, -11, 330, 22, 11); c.fill();
  c.restore();
  if (speed > 0.25) for (let i = 3; i >= 1; i--) drawPenBig(c, PEN_REST - penSpin(beat - i * 0.022) * TAU, 0.13 * clamp(speed / 2));
  drawPenBig(c, a);
  c.restore();
}

// ------------------------------------------------------------------ the desk and the light on it
function desk(c: Ctx) {
  // the wood, its grain, and the far edge of the desk
  const g = c.createLinearGradient(0, -300, 600, 1500);
  g.addColorStop(0, mix(WOOD, 'paper', 0.12)); g.addColorStop(1, mix(WOOD, WOOD_LOW, 0.55));
  c.fillStyle = g; c.fillRect(-1400, -900, 4700, 2900);
  c.save(); c.rotate(0.02); c.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const y = -860 + i * 62 + (hash(i, 7) - 0.5) * 40, x0 = -1400 + hash(i, 8) * 900, len = 900 + hash(i, 9) * 2600;
    c.strokeStyle = mix(WOOD_LOW, 'ink', 0.2, 0.07 + 0.07 * hash(i, 10)); c.lineWidth = 2 + 3 * hash(i, 11);
    c.beginPath(); c.moveTo(x0, y); c.bezierCurveTo(x0 + len * 0.3, y + (hash(i, 12) - 0.5) * 30, x0 + len * 0.7, y + (hash(i, 13) - 0.5) * 30, x0 + len, y + (hash(i, 14) - 0.5) * 16); c.stroke();
  }
  c.restore();
  // an eraser beside the notebook
  c.save(); c.translate(1716, 268); c.rotate(0.42);
  c.shadowColor = rgba('ink', 0.26); c.shadowBlur = 16; c.shadowOffsetX = -5; c.shadowOffsetY = 8;
  c.fillStyle = rgba('paper'); c.beginPath(); c.roundRect(-62, -34, 124, 68, 12); c.fill();
  c.shadowColor = 'transparent';
  c.fillStyle = mix('sky', 'paper', 0.25); c.beginPath(); c.roundRect(-30, -34, 92, 68, [0, 12, 12, 0]); c.fill();
  c.restore();
}

const BLIND = { angle: -0.3, pitch: 138, gap: 50 };
/** The window blinds on the desk: the shadow of each slat ('shade', on the picture) or the sun between them ('sun', on the light layer). */
function blinds(c: Ctx, t: number, what: 'shade' | 'sun', alpha = 1) {
  const B = BLIND, p = c.createPattern(blindTile(what), 'repeat');
  if (!p) return;
  c.save(); c.translate(960, 540); c.rotate(B.angle); c.translate(0, 5 * Math.sin(t * 0.5) + 2 * Math.sin(t * 1.3)); c.globalAlpha *= alpha;
  c.fillStyle = p; c.fillRect(-3000, -2400, 6000, 4800);
  c.restore();
}
const blindTiles: { shade?: HTMLCanvasElement; sun?: HTMLCanvasElement } = {};
/** One slat's worth of the blinds, as a strip that repeats: the soft shadow of the slat, or the sun beside it. */
function blindTile(what: 'shade' | 'sun') {
  let cv = blindTiles[what];
  if (cv) return cv;
  const B = BLIND, c = (cv = blindTiles[what] = document.createElement('canvas')).getContext('2d')!;
  cv.width = 4; cv.height = B.pitch;
  for (let y = 0; y < B.pitch; y++) {
    const d = Math.min(y, B.pitch - y) + 0.5;   // from the middle of the shadow, which the strip starts on
    c.fillStyle = what === 'shade' ? rgba('ink', 0.17 * (1 - smoothstep(B.gap / 2 - 7, B.gap / 2 + 7, d))) : rgba('gold', 0.06 * smoothstep(B.gap / 2, B.gap / 2 + 18, d));
    c.fillRect(0, y, 4, 1);
  }
  return cv;
}

export interface DeskOpts {
  t: number; beat: number;
  /** How much of the margin doodle is drawn, in strokes (default: the intro's unfinished umbrella). */
  doodle?: number;
  /** Her hand and the pen (default true). */
  hand?: boolean;
}
/** The desk from above: paints the picture and far beyond its edges, so that a camera can pull back from it. */
export function drawDeskTop(c: Ctx, o: DeskOpts) {
  desk(c);
  notebook(c, o.doodle ?? DOODLE_UNFINISHED);
  if (o.hand !== false) hand(c, o.t, o.beat);
  blinds(c, o.t, 'shade');
}
/** Its light, for the light layer: the sun between the slats, and the dust in it. */
export function deskLight(g: Ctx, t: number, alpha = 1) {
  blinds(g, t, 'sun', alpha);
  dustMotes(g, t, { count: 40, size: 1.5, alpha: 0.75 * alpha, seed: 7 });
}
