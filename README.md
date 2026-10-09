# 《下课再见》 music video

A code-rendered music video with karaoke typography synced to every sung character. Every frame is a deterministic function of song time, so the live preview in the browser and the offline 1080p60 (or 4K60) export are identical.

The renderer started as a fork of the code-rendered video for "I'm Upping My P(doom)"; that song and its scenes are gone. What is in place for 《下课再见》: the song, its lyrics and the timing data (every sung character, the beat grid, the sections). The video itself is built part by part:

- [`docs/TREATMENT.md`](docs/TREATMENT.md) — the story, the art style, the palette, the characters and how each part hands over to the next. The single source of truth for the look.
- [`docs/PROMPTS.md`](docs/PROMPTS.md) — the prompts that build it: a foundation, then one part of the song per session.
- [`docs/ENGINE.md`](docs/ENGINE.md) — the engine and the scene API.

Until the parts have scenes, one scene (`karaoke`) shows the lyrics as plain type, lit character by character with the voice.

## Layout

- `audio/song.mp3` — the song.
- `lyrics/lyrics.src.js` — the lyrics, one entry per sung line. The aligner reads only the text; the times are filled in from the alignment, for reference.
- `analysis/` — Python (uv) tools that produce the timing data: Demucs stem separation, CTC forced alignment of the lyrics as pinyin, beat/downbeat/onset analysis. See `analysis/align.py` and `analysis/analyze.py`.
- `data/lyrics.json` — the start and end of every sung character.
- `data/audio.json` — tempo (70 BPM: the song is in half time, the drums' own pulse is twice that), beats, downbeats, sections, drum/vocal onsets and loudness envelopes.
- `app/` — the renderer: TypeScript + three.js, bun + Vite.
  - `src/engine/` — renderer core: timeline playback, the palette, post-processing (bloom on light sources, lifted blacks, fine grain, a gentle vignette), typography, GPU line batches, the HUD (hidden by default).
  - `public/fonts/` — the fonts: LXGW WenKai (霞鹜文楷) for the lyrics and Noto Sans SC for small text, both cut down to the characters the video shows, and the Latin fonts the engine came with.
  - `src/scenes/` — one module per scene. `_love.ts` is the kit they share (the two characters, props, particles, light, the lyric renderer, transitions); `_kit-test.ts` shows all of it at http://localhost:5173/?scene=kit.
  - `src/timeline.ts` — the edit: which scene plays when.
  - `scripts/render.ts` — offline renderer (headless Chrome → raw frames over WebSocket → ffmpeg).
- `out/` — renders (not in the repo).

## Requirements

[bun](https://bun.sh), Google Chrome (the offline renderer drives it headless through playwright-core) and ffmpeg with libx264. The analysis tools need [uv](https://docs.astral.sh/uv/); the renderer doesn't.

## Preview

```sh
cd app
bun install
bun x vite
```

(`bun x`, not `bunx`: bun installed through winget on Windows has no `bunx` command.)

Open http://localhost:5173 and use the keys below. `?t=23` starts at a given time.

| Key | Action |
|---|---|
| space | play / pause |
| ← / → | seek ±1 s (±5 s with shift) |
| `,` / `.` | step one frame |
| `[` / `]` | previous / next scene |
| `l` | loop the current scene |
| `h` | hide the UI |

The export is not real time and is heavier than the preview.

## Render the video

```sh
cd app
bun scripts/render.ts video --samples auto --shutter 0.2
```

- **Output:** `out/mv.mp4` (or `--out <file>`), 1920×1080 at 60 fps, x264 CRF 16, AAC audio.
- **Motion blur:** every frame is the average of many sub-frames spread over a short shutter (`--shutter 0.2`, a fifth of the frame time), so fast motion leaves a continuous streak instead of a few stepped copies. `--samples auto` picks the count for each 32×32 tile of the frame: 12 where the image is still, 36 for ordinary camera motion, 108 or 324 for whips, slams and fast zooms. A tile stops once more sub-frames would no longer change it by more than `--tol` levels of 255 (default 3), and later sub-frames skip it, so a fast object over a still background costs little more than the object. `--refine frame` picks one count for the whole frame instead (slower, the sampler before tiles). `--samples N` takes a fixed N (`--samples 4` makes a quick draft; `--samples 1` is enough for the `karaoke` scene, where nothing moves fast). How it works: "Motion blur and sampling" in [`docs/ENGINE.md`](docs/ENGINE.md).
- **Pipeline:** two headless Chromes (`--workers 2`) render chunks of 8 frames (`--chunk`) in turn and stream them to one ffmpeg, which gets them in order: the file is the same as from one renderer. One renderer already keeps the GPU busy in the heavy scenes; the second fills the gaps in the light ones. Frames that wait for the encoder are buffered in memory up to `--mem-gb` (default 1) and then on disk up to `--spool-gb` (default 20, in the system temp folder), so the renderers don't wait for x264 in the light scenes and x264 catches up in the heavy ones.
- **Other modes:** `stills`, `sheet` (contact sheets, `--cuts` for every scene boundary) and `perf`.

### 4K

```sh
cd app
bun scripts/render.ts video --scale 2 --samples auto --shutter 0.2 --x264 aq-mode=3:rc-lookahead=30 --out ../out/mv-4k.mp4
```

- **Output:** a true 3840×2160 render (not an upscale): every layer, line and shader is rendered at the physical resolution. Scenes are laid out in 1920×1080 logical pixels, so the 4K frame looks like the 1080p one, only sharper.
- **Cost:** GPU-bound, and four times the pixels of the 1080p render. Memory is the limit: each headless Chrome and ffmpeg can each take several GB at 4K (the shorter x264 lookahead above keeps ffmpeg down).
- **Encoding:** the film grain is rendered per 4K pixel, so a 4K file is several times the size of the 1080p one; a higher `--crf` (18 or 20) makes it smaller.
- `--scale 2` works with every mode. `stills` then saves full-resolution PNGs, and `perf` measures 4K frame times. In the browser preview, add `&scale=2` to the URL.

## Regenerate the timing data

The committed `data/*.json` files are all the renderer needs. To regenerate them (after changing the song or the lyrics):

```sh
cd analysis
uv sync
uv run python separate.py        # stems/htdemucs_ft/song/*.wav (Demucs; about 20 minutes on a CPU)
uv run python ctc_emissions.py   # work/emission_*.npy
uv run python vocal_feats.py     # work/vocal_feats.npz
uv run python align.py --plots   # data/lyrics.json, qa/line_*.png
uv run python analyze.py         # data/audio.json
uv run python check.py           # report: line windows, confidence, repeated lines
```

- **Lyrics:** every Chinese character is aligned as its toneless pinyin (`pron.py`; add a reading to `PRON` there where the dictionary one is not the sung one).
- **Checking:** `check.py` flags lines with low confidence and repeated lines whose rhythm differs between repeats; the plots in `analysis/qa/` show every line over the vocal's spectrogram. Corrections go in `FIX` in `align.py`.
- **Sections:** `SECTIONS` in `analyze.py` names the lyric line each section starts with, or follows for the instrumental ones (interlude, outro).

The models download about 1.5 GB of weights into `analysis/.cache/`; delete that folder afterwards.

## Fonts

The Chinese fonts in `app/public/fonts/` are subsets (about 100 KB each instead of 17–28 MB): they hold the characters of the lyrics and the title, punctuation, digits, Latin letters and a short list of extras. A character outside that set is drawn in a fallback font, and the renderer warns in the console. To add characters, put them in `EXTRA` in `analysis/make_fonts.py` and rebuild:

```sh
cd analysis
uv run python make_fonts.py
```

The first run downloads the full fonts (about 100 MB) into `analysis/.cache/fonts/`.

## Credits

- **Renderer:** the engine comes from the code-rendered video for "I'm Upping My P(doom)", made with Claude in Claude Code.
- **Fonts:** [LXGW WenKai](https://github.com/lxgw/LxgwWenKai) (霞鹜文楷) and [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC), as subsets, and Archivo, IBM Plex Mono and Cormorant Garamond: all under the SIL Open Font License (the licence texts are in `app/public/fonts/`). Single-stroke EMS and Hershey fonts via the `hersheytext` package (OFL / public domain).

## License

The code is released under the [MIT License](LICENSE). The fonts in `app/public/fonts/` keep their own licenses (see Credits), and the song and lyrics (`audio/`, `lyrics/`, `data/lyrics.json`) are not covered by it: they belong to their author.
