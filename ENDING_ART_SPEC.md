# Ending Artwork Composition Spec

## Background plates

All final plates are 800×450 and contain no baked-in player car, title, buttons, or UI.

| Ending | Asset |
|---|---|
| Pullman finish | `assets/ui/endings/end_pullman_comic_plate.png` |
| Out of gas | `assets/ui/endings/end_out_of_gas_plate.png` |
| Demo complete | `assets/ui/endings/end_demo_complete_plate.png` |
| Busted | `assets/ui/endings/end_busted_dynamic_plate.png` |
| Crashed | `assets/ui/endings/end_crashed_dynamic_plate.png` |
| Passed out | `assets/ui/endings/end_passed_out_dynamic_plate.png` |

Full-resolution generated source art is retained under
`public/assets/ui/endings/source/`.

## Dynamic car layer

Use the player's current rear-view vehicle texture. These existing assets are
already accurate transparent cutouts, so they should be composited rather than
regenerated into the background art.

| Vehicle id | Texture key |
|---|---|
| Beater | `car_back_codex_beater` |
| SUV 4×4 | `car_back_codex_suv4x4` |
| Used truck | `car_back_codex_used_truck` |
| New truck | `car_back_codex_new_truck` |
| EV truck | `car_back_codex_ev_truck` |
| Sports car | `car_back_codex_sports_car` |
| Bestla roadster | `car_back_codex_bestla_roadster` |
| Play'd Out S3X | `car_back_codex_playdout_s3x` |

## Suggested placement at 800×450

Positions use Phaser center-origin coordinates. Preserve each vehicle's aspect
ratio and align its tires to the listed ground line.

| Ending | Car center X | Ground Y | Maximum width | Lighting treatment |
|---|---:|---:|---:|---|
| Pullman finish | 125 | 370 | 210 | Warm/magenta venue reflection |
| Out of gas | 190 | 354 | 300 | Cool blue with faint magenta road bounce |
| Demo complete | 175 | 355 | 285 | Cool shadow with warm sunrise rim |
| Busted | 270 | 354 | 330 | Wet blue/red police-light reflection |
| Crashed | 255 | 356 | 330 | Cool rain with magenta road reflection |
| Passed out | 260 | 356 | 330 | Cool rain with blue/magenta city reflection |

The Pullman car belongs only in the arrival panel. It must not overlap the
performance or payment panels.

## Compositing order

1. Ending background plate
2. Soft elliptical tire/contact shadow
3. Selected player-car texture
4. Optional dirt/damage overlay derived from the run state
5. Ending title, run report, buttons, and other Phaser UI

Do not bake license plates, car color, damage, ending text, or buttons into the
background plates. If the ending screen is resized, scale the plate and all car
placement values from the same 800×450 design coordinate system.

## Genre ending vehicles

The ten normalized ending-screen vehicle overlays are 560×400 transparent PNGs,
centered horizontally and tire-aligned to the bottom edge. Render with
`setOrigin(0.5, 1)` so every genre shares the same ground coordinate.

| Genre | Vehicle | Ending overlay |
|---|---|---|
| Hip-Hop / Phonk | VIP Sedan | `assets/ui/endings/cars/endcar_hiphop_phonk.png` |
| Country | Mud Truck | `assets/ui/endings/cars/endcar_country.png` |
| Reggaeton | Lowrider | `assets/ui/endings/cars/endcar_reggaeton.png` |
| K-Pop | Idol EV | `assets/ui/endings/cars/endcar_k_pop.png` |
| Metal | War Van | `assets/ui/endings/cars/endcar_metal.png` |
| Classic Rock | Muscle Car | `assets/ui/endings/cars/endcar_classic_rock.png` |
| EDM / Rave | Laser Supercar | `assets/ui/endings/cars/endcar_edm_rave.png` |
| Reggae | Easy-Rider Van | `assets/ui/endings/cars/endcar_reggae.png` |
| Pop-Punk / Emo | Tour Hatchback | `assets/ui/endings/cars/endcar_pop_punk_emo.png` |
| Norteño | Custom Pickup | `assets/ui/endings/cars/endcar_norteno.png` |

Use the active run/plate genre to select this overlay. The ending plate supplies
environmental lighting; apply color grading or damage as a separate runtime
layer so these neutral transparent masters remain reusable across all endings.

### Rear-three-quarter variants

The complete alternate-angle set uses the approved composition: rear nearest
the viewer, nose toward the upper-left. Each transparent PNG is normalized to
the same 560×400 canvas as the straight-rear overlays.

| Genre | Rear-three-quarter overlay |
|---|---|
| Hip-Hop / Phonk | `assets/ui/endings/cars/endcar_hiphop_phonk_rear3q.png` |
| Country | `assets/ui/endings/cars/endcar_country_rear3q.png` |
| Reggaeton | `assets/ui/endings/cars/endcar_reggaeton_rear3q.png` |
| K-Pop | `assets/ui/endings/cars/endcar_k_pop_rear3q.png` |
| Metal | `assets/ui/endings/cars/endcar_metal_rear3q.png` |
| Classic Rock | `assets/ui/endings/cars/endcar_classic_rock_rear3q.png` |
| EDM / Rave | `assets/ui/endings/cars/endcar_edm_rave_rear3q.png` |
| Reggae | `assets/ui/endings/cars/endcar_reggae_rear3q.png` |
| Pop-Punk / Emo | `assets/ui/endings/cars/endcar_pop_punk_emo_rear3q.png` |
| Norteño | `assets/ui/endings/cars/endcar_norteno_rear3q.png` |

Use these clean variants for Passed Out, Out of Gas, and Demo Complete. Add a
soft projected contact shadow beneath the tires at runtime; do not bake one
into the reusable vehicle master.

### Crashed variants

The Crashed ending selects the matching damaged overlay by inserting
`_crashed` before `.png` in the rear-three-quarter filename. For example:

`assets/ui/endings/cars/endcar_hiphop_phonk_rear3q_crashed.png`

All ten genres have a 560×400 transparent crashed variant. These include
vehicle-specific collision deformation, broken glass, wheel damage, scraping,
and restrained smoke while preserving the selected car's identity. Never use
the pristine rear-three-quarter overlay on the Crashed ending.
