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
  // snoqualmie_police — blacked-out low-profile bar: the scanner kept locking onto
  // taillights / unit numbers / livery stripes, so every angle is pinned to
  // the WSP roof-bar geometry (same Explorer body) remapped through solid
  // body boxes.  Whole-bar dark flash only; no per-color lenses.
  'jur_snoqualmie_police_000': { lb: { x: 0.5007, y: 0.3976, w: 0.2422, h: 0.0196, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_snoqualmie_police_007': { lb: { x: 0.5046, y: 0.4541, w: 0.224, h: 0.0159, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_snoqualmie_police_012': { lb: { x: 0.5026, y: 0.4601, w: 0.2253, h: 0.0168, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_snoqualmie_police_030': { lb: { x: 0.5026, y: 0.5639, w: 0.2383, h: 0.0134, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_snoqualmie_police_060': { lb: { x: 0.466, y: 0.4887, w: 0.2365, h: 0.0151, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_snoqualmie_police_090': { lb: { x: 0.4453, y: 0.4625, w: 0.056, h: 0.0172, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_snoqualmie_police_120': { lb: { x: 0.5449, y: 0.3674, w: 0.263, h: 0.0217, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_snoqualmie_police_150': { lb: { x: 0.4544, y: 0.4095, w: 0.2174, h: 0.0236, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_snoqualmie_police_180': { lb: { x: 0.5091, y: 0.4246, w: 0.1758, h: 0.0154, dark: 1, override: 1 }, lbR: null, lbB: null },

  // adams_sheriff — blacked-out low-profile bar: the scanner kept locking onto
  // taillights / unit numbers / livery stripes, so every angle is pinned to
  // the WSP roof-bar geometry (same Explorer body) remapped through solid
  // body boxes.  Whole-bar dark flash only; no per-color lenses.
  'jur_adams_sheriff_000': { lb: { x: 0.5007, y: 0.3842, w: 0.2422, h: 0.0202, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_adams_sheriff_007': { lb: { x: 0.5046, y: 0.54, w: 0.224, h: 0.0129, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_adams_sheriff_012': { lb: { x: 0.5026, y: 0.5117, w: 0.2253, h: 0.0149, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_adams_sheriff_030': { lb: { x: 0.5026, y: 0.4013, w: 0.2383, h: 0.0197, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_adams_sheriff_060': { lb: { x: 0.466, y: 0.3297, w: 0.2365, h: 0.0207, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_adams_sheriff_090': { lb: { x: 0.4453, y: 0.4033, w: 0.056, h: 0.0195, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_adams_sheriff_120': { lb: { x: 0.5449, y: 0.3866, w: 0.263, h: 0.0209, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_adams_sheriff_150': { lb: { x: 0.4544, y: 0.3519, w: 0.2174, h: 0.0263, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_adams_sheriff_180': { lb: { x: 0.5091, y: 0.4093, w: 0.1758, h: 0.0159, dark: 1, override: 1 }, lbR: null, lbB: null },

  // othello_police — blacked-out low-profile bar: the scanner kept locking onto
  // taillights / unit numbers / livery stripes, so every angle is pinned to
  // the WSP roof-bar geometry (same Explorer body) remapped through solid
  // body boxes.  Whole-bar dark flash only; no per-color lenses.
  'jur_othello_police_000': { lb: { x: 0.5007, y: 0.369, w: 0.2422, h: 0.0207, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_othello_police_007': { lb: { x: 0.5046, y: 0.5323, w: 0.224, h: 0.0132, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_othello_police_012': { lb: { x: 0.5026, y: 0.5269, w: 0.2253, h: 0.0143, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_othello_police_030': { lb: { x: 0.5019, y: 0.4243, w: 0.2378, h: 0.0188, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_othello_police_060': { lb: { x: 0.466, y: 0.3948, w: 0.2365, h: 0.0184, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_othello_police_090': { lb: { x: 0.4453, y: 0.4299, w: 0.056, h: 0.0185, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_othello_police_120': { lb: { x: 0.5449, y: 0.3789, w: 0.263, h: 0.0212, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_othello_police_150': { lb: { x: 0.4544, y: 0.4115, w: 0.2174, h: 0.0235, dark: 1, override: 1 }, lbR: null, lbB: null },
  'jur_othello_police_180': { lb: { x: 0.5091, y: 0.3728, w: 0.1758, h: 0.0171, dark: 1, override: 1 }, lbR: null, lbB: null },
};
