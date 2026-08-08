# Claude implementation prompt — garage store redesign

Copy everything below this line into Claude while its working directory is the Road Trip Roulette project root.

---

Implement the new Les Schwasted / Finesse (FAP) garage store interface in this existing Phaser game. The target is the polished mockup supplied by the owner: full-bleed storefront and NPC on the right, a cohesive upgrade console on the left, and one row of seven category tabs along the bottom. The crucial behavior change is that selecting a category must show the category's complete upgrade progression at once—not only the next purchasable item.

Before editing, inspect the current implementation and preserve its working behavior:

- `src/scenes/RestStopScene.js`
- `src/data/upgrades.js`
- `src/systems/UpgradeSystem.js`
- `src/systems/AssetManifest.js`
- `src/constants.js` (`SCREEN_W = 800`, `SCREEN_H = 450`)
- `tests/upgrades.test.mjs`

Do not replace or bypass the current wallet, save, discount, purchase, installed-tier, temporary-upgrade, receipt, or shop-stock logic. This is a presentation and interaction redesign around the existing systems. Do not invent prices, effects, upgrade names, or new ownership semantics.

## New artwork

Twenty-one tier thumbnails plus one combined category image, all finished 768×768 PNGs, are already present in:

`public/assets/businesses/garage_upgrade_tiers/`

Register these in `src/systems/AssetManifest.js` and map them to their corresponding catalog entries. Suggested texture keys are shown below:

```text
garage_up_tires_1       tires_1_used_all_seasons.png
garage_up_tires_2       tires_2_good_all_seasons.png
garage_up_tires_3       tires_3_snow_tires.png

garage_up_brakes_1      brakes_1_new_pads.png
garage_up_brakes_2      brakes_2_slotted_rotors.png
garage_up_brakes_3      brakes_3_big_brake_kit.png

garage_up_susp_1        suspension_1_fresh_shocks.png
garage_up_susp_2        suspension_2_rally_springs.png
garage_up_susp_3        suspension_3_lowering_kit.png

garage_up_engine_1      engine_1_tune_up.png
garage_up_engine_2      engine_2_cold_air_intake.png
garage_up_engine_3      engine_3_ecu_tune.png

garage_up_fuel_1        fuel_1_jerry_can_rack.png
garage_up_fuel_2        fuel_2_auxiliary_fuel_cell.png
garage_up_fuel_3        fuel_3_reserve_gas_tank.png

garage_up_cooling_1     cooling_1_coolant_flush.png
garage_up_cooling_2     cooling_2_new_radiator.png
garage_up_cooling_3     cooling_3_high_flow_aux_fan.png

garage_up_visibility_1  visibility_1_wiper_blades.png
garage_up_visibility_2  visibility_2_headlights_foglights.png
garage_up_visibility_3  visibility_3_windshield_system.png
garage_cat_visibility   visibility_category_wipers_lights_glass.png
```

Prefer adding an `art` texture key to the upgrade catalog objects rather than building a brittle filename convention in the scene. For the combined visibility category, use:

- `wipers_1` → `garage_up_visibility_1`
- `foglights_1` and `headlights_1` → `garage_up_visibility_2`
- `windshield_1` → `garage_up_visibility_3`

Use `garage_cat_visibility` as the bottom-toolbar/category-header image for `WIPERS / HEADLIGHTS`. It intentionally shows the combined windshield, headlight, and wipers. The Tier 3 purchase thumbnail is windshield-only.

## Required layout

Keep the storefront full bleed at 800×450. Preserve the store logo and NPC visibility. The UI must not cover the FAP technician's face or torso.

Use this approximate design grid, adjusting a few pixels only when necessary:

- Top HUD: `y 0–30`, translucent graphite bar.
- Back button: upper left.
- Exit, cash, and HP: one compact group at upper right.
- Utility row: left side around `x 14, y 38, w 280, h 25`.
- Main upgrade console: left side around `x 14, y 69, w 280, bottom y 356`.
- Bottom toolbar: `y 365–446`, one row, consistent card size.
- Keep the right side from roughly `x 320` onward visually open for the storefront and NPC.

At FAP, put `REPAIR CAR` and `PAINT JOB` in the small utility row instead of mixing them into the upgrade cards. Preserve NOS, bumper, untabbed body/police upgrades, and any other existing purchasable FAP services; expose them from a compact `SPECIALS`/overflow control or small secondary drawer without adding an eighth bottom category. Nothing currently purchasable may disappear.

At Les Schwasted, preserve free popcorn and water as compact shop-perk controls, and show only the three categories it stocks. Do not stretch those three tabs to fill the full toolbar; keep the same tab dimensions used at FAP and center the group.

## Category toolbar

Stop relying on `ui_garage_toolbar` as a sliced strip for visual state. Its first tire tile has magenta baked into it, so alpha changes cannot make another selected category look correct.

Build the toolbar tabs programmatically from `GARAGE_CATEGORIES` and the existing individual category textures:

- `garage_ico_tires`
- `garage_ico_brakes`
- `garage_ico_suspension`
- `garage_ico_engine`
- `garage_ico_fuel`
- `garage_ico_coolant`
- `garage_ico_wipers`

Each tab consists of a charcoal card, its product image, and a code-rendered label. Use identical dimensions, corner treatment, border weight, image scale, and label style for all tabs.

Color semantics must be consistent:

- Background/panels: near-black and graphite (`#070A10`, `#10151D`).
- Neutral/inactive border: restrained cyan (`#67D8F2`) at modest brightness.
- Selected category and active progression: FAP magenta (`#FF4FC8`).
- Main text: cool white/silver (`#F1F5FA`).
- Secondary text: blue-gray (`#9BAFC2`).
- Price: amber (`#FFD24D`) only.
- Owned/success/HP: green (`#66FF99`) only.
- Locked/disabled: desaturated gray.

Do not assign a different frame/glow color to every category. The artwork inside a tab may retain realistic component colors, but navigation state must use the semantic palette above. Selected state must not be alpha-only: use a magenta stroke/glow/underline that works for every selected tab.

## Three-tier category panel

For Tires, Brakes, Suspension, Engine, Fuel, and Cooling:

- The category header shows its label, existing category icon, and current progress such as `LEVEL 1 / 3`.
- Render exactly three compact tier cards simultaneously. They must fit without scrolling.
- Each card shows the new tier thumbnail, `TIER 1/2/3`, the exact catalog label, exact description/tradeoff, exact price, and state/action.
- Add a restrained vertical progression rail connecting Tier 1 through Tier 3.
- Installed/current tier: magenta outline plus a green `OWNED` check/state.
- Previously passed tiers: clearly owned/completed, but less visually dominant than the current tier.
- Immediate next tier: full-bright `BUY` control and amber price; disable purchase if unaffordable while retaining readable price.
- Later tiers: visible but locked/dim until the prior tier is installed.
- At Level 0, Tier 1 is the only purchasable card. At Level 1, Tier 2 is the only purchasable card. At Level 2, Tier 3 is the only purchasable card. At Level 3, all show owned/completed and none are purchasable.
- Preserve the existing behavior that a higher tier replaces the lower tier in that slot and uses the existing `buyUpgrade` flow.
- Temporary upgrades, such as Coolant Flush, must still display their temporary/degrades warning and preserve existing persistence behavior.

Selecting a bottom category changes the entire three-card panel. The bottom tab is navigation; the tier card's `BUY` button performs the purchase.

## Wipers / Headlights exception

Do not fake a three-tier ladder for this category. The current catalog intentionally contains four independent one-time slots:

- New Wiper Blades
- Fog Lights
- New Headlights
- New Windshield

When `WIPERS / HEADLIGHTS` is selected, render four slightly shorter à-la-carte cards in the same console. They must all fit without scrolling and can be purchased independently in any order. Use progress such as `VISIBILITY 2 / 4`, not `LEVEL 2 / 3`. Reuse the three visibility artwork stages through the explicit mapping above. Do not modify these four catalog entries into tiers unless the owner separately requests a gameplay redesign.

## Existing services and content

The redesigned specialized garage panel should read directly from `UPGRADE_CATALOG`, `GARAGE_CATEGORIES`, `SHOP_CATEGORIES`, `getInstalled()`, and existing price/discount helpers. Do not populate the visible panel from only the current `_next` row, because that is the exact limitation being fixed.

The generic `_buildTabContent()` / `_makeButton()` path may remain for other businesses. Isolate the new garage renderer so Huff's, CowBella, AOK, dealerships, Gas-N-Sip, AM/BM, and Park & Ride do not regress.

Maintain all of the following:

- FAP stocks all seven toolbar categories.
- Les Schwasted stocks Tires, Brakes, and Suspension only.
- Genre upgrade discounts affect both displayed and charged price identically.
- The single rest-stop wallet remains authoritative.
- Installed upgrades remain vehicle-specific and save-persisted.
- Custom/sandbox temporary-vs-permanent behavior remains unchanged.
- Purchase receipt/status feedback remains visible.
- Pointer events stop propagation correctly so buying does not close or scroll the menu.
- All interactive objects are destroyed/rebuilt cleanly when leaving a shop or switching section.

## Visual and interaction polish

- Use consistent Phaser graphics/text rather than baking new words into bitmaps.
- Keep type readable at the native 800×450 design resolution.
- Clip/wrap descriptions and tradeoffs intentionally; no ellipses that hide the actual downside.
- Provide hover/press feedback without changing layout dimensions.
- Maintain a minimum practical hit area for touch controls.
- Avoid overlapping the bottom toolbar, storefront NPC, top HUD, or exit sign.
- Do not create scrollbars for the three-tier category view.
- The interface must stay usable on the game's existing scale/letterbox behavior.

## Verification

After implementation:

1. Run `npm test`.
2. Run `npm run build`.
3. Open both FAP and Les Schwasted at native 800×450 and at a wider desktop viewport.
4. Verify every stocked category changes the full panel.
5. Verify all three tiers remain visible for the six tiered categories.
6. Verify the four visibility purchases display and buy independently.
7. Verify owned, next, locked, unaffordable, maxed, and temporary states.
8. Verify a purchase charges the correct discounted price once, updates cash immediately, persists to the same vehicle, refreshes the visible card states, and does not remove unrelated permanent upgrades.
9. Verify Repair, Paint, NOS, bumper, untabbed services, free popcorn, and free water remain reachable where they existed before.
10. Check `git diff` and report exactly which files changed, tests/build results, and any intentionally retained exceptions.

Do not stop at a description or mockup. Implement the working Phaser interface, test it, and leave the project buildable.
