# RTR Comic Balloon Art Library

These are art-direction masters for the Road Trip Roulette comic renderer. They are intentionally separate from story art and contain no baked-in dialogue.

## Rules

- Use SVG paths as the source of truth. Do not convert these masters to PNG, WebP, or AVIF.
- Balloon bodies, speaker tails, and balloon-to-balloon bridges are separate **authoring components only**. Before drawing, combine the selected components into one final silhouette.
- The blank master viewBox is a contour reference, **not** a requested on-screen size. Never place a master into a large preset rectangle.
- Fit and line-break the dialogue first, measure the finished text block, and then size the body tightly around it.
- Target side padding of 0.70–0.95 em and top/bottom padding of 0.42–0.65 line-height. Organic oval shoulders may exceed that only where their curvature requires it; do not add uniform empty space merely to preserve the source viewBox.
- For the compact `contour-fit` family, build an envelope from the measured visible bounds of each finished text line, offset it by 10 CSS pixels at the reference gameplay scale, then smooth the stepped envelope into an organic continuous contour. Scale that inset proportionally for book/export rendering. Do not trace individual glyphs or create a sticker-like edge around every letter.
- Center lettering vertically using the union of the **visible glyph/ink bounds**, not the font line box or baseline. Ascender, descender, and leading metrics may make mathematically centered text look too high.
- A one-word final line is acceptable inside an intentional compact stack when the surrounding lines contain roughly two to four words. Reject and rewrap a severe orphan: one word beneath a much wider line, especially after a line of seven or more words.
- A body may be resized only within the family ranges documented in `manifest.json`. Preserve the approved outline weight at the final rendered size.
- Never invent a new body, tail, bridge, diamond, or connector at runtime.
- Directly joined balloons overlap and are unioned into one silhouette with no internal seam.
- Bridge assets are narrow open bands with exactly two visible side rails. Target width is 0.35–0.55 of the rendered dialogue line-height, with a hard maximum of 0.65. They must remain visibly slimmer than an ordinary speaker-tail base and must never grow wider because the balloons are farther apart. Both ends remain fully open into the balloon bodies; neither balloon outline may cross an opening. One missing rail or any end cap is a failure.
- At narrow bridge widths, rail stroke weight should be about 70–85% of the ordinary balloon outline so the two nearby rails do not merge into one heavy bar. It may never exceed the body outline weight.
- Speaker tails are unioned with the balloon body before the outline is drawn. Only the two outside tapering edges are stroked. There is no border, base cap, seam, or leftover balloon-outline segment where the tail meets the body.
- Every spoken balloon from a visible/on-panel character requires an attributed tail, including shout, whisper, distress, player, flirt, and ordinary speech. Body-only SVGs are contour masters, not complete on-panel balloons. Tail omission is allowed only for captions, free-floating sound effects, or explicitly off-panel speech. A linked same-speaker group normally uses one attributed tail for the group.
- The final composite receives one outside outline after the body/tail/bridge union. Do not stroke the pieces separately and attempt to hide their borders afterward.
- All placement remains subject to Level 1/2 protection and crop-safety rules in `CLAUDE_WORKING_NOTES.md`.

The review contact sheet is at `review/comic_balloon_library_2026-09-11/contact-sheet.svg`.
