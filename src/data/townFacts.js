// ── Town facts ───────────────────────────────────────────────────────────
// 3-5 facts per rest-stop town, keyed by the REST_STOPS stop id. When the
// player pulls into a stop, the fact shown on the welcome / job card ROTATES
// through the town's list (nextTownFact advances a per-stop index in the save)
// so repeat visits don't keep showing the same line. Facts are informative,
// road-trip-radio tone — real Washington geography, not the dark-comedy NPC
// dialogue (that lives in encounters.js).

export const TOWN_FACTS = {
  // S — Seattle
  S: [
    "I-90 starts right here in Seattle and runs ~3,000 miles east to Boston.",
    "Seattle's hills were literally sluiced flat with water cannons in the early 1900s to regrade downtown.",
    "The Emerald City is famously overcast, yet it gets less total rain per year than New York City.",
    "Pike Place Market, open since 1907, is one of the oldest continuously running public markets in the U.S.",
  ],
  // M — Mercer Island
  M: [
    "Mercer Island sits in the middle of Lake Washington, reached only by the I-90 bridges.",
    "The I-90 floating bridges to Mercer Island are among the longest floating bridges on Earth.",
    "Mercer Island is its own city — around 25,000 people on ~6 square miles of wooded lakefront.",
    "Before the first floating bridge opened in 1940, you could only reach Mercer Island by boat.",
    "Minutes from downtown Seattle, Mercer Island stays almost entirely residential — trees, not towers.",
  ],
  // B — Bellevue
  B: [
    "Bellevue grew from a quiet suburb into a glass-tower tech hub in barely two decades.",
    "Bellevue is French for 'beautiful view' — of the Cascades and Lake Washington.",
    "Once strawberry-farm country, Bellevue now hosts major tech campuses and headquarters.",
  ],
  // I — Issaquah
  I: [
    "Issaquah sits at the foot of the Cascades, where the suburbs finally give up.",
    "Issaquah's name comes from a Native word often translated as 'the sound of birds.'",
    "Salmon still spawn in Issaquah Creek each fall, drawing crowds to the town hatchery.",
    "The three peaks over town — Squak, Tiger, and Cougar — are called the Issaquah Alps.",
  ],
  // SQ — Snoqualmie
  SQ: [
    "Snoqualmie Falls drops 268 feet — higher than Niagara — just north of the highway.",
    "The town of Snoqualmie grew up around timber and the railroad in the Cascade foothills.",
    "Snoqualmie Falls and the lodge above it featured in the TV series Twin Peaks.",
  ],
  // N — North Bend
  N: [
    "North Bend sits right under Mount Si, a 4,000-ft rock wall that looms over the whole town.",
    "North Bend is the last real stop for gas and chains before the climb to Snoqualmie Pass.",
    "North Bend's diner and streets doubled as the town of Twin Peaks on screen.",
    "The name comes from the big northward bend the Snoqualmie River takes here.",
  ],
  // SP — Snoqualmie Pass
  SP: [
    "The Snoqualmie Pass summit sits at 3,015 ft — the lowest major I-90 crossing of the Cascades.",
    "Snoqualmie Pass weather can change fast between North Bend and the summit.",
    "The pass gets around 400 inches of snow a year — chains are often required in winter.",
    "I-90 climbs from sea level in Seattle to just over 3,000 ft at the pass.",
  ],
  // EA — Easton
  EA: [
    "Easton is a tiny Cascade-foothill town near the east end of the old railroad tunnel.",
    "Just east of Easton the forest thins as the road drops toward the dry side of the mountains.",
    "Lake Easton and its state park sit right off the highway — a popular summer stop.",
  ],
  // C — Cle Elum
  C: [
    "The forested Cle Elum stretch is prime elk country in the Cascade foothills.",
    "Cle Elum's name comes from a Native word for 'swift water.'",
    "Coal mining built Cle Elum; the town once fueled locomotives across the state.",
    "Cle Elum ran one of the last hand-operated telephone switchboards in the U.S. until 1966.",
  ],
  // TH — Thorp
  TH: [
    "Thorp is a tiny farm town in the Kittitas Valley, known for its historic grist mill.",
    "The Thorp Mill, built in the 1880s, ground grain and sawed lumber for decades.",
    "Thorp is little more than a fruit stand and a highway exit between Cle Elum and Ellensburg.",
  ],
  // E — Ellensburg
  E: [
    "Ellensburg is Kittitas County's rodeo-and-college town, roughly halfway across the state.",
    "The Ellensburg Rodeo, run every Labor Day since 1923, is one of the biggest in the country.",
    "Central Washington University anchors the town of Ellensburg.",
    "After an 1889 fire, Ellensburg nearly became the state capital — it lost the vote to Olympia.",
  ],
  // V — Vantage
  V: [
    "The Columbia River crossing at Vantage is known for strong, exposed crosswinds.",
    "At Vantage, I-90 drops to the Columbia and the Ginkgo Petrified Forest fossil beds.",
    "Ginkgo Petrified Forest preserves ancient logs turned to stone by lava and mud.",
    "The Wild Horses Monument overlooks the highway on the bluff just east of Vantage.",
  ],
  // Y — Royal City
  Y: [
    "Royal City sits in the irrigated farmland of the Columbia Basin, off WA-26.",
    "The Royal Slope around here is dense with vineyards, orchards, and center-pivot circles.",
    "Royal City's farms exist thanks to the Columbia Basin Project's canals and dams.",
  ],
  // O — Othello
  O: [
    "The Columbia Basin around Othello is heavy irrigated farmland — long dark stretches between services.",
    "Othello hosts a Sandhill Crane Festival each spring as thousands of cranes pass through.",
    "Othello grew as a railroad town, then boomed when irrigation reached the desert soil.",
  ],
  // H — Hatton
  H: [
    "Hatton is a tiny spot on WA-26, in the sparse country between Othello and Washtucna.",
    "Hatton is nearly a ghost town — a grain elevator, a few homes, and a lot of wheat.",
    "The Hatton Coulee rest area is one of the only stops for miles along WA-26.",
  ],
  // W — Washtucna
  W: [
    "The Washtucna area is sparse wheat-country highway — long gaps between help.",
    "Washtucna sits at the edge of the Channeled Scablands, carved by Ice Age megafloods.",
    "Nearby Palouse Falls — Washington's state waterfall — drops 200 feet into a scabland gorge.",
  ],
  // L — La Crosse
  L: [
    "La Crosse is a small Whitman County wheat town on the western edge of the Palouse.",
    "La Crosse is known for its 'Rock Wall,' a folk-art fence built from local basalt and odds and ends.",
    "Out here the land rolls into the Palouse — some of the most productive dryland wheat country on Earth.",
  ],
  // CO — Colfax
  CO: [
    "Colfax is the Whitman County seat, tucked into the rolling hills of the Palouse.",
    "The Palouse hills around Colfax are wind-deposited soil, farmed for wheat and lentils.",
    "Colfax sits along the Palouse River on the old route between Spokane and the wheat country.",
  ],
  // P — Pullman
  P: [
    "Pullman is home to Washington State University and its Cougars.",
    "Pullman is built on seven hills in the heart of the Palouse.",
    "WSU's creamery in Pullman is famous for Cougar Gold, a canned cheddar aged for years.",
    "You made it — Pullman, the end of the road and the start of the party.",
  ],
};

/** Next fact for a stop, ROTATING so repeat visits cycle through the town's
 *  list instead of repeating one. Advances a per-stop index kept in the save.
 *  Returns null for stops with no facts (caller falls back to the encounter's
 *  own fact). */
export function nextTownFact(stopId, save) {
  const facts = TOWN_FACTS[stopId];
  if (!facts || !facts.length) return null;
  const rot = save?.get?.('factRotation', {}) ?? {};
  const idx = (((rot[stopId] ?? 0) % facts.length) + facts.length) % facts.length;
  rot[stopId] = (idx + 1) % facts.length;
  try { save?.set?.('factRotation', rot); } catch (_) {}
  return facts[idx];
}
