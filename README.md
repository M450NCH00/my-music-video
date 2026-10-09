# 下课再见 — music video

A generative, code-rendered music video with character-synced karaoke typography. Every frame is a deterministic function of song time, so the live preview in the browser and the offline 1080p60 (or 4K60) export are identical.

This repository started as a copy of the code-rendered video for "I'm Upping My P(doom)" and is being reworked for another song, 下课再见. What works for the new song: the timing data (every sung character, the beat grid, the sections), the `intro` and `verse1` scenes (a cartoon classroom on a rainy afternoon) and `karaoke`, which shows the lyrics lit character by character in time with the voice for every section that has no scene of its own yet. The scenes of the original video are still in `app/src/scenes/` as reference; they look up that song's English lines and are not on the timeline. The look and the plan per section are in [`docs/TREATMENT.md`](docs/TREATMENT.md). The engine and scene API are documented in [`docs/ENGINE.md`](docs/ENGINE.md).

## Layout

- `audio/song.mp3` — the song.
- `lyrics/lyrics.src.js` — the lyrics, one entry per sung line. The aligner reads only the text; the times are filled in from the alignment, for reference.
- `analysis/` — Python (uv) tools that produce the timing data: Demucs stem separation, CTC forced alignment of the lyrics as pinyin, beat/downbeat/onset analysis. See `analysis/align.py` and `analysis/analyze.py`.
- `data/lyrics.json` — the start and end of every sung character.
- `data/audio.json` — tempo (140 BPM), beats, downbeats, sections, drum/vocal onsets and loudness envelopes.
- `app/` — the renderer: TypeScript + three.js, bun + Vite.
  - `src/engine/` — renderer core: timeline playback, post-processing (bloom, halation, grain), typography (Noto Sans SC for Chinese, Archivo, IBM Plex Mono, Cormorant Garamond, single-stroke plotter fonts), GPU line batches, HUD.
  - `src/scenes/` — one module per scene. `intro`, `verse1` and `karaoke` are the ones in use; the files starting with `_` (other than `_motifs.ts`) hold what they share: palette, people, the classroom, the yard, captions.
  - `src/timeline.ts` — the edit: which scene plays when.
  - `scripts/render.ts` — offline renderer (headless Chrome → raw frames over WebSocket → ffmpeg).
- `out/` — renders (not in the repo).

## Requirements

[bun](https://bun.sh), Google Chrome (the offline renderer drives it headless through playwright-core) and ffmpeg with libx264. The analysis tools need [uv](https://docs.astral.sh/uv/); the renderer doesn't.

## Preview

```sh
cd app
bun install
bunx vite
```

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
bun scripts/render.ts video --samples auto --shutter 0.2 --out ../out/video.mp4
```

- **Output:** 1920×1080 at 60 fps, x264 CRF 16, AAC audio.
- **Motion blur:** every frame is the average of many sub-frames spread over a short shutter (`--shutter 0.2`, a fifth of the frame time), so fast motion leaves a continuous streak instead of a few stepped copies. `--samples auto` picks the count for each 32×32 tile of the frame: 12 where the image is still, 36 for ordinary camera motion, 108 or 324 for whips, slams and fast zooms. A tile stops once more sub-frames would no longer change it by more than `--tol` levels of 255 (default 3), and later sub-frames skip it, so a fast object over a still background costs little more than the object. `--refine frame` picks one count for the whole frame instead (slower, the sampler before tiles). `--samples N` takes a fixed N (`--samples 4` makes a quick draft; `--samples 1` is enough for the `karaoke` scene, where nothing moves fast). How it works: "Motion blur and sampling" in [`docs/ENGINE.md`](docs/ENGINE.md).
- **Pipeline:** two headless Chromes (`--workers 2`) render chunks of 8 frames (`--chunk`) in turn and stream them to one ffmpeg, which gets them in order: the file is the same as from one renderer. One renderer already keeps the GPU busy in the heavy scenes; the second fills the gaps in the light ones. Frames that wait for the encoder are buffered in memory up to `--mem-gb` (default 1) and then on disk up to `--spool-gb` (default 20, in the system temp folder), so the renderers don't wait for x264 in the light scenes and x264 catches up in the heavy ones.
- **Other modes:** `stills`, `sheet` (contact sheets, `--cuts` for every scene boundary), `perf`, and `plates` (regenerates `public/plates/`, the stills used by the outro's rewind montage; rerun it after changing a scene).

### 4K

```sh
cd app
bun scripts/render.ts video --scale 2 --samples auto --shutter 0.2 --x264 aq-mode=3:rc-lookahead=30 --out ../out/video-4k.mp4
```

- **Output:** a true 3840×2160 render (not an upscale): every layer, line and shader is rendered at the physical resolution. Scenes are laid out in 1920×1080 logical pixels, so the 4K frame looks like the 1080p one, only sharper.
- **Cost:** GPU-bound, and four times the pixels of the 1080p render. Memory is the limit: each headless Chrome and ffmpeg can each take several GB at 4K (the shorter x264 lookahead above keeps ffmpeg down).
- **Encoding:** the film grain is rendered per 4K pixel, which is expensive to encode: at the default CRF 16 the file runs at about 670 Mbit/s (13 GB for the song, 8× the 1080p file), `--crf 18` gives about 450 Mbit/s and `--crf 20` about 230 Mbit/s.
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
- **Sections:** `SECTION_LINES` in `analyze.py` names the lyric line each section starts with.

The models download about 1.5 GB of weights into `analysis/.cache/`; delete that folder afterwards.

## Credits

- **Renderer:** the engine and the original scenes come from the code-rendered video for "I'm Upping My P(doom)", made with Claude in Claude Code.
- **Fonts:** Noto Sans SC, Archivo, IBM Plex Mono and Cormorant Garamond (SIL Open Font License). Single-stroke EMS and Hershey fonts via the `hersheytext` package (OFL / public domain).

## License

The code is released under the [MIT License](LICENSE). The fonts in `app/public/fonts/` keep their own licenses (see Credits), and the song and lyrics (`audio/`, `lyrics/`, `data/lyrics.json`) are not covered by it: they belong to their author.
