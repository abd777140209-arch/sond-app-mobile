/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { playBarcodeBeepSound, playSaleSuccessSound, playErrorWarningSound } from './soundEffects';

// Native Web Audio API sound synthesizer for interactive web & mobile feedback
class DesktopSoundManager {
  playScanBeep() {
    try {
      playBarcodeBeepSound();
    } catch (e) {
      console.warn('Audio playScanBeep warning:', e);
    }
  }

  playSuccessChime() {
    try {
      playSaleSuccessSound();
    } catch (e) {
      console.warn('Audio playSuccessChime warning:', e);
    }
  }

  playWarningBeep() {
    try {
      playErrorWarningSound();
    } catch (e) {
      console.warn('Audio playWarningBeep warning:', e);
    }
  }
}

export const soundManager = new DesktopSoundManager();

