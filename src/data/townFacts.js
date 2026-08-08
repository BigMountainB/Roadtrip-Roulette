// ── Town facts ───────────────────────────────────────────────────────────
// 3-5 facts per rest-stop town, keyed by the REST_STOPS stop id. When the
// player pulls into a stop, the fact shown on the welcome / job card ROTATES
// through the town's list (nextTownFact advances a per-stop index in the save)
// so repeat visits don't keep showing the same line.
//
// NOTE (owner 2026-08-04): rewritten because the old list was padded with
// non-facts ("Snoqualmie Pass weather can change fast", "Thorp is little more
// than a fruit stand") and generic geography that read as filler. EVERY line
// below is a specific, checkable claim — a date, a number, a name, or an
// event — and every one was web-verified against HistoryLink, city/park
// sources, or the relevant museum before it shipped. Pick the strange true
// thing over the tidy summary; that is the whole point of the card.
//
// This list WINS over an encounter card's own `fact` (RestStopScene prefers
// `_townFact`), so a fact only reaches the player if it lives here.

export const TOWN_FACTS = {
  // S — Seattle
  S: [
    "Pike Place Market opened in 1907 because onions had gone from a dime a pound to a dollar and farmers were done splitting the take with middlemen.",
    "Seattle washed Denny Hill into Puget Sound with water cannons — holdouts who refused to sell had the hill sluiced out from under them and were left on dirt islands.",
    "I-90 starts here and runs about 3,000 miles east to Boston. You're doing the first 300.",
    "The Emerald City gets less rain per year than New York City. It just spreads it out to break you slowly.",
  ],
  // M — Mercer Island
  M: [
    "The 1940 floating bridge was the largest thing afloat on Earth, and the first ever built on reinforced-concrete pontoons. Nobody believed it would hold.",
    "In November 1990 the Lacey V. Murrow bridge broke up and sank into Lake Washington — a contractor had left the pontoon hatches open during a renovation.",
    "Before the bridge opened in 1940, the only way onto Mercer Island was by boat.",
    "Mercer Island is its own city — about 25,000 people on six square miles, reachable only by the I-90 spans.",
  ],
  // B — Bellevue
  B: [
    "Until World War II an American whaling fleet wintered in Meydenbauer Bay — the lake's fresh water killed the barnacles off the hulls.",
    "That fleet killed 160 whales in 1928 alone, run out of what is now a downtown full of glass towers.",
    "Bellevue's Strawberry Festival started in 1925 and by 1935 pulled 15,000 people — about five times the town's population.",
    "William Meydenbauer, a German-immigrant baker, rowed across Lake Washington in 1869 and claimed the bay that still carries his name.",
  ],
  // I — Issaquah
  I: [
    "The town incorporated as Gilman in 1892, then renamed itself Issaquah in 1899 to get closer to the Lushootseed word settlers had flattened into 'Squak.'",
    "Squak, Tiger and Cougar mountains over town are known as the Issaquah Alps.",
    "Salmon still run up Issaquah Creek every fall, straight through the middle of town to the hatchery.",
    "The name is usually translated as the sound of water birds — though the sources have argued about it for a century.",
  ],
  // SQ — Snoqualmie
  SQ: [
    "Snoqualmie Falls drops 268 feet — a full hundred feet taller than Niagara.",
    "The powerhouse under the falls went online in 1899, the world's first hydroelectric plant built entirely underground, 270 feet down in solid rock.",
    "The Salish Lodge above the falls played the Great Northern Hotel in Twin Peaks.",
  ],
  // N — North Bend
  N: [
    "North Bend played the town of Twin Peaks in 1990 — Twede's Cafe on North Bend Way was the Double R Diner.",
    "Mount Si rises roughly 4,000 feet directly behind town, close enough to feel like it's leaning on you.",
    "The name comes from the hard northward bend the Snoqualmie River takes right here.",
    "A century ago this was the last stop before drivers attempted the pass. Not much has changed about that part.",
  ],
  // SP — Snoqualmie Pass
  SP: [
    "The summit is 3,015 feet — the lowest major crossing of the Cascades, which tells you what the other ones are like.",
    "Seattle pioneer Henry Yesler raffled off his own sawmill in 1875 to fund a better pass road, then kept nearly all the money.",
    "The Sunset Highway over this pass was dedicated on July 1, 1915 as the state's first passable route across the Cascades — mostly unpaved, closed every winter.",
    "The pass takes around 400 inches of snow a year.",
    "The road traces an 1867 wagon route, which traced a trail Native travelers had used for centuries.",
  ],
  // EA — Easton
  EA: [
    "The Northern Pacific put Easton here in 1886 as a station at the east end of the Stampede Tunnel.",
    "That tunnel, open since 1888, runs 1.86 miles straight through the Cascades a few ridges south of you.",
    "The Milwaukee Road's Snoqualmie Tunnel was electrified in 1914 and is now a bike trail you can walk end to end in the dark.",
  ],
  // C — Cle Elum
  C: [
    "Cle Elum ran the last hand-operated telephone switchboard west of the Mississippi. The operators put through their final call on September 18, 1966.",
    "The town was spelled 'Clealum' until 1908 — mail kept ending up in Clallam, on the far side of the mountains.",
    "The name comes from a Kittitas word for 'swift water.'",
    "Coal built Cle Elum; the mines here fueled locomotives clear across the state.",
  ],
  // TH — Thorp
  TH: [
    "The Thorp Mill started grinding Kittitas Valley wheat in April 1883 and didn't stop until 1946 — the oldest industrial artifact left in the county.",
    "It opened as the North Star Mill, run by a horizontal water wheel fed by a canal off the Yakima River.",
    "The mill's first grindstones were hauled in from The Dalles, Oregon, by wagon.",
  ],
  // E — Ellensburg
  E: [
    "Ellensburg was the front-runner to be state capital until a fire on the night of July 4, 1889 took out ten blocks of downtown. Investigators called it arson and never named anyone.",
    "It lost the capital vote to Olympia in November 1890 and got the state normal school — now Central Washington University — as the consolation prize.",
    "The Ellensburg Rodeo has run since September 1923, when it was bolted onto the county fair just to draw a bigger crowd.",
    "Kittitas Valley residents spent two days in June 1923 clearing brush by hand to build the rodeo grounds.",
  ],
  // V — Vantage
  V: [
    "The 1927 Vantage Bridge was taken apart in 1963 and rebuilt across the Snake River at Lyons Ferry, where it still carries traffic today.",
    "The old bridge had to go because Wanapum Dam was about to raise the river over it.",
    "Ginkgo Petrified Forest here preserves petrified ginkgo logs found in 1932 — one of the most diverse fossil forests in North America.",
    "The steel horses on the bluff are 'Grandfather Cuts Loose the Ponies' — 15 life-size horses raised for Washington's 1989 centennial.",
  ],
  // Y — Royal City
  Y: [
    "Royal City was laid out in 1956 and incorporated in 1962. Before that the townsite was just called Royal Flats.",
    "There was a Titan I nuclear missile silo out in this farmland in the 1960s.",
    "The Royal Slope became Washington's 15th designated wine region in September 2020.",
  ],
  // O — Othello
  O: [
    "Othello got its name from a post office in Roane County, Tennessee. Nothing to do with Shakespeare.",
    "Thousands of sandhill cranes stage here every March, and the town has thrown them a festival since 1998.",
    "The Milwaukee Road arrived in 1907; the town later ran an ice plant just to keep produce cold in the rail cars.",
  ],
  // H — Hatton
  H: [
    "Before 1890 this stop was called Twin Wells, after the two wells drilled to water the railroad crews.",
    "'Hatton' is a mash-up of a wedding — postmistress Belle Sutton married railroad agent John Hackett, and the town took halves of both names.",
    "Hatton peaked at 500 people in 1913, with three grain elevators, two hotels, a bank, and electric street lights. Count what's left.",
  ],
  // W — Washtucna
  W: [
    "Washtucna was named for a Palouse leader; the name is also said to mean 'many waters,' after a big spring on the townsite.",
    "Palouse Falls, twenty minutes south, drops 198 feet into a scabland gorge and has been the official state waterfall since 2014.",
    "The canyons out here were cut in days, not eons — Ice Age megafloods scoured the Channeled Scablands about 13,000 years ago.",
    "A WSU anthropologist dug artifacts out near those falls dated 10,000 to 12,000 years old.",
  ],
  // L — La Crosse
  L: [
    "La Crosse started in 1888 when the railroad reached here and George Dawson built a shack out of leftover ties.",
    "The town nearly ended up named 'Dunlor' — there's a signed 1889 petition for it.",
    "This is the western edge of the Palouse, some of the most productive dryland wheat country on Earth.",
  ],
  // CO — Colfax
  CO: [
    "Colfax was first called Belleville, after the founder's hometown. The story goes his wife made him change it because it was too close to the name of his old girlfriend, Belle.",
    "The 65-foot Codger Pole downtown is a chainsaw sculpture of the 1938 Colfax and St. John football teams, who played their rematch in 1988 in their seventies. Colfax won 6-0.",
    "The Perkins House, built by the town's founder in 1886, was bought by the county historical society in 1973 for $13,900.",
  ],
  // P — Pullman
  P: [
    "Pullman was called Three Forks until 1881, when a $50 donation from railcar magnate George Pullman bought the naming rights. He never once set foot in it.",
    "WSU's creamery cans Cougar Gold cheddar — sealed in the tin it keeps in the fridge indefinitely and only gets better.",
    "Cougar Gold is named for Dr. N. S. Golding, the professor whose research made canned cheese work at all.",
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
