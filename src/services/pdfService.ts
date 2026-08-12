/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { CAIRO_FONT_BASE64 } from './cairoFont';

export interface PDFData {
  title: string;
  customerName: string;
  phone?: string;
  date: string;
  totalAmount: string;
  items: Array<{ description: string; amount: string }>;
}

/**
 * دالة إعادة تشكيل وحساب سياق الحروف العربية (Arabic Reshaper)
 * تحول الحروف العربية إلى الأشكال المترابطة وتدعم اتجاه النص من اليمين إلى اليسار (RTL)
 */
export function reshapeArabic(text: string): string {
  if (!text) return '';

  const arabicMap: Record<string, number[]> = {
    'ا': [0xFE8D, 0xFE8E, 0xFE8D, 0xFE8E],
    'أ': [0xFE83, 0xFE84, 0xFE83, 0xFE84],
    'إ': [0xFE87, 0xFE88, 0xFE87, 0xFE88],
    'آ': [0xFE81, 0xFE82, 0xFE81, 0xFE82],
    'ب': [0xFE8F, 0xFE90, 0xFE91, 0xFE92],
    'ت': [0xFE93, 0xFE94, 0xFE95, 0xFE96],
    'ث': [0xFE97, 0xFE98, 0xFE99, 0xFE9A],
    'ج': [0xFE9B, 0xFE9C, 0xFE9D, 0xFE9E],
    'ح': [0xFE9F, 0xFEA0, 0xFEA1, 0xFEA2],
    'خ': [0xFEA3, 0xFEA4, 0xFEA5, 0xFEA6],
    'د': [0xFEA7, 0xFEA8, 0xFEA7, 0xFEA8],
    'ذ': [0xFEA9, 0xFEAA, 0xFEA9, 0xFEAA],
    'ر': [0xFEAB, 0xFEAC, 0xFEAB, 0xFEAC],
    'ز': [0xFEAD, 0xFEAE, 0xFEAD, 0xFEAE],
    'س': [0xFEAF, 0xFEB0, 0xFEB1, 0xFEB2],
    'ش': [0xFEB3, 0xFEB4, 0xFEB5, 0xFEB6],
    'ص': [0xFEB7, 0xFEB8, 0xFEB9, 0xFEBA],
    'ض': [0xFEBB, 0xFEBC, 0xFEBD, 0xFEBE],
    'ط': [0xFEBF, 0xFEC0, 0xFEC1, 0xFEC2],
    'ظ': [0xFEC3, 0xFEC4, 0xFEC5, 0xFEC6],
    'ع': [0xFEC7, 0xFEC8, 0xFEC9, 0xFECA],
    'غ': [0xFECB, 0xFECC, 0xFECD, 0xFECE],
    'ف': [0xFECF, 0xFED0, 0xFED1, 0xFED2],
    'ق': [0xFED3, 0xFED4, 0xFED5, 0xFED6],
    'ك': [0xFED7, 0xFED8, 0xFED9, 0xFEDA],
    'ل': [0xFEDB, 0xFEDC, 0xFEDD, 0xFEDE],
    'م': [0xFEDF, 0xFEE0, 0xFEE1, 0xFEE2],
    'ن': [0xFEE3, 0xFEE4, 0xFEE5, 0xFEE6],
    'ه': [0xFEE7, 0xFEE8, 0xFEE9, 0xFEEA],
    'و': [0xFEEB, 0xFEEC, 0xFEEB, 0xFEEC],
    'ي': [0xFEED, 0xFEEE, 0xFEEF, 0xFEF0],
    'ى': [0xFEEF, 0xFEF0, 0xFEEF, 0xFEF0],
    'ة': [0xFE93, 0xFE94, 0xFE93, 0xFE94],
    'ؤ': [0xFE85, 0xFE86, 0xFE85, 0xFE86],
    'ئ': [0xFE89, 0xFE8A, 0xFE8B, 0xFE8C],
    'ء': [0xFE80, 0xFE80, 0xFE80, 0xFE80]
  };

  const nonJoining = new Set(['ا', 'أ', 'إ', 'آ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ء', 'ة', 'ى']);

  let str = String(text || '');
  str = str.replace(/لا/g, '\uFEFB');
  str = str.replace(/لأ/g, '\uFEF7');
  str = str.replace(/لإ/g, '\uFEF9');
  str = str.replace(/لآ/g, '\uFEF5');

  const isArabicChar = (ch: string) =>
    !!arabicMap[ch] || (ch.charCodeAt(0) >= 0xFE70 && ch.charCodeAt(0) <= 0xFEFC);

  const chars = Array.from(str);
  const tokens: Array<{ isArabic: boolean; chars: string[] }> = [];
  let currentToken: { isArabic: boolean; chars: string[] } | null = null;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const isAr = isArabicChar(ch);
    if (!currentToken) {
      currentToken = { isArabic: isAr, chars: [ch] };
    } else if (currentToken.isArabic === isAr) {
      currentToken.chars.push(ch);
    } else {
      tokens.push(currentToken);
      currentToken = { isArabic: isAr, chars: [ch] };
    }
  }
  if (currentToken) tokens.push(currentToken);

  const processArabicWord = (wordChars: string[]) => {
    const shaped: string[] = [];
    for (let i = 0; i < wordChars.length; i++) {
      const ch = wordChars[i];
      const entry = arabicMap[ch];
      if (!entry) {
        shaped.push(ch);
        continue;
      }

      const prevCh = i > 0 ? wordChars[i - 1] : null;
      const nextCh = i < wordChars.length - 1 ? wordChars[i + 1] : null;

      const connectsPrev = prevCh && arabicMap[prevCh] && !nonJoining.has(prevCh);
      const connectsNext = nextCh && arabicMap[nextCh] && !nonJoining.has(ch);

      let formIndex = 0;
      if (connectsPrev && connectsNext) formIndex = 3;
      else if (connectsPrev && !connectsNext) formIndex = 1;
      else if (!connectsPrev && connectsNext) formIndex = 2;
      else formIndex = 0;

      shaped.push(String.fromCharCode(entry[formIndex]));
    }
    return shaped.reverse().join('');
  };

  const processed = tokens.map(t => {
    if (t.isArabic) {
      return processArabicWord(t.chars);
    } else {
      return t.chars.join('');
    }
  });

  return processed.reverse().join('');
}

let isPdfGenerating = false;

export const generateAndSharePDF = async (data: PDFData) => {
  if (isPdfGenerating) {
    console.log('[generateAndSharePDF] PDF generation in progress, skipping duplicate call.');
    return;
  }
  isPdfGenerating = true;

  try {
    // 1. إنشاء مستند PDF نصي خفيف وسريع مع دعم الخطوط العربية والاتجاه RTL
    const doc = new jsPDF();

    // 2. تسجيل وتضمين الخط العربي (Amiri / Cairo) بصيغة Base64 لحل مشكلة Font Encoding
    doc.addFileToVFS('Amiri-Regular.ttf', CAIRO_FONT_BASE64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');

    doc.addFileToVFS('Cairo-Regular.ttf', CAIRO_FONT_BASE64);
    doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');

    // 3. ضبط الخط الافتراضي للمستند ليكون الخط العربي المضاف 'Amiri'
    doc.setFont('Amiri');

    // 4. كتابة العنوان الرئيسي بحجم كبير في المنتصف
    doc.setFontSize(18);
    doc.text(reshapeArabic(data.title), 105, 20, { align: 'center' });

    // 5. كتابة تفاصيل العميل والبيانات محاذاة لليمين (RTL)
    doc.setFontSize(11);
    doc.text(reshapeArabic(`العميل: ${data.customerName}`), 195, 33, { align: 'right' });
    if (data.phone) {
      doc.text(reshapeArabic(`الهاتف: ${data.phone}`), 195, 40, { align: 'right' });
    }
    doc.text(reshapeArabic(`التاريخ: ${data.date}`), 195, data.phone ? 47 : 40, { align: 'right' });

    const lineY = data.phone ? 53 : 46;
    doc.line(15, lineY, 195, lineY);

    // 6. ترويسة جدول الأصناف
    let yPosition = lineY + 8;
    doc.setFontSize(12);
    doc.text(reshapeArabic('البيان / تفاصيل الأصناف'), 195, yPosition, { align: 'right' });
    doc.text(reshapeArabic('المبلغ / القيمة'), 15, yPosition, { align: 'left' });
    doc.line(15, yPosition + 3, 195, yPosition + 3);

    // 7. إدراج عناصر الجدول
    yPosition += 10;
    doc.setFontSize(10);
    data.items.forEach(item => {
      // منع الخروج عن الصفحة
      if (yPosition > 270) {
        doc.addPage();
        doc.setFont('Amiri');
        yPosition = 20;
      }
      doc.text(reshapeArabic(item.description), 195, yPosition, { align: 'right' });
      doc.text(reshapeArabic(item.amount), 15, yPosition, { align: 'left' });
      yPosition += 8;
    });

    // 8. إجمالي المبلغ الخاتمة
    doc.line(15, yPosition, 195, yPosition);
    yPosition += 9;
    doc.setFontSize(13);
    doc.text(reshapeArabic(`الإجمالي الكلي: ${data.totalAmount}`), 195, yPosition, { align: 'right' });

    // 9. التصدير والمشاركة حسب المنصة (Capacitor Native vs Web Browser)
    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `Sanad_${Date.now()}.pdf`;

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });

      await Share.share({
        title: data.title,
        url: savedFile.uri
      });
    } else {
      const cleanFileName = (data.title || 'تقرير_سند').replace(/[^\w\u0600-\u06FF]/g, '_');
      doc.save(`${cleanFileName}_${Date.now()}.pdf`);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
  } finally {
    setTimeout(() => {
      isPdfGenerating = false;
    }, 1000);
  }
};

