/**
 * All sounds are synthesised with Web Audio: zero asset downloads, instant first play.
 * The context is created lazily on the first user gesture (browser autoplay rules).
 */

export type SoundName = 'aim' | 'cut' | 'tick' | 'perfect' | 'good' | 'meh' | 'bad' | 'out' | 'next' | 'best';

class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Call from a pointer/key handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.4);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || !this.master || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (name) {
      case 'aim':
        this.tone(2000, t, 0.02, 0.03, 'sine');
        break;
      case 'cut':
        this.hiss(t, 0.12, 6000, 0.32);
        this.tone(3000, t, 0.015, 0.08, 'triangle');
        this.tone(160, t, 0.07, 0.16, 'sine', 80);
        break;
      case 'tick':
        this.tone(1600, t, 0.008, 0.022, 'sine');
        break;
      case 'perfect':
        [988, 1319, 1976].forEach((f, i) => this.tone(f, t + i * 0.07, 0.32, 0.11, 'triangle'));
        break;
      case 'good':
        this.tone(740, t, 0.12, 0.09, 'triangle');
        this.tone(1109, t + 0.07, 0.18, 0.09, 'triangle');
        break;
      case 'meh':
        this.tone(587, t, 0.14, 0.07, 'sine');
        break;
      case 'bad':
        this.tone(220, t, 0.22, 0.13, 'sine', 140);
        break;
      case 'out':
        this.tone(180, t, 0.34, 0.18, 'sine', 70);
        this.hiss(t, 0.18, 1400, 0.06);
        break;
      case 'next':
        this.tone(900, t, 0.04, 0.035, 'sine', 1300);
        break;
      case 'best':
        [659, 880, 1109, 1319].forEach((f, i) => this.tone(f, t + i * 0.08, 0.34, 0.1, 'triangle'));
        break;
    }
  }

  private tone(freq: number, at: number, dur: number, vol: number, type: OscillatorType, slideTo?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private hiss(at: number, dur: number, cutoff: number, vol: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(at);
    src.stop(at + dur);
  }
}

export const sound = new SoundBoard();

export function vibrate(pattern: number | number[]): void {
  try {
    if (!sound.muted) navigator.vibrate?.(pattern);
  } catch {
    // Unsupported (iOS) or blocked — haptics are a bonus, never required.
  }
}
