# Soundtrack Culture Pack Art Specification

Culture packs replace presentation only. Canonical gameplay IDs and effects stay
unchanged; the selected run culture resolves each canonical ID to a themed image.

## Badge category colors

The circular field, illuminated inner rim, and eventual roadside pickup halo use a
fixed gameplay color across every culture. Product colors remain free to express the
genre, so a purple Hip-Hop/Phonk slushie still sits on a blue hydration badge.

| Category | Signal | Canonical assets |
|---|---|---|
| Hydration / drinks | Electric blue | `water.png`, `slushie.png` |
| Food | Hot orange | `sushi.png`, `burrito.png`, `combo_meal.png`, `gummies.png`, `hotdog.png` |
| Caffeine / alertness | Bright yellow | `energy_shot.png`, `caffeine_pills.png`, `cold_brew.png` |
| Special / high-risk | Warning red | `food_coma.png`, `dramamine.png`, `redneck_rage.png`, `emergency_espresso.png` |

Every badge is a 512x512 transparent PNG with a centered, readable subject; thick
black outer rim; metallic inner rim; category-colored radial field; and no shadow or
paint outside the circular silhouette.

### Distance-read requirements

- The outer badge silhouette must be a true circle. Product packaging may be square,
  but it must sit inside the circular field; square frames, shields, spikes, banners,
  and side ornaments cannot replace or break the round badge edge.
- Keep the subject and supporting props compact enough to leave a broad, continuous
  band of category color visible around them. Decorative side props must never bury
  the field or make the badge read as black at pickup size.
- Validate every badge at 64–96px. At that size, its category must register before
  its product text: blue hydration, orange food, yellow caffeine, or red special.
- Genre styling belongs in the product, typography, texture, and restrained rim
  treatment. The fixed category field remains the dominant long-distance signal.

## First production wave

| Folder | Culture direction | Anchor asset |
|---|---|---|
| `hiphop_phonk` | Corner-store luxury, studio culture, midnight drift scene, purple/black/chrome | Purple double-cup slushie on blue hydration field |
| `country` | Truck stops, rodeo excess, square-body diesel culture, camo/feed-store packaging | MANSTER energy shot on yellow caffeine field |
| `reggaeton` | Puerto Rican/Caribbean urbano nightlife, bodega drinks, chrome compacts, gold jewelry | Tropical club slushie on blue hydration field |
| `k_pop` | Idol merchandise, photocards, convenience-store collaborations, pastel holographic packaging | BIAS BITES gummies on orange food field |
| `metal` | Blackened steel, tour-bus excess, apocalyptic album art, scorched packaging | Deadly buffet tower on red special field |

Wave one is art-complete: every folder contains the 14 canonical vice badges plus
matching `vehicles/starter_front.png` and `vehicles/starter_back.png` views.

## Second production wave — art complete

Classic Rock, EDM, and Reggae already correspond to runtime radio stations.
Pop-Punk/Emo and Norteño are art-first expansion candidates and must not be treated
as wired stations until their music and station data are added.

| Folder | Culture direction | Proposed vehicle |
|---|---|---|
| `classic_rock` | Roadhouse excess, worn tour merch, vinyl, leather, chrome, 1970s arena swagger | Weathered muscle car |
| `edm_rave` | Festival neon, kandi, lasers, hydration packs, chrome holographic packaging | LED-wrapped supercar |
| `reggae` | Jamaican sound-system culture, roots colors, tropical roadside food, dub-speaker graphics | Vintage island van |
| `pop_punk_emo` | Mall food court, warped-tour nostalgia, checkerboard, band stickers, black eyeliner jokes | Sticker-bomb hatchback |
| `norteno` | Norteño dancehall, accordion/bajo sexto motifs, botas, chrome, border-road snacks | Customized lowered pickup |

Wave two is art-complete: every folder contains the same 14 canonical vice badges
and matching `vehicles/starter_front.png` and `vehicles/starter_back.png` views, with
the fixed blue/orange/yellow/red category signals used by wave one.

## Runtime follow-up

When the culture resolver is integrated, update `GameScene._pickupHaloColors()` to use
these same four signals. The current fallback mapping predates this spec and must not
be treated as authoritative for culture-pack art.
