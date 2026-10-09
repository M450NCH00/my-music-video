// The edit: which scene plays when. Sections that have no scene of their own yet show the synced
// lyrics as plain type (scenes/karaoke.ts). Boundaries come from the analysed sections and lyric
// lines, snapped to the beat grid (data/lyrics.json, data/audio.json), never from hard-coded times.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  /** Start of a section of the music analysis (analysis/analyze.py SECTION_LINES). */
  const sec = (name: string) => {
    const s = au.sections.find((x) => x.name === name);
    if (!s) throw new Error(`section not found: ${name}`);
    return s.start;
  };

  /** Cut on the last beat at/before the first character of the matching line (never after it). */
  const cut = (q: string, nth = 0, tol = 0.02) => {
    const s = ly.get(q, nth).words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };

  const chorus1 = cut('等你下课一起走好不好');
  return [
    E('intro', 'intro', 0, sec('verse1')),
    E('verse1', 'verse1', sec('verse1'), chorus1),
    E('karaoke', 'karaoke', chorus1, au.duration),
  ];
}
