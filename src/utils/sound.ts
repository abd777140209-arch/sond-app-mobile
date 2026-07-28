/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { playBarcodeBeepSound, playSaleSuccessSound, playErrorWarningSound } from './soundEffects';

// Native Web Audio API sound synthesizer for interactive desktop feedback
class DesktopSoundManager {
  playScanBeep() {
    playBarcodeBeepSound();
  }

  playSuccessChime() {
    playSaleSuccessSound();
  }

  playWarningBeep() {
    playErrorWarningSound();
  }
}

export const soundManager = new DesktopSoundManager();

