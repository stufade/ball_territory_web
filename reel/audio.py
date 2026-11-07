"""Звук рилса: эффекты по событиям боя из audio.json, бит, два голоса. Склеивает со звуком видео.

python3 reel/audio.py out/reel-audio.json out/reel-video.mp4 out/reel.mp4
"""
import json
import math
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

SR = 22050
HERE = Path(__file__).resolve().parent
VOICES = {"choose": HERE / "voice-choose.wav", "which": HERE / "voice-which.wav"}
rng = np.random.default_rng(7)


def tt(d):
    return np.arange(int(SR * d)) / SR


def sine(f0, f1, d, v, decay=8.0, kind="sine"):
    x = tt(d)
    ph = np.cumsum(np.linspace(f0, f1, len(x))) / SR * math.tau
    w = np.sin(ph) if kind == "sine" else np.sign(np.sin(ph)) * .6 if kind == "square" else (2 / math.pi) * np.arcsin(np.sin(ph))
    return w * np.exp(-x * decay) * v


def noise(d, v, decay=10.0, lp=6, swell=False):
    x = tt(d)
    n = rng.normal(0, 1, len(x)).astype(np.float32)
    if lp > 1:
        n = np.convolve(n, np.ones(lp) / lp, mode="same")
    env = np.exp(-x * decay)
    if swell:
        env = np.minimum(1, x * 8) * np.exp(-x * 3)
    return n * env * v


def add(*ws):
    n = max(len(w) for w in ws)
    out = np.zeros(n, dtype=np.float32)
    for w in ws:
        out[:len(w)] += w
    return out


def chord(fs, gap, v, d=.3):
    out = np.zeros(int(SR * (d + gap * len(fs))), dtype=np.float32)
    for i, f in enumerate(fs):
        w = sine(f, f, d, v, 9)
        out[int(i * gap * SR):int(i * gap * SR) + len(w)] += w
    return out


def sound(kind, d):
    k = kind
    if k == "rx":
        r = d.get("k", "")
        if r in ("WILDFIRE", "FIRESTORM"):
            return add(noise(.9, .75, 3, 14, True), sine(90, 220, .9, .35, 3))
        if r in ("STEAM", "SANDSTORM", "TOXIC STORM", "PURIFY", "SPLASH"):
            return noise(.8, .55, 3, 1, True)
        if r in ("SHATTER", "AVALANCHE", "CRACK"):
            out = noise(.25, .4, 16, 1)
            for i in range(7):
                f = float(rng.uniform(1800, 3600))
                w = sine(f, f, .16, .18, 26)
                o = int(i * .025 * SR)
                out = np.pad(out, (0, max(0, o + len(w) - len(out))))
                out[o:o + len(w)] += w
            return out
        if r in ("BLAST", "BOOM", "EXPLOSION", "DETONATE", "DUNK"):
            return add(sine(130, 36, .8, .95, 4), noise(.6, .6, 6, 12))
        if r == "CHAIN":
            x = tt(.6)
            return (np.sign(np.sin(x * math.tau * 130)) * .3 + noise(.6, .3, 1, 1)) * np.exp(-x * 4)
        if r in ("PRISM", "GEODE", "GLASS", "FROST", "MIRROR", "FREEZE FRAME"):
            return chord((1319, 1568, 1976, 2637), .04, .2)
        return chord((523, 659, 784, 1047), .06, .2)
    if k == "power":
        f = 220 + (d.get("e", 0) * 37) % 600
        return add(sine(f, f * 2.2, .3, .3, 6), noise(.25, .1, 8, 3))
    if k == "hit":
        return add(noise(.07, .35, 40), sine(200, 90, .1, .35, 26))
    if k == "ko":
        return sine(160, 45, .45, .7, 6)
    if k == "six":
        f = 392 if d.get("word") == "SIX" else 523 if d.get("word") == "SEVEN" else 260
        return add(sine(f, f, .2, .35, 8, "square"), sine(80, 40, .15, .5, 10))
    if k == "sonic":
        return noise(.6, .4, 4, 3)
    if k == "slowtime":
        return add(sine(600, 110, 1.3, .45, 1.5), chord((988, 784, 659), .25, .12, .5))
    if k == "gas":
        return noise(1.1, .45, 2, 30, True)
    if k == "kaboom":
        return sound("rx", {"k": "BOOM"}) * 1.2
    if k == "glitch":
        out = np.zeros(int(SR * .4), dtype=np.float32)
        for i in range(6):
            w = sine(float(rng.uniform(200, 2000)), float(rng.uniform(200, 2000)), .05, .25, 10, "square")
            out[int(i * .05 * SR):int(i * .05 * SR) + len(w)] += w
        return out
    if k in ("rush", "balance", "itsme", "bubbles"):
        return chord((784, 988, 1175, 1568), .05, .16)
    if k == "pop":
        return sine(500, 900, .08, .25, 20)
    if k == "redirect":
        return sine(900, 1500, .1, .35, 18)
    if k == "prompt":
        return chord((660, 990), .12, .25, .15)
    if k == "launch":
        return sine(300, 1100, .35, .45, 6)
    if k == "hop":
        return sine(1500, 1500, .05, .25, 60)
    if k == "ding":
        return chord((523, 659, 784, 1047), .0, .14, 1.0)
    if k == "whoosh":
        x = tt(.35)
        return noise(.35, .5, 0, 8) * np.sin(np.pi * x / x[-1])
    if k == "win":
        return chord((392, 494, 587, 784), .0, .16, 1.8)
    return None


def beat(dur, start, bpm=124):
    buf = np.zeros(int(SR * (dur + 1)), dtype=np.float32)
    b = 60 / bpm
    x = np.arange(int(SR * .35)) / SR
    kick = np.sin(np.cumsum(np.linspace(110, 42, len(x))) / SR * math.tau) * np.exp(-x * 9) * .9
    xh = np.arange(int(SR * .05)) / SR
    hat = rng.normal(0, 1, len(xh)).astype(np.float32)
    hat = (hat - np.convolve(hat, np.ones(4) / 4, mode="same")) * np.exp(-xh * 70) * .25
    clap = noise(.2, .3, 25, 1)
    notes = [55, 55, 65.4, 49]
    t, i = start, 0
    while t < dur:
        for w, at in ((kick, t), (hat, t + b / 2)) + (((clap, t),) if i % 2 else ()):
            s = int(at * SR)
            buf[s:s + len(w)] += w[:max(0, len(buf) - s)]
        if i % 2 == 0:
            xb = np.arange(int(SR * b * 1.9)) / SR
            w = np.sign(np.sin(xb * notes[(i // 8) % 4] * math.tau)) * np.exp(-xb * 3) * .12
            s = int(t * SR)
            buf[s:s + len(w)] += w[:max(0, len(buf) - s)]
        t += b
        i += 1
    return buf[:int(SR * dur)]


def load_voice(path):
    with wave.open(str(path)) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    n = int(len(x) * SR / sr)
    v = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)
    return v / (np.abs(v).max() + 1e-6) * 1.05


def main():
    data = json.load(open(sys.argv[1]))
    dur = data["frames"] / 30
    fx = np.zeros(int(SR * (dur + 2)), dtype=np.float32)
    last = {}
    voices = []
    game_start = None
    for e in data["events"]:
        k, t = e["kind"], e["t"]
        if k == "voice":
            voices.append((t, e["d"]["name"]))
            continue
        if k == "launch":
            game_start = t
        if k in ("hit", "bump", "wall", "ready", "tap", "spawn", "cut") and t - last.get(k, -9) < .12:
            continue
        last[k] = t
        w = sound(k, e.get("d") or {})
        if w is None:
            continue
        s = int(t * SR)
        fx[s:s + len(w)] += w[:max(0, len(fx) - s)] * .8
    fx = fx[:int(SR * dur)]
    music = beat(dur, (game_start or 3.8) - .05) * .5
    for t, name in voices:
        v = load_voice(VOICES[name])
        s = int((t + .1) * SR)
        music[max(0, s - int(.05 * SR)):s + len(v) + int(.2 * SR)] *= .35
        fx[s:s + len(v)] += v[:max(0, len(fx) - s)]
    mix = np.tanh((fx + music) * 1.1) * .95
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    with wave.open(tmp.name, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32000).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", sys.argv[2], "-i", tmp.name, "-c:v", "copy", "-c:a", "aac",
                    "-b:a", "160k", "-shortest", "-movflags", "+faststart", sys.argv[3]], check=True)
    Path(tmp.name).unlink()
    print("готово", sys.argv[3], f"{dur:.1f} с")


if __name__ == "__main__":
    main()
