// Reunion branch script. The data lives in story.json so the /dialogue2 "Publish my edits" button
// (apply-edits.mjs, run by .github/workflows/dialogue2-apply.yml) can apply edits to it safely.
// Node fields: title, beats [{speaker, text}] (speaker 'Scene' = narration), art (cast id for the
// portrait), artDesc (artwork description), next | choices [{id, label, to}] | end (+ nextChapter).
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('./story.json', import.meta.url), 'utf8'));
export const { version, cast, chapters } = data;
