// ── Comic panel metadata + page layout templates (Ch. 18.3 / 18.9) ─────────
//
// PANEL METADATA is keyed by `panelKey` = `${storyId}.${nodeId}` (a choice may
// override with its own key later).  It tells the renderer where the art
// lives and where dialogue may go on it; art never carries baked dialogue.
//
//   {
//     art:      'assets/storylines/panels/hiphop/seattle_offer.png',  // null → placeholder
//     bubble:   { x, y, w, h },     // preferred NPC balloon rect, 0–1 of the panel
//     playerBubble: { x, y, w, h }, // preferred player balloon rect
//     tail:     { x, y },           // speaker mouth anchor, 0–1
//     playerTail: { x, y },
//     protect:  [ { x, y, w, h } ], // faces / hands — balloons must not cover
//     vehicle:  null | { x, y, w, h, view }, // reserved: genre-vehicle overlay slot (18.9)
//   }
//
// Phase 2 ships NO art keys: every panel resolves to DEFAULT_PANEL_META and
// the renderer paints a placeholder (speaker silhouette + scene label).  Phase
// 8 fills PANEL_META from the supplied panel art + metadata sheets.
//
// PAGE TEMPLATES are deterministic layouts (18.3): slots are 0–1 rects on a
// portrait page.  `kind` tells ComicSystem which events a template may hold.

export const PANEL_ASPECT = 16 / 9;   // every live tile + placeholder is landscape

export const DEFAULT_PANEL_META = Object.freeze({
  art: null,
  // NPC balloon top-left (a long reply links a second balloon beneath it,
  // staying above ~50% height); player balloon lower-right so the two never
  // collide.  Speaker anchor = the placeholder portrait's mouth.
  bubble:       { x: 0.04, y: 0.05, w: 0.56, h: 0.30 },
  playerBubble: { x: 0.40, y: 0.64, w: 0.56, h: 0.30 },
  tail:         { x: 0.70, y: 0.42 },
  playerTail:   { x: 0.30, y: 0.86 },
  protect:      [],
  vehicle:      null,
});

/** Per-panel overrides — filled in Phase 8.  Key: `${storyId}.${nodeId}`. */
export const PANEL_META = {
  // ── Hip-Hop (28 approved panels) ──
  'hiphop.seattle_offer': {
    art: 'assets/storylines/hiphop/seattle/seattle_01_freestyle_circle.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.58, h: 0.26 },
    playerBubble: { x: 0.40, y: 0.69, w: 0.56, h: 0.26 },
    tail:         { x: 0.30, y: 0.30 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.18, w: 0.65, h: 0.66 }],
  },
  'hiphop.seattle_offer.intro': {
    art: 'assets/storylines/hiphop/seattle/seattle_02_crew_confrontation.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.seattle_offer.carry': {
    art: 'assets/storylines/hiphop/seattle/seattle_03_phone_handoff.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.42, y: 0.35, w: 0.20, h: 0.40 }],
  },
  'hiphop.seattle_offer.carry.radio': {
    art: 'assets/storylines/hiphop/seattle/seattle_04_radio_explanation.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.58, h: 0.26 },
    playerBubble: { x: 0.40, y: 0.69, w: 0.56, h: 0.26 },
    tail:         { x: 0.30, y: 0.30 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.18, w: 0.65, h: 0.66 }],
  },
  'hiphop.seattle_offer.pass': {
    art: 'assets/storylines/hiphop/seattle/seattle_05_refuse_job.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.mercer_fork': {
    art: 'assets/storylines/hiphop/mercer_island/mercer_01_brittney_double_shift.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.mercer_fork.keepJob': {
    art: 'assets/storylines/hiphop/mercer_island/mercer_02_keep_job_phone_continues.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.bellevue_founder': {
    art: 'assets/storylines/hiphop/bellevue/bellevue_01_founder_bribe_offer.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.bellevue_founder.sell': {
    art: 'assets/storylines/hiphop/bellevue/bellevue_02_accept_bribe_ending.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.52, h: 0.25 },
    playerBubble: { x: 0.44, y: 0.71, w: 0.52, h: 0.24 },
    tail:         { x: 0.30, y: 0.29 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.20, w: 0.65, h: 0.70 }],
  },
  'hiphop.bellevue_founder.refuse': {
    art: 'assets/storylines/hiphop/bellevue/bellevue_03_reject_bribe.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.issaquah_kyle': {
    art: 'assets/storylines/hiphop/issaquah/issaquah_01_kyle_hears_track.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.issaquah_kyle.session': {
    art: 'assets/storylines/hiphop/issaquah/issaquah_02_remaster_session.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.58, h: 0.26 },
    playerBubble: { x: 0.40, y: 0.69, w: 0.56, h: 0.26 },
    tail:         { x: 0.30, y: 0.30 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.18, w: 0.65, h: 0.66 }],
  },
  'hiphop.issaquah_kyle.handOver': {
    art: 'assets/storylines/hiphop/issaquah/issaquah_03_thumb_drive_handoff.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.northbend_dom.arrival': {
    art: 'assets/storylines/hiphop/north_bend/north_bend_00_dominique_hears_arriving_track.png',
    bubble:       { x: 0.03, y: 0.05, w: 0.42, h: 0.27 },
    playerBubble: { x: 0.56, y: 0.68, w: 0.40, h: 0.26 },
    tail:         { x: 0.20, y: 0.32 },
    playerTail:   { x: 0.76, y: 0.94 },
    protect:      [{ x: 0.32, y: 0.30, w: 0.68, h: 0.66 }],
  },
  'hiphop.northbend_dom': {
    art: 'assets/storylines/hiphop/north_bend/north_bend_01_stolen_beat_confrontation.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.northbend_dom.promise': {
    art: 'assets/storylines/hiphop/north_bend/north_bend_02_promise_credit.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.northbend_dom.delay': {
    art: 'assets/storylines/hiphop/north_bend/north_bend_03_defer_until_presser.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.northbend_dom.bagman': {
    art: 'assets/storylines/hiphop/north_bend/north_bend_04_chased_out.png',
    bubble:       { x: 0.03, y: 0.05, w: 0.42, h: 0.27 },
    playerBubble: { x: 0.56, y: 0.68, w: 0.40, h: 0.26 },
    tail:         { x: 0.20, y: 0.32 },
    playerTail:   { x: 0.76, y: 0.94 },
    protect:      [{ x: 0.32, y: 0.30, w: 0.68, h: 0.66 }],
  },
  'hiphop.pass_tennessee': {
    art: 'assets/storylines/hiphop/snoqualmie_pass/snoqualmie_01_credit_decision.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'hiphop.pass_tennessee.pressing': {
    art: 'assets/storylines/hiphop/snoqualmie_pass/snoqualmie_02_pressing_100_records.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.44, h: 0.25 },
    playerBubble: { x: 0.52, y: 0.70, w: 0.44, h: 0.25 },
    tail:         { x: 0.26, y: 0.29 },
    playerTail:   { x: 0.74, y: 0.95 },
    protect:      [{ x: 0.12, y: 0.17, w: 0.76, h: 0.70 }],
  },
  'hiphop.pass_tennessee.loaded': {
    art: 'assets/storylines/hiphop/snoqualmie_pass/snoqualmie_03_player_loads_records_tennessee_stays.png',
    bubble:       { x: 0.55, y: 0.05, w: 0.41, h: 0.27 },
    playerBubble: { x: 0.04, y: 0.68, w: 0.42, h: 0.26 },
    tail:         { x: 0.76, y: 0.32 },
    playerTail:   { x: 0.23, y: 0.94 },
    protect:      [{ x: 0.00, y: 0.28, w: 0.68, h: 0.68 }],
  },
  'hiphop.cleelum_store.pristine': {
    art: 'assets/storylines/hiphop/cle_elum/cle_elum_01_pristine_delivery_unlock.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.52, h: 0.25 },
    playerBubble: { x: 0.44, y: 0.71, w: 0.52, h: 0.24 },
    tail:         { x: 0.30, y: 0.29 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.20, w: 0.65, h: 0.70 }],
  },
  'hiphop.cleelum_store.damaged': {
    art: 'assets/storylines/hiphop/cle_elum/cle_elum_02_damaged_cargo_payout.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.52, h: 0.25 },
    playerBubble: { x: 0.44, y: 0.71, w: 0.52, h: 0.24 },
    tail:         { x: 0.30, y: 0.29 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.20, w: 0.65, h: 0.70 }],
  },
  'hiphop.vantage_recovery.locked_phone': {
    art: 'assets/storylines/hiphop/vantage_ambush/vantage_00_locked_phone_in_car.png',
    bubble:       { x: 0.55, y: 0.05, w: 0.41, h: 0.27 },
    playerBubble: { x: 0.04, y: 0.68, w: 0.42, h: 0.26 },
    tail:         { x: 0.76, y: 0.32 },
    playerTail:   { x: 0.23, y: 0.94 },
    protect:      [{ x: 0.00, y: 0.28, w: 0.68, h: 0.68 }],
  },
  'hiphop.vantage_recovery.first_tail': {
    art: 'assets/storylines/hiphop/vantage_ambush/vantage_02_first_hostile_in_mirror.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.44, h: 0.25 },
    playerBubble: { x: 0.52, y: 0.70, w: 0.44, h: 0.25 },
    tail:         { x: 0.26, y: 0.29 },
    playerTail:   { x: 0.74, y: 0.95 },
    protect:      [{ x: 0.12, y: 0.17, w: 0.76, h: 0.70 }],
  },
  'hiphop.vantage_recovery': {
    art: 'assets/storylines/hiphop/vantage_ambush/vantage_01_three_car_ambush.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.44, h: 0.25 },
    playerBubble: { x: 0.52, y: 0.70, w: 0.44, h: 0.25 },
    tail:         { x: 0.26, y: 0.29 },
    playerTail:   { x: 0.74, y: 0.95 },
    protect:      [{ x: 0.12, y: 0.17, w: 0.76, h: 0.70 }],
  },
  'hiphop.vantage_recovery.side_ram': {
    art: 'assets/storylines/hiphop/vantage_ambush/vantage_03_side_ram.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.44, h: 0.25 },
    playerBubble: { x: 0.52, y: 0.70, w: 0.44, h: 0.25 },
    tail:         { x: 0.26, y: 0.29 },
    playerTail:   { x: 0.74, y: 0.95 },
    protect:      [{ x: 0.12, y: 0.17, w: 0.76, h: 0.70 }],
  },
  'hiphop.vantage_recovery.boxed_in': {
    art: 'assets/storylines/hiphop/vantage_ambush/vantage_04_boxed_in.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.44, h: 0.25 },
    playerBubble: { x: 0.52, y: 0.70, w: 0.44, h: 0.25 },
    tail:         { x: 0.26, y: 0.29 },
    playerTail:   { x: 0.74, y: 0.95 },
    protect:      [{ x: 0.12, y: 0.17, w: 0.76, h: 0.70 }],
  },
  'hiphop.vantage_recovery.fatal': {
    art: 'assets/storylines/hiphop/vantage_ambush/vantage_05_fatal_wreck.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.52, h: 0.25 },
    playerBubble: { x: 0.44, y: 0.71, w: 0.52, h: 0.24 },
    tail:         { x: 0.30, y: 0.29 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.20, w: 0.65, h: 0.70 }],
  },
  'hiphop.vantage_recovery.special_delivery': {
    art: 'assets/storylines/hiphop/vantage_ambush/vantage_06_special_delivery_ending.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.52, h: 0.25 },
    playerBubble: { x: 0.44, y: 0.71, w: 0.52, h: 0.24 },
    tail:         { x: 0.30, y: 0.29 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.20, w: 0.65, h: 0.70 }],
  },

  // ── Country (2 approved panels with measured tail anchors) ──
  'country.mercer_fork.ride': {
    art: 'assets/storylines/country/mercer_island/mercer_04_quits_leaves_phone.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.303, y: 0.252 },
    playerTail:   { x: 0.753, y: 0.276 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'country.mercer_departure': {
    art: 'assets/storylines/country/mercer_island/mercer_03_quit_and_join_player.png',
    bubble:       { x: 0.02, y: 0.03, w: 0.42, h: 0.25 },
    playerBubble: { x: 0.03, y: 0.72, w: 0.36, h: 0.24 },
    tail:         { x: 0.850, y: 0.195 },
    playerTail:   { x: 0.518, y: 0.290 },
    protect:      [
      { x: 0.44, y: 0.20, w: 0.14, h: 0.25 }, // Player + steering wheel
      { x: 0.68, y: 0.07, w: 0.20, h: 0.80 }, // Brittney
      { x: 0.80, y: 0.17, w: 0.16, h: 0.58 }, // open passenger door
    ],
  },
  'country.mercer_departure.board': {
    art: 'assets/storylines/country/mercer_island/mercer_03_quit_and_join_player.png',
    bubble:       { x: 0.02, y: 0.03, w: 0.42, h: 0.25 },
    playerBubble: { x: 0.03, y: 0.72, w: 0.36, h: 0.24 },
    tail:         { x: 0.850, y: 0.195 },
    playerTail:   { x: 0.518, y: 0.290 },
    protect:      [
      { x: 0.44, y: 0.20, w: 0.14, h: 0.25 },
      { x: 0.68, y: 0.07, w: 0.20, h: 0.80 },
      { x: 0.80, y: 0.17, w: 0.16, h: 0.58 },
    ],
  },
  'country.need_hunger.sushi': {
    art: 'assets/storylines/country/passenger_needs/hunger_01_buy_sushi.png',
    tail: { x: 0.661, y: 0.272 }, playerTail: { x: 0.351, y: 0.312 },
  },
  'country.need_hunger.burrito': {
    art: 'assets/storylines/country/passenger_needs/hunger_02_offer_pork_burrito.png',
    tail: { x: 0.752, y: 0.331 }, playerTail: { x: 0.391, y: 0.282 },
  },
  'country.need_hunger.wait': {
    art: 'assets/storylines/country/passenger_needs/hunger_03_wait_for_better_food.png',
    tail: { x: 0.281, y: 0.312 }, playerTail: { x: 0.681, y: 0.322 },
  },
  'country.need_bathroom.hold': {
    art: 'assets/storylines/country/passenger_needs/bathroom_01_hold_it.png',
    tail: { x: 0.441, y: 0.351 }, playerTail: { x: 0.721, y: 0.322 },
  },
  'country.need_bathroom.waitInCar': {
    art: 'assets/storylines/country/passenger_needs/bathroom_02_wait_in_car.png',
    tail: { x: 0.690, y: 0.402 }, playerTail: { x: 0.361, y: 0.312 },
  },
  'country.need_bathroom.goWith': {
    art: 'assets/storylines/country/passenger_needs/bathroom_03_go_with_her.png',
    tail: { x: 0.612, y: 0.321 }, playerTail: { x: 0.401, y: 0.312 },
  },
  'country.need_thirst.slushie': {
    art: 'assets/storylines/country/passenger_needs/thirst_01_buy_slushie.png',
    tail: { x: 0.721, y: 0.361 }, playerTail: { x: 0.391, y: 0.312 },
  },
  'country.need_thirst.fountain': {
    art: 'assets/storylines/country/passenger_needs/thirst_02_find_fountain.png',
    tail: { x: 0.621, y: 0.342 }, playerTail: { x: 0.321, y: 0.322 },
  },
  'country.beat.roadside_exit': {
    art: 'assets/storylines/country/nerve/nerve_zero_roadside_exit.png',
    tail: { x: 0.692, y: 0.323 }, playerTail: { x: 0.194, y: 0.390 },
  },
  'country.beat.kidnap': {
    art: 'assets/storylines/country/nerve/refuse_exit_five_star_chase.png',
    tail: { x: 0.488, y: 0.496 }, playerTail: { x: 0.557, y: 0.489 },
  },
  'country.vantage_arrival.spotted': {
    art: 'assets/storylines/country/vantage/vantage_01_spots_friends_work_uniform.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.530, y: 0.292 },
    playerTail:   { x: 0.271, y: 0.332 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  // The live node is `vantage_arrival`; `spotted` is the art beat name, not a
  // story choice id.  Keep both keys so old saved comics remain stable while
  // new conversations can actually resolve the approved establishing panel.
  'country.vantage_arrival': {
    art: 'assets/storylines/country/vantage/vantage_01_spots_friends_work_uniform.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.530, y: 0.292 },
    playerTail:   { x: 0.271, y: 0.332 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },

  // ── Classic Rock (22 approved panels with measured tail anchors) ──
  'classicRock.vantage_diner.shift_end': {
    art: 'assets/storylines/classic_rock/vantage/vantage_01_waitress_finishing_shift.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.44, h: 0.25 },
    playerBubble: { x: 0.52, y: 0.70, w: 0.44, h: 0.25 },
    tail:         { x: 0.26, y: 0.29 },
    playerTail:   { x: 0.74, y: 0.95 },
    protect:      [{ x: 0.12, y: 0.17, w: 0.76, h: 0.70 }],
  },
  'classicRock.vantage_diner': {
    art: 'assets/storylines/classic_rock/vantage/vantage_02_waiting_for_nan.png',
    bubble:       { x: 0.55, y: 0.05, w: 0.41, h: 0.27 },
    playerBubble: { x: 0.04, y: 0.68, w: 0.42, h: 0.26 },
    tail:         { x: 0.76, y: 0.32 },
    playerTail:   { x: 0.23, y: 0.94 },
    protect:      [{ x: 0.00, y: 0.28, w: 0.68, h: 0.68 }],
  },
  'classicRock.vantage_diner.east': {
    art: 'assets/storylines/classic_rock/vantage/vantage_03_player_offers_ride.png',
    bubble:       { x: 0.03, y: 0.05, w: 0.42, h: 0.27 },
    playerBubble: { x: 0.56, y: 0.68, w: 0.40, h: 0.26 },
    tail:         { x: 0.20, y: 0.32 },
    playerTail:   { x: 0.76, y: 0.94 },
    protect:      [{ x: 0.32, y: 0.30, w: 0.68, h: 0.66 }],
  },
  'classicRock.vantage_diner.swipe_reaction': {
    art: 'assets/storylines/classic_rock/vantage/vantage_04_swipe_right_reaction.png',
    bubble:       { x: 0.03, y: 0.05, w: 0.42, h: 0.27 },
    playerBubble: { x: 0.56, y: 0.68, w: 0.40, h: 0.26 },
    tail:         { x: 0.20, y: 0.32 },
    playerTail:   { x: 0.76, y: 0.94 },
    protect:      [{ x: 0.32, y: 0.30, w: 0.68, h: 0.66 }],
  },
  'classicRock.vantage_offer': {
    art: 'assets/storylines/classic_rock/vantage/vantage_05_opening_offer.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.othello_cover.arrival': {
    art: 'assets/storylines/classic_rock/othello/othello_01_arrival.png',
    bubble:       { x: 0.55, y: 0.05, w: 0.41, h: 0.27 },
    playerBubble: { x: 0.04, y: 0.68, w: 0.42, h: 0.26 },
    tail:         { x: 0.76, y: 0.32 },
    playerTail:   { x: 0.23, y: 0.94 },
    protect:      [{ x: 0.00, y: 0.28, w: 0.68, h: 0.68 }],
  },
  'classicRock.othello_cover.pay': {
    art: 'assets/storylines/classic_rock/othello/othello_02_player_pays_cover.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.othello_show.performance': {
    art: 'assets/storylines/classic_rock/othello/othello_03_unpaid_opening_performance.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.44, h: 0.25 },
    playerBubble: { x: 0.52, y: 0.70, w: 0.44, h: 0.25 },
    tail:         { x: 0.26, y: 0.29 },
    playerTail:   { x: 0.74, y: 0.95 },
    protect:      [{ x: 0.12, y: 0.17, w: 0.76, h: 0.70 }],
  },
  'classicRock.othello_show.interest': {
    art: 'assets/storylines/classic_rock/othello/othello_04_waitress_growing_interest.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.44, h: 0.25 },
    playerBubble: { x: 0.52, y: 0.70, w: 0.44, h: 0.25 },
    tail:         { x: 0.26, y: 0.29 },
    playerTail:   { x: 0.74, y: 0.95 },
    protect:      [{ x: 0.12, y: 0.17, w: 0.76, h: 0.70 }],
  },
  'classicRock.othello_show': {
    art: 'assets/storylines/classic_rock/othello/othello_05_rush_and_propositions.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.othello_show.hearBoth': {
    art: 'assets/storylines/classic_rock/othello/othello_06_asks_all_propositions.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.othello_show.payingOnly': {
    art: 'assets/storylines/classic_rock/othello/othello_07_asks_paying_proposition.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.othello_show.reject': {
    art: 'assets/storylines/classic_rock/othello/othello_08_rejects_propositions_waitress_leaves.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.52, h: 0.25 },
    playerBubble: { x: 0.44, y: 0.71, w: 0.52, h: 0.24 },
    tail:         { x: 0.30, y: 0.29 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.20, w: 0.65, h: 0.70 }],
  },
  'classicRock.othello_show.impromptour': {
    art: 'assets/storylines/classic_rock/othello/othello_09_impromptour_proposal.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.58, h: 0.26 },
    playerBubble: { x: 0.40, y: 0.69, w: 0.56, h: 0.26 },
    tail:         { x: 0.30, y: 0.30 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.18, w: 0.65, h: 0.66 }],
  },
  'classicRock.othello_show.continue': {
    art: 'assets/storylines/classic_rock/othello/othello_10_continue_tour.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.44, h: 0.25 },
    playerBubble: { x: 0.52, y: 0.70, w: 0.44, h: 0.25 },
    tail:         { x: 0.26, y: 0.29 },
    playerTail:   { x: 0.74, y: 0.95 },
    protect:      [{ x: 0.12, y: 0.17, w: 0.76, h: 0.70 }],
  },
  'classicRock.othello_show.duetOffer': {
    art: 'assets/storylines/classic_rock/othello/othello_11_duet_proposal.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.58, h: 0.26 },
    playerBubble: { x: 0.40, y: 0.69, w: 0.56, h: 0.26 },
    tail:         { x: 0.30, y: 0.30 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.18, w: 0.65, h: 0.66 }],
  },
  'classicRock.othello_show.duetYes': {
    art: 'assets/storylines/classic_rock/othello/othello_12_accepts_duet.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.othello_show.soloIntent': {
    art: 'assets/storylines/classic_rock/othello/othello_13_prefers_solo.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.hatton_nan': {
    art: 'assets/storylines/classic_rock/hatton/hatton_01_nan_arrives_oldsmobile.png',
    bubble:       { x: 0.03, y: 0.05, w: 0.42, h: 0.27 },
    playerBubble: { x: 0.56, y: 0.68, w: 0.40, h: 0.26 },
    tail:         { x: 0.20, y: 0.32 },
    playerTail:   { x: 0.76, y: 0.94 },
    protect:      [{ x: 0.32, y: 0.30, w: 0.68, h: 0.66 }],
  },
  'classicRock.hatton_nan.offer': {
    art: 'assets/storylines/classic_rock/hatton/hatton_02_nan_mild_fortune_offer.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.hatton_nan.objection': {
    art: 'assets/storylines/classic_rock/hatton/hatton_03_waitress_objects.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.hatton_nan.take': {
    art: 'assets/storylines/classic_rock/hatton/hatton_04_take_500_waitress_leaves.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.52, h: 0.25 },
    playerBubble: { x: 0.44, y: 0.71, w: 0.52, h: 0.24 },
    tail:         { x: 0.30, y: 0.29 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.20, w: 0.65, h: 0.70 }],
  },
  'classicRock.hatton_nan.herCall.stay': {
    art: 'assets/storylines/classic_rock/hatton/hatton_05_her_choice_high_stays.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.hatton_nan.herCall.leave': {
    art: 'assets/storylines/classic_rock/hatton/hatton_06_her_choice_low_leaves.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.52, h: 0.25 },
    playerBubble: { x: 0.44, y: 0.71, w: 0.52, h: 0.24 },
    tail:         { x: 0.30, y: 0.29 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.20, w: 0.65, h: 0.70 }],
  },
  'classicRock.hatton_nan.refuse': {
    art: 'assets/storylines/classic_rock/hatton/hatton_07_reject_nan_sploosh.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.hatton_nan.demand': {
    art: 'assets/storylines/classic_rock/hatton/hatton_08_demand_1000.png',
    bubble:       { x: 0.54, y: 0.05, w: 0.42, h: 0.30 },
    playerBubble: { x: 0.04, y: 0.64, w: 0.45, h: 0.30 },
    tail:         { x: 0.70, y: 0.35 },
    playerTail:   { x: 0.25, y: 0.94 },
    protect:      [{ x: 0.02, y: 0.08, w: 0.40, h: 0.82 }, { x: 0.58, y: 0.08, w: 0.40, h: 0.82 }],
  },
  'classicRock.washtucna_show.arrival': {
    art: 'assets/storylines/classic_rock/washtucna/washtucna_01_venue_arrival.png',
    bubble:       { x: 0.55, y: 0.05, w: 0.41, h: 0.27 },
    playerBubble: { x: 0.04, y: 0.68, w: 0.42, h: 0.26 },
    tail:         { x: 0.76, y: 0.32 },
    playerTail:   { x: 0.23, y: 0.94 },
    protect:      [{ x: 0.00, y: 0.28, w: 0.68, h: 0.68 }],
  },
  'classicRock.pullman_finale.partnership_kiss': {
    art: 'assets/storylines/classic_rock/pullman/pullman_mutual_kiss_wide.png',
    bubble:       { x: 0.04, y: 0.04, w: 0.52, h: 0.25 },
    playerBubble: { x: 0.44, y: 0.71, w: 0.52, h: 0.24 },
    tail:         { x: 0.30, y: 0.29 },
    playerTail:   { x: 0.70, y: 0.95 },
    protect:      [{ x: 0.20, y: 0.20, w: 0.65, h: 0.70 }],
  },
};

/** ESTABLISHING key for a node — the art shown BEFORE a choice is made. */
export function panelKeyFor(storyId, nodeId) { return `${storyId}.${nodeId}`; }

/** Is there an approved mapping for this key? */
export function hasPanelArt(panelKey) {
  return typeof panelKey === 'string' && !!PANEL_META[panelKey]?.art;
}

/**
 * Panel key for a COMMITTED CHOICE (Ch.18 mapping contract).
 *
 * Art is NEVER inferred from a filename or from the node id alone.  The
 * resolution order is authored-first, and the winning key is persisted on the
 * ledger entry so a re-render years later reproduces the same panel even if
 * these rules change:
 *
 *   1. explicit `choice.panelKey`   — authored override, AUTHORITATIVE
 *   2. `<storyId>.<nodeId>.<choiceId>` if mapped
 *   3. explicit `node.panelKey`     — authored override, AUTHORITATIVE
 *   4. `<storyId>.<nodeId>` if mapped
 *   5. null → placeholder
 *
 * Steps 1 and 3 are TERMINAL on purpose: an author who names a key is
 * declaring which panel this beat is, so if that art is missing the answer is a
 * placeholder, never a fall-through to a different image.  Substituting a
 * semantically-nearby panel is exactly the failure this contract forbids.
 *
 * The cross-story case this exists for: the Country route begins at Hip-Hop's
 * `mercer_fork` / `ride`, so the committed key is naturally
 * `hiphop.mercer_fork.ride` while the approved art is mapped as
 * `country.mercer_fork.ride`.  That is fixed with `choice.panelKey`, NOT by
 * rewriting ledger story identity to chase artwork.
 */
export function resolvePanelKey({ storyId, nodeId, choiceId = null, node = null, choice = null } = {}) {
  if (typeof choice?.panelKey === 'string' && choice.panelKey) return choice.panelKey;
  if (choiceId != null) {
    const k = `${storyId}.${nodeId}.${choiceId}`;
    if (PANEL_META[k]) return k;
  }
  if (typeof node?.panelKey === 'string' && node.panelKey) return node.panelKey;
  const nodeKey = panelKeyFor(storyId, nodeId);
  if (PANEL_META[nodeKey]) return nodeKey;
  return null;                          // → placeholder, never a substitute
}

export function panelMeta(panelKey) {
  const m = PANEL_META[panelKey];
  return m ? { ...DEFAULT_PANEL_META, ...m } : { ...DEFAULT_PANEL_META };
}

// ── Page templates ──────────────────────────────────────────────────────
// Page is 1 × 1.4142 (A-series portrait).  Gutter 0.03.
const G = 0.03, H = 1.4142;
const rect = (x, y, w, h) => ({ x, y, w, h });

export const PAGE_TEMPLATES = {
  // Wide establishing panel — one MAJOR beat fills the top; rest is left
  // empty so a later page doesn't have to.  (Locks immediately: 1 slot.)
  wide:  { kind: 'major',  slots: [rect(G, G, 1 - 2 * G, (1 - 2 * G) / PANEL_ASPECT)] },
  // Two-up.
  two_up: { kind: 'flow', slots: [
    rect(G, G,                 1 - 2 * G, (H - 3 * G) / 2),
    rect(G, G * 2 + (H - 3 * G) / 2, 1 - 2 * G, (H - 3 * G) / 2),
  ] },
  // One wide + two small.
  one_wide_two_small: { kind: 'flow', slots: [
    rect(G, G, 1 - 2 * G, (H - 3 * G) * 0.5),
    rect(G,             G * 2 + (H - 3 * G) * 0.5, (1 - 3 * G) / 2, (H - 3 * G) * 0.5),
    rect(G * 2 + (1 - 3 * G) / 2, G * 2 + (H - 3 * G) * 0.5, (1 - 3 * G) / 2, (H - 3 * G) * 0.5),
  ] },
  // Four grid.
  four_grid: { kind: 'flow', slots: [
    rect(G,                       G,                       (1 - 3 * G) / 2, (H - 3 * G) / 2),
    rect(G * 2 + (1 - 3 * G) / 2, G,                       (1 - 3 * G) / 2, (H - 3 * G) / 2),
    rect(G,                       G * 2 + (H - 3 * G) / 2, (1 - 3 * G) / 2, (H - 3 * G) / 2),
    rect(G * 2 + (1 - 3 * G) / 2, G * 2 + (H - 3 * G) / 2, (1 - 3 * G) / 2, (H - 3 * G) / 2),
  ] },
  // Large climax — one panel, most of the page.
  climax: { kind: 'climax', slots: [rect(G, G, 1 - 2 * G, H * 0.72)] },
  // MEANWHILE… three-panel strip (one event carrying three sub-panels).
  meanwhile: { kind: 'meanwhile', slots: [
    rect(G,                             H * 0.30, (1 - 4 * G) / 3, (1 - 4 * G) / 3 / PANEL_ASPECT * 1.6),
    rect(G * 2 + (1 - 4 * G) / 3,       H * 0.30, (1 - 4 * G) / 3, (1 - 4 * G) / 3 / PANEL_ASPECT * 1.6),
    rect(G * 3 + (1 - 4 * G) / 3 * 2,   H * 0.30, (1 - 4 * G) / 3, (1 - 4 * G) / 3 / PANEL_ASPECT * 1.6),
  ] },
  // Full-width ending.
  ending: { kind: 'ending', slots: [rect(G, G, 1 - 2 * G, H - 2 * G)] },
};

/** Flow templates cycle deterministically by page ordinal so the same event
 *  sequence always produces the same book. */
export const FLOW_CYCLE = ['two_up', 'one_wide_two_small', 'four_grid'];

export const PAGE_W = 1, PAGE_H = H;
