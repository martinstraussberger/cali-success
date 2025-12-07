export class SoundManager {
  constructor() { this.ctx = null; }
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this.ctx;
  }
  tone({ freq = 440, duration = 0.15, type = 'sine', gain = 0.08 }) {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }
  playWheelie() {
    this.tone({ freq: 280, duration: 0.06, type: 'square', gain: 0.06 });
    this.tone({ freq: 520, duration: 0.12, type: 'sawtooth', gain: 0.05 });
  }
  playSpeedcam() {
    this.tone({ freq: 920, duration: 0.05, type: 'triangle', gain: 0.06 });
    this.tone({ freq: 420, duration: 0.08, type: 'square', gain: 0.05 });
  }
}
