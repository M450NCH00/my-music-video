// The shared kit of 《下课再见》: what every scene draws the two characters, the air, the light and
// the lyrics with, so that all the parts look like one film. docs/ENGINE.md ("The love kit")
// describes it; ?scene=kit (scenes/_kit-test.ts) shows all of it on screen.
//
//   characters   drawGirl / drawBoy (ctx, pose, params), drawStudent for the silhouettes behind them
//   props        desk and chair, pen, phone, umbrella, the school bag and its zipper pocket, the paper star
//   air, light   parallax layers, light shaft, light leak, sparkle, paper grain, the dotted path, frost on glass,
//                and the particle systems (dust, chalk dust, petals, leaves, paper scraps, snow, rain, paper stars)
//   lyrics       drawLyric: one line by the karaoke rule, as handwriting, chalk, grid squares or along a path
//   stage        Stage (picture + light layers) and the transitions (dissolve, light leak, iris)
//
// Everything is a pure function of the time handed in (and a seed): no Math.random, no Date.now.
export { DESK_TOP, POSES, SEAT_TOP, drawBoy, drawGirl, drawStudent } from './_love-rig';
export type { Anchors, CharParams, Ctx, Outfit, PoseArg, PoseName, V2 } from './_love-rig';
export { UMBRELLA_CLEAR, atDesk, clockTick, drawBag, drawChair, drawClock, drawDesk, drawPen, drawPhone, drawStar, drawUmbrella, phoneGlow } from './_love-props';
export { camera, chalkDust, dottedPath, dustMotes, frost, glow, inShaft, layer, leaves, lightLeak, lightShaft, paperGrain, paperScraps, paperStars, petals, rain, scratch, snow, soundRing, sparkle } from './_love-fx';
export type { Cam, Drift, LayerOpts, Shaft } from './_love-fx';
export { LYRIC_GHOST, LYRIC_LEAD, drawLyric } from './_love-lyrics';
export type { LyricChar, LyricOpts, LyricStyle } from './_love-lyrics';
export { CHORUS1_FROST, INTRO_RING, VERSE1_WASH, VERSE2_LAMPS, Stage, transition } from './_love-stage';
export type { Move } from './_love-stage';
