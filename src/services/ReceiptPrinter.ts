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
import { saveAndShareFile } from '../utils/fileExport';
import { getSafeHtml2CanvasOptions } from '../utils/pdfHelper';

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
}

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
      <style>
        body { 
          font-family: 'Tahoma', 'Segoe UI', monospace; 
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

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback for native WebView where window.open returns null
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch(e){}
        }, 1000);
      }, 300);
    }
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();
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
 * 3. إنشاء كود HTML موحد ودقيق لفاتورة المبيعات الحرارية (80mm / 58mm) متطابق 100% مع شكل الفاتورة
 */
export const buildSalesInvoiceThermalHTML = (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال',
  qrPngUrl: string = ''
): string => {
  const is58 = invoiceData.paperSize === '58mm';
  const paperWidth = is58 ? '54mm' : '76mm';
  const fontSize = is58 ? '10px' : '11px';

  const dateStr = invoiceData.date
    ? new Date(invoiceData.date).toLocaleDateString('ar-YE') + ' ' + new Date(invoiceData.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('ar-YE');

  const itemsRowsHtml = invoiceData.items.map((item) => `
    <tr>
      <td style="text-align: right; padding: 6px 0; border-bottom: 1px dashed #9ca3af; vertical-align: top;">
        <div style="font-weight: 800; color: #111827; font-size: 11px; line-height: 1.3;">${item.name}</div>
        <div style="font-size: 9.5px; color: #4b5563; font-family: monospace; margin-top: 1px;">${item.sellingPrice.toLocaleString()} ${currency}</div>
      </td>
      <td style="text-align: center; padding: 6px 0; font-weight: 800; font-family: monospace; font-size: 11px; border-bottom: 1px dashed #9ca3af; vertical-align: top;">${item.quantity}</td>
      <td style="text-align: left; padding: 6px 0; font-weight: 800; font-family: monospace; font-size: 11px; border-bottom: 1px dashed #9ca3af; vertical-align: top;">${item.total.toLocaleString()} ${currency}</td>
    </tr>
  `).join('');

  const footerNote = invoiceData.notes || localStorage.getItem('sanad_invoice_footer_note') || '';

  // Resolved QR code (either generated PNG, or passed URL)
  const resolvedQr = qrPngUrl || invoiceData.qrCodeUrl || '';

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <title>فاتورة مبيعات - ${invoiceData.invoiceNumber}</title>
      <style>
        @page {
          size: ${is58 ? '58mm' : '80mm'} auto;
          margin: 0;
        }
        @media print {
          html, body {
            width: ${paperWidth} !important;
            margin: 0 auto !important;
            padding: 4mm 2mm 8mm 2mm !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }
        body { 
          font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; 
          width: ${paperWidth}; 
          padding: 8px 6px 24px 6px; 
          margin: 0 auto; 
          text-align: center;
          color: #111827;
          background: #ffffff;
          font-size: ${fontSize};
          line-height: 1.45;
        }
        .logo { max-width: 52px; max-height: 52px; margin: 0 auto 4px auto; display: block; border-radius: 8px; }
        .header { font-size: 16px; font-weight: 900; margin-bottom: 2px; color: #000000; letter-spacing: normal !important; }
        .sub-header { font-size: 10.5px; margin-bottom: 2px; color: #374151; font-weight: 700; }
        .contact { font-size: 9.5px; color: #4b5563; margin-bottom: 4px; font-family: monospace; font-weight: 600; }
        .line-dashed { border-bottom: 1.5px dashed #6b7280; margin: 8px 0; }
        .details-grid { text-align: right; font-size: 10.5px; line-height: 1.7; }
        .details-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
        .details-label { color: #4b5563; font-weight: 600; }
        .details-val { font-weight: 800; color: #111827; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5px; }
        th { border-bottom: 1.5px dashed #4b5563; padding: 4px 0; font-size: 10.5px; font-weight: 900; color: #111827; }
        .totals-box { margin-top: 6px; text-align: right; font-size: 11px; line-height: 1.7; }
        .totals-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .final-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 900; color: #000000; border-top: 2px solid #111827; padding-top: 6px; margin-top: 6px; }
        .policy { font-size: 9px; margin-top: 8px; padding: 6px; border: 1px dashed #9ca3af; background: #f9fafb; border-radius: 6px; color: #1f2937; line-height: 1.5; text-align: center; font-weight: 600; }
        .badge { font-size: 9px; font-weight: 800; color: #047857; margin-top: 8px; }
        .dev-tag { font-size: 8.5px; color: #6b7280; margin-top: 2px; }
        .barcode-container { margin: 8px 0 6px 0; text-align: center; }
        .qr-box { margin: 8px auto 4px auto; display: inline-block; padding: 6px; background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .qr-label { font-size: 8.5px; font-weight: 800; color: #374151; margin-top: 3px; }
        .footer-greeting { font-size: 9px; color: #6b7280; margin-top: 8px; margin-bottom: 8px; font-weight: 700; }
      </style>
    </head>
    <body>
      ${invoiceData.storeLogoUrl ? `<img src="${invoiceData.storeLogoUrl}" class="logo" alt="Logo" />` : ''}
      <div class="header">${shopName}</div>
      <div class="sub-header">للأجهزة الذكية والصيانة والبرمجة</div>
      ${invoiceData.storeAddress || invoiceData.storePhone ? `
        <div class="contact">
          ${invoiceData.storeAddress ? `<span>${invoiceData.storeAddress}</span>` : ''}
          ${invoiceData.storePhone ? ` | <span>هاتف: ${invoiceData.storePhone}</span>` : ''}
        </div>
      ` : ''}

      <div class="line-dashed"></div>
      
      <div class="details-grid">
        <div class="details-row">
          <span class="details-label">رقم الفاتورة:</span>
          <span class="details-val" style="font-family: monospace; font-size: 12px;">${invoiceData.invoiceNumber}</span>
        </div>
        <div class="details-row">
          <span class="details-label">التاريخ والوقت:</span>
          <span class="details-val">${dateStr}</span>
        </div>
        <div class="details-row">
          <span class="details-label">العميل المستلم:</span>
          <span class="details-val">${invoiceData.customerName || 'عميل سفري / نقدي (كاش)'}</span>
        </div>
        <div class="details-row">
          <span class="details-label">طريقة السداد:</span>
          <span class="details-val">${invoiceData.paymentMethod || 'نقدي (كاش)'}</span>
        </div>
      </div>

      <div class="line-dashed"></div>

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

      <div class="line-dashed"></div>

      <div class="totals-box">
        <div class="totals-row">
          <span>المجموع الفرعي:</span>
          <span style="font-family: monospace; font-weight: bold;">${invoiceData.totalAmount.toLocaleString()} ${currency}</span>
        </div>
        ${invoiceData.discount ? `
          <div class="totals-row" style="color: #dc2626;">
            <span>خصم خاص مخصوم:</span>
            <span style="font-family: monospace; font-weight: bold;">- ${invoiceData.discount.toLocaleString()} ${currency}</span>
          </div>
        ` : ''}
        <div class="final-row">
          <span>الصافي النهائي للتسديد:</span>
          <span style="font-family: monospace; font-size: 14px;">${invoiceData.finalAmount.toLocaleString()} ${currency}</span>
        </div>
      </div>

      ${footerNote ? `<div class="policy">${footerNote}</div>` : ''}

      <div class="badge">✓ تم الحفظ بنجاح في النظام المحاسبي للكمبيوتر</div>
      <div class="dev-tag">برمجة وتطوير م. عبدالمجيد المحواشي (الجمهورية اليمنية)</div>

      <div class="footer-greeting">سعدنا بزيارتكم الكريمة ❤️ طاب يومكم</div>
    </body>
    </html>
  `;
};

/**
 * 4. طباعة فاتورة مبيعات حرارية (Thermal Printer 80mm / Bluetooth / POS)
 */
export const printSalesInvoiceThermalHTML = async (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال'
): Promise<void> => {
  const qrPng = await generateInvoiceQrPng(invoiceData, shopName, currency);
  const htmlContent = buildSalesInvoiceThermalHTML(shopName, invoiceData, currency, qrPng);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch(e){}
        }, 1000);
      }, 300);
    }
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => {
        try { printWindow.close(); } catch(e){}
      }, 1000);
    } catch(e){}
  }, 250);
};

/**
 * 5. توليد وحفظ فاتورة مبيعات حرارية كـ PDF عالي الدقة وبأعلى معايير الأناقة والوضوح
 */
export const generateSalesInvoiceThermalPDF = async (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال'
): Promise<boolean> => {
  const is58 = invoiceData.paperSize === '58mm';
  const paperWidthMm = is58 ? 58 : 80;
  const containerWidthPx = is58 ? 320 : 420;

  // توليد كود الاستجابة السريعة (QR Code) كصورة PNG عالية النقاء
  const qrPngUrl = await generateInvoiceQrPng(invoiceData, shopName, currency);

  const dateStr = invoiceData.date
    ? new Date(invoiceData.date).toLocaleDateString('ar-YE') + ' ' + new Date(invoiceData.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('ar-YE');

  const itemsRowsHtml = invoiceData.items.map((item) => `
    <tr>
      <td style="text-align: right; padding: 7px 0; border-bottom: 1.5px dashed #9ca3af; vertical-align: top;">
        <div style="font-weight: 800; color: #111827; font-size: 13px; line-height: 1.3;">${item.name}</div>
        <div style="font-size: 11px; color: #4b5563; font-family: monospace; font-weight: 700; margin-top: 2px;">${item.sellingPrice.toLocaleString()} ${currency}</div>
      </td>
      <td style="text-align: center; padding: 7px 0; font-weight: 900; font-family: monospace; font-size: 13px; color: #111827; border-bottom: 1.5px dashed #9ca3af; vertical-align: top;">${item.quantity}</td>
      <td style="text-align: left; padding: 7px 0; font-weight: 900; font-family: monospace; font-size: 13px; color: #111827; border-bottom: 1.5px dashed #9ca3af; vertical-align: top;">${item.total.toLocaleString()} ${currency}</td>
    </tr>
  `).join('');

  const footerNote = invoiceData.notes || localStorage.getItem('sanad_invoice_footer_note') || '';

  // إنشاء عنصر DOM معزول ومنسق بأعلى جودة
  const temporaryContainer = document.createElement('div');
  temporaryContainer.setAttribute('data-export-container', 'true');
  temporaryContainer.className = 'printable-invoice-card';
  temporaryContainer.style.position = 'fixed';
  temporaryContainer.style.left = '-9999px';
  temporaryContainer.style.top = '-9999px';
  temporaryContainer.style.width = `${containerWidthPx}px`;
  temporaryContainer.style.backgroundColor = '#ffffff';
  temporaryContainer.style.color = '#111827';
  temporaryContainer.style.padding = '16px 14px 32px 14px';
  temporaryContainer.style.boxSizing = 'border-box';
  temporaryContainer.style.direction = 'rtl';
  temporaryContainer.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";
  temporaryContainer.style.fontSize = is58 ? '11px' : '12px';
  temporaryContainer.style.lineHeight = '1.45';
  temporaryContainer.style.textAlign = 'center';

  temporaryContainer.innerHTML = `
    ${invoiceData.storeLogoUrl ? `<img src="${invoiceData.storeLogoUrl}" style="max-width: 56px; max-height: 56px; margin: 0 auto 6px auto; display: block; border-radius: 8px;" alt="Logo" />` : ''}
    <div style="font-size: 18px; font-weight: 900; color: #000000; margin-bottom: 2px; letter-spacing: normal; word-spacing: normal;">${shopName}</div>
    <div style="font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 3px;">للأجهزة الذكية والصيانة والبرمجة</div>
    ${invoiceData.storeAddress || invoiceData.storePhone ? `
      <div style="font-size: 11px; color: #4b5563; margin-bottom: 6px; font-weight: 600;">
        ${invoiceData.storeAddress ? `<span>${invoiceData.storeAddress}</span>` : ''}
        ${invoiceData.storePhone ? ` | <span style="font-family: monospace;">هاتف: ${invoiceData.storePhone}</span>` : ''}
      </div>
    ` : ''}

    <div style="border-bottom: 2px dashed #4b5563; margin: 10px 0;"></div>
    
    <div style="text-align: right; font-size: 12px; line-height: 1.8;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <span style="color: #4b5563; font-weight: 600;">رقم الفاتورة:</span>
        <span style="font-family: monospace; font-weight: 900; font-size: 13px; color: #000000;">${invoiceData.invoiceNumber}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <span style="color: #4b5563; font-weight: 600;">التاريخ والوقت:</span>
        <span style="font-weight: 800; color: #111827;">${dateStr}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <span style="color: #4b5563; font-weight: 600;">العميل المستلم:</span>
        <span style="font-weight: 800; color: #111827;">${invoiceData.customerName || 'عميل سفري / نقدي (كاش)'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <span style="color: #4b5563; font-weight: 600;">طريقة السداد:</span>
        <span style="font-weight: 800; color: #059669;">${invoiceData.paymentMethod || 'نقدي (كاش)'}</span>
      </div>
    </div>

    <div style="border-bottom: 2px dashed #4b5563; margin: 10px 0;"></div>

    <table style="width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px;">
      <thead>
        <tr>
          <th style="text-align: right; width: 50%; border-bottom: 2px dashed #111827; padding: 6px 0; font-weight: 900; font-size: 12px; color: #000000;">السلعة</th>
          <th style="text-align: center; width: 20%; border-bottom: 2px dashed #111827; padding: 6px 0; font-weight: 900; font-size: 12px; color: #000000;">الكمية</th>
          <th style="text-align: left; width: 30%; border-bottom: 2px dashed #111827; padding: 6px 0; font-weight: 900; font-size: 12px; color: #000000;">المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div style="border-bottom: 2px dashed #4b5563; margin: 10px 0;"></div>

    <div style="margin-top: 8px; text-align: right; font-size: 12.5px; line-height: 1.8;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span style="color: #374151; font-weight: 700;">المجموع الفرعي:</span>
        <span style="font-family: monospace; font-weight: 900; color: #000000;">${invoiceData.totalAmount.toLocaleString()} ${currency}</span>
      </div>
      ${invoiceData.discount ? `
        <div style="display: flex; justify-content: space-between; color: #dc2626; margin-bottom: 3px; font-weight: 800;">
          <span>خصم خاص مخصوم:</span>
          <span style="font-family: monospace;">- ${invoiceData.discount.toLocaleString()} ${currency}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 900; color: #000000; border-top: 2.5px solid #000000; padding-top: 8px; margin-top: 6px;">
        <span>الصافي النهائي للتسديد:</span>
        <span style="font-family: monospace; font-size: 16px;">${invoiceData.finalAmount.toLocaleString()} ${currency}</span>
      </div>
    </div>

    ${footerNote ? `
      <div style="font-size: 10.5px; margin-top: 12px; padding: 8px; border: 1.5px dashed #9ca3af; background: #f9fafb; border-radius: 8px; color: #1f2937; line-height: 1.5; text-align: center; font-weight: 700; white-space: pre-line;">
        ${footerNote}
      </div>
    ` : ''}

    <div style="font-size: 10px; font-weight: 900; color: #059669; margin-top: 10px;">✓ تم الحفظ بنجاح في النظام المحاسبي للكمبيوتر</div>
    <div style="font-size: 9.5px; color: #6b7280; margin-top: 3px;">برمجة وتطوير م. عبدالمجيد المحواشي (الجمهورية اليمنية)</div>

    <div style="font-size: 10.5px; color: #4b5563; margin-top: 12px; margin-bottom: 4px; font-weight: 800;">
      سعدنا بزيارتكم الكريمة ❤️ طاب يومكم
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
