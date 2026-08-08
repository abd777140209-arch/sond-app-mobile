/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Options } from 'html2canvas';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAndShareFile } from './fileExport';
import { Capacitor } from '@capacitor/core';

/**
 * Robustly removes oklch, color-mix, and light-dark functions from CSS text,
 * properly handling nested parentheses, custom properties, and color spaces.
 */
export function replaceColorFunctions(cssText: string, fallback = 'rgb(30, 41, 59)'): string {
  if (!cssText || typeof cssText !== 'string') return cssText;
  if (!/(oklch|color-mix|light-dark)/i.test(cssText)) return cssText;

  let text = cssText.replace(/in\s+oklch/gi, 'in srgb');

  const targets = ['oklch(', 'color-mix(', 'light-dark('];
  let hasMore = true;
  let safetyCounter = 0;

  while (hasMore && safetyCounter < 2000) {
    safetyCounter++;
    let foundIndex = -1;
    let foundTarget = '';

    for (const target of targets) {
      const idx = text.toLowerCase().indexOf(target);
      if (idx !== -1 && (foundIndex === -1 || idx < foundIndex)) {
        foundIndex = idx;
        foundTarget = target;
      }
    }

    if (foundIndex === -1) {
      hasMore = false;
      break;
    }

    // Find matching closing parenthesis considering nested parentheses
    let parenDepth = 0;
    let endIdx = -1;
    for (let i = foundIndex + foundTarget.length - 1; i < text.length; i++) {
      if (text[i] === '(') parenDepth++;
      else if (text[i] === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx !== -1) {
      text = text.substring(0, foundIndex) + fallback + text.substring(endIdx + 1);
    } else {
      text = text.substring(0, foundIndex) + fallback + text.substring(foundIndex + foundTarget.length);
    }
  }

  return text.replace(/oklch/gi, fallback);
}

function sanitizeElementStyles(el: HTMLElement, doc: Document) {
  if (!el || !el.style) return;

  // 1. Sanitize raw style attribute string
  const rawStyle = el.getAttribute('style');
  if (rawStyle && /(oklch|color-mix|light-dark)/i.test(rawStyle)) {
    el.setAttribute('style', replaceColorFunctions(rawStyle));
  }

  // 2. Sanitize explicit inline style properties
  try {
    for (let i = el.style.length - 1; i >= 0; i--) {
      const propName = el.style[i];
      const propVal = el.style.getPropertyValue(propName);
      if (propVal && /(oklch|color-mix|light-dark)/i.test(propVal)) {
        el.style.setProperty(propName, replaceColorFunctions(propVal));
      }
    }
  } catch (e) {
    // Ignore property error
  }

  // 3. Read computed styles and force safe inline values for key color properties
  try {
    const computed = doc.defaultView?.getComputedStyle(el) || window.getComputedStyle(el);
    if (computed) {
      const colorProps = [
        'color',
        'background-color',
        'border-top-color',
        'border-bottom-color',
        'border-left-color',
        'border-right-color',
        'outline-color',
        'fill',
        'stroke',
        'box-shadow',
        'text-shadow'
      ];
      colorProps.forEach((prop) => {
        const val = computed.getPropertyValue(prop);
        if (val && /(oklch|color-mix|light-dark)/i.test(val)) {
          el.style.setProperty(prop, replaceColorFunctions(val), 'important');
        }
      });
    }
  } catch (e) {
    // Ignore computed style error
  }
}

/**
 * Returns html2canvas configuration with complete sanitization for Tailwind CSS v4 OKLCH color functions
 * and modern CSS features that cause html2canvas parsing errors in mobile PDF rendering.
 */
export function getSafeHtml2CanvasOptions(customOptions: Partial<Options> = {}): Partial<Options> {
  const { onclone: userOnclone, ...restCustomOptions } = customOptions;

  return {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (clonedDoc: Document, element: HTMLElement) => {
      try {
        // 1. Sanitize all <style> elements in clonedDoc
        const styleElements = clonedDoc.querySelectorAll('style');
        styleElements.forEach((styleEl) => {
          if (styleEl.textContent) {
            styleEl.textContent = replaceColorFunctions(styleEl.textContent);
          }
          if (styleEl.innerHTML) {
            styleEl.innerHTML = replaceColorFunctions(styleEl.innerHTML);
          }
        });

        // 2. Sanitize all stylesheets in clonedDoc
        try {
          Array.from(clonedDoc.styleSheets).forEach((sheet) => {
            try {
              const rules = sheet.cssRules || sheet.rules;
              if (rules) {
                Array.from(rules).forEach((rule: any) => {
                  if (rule.cssText && /(oklch|color-mix|light-dark)/i.test(rule.cssText)) {
                    if (rule.style) {
                      for (let i = rule.style.length - 1; i >= 0; i--) {
                        const propName = rule.style[i];
                        const propVal = rule.style.getPropertyValue(propName);
                        if (propVal && /(oklch|color-mix|light-dark)/i.test(propVal)) {
                          rule.style.setProperty(propName, replaceColorFunctions(propVal));
                        }
                      }
                    }
                  }
                });
              }
            } catch (e) {
              // Ignore cross-origin stylesheet access errors
            }
          });
        } catch (e) {
          // Ignore stylesheet iteration error
        }

        // 3. Sanitize root element & body
        if (clonedDoc.documentElement) sanitizeElementStyles(clonedDoc.documentElement as HTMLElement, clonedDoc);
        if (clonedDoc.body) sanitizeElementStyles(clonedDoc.body as HTMLElement, clonedDoc);

        // 4. Sanitize all DOM nodes in clonedDoc
        const allClonedElements = clonedDoc.querySelectorAll('*');
        allClonedElements.forEach((node) => {
          sanitizeElementStyles(node as HTMLElement, clonedDoc);
        });

        // 5. Run custom user onclone if specified
        if (userOnclone) {
          userOnclone(clonedDoc, element);
        }

        // 6. Post-pass: Re-verify all cloned elements in case userOnclone introduced oklch
        allClonedElements.forEach((node) => {
          const el = node as HTMLElement;
          if (el.style) {
            for (let i = el.style.length - 1; i >= 0; i--) {
              const propName = el.style[i];
              const propVal = el.style.getPropertyValue(propName);
              if (propVal && /(oklch|color-mix|light-dark)/i.test(propVal)) {
                el.style.setProperty(propName, replaceColorFunctions(propVal));
              }
            }
          }
        });
      } catch (err) {
        console.warn('Error during html2canvas document clone sanitization:', err);
      }
    },
    ...restCustomOptions,
  };
}

/**
 * 📄 تصدير كائن jsPDF وحفظه/مشاركته بشكل آمن عبر Base64 بدون استخدام window.print() أو window.open()
 */
export async function saveJsPDFFile(pdf: jsPDF, fileName: string, title: string = 'مستند PDF'): Promise<boolean> {
  try {
    const dataUri = pdf.output('datauristring');
    return await saveAndShareFile({
      fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      data: dataUri,
      isBase64: true,
      mimeType: 'application/pdf',
      title,
      text: title
    });
  } catch (err) {
    console.error('Error saving jsPDF file:', err);
    return false;
  }
}

/**
 * 🖨️ تحويل عنصر HTML إلى PDF وتصديره/حفظه مباشرة متوافقاً مع Android WebView
 */
export async function exportElementToPDF(
  element: HTMLElement | null,
  fileName: string,
  title: string = 'تصدير PDF'
): Promise<boolean> {
  if (!element) {
    console.warn('exportElementToPDF: element is null');
    return false;
  }

  try {
    const safeOptions = getSafeHtml2CanvasOptions();
    const canvas = await html2canvas(element, safeOptions as Options);
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    return await saveJsPDFFile(pdf, fileName, title);
  } catch (err) {
    console.error('Error exporting element to PDF:', err);
    return false;
  }
}

/**
 * 📱 طباعة وتصدير مستند HTML بتحويله إلى ملف محلي أو Base64 يمر مباشرة عبر saveAndShareFile
 */
export async function printOrSavePDFHTML(
  htmlContent: string,
  fileName: string,
  title: string = 'طباعة مستند'
): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return await saveAndShareFile({
      fileName: fileName.endsWith('.html') || fileName.endsWith('.pdf') ? fileName : `${fileName}.html`,
      data: htmlContent,
      mimeType: fileName.endsWith('.pdf') ? 'application/pdf' : 'text/html',
      title,
      text: title
    });
  }

  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
      return true;
    }
  } catch (e) {
    console.warn('Window print fallback engaged:', e);
  }

  return await saveAndShareFile({
    fileName: fileName.endsWith('.html') ? fileName : `${fileName}.html`,
    data: htmlContent,
    mimeType: 'text/html',
    title,
    text: title
  });
}
