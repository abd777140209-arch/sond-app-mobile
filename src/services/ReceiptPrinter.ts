/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { saveAndShareFile } from '../utils/fileExport';
import { openWhatsApp } from '../utils/nativeLauncher';

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

/**
 * 1. توليد رابط وتوجيه واتساب مباشر لإرسال سند استلام
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

  const waUrl = cleanPhone 
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  // فتح الواتساب مباشرة بداخل الجوال عبر Capacitor AppLauncher والـ Intent
  openWhatsApp(cleanPhone, text);

  return waUrl;
};

/**
 * 2. طباعة وتصدير سند استلام حراري متوافق مع أندرويد WebView
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
        body { font-family: sans-serif; width: 100%; padding: 12px; margin: 0; text-align: center; color: #000; background: #fff; }
        .header { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
        .sub-header { font-size: 12px; margin-bottom: 8px; color: #333; }
        .line { border-bottom: 1px dashed #000; margin: 8px 0; }
        .ticket-no { font-size: 15px; font-weight: bold; background: #eee; padding: 6px; margin: 6px 0; border: 1px solid #000; }
        .details { text-align: right; font-size: 13px; line-height: 1.8; }
        .price-box { margin-top: 10px; padding: 8px; border: 1px solid #000; text-align: right; font-size: 13px; font-weight: bold; }
        .footer { font-size: 10px; margin-top: 14px; text-align: center; line-height: 1.5; }
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
    </body>
    </html>
  `;

  // إذا كنا على الأندرويد، نحفظ الفاتورة كملف HTML لطباعتها أو فتحها مباشرة
  if (Capacitor.isNativePlatform()) {
    saveAndShareFile({
      fileName: `Receipt_${ticket}.html`,
      data: htmlContent,
      mimeType: 'text/html',
      title: `سند استلام - ${receiptData.customerName}`,
      text: `سند استلام صيانة رقم: ${ticket}`
    });
    return;
  }

  // في البيئات العادية (الويب)
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  }
};

