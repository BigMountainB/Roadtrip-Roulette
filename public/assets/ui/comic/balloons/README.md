# RTR Comic Balloon Art Library

These are art-direction masters for the Road Trip Roulette comic renderer. They are intentionally separate from story art and contain no baked-in dialogue.

## Rules

- Use SVG paths as the source of truth. Do not convert these masters to PNG, WebP, or AVIF.
- Balloon bodies, speaker tails, and balloon-to-balloon bridges are separate assets.
- A body may be resized only within the family ranges documented in `manifest.json`. Preserve the approved outline weight at the final rendered size.
- Fit and line-break the dialogue before selecting the final body proportions.
- Never invent a new body, tail, bridge, diamond, or connector at runtime.
- Directly joined balloons overlap and are unioned into one silhouette with no internal seam.
- Bridge assets are open bands. Their entry and exit ends must remain open into the balloon bodies.
- Speaker tails have two tapered side strokes and no base cap where they enter a balloon.
- All placement remains subject to Level 1/2 protection and crop-safety rules in `CLAUDE_WORKING_NOTES.md`.

The review contact sheet is at `review/comic_balloon_library_2026-09-11/contact-sheet.svg`.
