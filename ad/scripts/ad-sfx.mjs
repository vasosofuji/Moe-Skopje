// Run from ad/: node scripts/ad-sfx.mjs  ->  public/sfx/{whoosh,riser,boom,tick,pop}.wav
// Synthesised transition sounds for the ad (no downloads, deterministic). 48 kHz, 16-bit stereo.
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 48000;
const out = new URL("../public/sfx/", import.meta.url);
mkdirSync(out, { recursive: true });

let seed = 7;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;

// RBJ band-pass biquad, re-tuned every sample so the centre can sweep.
function bandpass(input, centreAt, q) {
  const y = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const w = (2 * Math.PI * centreAt(i / SR)) / SR, a = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + a;
    const v = ((a * input[i]) - (a * x2) + (2 * c * y1) - ((1 - a) * y2)) / a0;
    x2 = x1; x1 = input[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

function wav(name, L, R = L) {
  const peak = [L, R].reduce((m, ch) => ch.reduce((a, v) => Math.max(a, Math.abs(v)), m), 0) || 1;
  const g = 0.708 / peak; // normalise to -3 dBFS
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4);
  }
  writeFileSync(new URL(name, out), buf);
}

const len = (s) => Math.round(s * SR);
const env = (n, attack, release) => Float32Array.from({ length: n }, (_, i) => {
  const t = i / SR, T = n / SR;
  return Math.min(1, t / attack) * Math.min(1, (T - t) / release);
});

// Whoosh: noise through a band-pass sweeping up then down, panned left to right.
{
  const n = len(0.55), e = env(n, 0.28, 0.27), src = Float32Array.from({ length: n }, noise);
  const f = bandpass(src, (t) => 500 + 2600 * Math.sin(Math.PI * Math.min(1, t / 0.55)), 1.6);
  const L = f.map((v, i) => v * e[i] * Math.cos((i / n) * Math.PI / 2));
  const R = f.map((v, i) => v * e[i] * Math.sin((i / n) * Math.PI / 2));
  wav("whoosh.wav", L, R);
}

// Riser: filtered noise plus a rising tone, swelling into the cut and stopping dead on it.
{
  const n = len(1.4), src = Float32Array.from({ length: n }, noise);
  const f = bandpass(src, (t) => 300 + 2500 * (t / 1.4) ** 2, 2.2);
  let ph = 0;
  const L = f.map((v, i) => {
    const t = i / SR, k = (t / 1.4) ** 2.5;
    ph += (2 * Math.PI * (180 + 900 * (t / 1.4) ** 2)) / SR;
    return (v * 0.8 + Math.sin(ph) * 0.25) * k;
  });
  wav("riser.wav", L);
}

// Boom: pitch-dropping sine with a soft, low transient.
{
  const n = len(1.3);
  let ph = 0;
  const L = Float32Array.from({ length: n }, (_, i) => {
    const t = i / SR;
    ph += (2 * Math.PI * (45 + 50 * Math.exp(-t * 9))) / SR;
    return Math.sin(ph) * Math.exp(-t * 3.2) * Math.min(1, t / 0.004) + noise() * Math.exp(-t * 60) * 0.15;
  });
  wav("boom.wav", L);
}

// Tick: a short, bright UI tap.
{
  const n = len(0.05);
  const L = Float32Array.from({ length: n }, (_, i) => {
    const t = i / SR;
    return (Math.sin(2 * Math.PI * 2300 * t) * 0.7 + Math.sin(2 * Math.PI * 4600 * t) * 0.2) * Math.exp(-t * 110);
  });
  wav("tick.wav", L);
}

// Pop: a rounded downward blip for markers landing.
{
  const n = len(0.14);
  let ph = 0;
  const L = Float32Array.from({ length: n }, (_, i) => {
    const t = i / SR;
    ph += (2 * Math.PI * (300 + 500 * Math.exp(-t * 40))) / SR;
    return Math.sin(ph) * Math.exp(-t * 28) * Math.min(1, t / 0.002);
  });
  wav("pop.wav", L);
}

console.log("wrote whoosh, riser, boom, tick, pop to public/sfx/");
