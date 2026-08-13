/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 🖨️ Receipt & WhatsApp Utility
 * مشاركة سند استلام جهاز صيانة/تفليش عبر الواتساب أو الطباعة الحرارية (Thermal 80mm/58mm)
 */

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
 * 3. طباعة فاتورة مبيعات حرارية (Thermal Printer 80mm / Bluetooth) مخصصة مع السلع والتفاصيل المالية
 */
export const printSalesInvoiceThermalHTML = (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال'
): void => {
  const dateStr = invoiceData.date
    ? new Date(invoiceData.date).toLocaleDateString('ar-YE') + ' ' + new Date(invoiceData.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('ar-YE');

  const itemsRowsHtml = invoiceData.items.map((item) => `
    <tr>
      <td style="text-align: right; padding: 4px 0; border-bottom: 1px dotted #ccc;">${item.name}</td>
      <td style="text-align: center; padding: 4px 0; border-bottom: 1px dotted #ccc;">${item.quantity}</td>
      <td style="text-align: center; padding: 4px 0; border-bottom: 1px dotted #ccc;">${item.sellingPrice.toLocaleString()}</td>
      <td style="text-align: left; padding: 4px 0; border-bottom: 1px dotted #ccc;">${item.total.toLocaleString()}</td>
    </tr>
  `).join('');

  const footerNote = invoiceData.notes || localStorage.getItem('sanad_invoice_footer_note') || 'البضاعة المباعة لا تُرد ولا تُستبدل إلا بشرط الضمان المعتمدة. شكراً لتعاملكم معنا.';

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8" />
      <title>فاتورة مبيعات - ${invoiceData.invoiceNumber}</title>
      <style>
        body { 
          font-family: 'Tahoma', 'Segoe UI', Arial, sans-serif; 
          width: 78mm; 
          padding: 8px; 
          margin: 0 auto; 
          text-align: center;
          color: #000;
          background: #fff;
          font-size: 12px;
        }
        .header { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
        .sub-header { font-size: 11px; margin-bottom: 8px; color: #333; font-weight: bold; }
        .line { border-bottom: 1px dashed #000; margin: 8px 0; }
        .inv-no { font-size: 14px; font-weight: bold; background: #f0f0f0; padding: 4px; margin: 6px 0; border: 1px solid #000; border-radius: 4px; }
        .details { text-align: right; font-size: 11px; line-height: 1.6; }
        .details b { color: #000; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
        th { border-bottom: 1px solid #000; padding: 4px 0; font-size: 11px; }
        .totals-box { margin-top: 8px; padding: 6px; border: 1px solid #000; border-radius: 4px; text-align: right; font-size: 12px; line-height: 1.6; }
        .totals-box .final { font-size: 13px; font-weight: bold; color: #000; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
        .footer { font-size: 10px; margin-top: 10px; text-align: center; line-height: 1.4; color: #222; }
        .policy { font-size: 9px; margin-top: 8px; padding: 4px; border: 1px dotted #666; background: #fafafa; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="header">${shopName}</div>
      <div class="sub-header">فاتورة مبيعات نقدية</div>
      <div class="inv-no">رقم الفاتورة: ${invoiceData.invoiceNumber}</div>
      <div class="line"></div>
      
      <div class="details">
        <b>التاريخ والوقت:</b> ${dateStr}<br/>
        <b>اسم العميل:</b> ${invoiceData.customerName || 'عميل سفري / نقدي (كاش)'}<br/>
        ${invoiceData.customerPhone ? `<b>رقم الهاتف:</b> ${invoiceData.customerPhone}<br/>` : ''}
        <b>طريقة الدفع:</b> ${invoiceData.paymentMethod || 'نقدي (كاش)'}<br/>
      </div>

      <div class="line"></div>

      <table>
        <thead>
          <tr>
            <th style="text-align: right; width: 45%;">السلعة</th>
            <th style="text-align: center; width: 15%;">الكمية</th>
            <th style="text-align: center; width: 20%;">السعر</th>
            <th style="text-align: left; width: 20%;">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
      </table>

      <div class="line"></div>

      <div class="totals-box">
        <div>المجموع الفرعي: <b>${invoiceData.totalAmount.toLocaleString()} ${currency}</b></div>
        ${invoiceData.discount ? `<div>الخصم: <b>${invoiceData.discount.toLocaleString()} ${currency}</b></div>` : ''}
        <div class="final">الصافي النهائي للتسديد: <b>${invoiceData.finalAmount.toLocaleString()} ${currency}</b></div>
      </div>

      ${footerNote ? `<div class="policy">${footerNote}</div>` : ''}

      <div class="footer">
        <b>شكراً لزيارتكم وجميل ثقتكم! 🌸</b><br/>
        <span style="font-size: 8px; color: #666;">تم الحفظ بنجاح في النظام المحاسبي للكمبيوتر</span>
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
