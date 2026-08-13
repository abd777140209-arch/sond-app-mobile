/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getSafeHtml2CanvasOptions } from '../utils/pdfHelper';

export interface PDFItem {
  description: string;
  quantity?: string | number;
  unitPrice?: string | number;
  amount: string;
}

export interface PDFData {
  title: string;
  storeName?: string;
  invoiceNumber?: string;
  customerName: string;
  phone?: string;
  date: string;
  paymentMethod?: string;
  totalAmount: string;
  subtotal?: string;
  discount?: string;
  tax?: string;
  notes?: string;
  items: PDFItem[];
}

/**
 * دالة مساعدة لضمان توافق واسترجاع النصوص بالترتيب الطبيعي.
 */
export function reshapeArabic(text: string | number | undefined | null): string {
  if (text === null || text === undefined) return '';
  return String(text).trim();
}

let isPdfGenerating = false;

/**
 * إنتاج وتصدير ملفات PDF احترافية بتنسيق راقٍ متناسق مع دعم كامل للغة العربية والاتجاه من اليمين لليسام دون أي انعكاس.
 */
export const generateAndSharePDF = async (data: PDFData) => {
  if (isPdfGenerating) {
    console.log('[generateAndSharePDF] PDF generation in progress, skipping duplicate call.');
    return;
  }
  isPdfGenerating = true;

  // 1. إنشاء عنصر HTML مؤقت وخفي لتنسيق الفاتورة بدقة المتصفح الأصلية RTL
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '794px'; // A4 width at 96 DPI
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  container.style.direction = 'rtl';
  container.style.padding = '32px';
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-9999';

  const storeTitle = data.storeName || 'القيصر للأجهزة الذكية والصيانة والبرمجة';
  const docTitle = data.title || 'فاتورة مبيعات';

  container.innerHTML = `
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 22px 28px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="text-align: right;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3;">
          ${storeTitle}
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
          نظام سند المحاسبي والتقني
        </p>
      </div>
      <div style="text-align: left; direction: ltr;">
        <div style="font-size: 19px; font-weight: 800; color: #34d399; direction: rtl; text-align: left;">
          ${docTitle}
        </div>
        ${data.invoiceNumber ? `
          <div style="font-size: 13px; color: #e2e8f0; margin-top: 4px; direction: rtl; text-align: left; font-weight: 600;">
            رقم: #${data.invoiceNumber}
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Info Grid Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 24px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 14px;">
      <div style="text-align: right;">
        <span style="color: #64748b; font-weight: 600;">العميل: </span>
        <span style="color: #0f172a; font-weight: 700;">${data.customerName}</span>
      </div>
      <div style="text-align: right;">
        <span style="color: #64748b; font-weight: 600;">التاريخ: </span>
        <span style="color: #0f172a; font-weight: 600; direction: ltr; display: inline-block;">${data.date}</span>
      </div>
      ${data.phone ? `
        <div style="text-align: right;">
          <span style="color: #64748b; font-weight: 600;">الهاتف: </span>
          <span style="color: #0f172a; font-weight: 600; direction: ltr; display: inline-block;">${data.phone}</span>
        </div>
      ` : ''}
      <div style="text-align: right;">
        <span style="color: #64748b; font-weight: 600;">طريقة السداد / الدفع: </span>
        <span style="color: #0f172a; font-weight: 600;">${data.paymentMethod || 'نقدي (كاش)'}</span>
      </div>
    </div>

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13.5px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff;">
          <th style="padding: 12px; text-align: center; width: 40px; font-weight: 700;">م</th>
          <th style="padding: 12px; text-align: right; font-weight: 700;">البيان / تفاصيل الأصناف</th>
          <th style="padding: 12px; text-align: center; width: 80px; font-weight: 700;">الكمية</th>
          <th style="padding: 12px; text-align: center; width: 110px; font-weight: 700;">السعر</th>
          <th style="padding: 12px; text-align: left; width: 120px; font-weight: 700;">المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, index) => `
          <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${index % 2 === 1 ? '#f8fafc' : '#ffffff'};">
            <td style="padding: 11px 12px; text-align: center; color: #64748b; font-weight: 600;">${index + 1}</td>
            <td style="padding: 11px 12px; text-align: right; color: #0f172a; font-weight: 700;">${item.description}</td>
            <td style="padding: 11px 12px; text-align: center; color: #0f172a; font-weight: 600;">${item.quantity ?? '1'}</td>
            <td style="padding: 11px 12px; text-align: center; color: #0f172a; font-weight: 600;">${item.unitPrice ?? '-'}</td>
            <td style="padding: 11px 12px; text-align: left; color: #0f172a; font-weight: 800;">${item.amount}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Totals Box & Notes -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
      <div style="font-size: 13px; color: #64748b; max-width: 380px;">
        ${data.notes ? `
          <div style="background-color: #f8fafc; border-right: 4px solid #3b82f6; padding: 10px 14px; border-radius: 6px;">
            <strong style="color: #1e293b; display: block; margin-bottom: 4px;">ملاحظات:</strong>
            <span style="color: #334155;">${data.notes}</span>
          </div>
        ` : ''}
      </div>

      <div style="width: 300px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        ${data.subtotal ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 18px; font-size: 13.5px; color: #475569;">
            <span>المجموع الفرعي:</span>
            <span style="font-weight: 700; color: #1e293b;">${data.subtotal}</span>
          </div>
        ` : ''}
        ${data.discount && data.discount !== '0' && data.discount !== '0.00' ? `
          <div style="display: flex; justify-content: space-between; padding: 10px 18px; font-size: 13.5px; color: #dc2626; border-top: 1px dashed #e2e8f0;">
            <span>الخصم الممنوح:</span>
            <span style="font-weight: 700;">-${data.discount}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; padding: 14px 18px; font-size: 16px; font-weight: 800; background-color: #059669; color: #ffffff;">
          <span>الصافي النهائي:</span>
          <span>${data.totalAmount}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; text-align: center;">
      <div style="font-size: 14px; font-weight: 700; color: #334155; margin-bottom: 4px;">
        ❤️ سعدنا بزيارتكم الكريمة - طاب يومكم
      </div>
      <div style="font-size: 11.5px; color: #94a3b8;">
        وثيقة إلكترونية معتمدة صُدرت آلياً بواسطة تطبيق سند المحاسبي والتقني
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, getSafeHtml2CanvasOptions({
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    }));

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    doc.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));

    if (imgHeight > pageHeight) {
      let heightLeft = imgHeight - pageHeight;
      let position = -pageHeight;
      while (heightLeft > 0) {
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position -= pageHeight;
      }
    }

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `فاتورة_${data.invoiceNumber || Date.now()}.pdf`;

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
      const cleanFileName = (data.title || 'فاتورة_سند').replace(/[^\w\u0600-\u06FF]/g, '_');
      doc.save(`${cleanFileName}_${data.invoiceNumber || Date.now()}.pdf`);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    setTimeout(() => {
      isPdfGenerating = false;
    }, 1000);
  }
};
