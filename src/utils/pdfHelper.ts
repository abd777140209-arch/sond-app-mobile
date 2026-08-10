/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Options } from 'html2canvas';

/**
 * Returns html2canvas configuration with complete sanitization for Tailwind CSS v4 OKLCH color functions
 * and modern CSS features that cause html2canvas parsing errors in mobile PDF rendering.
 */
export function getSafeHtml2CanvasOptions(customOptions: Partial<Options> = {}): Partial<Options> {
  const defaultFallbackColor = '#1e293b';

  return {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (clonedDoc: Document, element: HTMLElement) => {
      try {
        // 1. Sanitize all <style> tags to replace oklch(...) and color-mix(...) expressions with standard hex/rgb
        const styleElements = clonedDoc.querySelectorAll('style');
        styleElements.forEach((styleEl) => {
          if (styleEl.textContent) {
            styleEl.textContent = styleEl.textContent
              .replace(/oklch\([^)]+\)/gi, defaultFallbackColor)
              .replace(/color-mix\([^)]+\)/gi, defaultFallbackColor)
              .replace(/light-dark\([^)]+\)/gi, defaultFallbackColor);
          }
        });

        // 2. Process all elements in clonedDoc to strip oklch from inline styles
        const allClonedElements = clonedDoc.querySelectorAll('*');
        allClonedElements.forEach((node) => {
          const el = node as HTMLElement;
          if (el.style) {
            for (let i = el.style.length - 1; i >= 0; i--) {
              const propName = el.style[i];
              const propVal = el.style.getPropertyValue(propName);
              if (propVal && (propVal.includes('oklch') || propVal.includes('color-mix') || propVal.includes('light-dark'))) {
                const safeVal = propVal
                  .replace(/oklch\([^)]+\)/gi, defaultFallbackColor)
                  .replace(/color-mix\([^)]+\)/gi, defaultFallbackColor)
                  .replace(/light-dark\([^)]+\)/gi, defaultFallbackColor);
                el.style.setProperty(propName, safeVal);
              }
            }
          }
        });

        // 3. Run custom user onclone if specified
        if (customOptions.onclone) {
          customOptions.onclone(clonedDoc, element);
        }
      } catch (err) {
        console.warn('Error during html2canvas document clone sanitization:', err);
      }
    },
    ...customOptions,
  };
}
