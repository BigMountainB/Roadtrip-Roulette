// ─────────────────────────────────────────────────────────────────────────
// HAND-REVIEWED overrides for policeSpriteMeta.js (which is GENERATED —
// rerunning scripts/buildPoliceSpriteMeta.mjs rewrites that file but never
// touches this one; policeAgencies.js merges these on top at load).
//
// Use for frames where the automatic red/blue lens scan mis-identifies
// livery graphics, unit numbers, stripes or taillights as roof lights.
// Every entry replaces ONLY the fields it names (per-frame shallow merge):
//   lb  — whole-bar anchor {x,y,w,h} normalized to the 768×512 canvas;
//         add dark:1 for an unlit/blacked-out bar (off-phase draws nothing,
//         flash uses the whole-bar alternating wash).
//   lbR / lbB — per-color lens boxes, or null to force the whole-bar wash
//         when per-color detection is unreliable.
// Mark every hand-set lb with override:1 so the contact sheets label it.
// Validate with: node scripts/policeLightbarSheet.mjs  (boxes drawn on art).
// ─────────────────────────────────────────────────────────────────────────

export default {
};
