#!/usr/bin/env python3
"""Generate Road Trip Roulette ending SFX with ElevenLabs.

Loads ELEVENLABS_API_KEY from .env.local without logging it. Existing procedural
WAV files are preserved; generated MP3 files use an `_elevenlabs` suffix.
"""

from pathlib import Path
import json
import os
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/audio/sound Effects"
ENDPOINT = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128"

EFFECTS = [
    ("busted_pit_impact_elevenlabs.mp3", 0.95, False,
     "Isolated video game sound effect: a police cruiser slams hard into the rear quarter panel of a moving car during a PIT maneuver. Violent low metal crunch, bumper impact, brief suspension slam and a tiny burst of glass. Close, dry, cinematic, no siren, no music, no voices."),
    ("busted_tire_spinout_elevenlabs.mp3", 2.35, False,
     "Isolated realistic tire sound effect: a car violently spins across dry asphalt after a PIT maneuver, long changing tire squeal, rubber chatter and sliding skid that decelerates to a stop. Close cinematic game audio, no crash impact, no engine, no music, no voices."),
    ("busted_police_sirens_elevenlabs.mp3", 4.8, True,
     "Seamless loop of several modern American police cruiser sirens surrounding a stopped vehicle, layered wail and yelp patterns at different distances, urgent but clean game-audio ambience. No speech, no music, no collision."),
    ("busted_cruiser_brake_elevenlabs.mp3", 1.05, False,
     "Isolated police cruiser aggressive braking arrival: quick tire chirp, brake scrub, suspension compression and a firm vehicle stop on asphalt. Cinematic game Foley, no siren, no crash, no voices, no music."),
    ("busted_radio_capture_elevenlabs.mp3", 1.55, False,
     "Short police radio confirmation texture with squelch opening, encrypted indistinct dispatch chatter that cannot be understood, static crackle, confirmation beeps, then squelch closing. No intelligible words, no music, isolated game sound effect."),
    ("busted_containment_rumble_elevenlabs.mp3", 1.2, False,
     "Short ominous cinematic containment rumble for a video game arrest: deep restrained sub-bass pressure, distant vehicle idle vibration, tense low impact tail. No music melody, no siren, no voices, no explosion."),
    ("busted_stamp_hit_elevenlabs.mp3", 0.9, False,
     "Heavy stylized BUSTED title stamp impact for an arcade driving game: massive low thud, hard metal stamp slam, short cinematic bass tail and subtle metallic ring. One-shot, punchy, no voice, no music."),
    ("crash_fatal_impact_elevenlabs.mp3", 1.15, False,
     "Isolated catastrophic car crash impact for a driving game: brutal high-speed collision, deep chassis crunch, folding sheet metal, safety glass burst and heavy bass shock, followed by a very short debris tail. Close cinematic perspective, no horn, no voices, no siren, no music."),
    ("crash_glass_debris_elevenlabs.mp3", 1.25, False,
     "Isolated automotive safety glass and crash debris shower: tempered windshield fragments bursting then raining onto asphalt with small metal pieces bouncing. Detailed close Foley, no main crash impact, no voices, no music."),
    ("crash_metal_scrape_elevenlabs.mp3", 1.55, False,
     "Isolated wrecked car scraping and grinding across asphalt and a steel guardrail while slowing down, harsh torn metal drag, sparks implied, ending in a small bodywork settle. No initial crash, no voices, no music."),
    ("crash_ear_ring_elevenlabs.mp3", 2.4, False,
     "Post-crash hearing effect: high ear-ringing tinnitus tone with muffled low room pressure and gradually returning air, disorienting but not painfully loud, smooth fade. No impact, no speech, no music."),
    ("crash_aftermath_rumble_elevenlabs.mp3", 1.8, False,
     "Quiet immediate car-wreck aftermath ambience: damaged engine ticking, faint steam hiss, settling metal creaks and low distant rumble. Intimate cinematic game sound, no fire, no sirens, no voices, no music."),
]


def load_env():
    path = ROOT / ".env.local"
    if path.exists():
        for raw in path.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def generate(api_key, filename, duration, loop, prompt):
    payload = json.dumps({
        "text": prompt,
        "duration_seconds": duration,
        "prompt_influence": 0.55,
        "loop": loop,
        "model_id": "eleven_text_to_sound_v2",
    }).encode("utf-8")
    req = urllib.request.Request(ENDPOINT, data=payload, method="POST", headers={
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    })
    with urllib.request.urlopen(req, timeout=120) as response:
        audio = response.read()
    if len(audio) < 1000:
        raise RuntimeError(f"Unexpectedly small response for {filename}")
    (OUT / filename).write_bytes(audio)


def main():
    load_env()
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    if not api_key:
        raise SystemExit("ELEVENLABS_API_KEY is missing")
    OUT.mkdir(parents=True, exist_ok=True)
    for index, effect in enumerate(EFFECTS, 1):
        filename = effect[0]
        # Preserve hand-downloaded takes and earlier successful generations.
        # A cue is covered by any file sharing its `_elevenlabs` stem, including
        # WAV alternatives and `_take1` / `_user` variants.
        stem = filename.rsplit(".", 1)[0]
        if any(OUT.glob(f"{stem}*")):
            print(f"[{index}/{len(EFFECTS)}] Keeping existing {stem} variant", flush=True)
            continue
        print(f"[{index}/{len(EFFECTS)}] Generating {filename}", flush=True)
        try:
            generate(api_key, *effect)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:500]
            raise SystemExit(f"ElevenLabs request failed ({error.code}) for {filename}: {detail}")
    print(f"Generated {len(EFFECTS)} ElevenLabs effects in {OUT}")


if __name__ == "__main__":
    main()
