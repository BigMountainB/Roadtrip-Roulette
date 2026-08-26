#!/usr/bin/env python3
"""Generate original, procedural sound effects for the BUSTED PIT cinematic."""

from pathlib import Path
import wave
import numpy as np

SR = 48_000
OUT = Path(__file__).resolve().parents[1] / "public/assets/audio/sound Effects"
RNG = np.random.default_rng(20260826)


def env(n, attack=0.005, release=0.15):
    a = max(1, int(attack * SR)); r = max(1, int(release * SR))
    e = np.ones(n)
    e[:min(a, n)] = np.linspace(0, 1, min(a, n))
    if r < n: e[-r:] *= np.linspace(1, 0, r)
    else: e *= np.linspace(1, 0, n)
    return e


def lowpass(x, cutoff):
    alpha = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc); y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def pan(mono, pos=0.0):
    pos = np.clip(pos, -1, 1)
    return np.column_stack((mono * np.sqrt((1-pos)/2), mono * np.sqrt((1+pos)/2)))


def tone(duration, freq, amp=1.0, sweep=0.0, phase=0.0):
    t = np.arange(int(duration * SR)) / SR
    ph = 2*np.pi*(freq*t + 0.5*sweep*t*t) + phase
    return amp * np.sin(ph)


def add(dst, src, start=0.0):
    i = int(start * SR); n = min(len(src), len(dst)-i)
    if n > 0: dst[i:i+n] += src[:n]


def save(name, stereo):
    peak = max(1.0, np.max(np.abs(stereo)) / 0.94)
    pcm = np.int16(np.clip(stereo / peak, -1, 1) * 32767)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / name), "wb") as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())


def pit_impact():
    d=.95; n=int(d*SR); x=np.zeros(n)
    add(x, tone(.42, 72, .95, -95)*env(int(.42*SR), .001, .32))
    metal=highpass(RNG.normal(0,1,int(.48*SR)),700)*np.exp(-np.arange(int(.48*SR))/(SR*.12))
    add(x, metal*.50)
    for st,f in [(0.01,913),(0.025,1327),(0.055,1870)]:
        z=tone(.30,f,.16,-f*1.2)*np.exp(-np.arange(int(.30*SR))/(SR*.075)); add(x,z,st)
    scrape=highpass(RNG.normal(0,1,int(.52*SR)),1800)*env(int(.52*SR),.02,.2)*.13
    add(x,scrape,.18)
    save("busted_pit_impact.wav", pan(x,-.28))


def tire_spinout():
    d=2.35; n=int(d*SR); t=np.arange(n)/SR
    noise=highpass(RNG.normal(0,1,n),1100)
    squeal=np.sin(2*np.pi*(1180*t+90*np.sin(2*np.pi*2.2*t)*t))
    body=(noise*.19+squeal*.21)*env(n,.04,.38)*(1-.18*t/d)
    body*=.82+.18*np.sin(2*np.pi*11*t)
    stereo=pan(body,0)
    stereo[:,0]*=.84+.16*np.sin(2*np.pi*.55*t)
    stereo[:,1]*=.84+.16*np.sin(2*np.pi*.55*t+np.pi)
    save("busted_tire_spinout.wav",stereo)


def siren_loop():
    d=4.8; n=int(d*SR); t=np.arange(n)/SR
    phase=2*np.pi*(735*t + 145/(2*np.pi*.82)*(1-np.cos(2*np.pi*.82*t)))
    a=np.sin(phase)+.24*np.sin(2*phase)
    phase2=2*np.pi*(620*t + 110/(2*np.pi*.67)*(1-np.cos(2*np.pi*.67*t+1.4)))
    b=np.sin(phase2)+.18*np.sin(2*phase2)
    pulse=.72+.28*np.sin(2*np.pi*1.7*t)**2
    s=pan(a*.25*pulse,-.52)+pan(b*.22*pulse,.55)
    s*=env(n,.04,.28)[:,None]
    save("busted_police_sirens.wav",s)


def cruiser_brake():
    d=1.05; n=int(d*SR); t=np.arange(n)/SR
    squeal=tone(d,1450,.23,-620)*env(n,.015,.22)
    grit=highpass(RNG.normal(0,1,n),900)*.13*env(n,.01,.25)
    thud=tone(.22,85,.45,-180)*env(int(.22*SR),.002,.18)
    x=squeal+grit; add(x,thud,.68)
    save("busted_cruiser_brake.wav",pan(x,.35))


def radio_capture():
    d=1.55; n=int(d*SR); x=np.zeros(n)
    static=highpass(RNG.normal(0,1,n),1500)*.09
    gate=np.zeros(n)
    for a,b in [(.0,.16),(.27,.44),(.55,.88),(1.03,1.31),(1.40,1.53)]: gate[int(a*SR):int(b*SR)]=1
    x+=static*gate
    for st,f,dur in [(.18,1220,.07),(.46,980,.06),(.91,1380,.075),(1.32,860,.06)]:
        add(x,tone(dur,f,.22)*env(int(dur*SR),.003,.025),st)
    save("busted_radio_capture.wav",pan(x,-.12))


def stamp():
    d=.90; n=int(d*SR); x=np.zeros(n)
    boom=tone(.7,58,.9,-42)*np.exp(-np.arange(int(.7*SR))/(SR*.19)); add(x,boom)
    hit=lowpass(RNG.normal(0,1,int(.22*SR)),450)*env(int(.22*SR),.001,.16)*.65; add(x,hit)
    clang=tone(.48,410,.25,-260)*np.exp(-np.arange(int(.48*SR))/(SR*.13)); add(x,clang,.025)
    save("busted_stamp_hit.wav",pan(x,0))


def containment():
    d=1.2; n=int(d*SR); t=np.arange(n)/SR
    x=tone(d,46,.42,-18)*env(n,.01,.5)
    x+=lowpass(RNG.normal(0,1,n),180)*.18*env(n,.005,.6)
    save("busted_containment_rumble.wav",pan(x,0))


def crash_fatal_impact():
    d=1.15; n=int(d*SR); x=np.zeros(n)
    add(x,tone(.58,66,1.0,-82)*env(int(.58*SR),.001,.44))
    crush=lowpass(RNG.normal(0,1,int(.72*SR)),1450)*np.exp(-np.arange(int(.72*SR))/(SR*.20))*.68
    add(x,crush)
    glass=highpass(RNG.normal(0,1,int(.62*SR)),3100)*np.exp(-np.arange(int(.62*SR))/(SR*.23))*.18
    add(x,glass,.035)
    for st,f in [(.0,780),(.018,1160),(.045,1710),(.09,2280)]:
        ring=tone(.48,f,.15,-f*.9)*np.exp(-np.arange(int(.48*SR))/(SR*.10)); add(x,ring,st)
    save("crash_fatal_impact.wav",pan(x,-.10))


def crash_glass_debris():
    d=1.25; n=int(d*SR); x=np.zeros(n)
    for _ in range(34):
        st=RNG.uniform(0,.82); dur=RNG.uniform(.035,.16); f=RNG.uniform(1800,6200)
        shard=tone(dur,f,RNG.uniform(.025,.10),-RNG.uniform(1200,5200))*env(int(dur*SR),.001,dur*.72)
        add(x,shard,st)
    x += highpass(RNG.normal(0,1,n),3800)*np.exp(-np.arange(n)/(SR*.35))*.055
    save("crash_glass_debris.wav",pan(x,.18))


def crash_metal_scrape():
    d=1.55; n=int(d*SR); t=np.arange(n)/SR
    grit=highpass(RNG.normal(0,1,n),650)*.20
    groan=np.sin(2*np.pi*(310*t-105*t*t))*.18
    mod=.55+.45*np.sin(2*np.pi*(7.5-2*t)*t)**2
    x=(grit+groan)*mod*env(n,.015,.48)
    save("crash_metal_scrape.wav",pan(x,.35))


def crash_ear_ring():
    d=2.4; n=int(d*SR); t=np.arange(n)/SR
    ring=(np.sin(2*np.pi*2860*t)+.28*np.sin(2*np.pi*5723*t))*np.exp(-t/1.25)*.19
    hush=lowpass(RNG.normal(0,1,n),520)*np.exp(-t/.9)*.035
    save("crash_ear_ring.wav",pan(ring+hush,0))


def crash_aftermath():
    d=1.8; n=int(d*SR); t=np.arange(n)/SR
    rumble=lowpass(RNG.normal(0,1,n),120)*.13*np.exp(-t/.95)
    hiss=highpass(RNG.normal(0,1,n),1800)*.025*env(n,.25,.5)
    tick=np.zeros(n)
    for st in [.42,.83,1.28]:
        z=tone(.12,RNG.uniform(520,920),.07,-RNG.uniform(900,1800))*env(int(.12*SR),.001,.09); add(tick,z,st)
    save("crash_aftermath_rumble.wav",pan(rumble+hiss+tick,0))


if __name__ == "__main__":
    pit_impact(); tire_spinout(); siren_loop(); cruiser_brake()
    radio_capture(); containment(); stamp()
    crash_fatal_impact(); crash_glass_debris(); crash_metal_scrape(); crash_ear_ring(); crash_aftermath()
    print(f"Generated 12 original WAV files in {OUT}")
