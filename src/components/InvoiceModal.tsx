/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Printer, Download, X, ShieldCheck, Heart, Smartphone, SlidersHorizontal, MessageCircle } from 'lucide-react';
import { Invoice, SystemSettings, Customer } from '../types';
import { soundManager } from '../utils/sound';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  settings: SystemSettings;
  customers?: Customer[];
}

export default function InvoiceModal({ invoice, onClose, settings, customers }: InvoiceModalProps) {
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');
  const [autoDirectPrint, setAutoDirectPrint] = useState(() => {
    return localStorage.getItem('auto_direct_print') === 'true';
  });

  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  useEffect(() => {
    if (invoice && customers) {
      const matchedCustomer = customers.find(c => c.id === invoice.customerId);
      if (matchedCustomer && matchedCustomer.phone) {
        setPhoneInput(matchedCustomer.phone);
      } else {
        setPhoneInput('');
      }
    }
  }, [invoice, customers]);

  if (!invoice) return null;

  const handlePrint = () => {
    soundManager.playSuccessChime();
    window.print();
  };

  // Auto-route print when invoice loads if configured
  useEffect(() => {
    if (autoDirectPrint && invoice) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoice, autoDirectPrint]);

  const handleAutoPrintToggle = (checked: boolean) => {
    setAutoDirectPrint(checked);
    localStorage.setItem('auto_direct_print', checked ? 'true' : 'false');
    soundManager.playScanBeep();
  };

  // Simulates downloading the invoice receipt as a clean text-based file
  const handleDownload = () => {
    soundManager.playSuccessChime();
    
    let text = `-----------------------------------------\n`;
    text += `        ${settings.storeName.toUpperCase()}        \n`;
    text += `        ${settings.address}        \n`;
    text += `        هاتف: ${settings.phone}        \n`;
    text += `-----------------------------------------\n`;
    text += `رقم الفاتورة: ${invoice.invoiceNumber}\n`;
    text += `التاريخ والوقت: ${new Date(invoice.date).toLocaleString('ar-YE')}\n`;
    text += `العميل: ${invoice.customerName}\n`;
    text += `طريقة الدفع: ${invoice.type === 'cash' ? 'نقدي (كاش)' : 'ذمم وآجل (دين تقييد)'}\n`;
    text += `-----------------------------------------\n`;
    text += `الصنف              الكمية     السعر     المجموع\n`;
    
    invoice.items.forEach(item => {
      const paddedName = item.name.slice(0, 15).padEnd(15, ' ');
      text += `${paddedName}   ${item.quantity.toString().padEnd(5, ' ')}   ${item.sellingPrice.toString().padEnd(7, ' ')}   ${item.total}\n`;
    });
    
    text += `-----------------------------------------\n`;
    text += `المجموع الفرعي: ${invoice.totalAmount} ${settings.currency}\n`;
    text += `الخصم الممنوح: -${invoice.discount} ${settings.currency}\n`;
    text += `الصافي المدفوع: ${invoice.finalAmount} ${settings.currency}\n`;
    text += `-----------------------------------------\n`;
    text += `   برمجة وتطوير م.عبدالمجيد المحواشي   \n`;
    text += `       شكراً لتعاملكم وزيارتكم لنا!       \n`;
    text += `-----------------------------------------\n`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart_invoice_${invoice.invoiceNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendWhatsApp = () => {
    soundManager.playSuccessChime();

    // Clean and format the phone number
    let cleanedPhone = phoneInput.replace(/\D/g, '');
    if (cleanedPhone.startsWith('00')) {
      cleanedPhone = cleanedPhone.slice(2);
    }
    if (cleanedPhone.length === 9 && cleanedPhone.startsWith('7')) {
      cleanedPhone = '967' + cleanedPhone;
    }

    // Build the summarized WhatsApp text with standard formatting
    let text = `👑 *${settings.storeName.toUpperCase()}* 👑\n`;
    text += `*فاتورة مبيعات رقم:* ${invoice.invoiceNumber}\n`;
    text += `*التاريخ والوقت:* ${new Date(invoice.date).toLocaleString('ar-YE')}\n`;
    text += `*العميل المستلم:* ${invoice.customerName}\n`;
    text += `*طريقة الدفع:* ${invoice.type === 'cash' ? 'نقدي (كاش)' : 'ذمم وآجل'}\n`;
    text += `-----------------------------------------\n`;
    text += `*السلع والمشتريات:*\n`;
    
    invoice.items.forEach((item, idx) => {
      text += `${idx + 1}. *${item.name}* × ${item.quantity} = ${item.total.toLocaleString()} ${settings.currency}\n`;
    });
    
    text += `-----------------------------------------\n`;
    text += `*المجموع الفرعي:* ${invoice.totalAmount.toLocaleString()} ${settings.currency}\n`;
    if (invoice.discount > 0) {
      text += `*الخصم الممنوح:* -${invoice.discount.toLocaleString()} ${settings.currency}\n`;
    }
    text += `*الصافي النهائي للتسديد:* *${invoice.finalAmount.toLocaleString()} ${settings.currency}*\n`;
    text += `-----------------------------------------\n`;
    text += `برمجة وتطوير م.عبدالمجيد المحواشي\n`;
    text += `شكراً لزيارتكم وتعاملكم الراقي معنا! 🌸\n`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodedText}`;
    
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div id="invoice_modal_overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 print:bg-white print:absolute print:inset-0">
      
      {/* CSS print override parameters injected on-the-fly depending on selected paper width */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${paperSize === '80mm' ? '80mm auto' : '58mm auto'} !important;
            margin: 0 !important;
          }
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            width: ${paperSize} !important;
            margin: 0 !important;
            padding: 0 !important;
            direction: rtl !important;
          }
          #invoice_modal_overlay {
            background: #ffffff !important;
            position: absolute !important;
            inset: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            z-index: 99999 !important;
          }
          .print-area {
            display: block !important;
            width: ${paperSize} !important;
            max-width: ${paperSize} !important;
            margin: 0 auto !important;
            padding: ${paperSize === '80mm' ? '4mm' : '2mm'} !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="w-full max-w-sm rounded-2xl bg-white text-black shadow-2xl border border-gray-200 overflow-hidden relative animate-fadeIn flex flex-col justify-between no-print">
        
        {/* Modal Top Control Bar (Non-printed) */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-gray-800">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-[#C5A862]" />
            <span className="text-xs font-bold text-[#F3E7C4]">
              معاينة الفاتورة الحرارية
            </span>
          </div>
          
          <button
            id="close_invoice_modal_btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Paper format selector and auto print toggle (Non-printed) */}
        <div className="p-3 bg-slate-950 border-b border-gray-800 flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A862]" />
            <span>عرض ورق الطباعة:</span>
            <select
              value={paperSize}
              onChange={(e) => {
                soundManager.playScanBeep();
                setPaperSize(e.target.value as any);
              }}
              className="bg-slate-900 border border-gray-800 text-xs font-bold text-[#C5A862] rounded px-1.5 py-0.5 focus:outline-none"
            >
              <option value="80mm">حراري قياسي (80mm)</option>
              <option value="58mm">حراري مصغر (58mm)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none">
            <input
              type="checkbox"
              checked={autoDirectPrint}
              onChange={(e) => handleAutoPrintToggle(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-800 bg-[#16212E] accent-[#C5A862]"
            />
            <span>توجيه مباشر ⚡</span>
          </label>
        </div>

        {/* PRINTABLE BILL CANVAS AREA */}
        <div className="p-5 bg-white overflow-y-auto max-h-[380px] font-sans print-area" style={{ direction: 'rtl' }}>
          
          <div className="text-center space-y-1">
            {/* Store Name & Branding */}
            <h2 className="text-base font-extrabold tracking-tight text-gray-900">
              👑 {settings.storeName}
            </h2>
            <p className="text-[10px] text-gray-500 font-bold">للأجهزة الذكية والصيانة والبرمجة</p>
            <p className="text-[9px] text-gray-400 font-mono">{settings.address}</p>
            <p className="text-[9px] text-gray-400 font-mono">تلفون: {settings.phone}</p>
          </div>

          <div className="my-3 border-t border-dashed border-gray-400"></div>

          {/* Bill Metadata Block */}
          <div className="text-[10px] space-y-1 text-gray-700">
            <div className="flex justify-between">
              <span>رقم الفاتورة:</span>
              <span className="font-bold font-mono">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>التاريخ والوقت:</span>
              <span className="font-mono">
                {new Date(invoice.date).toLocaleString('ar-YE', {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>العميل المستلم:</span>
              <span className="font-bold">{invoice.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span>شروط الفاتورة:</span>
              <span className="font-bold text-[9px]">
                {invoice.type === 'cash' ? 'نقدي (كاش)' : 'ذمم / آجل قيد الحساب'}
              </span>
            </div>
          </div>

          <div className="my-3 border-t border-dashed border-gray-400"></div>

          {/* Itemized list of purchase */}
          <table className="w-full text-right text-[10px] text-gray-800">
            <thead>
              <tr className="border-b border-dashed border-gray-400 pb-1 font-bold">
                <th className="pb-1 text-right">السلعة</th>
                <th className="pb-1 text-center">الكمية</th>
                <th className="pb-1 text-left">المجموع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-gray-300">
              {invoice.items.map((item, idx) => (
                <tr key={idx} className="py-1">
                  <td className="py-1 font-medium">
                    <div>{item.name}</div>
                    <div className="text-[9px] text-gray-400 font-mono">
                      {item.sellingPrice.toLocaleString()} {settings.currency}
                    </div>
                  </td>
                  <td className="py-1 text-center font-bold font-mono">{item.quantity}</td>
                  <td className="py-1 text-left font-bold font-mono">
                    {item.total.toLocaleString()} {settings.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-3 border-t border-dashed border-gray-400"></div>

          {/* Financial calculations */}
          <div className="text-[10px] space-y-1 text-gray-800">
            <div className="flex justify-between">
              <span>المجموع الفرعي:</span>
              <span className="font-mono">{invoice.totalAmount.toLocaleString()} {settings.currency}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-red-700">
                <span>خصم خاص مخصوم:</span>
                <span className="font-mono">- {invoice.discount.toLocaleString()} {settings.currency}</span>
              </div>
            )}
            <div className="h-px border-t border-dashed border-gray-400 my-1"></div>
            <div className="flex justify-between items-center text-[11px] font-bold text-gray-900">
              <span>الصافي النهائي للتسديد:</span>
              <span className="font-mono text-xs">
                {invoice.finalAmount.toLocaleString()} {settings.currency}
              </span>
            </div>
          </div>

          <div className="my-4 border-t border-dashed border-gray-400"></div>

          {/* Footer message / QR placeholder */}
          <div className="text-center space-y-1 text-gray-600">
            <p className="text-[9px] font-semibold flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
              تم الحفظ بنجاح في النظام المحاسبي للكمبيوتر
            </p>
            <p className="text-[9px] text-gray-500">
              برمجة وتطوير م. عبدالمجيد المحواشي (الجمهورية اليمنية)
            </p>
            <div className="flex justify-center my-1.5">
              {/* Retro simulated barcode bar in CSS */}
              <div className="w-32 h-5 flex gap-0.5 justify-center items-center opacity-70">
                {[2,1,3,1,2,4,1,3,2,1,3,4,1,2,1,3,2,4,1,1].map((w, i) => (
                  <div key={i} className="bg-black h-full" style={{ width: `${w}px` }}></div>
                ))}
              </div>
            </div>
            <p className="text-[8px] text-gray-400 flex items-center justify-center gap-0.5">
              سعدنا بزيارتكم الكريمة <Heart className="w-2 text-red-500 fill-red-500" /> طاب يومكم
            </p>
          </div>

        </div>

        {/* WhatsApp Sender (Collapsible/Slide-down form) */}
        {showWhatsAppForm && (
          <div className="px-4 py-3 bg-[#0c141e] border-t border-gray-800 text-xs text-gray-300 space-y-2 animate-fadeIn no-print">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#F3E7C4] flex items-center gap-1">
                <MessageCircle className="w-4 h-4 text-green-400" /> إرسال الفاتورة عبر الواتساب
              </span>
              <button 
                onClick={() => setShowWhatsAppForm(false)} 
                className="text-gray-500 hover:text-gray-300 cursor-pointer text-xs"
              >
                إغلاق ×
              </button>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="رقم الهاتف (مثال: 777140209)"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="flex-1 bg-[#16212E] border border-gray-800 text-xs font-mono rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#C5A862]"
              />
              <button
                onClick={handleSendWhatsApp}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-green-500 text-black hover:bg-green-600 cursor-pointer transition shadow flex items-center gap-1 shrink-0"
              >
                إرسال 💬
              </button>
            </div>
            <p className="text-[10px] text-gray-500">
              سيتم تهيئة رسالة الفاتورة المنسقة وفتح واتساب لإرسالها مباشرة للعميل.
            </p>
          </div>
        )}

        {/* Modal Bottom Actions (Non-printed) */}
        <div className="p-4 bg-slate-900 border-t border-gray-800 flex gap-2">
          <button
            id="print_thermal_invoice_btn"
            onClick={handlePrint}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-green-500 text-black hover:bg-green-600 cursor-pointer flex items-center justify-center gap-1 shadow transition"
          >
            <Printer className="w-3.5 h-3.5" /> طباعة
          </button>
          
          <button
            id="download_text_invoice_btn"
            onClick={handleDownload}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#C5A862] text-black hover:bg-[#A0813D] cursor-pointer flex items-center justify-center gap-1 shadow transition"
          >
            <Download className="w-3.5 h-3.5" /> تحميل
          </button>

          <button
            id="toggle_whatsapp_btn"
            onClick={() => {
              soundManager.playScanBeep();
              setShowWhatsAppForm(!showWhatsAppForm);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1 shadow transition ${
              showWhatsAppForm 
                ? 'bg-green-600 text-white' 
                : 'bg-slate-800 text-green-400 hover:bg-slate-700'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" /> واتساب
          </button>
        </div>

      </div>

      {/* Actual Printed Canvas Wrapper - Visible ONLY in print output, styled dynamically to selected paper width */}
      <div className="hidden print:block print-area" style={{ direction: 'rtl' }}>
        <div className="text-center space-y-1">
          <h2 className="font-extrabold tracking-tight text-black">
            👑 {settings.storeName}
          </h2>
          <p className="text-[10px] font-bold">للأجهزة الذكية والصيانة والبرمجة</p>
          <p className="text-[9px]">{settings.address}</p>
          <p className="text-[9px]">تلفون: {settings.phone}</p>
        </div>

        <div className="my-2 border-t border-dashed border-black"></div>

        <div className="text-[10px] space-y-0.5 text-black">
          <div className="flex justify-between">
            <span>رقم الفاتورة:</span>
            <span className="font-bold">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>التاريخ والوقت:</span>
            <span>{new Date(invoice.date).toLocaleString('ar-YE')}</span>
          </div>
          <div className="flex justify-between">
            <span>العميل:</span>
            <span className="font-bold">{invoice.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span>شروط الفاتورة:</span>
            <span className="font-bold">{invoice.type === 'cash' ? 'نقدي (كاش)' : 'ذمم / آجل قيد الحساب'}</span>
          </div>
        </div>

        <div className="my-2 border-t border-dashed border-black"></div>

        <table className="w-full text-right text-[10px] text-black">
          <thead>
            <tr className="border-b border-dashed border-black pb-0.5 font-bold">
              <th className="pb-0.5 text-right">السلعة</th>
              <th className="pb-0.5 text-center">الكمية</th>
              <th className="pb-0.5 text-left">المجموع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-black">
            {invoice.items.map((item, idx) => (
              <tr key={idx} className="py-0.5">
                <td className="py-1">
                  <div>{item.name}</div>
                  <div className="text-[9px] text-gray-600">
                    {item.sellingPrice.toLocaleString()} {settings.currency}
                  </div>
                </td>
                <td className="py-1 text-center font-bold">{item.quantity}</td>
                <td className="py-1 text-left font-bold">
                  {item.total.toLocaleString()} {settings.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-black"></div>

        <div className="text-[10px] space-y-0.5 text-black">
          <div className="flex justify-between">
            <span>المجموع الفرعي:</span>
            <span>{invoice.totalAmount.toLocaleString()} {settings.currency}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between">
              <span>الخصم الممنوح:</span>
              <span>- {invoice.discount.toLocaleString()} {settings.currency}</span>
            </div>
          )}
          <div className="h-px border-t border-dashed border-black my-1"></div>
          <div className="flex justify-between items-center text-[11px] font-bold">
            <span>الصافي النهائي:</span>
            <span className="text-xs">{invoice.finalAmount.toLocaleString()} {settings.currency}</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-black"></div>

        <div className="text-center space-y-1 text-black">
          <p className="text-[9px] font-semibold">
            ✓ تم الحفظ والحساب بنجاح في النظام المحاسبي
          </p>
          <p className="text-[9px]">
            برمجة وتطوير م. عبدالمجيد المحواشي (الجمهورية اليمنية)
          </p>
          <p className="text-[8px] text-gray-600">
            سعدنا بزيارتكم الكريمة ♥ طاب يومكم
          </p>
        </div>
      </div>

    </div>
  );
}
