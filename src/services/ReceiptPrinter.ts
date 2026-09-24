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
import { Capacitor } from '@capacitor/core';
import { saveAndShareFile } from '../utils/fileExport';
import { getSafeHtml2CanvasOptions } from '../utils/pdfHelper';
import { PrinterSettings, InvoicePaperSize } from '../types';
import { 
  getEffectivePrinterSettings,
  getFontFamilyCss,
  getFontWeightCss,
  getFontSizeMultiplier,
  getLineHeightCss
} from '../utils/printerDefaults';

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
  customerBalance?: number | string;
  cashierName?: string;
  date: string;
  paymentMethod?: string;
  items: Array<{
    id?: string;
    barcode?: string;
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
  paperSize?: InvoicePaperSize;
  qrCodeUrl?: string;
  barcodeUrl?: string;
  printerSettings?: PrinterSettings;
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

  executeNativeOrBrowserPrint(htmlContent, `سند_استلام_${ticket}`);
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
 * توليد كود شريطي باركود للفاتورة كصورة PNG
 */
export const generateInvoiceBarcodePng = (text: string): string => {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format: 'CODE128',
      width: 1.6,
      height: 40,
      displayValue: true,
      font: 'monospace',
      fontSize: 10,
      textMargin: 2,
      margin: 4
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Failed to generate barcode image:', e);
    return '';
  }
};

/**
 * 3. إنشاء كود HTML موحد ودقيق لفاتورة المبيعات والمستندات بجميع المقاسات (80mm / 58mm / A4 / A5) والقوالب
 */
export const buildSalesInvoiceInnerHTML = (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال',
  qrPngUrl: string = '',
  barcodePngUrl: string = ''
): { html: string; css: string } => {
  const cfg = invoiceData.printerSettings || getEffectivePrinterSettings();
  const pSize = invoiceData.paperSize || cfg.paperSize || '80mm';
  const is58 = pSize === '58mm';
  const isA4 = pSize === 'a4';
  const isA5 = pSize === 'a5';

  const fontCssFamily = getFontFamilyCss(cfg.fontFamily);
  const baseWeight = getFontWeightCss(cfg.fontWeight);
  const sizeMultiplier = getFontSizeMultiplier(cfg.fontSizeScale);
  const lineHeightVal = getLineHeightCss(cfg.lineHeight);
  const bodyTextColor = cfg.fontColor || '#000000';
  const primaryColor = cfg.primaryColor || '#0f172a';
  const headerTextColor = cfg.headerFontColor || primaryColor;

  const paperWidth = is58 ? '54mm' : isA4 ? '190mm' : isA5 ? '138mm' : '78mm';
  const pageCssSize = is58 ? '58mm auto' : isA4 ? 'A4 portrait' : isA5 ? 'A5 portrait' : '80mm auto';
  const rawBaseSize = is58 ? 10 : isA4 ? 13 : isA5 ? 12 : 11;
  const scaledBaseSize = Math.round(rawBaseSize * sizeMultiplier * 10) / 10;
  const fontSize = `${scaledBaseSize}px`;
  const fontSmall = `${Math.round(scaledBaseSize * 0.85 * 10) / 10}px`;
  const fontXSmall = `${Math.round(scaledBaseSize * 0.75 * 10) / 10}px`;
  const fontLarge = `${Math.round(scaledBaseSize * 1.15 * 10) / 10}px`;
  const fontXLarge = `${Math.round(scaledBaseSize * 1.35 * 10) / 10}px`;

  const dateStr = invoiceData.date
    ? new Date(invoiceData.date).toLocaleDateString('ar-YE') + ' ' + new Date(invoiceData.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('ar-YE');

  const itemsRowsHtml = invoiceData.items.map((item) => `
    <tr style="border-bottom: ${cfg.templateStyle === 'boxed' ? '1px solid #94a3b8' : cfg.templateStyle === 'minimal' ? '1px solid #e2e8f0' : '1px dashed #9ca3af'};">
      <td style="text-align: right; padding: 6px 4px; vertical-align: top; ${cfg.templateStyle === 'boxed' ? 'border: 1px solid #cbd5e1;' : ''}">
        <div style="font-weight: ${Math.min(900, baseWeight + 100)}; color: ${bodyTextColor}; font-size: ${fontSize}; line-height: 1.3;">${item.name}</div>
        ${cfg.showItemCodeBarcode && item.barcode ? `<div style="font-size: ${fontXSmall}; opacity: 0.75; font-family: monospace; color: ${bodyTextColor};">#${item.barcode}</div>` : ''}
      </td>
      <td style="text-align: center; padding: 6px 2px; font-weight: ${baseWeight}; font-family: monospace; font-size: ${fontSize}; vertical-align: top; color: ${bodyTextColor}; ${cfg.templateStyle === 'boxed' ? 'border: 1px solid #cbd5e1;' : ''}">${item.quantity}</td>
      ${cfg.showUnitPrice ? `<td style="text-align: center; padding: 6px 2px; font-family: monospace; font-size: ${fontSmall}; color: ${bodyTextColor}; vertical-align: top; ${cfg.templateStyle === 'boxed' ? 'border: 1px solid #cbd5e1;' : ''}">${item.sellingPrice.toLocaleString()}</td>` : ''}
      <td style="text-align: left; padding: 6px 4px; font-weight: ${Math.min(900, baseWeight + 100)}; font-family: monospace; font-size: ${fontSize}; vertical-align: top; color: ${bodyTextColor}; ${cfg.templateStyle === 'boxed' ? 'border: 1px solid #cbd5e1;' : ''}">${item.total.toLocaleString()} ${currency}</td>
    </tr>
  `).join('');

  const footerNote = cfg.showFooterPolicy ? (cfg.footerPolicyNote || invoiceData.notes || localStorage.getItem('sanad_invoice_footer_note') || '') : '';
  const resolvedQr = qrPngUrl || invoiceData.qrCodeUrl || '';
  const resolvedBarcode = barcodePngUrl || invoiceData.barcodeUrl || '';

  // Logo dimensions
  const logoMaxDim = cfg.logoSize === 'small' ? '40px' : cfg.logoSize === 'large' ? '75px' : '56px';
  const logoAlign = cfg.logoPosition === 'right' ? 'margin-left: auto; margin-right: 0;' :
                    cfg.logoPosition === 'left' ? 'margin-right: auto; margin-left: 0;' : 'margin: 0 auto;';

  const separatorClass = cfg.templateStyle === 'classic'
    ? 'line-dashed'
    : cfg.templateStyle === 'minimal'
    ? 'line-minimal'
    : 'line-solid';

  const finalRowStyle = cfg.templateStyle === 'modern'
    ? `background: ${primaryColor}; color: #ffffff !important; border-radius: 6px; padding: 6px 8px; margin-top: 6px;`
    : cfg.templateStyle === 'boxed'
    ? `border: 2px solid ${primaryColor}; background: #f8fafc; padding: 6px 8px; border-radius: 4px; margin-top: 6px;`
    : cfg.templateStyle === 'minimal'
    ? `border-top: 1px solid #94a3b8; padding-top: 4px; margin-top: 4px; color: ${bodyTextColor};`
    : cfg.templateStyle === 'official'
    ? `border-top: 2px solid #000000; border-bottom: 2px solid #000000; padding: 6px 0; margin-top: 6px; color: ${bodyTextColor};`
    : `border-top: 2px dashed #111827; border-bottom: 2px dashed #111827; padding: 5px 0; margin-top: 5px; color: ${bodyTextColor};`;

  const css = `
    @page {
      size: ${pageCssSize};
      margin: ${isA4 ? '12mm' : isA5 ? '8mm' : '0'};
    }
    @media print {
      html, body {
        width: 100% !important;
        max-width: ${isA4 ? '190mm' : isA5 ? '138mm' : is58 ? '54mm' : '100%'} !important;
        margin: 0 auto !important;
        padding: ${isA4 ? '8mm' : isA5 ? '5mm' : '2mm 1mm 6mm 1mm'} !important;
        background: #fff !important;
        color: ${bodyTextColor} !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    * {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    body { 
      font-family: ${fontCssFamily}; 
      font-weight: ${baseWeight};
      width: 100%;
      max-width: ${isA4 ? '190mm' : isA5 ? '138mm' : is58 ? '54mm' : '78mm'}; 
      padding: ${isA4 ? '16px' : '4px 2px 16px 2px'}; 
      margin: 0 auto; 
      text-align: center;
      color: ${bodyTextColor};
      background: #ffffff;
      font-size: ${fontSize};
      line-height: ${lineHeightVal};
    }
    .logo { max-width: ${logoMaxDim}; max-height: ${logoMaxDim}; ${logoAlign} display: block; border-radius: 8px; margin-bottom: 4px; }
    .header { font-size: ${isA4 ? '20px' : '16px'}; font-weight: 900; margin-bottom: 2px; color: ${headerTextColor}; letter-spacing: normal !important; }
    .sub-header { font-size: 11px; margin-bottom: 2px; color: ${bodyTextColor}; opacity: 0.85; font-weight: ${Math.min(900, baseWeight + 100)}; }
    .contact { font-size: 9.5px; color: ${bodyTextColor}; opacity: 0.8; margin-bottom: 4px; font-weight: ${baseWeight}; }
    .title-badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 10px; font-weight: 800; color: ${headerTextColor}; margin: 4px 0 6px 0; }
    .line-dashed { border-bottom: 1.5px dashed #6b7280; margin: 6px 0; }
    .line-solid { border-bottom: 2px solid ${primaryColor}; margin: 8px 0; }
    .line-minimal { border-bottom: 1px solid #e2e8f0; margin: 6px 0; }
    .details-grid { text-align: right; font-size: ${fontSize}; line-height: ${lineHeightVal}; }
    .details-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
    .details-label { color: ${bodyTextColor}; opacity: 0.75; font-weight: ${baseWeight}; }
    .details-val { font-weight: ${Math.min(900, baseWeight + 100)}; color: ${bodyTextColor}; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: ${fontSize}; color: ${bodyTextColor}; ${cfg.templateStyle === 'boxed' ? 'border: 1px solid #94a3b8;' : ''} }
    th { border-bottom: 1.5px dashed #4b5563; padding: 4px 2px; font-size: ${fontSize}; font-weight: 900; color: ${bodyTextColor}; ${cfg.templateStyle === 'boxed' ? 'background: #f8fafc; border: 1px solid #94a3b8;' : ''} }
    .totals-box { margin-top: 6px; text-align: right; font-size: ${fontSize}; line-height: ${lineHeightVal}; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .final-row { display: flex; justify-content: space-between; align-items: center; font-size: ${isA4 ? '14px' : '12.5px'}; font-weight: 900; }
    .policy { font-size: 9px; margin-top: 8px; padding: 6px; border: 1px dashed #9ca3af; background: #f9fafb; border-radius: 6px; color: ${bodyTextColor}; line-height: 1.5; text-align: center; font-weight: 600; }
    .signature-box { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; font-size: 9px; font-weight: 800; text-align: center; }
    .sign-cell { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; height: 50px; display: flex; flex-direction: column; justify-content: space-between; }
    .sign-line { border-bottom: 1px dotted #94a3b8; width: 100%; }
    .badge { font-size: 8.5px; font-weight: 800; color: #047857; margin-top: 8px; }
    .dev-tag { font-size: 8px; color: #6b7280; margin-top: 2px; font-family: monospace; }
    .qr-box { margin: 8px auto 4px auto; display: inline-block; padding: 4px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; }
    .barcode-box { margin: 6px auto; text-align: center; }
    .footer-greeting { font-size: 9.5px; color: #475569; margin-top: 8px; font-weight: 700; }
  `;

  const html = `
    ${cfg.templateStyle === 'official' ? `<div style="height: 4px; background: ${primaryColor}; width: 100%; margin-bottom: 8px; border-radius: 2px;"></div>` : ''}
    ${cfg.showLogo && invoiceData.storeLogoUrl ? `<img src="${invoiceData.storeLogoUrl}" class="logo" alt="Logo" />` : ''}
    <div class="header">${shopName}</div>
    ${cfg.invoiceSubtitle ? `<div class="sub-header">${cfg.invoiceSubtitle}</div>` : ''}
    
    ${(cfg.showHeaderAddress && invoiceData.storeAddress) || (cfg.showHeaderPhone && invoiceData.storePhone) ? `
      <div class="contact">
        ${cfg.showHeaderAddress && invoiceData.storeAddress ? `<span>${invoiceData.storeAddress}</span>` : ''}
        ${cfg.showHeaderAddress && invoiceData.storeAddress && cfg.showHeaderPhone && invoiceData.storePhone ? ` | ` : ''}
        ${cfg.showHeaderPhone && invoiceData.storePhone ? `<span style="font-family: monospace;">هاتف: ${invoiceData.storePhone}</span>` : ''}
      </div>
    ` : ''}

    ${(cfg.taxNumber || cfg.commercialRegistration) ? `
      <div style="font-size: ${fontXSmall}; color: ${bodyTextColor}; opacity: 0.75; font-family: monospace; margin-bottom: 4px;">
        ${cfg.taxNumber ? `الرقم الضريبي: ${cfg.taxNumber}` : ''}
        ${cfg.taxNumber && cfg.commercialRegistration ? ` | ` : ''}
        ${cfg.commercialRegistration ? `س.ت: ${cfg.commercialRegistration}` : ''}
      </div>
    ` : ''}

    <div class="title-badge" style="font-size: ${fontSmall}; color: ${headerTextColor};">${(cfg.invoiceTitle || 'فاتورة مبيعات').replace(/فاتورة\s*ضريبية\s*معتمدة/g, 'فاتورة مبيعات').replace(/ضريبية\s*معتمدة|ضريبة\s*معتمدة/g, 'مبيعات').trim() || 'فاتورة مبيعات'}</div>

    <div class="${separatorClass}"></div>
    
    <div class="details-grid" style="font-size: ${fontSize};">
      <div class="details-row">
        <span class="details-label" style="color: ${bodyTextColor}; opacity: 0.8; font-size: ${fontSmall};">رقم الفاتورة:</span>
        <span class="details-val" style="font-family: monospace; font-size: ${fontSize}; color: ${bodyTextColor};">${invoiceData.invoiceNumber}</span>
      </div>
      <div class="details-row">
        <span class="details-label" style="color: ${bodyTextColor}; opacity: 0.8; font-size: ${fontSmall};">التاريخ والوقت:</span>
        <span class="details-val" style="color: ${bodyTextColor}; font-size: ${fontSmall};">${dateStr}</span>
      </div>
      ${cfg.showCashierName && invoiceData.cashierName ? `
        <div class="details-row">
          <span class="details-label" style="color: ${bodyTextColor}; opacity: 0.8; font-size: ${fontSmall};">الكاشير / البائع:</span>
          <span class="details-val" style="color: ${bodyTextColor}; font-size: ${fontSize};">${invoiceData.cashierName}</span>
        </div>
      ` : ''}
      ${cfg.showCustomerName ? `
        <div class="details-row">
          <span class="details-label" style="color: ${bodyTextColor}; opacity: 0.8; font-size: ${fontSmall};">العميل المستلم:</span>
          <span class="details-val" style="color: ${bodyTextColor}; font-size: ${fontSize};">${invoiceData.customerName || 'عميل سفري / نقدي (كاش)'}</span>
        </div>
      ` : ''}
      ${cfg.showCustomerPhone && invoiceData.customerPhone ? `
        <div class="details-row">
          <span class="details-label" style="color: ${bodyTextColor}; opacity: 0.8; font-size: ${fontSmall};">هاتف العميل:</span>
          <span class="details-val" style="font-family: monospace; color: ${bodyTextColor}; font-size: ${fontSize};">${invoiceData.customerPhone}</span>
        </div>
      ` : ''}
      ${cfg.showPaymentMethod ? `
        <div class="details-row">
          <span class="details-label" style="color: ${bodyTextColor}; opacity: 0.8; font-size: ${fontSmall};">طريقة السداد:</span>
          <span class="details-val" style="color: ${bodyTextColor}; font-size: ${fontSmall}; font-weight: bold;">${invoiceData.paymentMethod || 'نقدي (كاش)'}</span>
        </div>
      ` : ''}
    </div>

    <div class="${separatorClass}"></div>

    <table>
      <thead>
        <tr>
          <th style="text-align: right; width: ${cfg.showUnitPrice ? '45%' : '55%'}; font-size: ${fontSmall}; color: ${bodyTextColor};">السلعة</th>
          <th style="text-align: center; width: 15%; font-size: ${fontSmall}; color: ${bodyTextColor};">الكمية</th>
          ${cfg.showUnitPrice ? `<th style="text-align: center; width: 20%; font-size: ${fontSmall}; color: ${bodyTextColor};">السعر</th>` : ''}
          <th style="text-align: left; width: ${cfg.showUnitPrice ? '20%' : '30%'}; font-size: ${fontSmall}; color: ${bodyTextColor};">المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div class="${separatorClass}"></div>

    <div class="totals-box" style="font-size: ${fontSize}; color: ${bodyTextColor};">
      <div class="totals-row">
        <span style="opacity: 0.85;">المجموع الفرعي:</span>
        <span style="font-family: monospace; font-weight: bold;">${invoiceData.totalAmount.toLocaleString()} ${currency}</span>
      </div>
      ${cfg.showItemDiscount && invoiceData.discount ? `
        <div class="totals-row" style="color: #dc2626;">
          <span>خصم خاص مخصوم:</span>
          <span style="font-family: monospace; font-weight: bold;">- ${invoiceData.discount.toLocaleString()} ${currency}</span>
        </div>
      ` : ''}
      <div class="final-row" style="${finalRowStyle}">
        <span style="font-size: ${fontLarge};">الصافي النهائي للتسديد:</span>
        <span style="font-family: monospace; font-size: ${fontXLarge}; font-weight: 900;">${invoiceData.finalAmount.toLocaleString()} ${currency}</span>
      </div>
      ${cfg.showCustomerBalance && invoiceData.customerBalance !== undefined ? `
        <div class="totals-row" style="color: ${bodyTextColor}; opacity: 0.9; margin-top: 4px; font-weight: 700; font-size: ${fontSmall};">
          <span>الرصيد المتبقي للعميل:</span>
          <span style="font-family: monospace;">${invoiceData.customerBalance} ${currency}</span>
        </div>
      ` : ''}
    </div>

    ${footerNote ? `<div class="policy" style="font-size: ${fontSmall}; color: ${bodyTextColor};">${footerNote}</div>` : ''}

    ${cfg.showSignatureBox ? `
      <div class="signature-box" style="font-size: ${fontSmall}; color: ${bodyTextColor};">
        <div class="sign-cell">
          <span>توقيع المستلم</span>
          <div class="sign-line"></div>
        </div>
        <div class="sign-cell">
          <span>ختم وتوقيع المنشأة</span>
          <div class="sign-line"></div>
        </div>
      </div>
    ` : ''}

    ${(cfg.codeType === 'qr' || cfg.codeType === 'both') && resolvedQr ? `
      <div class="qr-box">
        <img src="${resolvedQr}" style="width: ${is58 ? '64px' : '76px'}; height: ${is58 ? '64px' : '76px'}; display: block;" alt="QR Code" />
        <div style="font-size: ${fontXSmall}; font-weight: 700; color: ${bodyTextColor}; opacity: 0.75; margin-top: 2px;">مسح للتحقق والتوثيق</div>
      </div>
    ` : ''}

    ${(cfg.codeType === 'barcode' || cfg.codeType === 'both') && resolvedBarcode ? `
      <div class="barcode-box">
        <img src="${resolvedBarcode}" style="max-width: 90%; height: auto; display: block; margin: 0 auto;" alt="Barcode" />
      </div>
    ` : ''}

    ${cfg.footerGreeting ? `<div class="footer-greeting" style="font-size: ${fontSmall}; color: ${bodyTextColor}; opacity: 0.85;">${cfg.footerGreeting}</div>` : ''}

    ${cfg.showDevCredits ? `
      <div class="badge">✓ تم الحفظ بنجاح في النظام المحاسبي للكمبيوتر</div>
      <div class="dev-tag">برمجة وتطوير م. عبدالمجيد المحواشي (الجمهورية اليمنية)</div>
    ` : ''}
  `;

  return { html, css };
};

export const buildSalesInvoiceThermalHTML = (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال',
  qrPngUrl: string = '',
  barcodePngUrl: string = ''
): string => {
  const cfg = invoiceData.printerSettings || getEffectivePrinterSettings();
  const { html, css } = buildSalesInvoiceInnerHTML(shopName, invoiceData, currency, qrPngUrl, barcodePngUrl);

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <title>${cfg.invoiceTitle || 'فاتورة مبيعات'} - ${invoiceData.invoiceNumber}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;600;700;800;900&family=Almarai:wght@400;700;800&family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800;900&family=Changa:wght@400;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
        ${css}
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;
};

/**
 * 🖨️ دالة الطباعة الموحدة الذكية:
 * - في بيئة الأندرويد الأصلية (Capacitor Native): تستدعي واجهة نظام أندرويد الرسمية (Android Print Spooler)
 *   عبر إضافة الطباعة المعتمدة لتتيح الحفظ كـ PDF أو الطباعة المباشرة على أي طابعة متصلة.
 * - في بيئة المتصفح / الويندوز: تستدعي طباعة المتصفح عبر iframe معزول نظيف.
 */
export const executeNativeOrBrowserPrint = (
  htmlContent: string,
  documentTitle: string = 'فاتورة_مبيعات'
): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
      const cordova = (window as any)?.cordova;

      // 🟢 1. التحقق من أندرويد وتشغيل Print Spooler الأصلي
      if (isNative && cordova?.plugins?.printer) {
        cordova.plugins.printer.print(
          htmlContent,
          {
            name: documentTitle,
            orientation: 'portrait',
            monochrome: false
          },
          () => {
            resolve();
          }
        );
        return;
      }
    } catch (err) {
      console.warn('Native printer error, using browser print fallback:', err);
    }

    // 🔵 2. بيئة الويندوز والويب: نافذة طباعة المتصفح
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
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print error:', e);
        }
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch (e) {}
          resolve();
        }, 1200);
      }, 350);
    } else {
      resolve();
    }
  });
};

/**
 * 4. طباعة فاتورة مبيعات حرارية (Thermal Printer 80mm / Bluetooth / POS / Android Spooler)
 */
export const printSalesInvoiceThermalHTML = async (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال'
): Promise<void> => {
  const qrPng = await generateInvoiceQrPng(invoiceData, shopName, currency);
  let barcodePng = '';
  const cfg = invoiceData.printerSettings || getEffectivePrinterSettings();
  if (cfg.codeType === 'barcode' || cfg.codeType === 'both') {
    barcodePng = generateInvoiceBarcodePng(invoiceData.invoiceNumber);
  }

  const htmlContent = buildSalesInvoiceThermalHTML(shopName, invoiceData, currency, qrPng, barcodePng);
  const docTitle = `${cfg.invoiceTitle || 'فاتورة'}_${invoiceData.invoiceNumber || Date.now()}`;

  await executeNativeOrBrowserPrint(htmlContent, docTitle);
};

/**
 * دالة طباعة فاتورة فحص تجريبية فورية للتحقق من الطابعة والمقاس
 */
export const printTestInvoiceDirect = async (
  shopName: string,
  printerSettings: PrinterSettings,
  currency: string = 'ر.ي',
  storeLogoUrl: string = '',
  storeAddress: string = '',
  storePhone: string = ''
): Promise<void> => {
  const sampleData: SalesInvoicePrintData = {
    invoiceNumber: `TEST-${Date.now().toString().slice(-5)}`,
    customerName: 'عميل تجريبي / نقدي (فحص طابعة)',
    customerPhone: '777000000',
    cashierName: 'الكاشير 1',
    customerBalance: 0,
    date: new Date().toISOString(),
    paymentMethod: 'نقدي (كاش)',
    items: [
      {
        barcode: '690123456789',
        name: 'شاشة حماية زجاجية نانو 9D (عينة فحص)',
        quantity: 2,
        sellingPrice: 1500,
        total: 3000
      },
      {
        barcode: '880987654321',
        name: 'كابل شحن سريع Type-C أصلي 65W',
        quantity: 1,
        sellingPrice: 3500,
        total: 3500
      }
    ],
    totalAmount: 6500,
    discount: 500,
    finalAmount: 6000,
    notes: printerSettings.footerPolicyNote,
    storeLogoUrl: storeLogoUrl,
    storeAddress: storeAddress,
    storePhone: storePhone,
    paperSize: printerSettings.paperSize,
    printerSettings: printerSettings
  };

  await printSalesInvoiceThermalHTML(shopName || 'سند للمحاسبة والخدمات', sampleData, currency);
};

/**
 * 5. توليد وحفظ فاتورة مبيعات حرارية كـ PDF عالي الدقة وبأعلى معايير الأناقة والوضوح
 */
export const generateSalesInvoiceThermalPDF = async (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال'
): Promise<boolean> => {
  const cfg = invoiceData.printerSettings || getEffectivePrinterSettings();
  const is58 = (invoiceData.paperSize || cfg.paperSize) === '58mm';
  const paperWidthMm = is58 ? 58 : 80;
  const containerWidthPx = is58 ? 320 : 420;

  // توليد كود الاستجابة السريعة (QR Code) كصورة PNG عالية النقاء
  const qrPngUrl = await generateInvoiceQrPng(invoiceData, shopName, currency);
  let barcodePngUrl = '';
  if (cfg.codeType === 'barcode' || cfg.codeType === 'both') {
    barcodePngUrl = generateInvoiceBarcodePng(invoiceData.invoiceNumber);
  }

  const { html, css } = buildSalesInvoiceInnerHTML(shopName, invoiceData, currency, qrPngUrl, barcodePngUrl);

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
  temporaryContainer.style.padding = '14px 12px 28px 12px';
  temporaryContainer.style.boxSizing = 'border-box';
  temporaryContainer.style.direction = 'rtl';
  temporaryContainer.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";
  temporaryContainer.style.fontSize = is58 ? '10px' : '11.5px';
  temporaryContainer.style.lineHeight = '1.45';
  temporaryContainer.style.textAlign = 'center';

  temporaryContainer.innerHTML = `
    <style>
      ${css}
    </style>
    <div style="width: 100%;">
      ${html}
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
