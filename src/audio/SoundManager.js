export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensureContext() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, duration, type = 'sine', gainVal = 0.14, delay = 0, slideTo = null) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playStar() {
    this.playTone(880, 0.12, 'sine', 0.12, 0);
    this.playTone(1318.5, 0.18, 'triangle', 0.11, 0.06);
  }

  playHit() {
    this.playTone(170, 0.28, 'sawtooth', 0.16, 0, 55);
    this.playTone(95, 0.32, 'square', 0.1, 0.03, 38);
  }

  playCorrect() {
    this.playTone(523.25, 0.14, 'triangle', 0.14, 0);
    this.playTone(659.25, 0.14, 'triangle', 0.14, 0.09);
    this.playTone(783.99, 0.24, 'sine', 0.15, 0.18);
  }

  playWrong() {
    this.playTone(300, 0.18, 'sawtooth', 0.12, 0, 210);
    this.playTone(210, 0.28, 'sawtooth', 0.12, 0.15, 130);
  }

  playUpgrade() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.playTone(n, 0.22, 'triangle', 0.13, i * 0.07);
    });
  }

  playLevelComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => {
      this.playTone(n, 0.28, 'sine', 0.14, i * 0.09);
    });
  }

  playBoost() {
    this.playTone(220, 0.22, 'sine', 0.08, 0, 460);
  }
}
