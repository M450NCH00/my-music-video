// The edit: which scene plays when. The song has eight parts (docs/TREATMENT.md, "Sections, scene
// modules and handoffs"); each is one entry here and one scene module. A part starts where its
// first lyric line starts, found by content and snapped to the nearest beat, so no time is
// written down here: the edit follows the timing data (data/lyrics.json, data/audio.json).
//
//   id        scene module       starts at   on the line
//   intro     scenes/intro.ts    0:00.0      (instrumental)
//   verse1    scenes/verse1.ts   0:15.4      教室钟慢半拍
//   chorus1   scenes/chorus.ts   0:42.0      等你下课一起走好不好, the first time; params { n: 1 }; with the interlude after it
//   verse2    scenes/verse2.ts   1:17.1      走廊风吹得好吵
//   chorus2   scenes/chorus.ts   1:43.7      等你下课一起走好不好, the second time; params { n: 2 }
//   bridge    scenes/bridge.ts   2:12.0      哪天如果我们
//   finale    scenes/finale.ts   2:28.3      等你下课一起走好不好, the last time
//   outro     scenes/outro.ts    2:58.3      (instrumental: the beat nearest the end of 把喜欢一点一点说出口)
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

/**
 * `?scene=<name>`: one scene alone for the length of the song, off the timeline. `kit` is
 * scenes/_kit-test.ts (the characters, particles and lyric styles of the shared kit).
 */
export function makeSolo(name: string) {
  const file = [`_${name}-test`, `_${name}`, name].find((f) => modules[`./scenes/${f}.ts`]) ?? `_${name}-test`;
  return (_ly: Lyrics, au: AudioData): TimelineEntry[] => [{ id: name, load: scene(file), start: 0, end: au.duration }];
}

/** The parts in order: the timeline entry's id, its scene module, and the params the module gets. */
const PARTS = [
  { id: 'intro', file: 'intro' },
  { id: 'verse1', file: 'verse1' },
  { id: 'chorus1', file: 'chorus', params: { n: 1 } },
  { id: 'verse2', file: 'verse2' },
  { id: 'chorus2', file: 'chorus', params: { n: 2 } },
  { id: 'bridge', file: 'bridge' },
  { id: 'finale', file: 'finale' },
  { id: 'outro', file: 'outro' },
] as const;
type PartId = (typeof PARTS)[number]['id'];

/**
 * How many beats a part already plays before its cut, over the end of the part before it.
 * Nothing here = a straight cut on the beat: a part ends on its handoff frame and the next one
 * starts from it. A part whose way in needs the previous part's picture (it sets
 * `handlesTransition` and composites `f.under`, or leaves it to the engine's cross-dissolve) asks
 * for its overlap here, e.g. `verse1: 1`. At most one bar (4).
 */
const OVERLAP: Partial<Record<PartId, number>> = {};

const CHORUS = '等你下课一起走好不好';

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  // a cut is a beat: the one nearest to where the part's first line starts
  const beatOf = (t: number) => Math.round(au.beatAt(t));
  const starts = (text: string, nth = 0) => beatOf(ly.get(text, nth).start);
  const cut: Record<Exclude<PartId, 'intro'>, number> = {
    verse1: starts('教室钟慢半拍'),
    chorus1: starts(CHORUS, 0),
    verse2: starts('走廊风吹得好吵'),
    chorus2: starts(CHORUS, 1),
    bridge: starts('哪天如果我们'),
    finale: starts(CHORUS, 2),
    outro: beatOf(ly.get('把喜欢一点一点说出口').end),
  };
  return PARTS.map((p, i): TimelineEntry => {
    const next = PARTS[i + 1];
    return {
      id: p.id,
      load: scene(p.file),
      start: p.id === 'intro' ? 0 : au.timeOfBeat(cut[p.id] - (OVERLAP[p.id] ?? 0)),
      end: next ? au.timeOfBeat(cut[next.id as Exclude<PartId, 'intro'>]) : au.duration,
      params: 'params' in p ? p.params : undefined,
    };
  });
}
