import { RARITIES, type Rarity } from "./styles";

/**
 * A pack's sounds, made with Web Audio like the dice's: a shimmer rising while it glows, then a
 * soft burst and a chime as it opens, with more notes the rarer the die. Browser only.
 */
export class PackSound {
  private readonly context = new AudioContext();
  private readonly out: GainNode;

  constructor(volume: number) {
    this.out = this.context.createGain();
    this.out.gain.value = volume * 0.5;
    this.out.connect(this.context.destination);
  }

  /** A rising shimmer, lasting `seconds`. */
  glow(seconds: number) {
    const { context } = this;
    const at = context.currentTime;
    for (const [from, to] of [
      [220, 660],
      [330, 990],
    ]) {
      const tone = context.createOscillator();
      tone.type = "sine";
      tone.frequency.setValueAtTime(from, at);
      tone.frequency.exponentialRampToValueAtTime(to, at + seconds);
      const level = context.createGain();
      level.gain.setValueAtTime(0.001, at);
      level.gain.exponentialRampToValueAtTime(0.12, at + seconds);
      level.gain.exponentialRampToValueAtTime(0.001, at + seconds + 0.15);
      tone.connect(level).connect(this.out);
      tone.start(at);
      tone.stop(at + seconds + 0.2);
    }
  }

  /** The pack opening, and a chime: one note for a common die, up to five for a legendary. */
  open(rarity: Rarity) {
    const { context } = this;
    const at = context.currentTime;
    // The burst: a quick sweep of noise.
    const noise = context.createBuffer(1, context.sampleRate / 4, context.sampleRate);
    const samples = noise.getChannelData(0);
    // Not random: a fixed rough wave is noisy enough for a quarter of a second, and repeatable.
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * i * 0.0007) * 0.8;
    const burst = context.createBufferSource();
    burst.buffer = noise;
    const band = context.createBiquadFilter();
    band.type = "highpass";
    band.frequency.setValueAtTime(400, at);
    band.frequency.exponentialRampToValueAtTime(4000, at + 0.25);
    const level = context.createGain();
    level.gain.setValueAtTime(0.4, at);
    level.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
    burst.connect(band).connect(level).connect(this.out);
    burst.start(at);

    // A major chord, broken upwards.
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5].slice(0, RARITIES.indexOf(rarity) + 1);
    notes.forEach((frequency, index) => {
      const start = at + 0.1 + index * 0.09;
      const tone = context.createOscillator();
      tone.type = "triangle";
      tone.frequency.value = frequency;
      const ring = context.createGain();
      ring.gain.setValueAtTime(0.2, start);
      ring.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
      tone.connect(ring).connect(this.out);
      tone.start(start);
      tone.stop(start + 1.25);
    });
  }

  close() {
    // Long enough for the chime to ring out.
    window.setTimeout(() => void this.context.close(), 2000);
  }
}
