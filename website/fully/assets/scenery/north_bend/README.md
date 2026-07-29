# North Bend scenery set

Production-ready transparent PNGs are in `final/`. Chroma-key source renders are retained in `raw/` for non-destructive revisions.

## Render order

1. Sky/weather background (code-generated or existing system)
2. `final/north_bend_far_horizon.png`
3. `final/north_bend_left_mount_si.png`
4. `final/north_bend_right_rattlesnake.png`
5. `final/north_bend_ground_underlay.png`
6. Existing perspective road, rendered entirely over the ground underlay
7. Optional edge accents: `final/north_bend_left_groundcover.png` and `final/north_bend_right_groundcover.png`
8. Existing tree, building, sign, traffic, barrier, and guardrail sprites
9. Player/HUD according to the existing scene pipeline

## Intended placement

- All three assets share an approximate vanishing point at `x = 50%`, `y = 45%` of the gameplay viewport.
- The Mount Si plate fills the left/north side. Its diagonal transparent edge borders the left road shoulder.
- The Rattlesnake Ridge plate fills the right/south side. Its diagonal transparent edge borders the right road shoulder.
- Scale/crop each plate to the viewport independently; do not stretch it to cover both sides of the road.
- The far horizon moves slowest. The two terrain plates move slightly faster. Existing individual roadside sprites carry the fastest parallax.
- Position the visible tip of `north_bend_ground_underlay.png` at the shared vanishing point. Scale it so its base extends beyond both lower viewport corners.
- The underlay is one connected triangle spanning foothill to foothill. It has no road-shaped hole. Draw every road segment and curve over it so exposed areas always reveal matching terrain.
- The two narrow groundcover wedges are optional decorative edge accents only. They are not required to fill geometry and should never define the road's path.

## Geographic intent

- Eastbound I-90 approaching North Bend in clear summer daylight.
- Mount Si appears on the left/north from its south-southwest face.
- Rattlesnake Ridge forms the forested right/south enclosure.
- No roadside lake is included; water should only appear in a dedicated route-specific variant.
