// ── Texture memory budget (owner 2026-09-07) ──────────────────────────────
// The restart symptom on iPhone is an OS memory termination, not a JS crash —
// which is why the window.error / unhandledrejection overlay never catches it.
// BootScene queues the WHOLE manifest: 347 entries, 244 MB compressed but
// ~830 MB DECODED, because a texture costs width x height x 4 regardless of how
// well its PNG compresses. The Ch.18 story art (~360 MB decoded) loads on top
// of that.
//
// Compression is not a memory fix; decoded dimensions are what matter. This
// module exists so every claim about that is measured rather than assumed.
//
// Pure reporting — it never frees anything and never runs in the hot path.

/** Bytes one decoded texture occupies: w x h x 4 (RGBA). */
export function decodedBytes(w, h) {
  return (Number(w) || 0) * (Number(h) || 0) * 4;
}

/** Conservative first mobile budget (owner): keep estimated decoded textures
 *  under this at any one time, then test on the oldest supported iPhone.
 *  NOT an Apple hard limit — real termination thresholds vary by device and
 *  system pressure. */
export const MOBILE_BUDGET_MB = 250;

/**
 * Walk Phaser's TextureManager and total the decoded cost.
 * Returns { count, bytes, mb, overBudget, largest[] }.
 */
export function textureReport(game, { top = 10 } = {}) {
  const list = [];
  let bytes = 0;
  try {
    const tm = game?.textures;
    for (const key of tm?.getTextureKeys?.() ?? []) {
      const src = tm.get(key)?.source?.[0];
      if (!src?.width) continue;
      const b = decodedBytes(src.width, src.height);
      bytes += b;
      list.push({ key, w: src.width, h: src.height, bytes: b });
    }
  } catch (_) { /* headless / no game */ }
  list.sort((a, b) => b.bytes - a.bytes);
  const mb = bytes / 1048576;
  return {
    count: list.length,
    bytes,
    mb: Math.round(mb * 10) / 10,
    overBudget: mb > MOBILE_BUDGET_MB,
    largest: list.slice(0, top),
  };
}

/** One-line console summary, tagged with where it was taken from. */
export function logTextureReport(game, label = '') {
  const r = textureReport(game);
  const tag = label ? ` [${label}]` : '';
  const flag = r.overBudget ? `  ⚠ OVER ${MOBILE_BUDGET_MB} MB BUDGET` : '';
  console.log(`[tex]${tag} ${r.count} textures ≈ ${r.mb} MB decoded${flag}`);
  return r;
}

/** Dev-only hook: window.__texReport() / window.__texTop().  Call once at boot.
 *  Deliberately not gated on a build flag — it allocates nothing until called. */
export function installTextureProbe(game) {
  try {
    globalThis.__texReport = (label) => logTextureReport(game, label);
    globalThis.__texTop = (n = 15) => {
      const r = textureReport(game, { top: n });
      for (const t of r.largest) {
        console.log(`  ${(t.bytes / 1048576).toFixed(1).padStart(6)} MB  ${t.w}x${t.h}  ${t.key}`);
      }
      return r.largest;
    };
  } catch (_) {}
}
