#!/usr/bin/env python3
"""Generate radar-detector and weapon-use SFX with ElevenLabs."""

from pathlib import Path
import json
import os
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/audio/sound Effects"
ENDPOINT = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128"

EFFECTS = [
    ("police_scanner_dispatch_elevenlabs.mp3", .95,
     "Isolated police scanner dispatch alert for a driving video game: radio squelch opens, crisp high-low electronic dispatch chirp, very brief indistinct encrypted radio texture, then squelch closes. No intelligible speech, no siren, no music."),
    ("redneck_rage_horn_elevenlabs.mp3", 1.35,
     "Isolated outrageous vehicle horn for an arcade Road Rage power-up: a huge old American truck air horn blast with a rowdy two-note flourish, aggressive, triumphant and comedic, slight roadside echo. No engine, no voice, no music."),
    ("radar_detector_far_elevenlabs.mp3", .55,
     "Isolated premium radar detector alert for a driving video game: one clean electronic chirp, short bright beep with a tiny digital tail, calm low urgency. No voice, no engine, no music, no static."),
    ("radar_detector_near_elevenlabs.mp3", .65,
     "Isolated premium radar detector warning: two quick crisp electronic chirps, brighter and more urgent than a normal notification, realistic dashboard device, clean arcade readability. No voice, no engine, no music."),
    ("radar_detector_imminent_elevenlabs.mp3", .8,
     "Isolated radar detector imminent speed-trap alarm: rapid urgent triple electronic chirp, sharp high-frequency dashboard warning, intense but not painfully loud, clean video game cue. No voice, no engine, no music."),
    ("weapon_rolling_coal_elevenlabs.mp3", 1.35,
     "Isolated rolling-coal weapon sound for an arcade driving game: large tuned diesel engine suddenly floors the throttle, turbo spool, deep exhaust bark and a huge dirty soot-cloud belch, then settles. Powerful and comic, no horn, no voices, no music."),
    ("weapon_firework_launch_elevenlabs.mp3", .8,
     "Isolated bottle rocket launching from a moving car: fuse sputter, sharp ignition pop and fast rising pyrotechnic whistle into the sky. One launch, clean cinematic game Foley, no explosion yet, no voices, no music."),
    ("weapon_firework_boom_elevenlabs.mp3", 1.05,
     "Isolated large aerial firework detonation for an arcade action game: sharp report, deep cinematic boom, colorful shell burst implied and short spacious tail. Punchy one-shot, no launch whistle, no voices, no music."),
    ("weapon_firework_crackle_elevenlabs.mp3", 1.15,
     "Isolated aerial firework sparkle tail: dense bright cascading crackles and tiny fizzing pops that fade naturally, detailed game sound layer. No main boom, no launch, no voices, no music."),
    ("weapon_donuts_throw_elevenlabs.mp3", .8,
     "Playful isolated game Foley: a cardboard doughnut box whooshes out of a moving car, flaps briefly, then lands and slides on asphalt with a soft papery thump. No voices, no pig, no music."),
    ("weapon_donuts_pig_squeal_elevenlabs.mp3", 1.35,
     "Playful comedic pig reaction for an arcade driving game doughnut weapon: two excited cartoonish pig squeals and a happy snort, energetic and silly, not frightened, not hurt, no human speech, no music."),
    ("weapon_disguise_elevenlabs.mp3", 1.15,
     "Isolated stealth disguise activation for an arcade driving game: quick mechanical panels shifting, slick spy-gadget whoosh, electronic shimmer and a clean covert confirmation click. No voice, no alarm, no music."),
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


def generate(api_key, filename, duration, prompt):
    payload = json.dumps({
        "text": prompt,
        "duration_seconds": duration,
        "prompt_influence": .55,
        "loop": False,
        "model_id": "eleven_text_to_sound_v2",
    }).encode("utf-8")
    request = urllib.request.Request(ENDPOINT, data=payload, method="POST", headers={
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    })
    with urllib.request.urlopen(request, timeout=120) as response:
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
    generated = 0
    for index, effect in enumerate(EFFECTS, 1):
        filename = effect[0]
        if (OUT / filename).exists():
            print(f"[{index}/{len(EFFECTS)}] Keeping existing {filename}", flush=True)
            continue
        print(f"[{index}/{len(EFFECTS)}] Generating {filename}", flush=True)
        try:
            generate(api_key, *effect)
            generated += 1
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:500]
            raise SystemExit(f"ElevenLabs request failed ({error.code}) for {filename}: {detail}")
    print(f"Generated {generated} new gameplay effects in {OUT}")


if __name__ == "__main__":
    main()
