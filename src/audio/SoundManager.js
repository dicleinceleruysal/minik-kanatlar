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
    // Soft percussive bump when colliding with an obstacle (warm thump, no harsh buzz)
    this.playTone(185, 0.16, 'triangle', 0.16, 0, 72);
    this.playTone(110, 0.2, 'sine', 0.14, 0.02, 52);
  }

  playCorrect() {
    this.playTone(523.25, 0.14, 'triangle', 0.14, 0);
    this.playTone(659.25, 0.14, 'triangle', 0.14, 0.09);
    this.playTone(783.99, 0.24, 'sine', 0.15, 0.18);
  }

  playWrong() {
    // Clean, playful double-tap wooden marimba "bop-bop" (clear mistake cue, kid-friendly)
    this.playTone(329.63, 0.11, 'sine', 0.14, 0);
    this.playTone(659.25, 0.05, 'triangle', 0.04, 0);
    this.playTone(246.94, 0.19, 'sine', 0.15, 0.12);
    this.playTone(493.88, 0.06, 'triangle', 0.04, 0.12);
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
