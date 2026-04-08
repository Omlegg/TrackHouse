import * as Tone from "tone";



let sampler: Tone.Sampler | null = null;
let samplerLoaded: Promise<void> | null = null;

export function getSampler() {
  if (!sampler) {
    sampler = new Tone.Sampler({
      urls: { C4: "piano.wav" },
      baseUrl: "/samples/",
    }).toDestination();
    samplerLoaded = Tone.loaded();
  }
  return sampler;
}

export async function ensureSamplerLoaded() {
  if (samplerLoaded) await samplerLoaded;
}

export async function initAudio() {
  await Tone.start();
  await Tone.loaded();
}

export function setBPM(bpm: number) {
  Tone.getTransport().bpm.value = bpm;
}