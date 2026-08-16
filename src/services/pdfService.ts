/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getSafeHtml2CanvasOptions } from '../utils/pdfHelper';
import { saveAndShareFile } from '../utils/fileExport';

export interface PDFItem {
  description: string;
  quantity?: string | number;
  unitPrice?: string | number;
  amount: string;
}

export interface PDFColumn {
  key: string;
  label: string;
  align?: 'right' | 'center' | 'left';
  width?: string;
}

export interface PDFSummaryBox {
  label: string;
  value: string | number;
  color?: string;
  bg?: string;
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
  items?: PDFItem[];
  orientation?: 'p' | 'l'; // portrait ('p') or landscape ('l')
  customColumns?: PDFColumn[];
  customRows?: Record<string, string | number>[];
  summaryBoxes?: PDFSummaryBox[];
  footerNote?: string;
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
 * إنتاج وتصدير ملفات PDF وكشوفات محاسبية احترافية بتنسيق راقٍ متناسق مع دعم كامل للغة العربية والاتجاه من اليمين لليسار.
 */
export const generateAndSharePDF = async (data: PDFData) => {
  if (isPdfGenerating) {
    console.log('[generateAndSharePDF] PDF generation in progress, skipping duplicate call.');
    return;
  }
  isPdfGenerating = true;

  const isLandscape = data.orientation === 'l';
  const containerWidth = isLandscape ? 1120 : 800;

  // 1. إنشاء عنصر HTML مؤقت وخفي لتنسيق الكشف أو الفاتورة بدقة المتصفح الأصلية RTL بتصميم واسع ومتناسق
  const container = document.createElement('div');
  container.setAttribute('data-export-container', 'true');
  container.className = 'pdf-export-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${containerWidth}px`;
  container.style.maxWidth = `${containerWidth}px`;
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  container.style.direction = 'rtl';
  container.style.padding = isLandscape ? '16px 20px' : '20px 22px';
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-9999';
  container.style.lineHeight = '1.55';

  const storeTitle = data.storeName || 'سند المحاسبي';
  const docTitle = data.title || 'كشف محاسبي معتمد';
  const hasCustomTable = Boolean(data.customColumns && data.customColumns.length > 0 && data.customRows);

  let tableHtml = '';

  if (hasCustomTable && data.customColumns && data.customRows) {
    // رندرة جدول الكشوفات المحاسبية المفصلة بتصميم عالي الوضوح وهوامش مريحة للخطوط العربية
    tableHtml = `
      <div style="margin-bottom: 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; overflow: hidden; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse; font-size: ${isLandscape ? '11px' : '11.5px'}; line-height: 1.55; text-align: center;">
          <thead>
            <tr style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); color: #ffffff;">
              ${data.customColumns.map(col => `
                <th style="padding: 8px 6px; text-align: ${col.align || 'center'}; font-weight: 700; border: 1px solid #334155; vertical-align: middle; ${col.width ? `width: ${col.width};` : ''}">
                  ${col.label}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.customRows.map((row, rIdx) => {
              const isTotalRow = String(row.index).includes('الإجمالي') || String(row.index).includes('إجمالي') || String(row.name).includes('الإجمالي') || String(row.name).includes('إجمالي');
              const bg = isTotalRow ? '#e2e8f0' : (rIdx % 2 === 1 ? '#f8fafc' : '#ffffff');
              return `
                <tr style="background-color: ${bg}; border-bottom: 1px solid #cbd5e1; font-weight: ${isTotalRow ? '800' : '500'};">
                  ${data.customColumns!.map(col => {
                    const cellVal = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-';
                    const isStatus = col.key === 'status' || col.key === 'state';
                    const isAmount = col.key.includes('total') || col.key.includes('Amount') || col.key.includes('profit') || col.key.includes('Price') || col.key.includes('inflow') || col.key.includes('outflow');
                    return `
                      <td style="padding: 7px 6px; text-align: ${col.align || 'center'}; vertical-align: middle; color: ${isTotalRow ? '#0f172a' : (isStatus ? '#0f172a' : isAmount ? '#047857' : '#1e293b')}; font-weight: ${isTotalRow ? '800' : (isAmount || col.key === 'name' ? '700' : '500')}; border: 1px solid #cbd5e1; font-family: ${col.key === 'barcode' || col.key === 'phone' || col.key === 'ref' ? 'monospace' : 'inherit'};">
                        ${cellVal}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    // رندرة الجدول القياسي للفواتير والطلبات
    const items = data.items || [];
    tableHtml = `
      <div style="margin-bottom: 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; overflow: hidden; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.55; text-align: center;">
          <thead>
            <tr style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); color: #ffffff;">
              <th style="padding: 8px 6px; text-align: center; width: 40px; font-weight: 700; border: 1px solid #334155; vertical-align: middle;">م</th>
              <th style="padding: 8px 8px; text-align: right; font-weight: 700; border: 1px solid #334155; vertical-align: middle;">البيان / اسم الصنف</th>
              <th style="padding: 8px 6px; text-align: center; width: 75px; font-weight: 700; border: 1px solid #334155; vertical-align: middle;">الكمية</th>
              <th style="padding: 8px 6px; text-align: center; width: 95px; font-weight: 700; border: 1px solid #334155; vertical-align: middle;">السعر</th>
              <th style="padding: 8px 6px; text-align: left; width: 110px; font-weight: 700; border: 1px solid #334155; vertical-align: middle;">المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${index % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                <td style="padding: 7px 6px; text-align: center; color: #64748b; font-weight: 600; border: 1px solid #e2e8f0; vertical-align: middle;">${index + 1}</td>
                <td style="padding: 7px 8px; text-align: right; color: #0f172a; font-weight: 700; border: 1px solid #e2e8f0; vertical-align: middle;">${item.description}</td>
                <td style="padding: 7px 6px; text-align: center; color: #0f172a; font-weight: 600; border: 1px solid #e2e8f0; vertical-align: middle;">${item.quantity ?? '1'}</td>
                <td style="padding: 7px 6px; text-align: center; color: #0f172a; font-weight: 600; border: 1px solid #e2e8f0; vertical-align: middle;">${item.unitPrice ?? '-'}</td>
                <td style="padding: 7px 6px; text-align: left; color: #047857; font-weight: 800; border: 1px solid #e2e8f0; vertical-align: middle;">${item.amount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // رندرة صناديق الإحصائيات والإجماليات بنمط شريطي مدمج وأنيق
  let summaryBoxesHtml = '';
  if (data.summaryBoxes && data.summaryBoxes.length > 0) {
    summaryBoxesHtml = `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; justify-content: space-between; align-items: center;">
        ${data.summaryBoxes.map(b => `
          <div style="display: flex; align-items: center; gap: 6px; font-size: ${isLandscape ? '11px' : '11.5px'}; line-height: 1.5;">
            <span style="color: #64748b; font-weight: 600;">${b.label}:</span>
            <span style="font-weight: 800; color: ${b.color || '#0f172a'};">${b.value}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 6px; padding: 10px 16px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <div style="text-align: right;">
        <h1 style="margin: 0; font-size: ${isLandscape ? '17px' : '16px'}; font-weight: 800; color: #ffffff; line-height: 1.3;">
          ${storeTitle}
        </h1>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8; font-weight: 600;">
          نظام سند المحاسبي وإدارة الأعمال المتكاملة
        </p>
      </div>
      <div style="text-align: left; direction: ltr;">
        <div style="font-size: ${isLandscape ? '16px' : '15px'}; font-weight: 800; color: #34d399; direction: rtl; text-align: left;">
          ${docTitle}
        </div>
        ${data.invoiceNumber ? `
          <div style="font-size: 11px; color: #e2e8f0; margin-top: 2px; direction: rtl; text-align: left; font-weight: 600;">
            رقم المرجع: #${data.invoiceNumber}
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Info Inline Card -->
    <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; font-size: ${isLandscape ? '11px' : '11.5px'}; line-height: 1.5;">
      <div>
        <span style="color: #64748b; font-weight: 600;">الجهة / الحساب: </span>
        <span style="color: #0f172a; font-weight: 700;">${data.customerName}</span>
      </div>
      <div>
        <span style="color: #64748b; font-weight: 600;">التاريخ: </span>
        <span style="color: #0f172a; font-weight: 600; direction: ltr; display: inline-block;">${data.date}</span>
      </div>
      ${data.phone ? `
        <div>
          <span style="color: #64748b; font-weight: 600;">الهاتف: </span>
          <span style="color: #0f172a; font-weight: 600; direction: ltr; display: inline-block;">${data.phone}</span>
        </div>
      ` : ''}
      <div>
        <span style="color: #64748b; font-weight: 600;">البيان: </span>
        <span style="color: #0f172a; font-weight: 600;">${data.paymentMethod || 'كشف رسمي معتمد'}</span>
      </div>
    </div>

    <!-- Summary Badges if available -->
    ${summaryBoxesHtml}

    <!-- Table Statement Section -->
    ${tableHtml}

    <!-- Totals Box & Notes (For Standard Invoices) -->
    ${(!data.summaryBoxes || data.summaryBoxes.length === 0) ? `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <div style="font-size: 11px; color: #64748b; max-width: 480px; line-height: 1.5;">
          ${data.notes ? `
            <div style="background-color: #f8fafc; border-right: 4px solid #3b82f6; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
              <strong style="color: #1e293b;">ملاحظات: </strong>
              <span style="color: #334155;">${data.notes}</span>
            </div>
          ` : ''}
        </div>

        <div style="width: 240px; background-color: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          ${data.subtotal ? `
            <div style="display: flex; justify-content: space-between; padding: 5px 10px; font-size: 11px; color: #475569;">
              <span>المجموع:</span>
              <span style="font-weight: 700; color: #1e293b;">${data.subtotal}</span>
            </div>
          ` : ''}
          ${data.discount && data.discount !== '0' && data.discount !== '0.00' ? `
            <div style="display: flex; justify-content: space-between; padding: 5px 10px; font-size: 11px; color: #dc2626; border-top: 1px dashed #e2e8f0;">
              <span>الخصم:</span>
              <span style="font-weight: 700;">-${data.discount}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; padding: 6px 10px; font-size: 12px; font-weight: 800; background-color: #059669; color: #ffffff;">
            <span>الصافي:</span>
            <span>${data.totalAmount}</span>
          </div>
        </div>
      </div>
    ` : `
      ${data.notes ? `
        <div style="background-color: #f8fafc; border-right: 4px solid #3b82f6; padding: 6px 10px; border-radius: 4px; font-size: 11px; color: #334155; margin-bottom: 8px; border: 1px solid #e2e8f0; line-height: 1.5;">
          <strong>ملاحظات: </strong> ${data.notes}
        </div>
      ` : ''}
    `}

    <!-- Footer -->
    <div style="border-top: 1.5px solid #cbd5e1; padding-top: 8px; margin-top: 10px; text-align: center; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #64748b;">
      <span style="font-weight: 600;">
        ${data.footerNote || '✨ كشف حساب رسمي معتمد - نظام سند المحاسبي'}
      </span>
      <span style="color: #94a3b8;">
        تم الإنشاء والتدقيق في: ${data.date}
      </span>
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
      orientation: isLandscape ? 'l' : 'p',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = isLandscape ? 297 : 210;
    const pageHeight = isLandscape ? 210 : 297;
    
    // Fit to single page if within reasonable scale (up to 55% overflow)
    let imgWidth = pageWidth;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight > pageHeight && imgHeight <= pageHeight * 1.55) {
      // Auto scale down proportionally to fit 1 single neat page
      const scaleDown = pageHeight / imgHeight;
      imgWidth = pageWidth * scaleDown;
      imgHeight = pageHeight;
      const xOffset = (pageWidth - imgWidth) / 2;
      doc.addImage(imgData, 'PNG', xOffset, 0, imgWidth, imgHeight);
    } else {
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
    }

    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const cleanFileName = (data.title || 'كشف_سند').replace(/[^\w\u0600-\u06FF]/g, '_');
    const fileName = `${cleanFileName}_${data.invoiceNumber || Date.now()}.pdf`;

    await saveAndShareFile({
      fileName,
      data: pdfBase64,
      isBase64: true,
      mimeType: 'application/pdf',
      title: data.title || 'كشف حساب',
      text: `${data.title || 'كشف حساب'} - نظام سند`
    });
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

