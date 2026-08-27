#!/usr/bin/env python3
"""Generate detailed V2 candidate layers for Road Trip Roulette SFX."""

from pathlib import Path
import json, os, urllib.request, urllib.error

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/audio/sound Effects/v2_candidates"
ENDPOINT = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128"

# filename, duration, prompt influence, prompt
EFFECTS = [
    ("crash_impact_body_take1.mp3", 1.35, .72,
     "Dry exterior recording six feet behind a heavy 1990s sedan. At 0.10s its front corner hits a concrete highway barrier at 60 mph: sharp steel bumper strike, deep chassis compression, hood buckling, quarter-panel crumpling, then three small metal bounces. Heavy real mass, tight roadside reflections and natural low-frequency body. No explosion, tires, horn, voices, siren, music, trailer braam or synthetic bass; minimal reverb."),
    ("crash_impact_body_take2.mp3", 1.35, .62,
     "Close dry-highway recording: a midsize steel car hits an immovable guardrail nearly head-on at high speed. Sequence: hard bumper crack, violent engine-bay collapse, roof and doors flex, then two dull settling knocks. Heavy and physical, never explosive; full-frequency production Foley with short natural outdoor reflection. No glass, tires, horn, people, sirens, music, whooshes or trailer impacts."),
    ("crash_glass_layer_take1.mp3", 1.25, .72,
     "Isolated dry automotive safety-glass layer. At 0.08s a laminated windshield fractures with a dense crunchy crack while one tempered side window bursts into small cubes. Fragments rain onto asphalt, dashboard plastic and sheet metal, then several bounce separately. Close exterior mic, crisp without clipping. No vehicle impact, explosion, tires, voices, music or artificial reverb."),
    ("pit_contact_take1.mp3", .95, .72,
     "Dry close exterior recording of a police sedan performing a PIT. At 0.12s its front bumper hits the target's left rear quarter: compact steel-and-plastic slam, bumper-cover crunch, 0.30s wheel-well scrape, suspension jolt, then separation. Medium force and believable weight; a glancing strike, not head-on. No siren, tires, glass, voices, music, explosion or trailer bass."),
    ("pit_contact_take2.mp3", .95, .64,
     "Isolated realistic PIT contact Foley from a roadside microphone ten feet away: police cruiser nose taps and drives into the rear quarter of a fleeing car, producing a sharp bumper thump, short body-panel crush, gritty metal scrape and one suspension rebound. Fast, forceful and controlled, less destructive than a major crash. Dry asphalt setting. No sirens, tires, engines, speech, music, artificial whoosh or cinematic boom."),
    ("pig_donuts_take1.mp3", 1.45, .76,
     "Clean close recording of a cheerful pig noticing food. After 0.12s silence: two short eager rising squeals, three quick excited snorts, then one soft satisfied grunt. Real pig with playful timing and natural texture; happy and curious, never frightened, hurt, angry or screaming. Dry quiet barn, almost no echo. No humans, birds, footsteps, instruments, music or ambience; clean silence at end."),
    ("pig_donuts_take2.mp3", 1.45, .64,
     "Isolated happy pig food reaction for a comedic driving game: one delighted oink, a rapid pair of high playful squeals, then rhythmic eager snuffling as the pig finds doughnuts. Realistic adult pig voice with expressive comic cadence, close microphone, dry and clean. Absolutely no pain, panic, aggression, human voice, cartoon music, bells, barn ambience or reverb."),
    ("coal_diesel_engine_take1.mp3", 1.55, .72,
     "Dry exterior recording one meter behind a tuned older diesel pickup. Rough low idle; at 0.15s throttle snaps fully open, turbo spools, torque rises, exhaust gives three deep irregular combustion barks and a huge dense soot belch, then RPM falls. Powerful mechanical diesel with real cylinder pulses, not a gasoline sports car. No tire spin, horn, voices, music, cinematic bass or artificial whoosh."),
    ("coal_exhaust_belch_layer.mp3", .9, .74,
     "Isolated diesel exhaust weapon layer: one enormous close tailpipe soot-cloud belch from an old tuned truck, beginning with a pressurized cough, followed by three low uneven exhaust pulses and a short turbulent air tail. Dirty, physical, percussive and comic but realistic. No engine rev bed, turbo, tire sound, horn, voices, music, explosion or trailer impact. Dry outdoor recording for layering."),
    ("radar_single_far_take1.mp3", .55, .78,
     "Isolated authentic premium automotive radar detector alert from a small dashboard speaker. Exactly one short 65 millisecond chirp: clean two-frequency electronic blip with a firm attack, slight plastic-speaker coloration and immediate decay. Calm early warning, lower pitch around 850 hertz, no second beep. Studio-dry close recording. No voice, static, engine, ambience, music or sci-fi sound."),
    ("radar_double_near_take1.mp3", .65, .78,
     "Isolated authentic dashboard radar detector warning. Exactly two crisp 55 millisecond electronic chirps separated by 90 milliseconds, around 1100 hertz, brighter and more urgent than an early warning. Tiny consumer-device speaker coloration, clean attack and decay, silence afterward. No third beep, voice, static, engine, ambience, music, alarm sweep or sci-fi effect."),
    ("radar_triple_imminent_take1.mp3", .8, .78,
     "Isolated radar detector imminent alert from a real dashboard device. Exactly three sharp 45 millisecond high electronic chirps with 55 millisecond gaps, increasing slightly in pitch and urgency, then clean silence. Small plastic speaker, strong readable transient without distortion or painful loudness. No fourth beep, voice, static, engine, music, siren or futuristic sound."),
    ("firework_launch_take1.mp3", .9, .72,
     "Isolated close bottle-rocket launch for sound editing. At 0.08 seconds a dry fuse sputters, then a sharp pyrotechnic ignition pop; pressurized propellant hisses as the rocket accelerates upward and produces a thin rising whistle that exits into the distance. Natural outdoor air, compact consumer firework, clear launch transient. No explosion, crowd, voices, music, repeated rockets or cinematic whoosh."),
    ("firework_boom_take1.mp3", 1.35, .70,
     "Single large aerial firework shell detonation heard outdoors from roughly 80 meters away. At 0.12 seconds a bright sharp chemical report arrives, immediately followed by a deep rounded air-pressure boom; the shell opens into many small crisp sparkling pops and a natural one-second open-sky decay. Real pyrotechnic scale, not a bomb. No launch whistle, crowd, voices, music, glass, debris or trailer braam."),
    ("firework_boom_take2.mp3", 1.35, .60,
     "Isolated professional display firework burst in open night sky: one sudden dry crack, broad low-frequency thump, then a wide spherical shower of delicate secondary crackles fading naturally. Microphone at safe medium distance, realistic outdoor delay and restrained echo. No rocket launch, crowd, speech, music, battlefield explosion, building debris or artificial cinematic sub-drop."),
    ("firework_mortar_break_close_take1.mp3", 1.8, .74,
     "One isolated large consumer firework mortar shell breaking overhead, microphone close beneath the display. At 0.10s: brutally sharp pyrotechnic crack and immediate chest-hitting concussive pressure wave, followed by a huge deep air boom and dense hot crackling stars. Loud, aggressive, physical and full-bandwidth; near-field outdoor perspective. No launch tube, crowd, voices, music, bomb debris, gunshot or distant muffling."),
    ("firework_mortar_break_close_take2.mp3", 1.8, .66,
     "Close overhead 3-inch aerial firework mortar detonation. Instant violent chemical report, hard low-frequency pressure slap, massive rounded boom, then dozens of bright secondary star cracks across the sky with a short natural outdoor tail. The listener is near the launch field, not far away. Extremely powerful but clean. No launch, crowd, speech, music, gunfire, collapsing objects or cinematic trailer sound."),
]


def load_env():
    for raw in (ROOT / ".env.local").read_text().splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def generate(key, filename, duration, influence, prompt):
    body = json.dumps({"text": prompt, "duration_seconds": duration,
                       "prompt_influence": influence, "loop": False,
                       "model_id": "eleven_text_to_sound_v2"}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=120) as response:
        audio = response.read()
    if len(audio) < 1000: raise RuntimeError(f"Small response for {filename}")
    (OUT / filename).write_bytes(audio)


def main():
    load_env(); key = os.getenv("ELEVENLABS_API_KEY", "")
    if not key: raise SystemExit("ELEVENLABS_API_KEY is missing")
    OUT.mkdir(parents=True, exist_ok=True)
    made = 0
    for i, effect in enumerate(EFFECTS, 1):
        filename = effect[0]
        if (OUT / filename).exists():
            print(f"[{i}/{len(EFFECTS)}] Keeping {filename}", flush=True); continue
        print(f"[{i}/{len(EFFECTS)}] Generating {filename}", flush=True)
        try: generate(key, *effect); made += 1
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:500]
            raise SystemExit(f"ElevenLabs failed ({error.code}) for {filename}: {detail}")
    print(f"Generated {made} V2 candidates in {OUT}")


if __name__ == "__main__": main()
