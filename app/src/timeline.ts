// The edit: which scene plays when. Until the parts of docs/TREATMENT.md have scenes, one scene
// covers the whole song: the synced lyrics as plain type (scenes/karaoke.ts). Cut points are to
// come from lyric lines and the beat grid (data/lyrics.json, data/audio.json), never hard-coded times.
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

export function makeTimeline(_ly: Lyrics, au: AudioData): TimelineEntry[] {
  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  return [
    E('karaoke', 'karaoke', 0, au.duration),
  ];
}
