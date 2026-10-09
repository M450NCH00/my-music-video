// CHORUS — one module for two timeline entries, told apart by ctx.params.n:
//   n = 1  chorus 1, 等你下课一起走好不好 → 把喜欢藏在书包拉链口, and the instrumental interlude after it, up to verse 2
//   n = 2  chorus 2, the same lines the second time
// A placeholder until Prompt 3 (n = 1) and Prompt 5 (n = 2) of docs/PROMPTS.md build it and replace this file.
import { placeholder } from './_placeholder';

export default placeholder((params) => (params.n === 2 ? 'Chorus 2' : 'Chorus 1 + interlude'), 'chorus');
