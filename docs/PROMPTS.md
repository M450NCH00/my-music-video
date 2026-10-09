# Claude Code prompts, part by part

How to use these:

1. Put `TREATMENT.md` into `docs/` (replace the old one) and your song at `audio/song.mp3`. Commit.
2. Run **Prompt 0** once. It prepares the repo so every later part has the shared characters, font, palette and lyric timing.
3. Then run one part per session, in order: Intro, Verse 1, Chorus 1, Verse 2, Chorus 2, Bridge, Final chorus, Outro. Order matters because each part starts from the previous part's last frame.
4. After each part, preview with `bunx vite` in `app/` and open `http://localhost:5173/?t=<a few seconds before the part>` to check the transition in. Commit before starting the next part.

Replace `《下课再见》` with your song title everywhere.

---

## Prompt 0: Foundation (run once)

```
This repo is a fork of a code-rendered music video (three.js + Canvas2D, bun + Vite). I am
turning it into a music video for my own Mandarin love song. Read README.md, docs/ENGINE.md,
docs/TREATMENT.md (my NEW style bible, it replaces the old concept), app/src/timeline.ts,
analysis/common.py, analysis/align.py and analysis/pron.py before changing anything.
I am on Windows.

Do the following, and check in with me after each numbered step:

1. Clean out the old song. Delete all old scenes in app/src/scenes/ (git keeps the history),
   app/public/plates/ and app/plates.json. Remove the P(doom)-specific parts of hud.ts,
   post.ts (pdoomText, hudCorruption) and main.ts (window.__pdoom → window.__mv). Rename
   pdoom references in analysis/common.py and app/scripts/render.ts so the audio is
   audio/song.mp3 and renders default to out/mv.mp4. Hide the HUD by default.

2. Lyrics. lyrics/lyrics.src.js already holds my lyrics in the same [start, end, text]
   format (line-level, approximate). Adapt the alignment pipeline to Mandarin so that
   data/lyrics.json has one "word" per Chinese CHARACTER with start/end times:
   - tokenise each line into characters (spaces are pauses, not tokens);
   - romanise for the CTC models with pypinyin (no tone marks) instead of pron.py's
     English spellings;
   - replace mlx-whisper (Apple-only) with faster-whisper, language="zh", as the cross-check;
   - clear the old song's ANCHORS and FIX tables;
   - use CUDA if available, otherwise CPU.
   Then run Demucs, the emissions, whisper and align.py. Show me the QA plots for any line
   with low confidence so we can fix it together.

3. Music analysis. Run analyze.py on my song. Fill SECTION_BARS from my structure:
   intro (0 → first line 教室钟慢半拍), verse1, chorus1, interlude (instrumental between
   把喜欢藏在书包拉链口 and 走廊风吹得好吵), verse2, chorus2, bridge (哪天如果我们 …),
   final (the last chorus, starting 等你下课一起走好不好 after the bridge), outro.
   Tell me the detected BPM and whether the beat grid looks right.

4. Fonts. Download LXGW WenKai (霞鹜文楷, OFL) and Noto Sans SC (OFL). Subset both to only the
   characters in my lyrics plus 《下课再见》 and basic punctuation (fonttools pyftsubset; see
   analysis/make_fonts.py), put them in app/public/fonts/, and register them in type.ts as
   F.hand() and F.sans(). Make the per-glyph layout and wipe helpers work for CJK.

5. Palette and post. Replace palette.ts with the TREATMENT palette (paper, ink, blush, peach,
   gold, sky, dusk, navy, frost, rose). Retune post.ts defaults for the soft look: lower
   bloom threshold only for light sources, warm lifted blacks, softer grain, gentle
   vignette, no chromatic aberration, no shake.

6. Shared kit app/src/scenes/_love.ts, used by every later scene:
   - drawGirl(ctx, pose, params) and drawBoy(ctx, pose, params) as Canvas2D vector
     illustrations following TREATMENT "Characters", with every pose listed there,
     params for position, scale, facing, wind, outfit ('summer' | 'winter'), blush,
     walk phase, head turn, and smile;
   - parallax layer helper, soft light shaft, light leak, paper texture, dust motes,
     chalk dust, petals/leaves, snow, rain and paper-star particle systems (all
     deterministic in f.t, seeded);
   - a lyric renderer that draws a line per character with the TREATMENT karaoke rule,
     with options for handwriting (stroke-reveal wipe), chalk, grid squares (作文格)
     and floating text along a path;
   - transition helpers: cross-dissolve, light-leak dissolve, circular iris/match.

7. A test scene app/src/scenes/_kit-test.ts (not in the timeline, reachable with
   ?scene=kit) showing both characters in all poses side by side, all particle systems,
   and a lyric line in each style. Show me a still of it before going further. This is
   where we lock the character design.

8. New timeline.ts with the eight entries from the TREATMENT table (intro, verse1, chorus n:1,
   verse2, chorus n:2, bridge, finale, outro), cut points found by lyric content and
   snapped to beats. Create each scene file as a simple placeholder (paper background,
   the part's name, its lyrics with karaoke highlight) so the whole song plays end to end.

Keep all scene code deterministic (no Math.random / Date.now). Commit after each step.
```

---

## Prompt 1: Intro (0 → just before 教室钟慢半拍)

```
Read docs/TREATMENT.md and docs/ENGINE.md, then build app/src/scenes/intro.ts, replacing the
placeholder. Use the shared kit in _love.ts for characters, particles and transitions.

Window: from 0 s to the cut before the first lyric 教室钟慢半拍 (about 15.4 s). No lyrics are
sung; this sets up the world. Mood: a sleepy, sunny afternoon class, warm and nostalgic.

Shots (times approximate; anchor to bars and the first lyric, not fixed seconds):
1. (0 → ~4 s) Fade in from paper colour. Extreme close-up on her desk: her hand spinning a
   pen around her thumb, one full spin per beat, with a small wobble every fourth spin.
   An open notebook with neat maths working in ink, and in the margin an UNFINISHED doodle
   of a small umbrella (keep it; the outro finishes it). Sun stripes from window blinds
   fall across the page with drifting dust motes. Gentle push-in.
2. (~4 → ~8 s) Slow pull-back and rise: her in profile, chin on hand, pen still spinning,
   gazing out of the window. The classroom builds layer by layer: rows of desks, students
   as soft silhouettes, the blackboard with chalk formulas and the date, the round wall
   clock above it (the TREATMENT clock, second hand ticking on beat + 0.5). The boy sits
   two rows ahead, seen from behind, in a sunbeam. Do not reveal his face.
3. (~8 → ~13 s) The camera keeps moving out THROUGH the window: the window frame passes
   close to camera (blurred foreground), a soft glass glint sweeps across, and we are
   outside. Reveal the school building exterior as a grid of classroom windows over
   several floors (this grid returns in the bridge), a golden afternoon sky with soft
   clouds, trees with sun-dappled leaves, and a basketball court in the distance.
   Fade the title 《下课再见》 in, handwritten in F.hand(), in open sky; fade it out by ~12 s.
4. (~13 s → end) The school bell on the wall rings: it swings in a soft spring rhythm and
   emits concentric `paper`-coloured sound rings that ripple across the sky on each beat.
   Birds lift off a wire, a few leaves scatter.

Exit handoff (must match verse1's entry): on the last beat, one sound ring expands to
fill the frame as a soft circle, centred where verse 1's clock face will be. Export the
ring's final centre and radius as constants in _love.ts (INTRO_RING) so verse1 can match
it exactly.

Check: preview from ?t=0 and step frames through the bell. Show me stills at 2 s, 7 s,
11 s and the last frame.
```

---

## Prompt 2: Verse 1 (教室钟慢半拍 → 其实在等你回头一笑)

```
Read docs/TREATMENT.md, then build app/src/scenes/verse1.ts. Use _love.ts. Look up every line
by content through the Lyrics API.

Window: from 教室钟慢半拍 to the end of 其实在等你回头一笑 (about 15.4 → 41.6 s).
Mood: class has just ended, golden after-class light; she is shy and stalling for time.

Entry: set handlesTransition = true and start on the INTRO_RING circle. It becomes the round
classroom wall clock face (circle-to-circle match cut). The ring shrinks onto the clock's
rim as the clock face fades in.

Line by line (lyric treatment in brackets):
1. 教室钟慢半拍: close on the clock. The second hand visibly ticks HALF A BEAT LATE against
   the music. Pull back to the blackboard and the classroom emptying: students' silhouettes
   stream out with soft motion blur. [The line appears as chalk handwriting on the
   blackboard beside the clock, written character by character as sung.]
2. 粉笔灰飘在你发梢: close on his hair from behind and slightly to the side, in a sunbeam.
   Chalk dust glitters in the light shaft and settles on his hair. [The characters
   condense out of floating chalk dust as each is sung, then shimmer.]
3. 你低头收书包: he packs his bag, head down, books sliding in on beats. [Line rests on the
   desk surface in perspective.]
4. 我故意收得比谁都慢: her in the foreground, deliberately slow: one pencil at a time into
   her pencil case. Behind her, the other students move in fast-forward streaks, so she is
   the slowest thing in the room. [Line in handwriting beside her, calm and steady.]
5. 窗外球场在吵: through the window, the basketball court: a ball bounces on the kick drum,
   tiny players, noise drawn as small doodled sound lines. [Characters hop with the ball.]
6. 我只听见心跳乱跳: everything goes soft and muffled: the court blurs out (depth of field),
   the frame dims slightly, and a gentle `blush` glow pulses from her chest on each kick,
   like a heartbeat. [Characters jump at slightly irregular heights, "乱跳".]
7. 假装还在翻题目: she hides behind an open textbook, flipping pages on beats, peeking over
   the top with only her eyes visible.
8. 其实在等你回头一笑: over her shoulder to the doorway: he stops, turns back, and smiles
   (closed-eye ◡ smile, slight head tilt), with the sun flaring behind him. Hold.
   [Line large and soft across the doorway light; 笑 gets a tiny sparkle pop.]

Exit handoff: on his smile, a `gold` light leak swells from the doorway and washes the
whole frame to warm light by the first beat of the chorus.

Check: preview from ?t=13 (to see the intro→verse match cut) to the chorus. Show me stills
for lines 1, 2, 6 and 8.
```

---

## Prompt 3: Chorus 1 + interlude (等你下课一起走好不好 → 把喜欢藏在书包拉链口, then the instrumental)

```
Read docs/TREATMENT.md, then build app/src/scenes/chorus.ts with params {n: 1 | 2}. This prompt
builds n = 1. Design it so n = 2 can reuse the same compositions with a winter variant later
(keep season-dependent values in one place). Use _love.ts.

Window: from 等你下课一起走好不好 to the start of verse 2 (走廊风吹得好吵), which includes
the instrumental interlude after 把喜欢藏在书包拉链口 (about 42.0 → 77.5 s).
Mood: golden hour, the happiest and most open part so far. The core visual is one long
side-scrolling walk: the two of them in side view walking together, while parallax layers
slide behind them. It flows like one continuous shot.

Entry: the gold light leak from verse 1 clears to reveal the school corridor; she runs in
from the left and catches up with him.

Line by line:
1. 等你下课一起走好不好: corridor, side view; she falls into step beside him. Walk cycles at
   2 steps per beat. [Handwritten line floats above their heads, drifting with the camera.]
2. 从黑板到校门只要一条小跑: a playful little run: the background rushes by in parallax
   (corridor windows → stairs → courtyard → the school gate) while a hand-drawn dotted path
   draws itself along the ground like a doodled map, with tiny labels 黑板 and 校门 at its
   ends. [Characters skip along the dotted path.]
3. 你说要回家我就陪你到车站口: out on the street, slowing to a walk: trees, low shop
   fronts, a peach-and-gold sunset. The bus stop sign appears far ahead.
4. 多走几步都算偷到: she deliberately takes tiny steps; each extra footstep leaves a small
   glowing `gold` star mark on the pavement, collected like treasure.
5. 等你下课再见一面就好: the bus stop. The bus arrives, he climbs on and waves from the
   window; she waves back as the bus pulls away, warm light on her face.
6. 把今天没说完的写在晚安后: dissolve to night, her bedroom: she lies on her bed holding her
   phone, the screen glow lighting her face. On screen (our own simple generic chat
   design, no real app), "晚安" is sent, then a longer message is typed, deleted and retyped
   after it. [The lyric line itself is the message being typed, character by character.]
7. 慢慢走 慢慢讲: small floating memory frames of today's walk drift around her like
   polaroids (the corridor, the dotted path, the bus wave). [Two halves of the line sit
   on two of the frames.]
8. 把喜欢藏在书包拉链口: close on her school bag: she slides a folded `rose` paper star into
   the front pocket and zips it shut, the zipper pull landing on the downbeat. [The lyric
   line slides into the pocket after the star and is zipped away.]

Interlude (instrumental until verse 2): time passes. From her bedroom window: the moon
arcs, morning comes, leaves on the tree outside turn and fall on beats, a wall calendar
flips pages, the first snowflake drifts down, and frost spreads across the window glass.

Exit handoff: the frosted bedroom window glass dissolves into the frosted school corridor
window of verse 2, same position on screen.

Check: preview from ?t=39 (verse 1 → chorus) to the start of verse 2. Show me stills for
lines 2, 4, 6 and 8, and one from the interlude.
```

---

## Prompt 4: Verse 2 (走廊风吹得好吵 → 我记的却是你眼睛在闪)

```
Read docs/TREATMENT.md, then build app/src/scenes/verse2.ts. Use _love.ts with outfit 'winter'
(her long beige coat, his rose knitted scarf).

Window: from 走廊风吹得好吵 to the end of 我记的却是你眼睛在闪 (about 77.5 → 103.3 s).
Mood: winter, cooler `frost` light, but playful and warm in the details. The rose scarf is
the warmest thing on screen.

Entry: the frosted window from the chorus interlude is now the corridor window; frost
recedes from the glass and we pan into the corridor.

Line by line:
1. 走廊风吹得好吵: corridor in strong wind: notices flapping on a board, her hair and coat
   blowing, paper scraps streaming past. [Characters are blown in from the side by the
   wind and settle into place as sung.]
2. 你的围巾还在我外套: close on her coat pocket with the end of his rose scarf peeking out;
   she touches it, and a soft warm glow appears. [Line in small handwriting along the scarf.]
3. 你问我怎么还不还: he appears beside her and points at the scarf, with a little "?" pop.
   [This line sits in a speech bubble from him.]
4. 我说明天怕你会忘带: she looks away, blush ovals appear, and she answers. A small thought
   bubble shows her imagining tomorrow (the two of them at the gate). [Line in her speech
   bubble; the thought bubble is a tiny doodle.]
5. 楼梯口人好多: the stairwell crowded with silhouette students flowing downward like a river.
6. 我们却刚好走成并排: the crowd blurs and speeds up while the two of them, sharp, step into
   exact side-by-side alignment; the framing settles into symmetry on the downbeat.
   [Line split evenly above the two of them.]
7. 你讲老师的新笑话: he talks animatedly, with chalk-style doodle animations of the joke in
   the air (a stick-figure teacher, a chalk squiggle, a "!"). She laughs.
8. 我记的却是你眼睛在闪: everything else fades away; close on his eyes in a simple
   stylised form, with `gold` sparkles blooming in them. [Line softly glowing; 闪 sparkles.]

Exit handoff: the sparkles drift outward and become the warm streetlights of a blue-hour
street, which chorus 2 opens on.

Check: preview from ?t=74 (the interlude → verse 2 transition) through to chorus 2. Show me
stills for lines 1, 2, 4 and 8.
```

---

## Prompt 5: Chorus 2 (second 等你下课一起走好不好 → 把喜欢藏在书包拉链口)

```
Read docs/TREATMENT.md and the existing app/src/scenes/chorus.ts. Add the n = 2 variant
without breaking n = 1.

Window: from the second 等你下课一起走好不好 to the second 把喜欢藏在书包拉链口
(about 103.7 → 131.6 s). Same lyrics as chorus 1, so it should RHYME visually with chorus 1:
the same compositions and camera moves, transformed into winter. When viewers recognise a
shot, they should feel time has passed and the two have become closer.

Winter changes for each line:
- Blue hour (`dusk` sky, `navy` shadows) with warm `gold` streetlights; light snow; small
  breath-fog puffs at the start of each sung phrase.
- Entry: start from verse 2's streetlights; the walk begins under them.
- Line 2's dotted path is drawn in the snow as footprints instead of on the pavement.
- Line 4's star footsteps glow brighter and walk a little closer together than in chorus 1.
- Line 5 (bus stop): before he boards, she takes the rose scarf out of her pocket and wraps
  it around his neck, which resolves verse 2's scarf story. He waves from the bus wearing it.
- Line 6: the bedroom at night with snow falling outside; this time HE sends the first
  "晚安" and she replies.
- Line 7: the memory frames now include the scarf moment and the stairwell.
- Line 8: she unzips the pocket to add today's star, revealing it is already full of rose
  paper stars (one per day since autumn), then zips it shut on the downbeat.

Exit handoff: after the zip, the camera pulls back to her desk under a warm desk lamp,
with her bag hanging on the chair. This is the bridge's first frame.

Check: show me side-by-side stills of the same line in n = 1 and n = 2 (lines 1, 5 and 8),
and preview the verse 2 → chorus 2 transition from ?t=100.
```

---

## Prompt 6: Bridge (哪天如果我们 → 曾经为了谁慢半节下课铃)

```
Read docs/TREATMENT.md, then build app/src/scenes/bridge.ts. Use _love.ts.

Window: from 哪天如果我们 to the end of 曾经为了谁慢半节下课铃 (about 132.1 → 148.3 s).
Mood: reflective and bittersweet, imagining the future. Slower camera, the palette fades
toward desaturated `frost` with soft faded-film tones; the rose accent almost disappears.

Entry: her desk under the lamp from chorus 2. The lamp light cools and the colour drains
slightly.

Line by line:
1. 哪天如果我们: slow pull back and up from the desk; dust motes slow down almost to a stop.
2. 坐在不同的教室格子里: we are outside again, looking at the building's grid of
   classroom windows from the intro. She is in one window, he is in another far away, each
   lit at a different time of day. The camera keeps pulling back and the grid multiplies,
   so they get smaller and further apart. On the downbeat the windows flatten into the
   squares of 作文格子 composition paper (the double meaning of 格子). [This line is written
   one character per square.]
3. 会不会还记得 (a long held note, about 6 s): two tiny doodled figures, her and him, sit in
   separate squares on the paper. As the note holds, a pencil slowly draws the dotted path
   from her square toward his, square by square, reaching his square as the note ends.
   [Characters in squares, highlighted slowly with the held note.]
4. 曾经为了谁慢半节下课铃: the classroom clock returns. Its second hand slows, hesitates
   for exactly half a beat, then catches up. [Line written in chalk under the clock, as in
   verse 1, but fainter.]

Exit handoff: at the very end of the line, a single raindrop hits the clock's glass and
splashes; ripples spread across the whole frame and the colour comes back as rain.

Check: preview from ?t=129 to the finale start. Show me stills for lines 2, 3 (start and
end of the held note) and 4.
```

---

## Prompt 7: Final chorus (等你下课一起走好不好 → 把喜欢一点一点说出口)

```
Read docs/TREATMENT.md, then build app/src/scenes/finale.ts. Use _love.ts and reuse chorus.ts
pieces (the walk, dotted path, bus stop) where it helps. This is the emotional peak.

Window: from the last 等你下课一起走好不好 (right after the bridge, about 148.3 s) to the end of
把喜欢一点一点说出口 (about 178.2 s).
Mood arc: starts in steady rain (`frost`, cool) and warms line by line to a full `gold`
sunset by the last line. The palette should visibly change across the section.

Entry: the raindrop ripples from the bridge resolve into rain falling at the school gate.

Line by line:
1. 等你下课一起走好不好: the school gate in rain. She opens a small transparent umbrella; he
   has none. She holds it out toward him. [Line drawn as if on the wet glass in front of
   camera, with raindrops running through it.]
2. 就算雨下到伞都不够大了: walking under the too-small umbrella: raindrops splash on both
   of their outer shoulders; the umbrella is clearly not big enough.
3. 你靠过来一点我就觉得刚刚好: he leans closer and their shoulders touch. The gap between
   them closes, a soft `blush` glow appears where they meet, and the rain on the umbrella
   sparkles. [刚刚好 lands exactly as they touch.]
4. 把全世界都缩进这条小路: the camera rises; the world around them softly blurs and curves
   in (a miniature, tilt-shift look) until only the small road with the umbrella remains,
   framed in a soft circle like a raindrop. The dotted path runs along the little road.
   [Line curves around the circle.]
5. 等你下课再见一面就好: the bus stop; the rain eases.
6. 就算只说一句“明天见”也够: he says "明天见" in a speech bubble and she smiles back.
   [The quoted 明天见 is larger and highlighted rose; the quotation marks are drawn.]
7. 慢慢走 慢慢讲: the rain stops, clouds part into a gold sunset, puddles reflect them
   both, and he closes the umbrella.
8. 把喜欢一点一点说出口: the payoff of the zipper motif. She faces him, unzips the pocket,
   and the rose paper stars float out ONE BY ONE ("一点一点"), each one rising as a
   character of the lyric is sung, into the sunset. He looks at her; they face each other
   in silhouette against the sun, with bloom and a soft light leak.

Exit handoff: the stars keep rising and the camera tilts up with them into the sunset sky,
which is where the outro begins.

Check: preview from ?t=145 (bridge → finale). Show me stills for lines 1, 3, 4, 6 and 8,
and confirm the colour arc from rain to sunset reads clearly.
```

---

## Prompt 8: Outro (after 把喜欢一点一点说出口 → end of the song)

```
Read docs/TREATMENT.md and app/src/scenes/intro.ts, then build app/src/scenes/outro.ts. The
outro MIRRORS the intro, so reuse the intro's drawing code (refactor shared parts into
_love.ts if needed) so the two match exactly.

Window: from the end of 把喜欢一点一点说出口 to the end of the audio. Instrumental.
Mood: quiet, warm, complete. Sunset light.

Shots:
1. Entry: the paper stars from the finale fade into the sunset sky. The camera tilts back
   down to the school building exterior: the same composition as the intro's exterior shot,
   but at sunset.
2. The bell rings again with the same sound rings as the intro, now tinted `gold`.
3. The camera moves back IN through the same classroom window (the intro's move in
   reverse) into the empty classroom at sunset. Chairs are up on the desks except two side
   by side. The wall clock's second hand now ticks EXACTLY on the beat (no longer half a
   beat slow).
4. Close on her notebook on the desk: the umbrella doodle in the margin from the intro is
   now finished, with two small figures standing under it. Her pen rests on the page; it
   rolls a little and stops.
5. The title 《下课再见》 and a small credit line fade in by hand in F.hand() in the empty sky
   area of the frame or on the notebook page.
6. Final fade to `paper`, ending on a frame that matches the intro's first frame, so the
   video loops.

Check: show me the intro's first frame next to the outro's last frame, and stills for
steps 1, 3 and 4. Then render the full video draft: bun scripts/render.ts video --samples 4
--out ../out/draft.mp4
```

---

## After all parts: polish pass (optional)

```
Watch the whole video in preview from start to end. List every transition that does not
match its handoff in docs/TREATMENT.md, any lyric that is late or early, any character
drawing that looks inconsistent between parts, and any frame slower than 25 ms (render.ts
perf). Fix them, then render the final 1080p60 video with --samples auto --shutter 0.2.
```
