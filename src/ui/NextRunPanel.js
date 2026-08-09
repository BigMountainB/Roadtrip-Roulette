/**
 * "NEXT RUN" advice panel — the read-out half of the ending-tips feature
 * (owner 2026-08-09). Knows nothing about WHY a run ended; it just draws the
 * copy that src/data/endingTips.js selected.
 *
 * Drawn as Phaser text + graphics over the ending artwork — never baked into
 * the plate PNGs, so the same panel works on every plate and the art files are
 * untouched.
 *
 * Styling follows the existing neon modals (RestStopScene._buildConfirmPopup,
 * GameScene._buildViceSliderModal): near-black navy fill, a bright accent
 * stroke, a dimmer inner stroke, and a soft outer glow. Headings use the game's
 * condensed display face, body copy the readable UI face, everything with a
 * heavy black stroke so it survives being laid over photographic art.
 *
 * INPUT: nothing here is ever made interactive, so the panel cannot steal taps
 * from the RESTART / CONTINUE / MENU buttons underneath it.
 */

const IMPACT = 'Impact, "Arial Black", Arial, sans-serif';
const BODY   = '"Helvetica Neue", Arial, sans-serif';

const PAD      = 12;     // internal padding
const ACCENT   = 0xFFCC44;
const ACCENT_2 = 0x39A8FF;
const HEAD_CSS = '#4FD8FF';

const TONE_CSS = {
  technique: '#E8EEFA',
  buy:       '#FFCC44',   // something to purchase
  own:       '#88FFCC',   // something already owned — how to use it
};

/**
 * @param {Phaser.Scene} scene
 * @param {object} tip     from selectTip(): { why, lines[] }
 * @param {object} opts    { x, y, w, depth, delay, camera }
 *   x, y, w  anchor + width in 800x450 design space (y is the panel TOP)
 *   depth    base depth; the panel occupies depth..depth+2
 *   delay    ms to wait before fading in, so the ending reveal lands first
 *   camera   optional: a camera that should IGNORE these objects (GameScene
 *            splits world/HUD across two cameras; ending scenes pass nothing)
 * @returns {Phaser.GameObjects.Container|null}
 */
export function showNextRunPanel(scene, tip, opts = {}) {
  if (!scene || !tip) return null;
  const { x = 500, y = 100, w = 280, depth = 60, delay = 420, camera = null } = opts;

  const innerW = w - PAD * 2;
  const container = scene.add.container(x, y + 10).setDepth(depth).setAlpha(0);

  // Text first — the backing panel is sized to whatever the copy needs, so a
  // longer fallback string can't overflow a fixed box.
  let cy = PAD;
  const kids = [];
  const push = (obj) => { kids.push(obj); container.add(obj); return obj; };

  const heading = (label) => {
    const t = scene.add.text(PAD, cy, label, {
      fontSize: '13px', fontFamily: IMPACT, color: HEAD_CSS,
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0, 0);
    push(t);
    cy += t.height + 2;
  };
  const body = (text, css) => {
    const t = scene.add.text(PAD, cy, text, {
      fontSize: '11.5px', fontFamily: BODY, color: css,
      stroke: '#000', strokeThickness: 3,
      wordWrap: { width: innerW }, lineSpacing: 2,
    }).setOrigin(0, 0);
    push(t);
    cy += t.height + 8;
  };

  heading('WHY IT ENDED');
  body(tip.why, TONE_CSS.technique);
  heading('NEXT RUN');
  for (const l of tip.lines ?? []) body(l.line, TONE_CSS[l.tone] ?? TONE_CSS.technique);

  const h = cy - 8 + PAD;   // trim the last gap, add bottom padding

  // Backing panel, drawn last but sent to the back so it sits behind the copy.
  const g = scene.add.graphics();
  // Outer glow — three expanding strokes at falling alpha, the cheap neon look
  // the rest of the UI uses.
  for (let i = 3; i >= 1; i--) {
    g.lineStyle(i * 2, ACCENT, 0.05 * i);
    g.strokeRoundedRect(-i * 2, -i * 2, w + i * 4, h + i * 4, 8 + i);
  }
  g.fillStyle(0x050812, 0.90);
  g.fillRoundedRect(0, 0, w, h, 8);
  g.lineStyle(2, ACCENT, 0.95);
  g.strokeRoundedRect(0, 0, w, h, 8);
  g.lineStyle(1, ACCENT_2, 0.55);
  g.strokeRoundedRect(4, 4, w - 8, h - 8, 6);
  container.add(g);
  container.sendToBack(g);

  if (camera) { try { camera.ignore(container); } catch (_) {} }

  // Slide + fade in after the ending reveal, so it never steps on the moment.
  scene.tweens.add({
    targets: container,
    alpha: 1,
    y: y,
    duration: 280,
    delay,
    ease: 'Quad.Out',
  });

  return container;
}
