# Road Trip Roulette — Story Art Integration Contract

**Canonical companion to Chapter 18 of `Road Trip Roulette Overview.md`.** Claude should use this
file when completing Chapter 18, Phase 8. It is the authoritative bridge between story dialogue
and the supplied artwork. Do not infer a different scene from a filename and do not attach every
PNG merely because it exists.

Production status is maintained in `STORY_ART_CHECKLIST.md`. Consult that checklist before
generating any panel; a checked but `UNWIRED / REJECTED` panel exists but is not approved game art.

## 1. Required code contract

1. Keep dialogue in `src/data/featuredStories.js`; artwork must contain no baked dialogue.
2. Extend comic-art lookup so a response can override its node's establishing image:
   - node/establishing: `${storyId}.${nodeId}`
   - selected response: `${storyId}.${nodeId}.${choiceId}`
   - code-created beat: `${storyId}.beat.${beatId}`
   - ending/outcome variant: `${storyId}.${nodeId}.${outcome}`
3. A selected choice renders the Player's `label` in the Player balloon and the choice's `reply`
   in the NPC/reaction balloon. A node image renders the node's `line`. Function-valued lines and
   replies must be evaluated first. Save the same stable dialogue key plus fallback text.
4. All rectangles below are normalized `{x,y,w,h}` in the full 16:9 image. They are initial safe
   zones, not permission to cover a face, hand, carried story item, vehicle, or important action.
5. If text does not fit, use the existing linked second-balloon behavior. Do not shrink below the
   reader's minimum font size. The art itself must never be modified to make dialogue fit.
6. Tail measurement is not final approval. Render the exact node line, every consequential Player
   label, and every resulting reply at both the 800×450 live-tile size and the saved-comic page
   size. Move or resize balloons that cover a face, body, hand, story item, steering wheel, open
   door, or other scene-defining action—even when the mouth-tail coordinate itself is correct.

## 2. Balloon/protection presets

| Preset | NPC/reaction balloon | Player balloon | Protected regions |
|---|---|---|---|
| `LR` | `{x:.54,y:.05,w:.42,h:.30}` | `{x:.04,y:.64,w:.45,h:.30}` | left character `{x:.02,y:.08,w:.40,h:.82}`; right character `{x:.58,y:.08,w:.40,h:.82}` |
| `RL` | `{x:.04,y:.05,w:.42,h:.30}` | `{x:.52,y:.64,w:.44,h:.30}` | same left/right character regions as `LR` |
| `TOP` | `{x:.04,y:.04,w:.58,h:.26}` | `{x:.40,y:.69,w:.56,h:.26}` | center action `{x:.20,y:.18,w:.65,h:.66}` |
| `CAR_LR` | `{x:.03,y:.05,w:.42,h:.27}` | `{x:.56,y:.68,w:.40,h:.26}` | car/driver `{x:.32,y:.30,w:.68,h:.66}`; standing NPC `{x:.02,y:.10,w:.30,h:.82}` |
| `CAR_RL` | `{x:.55,y:.05,w:.41,h:.27}` | `{x:.04,y:.68,w:.42,h:.26}` | car/driver `{x:.00,y:.28,w:.68,h:.68}`; standing NPC `{x:.55,y:.08,w:.40,h:.86}` |
| `ACTION` | `{x:.04,y:.04,w:.44,h:.25}` | `{x:.52,y:.70,w:.44,h:.25}` | main action `{x:.12,y:.17,w:.76,h:.70}` |
| `ENDING` | `{x:.04,y:.04,w:.52,h:.25}` | `{x:.44,y:.71,w:.52,h:.24}` | all faces/hands and central ending action; metadata may split into two linked balloons |

Tail anchors should point to the speaking character's mouth after the image is loaded. They must
be measured from the actual asset, not guessed from the portrait ID. Protected regions are
minimums; add tighter face/hand/item boxes during visual QA.

## 3. Brittney wardrobe continuity — locked

- Mercer Island introduction, fork, and every road/need/reaction scene before Vantage: Brittney
  wears her clean, colorful Gas-N-Sip uniform (cream/red/turquoise fitted polo, turquoise short
  shorts, red belt, turquoise/red visor, clean complexion).
- She does **not** change in the car and does **not** wear the white tank/denim road outfit during
  the drive.
- At Vantage, immediately before joining her friends, she may change into the road outfit inside
  the gas station. The change can be shown as a private offscreen transition followed by her
  emerging in the road outfit; no nudity is shown.
- Existing road-outfit Mercer/passenger PNGs are currently continuity rejects and must remain
  **unwired** unless the owner later approves a specific Vantage reuse. Do not delete or redraw
  them automatically.
- `hiphop/mercer_island/mercer_01_brittney_double_shift.png` and
  `hiphop/mercer_island/mercer_02_keep_job_phone_continues.png` are approved work-uniform art.

## 4. Hip-Hop artwork → dialogue mapping

Every path below is relative to `public/`.

| Stable art key | Exact artwork path | Dialogue/reaction rendered | Preset / extra protection |
|---|---|---|---|
| `hiphop.seattle_offer` | `assets/storylines/hiphop/seattle/seattle_01_freestyle_circle.png` | `seattle_offer.line` | `TOP`; protect Malik and full freestyle group |
| `hiphop.seattle_offer.intro` | `assets/storylines/hiphop/seattle/seattle_02_crew_confrontation.png` | transition into Malik's offer; no new permanent choice unless a stable beat is added | `LR` |
| `hiphop.seattle_offer.carry` | `assets/storylines/hiphop/seattle/seattle_03_phone_handoff.png` | Player `carry.label`; Malik `carry.reply` | `LR`; additionally protect phone and both hands |
| `hiphop.seattle_offer.carry.radio` | `assets/storylines/hiphop/seattle/seattle_04_radio_explanation.png` | temporary Hip-Hop radio explanation in `carry.reply` | `TOP`; protect phone screen |
| `hiphop.seattle_offer.pass` | `assets/storylines/hiphop/seattle/seattle_05_refuse_job.png` | Player `pass.label`; Malik `pass.reply` | `LR` |
| `hiphop.mercer_fork` | `assets/storylines/hiphop/mercer_island/mercer_01_brittney_double_shift.png` | `mercer_fork.line` | `LR`; protect Brittney, Player, phone, register |
| `hiphop.mercer_fork.keepJob` | `assets/storylines/hiphop/mercer_island/mercer_02_keep_job_phone_continues.png` | Player `keepJob.label`; Brittney `keepJob.reply` | `LR`; protect phone/handoff gesture |
| `hiphop.bellevue_founder` | `assets/storylines/hiphop/bellevue/bellevue_01_founder_bribe_offer.png` | `bellevue_founder.line` | `LR`; protect offered cash/phone |
| `hiphop.bellevue_founder.sell` | `assets/storylines/hiphop/bellevue/bellevue_02_accept_bribe_ending.png` | Player `sell.label`; founder `sell.reply`; COMPLETE! SORT OF… | `ENDING`; protect exchanged phone/cash |
| `hiphop.bellevue_founder.refuse` | `assets/storylines/hiphop/bellevue/bellevue_03_reject_bribe.png` | Player `refuse.label`; founder `refuse.reply` | `LR` |
| `hiphop.issaquah_kyle` | `assets/storylines/hiphop/issaquah/issaquah_01_kyle_hears_track.png` | `issaquah_kyle.line` | `LR`; protect Kyle and audio board |
| `hiphop.issaquah_kyle.session` | `assets/storylines/hiphop/issaquah/issaquah_02_remaster_session.png` | ten-minute remaster transition | `TOP`; protect Kyle at board and Player over his shoulder; Malik must never appear |
| `hiphop.issaquah_kyle.handOver` | `assets/storylines/hiphop/issaquah/issaquah_03_thumb_drive_handoff.png` | Player `handOver.label`; Kyle `handOver.reply` | `LR`; protect the single thumb drive and hands |
| `hiphop.northbend_dom.arrival` | `assets/storylines/hiphop/north_bend/north_bend_00_dominique_hears_arriving_track.png` | Dom'nique hears the arriving song, then `northbend_dom.line` | `CAR_LR`; protect Dom'nique, Player, and car; **car has no exterior speaker** |
| `hiphop.northbend_dom` | `assets/storylines/hiphop/north_bend/north_bend_01_stolen_beat_confrontation.png` | `northbend_dom.line` and NoiseCloud proof | `LR`; protect Dom'nique's pointing hand, phone/drive, Player |
| `hiphop.northbend_dom.promise` | `assets/storylines/hiphop/north_bend/north_bend_02_promise_credit.png` | Player `promise.label`; Dom'nique `promise.reply` | `LR`; protect Dom'nique's phone and Player's single drive |
| `hiphop.northbend_dom.delay` | `assets/storylines/hiphop/north_bend/north_bend_03_defer_until_presser.png` | Player `delay.label`; Dom'nique `delay.reply` | `LR`; exterior only; protect both story items |
| `hiphop.northbend_dom.bagman` | `assets/storylines/hiphop/north_bend/north_bend_04_chased_out.png` | Player `bagman.label`; Dom'nique `bagman.reply`; no shopping | `CAR_LR`; protect departing car and Dom'nique |
| `hiphop.pass_tennessee` | `assets/storylines/hiphop/snoqualmie_pass/snoqualmie_01_credit_decision.png` | `pass_tennessee.line` plus selected credit label/reply | `LR`; protect the **one** USB in Player's hand |
| `hiphop.pass_tennessee.pressing` | `assets/storylines/hiphop/snoqualmie_pass/snoqualmie_02_pressing_100_records.png` | pressing transition and 100-record cargo rule | `ACTION`; protect press, records, hands |
| `hiphop.pass_tennessee.loaded` | `assets/storylines/hiphop/snoqualmie_pass/snoqualmie_03_player_loads_records_tennessee_stays.png` | selected credit reply after pressing/loading | `CAR_RL`; Tennessee remains at workshop; Player alone transports cargo |
| `hiphop.cleelum_store.pristine` | `assets/storylines/hiphop/cle_elum/cle_elum_01_pristine_delivery_unlock.png` | evaluated `cleelum_store.line/reply` for `pristine` | `ENDING`; protect female clerk, crates, Player |
| `hiphop.cleelum_store.damaged` | `assets/storylines/hiphop/cle_elum/cle_elum_02_damaged_cargo_payout.png` | evaluated `cleelum_store.line/reply` for `damaged`, `almost_empty`, or `one_record` until dedicated variants exist | `ENDING`; protect clerk and surviving records |
| `hiphop.vantage_recovery.locked_phone` | `assets/storylines/hiphop/vantage_ambush/vantage_00_locked_phone_in_car.png` | phone-lock consequence after passing Issaquah | `CAR_RL`; protect Player, steering wheel, and locked phone |
| `hiphop.vantage_recovery.first_tail` | `assets/storylines/hiphop/vantage_ambush/vantage_02_first_hostile_in_mirror.png` | first ambush warning beat | `ACTION`; protect Player, rearview mirror, hostile-car reflection, and phone |
| `hiphop.vantage_recovery` | `assets/storylines/hiphop/vantage_ambush/vantage_01_three_car_ambush.png` | `vantage_recovery.line`, then selected recovery label/reply | `ACTION`; protect Player car and all three attackers |
| `hiphop.vantage_recovery.side_ram` | `assets/storylines/hiphop/vantage_ambush/vantage_03_side_ram.png` | ambush damage escalation | `ACTION`; protect white sedan, Player, and both impact points |
| `hiphop.vantage_recovery.boxed_in` | `assets/storylines/hiphop/vantage_ambush/vantage_04_boxed_in.png` | Player trapped by all three hostile cars | `ACTION`; protect the readable four-car formation |
| `hiphop.vantage_recovery.fatal` | `assets/storylines/hiphop/vantage_ambush/vantage_05_fatal_wreck.png` | fatal ambush consequence; no dialogue required | `ENDING`; protect bloodless Player and all four vehicles |
| `hiphop.vantage_recovery.special_delivery` | `assets/storylines/hiphop/vantage_ambush/vantage_06_special_delivery_ending.png` | MALIK'S REGARDS / Special Delivery ending and recovery-choice setup | `ENDING`; protect Player, locked phone, and three departing cars |

Do not substitute Malik for Kyle in Issaquah, do not put Malik inside Kyle's room, do not put
Tennessee in Cle Elum, and do not show anyone except Player driving the canonical white sedan.


### 4.1 Hip-Hop speaker-tail anchor audit

These anchors were measured against all **30** actual Hip-Hop PNG files in the asset folder. Every
file is 1672 pixels wide; their source heights are 940 or 941 pixels. The folder contains 30
panels, although an earlier count said 28. Coordinates are
normalized to the full image; parenthetical values are source-image pixels for visual QA.
`tail` points to the named NPC mouth and `playerTail` points to Player's mouth. Use `null`
when the relevant person is absent, too small for a credible tail, unconscious, or the panel is a
silent cinematic action/ending. Do not substitute preset estimates for these values.

| Artwork path (relative to `assets/storylines/hiphop/`) | `tail` speaker | `tail` | `playerTail` |
|---|---|---|---|
| `bellevue/bellevue_01_founder_bribe_offer.png` | Founder | `{x:0.520,y:0.260}` (869,245) | `{x:0.330,y:0.250}` (552,235) |
| `bellevue/bellevue_02_accept_bribe_ending.png` | Founder | `{x:0.758,y:0.270}` (1267,254) | `{x:0.301,y:0.282}` (503,265) |
| `bellevue/bellevue_03_reject_bribe.png` | Founder | `{x:0.258,y:0.389}` (431,366) | `{x:0.631,y:0.291}` (1055,274) |
| `cle_elum/cle_elum_01_pristine_delivery_unlock.png` | Record-store clerk | `{x:0.783,y:0.292}` (1309,275) | `{x:0.381,y:0.272}` (637,256) |
| `cle_elum/cle_elum_02_damaged_cargo_payout.png` | Record-store clerk | `{x:0.721,y:0.351}` (1206,330) | `{x:0.251,y:0.301}` (420,283) |
| `issaquah/issaquah_01_kyle_hears_track.png` | Kyle | `{x:0.701,y:0.441}` (1172,415) | `{x:0.371,y:0.301}` (620,283) |
| `issaquah/issaquah_02_remaster_session.png` | Kyle | `{x:0.501,y:0.471}` (838,443) | `{x:0.671,y:0.252}` (1122,237) |
| `issaquah/issaquah_03_thumb_drive_handoff.png` | Kyle | `{x:0.681,y:0.311}` (1139,293) | `{x:0.331,y:0.262}` (553,247) |
| `mercer_island/mercer_01_brittney_double_shift.png` | Brittney | `{x:0.731,y:0.321}` (1222,302) | `{x:0.261,y:0.262}` (436,247) |
| `mercer_island/mercer_02_keep_job_phone_continues.png` | Brittney | `{x:0.821,y:0.341}` (1373,321) | `{x:0.351,y:0.311}` (587,293) |
| `north_bend/north_bend_00_dominique_hears_arriving_track.png` | Dom’nique | `{x:0.181,y:0.281}` (303,264) | `{x:0.711,y:0.541}` (1189,509) |
| `north_bend/north_bend_01_stolen_beat_confrontation.png` | Dom’nique | `{x:0.761,y:0.321}` (1272,302) | `{x:0.311,y:0.301}` (520,283) |
| `north_bend/north_bend_02_promise_credit.png` | Dom’nique | `{x:0.721,y:0.341}` (1206,321) | `{x:0.301,y:0.311}` (503,293) |
| `north_bend/north_bend_03_defer_until_presser.png` | Dom’nique | `{x:0.771,y:0.262}` (1289,247) | `{x:0.351,y:0.321}` (587,302) |
| `north_bend/north_bend_04_chased_out.png` | Dom’nique | `{x:0.251,y:0.371}` (420,349) | `null` |
| `seattle/seattle_01_freestyle_circle.png` | Malik | `{x:0.481,y:0.262}` (804,247) | `{x:0.801,y:0.311}` (1339,293) |
| `seattle/seattle_02_crew_confrontation.png` | Malik | `{x:0.421,y:0.301}` (704,283) | `{x:0.211,y:0.292}` (353,275) |
| `seattle/seattle_03_phone_handoff.png` | Malik | `{x:0.761,y:0.311}` (1272,293) | `{x:0.361,y:0.281}` (604,264) |
| `seattle/seattle_04_radio_explanation.png` | Malik | `{x:0.461,y:0.331}` (771,311) | `{x:0.181,y:0.301}` (303,283) |
| `seattle/seattle_05_refuse_job.png` | Malik | `{x:0.731,y:0.331}` (1222,311) | `{x:0.391,y:0.311}` (654,293) |
| `snoqualmie_pass/snoqualmie_01_credit_decision.png` | Tennessee | `{x:0.691,y:0.401}` (1155,377) | `{x:0.391,y:0.291}` (654,274) |
| `snoqualmie_pass/snoqualmie_02_pressing_100_records.png` | Tennessee | `{x:0.541,y:0.321}` (905,302) | `null` |
| `snoqualmie_pass/snoqualmie_03_player_loads_records_tennessee_stays.png` | Tennessee | `{x:0.721,y:0.341}` (1206,321) | `{x:0.521,y:0.371}` (871,349) |
| `vantage_ambush/vantage_00_locked_phone_in_car.png` | none | `null` | `{x:0.291,y:0.281}` (487,264) |
| `vantage_ambush/vantage_01_three_car_ambush.png` | none | `null` | `{x:0.551,y:0.451}` (921,424) |
| `vantage_ambush/vantage_02_first_hostile_in_mirror.png` | none | `null` | `{x:0.571,y:0.311}` (955,293) |
| `vantage_ambush/vantage_03_side_ram.png` | none | `null` | `{x:0.521,y:0.451}` (871,424) |
| `vantage_ambush/vantage_04_boxed_in.png` | none | `null` | `null` |
| `vantage_ambush/vantage_05_fatal_wreck.png` | none | `null` | `null` |
| `vantage_ambush/vantage_06_special_delivery_ending.png` | none | `null` | `null` |

## 5. Country artwork → dialogue mapping and current gaps

The following existing panels are valid after the newly approved Mercer departure establishes
Brittney's road outfit. Choice/consequence panels are mapped into `PANEL_META`:

```text
assets/storylines/country/passenger_needs/hunger_01_buy_sushi.png
assets/storylines/country/passenger_needs/hunger_02_offer_pork_burrito.png
assets/storylines/country/passenger_needs/hunger_03_wait_for_better_food.png
assets/storylines/country/passenger_needs/bathroom_01_hold_it.png
assets/storylines/country/passenger_needs/bathroom_02_wait_in_car.png
assets/storylines/country/passenger_needs/bathroom_03_go_with_her.png
assets/storylines/country/passenger_needs/thirst_01_buy_slushie.png
assets/storylines/country/passenger_needs/thirst_02_find_fountain.png
assets/storylines/country/driving_reactions/smooth_ride_flirtation.png
assets/storylines/country/driving_reactions/major_collision_nerve_loss.png
assets/storylines/country/nerve/nerve_zero_roadside_exit.png
assets/storylines/country/nerve/refuse_exit_five_star_chase.png
```

If replacement work-uniform panels are later approved, use these exact keys and dialogue:

| Stable art key | Dialogue/reaction | Preset / protection |
|---|---|---|
| `country.need_hunger.sushi` | Player `sushi.label`; Brittney `sushi.reply` | `LR`; sushi and purchase handoff |
| `country.need_hunger.burrito` | Player `burrito.label`; Brittney `burrito.reply` | `LR`; burrito and reaction |
| `country.need_hunger.wait` | Player `wait.label`; Brittney `wait.reply` | `LR` |
| `country.need_bathroom.hold` | Player `hold.label`; Brittney `hold.reply` | `LR` |
| `country.need_bathroom.waitInCar` | Player `waitInCar.label`; Brittney `waitInCar.reply` | `CAR_RL`; only Player in driver seat |
| `country.need_bathroom.goWith` | Player `goWith.label`; Brittney `goWith.reply` | `LR` |
| `country.need_thirst.slushie` | Player `slushie.label`; Brittney `slushie.reply` | `LR`; slushie and hands |
| `country.need_thirst.fountain` | Player `fountain.label`; Brittney `fountain.reply` | `LR`; blank-stare expression |
| `country.beat.smoothRide` | rotating `FLIRT_LINES`; no choice unless tied to a committed relationship gain | `CAR_RL`; only Player driving |
| `country.beat.majorCollision` | applicable 5+ HP reaction | `CAR_RL`; only Player driving |
| `country.beat.roadside_exit` | 0-Nerve exit text | `CAR_LR` |
| `country.beat.kidnap` | police-warning/kidnapping consequence | `ACTION`; Player driving, Brittney passenger |

The Mercer Country choice uses the approved work-uniform counter response. Brittney continues
serving the player through the shop menu on either branch. On HIT THE ROAD,
`country.mercer_departure` shows her changed and entering the car. The Vantage ending still needs
dedicated final-response beats:

1. Brittney arrives in her road outfit and spots her friends.
2. `country.vantage_arrival.sendOff`: evaluated ending response (`ride_em`, `standard`, or
   `barely`) with the correct final outfit.

The unused alternate changing image remains unwired:

```text
assets/storylines/country/mercer_island/mercer_03_changed_to_road_clothes.png
```

Do not move, delete, or regenerate it without an explicit owner instruction.

### 5.1 Country speaker-tail anchor audit

These anchors were measured against the actual 1672×941 PNG files listed below. `x/y` are
normalized coordinates in the full image; the parenthetical pixel coordinate is supplied as a QA
cross-check. `tail` always points to Brittney's mouth and `playerTail` always points to Player's
mouth. A missing speaker is `null`. These measurements do **not** approve an otherwise rejected
panel: rows marked `UNWIRED` remain unavailable to `PANEL_META`.

| Artwork path (relative to `assets/storylines/country/`) | Status | `tail` — Brittney | `playerTail` — Player |
|---|---|---|---|
| `mercer_island/mercer_04_quits_leaves_phone.png` | approved new Mercer consequence | `{x:.303,y:.252}` (507,237) | `{x:.753,y:.276}` (1259,260) |
| `vantage/vantage_01_spots_friends_work_uniform.png` | approved establishing beat only | `{x:.530,y:.292}` (886,275) | `{x:.271,y:.332}` (453,312) |
| `mercer_island/mercer_03_changed_to_road_clothes.png` | `UNWIRED` — wrong location/early outfit | `{x:.402,y:.302}` (672,284) | `{x:.758,y:.361}` (1267,340) |
| `mercer_island/mercer_03_quit_and_join_player.png` | `country.mercer_departure` / `.board` — approved work-uniform replacement; anatomically natural rear view, Brittney enters the front passenger seat and Player remains behind the wheel | `{x:.749,y:.242}` (1252,228) | `{x:.454,y:.324}` (759,305) |
| `driving_reactions/major_collision_nerve_loss.png` | `UNWIRED` — early outfit | `{x:.553,y:.348}` (925,327) | `{x:.251,y:.351}` (420,330) |
| `driving_reactions/smooth_ride_flirtation.png` | `UNWIRED` — early outfit | `{x:.371,y:.302}` (620,284) | `{x:.673,y:.342}` (1125,322) |
| `nerve/nerve_zero_roadside_exit.png` | `UNWIRED` — early outfit | `{x:.692,y:.323}` (1157,304) | `{x:.194,y:.390}` (324,367) |
| `nerve/refuse_exit_five_star_chase.png` | `UNWIRED` — early outfit | `{x:.488,y:.496}` (816,467) | `{x:.557,y:.489}` (931,460) |
| `passenger_needs/bathroom_01_hold_it.png` | `UNWIRED` — early outfit | `{x:.441,y:.351}` (737,330) | `{x:.721,y:.322}` (1206,303) |
| `passenger_needs/bathroom_02_wait_in_car.png` | `UNWIRED` — early outfit | `{x:.690,y:.402}` (1154,378) | `{x:.361,y:.312}` (604,294) |
| `passenger_needs/bathroom_03_go_with_her.png` | `UNWIRED` — early outfit | `{x:.612,y:.321}` (1023,302) | `{x:.401,y:.312}` (670,294) |
| `passenger_needs/hunger_01_buy_sushi.png` | `UNWIRED` — early outfit | `{x:.661,y:.272}` (1105,256) | `{x:.351,y:.312}` (587,294) |
| `passenger_needs/hunger_02_offer_pork_burrito.png` | `UNWIRED` — early outfit | `{x:.752,y:.331}` (1257,312) | `{x:.391,y:.282}` (654,265) |
| `passenger_needs/hunger_03_wait_for_better_food.png` | `UNWIRED` — early outfit | `{x:.281,y:.312}` (470,294) | `{x:.681,y:.322}` (1139,303) |
| `passenger_needs/thirst_01_buy_slushie.png` | `UNWIRED` — early outfit | `{x:.721,y:.361}` (1206,340) | `{x:.391,y:.312}` (654,294) |
| `passenger_needs/thirst_02_find_fountain.png` | `UNWIRED` — early outfit | `{x:.621,y:.342}` (1038,322) | `{x:.321,y:.322}` (537,303) |

Owner lock (2026-09-07): do not generate, redraw, or edit Brittney again unless the owner
explicitly asks for Brittney artwork. Continue other story artwork without using her as a newly
generated subject.

## 6. Classic Rock artwork mapping

The following Vantage, Othello, Hatton, and Pullman panels are complete:

| Stable art key | Exact artwork path | Dialogue/reaction | Preset / protection |
|---|---|---|---|
| `classicRock.vantage_diner.shift_end` | `assets/storylines/classic_rock/vantage/vantage_01_waitress_finishing_shift.png` | pre-arrival establishing beat; waitress finishes shift and expected Nan | `ACTION`; protect waitress, tips, travel bag, stage |
| `classicRock.vantage_diner` | `assets/storylines/classic_rock/vantage/vantage_02_waiting_for_nan.png` | `vantage_diner.line` | `CAR_RL`; protect waitress, phone, travel bag, Player/car |
| `classicRock.vantage_diner.east` | `assets/storylines/classic_rock/vantage/vantage_03_player_offers_ride.png` | Player `east.label`; waitress `east.reply` | `CAR_LR`; protect open passenger doorway, faces, travel bag |
| `classicRock.vantage_diner.swipe_reaction` | `assets/storylines/classic_rock/vantage/vantage_04_swipe_right_reaction.png` | approved “Did we just swipe right?” reaction beat | `CAR_LR`; protect faces and open passenger door |
| `classicRock.vantage_offer` | `assets/storylines/classic_rock/vantage/vantage_05_opening_offer.png` | `vantage_offer.line` | `LR`; protect waitress's correctly oriented pointing hand, Player, guitar, stage |
| `classicRock.othello_cover.arrival` | `assets/storylines/classic_rock/othello/othello_01_arrival.png` | Othello arrival transition | `CAR_RL`; protect trunk, guitar case, both faces |
| `classicRock.othello_cover.pay` | `assets/storylines/classic_rock/othello/othello_02_player_pays_cover.png` | Player `pay.label`; waitress `pay.reply` | `LR`; protect cash exchange, guitar case, faces |
| `classicRock.othello_show.performance` | `assets/storylines/classic_rock/othello/othello_03_unpaid_opening_performance.png` | unpaid performance transition | `ACTION`; protect Player, hands, guitar, microphone, waitress |
| `classicRock.othello_show.interest` | `assets/storylines/classic_rock/othello/othello_04_waitress_growing_interest.png` | waitress's growing-interest reaction | `ACTION`; protect waitress foreground and Player performing |
| `classicRock.othello_show` | `assets/storylines/classic_rock/othello/othello_05_rush_and_propositions.png` | `othello_show.line` | `LR`; protect both faces, guitar, hands |
| `classicRock.othello_show.hearBoth` | `assets/storylines/classic_rock/othello/othello_06_asks_all_propositions.png` | Player `hearBoth.label`; waitress `hearBoth.reply` | `LR`; protect open hands and raised finger |
| `classicRock.othello_show.payingOnly` | `assets/storylines/classic_rock/othello/othello_07_asks_paying_proposition.png` | Player `payingOnly.label`; waitress `payingOnly.reply` | `LR`; protect money gesture and folded-arm reaction |
| `classicRock.othello_show.reject` | `assets/storylines/classic_rock/othello/othello_08_rejects_propositions_waitress_leaves.png` | Player `reject.label`; waitress `reject.reply`; LEFT AT OTHELLO | `ENDING`; protect departing waitress, bag, Player, guitar case |
| `classicRock.othello_show.impromptour` | `assets/storylines/classic_rock/othello/othello_09_impromptour_proposal.png` | ImprompTour portion of `hearBoth.reply` | `TOP`; protect map, both faces and pointing hand |
| `classicRock.othello_show.continue` | `assets/storylines/classic_rock/othello/othello_10_continue_tour.png` | positive continue-together consequence | `ACTION`; protect both faces, shared loading action, guitar case |
| `classicRock.othello_show.duetOffer` | `assets/storylines/classic_rock/othello/othello_11_duet_proposal.png` | Washtucna-duet portion of `hearBoth.reply` | `TOP`; protect map, both faces, both pointing hands, two microphones |
| `classicRock.othello_show.duetYes` | `assets/storylines/classic_rock/othello/othello_12_accepts_duet.png` | positive duet-intent beat if retained by final dialogue tree | `LR`; protect handshake, faces, map |
| `classicRock.othello_show.soloIntent` | `assets/storylines/classic_rock/othello/othello_13_prefers_solo.png` | solo-intent beat if retained by final dialogue tree | `LR`; protect Player's hand-to-chest gesture and waitress reaction |
| `classicRock.hatton_nan` | `assets/storylines/classic_rock/hatton/hatton_01_nan_arrives_oldsmobile.png` | opening portion of `hatton_nan.line` | `CAR_LR`; protect Nan/keys, Oldsmobile, waitress, Player and white sedan |
| `classicRock.hatton_nan.offer` | `assets/storylines/classic_rock/hatton/hatton_02_nan_mild_fortune_offer.png` | cash-offer portion of `hatton_nan.line` | `LR`; protect cash, Nan, waitress, Player and both cars |
| `classicRock.hatton_nan.objection` | `assets/storylines/classic_rock/hatton/hatton_03_waitress_objects.png` | waitress's objection before the choice buttons | `LR`; protect both gestures, cash and faces |
| `classicRock.hatton_nan.take` | `assets/storylines/classic_rock/hatton/hatton_04_take_500_waitress_leaves.png` | Player `take.label`; `take.reply`; NAN'S FIVE HUNDRED ending | `ENDING`; protect cash, departing waitress/Nan and both cars |
| `classicRock.hatton_nan.herCall.stay` | `assets/storylines/classic_rock/hatton/hatton_05_her_choice_high_stays.png` | evaluated `herCall.reply` at or above stay threshold | `LR`; protect faces, bag, cash and cars |
| `classicRock.hatton_nan.herCall.leave` | `assets/storylines/classic_rock/hatton/hatton_06_her_choice_low_leaves.png` | evaluated `herCall.reply` below stay threshold; SHE WENT WITH NAN ending | `ENDING`; protect Nan/waitress hug, bag and isolated Player |
| `classicRock.hatton_nan.refuse` | `assets/storylines/classic_rock/hatton/hatton_07_reject_nan_sploosh.png` | Player `refuse.label`; `refuse.reply` plus approved excited reaction | `LR`; protect rejected cash, Player's open palm, waitress and cars |
| `classicRock.hatton_nan.demand` | `assets/storylines/classic_rock/hatton/hatton_08_demand_1000.png` | Player `demand.label`; Nan `demand.reply` | `LR`; protect raised finger, purse, cash and waitress's stare |
| `classicRock.washtucna_show.arrival` | `assets/storylines/classic_rock/washtucna/washtucna_01_venue_arrival.png` | Washtucna venue establishing transition before `washtucna_show.line` | `CAR_RL`; protect Player, waitress, guitar case, sedan and venue crowd |
| `classicRock.washtucna_show.solo` | `assets/storylines/classic_rock/washtucna/washtucna_02_solo_performance.png` | Player selects the $300 solo performance | `ACTION`; Player mouth `{x:.414,y:.276}`; waitress mouth `{x:.932,y:.299}`; protect guitar, microphones, both faces |
| `classicRock.washtucna_show.solo_reaction` | `assets/storylines/classic_rock/washtucna/washtucna_03_waitress_unhappy_backstage.png` | waitress watches unhappily after being excluded | `RL`; waitress mouth `{x:.634,y:.223}`; Player mouth `{x:.299,y:.306}`; protect waitress, curtain, unused microphone and distant Player |
| `classicRock.washtucna_show.duet` | `assets/storylines/classic_rock/washtucna/washtucna_04_equal_duet_performance.png` | equal $150/$150 duet and first clear chemistry beat | `TOP`; waitress mouth `{x:.665,y:.241}`; Player mouth `{x:.318,y:.253}`; protect both faces, microphones, guitar and crowd |
| `classicRock.washtucna_show.giveAll` | `assets/storylines/classic_rock/washtucna/washtucna_05_player_gives_full_300.png` | Player gives waitress the full $300 | `LR`; waitress mouth `{x:.657,y:.261}`; Player mouth `{x:.310,y:.238}`; protect cash envelope, hands, faces and guitar |
| `classicRock.washtucna_show.equalPay` | `assets/storylines/classic_rock/washtucna/washtucna_06_equal_150_payout.png` | venue pays both performers $150 | `TOP`; waitress mouth `{x:.787,y:.288}`; Player mouth `{x:.278,y:.269}`; protect both envelopes, all hands and faces |
| `classicRock.washtucna_show.trioReaction` | `assets/storylines/classic_rock/washtucna/washtucna_07_trio_flirt_response.png` | suggestive trio response following Player's generosity | `LR`; waitress mouth `{x:.461,y:.201}`; Player mouth `{x:.621,y:.252}`; protect faces, microphone, guitar and hands |
| `classicRock.washtucna_show.following` | `assets/storylines/classic_rock/washtucna/washtucna_08_audience_follows_duo.png` | audience begins following the duo | `ACTION`; waitress mouth `{x:.470,y:.329}`; Player mouth `{x:.375,y:.319}`; protect both faces, guitar case, fans and white sedan |
| `classicRock.lacrosse_show.arrival` | `assets/storylines/classic_rock/la_crosse/la_crosse_01_larger_crowd_arrival.png` | larger La Crosse crowd establishes growing following | `ACTION`; no speaking tail required; protect performers, guitar case, crowd, venue and sedan |
| `classicRock.lacrosse_show.solo` | `assets/storylines/classic_rock/la_crosse/la_crosse_02_solo_400_exclusion.png` | $400 solo choice and waitress's exclusion reaction | `TOP`; waitress mouth `{x:.783,y:.329}`; Player mouth `{x:.241,y:.245}`; protect both faces, guitar, microphone and crowd |
| `classicRock.pullman_finale.partnership_kiss` | `assets/storylines/classic_rock/pullman/pullman_mutual_kiss_wide.png` | evaluated Pullman partnership ending at >80 relationship | `ENDING`; protect both faces, kiss, microphones, crowd |

The remaining Washtucna consequence branches, La Crosse, Colfax, alternate Pullman endings, and all
approved `MEANWHILE...` strips still require final narrative panels. Shared location and character
reference sheets are references only and must never be shown as finished comic panels. Keys ending
in `.duetYes` and `.soloIntent` require explicit nodes/beats if the final tree retains those choices;
do not attach either to a different decision merely to make the image appear.

## 7. Wiring/QA checklist for Claude

- Fill `PANEL_META` only for approved rows above; do not bulk-import the directory.
- Add response-level and beat-level key resolution before wiring choice-specific art.
- Preload each referenced asset and gracefully fall back to the current placeholder if absent.
- Verify every key by opening the live conversation and selecting every branch once.
- Confirm NPC and Player balloons use current `line`, `label`, and `reply` values—not copied text
  inside this guide—so later dialogue edits propagate to old comics through stable keys/fallbacks.
- Test 16:9 live tiles, every page template, PDF export, reload, checkpoint rewind, and plate reset.
- Visually inspect that no balloon covers a face, hand, phone, USB, vinyl crate, steering wheel,
  relationship-changing action, or the Player's car.
- Keep Player as the sole driver in every car scene.
