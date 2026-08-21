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
        // 1. Clean cloned document root to avoid any interface mode (desktop/mobile) distortions
        clonedDoc.documentElement.classList.remove('mode-desktop', 'mode-mobile');
        clonedDoc.body.classList.remove('mode-desktop', 'mode-mobile');
        clonedDoc.documentElement.style.width = 'auto';
        clonedDoc.body.style.width = 'auto';

        // 2. Sanitize all <style> tags to replace oklch(...) and color-mix(...) expressions with standard hex/rgb
        const styleElements = clonedDoc.querySelectorAll('style');
        styleElements.forEach((styleEl) => {
          if (styleEl.textContent) {
            styleEl.textContent = styleEl.textContent
              .replace(/oklch\([^)]+\)/gi, defaultFallbackColor)
              .replace(/color-mix\([^)]+\)/gi, defaultFallbackColor)
              .replace(/light-dark\([^)]+\)/gi, defaultFallbackColor);
          }
        });

        // 3. Process all elements in clonedDoc to strip oklch from inline styles and normalize export tables & Arabic text
        const allClonedElements = clonedDoc.querySelectorAll('*');
        allClonedElements.forEach((node) => {
          const el = node as HTMLElement;
          if (el.style) {
            // Guarantee Arabic cursive rendering is never disconnected by letterSpacing
            if (el.style.letterSpacing && el.style.letterSpacing !== 'normal') {
              el.style.letterSpacing = 'normal';
            }
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

        // 4. Ensure target element and all export tables in clonedDoc have full width and clean rendering
        if (element) {
          element.style.overflow = 'visible';
          element.style.boxSizing = 'border-box';
          const clonedTables = element.querySelectorAll('table');
          clonedTables.forEach(t => {
            t.style.display = 'table';
            t.style.width = '100%';
            t.style.borderCollapse = 'collapse';
          });
        }

        // 5. Run custom user onclone if specified
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
