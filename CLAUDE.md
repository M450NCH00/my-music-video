# 《下课再见》 music video

A music video rendered by code. `app/` (TypeScript, three.js + Canvas2D, bun + Vite) draws every frame from the song time; `analysis/` (Python, uv) made the timing data. The user builds it one part of the song per session, from the prompts in `docs/PROMPTS.md`. Prompt 0 (the foundation) is done. A part is not built yet while its scene file still imports `./_placeholder`.

## Before you change anything

- Read `docs/TREATMENT.md` (the story and the look: the user's style bible, it wins over your own taste) and `docs/ENGINE.md` (at least "Running things", "Writing a scene", "The love kit" and "Typography").
- Do only the prompt or step the user names, and stop at the check-ins it asks for. The user watches token use: no extra work, short reports.

## Rules for scenes

- Building a part means replacing its placeholder file in `app/src/scenes/` (`intro.ts`, `verse1.ts`, `chorus.ts`, `verse2.ts`, `bridge.ts`, `finale.ts`, `outro.ts`). The timeline already has all eight parts.
- Everything shared comes from `./_love` (characters, props, particles, light, lyrics, transitions). Draw the two characters only with `drawGirl` / `drawBoy`: their look is approved, so fix bugs but don't restyle them.
- Draw lyrics with `drawLyric` (it implements the karaoke rule) and find lines by content, `this.ctx.lyrics.get('教室钟慢半拍')`. Never hard-code times.
- Deterministic: no `Math.random`, `Date.now` or `performance.now` in scenes. Colours only from the palette (`rgba('rose')`, `mix('paper', 'peach', k)`).
- Change shared code (`app/src/engine/`, `scenes/_love*.ts`, `app/src/timeline.ts`) only when the prompt needs it, and say so in your report. Don't edit `docs/TREATMENT.md` or `docs/PROMPTS.md` unless asked.

## Checking and finishing

- In `app/`: `bun x tsc --noEmit -p tsconfig.json`, then render stills and LOOK at them with the Read tool: `bun scripts/render.ts stills --t 16.2,20 --only verse1 --out ../out/wip/verse1`. The ids for `--only` are `intro, verse1, chorus1, verse2, chorus2, bridge, finale, outro`. `bun scripts/render.ts sheet --cuts --out ../out/wip/cuts.png` shows the frames around every cut. The kit on screen: `--scene kit`, or `?scene=kit` in the preview.
- Show the user the stills the prompt asks for, as links to the PNG files, and tell them how to preview: `cd app; bun x vite`, then `http://localhost:5173/?t=<seconds>`.
- Commit on `main` when a step or part is done. Don't push unless asked.

## This machine (Windows)

- `bun`, `ffmpeg` and `uv` were installed with winget and are often not on PATH in tool shells. If a command is not found, add its folder under `%LOCALAPPDATA%\Microsoft\WinGet\Packages` to PATH for that command (`Oven-sh.Bun_*\bun-windows-x64`, `Gyan.FFmpeg_*\ffmpeg-*\bin`, `astral-sh.uv_*`).
- There is no `bunx` here: where `docs/PROMPTS.md` says `bunx vite`, run `bun x vite`.
