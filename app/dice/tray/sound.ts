import type { DiceVoice } from "../looks";
import type { Rng } from "../rng";

/**
 * The dice's sounds, made on the spot with Web Audio rather than recordings: a knock is a short
 * burst of filtered noise with a ring in the set's voice (resin, metal, glass, bone), and rolling
 * along the table is a patter of tiny knocks, as many as the dice's speed calls for.
 */
export class DiceSound {
  private readonly context = new AudioContext();
  private readonly out: GainNode;
  private readonly noise: AudioBuffer;

  /** `rng` varies the noise and the patter; it's only sound, never a result. */
  constructor(
    volume: number,
    private readonly voice: DiceVoice,
    private readonly rng: Rng,
  ) {
    this.out = this.context.createGain();
    this.out.gain.value = volume;
    this.out.connect(this.context.destination);
    this.noise = this.context.createBuffer(1, this.context.sampleRate / 2, this.context.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = rng(2001) / 1000 - 1.001;
  }

  knock(strength: number, knockPitch: number) {
    const { context, voice } = this;
    const pitch = knockPitch * voice.pitch;
    const at = context.currentTime;
    const gain = 0.9 * strength;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.8 + strength * 0.4;
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = pitch;
    // Without a ring the knock is wider and duller, like bone.
    band.Q.value = voice.ring > 0 ? 3 : 1.5;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, at);
    envelope.gain.exponentialRampToValueAtTime(0.001, at + voice.knockFor);
    source.connect(band).connect(envelope).connect(this.out);
    source.start(at, this.rng(400) / 1000, voice.knockFor + 0.02);
    if (voice.ring <= 0) return;

    const ring = context.createOscillator();
    ring.type = voice.ringPitch > 1.2 ? "sine" : "triangle";
    ring.frequency.value = pitch * voice.ringPitch;
    const ringing = context.createGain();
    ringing.gain.setValueAtTime(gain * voice.ring, at);
    ringing.gain.exponentialRampToValueAtTime(0.001, at + voice.ringFor);
    ring.connect(ringing).connect(this.out);
    ring.start(at);
    ring.stop(at + voice.ringFor + 0.01);
  }

  /** One frame of rolling along the table, from 0 (still) to 1 (tumbling fast). */
  roll(speed: number) {
    if (speed < 0.05 || this.rng(100) > speed * 60) return;
    this.knock(0.06 + speed * 0.12, 600 + this.rng(500));
  }

  close() {
    void this.context.close();
  }
}
