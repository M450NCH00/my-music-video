// The school seen from the classroom window: the opposite wing in the rain, its tower with the
// clock and the bell, and the ball court in the yard. Drawn in its own coordinates (the ground
// at y = 820, the tower on x = 960).
import { F, font } from '../engine/type';
import { clamp, ease, hash, lerp, mod, TAU } from '../engine/util';
import { C, clock, ink, limb, poly, rr, type Ctx } from './_school';
import { walker } from './_people';

export const GROUND = 820;
/** The tower's axis, the clock's centre and the beam the bell hangs from. */
export const TOWER = { x: 960, clockY: 350, bellY: 128 };

function cloud(c: Ctx, x: number, y: number, s: number) {
  c.beginPath();
  for (const [dx, dy, rx, ry] of [[0, 0, 190, 60], [-130, 22, 130, 44], [140, 26, 150, 48], [30, -34, 110, 46]] as const) {
    c.moveTo(x + (dx + rx) * s, y + dy * s);
    c.ellipse(x + dx * s, y + dy * s, rx * s, ry * s, 0, 0, TAU);
  }
  c.fill();
}

function tree(c: Ctx, x: number, s: number, sway: number) {
  rr(c, x - 9 * s, GROUND - 120 * s, 18 * s, 122 * s, 4);
  ink(c, '#5A4C47', 3);
  // the canopy: a clump of discs, outlined as one shape, with a lighter clump on top
  const clump = (discs: readonly (readonly [number, number, number])[]) => {
    c.beginPath();
    for (const [dx, dy, r] of discs) {
      const cx = x + (dx + sway * (1 - dy / 220)) * s, cy = GROUND + dy * s;
      c.moveTo(cx + r * s, cy);
      c.arc(cx, cy, r * s, 0, TAU);
    }
  };
  const dark = [[-52, -150, 62], [48, -158, 66], [0, -214, 74], [-4, -128, 58]] as const;
  clump(dark);
  c.strokeStyle = C.line;
  c.lineWidth = 6;
  c.stroke();
  c.fillStyle = C.treeDark;
  c.fill();
  clump([[-40, -166, 44], [44, -176, 46], [4, -226, 52]]);
  c.fillStyle = C.tree;
  c.fill();
}

/** The bell hanging from (0, 0), tilted by `a` rad; the clapper hangs nearly straight down. */
function bell(c: Ctx, a: number) {
  c.save();
  c.rotate(a);
  rr(c, -9, -6, 18, 16, 4);
  ink(c, C.brassDark, 3);
  c.beginPath();
  c.moveTo(-12, 8);
  c.lineTo(12, 8);
  c.bezierCurveTo(18, 16, 34, 22, 36, 50);
  c.bezierCurveTo(38, 72, 46, 84, 56, 94);
  c.lineTo(-56, 94);
  c.bezierCurveTo(-46, 84, -38, 72, -36, 50);
  c.bezierCurveTo(-34, 22, -18, 16, -12, 8);
  c.closePath();
  ink(c, C.brass, 3);
  // the light on its left flank
  c.beginPath();
  c.moveTo(-22, 30);
  c.bezierCurveTo(-27, 50, -30, 68, -38, 82);
  c.strokeStyle = C.brassLight;
  c.lineWidth = 7;
  c.lineCap = 'round';
  c.stroke();
  rr(c, -60, 90, 120, 12, 6);
  ink(c, C.brassDark, 3);
  c.restore();
  // the clapper lags behind the swing
  c.save();
  c.rotate(a * 0.35);
  c.beginPath();
  c.arc(0, 112, 10, 0, TAU);
  ink(c, C.brassDark, 3);
  c.restore();
}

/** The court's far and near edges, and the height of the rims. */
const COURT = { x0: 1040, x1: 1840, y0: 872, y1: 1092, rim: 716 };

function hoop(c: Ctx, dir: 1 | -1) {
  const x = dir > 0 ? COURT.x1 - 14 : COURT.x0 + 14, y = 968;
  limb(c, [x, y, x, COURT.rim - 70, x - 34 * dir, COURT.rim - 46], 9, C.metal);
  rr(c, x - 40 * dir - 4, COURT.rim - 64, 8, 82, 2);
  ink(c, C.paper, 3);
  limb(c, [x - 44 * dir, COURT.rim, x - 84 * dir, COURT.rim], 4, C.red, 2);
  c.strokeStyle = C.paper;
  c.lineWidth = 2.5;
  c.beginPath();
  for (let i = 0; i <= 3; i++) {
    c.moveTo(x - (46 + i * 12) * dir, COURT.rim + 3);
    c.lineTo(x - (52 + i * 8) * dir, COURT.rim + 34);
  }
  c.stroke();
}

/**
 * A game on the court, `g` = beats into an 8-beat loop: the five run to the right hoop, one
 * dribbling; he shoots on beat 4, it drops in on beat 5, they shout and run back.
 */
function game(c: Ctx, t: number, g: number) {
  const right = g < 4.6;
  const G = right ? lerp(1250, 1600, ease.inOutQuad(clamp(g / 4.2))) : lerp(1600, 1250, ease.inOutQuad(clamp((g - 4.9) / 3.1)));
  const cheer = Math.min(clamp((g - 4.7) / 0.3), 1 - clamp((g - 5.7) / 0.5));
  const at = (i: number): [number, number] => [
    clamp(G + [0, -120, 84, -214, 150][i]! * (0.85 + 0.15 * Math.sin(g * 0.8 + i * 2)), 1090, 1770),
    [962, 1016, 926, 990, 1052][i]!,
  ];
  // the ball: dribbled beside the first player, in the air from beat 4, through the net on 5
  const [lx, ly] = at(0), dir = right ? 1 : -1;
  let bx = lx + dir * 36, by = ly - 16 - 62 * Math.abs(Math.cos(g * TAU));
  const rimX = COURT.x1 - 78;
  if (g >= 4 && g < 5) {
    const u = g - 4;
    bx = lerp(lx + 30, rimX, u);
    by = lerp(ly - 150, COURT.rim - 6, u) - 190 * Math.sin(u * Math.PI);
  } else if (g >= 5 && g < 5.9) {
    const u = (g - 5) / 0.9;
    bx = lerp(rimX, lx + dir * 36, u * u);
    by = lerp(COURT.rim, ly - 16, u) - 70 * Math.sin(u * Math.PI) * (u > 0.45 ? 1 : 0);
  }
  const order = [2, 0, 3, 1, 4];
  const looks = [
    { hair: 'short', shirt: C.shirt }, { hair: 'short', shirt: C.teal }, { hair: 'short', shirt: C.shirt },
    { hair: 'ponytail', shirt: C.shirt }, { hair: 'short', shirt: C.red },
  ] as const;
  let ball = false;
  const drawBall = () => {
    c.beginPath();
    c.arc(bx, by, 15, 0, TAU);
    ink(c, '#D9803E', 3);
    ball = true;
  };
  for (const i of order) {
    const [x, y] = at(i);
    if (!ball && y > ly) drawBall();
    c.save();
    c.translate(x, y);
    c.scale(0.25 * dir, 0.25);
    walker(c, t, C, g * Math.PI * 1.5 + i * 1.7, { ...looks[i]!, run: true, armsUp: cheer * (i % 2 ? 1 : 0.8) });
    c.restore();
  }
  if (!ball) drawBall();
  // what they shout
  c.font = font(F.sc(700), 30);
  c.textBaseline = 'middle';
  c.textAlign = 'center';
  for (const [g0, who, text] of [[1.1, 1, '传球！'], [2.9, 2, '这边！'], [5.0, 0, '好球！'], [6.5, 3, '哈哈哈']] as const) {
    const u = (g - g0) / 1.6;
    if (u < 0 || u >= 1) continue;
    const [x, y] = at(who), k = ease.outBack(clamp(u / 0.18)), w = c.measureText(text).width + 30;
    c.save();
    c.translate(x + 10, y - 196 - 14 * u);
    c.scale(k, k);
    c.globalAlpha = 1 - clamp((u - 0.8) / 0.2);
    poly(c, [-12, 20, 12, 20, -4, 44]);
    ink(c, C.paper, 3);
    rr(c, -w / 2, -26, w, 52, 20);
    ink(c, C.paper, 3);
    c.fillStyle = C.line;
    c.fillText(text, 0, 2);
    c.restore();
  }
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
}

/**
 * `bell` = the bell's tilt (rad); `ring` 0..1 draws its sound; `game` = beats into the game on
 * the court (see `game`), or null for an empty court.
 */
export function drawYard(c: Ctx, t: number, o: { h: number; m: number; s: number; bell: number; ring?: number; game?: number | null }) {
  const sky = c.createLinearGradient(0, -500, 0, GROUND);
  sky.addColorStop(0, C.sky0);
  sky.addColorStop(1, C.sky1);
  c.fillStyle = sky;
  c.fillRect(-4000, -4000, 10000, 4000 + GROUND);

  c.fillStyle = C.cloud;
  for (let i = 0; i < 11; i++) {
    c.globalAlpha = 0.3 + 0.3 * hash(i, 15);
    cloud(c, mod(hash(i, 11) * 4400 + t * (5 + 5 * hash(i, 12)), 4400) - 1200, -330 + hash(i, 13) * 620, 0.8 + hash(i, 14) * 1.2);
  }
  c.globalAlpha = 1;

  // the town behind, lost in the rain
  c.fillStyle = C.far;
  c.beginPath();
  c.moveTo(-1400, GROUND);
  for (let i = 0, x = -1400; x < 3400; i++) {
    const w = 90 + 150 * hash(i, 21), y = GROUND - 60 - 150 * hash(i, 22);
    c.lineTo(x, y);
    c.lineTo(x + w, y);
    x += w;
  }
  c.lineTo(3400, GROUND);
  c.closePath();
  c.fill();

  c.fillStyle = C.ground;
  c.fillRect(-4000, GROUND, 10000, 4000);
  c.fillStyle = C.puddle;
  for (const [x, y, w] of [[420, 905, 210], [1290, 880, 150], [820, 960, 260], [1640, 950, 190], [60, 890, 140]] as const) {
    c.beginPath();
    c.ellipse(x, y, w, w * 0.11, 0, 0, TAU);
    c.fill();
  }

  // the court, flat on the ground in front of the wing
  poly(c, [COURT.x0, COURT.y0, COURT.x1, COURT.y0, COURT.x1 + 46, COURT.y1, COURT.x0 - 46, COURT.y1]);
  ink(c, C.court, 3);
  c.strokeStyle = C.courtLine;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(1440, COURT.y0 + 4);
  c.lineTo(1440, COURT.y1 - 4);
  c.moveTo(1560, 982);
  c.ellipse(1440, 982, 120, 40, 0, 0, TAU);
  for (const dir of [1, -1]) {
    const x = dir > 0 ? COURT.x1 + 20 : COURT.x0 - 20;
    c.moveTo(x, 930);
    c.lineTo(x - 180 * dir, 930);
    c.lineTo(x - 186 * dir, 1034);
    c.lineTo(x + 4 * dir, 1034);
  }
  c.stroke();

  // ---- the wing: three floors of classrooms
  rr(c, 250, 470, 1420, GROUND - 470, 2);
  ink(c, C.bldg, 3);
  c.fillStyle = C.bldgShade;
  c.fillRect(252, GROUND - 26, 1416, 24);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      const x = 300 + col * 112, y = 502 + row * 102;
      if (x + 70 > 830 && x < 1090) continue; // the tower stands here
      rr(c, x, y, 70, 60, 3);
      ink(c, hash(row, col, 7) < 0.3 ? C.paneLit : C.pane, 3);
      c.strokeStyle = C.line;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + 35, y);
      c.lineTo(x + 35, y + 60);
      c.stroke();
      rr(c, x - 6, y + 60, 82, 8, 2);
      ink(c, C.bldgLight, 2);
    }
  }
  rr(c, 232, 450, 1456, 24, 3);
  ink(c, C.roof, 3);

  // ---- the tower
  rr(c, 846, 250, 228, GROUND - 250, 2);
  ink(c, C.bldgLight, 3);
  rr(c, 912, 706, 96, 114, [48, 48, 0, 0]);
  ink(c, C.roof, 3);
  rr(c, 890, 690, 140, 14, 3);
  ink(c, C.roof, 3);
  clock(c, TOWER.x, TOWER.clockY, 72, o.h, o.m, o.s);
  // the belfry: a dark opening between two posts, under a small roof
  rr(c, 846, 112, 228, 138, 2);
  ink(c, '#454E60', 3);
  rr(c, 846, 112, 24, 138, 2);
  ink(c, C.bldgLight, 3);
  rr(c, 1050, 112, 24, 138, 2);
  ink(c, C.bldgLight, 3);
  c.save();
  c.translate(TOWER.x, TOWER.bellY);
  bell(c, o.bell);
  c.restore();
  rr(c, 832, 236, 256, 20, 3);
  ink(c, C.roof, 3);
  rr(c, 832, 100, 256, 22, 3);
  ink(c, C.bldgLight, 3);
  poly(c, [820, 100, TOWER.x, 26, 1100, 100]);
  ink(c, C.roof, 3);
  c.beginPath();
  c.arc(TOWER.x, 20, 9, 0, TAU);
  ink(c, C.brass, 3);

  // ---- the flag, heavy with rain
  rr(c, 636, 356, 8, GROUND - 356, 3);
  ink(c, C.metal, 3);
  const fl = Math.sin(t * 1.7) * 3;
  poly(c, [644, 364, 706 + fl, 374, 698 + fl * 1.6, 428, 644, 412]);
  ink(c, C.red, 3);

  // the bell's sound: arcs either side of the belfry
  const ring = o.ring ?? 0;
  if (ring > 0.01) {
    c.strokeStyle = C.paper;
    c.lineCap = 'round';
    c.lineWidth = 7;
    for (const dir of [1, -1]) {
      for (let k = 0; k < 3; k++) {
        const r = 150 + k * 38 + 10 * Math.sin(t * 14 + k);
        c.globalAlpha = ring * (0.85 - k * 0.25);
        c.beginPath();
        c.arc(TOWER.x, 180, r, (dir > 0 ? 0 : Math.PI) - 0.42, (dir > 0 ? 0 : Math.PI) + 0.42);
        c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  const sway = Math.sin(t * 0.9) * 5;
  tree(c, 150, 1.25, sway);
  tree(c, 1790, 1.35, -sway * 0.8);
  tree(c, 470, 0.8, sway * 0.6);
  tree(c, 1490, 0.85, -sway);
  hoop(c, -1);
  hoop(c, 1);
  if (o.game != null) game(c, t, mod(o.game, 8));
}
