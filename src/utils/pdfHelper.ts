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
export function replaceColorFunctions(cssText: string, fallback = '#1e293b'): string {
  if (!cssText || typeof cssText !== 'string') return cssText;
  if (!/(oklab|oklch|color-mix|light-dark)/i.test(cssText)) return cssText;

  let text = cssText
    .replace(/@import\s+url\([^)]+\);?/gi, '')
    .replace(/in\s+(oklch|oklab)/gi, 'in srgb')
    .replace(/oklch\([^)]+\)/gi, fallback)
    .replace(/oklab\([^)]+\)/gi, fallback)
    .replace(/color-mix\([^)]+\)/gi, fallback)
    .replace(/light-dark\([^)]+\)/gi, fallback);

  return text;
}

function sanitizeElementStyles(el: HTMLElement, doc: Document) {
  if (!el || !el.style) return;

  const rawStyle = el.getAttribute('style');
  if (rawStyle && /(oklab|oklch|color-mix|light-dark)/i.test(rawStyle)) {
    el.setAttribute('style', replaceColorFunctions(rawStyle));
  }

  try {
    const computed = doc.defaultView?.getComputedStyle(el) || window.getComputedStyle(el);
    if (computed) {
      if (computed.color && /(oklab|oklch)/i.test(computed.color)) {
        el.style.color = '#0f172a';
      }
      if (computed.backgroundColor && /(oklab|oklch)/i.test(computed.backgroundColor)) {
        el.style.backgroundColor = '#ffffff';
      }
      if (computed.borderColor && /(oklab|oklch)/i.test(computed.borderColor)) {
        el.style.borderColor = '#cbd5e1';
      }
    }
  } catch (e) {}

  try {
    for (let i = el.style.length - 1; i >= 0; i--) {
      const propName = el.style[i];
      const propVal = el.style.getPropertyValue(propName);
      if (propVal && /(oklab|oklch|color-mix|light-dark)/i.test(propVal)) {
        el.style.setProperty(propName, replaceColorFunctions(propVal));
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
      // 1. تنظيف استدعاءات الخطوط والأوراق النمطية الخارجية لمنع أخطاء الأوفلاين
      try {
        const styleElements = clonedDoc.querySelectorAll('style');
        styleElements.forEach((styleEl) => {
          if (styleEl.textContent) {
            styleEl.textContent = replaceColorFunctions(styleEl.textContent);
          }
        });
      } catch (e) {}

      // 2. تنظيف شامل لكل ألوان oklch/oklab بالقص والعناصر المصورة لمنع انهيار html2canvas
      const elements = clonedDoc.querySelectorAll('*');
      elements.forEach((el: any) => {
        if (el.style) {
          if (el.style.color && /(oklch|oklab)/i.test(el.style.color)) {
            el.style.color = el.style.color.replace(/oklch\([^)]+\)/gi, '#0f172a').replace(/oklab\([^)]+\)/gi, '#0f172a');
          }
          if (el.style.backgroundColor && /(oklch|oklab)/i.test(el.style.backgroundColor)) {
            el.style.backgroundColor = el.style.backgroundColor.replace(/oklch\([^)]+\)/gi, '#ffffff').replace(/oklab\([^)]+\)/gi, '#ffffff');
          }
          if (el.style.borderColor && /(oklch|oklab)/i.test(el.style.borderColor)) {
            el.style.borderColor = el.style.borderColor.replace(/oklch\([^)]+\)/gi, '#cbd5e1').replace(/oklab\([^)]+\)/gi, '#cbd5e1');
          }
          try {
            sanitizeElementStyles(el, clonedDoc);
          } catch (e) {}
        }
      });

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
 * 📱 تحويل نصوص ومستندات HTML إلى ملف PDF حقيقي وعالي الجودة على أجهزة الهواتف والجوالات
 */
export async function convertHtmlStringToPDF(
  htmlContent: string,
  fileName: string,
  title: string = 'مستند PDF'
): Promise<boolean> {
  try {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.backgroundColor = '#ffffff';
    container.style.zIndex = '-9999';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    // تنظيف جميع ألوان oklch/oklab داخل عناصر الحاوية المقترحة
    const styleEls = container.querySelectorAll('style');
    styleEls.forEach((s) => {
      if (s.textContent) s.textContent = replaceColorFunctions(s.textContent);
    });

    const safeOptions = getSafeHtml2CanvasOptions();
    const canvas = await html2canvas(container, safeOptions as Options);
    
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    return await saveJsPDFFile(pdf, fileName, title);
  } catch (err) {
    console.error('Error converting HTML string to PDF:', err);
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

  // على أجهزة الجوال APK، نقوم دائماً بتحويل الـ HTML إلى PDF حقيقي لمنع مشاكل window.open/window.print
  if (isNative) {
    const pdfFileName = fileName.endsWith('.pdf') ? fileName : `${fileName.replace(/\.html$/i, '')}.pdf`;
    return await convertHtmlStringToPDF(htmlContent, pdfFileName, title);
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
