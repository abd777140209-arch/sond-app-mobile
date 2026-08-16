/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { saveAndShareFile } from '../utils/fileExport';

export interface BarcodeLabelData {
  storeName: string;
  storeLogoUrl?: string;
  productName: string;
  price: number;
  currency: string;
  barcode: string;
  copies: number;
  size: '50x30' | '40x30' | '40x20' | '38x25' | '60x40' | 'A4-sheet';
}

/**
 * Returns physical millimeter and target pixel dimensions
 */
export function getLabelDimensions(size: BarcodeLabelData['size']): { 
  widthMm: number; 
  heightMm: number; 
  pixelWidth: number; 
  pixelHeight: number;
} {
  switch (size) {
    case '40x20':
      return { widthMm: 40, heightMm: 20, pixelWidth: 600, pixelHeight: 300 };
    case '38x25':
      return { widthMm: 38, heightMm: 25, pixelWidth: 570, pixelHeight: 375 };
    case '40x30':
      return { widthMm: 40, heightMm: 30, pixelWidth: 600, pixelHeight: 450 };
    case '60x40':
      return { widthMm: 60, heightMm: 40, pixelWidth: 900, pixelHeight: 600 };
    case '50x30':
    default:
      return { widthMm: 50, heightMm: 30, pixelWidth: 750, pixelHeight: 450 };
  }
}

/**
 * Renders a pixel-perfect, high-DPI barcode sticker directly on an HTML5 Canvas
 * completely immune to HTML/RTL clipping and font overflow defects.
 */
export async function renderBarcodeLabelToCanvas(data: BarcodeLabelData): Promise<HTMLCanvasElement> {
  const { pixelWidth, pixelHeight, heightMm } = getLabelDimensions(data.size);

  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context for barcode sticker');

  // 1. Crisp White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  // 2. Subtle Outer Border (for sticker edge definition)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, pixelWidth - 12, pixelHeight - 12);

  const paddingX = 24;
  const contentWidth = pixelWidth - paddingX * 2;
  const isCompact = heightMm <= 20;

  // 3. Header: Store Name & Tag
  const headerY = isCompact ? 36 : 46;
  ctx.fillStyle = '#000000';
  ctx.font = isCompact 
    ? 'bold 22px "Cairo", "Segoe UI", Tahoma, sans-serif' 
    : 'bold 28px "Cairo", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const storeTitle = (data.storeName || 'سند المحاسبي').trim();
  ctx.fillText(storeTitle, pixelWidth - paddingX, headerY);

  // Left Tag (سند)
  ctx.fillStyle = '#475569';
  ctx.font = isCompact 
    ? 'bold 18px "Cairo", monospace, sans-serif' 
    : 'bold 22px "Cairo", monospace, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('سند', paddingX, headerY);

  // Header Divider
  const lineY = isCompact ? 54 : 68;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(paddingX, lineY);
  ctx.lineTo(pixelWidth - paddingX, lineY);
  ctx.stroke();

  // 4. Product Name (Centered, dynamically scaled)
  const productY = isCompact ? 80 : 108;
  const rawProductName = (data.productName || 'اسم الصنف').trim();
  
  let productFontSize = isCompact ? 24 : 32;
  ctx.font = `bold ${productFontSize}px "Cairo", "Segoe UI", Tahoma, sans-serif`;
  while (ctx.measureText(rawProductName).width > contentWidth && productFontSize > 16) {
    productFontSize -= 2;
    ctx.font = `bold ${productFontSize}px "Cairo", "Segoe UI", Tahoma, sans-serif`;
  }
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rawProductName, pixelWidth / 2, productY);

  // 5. Generate Real Scannable Barcode into temporary canvas
  const barcodeCanvas = document.createElement('canvas');
  const barcodeText = (data.barcode || '100000000000').trim();

  try {
    JsBarcode(barcodeCanvas, barcodeText, {
      format: 'CODE128',
      lineColor: '#000000',
      width: isCompact ? 3 : 4,
      height: isCompact ? 70 : 110,
      displayValue: false,
      margin: 0,
      background: 'transparent'
    });

    const targetBarcodeWidth = Math.min(contentWidth, isCompact ? 460 : 560);
    const targetBarcodeHeight = isCompact ? 75 : 120;
    const barcodeX = (pixelWidth - targetBarcodeWidth) / 2;
    const barcodeY = isCompact ? 104 : 140;

    ctx.drawImage(barcodeCanvas, barcodeX, barcodeY, targetBarcodeWidth, targetBarcodeHeight);
  } catch (err) {
    console.warn('JsBarcode canvas error, using fallback:', err);
  }

  // 6. Barcode Digits (Monospace under barcode)
  const digitsY = isCompact ? 194 : 282;
  ctx.fillStyle = '#000000';
  ctx.font = isCompact 
    ? 'bold 22px monospace' 
    : 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(barcodeText, pixelWidth / 2, digitsY);

  // 7. Price Badge / Pill at the bottom
  const pricePillHeight = isCompact ? 60 : 88;
  const pricePillY = pixelHeight - pricePillHeight - 16;
  const pricePillWidth = contentWidth;
  const pricePillX = paddingX;

  // Draw solid dark pill
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  const radius = 12;
  ctx.roundRect(pricePillX, pricePillY, pricePillWidth, pricePillHeight, radius);
  ctx.fill();

  // Price Text (Centered inside pill)
  const formattedPrice = `${Number(data.price || 0).toLocaleString()} ${data.currency || 'ر.ي'}`;
  ctx.fillStyle = '#ffffff';
  ctx.font = isCompact 
    ? 'bold 28px "Cairo", monospace, sans-serif' 
    : 'bold 40px "Cairo", monospace, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedPrice, pixelWidth / 2, pricePillY + pricePillHeight / 2);

  return canvas;
}

/**
 * 1. Export exact label PDF (Thermal Roll e.g. 50mm x 30mm per sticker)
 */
export async function exportBarcodeLabelsPDF(data: BarcodeLabelData): Promise<boolean> {
  const { widthMm, heightMm } = getLabelDimensions(data.size);
  const copies = Math.max(1, Math.min(data.copies, 500));

  try {
    const canvas = await renderBarcodeLabelToCanvas(data);
    const imgData = canvas.toDataURL('image/png', 1.0);

    const pdf = new jsPDF({
      orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [widthMm, heightMm]
    });

    for (let i = 0; i < copies; i++) {
      if (i > 0) {
        pdf.addPage([widthMm, heightMm], widthMm >= heightMm ? 'landscape' : 'portrait');
      }
      pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
    }

    const cleanName = (data.productName || 'ملصق_باركود').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    const fileName = `ملصق_باركود_${cleanName}_${data.size}.pdf`;
    const pdfBase64 = pdf.output('datauristring');

    await saveAndShareFile({
      fileName,
      data: pdfBase64,
      isBase64: true,
      mimeType: 'application/pdf',
      title: `ملصقات باركود - ${data.productName}`,
      text: `ملصقات باركود لسلعة: ${data.productName} (عدد ${copies} ملصق مقاس ${data.size} مم)`
    });

    return true;
  } catch (error) {
    console.error('Error generating barcode label PDF:', error);
    return false;
  }
}

/**
 * 2. Export A4 Multi-Label Grid PDF (for standard desktop printers and A4 sticker paper)
 */
export async function exportA4StickerSheetPDF(data: BarcodeLabelData): Promise<boolean> {
  const { widthMm, heightMm } = getLabelDimensions(data.size);
  const copies = Math.max(1, Math.min(data.copies, 200));

  try {
    const canvas = await renderBarcodeLabelToCanvas(data);
    const imgData = canvas.toDataURL('image/png', 1.0);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const marginX = 10;
    const marginY = 12;
    const gapX = 4;
    const gapY = 4;

    const cols = Math.floor((pageWidth - 2 * marginX + gapX) / (widthMm + gapX));
    const rows = Math.floor((pageHeight - 2 * marginY + gapY) / (heightMm + gapY));
    const perPage = cols * rows;

    let colIndex = 0;
    let rowIndex = 0;

    for (let i = 0; i < copies; i++) {
      if (i > 0 && i % perPage === 0) {
        pdf.addPage('a4', 'portrait');
        colIndex = 0;
        rowIndex = 0;
      }

      const currentX = marginX + colIndex * (widthMm + gapX);
      const currentY = marginY + rowIndex * (heightMm + gapY);

      pdf.addImage(imgData, 'PNG', currentX, currentY, widthMm, heightMm, undefined, 'FAST');

      colIndex++;
      if (colIndex >= cols) {
        colIndex = 0;
        rowIndex++;
      }
    }

    const cleanName = (data.productName || 'ورقة_ملصقات').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    const fileName = `ورقة_ملصقات_A4_${cleanName}.pdf`;
    const pdfBase64 = pdf.output('datauristring');

    await saveAndShareFile({
      fileName,
      data: pdfBase64,
      isBase64: true,
      mimeType: 'application/pdf',
      title: `ورقة ملصقات A4 - ${data.productName}`,
      text: `ورقة ملصقات A4 لسلعة: ${data.productName} (عدد ${copies} ملصق)`
    });

    return true;
  } catch (error) {
    console.error('Error generating A4 sticker sheet:', error);
    return false;
  }
}

/**
 * 3. Export PNG Image of the Barcode Label (for WhatsApp & Mobile Bluetooth Print apps like RawBT)
 */
export async function exportBarcodeLabelImage(data: BarcodeLabelData): Promise<boolean> {
  try {
    const canvas = await renderBarcodeLabelToCanvas(data);
    const imgData = canvas.toDataURL('image/png', 1.0);
    const cleanName = (data.productName || 'ملصق').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    const fileName = `ملصق_${cleanName}_${data.barcode}.png`;

    await saveAndShareFile({
      fileName,
      data: imgData,
      isBase64: true,
      mimeType: 'image/png',
      title: `صورة ملصق باركود - ${data.productName}`,
      text: `ملصق باركود: ${data.productName} | السعر: ${data.price} ${data.currency} | الباركود: ${data.barcode}`
    });

    return true;
  } catch (error) {
    console.error('Error saving barcode image:', error);
    return false;
  }
}

/**
 * 4. Direct Isolated Print Window for Thermal Label Printers and Browser
 */
export async function printBarcodeLabelsDirect(data: BarcodeLabelData): Promise<void> {
  const { widthMm, heightMm } = getLabelDimensions(data.size);
  const copies = Math.max(1, Math.min(data.copies, 500));

  try {
    const canvas = await renderBarcodeLabelToCanvas(data);
    const imgData = canvas.toDataURL('image/png', 1.0);

    let labelsHtml = '';
    for (let i = 0; i < copies; i++) {
      labelsHtml += `
        <div class="sticker-page-item">
          <img src="${imgData}" alt="ملصق باركود" style="width: ${widthMm}mm; height: ${heightMm}mm; display: block; object-fit: contain;" />
        </div>
      `;
    }

    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>طباعة ملصق باركود - ${data.productName}</title>
        <style>
          @page {
            size: ${widthMm}mm ${heightMm}mm;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Cairo', Tahoma, sans-serif;
            background: #ffffff;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sticker-page-item {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            page-break-after: always;
            break-after: page;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
          }
          .sticker-page-item:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          @media screen {
            body {
              padding: 20px;
              background: #f1f5f9;
              display: flex;
              flex-direction: column;
              gap: 15px;
              align-items: center;
            }
            .sticker-page-item {
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
              background: #ffffff;
            }
          }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } catch (err) {
    console.error('Error opening direct print window:', err);
    window.print();
  }
}

