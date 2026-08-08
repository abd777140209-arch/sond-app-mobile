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
 * Robustly removes oklab, oklch, color-mix, and light-dark functions from CSS text
 */
export function replaceColorFunctions(cssText: string, fallback = 'rgb(30, 41, 59)'): string {
  if (!cssText || typeof cssText !== 'string') return cssText;
  if (!/(oklab|oklch|color-mix|light-dark)/i.test(cssText)) return cssText;

  let text = cssText.replace(/in\s+(oklch|oklab)/gi, 'in srgb');

  const targets = ['oklab(', 'oklch(', 'color-mix(', 'light-dark('];
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

  return text.replace(/(oklab|oklch)/gi, fallback);
}

function sanitizeElementStyles(el: HTMLElement, doc: Document) {
  if (!el || !el.style) return;

  const rawStyle = el.getAttribute('style');
  if (rawStyle && /(oklab|oklch|color-mix|light-dark)/i.test(rawStyle)) {
    el.setAttribute('style', replaceColorFunctions(rawStyle));
  }

  try {
    for (let i = el.style.length - 1; i >= 0; i--) {
      const propName = el.style[i];
      const propVal = el.style.getPropertyValue(propName);
      if (propVal && /(oklab|oklch|color-mix|light-dark)/i.test(propVal)) {
        el.style.setProperty(propName, replaceColorFunctions(propVal));
      }
    }
  } catch (e) {}

  try {
    const computed = doc.defaultView?.getComputedStyle(el) || window.getComputedStyle(el);
    if (computed) {
      if (computed.color && (computed.color.includes('oklab') || computed.color.includes('oklch'))) {
        el.style.color = '#000000';
      }
      if (computed.backgroundColor && (computed.backgroundColor.includes('oklab') || computed.backgroundColor.includes('oklch'))) {
        el.style.backgroundColor = '#ffffff';
      }
    }
  } catch (e) {}
}

export const getSafeHtml2CanvasOptions = (customOptions: any = {}): any => {
  return {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc: Document) => {
      // تنظيف شامل لأي ألوان oklch/oklab في العناصر المصورة لتفادي انهيار html2canvas
      const elements = clonedDoc.querySelectorAll('*');
      elements.forEach((el: any) => {
        if (el.style) {
          if (el.style.color) {
            el.style.color = el.style.color.replace(/oklch\([^)]+\)/g, '#000000').replace(/oklab\([^)]+\)/g, '#000000');
          }
          if (el.style.backgroundColor) {
            el.style.backgroundColor = el.style.backgroundColor.replace(/oklch\([^)]+\)/g, '#ffffff').replace(/oklab\([^)]+\)/g, '#ffffff');
          }
          if (el.style.borderColor) {
            el.style.borderColor = el.style.borderColor.replace(/oklch\([^)]+\)/g, '#cbd5e1').replace(/oklab\([^)]+\)/g, '#cbd5e1');
          }
          try {
            sanitizeElementStyles(el, clonedDoc);
          } catch (e) {}
        }
      });

      try {
        const styleElements = clonedDoc.querySelectorAll('style');
        styleElements.forEach((styleEl) => {
          if (styleEl.textContent) {
            styleEl.textContent = replaceColorFunctions(styleEl.textContent);
          }
        });
      } catch (e) {}

      if (customOptions.onclone) {
        customOptions.onclone(clonedDoc);
      }
    },
    ...customOptions
  };
};

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
