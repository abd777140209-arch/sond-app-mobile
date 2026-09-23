/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 🖨️ Receipt & WhatsApp Utility
 * مشاركة سند استلام جهاز صيانة/تفليش عبر الواتساب أو الطباعة الحرارية (Thermal 80mm/58mm)
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { saveAndShareFile } from '../utils/fileExport';
import { getSafeHtml2CanvasOptions } from '../utils/pdfHelper';
import { ThermalPrinterSettings } from '../types';
import { loadThermalPrinterSettings, DEFAULT_GPU80300I_SETTINGS, shouldRouteToRawBT, isAndroidClient } from '../utils/printerConfig';

export interface ReceiptPrintData {
  ticket_id?: string;
  ticketNumber?: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  imei?: string;
  serialNumber?: string;
  serviceType?: string;
  problemDescription?: string;
  issueDescription?: string;
  estimatedCost?: number | string;
  advancePayment?: number | string;
  depositAmount?: number | string;
  createdAt?: string;
}

export interface SalesInvoicePrintData {
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  date: string;
  paymentMethod?: string;
  items: Array<{
    name: string;
    quantity: number;
    sellingPrice: number;
    total: number;
  }>;
  totalAmount: number;
  discount?: number;
  finalAmount: number;
  notes?: string;
  storeLogoUrl?: string;
  storeAddress?: string;
  storePhone?: string;
  paperSize?: '80mm' | '58mm';
  qrCodeUrl?: string;
  cashierName?: string;
  printerSettings?: ThermalPrinterSettings;
}

/**
 * توليد كود الباركود الخطي كصورة بدقة عالية (Code 128)
 */
export const generateBarcodeDataUrl = (text: string): string => {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: 1.8,
      height: 38,
      displayValue: true,
      fontSize: 11,
      font: 'monospace',
      textMargin: 2,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Barcode generation warning:', err);
    return '';
  }
};

/**
 * 1. توليد رابط واتساب مباشر لإرسال سند استلام باللغة العربية
 */
export const generateWhatsAppReceiptLink = (
  shopName: string = 'مركز سند لصيانة وبرمجة الهواتف',
  receiptData: ReceiptPrintData,
  currency: string = 'ريال'
): string => {
  const ticket = receiptData.ticket_id || receiptData.ticketNumber || 'مؤقت';
  const imeiVal = receiptData.imei || receiptData.serialNumber || 'غير مدخل';
  const issue = receiptData.problemDescription || receiptData.issueDescription || 'صيانة عامة وتفليش';
  const cost = receiptData.estimatedCost || 0;
  const advance = receiptData.advancePayment || receiptData.depositAmount || 0;
  const dateStr = receiptData.createdAt 
    ? new Date(receiptData.createdAt).toLocaleDateString('ar-YE')
    : new Date().toLocaleDateString('ar-YE');

  const text = `
📄 *سند استلام جهاز - ${shopName}*
----------------------------------
📌 *رقم السند:* ${ticket}
👤 *الزبون:* ${receiptData.customerName}
📱 *الجهاز:* ${receiptData.deviceModel}
🔢 *IMEI:* ${imeiVal}
🛠️ *نوع الخدمة:* ${receiptData.serviceType === 'software' ? 'برمجة وتفليش (Software)' : receiptData.serviceType === 'hardware' ? 'صيانة دقيقة (Hardware)' : 'صيانة + برمجة'}
📝 *المطلوب:* ${issue}
----------------------------------
💰 *التكلفة التقديرية:* ${cost} ${currency}
💵 *الواصل (العربون):* ${advance} ${currency}
📅 *تاريخ الاستلام:* ${dateStr}
----------------------------------
شكراً لثقتكم بنا! 🌸
*ملاحظة: المحل غير مسؤول عن الأجهزة التي تتأخر أكثر من 30 يوماً.*
  `.trim();

  const encodedText = encodeURIComponent(text);
  const cleanPhone = receiptData.customerPhone ? receiptData.customerPhone.replace(/[^0-9]/g, '') : '';

  return cleanPhone 
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
};

/**
 * 2. طباعة سند استلام حراري (Thermal Printer 80mm) مباشرة مع شروط الورشة
 */
export const printReceiptHTML = (
  shopName: string = 'مركز سند لصيانة وبرمجة الهواتف',
  receiptData: ReceiptPrintData,
  currency: string = 'ريال'
): void => {
  const ticket = receiptData.ticket_id || receiptData.ticketNumber || `SND-${Date.now().toString().slice(-6)}`;
  const imeiVal = receiptData.imei || receiptData.serialNumber || '—';
  const issue = receiptData.problemDescription || receiptData.issueDescription || 'صيانة وتفليش';
  const cost = receiptData.estimatedCost || 0;
  const advance = receiptData.advancePayment || receiptData.depositAmount || 0;
  const dateStr = receiptData.createdAt 
    ? new Date(receiptData.createdAt).toLocaleDateString('ar-YE')
    : new Date().toLocaleDateString('ar-YE');

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <title>سند استلام - ${receiptData.customerName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        body { 
          font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; 
          width: 78mm; 
          padding: 8px; 
          margin: 0 auto; 
          text-align: center;
          color: #000;
          background: #fff;
        }
        .header { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
        .sub-header { font-size: 11px; margin-bottom: 8px; color: #333; }
        .line { border-bottom: 1px dashed #000; margin: 8px 0; }
        .ticket-no { font-size: 14px; font-weight: bold; background: #eee; padding: 4px; margin: 6px 0; border: 1px solid #000; }
        .details { text-align: right; font-size: 12px; line-height: 1.6; }
        .details b { color: #000; }
        .price-box { margin-top: 8px; padding: 6px; border: 1px solid #000; text-align: right; font-size: 12px; font-weight: bold; }
        .footer { font-size: 9px; margin-top: 12px; text-align: center; line-height: 1.4; }
      </style>
    </head>
    <body>
      <div class="header">${shopName}</div>
      <div class="sub-header">مركز صيانة وبرمجة الهواتف الذكية</div>
      <div class="ticket-no">رقم الكارت: ${ticket}</div>
      <div class="line"></div>
      
      <div class="details">
        <b>تاريخ الاستلام:</b> ${dateStr}<br/>
        <b>اسم الزبون:</b> ${receiptData.customerName}<br/>
        <b>رقم الهاتف:</b> ${receiptData.customerPhone}<br/>
        <b>موديل الجهاز:</b> ${receiptData.deviceModel}<br/>
        <b>IMEI / السيريال:</b> ${imeiVal}<br/>
        <b>وصف العطل:</b> ${issue}<br/>
      </div>

      <div class="price-box">
        التكلفة التقديرية: ${cost} ${currency}<br/>
        العربون المستلم: ${advance} ${currency}<br/>
        المتبقي: ${Number(cost) - Number(advance)} ${currency}
      </div>

      <div class="line"></div>
      
      <div class="footer">
        📌 <b>شروط الورشة:</b><br/>
        1. المحل غير مسؤول عن البيانات والحسابات بداخل الجهاز.<br/>
        2. المحل غير مسؤول عن الأجهزة التي تتأخر عن 30 يوماً.<br/>
        3. يرجى إحضار السند عند الاستلام.<br/>
        <br/>
        <b>شكراً لزيارتكم وجميل ثقتكم! 🌸</b>
      </div>

      <script>
        window.onload = function() { 
          setTimeout(function() {
            window.print(); 
            window.close(); 
          }, 250);
        }
      </script>
    </body>
    </html>
  `;

  executeUniversalThermalPrint(htmlContent);
};

/**
 * طباعة حرارية مباشرة عبر حاوية DOM (تعمل كاحتياطي عند الحاجة)
 */
export const executeDirectDomThermalPrint = (htmlContent: string): void => {
  try {
    const existing = document.getElementById('sanad-thermal-print-container');
    if (existing && document.body.contains(existing)) {
      document.body.removeChild(existing);
    }

    const printContainer = document.createElement('div');
    printContainer.id = 'sanad-thermal-print-container';
    printContainer.innerHTML = htmlContent;
    document.body.appendChild(printContainer);

    document.body.classList.add('sanad-printing-thermal');

    const cleanup = () => {
      document.body.classList.remove('sanad-printing-thermal');
      if (document.body.contains(printContainer)) {
        document.body.removeChild(printContainer);
      }
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.warn('Native window.print failed:', err);
      }
      setTimeout(cleanup, 2500);
    }, 120);
  } catch (error) {
    console.error('executeDirectDomThermalPrint failed:', error);
  }
};

/**
 * محرك طباعة حرارية موحد فوري وشامل يعمل 100% على الكمبيوتر (وندوز / USB / شبكة / كروم) وأندرويد ونقاط البيع
 * على الكمبيوتر: يفتح نافذة طباعة وندوز الرسمية لطابعة الإيصالات الحرارية مباشرة وبدقة عالية
 */
export const executeUniversalThermalPrint = (htmlContent: string): void => {
  try {
    // 1. إذا كانت بطاقة الفاتورة معروضة وموجودة داخل المودال، نستخدم الطباعة المباشرة لكروم فوراً
    const modalInvoiceCard = document.getElementById('invoice-printable-card');
    if (modalInvoiceCard && document.getElementById('invoice_modal_overlay')) {
      document.body.classList.add('modal-invoice-open');
      window.focus();
      window.print();
      return;
    }

    // 2. تنظيف أي إطار طباعة سابق
    const existingIframe = document.getElementById('sanad-universal-thermal-iframe');
    if (existingIframe && existingIframe.parentNode) {
      existingIframe.parentNode.removeChild(existingIframe);
    }

    // 3. إنشاء إطار طباعة (IFrame) بأبعاد حقيقية خارج حدود الشاشة المرئية
    // متصفح Chrome على الكمبيوتر يتجاهل تماماً أمر print() إذا كان العرض أو الارتفاع صفراً (width:0, height:0)!
    const iframe = document.createElement('iframe');
    iframe.id = 'sanad-universal-thermal-iframe';
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '380px'; // أبعاد قياسية لرول 80mm تضمن استجابة محرك كروم
    iframe.style.height = '800px';
    iframe.style.border = '0';
    iframe.style.visibility = 'visible'; // يجب أن تكون visible حتى لا يعتبرها كروم عنصراً مهملاً
    iframe.setAttribute('title', 'Sanad Thermal Print Frame');
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    if (win) {
      const doc = win.document;
      doc.open();
      doc.write(htmlContent);
      doc.close();

      const doPrint = () => {
        try {
          win.focus();
          win.print();
        } catch (e) {
          console.warn('Iframe print failed, falling back to direct print:', e);
          executeDirectDomThermalPrint(htmlContent);
        }
        setTimeout(() => {
          try {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          } catch (e) {}
        }, 5000);
      };

      if (doc.readyState === 'complete') {
        setTimeout(doPrint, 120);
      } else {
        iframe.onload = () => setTimeout(doPrint, 120);
        setTimeout(doPrint, 350); // صمام أمان في حال عدم إطلاق onload
      }
      return;
    }

    // احتياطي مباشر عبر DOM
    executeDirectDomThermalPrint(htmlContent);
  } catch (error) {
    console.error('executeUniversalThermalPrint failed:', error);
    executeDirectDomThermalPrint(htmlContent);
  }
};

/**
 * Helper to generate a crisp PNG Data URL for standard electronic invoice QR codes
 */
export const generateInvoiceQrPng = async (
  invoiceData: SalesInvoicePrintData,
  shopName: string,
  currency: string
): Promise<string> => {
  if (invoiceData.qrCodeUrl && invoiceData.qrCodeUrl.startsWith('data:image/png')) {
    return invoiceData.qrCodeUrl;
  }

  const qrPayload = JSON.stringify({
    seller: shopName,
    vatNumber: "300012345600003",
    timestamp: invoiceData.date,
    total: invoiceData.finalAmount,
    currency: currency,
    invoiceNum: invoiceData.invoiceNumber
  });

  try {
    return await QRCode.toDataURL(qrPayload, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (e) {
    console.warn('Failed to generate PNG QR code:', e);
    return '';
  }
};

/**
 * 3. إنشاء كود HTML موحد ودقيق لفاتورة المبيعات الحرارية (80mm / 58mm) متوافق تماماً مع طابعة GP-U80300I
 */
export const buildSalesInvoiceThermalHTML = (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال',
  qrPngUrl: string = ''
): string => {
  const pSettings: ThermalPrinterSettings = invoiceData.printerSettings || loadThermalPrinterSettings();
  const is58 = (invoiceData.paperSize || pSettings.paperWidth) === '58mm';
  
  // أبعاد الورق وعرض الطباعة الفعلي (GP-U80300I العرض القياسي 72mm على رول 80mm)
  const printableWidth = pSettings.printableWidthMm 
    ? `${pSettings.printableWidthMm}mm` 
    : (is58 ? '52mm' : '72mm');

  // مقاييس الخطوط
  let baseFontSize = '11.5px';
  let detailsFontSize = '10.5px';
  let finalFontSize = '13.5px';
  let headerFontSize = '16px';

  if (pSettings.fontScale === 'small') {
    baseFontSize = '10px';
    detailsFontSize = '9px';
    finalFontSize = '12px';
    headerFontSize = '14px';
  } else if (pSettings.fontScale === 'large') {
    baseFontSize = '13px';
    detailsFontSize = '11.5px';
    finalFontSize = '15px';
    headerFontSize = '18px';
  } else if (pSettings.fontScale === 'extralarge') {
    baseFontSize = '14.5px';
    detailsFontSize = '12.5px';
    finalFontSize = '17px';
    headerFontSize = '20px';
  }

  // نوع الخط
  let fontFamilyStr = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";
  if (pSettings.fontFamily === 'tahoma') {
    fontFamilyStr = "Tahoma, 'Segoe UI', Arial, sans-serif";
  } else if (pSettings.fontFamily === 'monospace') {
    fontFamilyStr = "'Courier New', Courier, monospace, 'Cairo'";
  } else if (pSettings.fontFamily === 'system') {
    fontFamilyStr = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  }

  // كثافة وسواد الطباعة
  let densityCss = 'color: #000000 !important; font-weight: 700;';
  if (pSettings.printDensity === 'extradark') {
    densityCss = 'color: #000000 !important; font-weight: 850; -webkit-font-smoothing: none; text-shadow: 0 0 0.35px #000000;';
  } else if (pSettings.printDensity === 'normal') {
    densityCss = 'color: #111827; font-weight: 600;';
  }

  // نمط حدود وفواصل الجداول
  let borderStyle = '1.5px dashed #4b5563';
  if (pSettings.tableBorderType === 'solid') {
    borderStyle = '1.5px solid #000000';
  } else if (pSettings.tableBorderType === 'dotted') {
    borderStyle = '2px dotted #374151';
  } else if (pSettings.tableBorderType === 'double') {
    borderStyle = '3px double #000000';
  }

  // تباعد الأسطر
  const lineSpacingRatio = pSettings.lineSpacing === 'compact' ? 1.3 : (pSettings.lineSpacing === 'relaxed' ? 1.65 : 1.45);

  const dateStr = invoiceData.date
    ? new Date(invoiceData.date).toLocaleDateString('ar-YE') + ' ' + new Date(invoiceData.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('ar-YE');

  const itemsRowsHtml = invoiceData.items.map((item) => `
    <tr>
      <td style="text-align: right; padding: 5px 0; border-bottom: ${borderStyle}; vertical-align: top;">
        <div style="font-weight: 800; color: #000000; font-size: ${baseFontSize}; line-height: 1.3;">${item.name}</div>
        <div style="font-size: ${detailsFontSize}; color: #374151; font-family: monospace; font-weight: 700; margin-top: 1px;">${item.sellingPrice.toLocaleString()} ${currency}</div>
      </td>
      <td style="text-align: center; padding: 5px 0; font-weight: 800; font-family: monospace; font-size: ${baseFontSize}; border-bottom: ${borderStyle}; vertical-align: top; color: #000000;">${item.quantity}</td>
      <td style="text-align: left; padding: 5px 0; font-weight: 800; font-family: monospace; font-size: ${baseFontSize}; border-bottom: ${borderStyle}; vertical-align: top; color: #000000;">${item.total.toLocaleString()} ${currency}</td>
    </tr>
  `).join('');

  const footerNote = invoiceData.notes || pSettings.customFooterNote || localStorage.getItem('sanad_invoice_footer_note') || '';
  const resolvedQr = qrPngUrl || invoiceData.qrCodeUrl || '';
  const qrPixelSize = pSettings.qrSize === 'small' ? 95 : (pSettings.qrSize === 'large' ? 155 : 125);
  const barcodeUrl = pSettings.showBarcode !== false ? generateBarcodeDataUrl(invoiceData.invoiceNumber) : '';
  const feedLines = pSettings.feedLinesCount ?? 2;
  const feedDistanceMm = Math.max(8, (pSettings.feedBeforeCutMm || 12) + (feedLines * 2.5));

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <title>فاتورة مبيعات - ${invoiceData.invoiceNumber}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page {
          size: ${is58 ? '58mm' : '80mm'} auto;
          margin: ${pSettings.marginTopMm ?? 2}mm 0 ${pSettings.marginBottomMm ?? 4}mm 0;
        }
        @media print {
          html, body {
            width: ${printableWidth} !important;
            margin: 0 auto !important;
            padding: 2mm 1mm ${feedDistanceMm}mm 1mm !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
        * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }
        body { 
          font-family: ${fontFamilyStr}; 
          width: ${printableWidth}; 
          padding: 6px 4px ${feedDistanceMm}mm 4px; 
          margin: 0 auto; 
          text-align: center;
          background: #ffffff;
          font-size: ${baseFontSize};
          line-height: ${lineSpacingRatio};
          ${densityCss}
        }
        .logo { max-width: 54px; max-height: 54px; margin: 0 auto 4px auto; display: block; border-radius: 6px; }
        .header { font-size: ${headerFontSize}; font-weight: 900; margin-bottom: 2px; color: #000000; letter-spacing: normal !important; }
        .sub-header { font-size: ${detailsFontSize}; margin-bottom: 2px; color: #1f2937; font-weight: 800; }
        .contact { font-size: ${detailsFontSize}; color: #374151; margin-bottom: 3px; font-weight: 700; }
        .tax-info { font-size: ${detailsFontSize}; color: #000000; font-weight: 800; margin-bottom: 4px; border: 1px solid #000; padding: 2px 4px; display: inline-block; border-radius: 4px; }
        .line-divider { border-bottom: ${borderStyle}; margin: 7px 0; }
        .details-grid { text-align: right; font-size: ${detailsFontSize}; line-height: 1.6; }
        .details-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .details-label { color: #374151; font-weight: 700; }
        .details-val { font-weight: 850; color: #000000; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: ${detailsFontSize}; }
        th { border-bottom: ${borderStyle}; padding: 4px 0; font-size: ${baseFontSize}; font-weight: 900; color: #000000; }
        .totals-box { margin-top: 6px; text-align: right; font-size: ${baseFontSize}; line-height: 1.7; }
        .totals-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .final-row { display: flex; justify-content: space-between; align-items: center; font-size: ${finalFontSize}; font-weight: 900; color: #000000; border-top: 2px solid #000000; padding-top: 5px; margin-top: 5px; }
        .policy { font-size: ${detailsFontSize}; margin-top: 8px; padding: 5px; border: 1px dashed #6b7280; background: #fafafa; border-radius: 4px; color: #000000; line-height: 1.45; text-align: center; font-weight: 700; }
        .badge { font-size: 9px; font-weight: 800; color: #047857; margin-top: 6px; }
        .dev-tag { font-size: 8px; color: #6b7280; margin-top: 2px; }
        .barcode-wrap { margin: 8px 0 4px 0; text-align: center; }
        .qr-wrap { margin: 8px auto 4px auto; display: inline-block; padding: 4px; background: #ffffff; border: 1.5px solid #6b7280; border-radius: 6px; }
        .footer-greeting { font-size: ${detailsFontSize}; color: #000000; margin-top: 6px; margin-bottom: 6px; font-weight: 800; }
        .cutter-guide { margin-top: ${feedDistanceMm}mm; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 8px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      ${pSettings.showLogo !== false && invoiceData.storeLogoUrl ? `<img src="${invoiceData.storeLogoUrl}" class="logo" alt="Logo" />` : ''}
      
      ${pSettings.showHeaderName !== false ? `<div class="header">${shopName}</div>` : ''}
      <div class="sub-header">${pSettings.customHeaderTitle || 'فاتورة مبيعات نقدية'}</div>

      ${(pSettings.showBranchAddress !== false && invoiceData.storeAddress) || (pSettings.showPhone !== false && invoiceData.storePhone) ? `
        <div class="contact">
          ${pSettings.showBranchAddress !== false && invoiceData.storeAddress ? `<span>${invoiceData.storeAddress}</span>` : ''}
          ${pSettings.showPhone !== false && invoiceData.storePhone ? ` | <span>هاتف: ${invoiceData.storePhone}</span>` : ''}
        </div>
      ` : ''}

      ${pSettings.showTaxNumber && pSettings.taxNumber ? `
        <div class="tax-info">الرقم الضريبي / السجل: ${pSettings.taxNumber}</div>
      ` : ''}

      <div class="line-divider"></div>
      
      <div class="details-grid">
        <div class="details-row">
          <span class="details-label">رقم الفاتورة:</span>
          <span class="details-val" style="font-family: monospace; font-size: ${baseFontSize};">${invoiceData.invoiceNumber}</span>
        </div>
        <div class="details-row">
          <span class="details-label">التاريخ والوقت:</span>
          <span class="details-val">${dateStr}</span>
        </div>
        ${pSettings.showCustomerInfo !== false ? `
          <div class="details-row">
            <span class="details-label">العميل المستلم:</span>
            <span class="details-val">${invoiceData.customerName || 'عميل سفري / نقدي'}</span>
          </div>
        ` : ''}
        ${pSettings.showCashierName !== false && (invoiceData.cashierName || localStorage.getItem('sanad_cashier_name')) ? `
          <div class="details-row">
            <span class="details-label">الكاشير / البائع:</span>
            <span class="details-val">${invoiceData.cashierName || localStorage.getItem('sanad_cashier_name') || 'أحمد الكاشير'}</span>
          </div>
        ` : ''}
        ${pSettings.showPaymentMethod !== false ? `
          <div class="details-row">
            <span class="details-label">طريقة السداد:</span>
            <span class="details-val">${invoiceData.paymentMethod || 'نقدي (كاش)'}</span>
          </div>
        ` : ''}
      </div>

      <div class="line-divider"></div>

      <table>
        <thead>
          <tr>
            <th style="text-align: right; width: 50%;">السلعة</th>
            <th style="text-align: center; width: 20%;">الكمية</th>
            <th style="text-align: left; width: 30%;">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
      </table>

      <div class="line-divider"></div>

      <div class="totals-box">
        <div class="totals-row">
          <span>المجموع الفرعي:</span>
          <span style="font-family: monospace; font-weight: 800;">${invoiceData.totalAmount.toLocaleString()} ${currency}</span>
        </div>
        ${invoiceData.discount ? `
          <div class="totals-row" style="color: #dc2626;">
            <span>خصم خاص مخصوم:</span>
            <span style="font-family: monospace; font-weight: 800;">- ${invoiceData.discount.toLocaleString()} ${currency}</span>
          </div>
        ` : ''}
        <div class="final-row">
          <span>الصافي النهائي للتسديد:</span>
          <span style="font-family: monospace;">${invoiceData.finalAmount.toLocaleString()} ${currency}</span>
        </div>
      </div>

      ${pSettings.showBarcode !== false && barcodeUrl ? `
        <div class="barcode-wrap">
          <img src="${barcodeUrl}" alt="${invoiceData.invoiceNumber}" style="max-width: 96%; height: 38px;" />
        </div>
      ` : ''}

      ${pSettings.showQrCode !== false && resolvedQr ? `
        <div class="qr-wrap">
          <img src="${resolvedQr}" alt="QR Code" style="width: ${qrPixelSize}px; height: ${qrPixelSize}px; display: block;" />
          <div style="font-size: 8px; font-weight: 800; color: #374151; margin-top: 2px;">رمز التحقق والفوترة</div>
        </div>
      ` : ''}

      ${pSettings.showReturnPolicy !== false && footerNote ? `<div class="policy">${footerNote}</div>` : ''}

      ${pSettings.footerGreeting ? `<div class="footer-greeting">${pSettings.footerGreeting}</div>` : ''}

      <div class="badge">✓ تم الحفظ بنجاح في النظام المحاسبي</div>
      <div class="dev-tag">برمجة وتطوير م. عبدالمجيد المحواشي (اليمن)</div>

      <!-- مسافة التغذية قبل قطع السكين في GP-U80300I -->
      <div class="cutter-guide">✂ موضع سكين القص الآلي للطابعة</div>
    </body>
    </html>
  `;
};

/**
 * 4. طباعة فاتورة مبيعات حرارية (Thermal Printer 80mm / Bluetooth / POS)
 * محرك شامل ينفذ أمر الطباعة فوراً ويمنع مشكلة "صوت بلا تنفيذ"
 */
export const printSalesInvoiceThermalHTML = async (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال'
): Promise<void> => {
  const pSettings = invoiceData.printerSettings || loadThermalPrinterSettings();

  // يتم التوجيه إلى RawBT فقط إذا تم تحديد بيئة أندرويد RawBT أو كان الجهاز أندرويد مع تفعيل الربط المباشر
  if (shouldRouteToRawBT(pSettings)) {
    try {
      const ok = await printInvoiceViaRawBT(shopName, invoiceData, currency);
      if (ok) return;
    } catch (e) {
      console.warn('RawBT print direct attempt skipped, proceeding to native print:', e);
    }
  }

  // على الكمبيوتر (وندوز / USB / شبكة) أو عند تعذر RawBT:
  const qrPng = await generateInvoiceQrPng(invoiceData, shopName, currency);
  const htmlContent = buildSalesInvoiceThermalHTML(shopName, invoiceData, currency, qrPng);
  executeUniversalThermalPrint(htmlContent);
};

/**
 * 4.1 طباعة تذكرة فحص واختبار فورية لطابعة Gprinter GP-U80300I
 * تفحص: وضوح الحروف العربية، تناسق الخطوط، الأرقام والأسعار، الباركود، كود QR، وقص الورقة
 */
export const printTestTicketGPU80300I = async (
  shopName: string = 'مركز سند للأجهزة الذكية',
  customSettings?: ThermalPrinterSettings,
  currency: string = 'ريال'
): Promise<void> => {
  const pSettings = customSettings || loadThermalPrinterSettings();
  const testInvoiceData: SalesInvoicePrintData = {
    invoiceNumber: 'TEST-GP80-9901',
    customerName: 'فحص تجريبي (Test Print GP-U80300I)',
    date: new Date().toISOString(),
    paymentMethod: 'نقدي (فحص فوري)',
    cashierName: 'فحص النظام الآلي',
    paperSize: pSettings.paperWidth === '58mm' ? '58mm' : '80mm',
    items: [
      { name: 'فحص اتصال الحروف العربية: شركة مبيعات', quantity: 1, sellingPrice: 1500, total: 1500 },
      { name: 'فحص الأرقام والأسعار: 1234567890', quantity: 2, sellingPrice: 3500, total: 7000 },
      { name: 'فحص خطوط وتغذية الورق وموضع السكين', quantity: 1, sellingPrice: 1500, total: 1500 }
    ],
    totalAmount: 10000,
    discount: 500,
    finalAmount: 9500,
    notes: 'تذكرة اختبار وتوافق طابعة Gprinter GP-U80300I بنجاح. تم التأكد من سواد الطباعة، وضوح الباركود، وعدم تقطيع الحروف العربية.',
    printerSettings: pSettings
  };

  if (shouldRouteToRawBT(pSettings)) {
    try {
      const ok = await printInvoiceViaRawBT(shopName, testInvoiceData, currency);
      if (ok) return;
    } catch (e) {
      console.warn('RawBT test print failed, falling back:', e);
    }
  }

  await printSalesInvoiceThermalHTML(shopName, testInvoiceData, currency);
};

/**
 * 4.2 طباعة فحص "نص قصير" بخط TrueType مع عدد الخطوط وقص الورق (مطابق لتطبيق RawBT)
 * يفحص خروج الحروف العربية متصلة وبدون رموز عشوائية
 */
export const printShortTextTestTrueType = async (
  shopName: string = 'سند للمحاسبة والخدمات',
  customSettings?: ThermalPrinterSettings,
  currency: string = 'ريال'
): Promise<void> => {
  const pSettings = customSettings || loadThermalPrinterSettings();
  const testData: SalesInvoicePrintData = {
    invoiceNumber: 'TEST-TT-01',
    customerName: 'فحص نص قصير - خط TrueType',
    date: new Date().toISOString(),
    paymentMethod: 'فحص سريع',
    cashierName: 'فحص النظام',
    paperSize: pSettings.paperWidth === '58mm' ? '58mm' : '80mm',
    items: [
      { name: 'فحص خط TrueType: سند للأجهزة الذكية', quantity: 1, sellingPrice: 100, total: 100 }
    ],
    totalAmount: 100,
    discount: 0,
    finalAmount: 100,
    notes: '✓ تم تفعيل خط TrueType بنجاح.\nحروف عربية متصلة 100% وخالية من الرموز العشوائية.',
    printerSettings: pSettings
  };

  if (shouldRouteToRawBT(pSettings)) {
    try {
      const ok = await printInvoiceViaRawBT(shopName, testData, currency);
      if (ok) return;
    } catch (e) {
      console.warn('RawBT short text print failed, falling back:', e);
    }
  }

  await printSalesInvoiceThermalHTML(shopName, testData, currency);
};

/**
 * 4.3 إرسال الفاتورة أو التذكرة مباشرة إلى تطبيق RawBT على الأندرويد باستخدام TrueType Graphics
 * يحول الفاتورة إلى صورة نقطية متطابقة مع رأس الطباعة الحراري (576 dots لطابعة 80mm أو 384 dots لـ 58mm)
 * لضمان عدم ظهور أي رموز عشوائية وطباعة الحروف العربية كاملة ومتصلة
 */
export const printInvoiceViaRawBT = async (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال'
): Promise<boolean> => {
  const pSettings = invoiceData.printerSettings || loadThermalPrinterSettings();
  const is58 = (invoiceData.paperSize || pSettings.paperWidth) === '58mm';
  // نقاط رأس الطباعة الحراري الفيزيائي: 576 نقطة لـ GP-U80300I 80mm و 384 نقطة لـ 58mm
  const targetDotsWidth = is58 ? 384 : 576;

  let qrPng = '';
  try {
    qrPng = await generateInvoiceQrPng(invoiceData, shopName, currency);
  } catch (e) {
    qrPng = invoiceData.qrCodeUrl || '';
  }

  // إذا كان العميل على جهاز كمبيوتر وليس أندرويد (ولا يطلب أندرويد إجبارياً)، يتم التوجيه مباشرة للطباعة الحرارية للكمبيوتر
  if (!isAndroidClient() && pSettings.printEnvironment !== 'android_rawbt') {
    console.info('PC environment detected: executing native thermal print instead of RawBT intent.');
    const htmlContent = buildSalesInvoiceThermalHTML(shopName, invoiceData, currency, qrPng);
    executeUniversalThermalPrint(htmlContent);
    return true;
  }

  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'fixed';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '0';
  tempContainer.style.width = `${targetDotsWidth}px`;
  tempContainer.style.maxWidth = `${targetDotsWidth}px`;
  tempContainer.style.background = '#ffffff';
  tempContainer.style.color = '#000000';
  tempContainer.style.padding = '12px 14px 24px 14px';
  tempContainer.style.direction = 'rtl';
  tempContainer.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";
  tempContainer.innerHTML = buildSalesInvoiceThermalHTML(shopName, invoiceData, currency, qrPng);

  document.body.appendChild(tempContainer);

  try {
    const images = Array.from(tempContainer.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // الرندر بمقياس 1 ينتج صورة خفيفة جداً وعالية الوضوح تتسع تماماً داخل بروتوكول RawBT Intent
    const canvas = await html2canvas(tempContainer, getSafeHtml2CanvasOptions({
      scale: 1,
      useCORS: true,
      backgroundColor: '#ffffff'
    }));

    const base64Data = canvas.toDataURL('image/png').split(',')[1];
    
    // إنشاء رابط استدعاء RawBT المباشر
    const rawBtUri = `rawbt:data:image/png;base64,${base64Data}`;
    
    // استخدام عنصر رابط وهمي لمنع حظر المتصفحات للروابط المنبثقة
    const link = document.createElement('a');
    link.href = rawBtUri;
    link.target = '_self';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 400);

    return true;
  } catch (err) {
    console.warn('RawBT print direct intent failed, falling back to standard thermal print:', err);
    const htmlContent = buildSalesInvoiceThermalHTML(shopName, invoiceData, currency, qrPng);
    executeUniversalThermalPrint(htmlContent);
    return false;
  } finally {
    if (document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }
  }
};

/**
 * 5. توليد وحفظ فاتورة مبيعات حرارية كـ PDF عالي الدقة وبأعلى معايير الأناقة والوضوح
 */
export const generateSalesInvoiceThermalPDF = async (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال'
): Promise<boolean> => {
  const pSettings: ThermalPrinterSettings = invoiceData.printerSettings || loadThermalPrinterSettings();
  const is58 = (invoiceData.paperSize || pSettings.paperWidth) === '58mm';
  const paperWidthMm = is58 ? 58 : 80;
  const containerWidthPx = is58 ? 310 : 380;

  // توليد كود الاستجابة السريعة (QR Code) كصورة PNG عالية النقاء
  let qrPngUrl = '';
  if (pSettings.showQrCode !== false) {
    try {
      qrPngUrl = await generateInvoiceQrPng(invoiceData, shopName, currency);
    } catch (e) {
      qrPngUrl = invoiceData.qrCodeUrl || '';
    }
  }

  // توليد الباركود الخطي كصورة
  const barcodeUrl = (pSettings.showBarcode !== false)
    ? generateBarcodeDataUrl(invoiceData.invoiceNumber)
    : '';

  // نوع الخط الحراري
  let fontFamilyStr = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";
  if (pSettings.fontFamily === 'tahoma') {
    fontFamilyStr = "Tahoma, 'Segoe UI', Arial, sans-serif";
  } else if (pSettings.fontFamily === 'monospace') {
    fontFamilyStr = "monospace, 'Courier New', Courier";
  } else if (pSettings.fontFamily === 'system') {
    fontFamilyStr = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  }

  // مقياس حجم الخط
  let baseFontSize = is58 ? '11px' : '12px';
  let headerFontSize = is58 ? '15px' : '17px';
  let detailsFontSize = is58 ? '10px' : '11px';
  let finalFontSize = is58 ? '13.5px' : '15px';

  if (pSettings.fontScale === 'small') {
    baseFontSize = is58 ? '9.5px' : '10.5px';
    headerFontSize = is58 ? '13px' : '15px';
    detailsFontSize = is58 ? '8.5px' : '9.5px';
    finalFontSize = is58 ? '12px' : '13.5px';
  } else if (pSettings.fontScale === 'large') {
    baseFontSize = is58 ? '12.5px' : '13.5px';
    headerFontSize = is58 ? '16px' : '18.5px';
    detailsFontSize = is58 ? '11px' : '12px';
    finalFontSize = is58 ? '15px' : '16.5px';
  } else if (pSettings.fontScale === 'extralarge') {
    baseFontSize = is58 ? '13.5px' : '15px';
    headerFontSize = is58 ? '17px' : '20px';
    detailsFontSize = is58 ? '12px' : '13.5px';
    finalFontSize = is58 ? '16.5px' : '18.5px';
  }

  // كثافة وسواد الطباعة
  let densityWeight = '700';
  let densityColor = '#111827';
  if (pSettings.printDensity === 'dark') {
    densityWeight = '800';
    densityColor = '#000000';
  } else if (pSettings.printDensity === 'extradark') {
    densityWeight = '900';
    densityColor = '#000000';
  }

  // نمط فواصل الجداول
  let borderStyle = '1.5px dashed #6b7280';
  if (pSettings.tableBorderType === 'solid') {
    borderStyle = '1.5px solid #000000';
  } else if (pSettings.tableBorderType === 'dotted') {
    borderStyle = '2px dotted #374151';
  } else if (pSettings.tableBorderType === 'double') {
    borderStyle = '3px double #000000';
  }

  const lineSpacing = pSettings.lineSpacing === 'compact' ? '1.3' : (pSettings.lineSpacing === 'relaxed' ? '1.65' : '1.45');

  const dateStr = invoiceData.date
    ? new Date(invoiceData.date).toLocaleDateString('ar-YE') + ' ' + new Date(invoiceData.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('ar-YE');

  const itemsRowsHtml = invoiceData.items.map((item) => `
    <tr>
      <td style="text-align: right; padding: 6px 0; border-bottom: ${borderStyle}; vertical-align: top;">
        <div style="font-weight: 800; color: ${densityColor}; font-size: ${baseFontSize}; line-height: 1.3;">${item.name}</div>
        <div style="font-size: ${detailsFontSize}; color: #4b5563; font-family: monospace; font-weight: 700; margin-top: 1px;">${item.sellingPrice.toLocaleString()} ${currency}</div>
      </td>
      <td style="text-align: center; padding: 6px 0; font-weight: 900; font-family: monospace; font-size: ${baseFontSize}; color: ${densityColor}; border-bottom: ${borderStyle}; vertical-align: top;">${item.quantity}</td>
      <td style="text-align: left; padding: 6px 0; font-weight: 900; font-family: monospace; font-size: ${baseFontSize}; color: ${densityColor}; border-bottom: ${borderStyle}; vertical-align: top;">${item.total.toLocaleString()} ${currency}</td>
    </tr>
  `).join('');

  const footerNote = invoiceData.notes || pSettings.customFooterNote || localStorage.getItem('sanad_invoice_footer_note') || '';
  const qrPixelSize = pSettings.qrSize === 'small' ? 95 : (pSettings.qrSize === 'large' ? 145 : 120);

  // إنشاء عنصر DOM معزول ومنسق بأعلى جودة
  const temporaryContainer = document.createElement('div');
  temporaryContainer.setAttribute('data-export-container', 'true');
  temporaryContainer.className = 'printable-invoice-card';
  temporaryContainer.style.position = 'fixed';
  temporaryContainer.style.left = '-9999px';
  temporaryContainer.style.top = '-9999px';
  temporaryContainer.style.width = `${containerWidthPx}px`;
  temporaryContainer.style.backgroundColor = '#ffffff';
  temporaryContainer.style.color = densityColor;
  temporaryContainer.style.padding = '14px 12px 28px 12px';
  temporaryContainer.style.boxSizing = 'border-box';
  temporaryContainer.style.direction = 'rtl';
  temporaryContainer.style.fontFamily = fontFamilyStr;
  temporaryContainer.style.fontSize = baseFontSize;
  temporaryContainer.style.fontWeight = densityWeight;
  temporaryContainer.style.lineHeight = lineSpacing;
  temporaryContainer.style.textAlign = 'center';

  temporaryContainer.innerHTML = `
    ${pSettings.showLogo !== false && invoiceData.storeLogoUrl ? `<img src="${invoiceData.storeLogoUrl}" style="max-width: 52px; max-height: 52px; margin: 0 auto 5px auto; display: block; border-radius: 6px;" alt="Logo" />` : ''}
    ${pSettings.showHeaderName !== false ? `<div style="font-size: ${headerFontSize}; font-weight: 900; color: #000000; margin-bottom: 2px; letter-spacing: normal;">${shopName}</div>` : ''}
    ${pSettings.customHeaderTitle ? `<div style="font-size: ${detailsFontSize}; font-weight: 800; color: #374151; margin-bottom: 3px;">${pSettings.customHeaderTitle}</div>` : ''}
    
    ${(pSettings.showBranchAddress !== false && invoiceData.storeAddress) || (pSettings.showPhone !== false && invoiceData.storePhone) ? `
      <div style="font-size: ${detailsFontSize}; color: #4b5563; margin-bottom: 5px; font-weight: 700;">
        ${pSettings.showBranchAddress !== false && invoiceData.storeAddress ? `<span>${invoiceData.storeAddress}</span>` : ''}
        ${pSettings.showPhone !== false && invoiceData.storePhone ? ` | <span style="font-family: monospace;">هاتف: ${invoiceData.storePhone}</span>` : ''}
      </div>
    ` : ''}

    ${pSettings.showTaxNumber && pSettings.taxNumber ? `
      <div style="font-size: ${detailsFontSize}; color: #000000; font-weight: 800; margin: 3px 0; border: 1px solid #000000; padding: 2px 6px; display: inline-block; border-radius: 4px;">
        الرقم الضريبي / السجل: ${pSettings.taxNumber}
      </div>
    ` : ''}

    <div style="border-bottom: ${borderStyle}; margin: 8px 0;"></div>
    
    <div style="text-align: right; font-size: ${detailsFontSize}; line-height: 1.7;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <span style="color: #4b5563; font-weight: 700;">رقم الفاتورة:</span>
        <span style="font-family: monospace; font-weight: 900; font-size: ${baseFontSize}; color: #000000;">${invoiceData.invoiceNumber}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <span style="color: #4b5563; font-weight: 700;">التاريخ والوقت:</span>
        <span style="font-weight: 800; color: #111827;">${dateStr}</span>
      </div>
      ${pSettings.showCustomerInfo !== false ? `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <span style="color: #4b5563; font-weight: 700;">العميل المستلم:</span>
          <span style="font-weight: 800; color: #111827;">${invoiceData.customerName || 'عميل سفري / نقدي (كاش)'}</span>
        </div>
      ` : ''}
      ${pSettings.showCashierName !== false && (invoiceData.cashierName || localStorage.getItem('sanad_cashier_name')) ? `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <span style="color: #4b5563; font-weight: 700;">الكاشير / البائع:</span>
          <span style="font-weight: 800; color: #111827;">${invoiceData.cashierName || localStorage.getItem('sanad_cashier_name') || 'أحمد الكاشير'}</span>
        </div>
      ` : ''}
      ${pSettings.showPaymentMethod !== false ? `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <span style="color: #4b5563; font-weight: 700;">طريقة السداد:</span>
          <span style="font-weight: 800; color: #059669;">${invoiceData.paymentMethod || 'نقدي (كاش)'}</span>
        </div>
      ` : ''}
    </div>

    <div style="border-bottom: ${borderStyle}; margin: 8px 0;"></div>

    <table style="width: 100%; border-collapse: collapse; margin-top: 4px; font-size: ${detailsFontSize};">
      <thead>
        <tr>
          <th style="text-align: right; width: 50%; border-bottom: ${borderStyle}; padding: 5px 0; font-weight: 900; font-size: ${baseFontSize}; color: #000000;">السلعة</th>
          <th style="text-align: center; width: 20%; border-bottom: ${borderStyle}; padding: 5px 0; font-weight: 900; font-size: ${baseFontSize}; color: #000000;">الكمية</th>
          <th style="text-align: left; width: 30%; border-bottom: ${borderStyle}; padding: 5px 0; font-weight: 900; font-size: ${baseFontSize}; color: #000000;">المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div style="border-bottom: ${borderStyle}; margin: 8px 0;"></div>

    <div style="margin-top: 6px; text-align: right; font-size: ${baseFontSize}; line-height: 1.7;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span style="color: #374151; font-weight: 700;">المجموع الفرعي:</span>
        <span style="font-family: monospace; font-weight: 900; color: #000000;">${invoiceData.totalAmount.toLocaleString()} ${currency}</span>
      </div>
      ${invoiceData.discount ? `
        <div style="display: flex; justify-content: space-between; color: #dc2626; margin-bottom: 2px; font-weight: 800;">
          <span>خصم خاص مخصوم:</span>
          <span style="font-family: monospace;">- ${invoiceData.discount.toLocaleString()} ${currency}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: ${finalFontSize}; font-weight: 900; color: #000000; border-top: 2px solid #000000; padding-top: 6px; margin-top: 5px;">
        <span>الصافي النهائي للتسديد:</span>
        <span style="font-family: monospace; font-size: ${finalFontSize};">${invoiceData.finalAmount.toLocaleString()} ${currency}</span>
      </div>
    </div>

    ${pSettings.showBarcode !== false && barcodeUrl ? `
      <div style="margin: 10px 0 4px 0; text-align: center;">
        <img src="${barcodeUrl}" alt="${invoiceData.invoiceNumber}" style="max-width: 95%; height: 38px; display: inline-block;" />
      </div>
    ` : ''}

    ${pSettings.showQrCode !== false && qrPngUrl ? `
      <div style="margin: 8px auto 4px auto; text-align: center;">
        <div style="display: inline-block; padding: 4px; background: #ffffff; border: 1.5px solid #6b7280; border-radius: 6px;">
          <img src="${qrPngUrl}" alt="QR Code" style="width: ${qrPixelSize}px; height: ${qrPixelSize}px; display: block;" />
          <div style="font-size: 8px; font-weight: 800; color: #374151; margin-top: 2px;">رمز التحقق والفوترة</div>
        </div>
      </div>
    ` : ''}

    ${pSettings.showReturnPolicy !== false && footerNote ? `
      <div style="font-size: ${detailsFontSize}; margin-top: 8px; padding: 6px; border: 1px dashed #6b7280; background: #f9fafb; border-radius: 6px; color: #111827; line-height: 1.45; text-align: center; font-weight: 700; white-space: pre-line;">
        ${footerNote}
      </div>
    ` : ''}

    ${pSettings.footerGreeting ? `
      <div style="font-size: ${detailsFontSize}; color: #111827; margin-top: 8px; margin-bottom: 4px; font-weight: 800; text-align: center;">
        ${pSettings.footerGreeting}
      </div>
    ` : ''}

    <div style="font-size: 9px; font-weight: 800; color: #047857; margin-top: 8px;">✓ تم الحفظ بنجاح في النظام المحاسبي</div>
    <div style="font-size: 8px; color: #6b7280; margin-top: 2px;">برمجة وتطوير م. عبدالمجيد المحواشي (اليمن)</div>

    <!-- مسافة التغذية وسكين القص للطابعة الحرارية -->
    <div style="margin-top: ${pSettings.feedBeforeCutMm || 14}mm; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 8px; color: #94a3b8; text-align: center;">
      ✂ موضع سكين القص الآلي للطابعة
    </div>
  `;

  document.body.appendChild(temporaryContainer);

  try {
    // انتظار تحميل كافة الصور بالكامل داخل الحاوية
    const images = Array.from(temporaryContainer.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // التقاط عالي الدقة scale: 3 مع الألوان الآمنة
    const canvas = await html2canvas(temporaryContainer, getSafeHtml2CanvasOptions({
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff'
    }));

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const imgHeightMm = (canvas.height * paperWidthMm) / canvas.width;
    const finalHeightMm = Math.max(imgHeightMm + 2, 45); // ضمان هامش أمان سفلي

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [paperWidthMm, finalHeightMm]
    });

    doc.addImage(imgData, 'JPEG', 0, 0, paperWidthMm, imgHeightMm, undefined, 'FAST');

    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const fileName = `smart_invoice_${invoiceData.invoiceNumber}.pdf`;

    return await saveAndShareFile({
      fileName,
      data: pdfBase64,
      isBase64: true,
      mimeType: 'application/pdf',
      title: `فاتورة مبيعات ${invoiceData.invoiceNumber}`,
      text: `فاتورة مبيعات رقم ${invoiceData.invoiceNumber} - ${shopName}`
    });
  } catch (error) {
    console.error('Error generating thermal invoice PDF:', error);
    return false;
  } finally {
    if (document.body.contains(temporaryContainer)) {
      document.body.removeChild(temporaryContainer);
    }
  }
};

// تصدير دوال ومحرك أوامر ESC/POS المباشرة للكمبيوتر
export {
  convertInvoiceToEscPos,
  convertCanvasToEscPos,
  sendEscPosViaWebUsb,
  sendEscPosViaWebSerial,
  sendEscPosDirect,
  downloadEscPosBinaryFile,
  printSalesInvoiceEscPosDirect,
  testEscPosHardware,
  checkBrowserDeviceSupport,
  EscPosBuilder
} from './EscPosHelper';
export type { EscPosOptions } from './EscPosHelper';

