/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Interactive Web Audio API sound effect synthesizer for POS & Barcode operations
class SoundEffectsEngine {
  private audioCtx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Laser Barcode Scan Beep (high pitch crisp tone ~1300Hz)
   */
  playBarcodeBeepSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1300, ctx.currentTime);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio safety catch
    }
  }

  /**
   * Sale Success & Invoice Print Sound (Royal 3-tone arpeggio C5 -> E5 -> G5)
   */
  playSaleSuccessSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const startTime = ctx.currentTime + idx * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch {
      // Audio safety catch
    }
  }

  /**
   * Error / Warning / Out-of-Stock Alert Tone (Low double buzz ~180Hz)
   */
  playErrorWarningSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const playBuzz = (delay: number) => {
        const startTime = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, startTime);

        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.15);
      };

      playBuzz(0);
      playBuzz(0.18);
    } catch {
      // Audio safety catch
    }
  }
}

export const soundEffects = new SoundEffectsEngine();

// Convenience exports matching requested function names
export const playSaleSuccessSound = () => soundEffects.playSaleSuccessSound();
export const playBarcodeBeepSound = () => soundEffects.playBarcodeBeepSound();
export const playErrorWarningSound = () => soundEffects.playErrorWarningSound();
