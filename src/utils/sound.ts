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
    } catch {
      // Safe silent catch on unsupported devices
    }
  }

  playSuccessChime() {
    try {
      playSaleSuccessSound();
    } catch {
      // Safe silent catch
    }
  }

  playWarningBeep() {
    try {
      playErrorWarningSound();
    } catch {
      // Safe silent catch
    }
  }
}

export const soundManager = new DesktopSoundManager();

