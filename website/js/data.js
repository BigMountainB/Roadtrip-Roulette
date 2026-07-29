// Road Trip Roulette website — game data, extracted from the game source.
// Sources: src/systems/AudioSystem.js (stations), src/data/genreVehicleTraits.js
// (vehicles/traits), src/constants.js (route), src/data/townFacts.js (facts),
// public/assets/music/* (track files). Regenerate by hand if the game changes.

// musicDir differs from key for two genres (edm_rave→edm, k_pop→kpop).
export const GENRES = [
  {
    key: 'hiphop_phonk', name: 'Hip-Hop / Phonk', color: '#A855F7', bpm: 145, musicDir: 'hiphop_phonk',
    vehicleName: 'VIP Sedan', topSpeedMph: 140, cruiseMph: 120,
    strengths: ['Reaches top speed 20% faster', 'Driving-bonus grace period lasts 50% longer'],
    weaknesses: ['Wanted stars decay 25% slower', 'Snow, wind & rough-road steering penalties 25% stronger'],
    blurb: 'Blacked-out windows, subs in the trunk, taillights gone before the cops look up. Fast to speed, slow to cool off.',
    tracks: ['2_am_gas','clinic_cup','cocktails','death_grip','exit_13','headlights_gone','interstate_fever_dream','line_phantom','mushed_my_turn','neon_dash_foam_ghosts','paint_the_asphalt_pink','parking_lot_wizzard','party_run','passenger_princess','pull_up_pull_out','smoke_sparks','toxic_cadence'],
  },
  {
    key: 'country', name: 'Country', color: '#E7A83E', bpm: 104, musicDir: 'country',
    vehicleName: 'Mud Truck', topSpeedMph: 120, cruiseMph: 100,
    strengths: ['Traffic, scenery & weather damage −25%', 'Snow & crosswind steering penalty −50%'],
    weaknesses: ['Fuel consumption +30%', 'Accel & steering −20%; bonus builds 20% slower'],
    blurb: 'Lifted, dented, and completely unbothered by the weather. It shrugs off hits — and drinks gas like a tailgate keg.',
    tracks: ['blue_lights_in_the_rearview','cash_in_a_feed_sack','powder_river_revival','riverboat_arson','roman_candles_tannerite','shotgun_choir','whiskey_bent_transmission'],
  },
  {
    key: 'reggaeton', name: 'Reggaeton', color: '#FFB000', bpm: 88, musicDir: 'reggaeton',
    vehicleName: 'Lowrider', topSpeedMph: 135, cruiseMph: 115,
    strengths: ['Passenger fares +30%', 'Drinks & caffeine +25% above 110 mph'],
    weaknesses: ['First moving violation = instant wanted star', 'Collision damage +20%; snow steering penalty +25%'],
    blurb: 'The whole highway hears you coming. Passengers pay premium for the vibes — the cops charge premium for them too.',
    tracks: ['aguantate','cinco_estrellas','comida_chatarra','donas_y_fuegos','la_cima','la_ruleta','los_del_camino','mejoras','mensajes','sin_domir','sin_remordimiento','sube_el_volumen'],
  },
  {
    key: 'k_pop', name: 'K-Pop', color: '#FF5CB8', bpm: 110, musicDir: 'kpop',
    vehicleName: 'Idol EV', topSpeedMph: 145, cruiseMph: 125,
    strengths: ['Roadside pickup radius +30%', 'On-time bonus +25% on timed jobs'],
    weaknesses: ['Collision damage +25%', 'Food, Drinks & Alertness drain +20%'],
    blurb: 'Immaculate, punctual, and running on a comeback schedule. Great at grabbing everything on the road — fragile when the road grabs back.',
    tracks: ['black_card_valkyries','cherry_bomb_express','gangnam_ghosts','neon_vacation','pit_stopping_hearts','sugar_rush_riot','tunnel_vision'],
  },
  {
    key: 'metal', name: 'Metal', color: '#C4CFDA', bpm: 150, musicDir: 'metal',
    vehicleName: 'War Van', topSpeedMph: 110, cruiseMph: 90,
    strengths: ['Collision & police damage −30%', 'Weapons last +25%; 20% chance of a bonus use'],
    weaknesses: ['Accel, braking & steering −20%', 'Fuel consumption +35%'],
    blurb: 'A rolling amp stack with a bumper. Slow, thirsty, nearly indestructible — and it makes every weapon hit harder and last longer.',
    tracks: ['arcade_renegades','cascade_storm','concrete_animal','crystal_speedway','gas_station_saints','last_exit','mall_riot_summer','neon_poison','nitro_saints','perms_pistols','powder_vision','road_queen','sirens_call'],
  },
  {
    key: 'classic_rock', name: 'Classic Rock', color: '#FF7A1A', bpm: 130, musicDir: 'classic_rock',
    vehicleName: 'Muscle Car', topSpeedMph: 150, cruiseMph: 135,
    strengths: ['Driving cash above 120 mph +20%', 'Shrugs off the first overheat each leg'],
    weaknesses: ['Braking distance +25%', 'Snow & crosswind instability +30%'],
    blurb: 'Big block, bad brakes, born in a decade with no speed limits. Money pours in at full throttle — stopping is your problem.',
    tracks: ['2000_miles_to_mexico','acid_picnic_at_vantage','free_love_motel','rain_on_the_ferry','sirens_call','snoqualmie_moon','the_last_beer_in_ritzville','through_the_palouse'],
  },
  {
    key: 'edm_rave', name: 'EDM / Rave', color: '#00EEFF', bpm: 128, musicDir: 'edm',
    vehicleName: 'Laser Supercar', topSpeedMph: 165, cruiseMph: 145,
    strengths: ['ACCEL boost +35% & 25% longer', 'Caffeine +35% Alertness, delayed crash'],
    weaknesses: ['Collision damage +35%', 'Drinks & Bladder drain +25% while boosting'],
    blurb: 'The fastest thing on the route, built entirely out of drops. Caffeine hits different in here — so do guardrails.',
    tracks: ['acid_carousel','anarchy_hotline','crash_theory','feel_the_frequency','nitrous_communion','tokyo_sideways','velvet_laser'],
  },
  {
    key: 'reggae', name: 'Reggae', color: '#36C95B', bpm: 78, musicDir: 'reggae',
    vehicleName: 'Easy-Rider Van', topSpeedMph: 100, cruiseMph: 80,
    strengths: ['No slow-driving penalty — earns the normal rate at any speed', 'Alertness, Food & Bladder drain −25% below 100 mph'],
    weaknesses: ['No police warnings; every ticket +$200', 'Over-75% Food/Bladder gains halved; bonus ×0.80'],
    blurb: 'No hurry, no worry — the only ride that earns full rate cruising slow. The law, unfortunately, skips the warnings.',
    tracks: ['catch_we','concrete_jungle_bashment','ganja_speedway','high_grade_holiday','midnight_soundbwoy','pull_up','rum_revolution'],
  },
  {
    key: 'pop_punk_emo', name: 'Pop-Punk / Emo', color: '#FF4D9D', bpm: 132, musicDir: 'pop_punk_emo',
    vehicleName: 'Tour Hatchback', topSpeedMph: 125, cruiseMph: 105,
    strengths: ['Repairs & basic upgrades −25%', 'Driving bonus +50% below 25 HP'],
    weaknesses: ['Max HP −15%; scenery impacts +20% damage', 'Acceleration & fuel range −15%'],
    blurb: 'Held together by stickers and spite. It thrives on the edge of falling apart — literally paying out more the closer it is to dying.',
    tracks: ['airplane_mode','blow_the_speakers','brand_new_machine','code_yellow','five_times','no_brakes','number_two','one_way_track','red_and_blue','shoulder_of_the_road','smoke_and_sparks','spin','sugar_crash','wide_awake','windows_down'],
  },
  {
    key: 'norteno', name: 'Norteño', color: '#20D7C5', bpm: 118, musicDir: 'norteno',
    vehicleName: 'Custom Pickup', topSpeedMph: 130, cruiseMph: 110,
    strengths: ['Delivery/cargo missions pay +25%', 'Cargo survives one minor collision', 'Fuel range +30%'],
    weaknesses: ['Snow/rough-road instability +25%; steering & braking −15%'],
    blurb: 'Chrome, accordion, and a bed full of paying cargo. The long-haul workhorse — huge range, best delivery money on the route.',
    tracks: ['almas_de_la_orilla','azucar_y_gasolina','bocinas_al_tope','buzon_lleno','cafeina_hirviendo','cielo_abierto','cinco_coronas','doscientas_noventa','el_taller','humo_y_lumbre','la_ultima_salida','ojos_rojos','por_cinco','sirenas_y_polvo','todo_al_rojo'],
  },
];

// Filename → display title, with overrides for words plain Title Case gets wrong.
const TITLE_WORDS = { am: 'AM', edm: 'EDM', s3x: 'S3X', y: 'y', de: 'de', la: 'la', el: 'el', al: 'al' };
export function trackTitle(file) {
  return file.split('_').map((w, i) => {
    const o = TITLE_WORDS[w];
    if (o !== undefined) return (i === 0) ? o.charAt(0).toUpperCase() + o.slice(1) : o;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

// ── Businesses (RestStopScene brandsForStop; logos synced from
//    public/assets/businesses by sync-assets.sh) ───────────────────────────
export const BIZ = {
  gas:      { name: "Huff's Gas",              img: 'huffs.png' },
  cargo:    { name: 'CarGo',                   img: 'cargo.png' },
  hunting:  { name: 'CowBella',                img: 'cowbellas.png' },
  camp:     { name: 'AOK Camp',                img: 'aok.png' },
  lord:     { name: 'Lord Motors',             img: 'lord.png' },
  suck:     { name: "Sam's Used Car Kingdom",  img: 'suck.png' },
  vices:    { name: 'Gas-N-Sip',               img: 'gasnsip.png' },
  ambm:     { name: 'AM/BM',                   img: 'am_bm.png' },
  parkride: { name: 'Metro Park & Ride',       img: 'park-and-ride.png' },
};

// ── Business menus (RestStopScene SECTIONS / viceItems, upgrades.js) ─────
// Prices are the game's real numbers. p: null renders as FREE.
const SNACKS = [
  { n: 'Coffee', p: 10, d: 'A moderate Alertness bump. Brewed at some point this week.' },
  { n: 'Caffeine Pills', p: 18, d: '+28 Alertness — the strong, rare stuff.' },
  { n: 'Gas-Station Sushi', p: 25, d: 'Food. Technically.' },
  { n: 'Greasy Burrito', p: 25, d: 'Heavy, warm, consequences later.' },
  { n: 'Energy Shot', p: 25, d: 'A jittery rush in a tiny bottle.' },
  { n: 'Sugar Gummies', p: 25, d: 'The colorful kind of bad idea.' },
  { n: 'Roller-Grill Hot Dog', p: 25, d: 'It has been rolling a while.' },
  { n: 'Combo Meal', p: 25, d: 'Everything at once. Food coma sold separately (included).' },
  { n: 'Cold Brew', p: 25, d: 'Steady caffeine for the long dark stretches.' },
  { n: '3AM Buffet', p: 25, d: 'All you can regret.' },
  { n: 'Brain-Freeze Slushie', p: 25, d: 'Dizzyingly refreshing.' },
  { n: 'Take a Snooze', p: 150, d: 'Sleep it all off — every buzz back to zero.' },
];
const GARAGE = [
  { n: 'Tires — Used/Good All-Seasons, Snow Tires', p: '250–1,200', d: 'Grip now, chains-optional later.' },
  { n: 'Brakes — New Pads, Slotted Rotors, Big Brake Kit', p: '300–1,800', d: 'Stopping is a feature.' },
  { n: 'Suspension — Fresh Shocks, Rally Springs, Lowering Kit', p: '800–1,500', d: 'Planted through the curves.' },
  { n: 'Engine — Tune-Up, Cold Air Intake, ECU Tune', p: '250–900', d: 'More top speed, more acceleration.' },
  { n: 'Cooling — Coolant Flush, New Radiator, Aux Fan', p: '150–1,100', d: 'Keeps limp mode at bay in the desert.' },
  { n: 'Fuel — Jerry Can Rack, Aux Fuel Cell, Reserve Tank', p: '120–900', d: '+25 to +100 miles of range.' },
  { n: 'Body — Zip-Tied Bumper, Reinforced Bumper, Bash Bar', p: '25–1,000', d: 'Hit points, literally.' },
  { n: 'Lights & Glass — Wipers, Fog Lights, Headlights, Windshield', p: '40–500', d: 'See the road; be seen less by trees.' },
  { n: 'Police — Radar Detector, Scanner, Fresh Paint + Plates', p: '250–1,500', d: 'Know where they are. Or become someone else.' },
  { n: 'Genre Cars', p: '25,000', d: "Every scene's ride, if you can pay the sticker." },
];
export const BIZ_MENUS = {
  gas: { tagline: 'Pumps at every gas stop — "no CarGo without Huff\'s."', items: [
    { n: 'Refuel', p: '0.50/mi', d: '$10 per 30 miles of tank. About 1 fill-up in 5 ends in a robbery.' },
    { n: 'Bottled Water', p: 10, d: 'A cold bottle — a small Drinks top-up.' },
    { n: 'Road-Snack Rack', p: '25', d: 'A short rack of the Gas-N-Sip staples.' },
  ]},
  cargo: { tagline: 'The gig hub — rides and deliveries, no gas.', items: [
    { n: 'Pick Up Hitchhiker', p: null, d: "Free — but it's a gamble. Opens past Issaquah." },
    { n: 'Ready Drop-Offs', p: null, d: 'Collect delivery gigs posted along the route.' },
    { n: 'Bottled Water', p: 10, d: 'So the counter is never empty.' },
  ]},
  hunting: { tagline: 'Sporting goods, loosely defined.', items: [
    { n: 'Diesel Tune', p: 350, d: '+3 clouds — smoke out the law behind you.' },
    { n: 'Fireworks', p: 500, d: '+3 shows — scatters every cop on screen.' },
    { n: 'Donuts', p: 50, d: '+1 — all cops stop chasing for 15 seconds.' },
    { n: 'New Passport', p: 2000, d: 'Single-use: clears 2 wanted stars on resume.' },
  ]},
  camp: { tagline: 'Rest, repairs, and questionable company.', items: [
    { n: 'Pick Up Hitchhiker', p: null, d: "Free — but it's a gamble." },
    { n: 'Nap It Off', p: null, d: 'Watch an ad (5s); fully restores Alertness.' },
    { n: 'Coffee', p: 7, d: 'A moderate Alertness bump.' },
    { n: 'Bottled Water', p: 7, d: 'A small Drinks top-up.' },
    { n: 'Camp Repair', p: 400, d: 'Repair up to 65% HP — cheaper than the dealership.' },
    { n: 'Hot Springs Soak', p: 500, d: '+10 bonus HP above max, until used.' },
  ]},
  lord: { tagline: 'The EV dealership — chrome, warranties, judgment.', items: GARAGE },
  suck: { tagline: "S.U.C.K. — Sam's gas-burner lot. The name came free.", items: GARAGE },
  vices: { tagline: 'Convenience store, fuel, and every vice on the shelf.', items: [
    { n: 'Refuel', p: '0.50/mi', d: 'Pumps gas like the big boys.' },
    { n: 'Bottled Water', p: 10, d: 'A small Drinks top-up.' },
    ...SNACKS,
    { n: 'Restroom', p: null, d: 'Piss in bliss — customers only.' },
  ]},
  ambm: { tagline: 'Morning coffee, nightly consequences. Famous restrooms.', items: [
    { n: 'Refuel', p: '0.50/mi', d: 'Yes, they have pumps too.' },
    { n: 'Bottled Water', p: 10, d: 'A small Drinks top-up.' },
    ...SNACKS,
    { n: 'Restroom', p: null, d: 'The main attraction.' },
  ]},
  parkride: { tagline: 'A public lot. That is the whole business model.', items: [
    { n: 'Restroom', p: null, d: "Piss in bliss — and it's free." },
    { n: 'A Quiet Place to Park', p: null, d: 'Catch your breath; pick up passengers.' },
  ]},
};

// ── Route: 19 rest stops + 4 pass-through towns, 293 miles ──────────────
// biz arrays = the stop's REST_STOPS.amenities from src/constants.js.
export const ROUTE = [
  { name: 'Seattle', mi: 4, stop: true, biz: ['cargo', 'lord', 'suck', 'parkride', 'vices', 'ambm'], facts: [
    'I-90 starts right here in Seattle and runs ~3,000 miles east to Boston.',
    "Seattle's hills were literally sluiced flat with water cannons in the early 1900s to regrade downtown.",
    'The Emerald City is famously overcast, yet it gets less total rain per year than New York City.',
    'Pike Place Market, open since 1907, is one of the oldest continuously running public markets in the U.S.',
  ]},
  { name: 'Mercer Island', mi: 9, stop: true, biz: ['cargo', 'parkride', 'vices'], facts: [
    'Mercer Island sits in the middle of Lake Washington, reached only by the I-90 bridges.',
    'The I-90 floating bridges to Mercer Island are among the longest floating bridges on Earth.',
    'Before the first floating bridge opened in 1940, you could only reach Mercer Island by boat.',
  ]},
  { name: 'Bellevue', mi: 12, stop: true, biz: ['cargo', 'lord', 'suck', 'parkride', 'vices', 'ambm'], facts: [
    'Bellevue grew from a quiet suburb into a glass-tower tech hub in barely two decades.',
    "Bellevue is French for 'beautiful view' — of the Cascades and Lake Washington.",
    'Once strawberry-farm country, Bellevue now hosts major tech campuses and headquarters.',
  ]},
  { name: 'Issaquah', mi: 18, stop: true, biz: ['cargo', 'hunting', 'camp', 'lord', 'parkride', 'vices'], facts: [
    'Issaquah sits at the foot of the Cascades, where the suburbs finally give up.',
    'Salmon still spawn in Issaquah Creek each fall, drawing crowds to the town hatchery.',
    'The three peaks over town — Squak, Tiger, and Cougar — are called the Issaquah Alps.',
  ]},
  { name: 'Preston', mi: 22, stop: false, facts: [] },
  { name: 'Snoqualmie', mi: 25, stop: true, biz: ['parkride', 'vices', 'ambm'], facts: [
    'Snoqualmie Falls drops 268 feet — higher than Niagara — just north of the highway.',
    'Snoqualmie Falls and the lodge above it featured in the TV series Twin Peaks.',
  ]},
  { name: 'North Bend', mi: 32, stop: true, biz: ['cargo', 'camp', 'lord', 'parkride', 'vices', 'ambm'], facts: [
    'North Bend sits right under Mount Si, a 4,000-ft rock wall that looms over the whole town.',
    'North Bend is the last real stop for gas and chains before the climb to Snoqualmie Pass.',
    "North Bend's diner and streets doubled as the town of Twin Peaks on screen.",
  ]},
  { name: 'Snoqualmie Pass', mi: 53, stop: true, biz: ['cargo', 'camp', 'ambm'], facts: [
    'The Snoqualmie Pass summit sits at 3,015 ft — the lowest major I-90 crossing of the Cascades.',
    'The pass gets around 400 inches of snow a year — chains are often required in winter.',
    'I-90 climbs from sea level in Seattle to just over 3,000 ft at the pass.',
  ]},
  { name: 'Easton', mi: 70, stop: true, biz: ['camp', 'vices'], facts: [
    'Easton is a tiny Cascade-foothill town near the east end of the old railroad tunnel.',
    'Just east of Easton the forest thins as the road drops toward the dry side of the mountains.',
  ]},
  { name: 'Cle Elum', mi: 84, stop: true, biz: ['gas', 'hunting', 'camp', 'lord', 'vices'], facts: [
    'The forested Cle Elum stretch is prime elk country in the Cascade foothills.',
    "Cle Elum's name comes from a Native word for 'swift water.'",
    'Cle Elum ran one of the last hand-operated telephone switchboards in the U.S. until 1966.',
  ]},
  { name: 'Thorp', mi: 101, stop: true, biz: ['camp', 'vices'], facts: [
    'Thorp is a tiny farm town in the Kittitas Valley, known for its historic grist mill.',
    'Thorp is little more than a fruit stand and a highway exit between Cle Elum and Ellensburg.',
  ]},
  { name: 'Ellensburg', mi: 109, stop: true, biz: ['gas', 'hunting', 'suck', 'parkride', 'vices'], facts: [
    "Ellensburg is Kittitas County's rodeo-and-college town, roughly halfway across the state.",
    'The Ellensburg Rodeo, run every Labor Day since 1923, is one of the biggest in the country.',
    'After an 1889 fire, Ellensburg nearly became the state capital — it lost the vote to Olympia.',
  ]},
  { name: 'Kittitas', mi: 117, stop: false, facts: [] },
  { name: 'Vantage', mi: 137, stop: true, biz: ['gas', 'camp', 'ambm'], facts: [
    'The Columbia River crossing at Vantage is known for strong, exposed crosswinds.',
    'Ginkgo Petrified Forest preserves ancient logs turned to stone by lava and mud.',
    'The Wild Horses Monument overlooks the highway on the bluff just east of Vantage.',
  ]},
  { name: 'George', mi: 149, stop: false, facts: [] },
  { name: 'Royal City', mi: 158, stop: true, biz: ['gas', 'hunting', 'vices'], facts: [
    'Royal City sits in the irrigated farmland of the Columbia Basin, off WA-26.',
    'The Royal Slope around here is dense with vineyards, orchards, and center-pivot circles.',
  ]},
  { name: 'Othello', mi: 184, stop: true, biz: ['gas', 'lord', 'suck', 'vices', 'ambm'], facts: [
    'The Columbia Basin around Othello is heavy irrigated farmland — long dark stretches between services.',
    'Othello hosts a Sandhill Crane Festival each spring as thousands of cranes pass through.',
  ]},
  { name: 'Hatton', mi: 205, stop: true, biz: ['gas', 'ambm'], facts: [
    'Hatton is nearly a ghost town — a grain elevator, a few homes, and a lot of wheat.',
    'The Hatton Coulee rest area is one of the only stops for miles along WA-26.',
  ]},
  { name: 'Washtucna', mi: 228, stop: true, biz: ['gas', 'camp', 'ambm'], facts: [
    'Washtucna sits at the edge of the Channeled Scablands, carved by Ice Age megafloods.',
    "Nearby Palouse Falls — Washington's state waterfall — drops 200 feet into a scabland gorge.",
  ]},
  { name: 'La Crosse', mi: 253, stop: true, biz: ['gas', 'hunting'], facts: [
    'La Crosse is a small Whitman County wheat town on the western edge of the Palouse.',
    "La Crosse is known for its 'Rock Wall,' a folk-art fence built from local basalt and odds and ends.",
  ]},
  { name: 'Endicott', mi: 263, stop: false, facts: [] },
  { name: 'Colfax', mi: 274, stop: true, biz: ['gas', 'lord', 'suck', 'parkride', 'vices'], facts: [
    'Colfax is the Whitman County seat, tucked into the rolling hills of the Palouse.',
    'The Palouse hills around Colfax are wind-deposited soil, farmed for wheat and lentils.',
  ]},
  { name: 'Pullman', mi: 289, stop: true, biz: ['cargo', 'lord', 'parkride', 'vices', 'ambm'], facts: [
    'Pullman is home to Washington State University and its Cougars.',
    'Pullman is built on seven hills in the heart of the Palouse.',
    'You made it — Pullman, the end of the road and the start of the party.',
  ]},
];

export const TOTAL_MILES = 293;

// Deployed worker base URL (worker/README.md). Leaderboard page reads
// GET /api/leaderboard?metric=score|miles|time — CORS is open.
export const API_BASE = 'https://roadtrip-api.brendanbaughn.workers.dev';
