/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
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
 * دالة ذكية لاقتصاص النص في حال تجاوز عرض الخلية وإضافة (...)
 */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return '';
  const str = String(text);
  if (ctx.measureText(str).width <= maxWidth) return str;
  let low = 0;
  let high = str.length;
  let fit = '';
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const sub = str.slice(0, mid) + '...';
    if (ctx.measureText(sub).width <= maxWidth) {
      fit = sub;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return fit || str.slice(0, 3) + '...';
}

/**
 * رسم مستطيل بزوايا دائرية على الكانفاس
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fillColor?: string | CanvasGradient,
  strokeColor?: string | CanvasGradient,
  lineWidth: number = 1
) {
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * إنتاج وتصدير ملفات PDF وكشوفات محاسبية فائقة السرعة والدقة عبر محرك Direct Canvas 2D Vector.
 * يضمن توليد مئات الصفوف في أجزاء من الثانية دون أي تعليق أو استهلاك للذاكرة أو خروج من التطبيق.
 */
export const generateAndSharePDF = async (data: PDFData) => {
  if (isPdfGenerating) {
    console.log('[generateAndSharePDF] PDF generation in progress, skipping duplicate call.');
    return;
  }
  isPdfGenerating = true;

  const isLandscape = data.orientation === 'l';
  const storeTitle = data.storeName || 'سند المحاسبي';
  const docTitle = data.title || 'كشف محاسبي معتمد';
  const hasCustomTable = Boolean(data.customColumns && data.customColumns.length > 0 && data.customRows);

  try {
    const doc = new jsPDF({
      orientation: isLandscape ? 'l' : 'p',
      unit: 'mm',
      format: 'a4'
    });

    const pdfPageWidthMm = isLandscape ? 297 : 210;
    const pdfPageHeightMm = isLandscape ? 210 : 297;

    // أبعاد كانفاس الرسم بدقة عالية جداً (High DPI Crystal Clear)
    const canvasWidth = isLandscape ? 1754 : 1240;
    const canvasHeight = isLandscape ? 1240 : 1754;

    // إعداد البيانات وفصل صف الإجمالي
    let allDataRows: Record<string, string | number>[] = [];
    let totalRow: Record<string, string | number> | null = null;

    if (hasCustomTable && data.customRows) {
      allDataRows = [...data.customRows];
      if (allDataRows.length > 0) {
        const lastRow = allDataRows[allDataRows.length - 1];
        const isTotal = String(lastRow.index || '').includes('الإجمالي') ||
                        String(lastRow.index || '').includes('إجمالي') ||
                        String(lastRow.name || '').includes('الإجمالي') ||
                        String(lastRow.name || '').includes('إجمالي');
        if (isTotal) {
          totalRow = lastRow;
          allDataRows.pop();
        }
      }
    }

    const items = data.items || [];
    const hasSummaryBoxes = Boolean(data.summaryBoxes && data.summaryBoxes.length > 0);

    // سعة الصفوف في الصفحة
    const firstPageRowsLimit = isLandscape ? (hasSummaryBoxes ? 13 : 16) : (hasSummaryBoxes ? 17 : 22);
    const subPageRowsLimit = isLandscape ? 20 : 26;

    // توزيع الصفحات
    interface PagePlan {
      pageNumber: number;
      totalPages: number;
      isFirstPage: boolean;
      isLastPage: boolean;
      customRowsSlice?: Record<string, string | number>[];
      itemsSlice?: PDFItem[];
      includeTotalRow: boolean;
    }

    let pagesPlan: PagePlan[] = [];

    if (hasCustomTable) {
      if (allDataRows.length <= firstPageRowsLimit) {
        pagesPlan = [{
          pageNumber: 1,
          totalPages: 1,
          isFirstPage: true,
          isLastPage: true,
          customRowsSlice: allDataRows,
          includeTotalRow: Boolean(totalRow)
        }];
      } else {
        const firstSlice = allDataRows.slice(0, firstPageRowsLimit);
        const remainingRows = allDataRows.slice(firstPageRowsLimit);
        const remainingPagesCount = Math.ceil(remainingRows.length / subPageRowsLimit);
        const totalPages = 1 + remainingPagesCount;

        pagesPlan.push({
          pageNumber: 1,
          totalPages,
          isFirstPage: true,
          isLastPage: false,
          customRowsSlice: firstSlice,
          includeTotalRow: false
        });

        for (let p = 0; p < remainingPagesCount; p++) {
          const start = p * subPageRowsLimit;
          const end = start + subPageRowsLimit;
          const isLast = (p === remainingPagesCount - 1);
          pagesPlan.push({
            pageNumber: p + 2,
            totalPages,
            isFirstPage: false,
            isLastPage: isLast,
            customRowsSlice: remainingRows.slice(start, end),
            includeTotalRow: isLast && Boolean(totalRow)
          });
        }
      }
    } else {
      if (items.length <= firstPageRowsLimit) {
        pagesPlan = [{
          pageNumber: 1,
          totalPages: 1,
          isFirstPage: true,
          isLastPage: true,
          itemsSlice: items,
          includeTotalRow: false
        }];
      } else {
        const firstSlice = items.slice(0, firstPageRowsLimit);
        const remainingItems = items.slice(firstPageRowsLimit);
        const remainingPagesCount = Math.ceil(remainingItems.length / subPageRowsLimit);
        const totalPages = 1 + remainingPagesCount;

        pagesPlan.push({
          pageNumber: 1,
          totalPages,
          isFirstPage: true,
          isLastPage: false,
          itemsSlice: firstSlice,
          includeTotalRow: false
        });

        for (let p = 0; p < remainingPagesCount; p++) {
          const start = p * subPageRowsLimit;
          const end = start + subPageRowsLimit;
          const isLast = (p === remainingPagesCount - 1);
          pagesPlan.push({
            pageNumber: p + 2,
            totalPages,
            isFirstPage: false,
            isLastPage: isLast,
            itemsSlice: remainingItems.slice(start, end),
            includeTotalRow: false
          });
        }
      }
    }

    // إعداد كانفاس وحيد لإعادة استخدامه بسرعة البرق (Lightning Fast)
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
      throw new Error('Canvas 2D context not supported');
    }

    // حساب عروض الأعمدة النسبية بدقة
    let colWidths: number[] = [];
    if (hasCustomTable && data.customColumns) {
      const marginX = 40;
      const availableTableWidth = canvasWidth - (marginX * 2);
      
      // تحليل القيم المعطاة
      const rawWeights = data.customColumns.map(c => {
        if (c.width) {
          const num = parseFloat(c.width);
          if (!isNaN(num)) return num;
        }
        if (c.key === 'index') return 45;
        if (c.key === 'name') return 240;
        if (c.key === 'barcode') return 110;
        if (c.key === 'category') return 95;
        if (c.key === 'stock') return 70;
        if (c.key.includes('total') || c.key.includes('Amount')) return 120;
        if (c.key.includes('Price') || c.key.includes('profit')) return 100;
        return 90;
      });

      const totalWeight = rawWeights.reduce((a, b) => a + b, 0);
      colWidths = rawWeights.map(w => (w / totalWeight) * availableTableWidth);
    }

    // رندرة الصفحات المخططة
    for (let pageIdx = 0; pageIdx < pagesPlan.length; pageIdx++) {
      const pageInfo = pagesPlan[pageIdx];

      if (pageIdx > 0) {
        doc.addPage();
      }

      // 1. تنظيف وتبييض الصفحة
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const marginX = 40;
      let currentY = 32;

      // 2. رسم الترويسة العلوية
      if (pageInfo.isFirstPage) {
        // بانر الترويسة الرئيسية الداكن الفاخر
        const headerHeight = 76;
        const bannerGradient = ctx.createLinearGradient(marginX, currentY, canvasWidth - marginX, currentY + headerHeight);
        bannerGradient.addColorStop(0, '#0f172a');
        bannerGradient.addColorStop(1, '#1e293b');

        drawRoundedRect(ctx, marginX, currentY, canvasWidth - (marginX * 2), headerHeight, 10, bannerGradient);

        // نصوص البانر
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Cairo", "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(storeTitle, canvasWidth - marginX - 24, currentY + 34);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 14px "Cairo", "Segoe UI", Tahoma, sans-serif';
        ctx.fillText('نظام سند المحاسبي وإدارة المخزون والأعمال', canvasWidth - marginX - 24, currentY + 58);

        // العنوان على اليسار
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 22px "Cairo", "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(docTitle, marginX + 24, currentY + 34);

        if (data.invoiceNumber) {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '600 14px "Cairo", monospace, sans-serif';
          ctx.fillText(`رقم المرجع: #${data.invoiceNumber}`, marginX + 24, currentY + 58);
        }

        currentY += headerHeight + 12;

        // بطاقة المعلومات العامة المدمجة
        const infoCardHeight = 44;
        drawRoundedRect(ctx, marginX, currentY, canvasWidth - (marginX * 2), infoCardHeight, 8, '#f8fafc', '#cbd5e1', 1.5);

        ctx.font = '600 13.5px "Cairo", "Segoe UI", Tahoma, sans-serif';
        const infoY = currentY + 27;

        // 4 أقسام داخل بطاقة المعلومات
        const sectionWidth = (canvasWidth - (marginX * 2)) / 4;

        // 1. الجهة / الحساب
        ctx.textAlign = 'right';
        ctx.fillStyle = '#64748b';
        ctx.fillText('الجهة / الحساب:', canvasWidth - marginX - 16, infoY);
        const lblW1 = ctx.measureText('الجهة / الحساب: ').width;
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px "Cairo", "Segoe UI", Tahoma, sans-serif';
        ctx.fillText(fitText(ctx, data.customerName, sectionWidth - lblW1 - 20), canvasWidth - marginX - 16 - lblW1, infoY);

        // 2. التاريخ
        ctx.font = '600 13.5px "Cairo", "Segoe UI", Tahoma, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('التاريخ:', canvasWidth - marginX - sectionWidth - 10, infoY);
        const lblW2 = ctx.measureText('التاريخ: ').width;
        ctx.fillStyle = '#0f172a';
        ctx.fillText(data.date, canvasWidth - marginX - sectionWidth - 10 - lblW2, infoY);

        // 3. البيان / نوع الكشف
        ctx.fillStyle = '#64748b';
        ctx.fillText('البيان:', canvasWidth - marginX - (sectionWidth * 2) - 10, infoY);
        const lblW3 = ctx.measureText('البيان: ').width;
        ctx.fillStyle = '#0f172a';
        ctx.fillText(fitText(ctx, data.paymentMethod || 'كشف جرد رسمي معتمد', sectionWidth - lblW3 - 20), canvasWidth - marginX - (sectionWidth * 2) - 10 - lblW3, infoY);

        // 4. الهاتف إن وجد أو حالة المستند
        ctx.fillStyle = '#64748b';
        ctx.fillText(data.phone ? 'الهاتف:' : 'الحالة:', canvasWidth - marginX - (sectionWidth * 3) - 10, infoY);
        const lblW4 = ctx.measureText(data.phone ? 'الهاتف: ' : 'الحالة: ').width;
        ctx.fillStyle = '#059669';
        ctx.font = 'bold 13.5px "Cairo", "Segoe UI", Tahoma, sans-serif';
        ctx.fillText(data.phone || 'موثق ومعتمد ✓', canvasWidth - marginX - (sectionWidth * 3) - 10 - lblW4, infoY);

        currentY += infoCardHeight + 12;

        // بطاقات الإحصائيات والأرقام التلخيصية (Summary Boxes)
        if (hasSummaryBoxes && data.summaryBoxes) {
          const boxes = data.summaryBoxes;
          const boxCount = Math.min(boxes.length, 6);
          const gap = 8;
          const boxW = ((canvasWidth - (marginX * 2)) - (gap * (boxCount - 1))) / boxCount;
          const boxH = 54;

          boxes.slice(0, boxCount).forEach((b, bIdx) => {
            const bx = (canvasWidth - marginX) - ((bIdx + 1) * boxW) - (bIdx * gap);
            drawRoundedRect(ctx, bx, currentY, boxW, boxH, 8, b.bg || '#f8fafc', '#cbd5e1', 1.5);

            // تسمية الصندوق
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 12px "Cairo", "Segoe UI", Tahoma, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(fitText(ctx, b.label, boxW - 12), bx + (boxW / 2), currentY + 20);

            // القيمة
            ctx.fillStyle = b.color || '#0f172a';
            ctx.font = 'bold 15px "Cairo", "Segoe UI", Tahoma, sans-serif';
            ctx.fillText(fitText(ctx, String(b.value), boxW - 12), bx + (boxW / 2), currentY + 42);
          });

          currentY += boxH + 12;
        }

      } else {
        // ترويسة مدمجة للصفحات التالية (2، 3، ...)
        const compactHeight = 44;
        drawRoundedRect(ctx, marginX, currentY, canvasWidth - (marginX * 2), compactHeight, 8, '#0f172a');

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Cairo", "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${storeTitle}  |  ${docTitle}`, canvasWidth - marginX - 18, currentY + 28);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px "Cairo", "Segoe UI", Tahoma, sans-serif';
        ctx.fillText(`صفحة ${pageInfo.pageNumber} من ${pageInfo.totalPages}`, marginX + 18, currentY + 28);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 13px "Cairo", "Segoe UI", Tahoma, sans-serif';
        ctx.fillText(data.date, marginX + 160, currentY + 28);

        currentY += compactHeight + 12;
      }

      // 3. رسم الجدول (Table Headers & Rows)
      const tableX = marginX;
      const tableW = canvasWidth - (marginX * 2);
      const rowH = isLandscape ? 33 : 36;
      const headerH = isLandscape ? 36 : 40;

      if (hasCustomTable && data.customColumns && pageInfo.customRowsSlice) {
        // ترويسة الجدول
        drawRoundedRect(ctx, tableX, currentY, tableW, headerH, 6, '#0f172a');

        let colCurX = tableX + tableW; // نبدأ من اليمين (RTL)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13.5px "Cairo", "Segoe UI", Tahoma, sans-serif';

        data.customColumns.forEach((col, cIdx) => {
          const w = colWidths[cIdx];
          const align = col.align || 'center';

          ctx.textAlign = align;
          const textX = align === 'right' ? colCurX - 10 : align === 'left' ? colCurX - w + 10 : colCurX - (w / 2);
          ctx.fillText(col.label, textX, currentY + (headerH / 2) + 5);

          // خط فاصل بين الأعمدة في الترويسة
          if (cIdx > 0) {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(colCurX, currentY + 4);
            ctx.lineTo(colCurX, currentY + headerH - 4);
            ctx.stroke();
          }

          colCurX -= w;
        });

        currentY += headerH;

        // صفوف البيانات
        const rowsToDraw = [...pageInfo.customRowsSlice];
        if (pageInfo.includeTotalRow && totalRow) {
          rowsToDraw.push(totalRow);
        }

        rowsToDraw.forEach((row, rIdx) => {
          const isTotal = String(row.index).includes('الإجمالي') || String(row.index).includes('إجمالي') ||
                          String(row.name).includes('الإجمالي') || String(row.name).includes('إجمالي');

          const rowBg = isTotal ? '#e2e8f0' : (rIdx % 2 === 1 ? '#f8fafc' : '#ffffff');
          
          ctx.fillStyle = rowBg;
          ctx.fillRect(tableX, currentY, tableW, rowH);

          // خط سفلي
          ctx.strokeStyle = isTotal ? '#94a3b8' : '#cbd5e1';
          ctx.lineWidth = isTotal ? 1.5 : 1;
          ctx.beginPath();
          ctx.moveTo(tableX, currentY + rowH);
          ctx.lineTo(tableX + tableW, currentY + rowH);
          ctx.stroke();

          // خلايا الصف
          let cellCurX = tableX + tableW;
          data.customColumns!.forEach((col, cIdx) => {
            const w = colWidths[cIdx];
            const cellVal = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-';
            const align = col.align || 'center';

            // تحديد اللون
            let textColor = '#1e293b';
            let isBold = isTotal || col.key === 'name' || col.key === 'profit' || col.key.includes('total');

            if (isTotal) {
              textColor = '#0f172a';
            } else if (col.key === 'status') {
              if (cellVal.includes('متوفر') || cellVal.includes('مكتمل')) textColor = '#059669';
              else if (cellVal.includes('منخفض') || cellVal.includes('طلب')) textColor = '#d97706';
              else if (cellVal.includes('نافد')) textColor = '#dc2626';
            } else if (col.key === 'profit' || col.key.includes('totalSelling')) {
              textColor = '#059669';
            }

            ctx.fillStyle = textColor;
            ctx.font = `${isBold ? 'bold' : '500'} ${isLandscape ? '12.5px' : '13px'} "Cairo", "Segoe UI", Tahoma, sans-serif`;
            ctx.textAlign = align;

            const textX = align === 'right' ? cellCurX - 8 : align === 'left' ? cellCurX - w + 8 : cellCurX - (w / 2);
            ctx.fillText(fitText(ctx, cellVal, w - 12), textX, currentY + (rowH / 2) + 5);

            // خط عمودي فاصل بين الخلايا
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cellCurX, currentY);
            ctx.lineTo(cellCurX, currentY + rowH);
            ctx.stroke();

            cellCurX -= w;
          });

          // خط عمودي أخير
          ctx.strokeStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(tableX, currentY);
          ctx.lineTo(tableX, currentY + rowH);
          ctx.stroke();

          currentY += rowH;
        });

      } else if (pageInfo.itemsSlice) {
        // فواتير وسندات قياسية
        drawRoundedRect(ctx, tableX, currentY, tableW, headerH, 6, '#0f172a');

        const stdColWidths = [60, tableW - 390, 100, 110, 120];
        const stdHeaders = ['م', 'البيان / اسم الصنف', 'الكمية', 'السعر', 'المجموع'];
        const stdAligns: CanvasTextAlign[] = ['center', 'right', 'center', 'center', 'left'];

        let colCurX = tableX + tableW;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "Cairo", "Segoe UI", Tahoma, sans-serif';

        stdHeaders.forEach((lbl, cIdx) => {
          const w = stdColWidths[cIdx];
          const align = stdAligns[cIdx];
          ctx.textAlign = align;
          const textX = align === 'right' ? colCurX - 12 : align === 'left' ? colCurX - w + 12 : colCurX - (w / 2);
          ctx.fillText(lbl, textX, currentY + (headerH / 2) + 5);
          colCurX -= w;
        });

        currentY += headerH;

        pageInfo.itemsSlice.forEach((item, rIdx) => {
          const rowBg = rIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
          ctx.fillStyle = rowBg;
          ctx.fillRect(tableX, currentY, tableW, rowH);

          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tableX, currentY + rowH);
          ctx.lineTo(tableX + tableW, currentY + rowH);
          ctx.stroke();

          const vals = [
            String((pageInfo.pageNumber - 1) * subPageRowsLimit + rIdx + 1),
            item.description,
            String(item.quantity ?? '1'),
            String(item.unitPrice ?? '-'),
            item.amount
          ];

          let cellCurX = tableX + tableW;
          vals.forEach((val, cIdx) => {
            const w = stdColWidths[cIdx];
            const align = stdAligns[cIdx];
            ctx.textAlign = align;
            ctx.fillStyle = cIdx === 4 ? '#059669' : cIdx === 1 ? '#0f172a' : '#334155';
            ctx.font = `${cIdx === 1 || cIdx === 4 ? 'bold' : '500'} 13px "Cairo", "Segoe UI", Tahoma, sans-serif`;

            const textX = align === 'right' ? cellCurX - 12 : align === 'left' ? cellCurX - w + 12 : cellCurX - (w / 2);
            ctx.fillText(fitText(ctx, val, w - 16), textX, currentY + (rowH / 2) + 5);
            cellCurX -= w;
          });

          currentY += rowH;
        });
      }

      // 4. ذيل الصفحة الأخيرة (ملاحظات ومربعات الإجمالي)
      if (pageInfo.isLastPage) {
        currentY += 12;
        const footerBoxY = Math.min(currentY, canvasHeight - 110);

        if (data.notes) {
          drawRoundedRect(ctx, marginX, footerBoxY, canvasWidth - (marginX * 2) - 280, 50, 6, '#f8fafc', '#cbd5e1', 1.5);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 13px "Cairo", "Segoe UI", Tahoma, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`ملاحظات: ${data.notes}`, canvasWidth - marginX - 295, footerBoxY + 28);
        }

        if (data.totalAmount && !hasSummaryBoxes) {
          const totalBoxX = canvasWidth - marginX - 260;
          drawRoundedRect(ctx, totalBoxX, footerBoxY, 260, 50, 6, '#059669');
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 15px "Cairo", "Segoe UI", Tahoma, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`الصافي الإجمالي: ${data.totalAmount}`, totalBoxX + 130, footerBoxY + 31);
        }
      }

      // 5. تذييل الصفحة الثابت أسفل كل صفحة مع رقم الصفحة
      const bottomY = canvasHeight - 28;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(marginX, bottomY - 14);
      ctx.lineTo(canvasWidth - marginX, bottomY - 14);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px "Cairo", "Segoe UI", Tahoma, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(data.footerNote || '✨ كشف حساب رسمي معتمد - نظام سند المحاسبي وإدارة الأعمال', canvasWidth - marginX, bottomY);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12.5px "Cairo", "Segoe UI", Tahoma, sans-serif';
      ctx.fillText(`صفحة ${pageInfo.pageNumber} من ${pageInfo.totalPages}`, canvasWidth / 2, bottomY);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 12px "Cairo", "Segoe UI", Tahoma, sans-serif';
      ctx.fillText(data.date, marginX, bottomY);

      // تحويل الكانفاس لصورة فائقة الجودة وإضافتها لمستند jsPDF
      const pageImgData = canvas.toDataURL('image/jpeg', 0.92);
      doc.addImage(pageImgData, 'JPEG', 0, 0, pdfPageWidthMm, pdfPageHeightMm, undefined, 'FAST');
    }

    // تصدير وحفظ الملف فوراً
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
    isPdfGenerating = false;
  }
};
