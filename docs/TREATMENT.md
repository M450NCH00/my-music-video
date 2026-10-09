# 《下课再见》 music video: treatment & style bible

Every part of this video is built in a separate Claude Code session. **This file is the single source of truth that keeps them consistent.** Every scene must follow it. If a scene needs to break a rule, change this file first.

## The story in one paragraph

A school love story told from **her** point of view (the singer's "我" is the girl; "你" is the boy). She sits two rows behind him. Every day she packs her bag slowly so they leave class at the same time, walks him from the blackboard to the school gate and on to the bus stop, and stretches every step. Autumn turns to winter: she keeps his scarf as an excuse to see him again tomorrow. In the bridge she wonders whether, years later and in different classrooms, either of them will remember the bell they waited for. In the final chorus it rains, one small umbrella is not enough, he leans closer, and she finally says what she has been hiding in her bag's zipper pocket. The video starts and ends at the same school bell, so it loops.

## Art style: soft illustrated love-song MV

The look of the illustrated lyric videos used for many Chinese school love songs (校园 / 青春 style): **a warm, hand-drawn-feeling flat illustration** with soft gradients, golden light, pastel colours, floating dust and petals, light leaks and gentle film grain. Everything feels like a sunny afternoon memory.

- **Rendering:** flat-vector shapes (Canvas2D paths) with soft vertical gradients, no hard black outlines. Lines are warm ink-brown, 1.5 to 3 px, slightly rounded. A subtle paper texture and fine grain over everything.
- **Light:** the sun is always a character. Use warm rim light on hair and shoulders, light shafts through windows with visible dust motes, soft bloom on light sources only (sun, lamps, phone screen, sparkles), and an occasional light leak (soft peach/pink gradient blooming in from a frame edge) at emotional peaks.
- **Depth:** 3 to 6 parallax layers per shot. Far layers are lighter, less saturated and slightly blurred (fake depth of field). Foreground objects (a desk edge, a leaf, a window frame) may pass close to camera, blurred.
- **Particles:** dust motes (default), chalk dust (verse 1), petals and falling leaves (chorus 1 and interlude), wind-blown paper scraps (verse 2), light snow (chorus 2), rain (finale), paper stars (finale and outro). Particles drift slowly and never swarm.
- **Grade:** warm, slightly lifted blacks (nothing is pure black), soft vignette, gentle chromatic softness at the edges at most. Never neon, never high contrast.

## Palette (define in `app/src/engine/palette.ts`)

| token | hex | use |
|---|---|---|
| `paper` | `#FBF4E8` | cream base, notebooks, light backgrounds |
| `ink` | `#4A3B36` | warm brown line work and dark type (never pure black) |
| `blush` | `#F6C9C4` | cheeks, soft accents, light leaks |
| `peach` | `#F9B79A` | golden-hour skies, warm walls |
| `gold` | `#FFD58A` | sunlight, lamp light, sparkles |
| `sky` | `#A9D3EA` | daytime sky, uniform shirt shading |
| `dusk` | `#B9A7D6` | blue-hour and evening skies |
| `navy` | `#2F3E5C` | school uniform, night |
| `frost` | `#C7D3DE` | winter light, rain, bridge desaturation |
| `rose` | `#E8707E` | **the love colour**: the sung lyric character, his scarf, the paper stars, the zipper pull. Use it sparingly so it always means something. |

Each section shifts the mood with the same palette: chorus 1 is gold/peach, verse 2 is frost with rose accents, chorus 2 is dusk/navy with gold lamps, the bridge is desaturated frost, and the finale goes from frost rain to gold sunset.

## Characters (shared drawing code in `app/src/scenes/_love.ts`)

Simple, consistent and charming rather than detailed. Both are drawn by shared functions, never redrawn per scene, so they look identical in every part.

- **Proportions:** about 6.5 heads tall, slightly stylised, soft rounded shapes.
- **Faces are minimal:** no detailed eyes or mouths. Show them from behind, in profile, or with simple features: closed-eye curves (◡) for smiles, two small dot eyes, soft blush ovals. Hair often covers the eyes. This is both the genre's look and what looks good in code.
- **Her (我):** long dark-brown hair in a low ponytail with loose side strands, white short-sleeve shirt with a navy ribbon, navy pleated skirt, beige cardigan (autumn) or a long beige coat (winter). Cream backpack with a front zipper pocket and a **rose zipper pull**.
- **Him (你):** short, slightly messy dark hair, white shirt, navy trousers, backpack slung over one shoulder, a **rose knitted scarf** in winter.
- **Background students:** soft single-colour silhouettes in `frost`/`sky`, slightly blurred, never detailed.
- **Animation:** idle breathing (1 to 2 px bob), hair and skirt sway with the wind parameter, walk cycles at 2 steps per beat, simple head turns via 3 to 4 pose keyframes eased together.
- **Required poses:** sit-and-write, chin-on-hand, pack-bag, stand, walk side view (both), run, turn-and-smile (him), wave, hold phone (her, lying on bed), hold umbrella, lean-closer, face-each-other.

## Typography and lyrics

- **Lyric font:** **LXGW WenKai (霞鹜文楷)**, OFL licensed, a soft handwritten-style Chinese face. Subset it to only the characters in the lyrics and title. Use **Noto Sans SC** (subset) for small UI text such as chat bubbles and labels.
- **Karaoke rule (all parts):** every lyric line is readable and synced **per character**. A character turns `rose` when it starts being sung and settles to `ink` (or `paper` on dark scenes) after the line. Unsung characters show at 35% opacity up to 0.4 s early. Highlighting never runs ahead of the voice.
- **The lyrics live inside the world**, never as bottom subtitles: written in chalk on the blackboard, formed from chalk dust, typed in a chat bubble, written into 作文格子 (composition-paper squares), floating above the road like handwriting, carried on the wind, rising as paper stars. Each part's prompt specifies the treatment.
- Keep lyrics inside the title-safe area (at least 96 px from the edges). Lines may be broken over two rows at natural pauses (for example at the space in 慢慢走 慢慢讲).

## Recurring motifs

1. **The classroom clock** that runs half a beat slow (慢半拍). Its second hand ticks on beat + 0.5. It opens verse 1, returns at the end of the bridge, and in the outro finally ticks **on** the beat.
2. **The bell:** ringing bell with soft concentric sound rings. It ends the intro and returns in the outro.
3. **The zipper pocket** (书包拉链口): where she hides her feelings. In chorus 1 she zips a folded paper star into it. In chorus 2 there are more stars. In the finale she unzips it and the stars rise out.
4. **The rose scarf:** his, kept in her coat pocket through verse 2, returned in chorus 2.
5. **The dotted path:** a hand-drawn dotted line on the ground, like a doodled map, from blackboard to gate to bus stop. It reappears in the bridge connecting two squares, and in the finale as the small road.
6. **Grids:** classroom windows on the building exterior, then composition-paper squares (格子) in the bridge.
7. **The margin doodle:** in the intro, an unfinished doodle of an umbrella in her notebook margin. In the outro it is finished, with two small figures under it.

## Motion and edit

- **Gentle, never violent:** eases are `inOutSine` and `inOutCubic`, with occasional soft overshoot springs for cute moments (a sparkle pop, a speech bubble). No camera shake, no flash frames, no whip slams.
- **The camera is always slowly alive:** slow push-ins (2 to 5% over a phrase), lateral parallax drifts, gentle tilts. Changes of shot land on downbeats or line starts.
- **Beat sync is soft:** use the beat for walk cycles, page flips, ball bounces, sparkle pops and heartbeat glows, not for hard cuts.
- **Transitions are smooth by contract.** Prefer, in order: match cuts (shape to shape: a sound ring into a clock face), continuous camera moves through windows or doors, light-leak dissolves, and soft cross-dissolves of about 0.5 to 1 beat. Every part ends on its agreed **handoff frame** and the next part starts from it (table below). A part may overlap the previous one by up to one bar and composite `f.under` itself (`handlesTransition = true`).

## Sections, scene modules and handoffs

| part | scene file | lyrics (start → end) | mood | enters from | exits into (handoff frame) |
|---|---|---|---|---|---|
| Intro | `intro.ts` | (instrumental, 0 → before 教室钟慢半拍) | sunny afternoon class | fade from paper | the bell's sound ring expanding to fill the frame |
| Verse 1 | `verse1.ts` | 教室钟慢半拍 → 其实在等你回头一笑 | after-class glow, shy | sound ring → round clock face (match cut) | his smile; a gold light leak washes the frame |
| Chorus 1 + interlude | `chorus.ts` `{n:1}` | 等你下课一起走好不好 → 把喜欢藏在书包拉链口, then the instrumental until verse 2 | golden hour → night → seasons pass | light leak clears to the corridor | her bedroom window frosts over and becomes the school corridor window |
| Verse 2 | `verse2.ts` | 走廊风吹得好吵 → 我记的却是你眼睛在闪 | winter, wind, playful | frosted window → corridor | the sparkles in his eyes become the streetlights |
| Chorus 2 | `chorus.ts` `{n:2}` | 等你下课一起走好不好 → 把喜欢藏在书包拉链口 | blue hour, snow, lamps | streetlights | the zipper closes; camera pulls back to her desk under a desk lamp |
| Bridge | `bridge.ts` | 哪天如果我们 → 曾经为了谁慢半节下课铃 | reflective, desaturated | her desk | a raindrop hits the clock glass |
| Final chorus | `finale.ts` | 等你下课一起走好不好 → 把喜欢一点一点说出口 | rain → sunset, the peak | raindrop → rain at the school gate | paper stars rise into the sunset sky; camera tilts up |
| Outro | `outro.ts` | (instrumental, after the last line → end) | sunset, quiet, loop | sky | fade to paper; last frame matches the first |

Look up lines by content through the `Lyrics` API, never hard-code times in scenes.

## Never

No pure black, no neon, no harsh contrast, no hard outlines around everything, no detailed realistic faces, no copying of existing anime characters, artworks or other MVs, no real brand logos or imitations of real app UIs (chat bubbles are our own generic design), no bottom-of-screen subtitles, no camera shake.
