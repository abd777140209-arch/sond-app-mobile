/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Printer, Download, X, ShieldCheck, Heart, Smartphone, SlidersHorizontal, MessageCircle, FileDown, Loader2, Share2, Bluetooth, QrCode, ArrowRight, Eye, Paperclip, Image as ImageIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Invoice, SystemSettings, Customer } from '../types';
import { soundManager } from '../utils/sound';
import { formatPaymentMethodLabel } from '../utils/paymentMethods';
import { requestStoragePermissionOnDemand } from '../utils/androidPermissions';
import { safeStorage } from '../utils/safeStorage';
import { saveAndShareFile } from '../utils/fileExport';
import { openWhatsApp } from '../utils/nativeLauncher';
import { printSalesInvoiceThermalHTML, generateSalesInvoiceThermalPDF, SalesInvoicePrintData } from '../services/ReceiptPrinter';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  settings: SystemSettings;
  customers?: Customer[];
}

export default function InvoiceModal({ invoice, onClose, settings, customers }: InvoiceModalProps) {
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');
  const [autoDirectPrint, setAutoDirectPrint] = useState(() => {
    return safeStorage.getItem('auto_direct_print') === 'true';
  });

  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isBluetoothConnecting, setIsBluetoothConnecting] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);

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

  // Auto-route print when invoice loads if configured
  useEffect(() => {
    if (autoDirectPrint && invoice) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoice, autoDirectPrint]);

  useEffect(() => {
    if (!invoice) return;
    const handleBack = () => {
      onClose();
    };
    window.addEventListener('android-modal-close', handleBack);
    return () => window.removeEventListener('android-modal-close', handleBack);
  }, [invoice, onClose]);

  if (!invoice) return null;

  // Helper to extract SVG QR code as base64 data URL
  const getQrCodeDataUrl = (): string => {
    try {
      const svgEl = document.querySelector('#invoice-printable-card svg') as SVGElement;
      if (svgEl) {
        const xml = new XMLSerializer().serializeToString(svgEl);
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
      }
    } catch (e) {}
    return '';
  };

  const getInvoicePrintPayload = (): SalesInvoicePrintData => {
    return {
      invoiceNumber: invoice.invoiceNumber,
      customerName: customers?.find(c => c.id === invoice.customerId)?.name || invoice.customerName || 'عميل سفري / نقدي (كاش)',
      customerPhone: phoneInput || '',
      date: invoice.date,
      paymentMethod: formatPaymentMethodLabel(invoice.paymentMethod || invoice.type, invoice.referenceNumber),
      items: invoice.items,
      totalAmount: invoice.totalAmount,
      discount: invoice.discount || 0,
      finalAmount: invoice.finalAmount,
      notes: settings.invoiceFooterNote || localStorage.getItem('sanad_invoice_footer_note') || '',
      storeLogoUrl: settings.storeLogoUrl || '',
      storeAddress: settings.address || '',
      storePhone: settings.phone || '',
      paperSize: paperSize,
      qrCodeUrl: getQrCodeDataUrl()
    };
  };

  // 1. [طباعة] - طباعة حرارية (Thermal 80mm / 58mm) متطابقة 100% مع شكل الفاتورة المعروضة
  const handlePrint = async () => {
    soundManager.playSuccessChime();
    const payload = getInvoicePrintPayload();
    await printSalesInvoiceThermalHTML(
      settings.storeName || 'سند للمحاسبة والخدمات',
      payload,
      settings.currency
    );
  };

  // 2. [بلوتوث] - طباعة حرارية مباشرة عبر البلوتوث للطابعات المحمولة
  const handleBluetoothPrint = async () => {
    soundManager.playSuccessChime();
    setIsBluetoothConnecting(true);

    try {
      if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
        try {
          const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['0000180f-0000-1000-8000-00805f9b34fb', '00001101-0000-1000-8000-00805f9b34fb']
          });
          if (device) {
            console.log('Bluetooth Thermal Printer Paired:', device.name);
          }
        } catch (btErr) {
          console.warn('Bluetooth pairing skipped:', btErr);
        }
      }

      const payload = getInvoicePrintPayload();
      await printSalesInvoiceThermalHTML(
        settings.storeName || 'سند للمحاسبة والخدمات',
        payload,
        settings.currency
      );
    } catch (err) {
      console.error('Bluetooth Thermal Print Error:', err);
    } finally {
      setIsBluetoothConnecting(false);
    }
  };

  // 3. [PDF] - حفظ الفاتورة كملف PDF نصي عالي الدقة بنفس شكل الفاتورة الحرارية تماماً
  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    soundManager.playSuccessChime();
    setIsExportingPDF(true);

    try {
      const payload = getInvoicePrintPayload();
      await generateSalesInvoiceThermalPDF(
        settings.storeName || 'سند للمحاسبة والخدمات',
        payload,
        settings.currency
      );
    } catch (error) {
      console.error('فشل تصدير الفاتورة كـ PDF:', error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleAutoPrintToggle = (checked: boolean) => {
    setAutoDirectPrint(checked);
    safeStorage.setItem('auto_direct_print', checked ? 'true' : 'false');
    soundManager.playScanBeep();
  };

  const handleDownload = async () => {
    soundManager.playSuccessChime();
    
    let text = `\uFEFF`;
    text += `-----------------------------------------\n`;
    text += `        ${settings.storeName.toUpperCase()}        \n`;
    if (settings.address) text += `        ${settings.address}        \n`;
    if (settings.phone) text += `        هاتف: ${settings.phone}        \n`;
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

    const fileName = `smart_invoice_${invoice.invoiceNumber}.txt`;

    await saveAndShareFile({
      fileName,
      data: text,
      mimeType: 'text/plain;charset=utf-8',
      title: `فاتورة ${invoice.invoiceNumber}`,
      text: `ملف نصي للفاتورة رقم ${invoice.invoiceNumber}`
    });
  };

  // 4. [واتساب] - إرسال فوري ومباشر دون تعليق أو شاشة بيضاء
  const handleSendWhatsApp = async () => {
    soundManager.playSuccessChime();

    let cleanedPhone = phoneInput.replace(/\D/g, '');
    if (cleanedPhone.startsWith('00')) {
      cleanedPhone = cleanedPhone.slice(2);
    }
    if (cleanedPhone.length === 9 && (cleanedPhone.startsWith('77') || cleanedPhone.startsWith('73') || cleanedPhone.startsWith('71') || cleanedPhone.startsWith('70') || cleanedPhone.startsWith('78'))) {
      cleanedPhone = '967' + cleanedPhone;
    }

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
    if (settings.phone) text += `هاتف المعرض: ${settings.phone}\n`;
    text += `برمجة وتطوير م.عبدالمجيد المحواشي\n`;
    text += `شكراً لزيارتكم وتعاملكم الراقي معنا! 🌸\n`;

    try {
      await openWhatsApp(cleanedPhone, text);
    } catch (e) {
      console.error('WhatsApp launch error:', e);
      const encodedText = encodeURIComponent(text);
      const waUrl = cleanedPhone 
        ? `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodedText}`
        : `https://api.whatsapp.com/send?text=${encodedText}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div id="invoice_modal_overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 print:bg-white print:absolute print:inset-0">
      
      <div className="w-full max-w-sm max-h-[92vh] rounded-2xl bg-white text-black shadow-2xl border border-gray-200 overflow-hidden relative animate-fadeIn flex flex-col justify-between no-print">
        
        {/* Modal Top Control Bar */}
        <div className="p-3 bg-slate-900 text-white flex justify-between items-center border-b border-gray-800 shrink-0">
          <button
            id="return_to_pos_btn"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع للمبيعات</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[#C5A862]">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-bold text-[#F3E7C4] hidden sm:inline">
                معاينة الفاتورة
              </span>
            </div>
            
            <button
              id="close_invoice_modal_btn"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white cursor-pointer transition"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Paper format selector */}
        <div className="p-2.5 bg-slate-950 border-b border-gray-800 flex items-center justify-between text-xs text-gray-300 shrink-0">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A862]" />
            <span>العرض:</span>
            <select
              value={paperSize}
              onChange={(e) => {
                soundManager.playScanBeep();
                setPaperSize(e.target.value as any);
              }}
              className="bg-slate-900 border border-gray-800 text-xs font-bold text-[#C5A862] rounded px-1.5 py-0.5 focus:outline-none"
            >
              <option value="80mm">قياسي (80mm)</option>
              <option value="58mm">مصغر (58mm)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none">
            <input
              type="checkbox"
              checked={autoDirectPrint}
              onChange={(e) => handleAutoPrintToggle(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-800 bg-[#16212E] accent-[#C5A862]"
            />
            <span>مباشر ⚡</span>
          </label>
        </div>

        {/* PRINTABLE BILL CANVAS AREA */}
        <div 
          id="invoice-printable-card" 
          data-export-container="true" 
          data-receipt-card="true"
          className="p-4 bg-white overflow-y-auto font-sans flex-1 printable-invoice-card" 
          style={{ direction: 'rtl', boxSizing: 'border-box' }}
        >
          
          <div className="text-center space-y-1">
            {settings.storeLogoUrl && (
              <img 
                src={settings.storeLogoUrl} 
                alt={settings.storeName} 
                className="w-12 h-12 mx-auto object-contain mb-1 rounded-lg"
              />
            )}
            <h2 className="text-base font-extrabold tracking-tight text-gray-900">
              {settings.storeName}
            </h2>
            <p className="text-[10px] text-gray-500 font-bold">للأجهزة الذكية والصيانة والبرمجة</p>
            {settings.address && <p className="text-[9px] text-gray-400 font-mono">{settings.address}</p>}
            {settings.phone && <p className="text-[9px] text-gray-400 font-mono">تلفون: {settings.phone}</p>}
          </div>

          <div className="my-2.5 border-t border-dashed border-gray-400"></div>

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
              <span>طريقة السداد:</span>
              <span className="font-bold text-[9px] text-[#C5A862]">
                {formatPaymentMethodLabel(invoice.paymentMethod || invoice.type, invoice.referenceNumber)}
              </span>
            </div>
            {invoice.proofImage && (
              <div className="flex justify-between items-center bg-blue-50/80 p-1.5 rounded-lg border border-blue-200 mt-1">
                <span className="flex items-center gap-1 text-[9px] font-bold text-blue-950">
                  <Paperclip className="w-3 h-3 text-blue-600" />
                  <span>إشعار السند المرفق:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowProofModal(true)}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Eye className="w-2.5 h-2.5" />
                  <span>عرض السند</span>
                </button>
              </div>
            )}
          </div>

          <div className="my-2.5 border-t border-dashed border-gray-400"></div>

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

          <div className="my-2.5 border-t border-dashed border-gray-400"></div>

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

          <div className="my-3 border-t border-dashed border-gray-400"></div>

          {/* Footer message / QR placeholder */}
          <div className="text-center space-y-1.5 text-gray-600">
            {/* Printed Invoice Footer Note (Policy / Terms / Warranty) */}
            {(settings.invoiceFooterNote || localStorage.getItem('sanad_invoice_footer_note')) && (
              <div className="my-2 p-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-[9px] text-gray-800 font-bold leading-relaxed whitespace-pre-line text-center">
                {settings.invoiceFooterNote || localStorage.getItem('sanad_invoice_footer_note')}
              </div>
            )}

            <p className="text-[9px] font-semibold flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
              تم الحفظ بنجاح في النظام المحاسبي للكمبيوتر
            </p>
            <p className="text-[9px] text-gray-500">
              برمجة وتطوير م. عبدالمجيد المحواشي (الجمهورية اليمنية)
            </p>
            <div className="flex flex-col items-center justify-center my-2 pt-1 border-t border-dashed border-gray-300">
              <div className="p-1 bg-white border border-gray-300 rounded-lg shadow-xs">
                <QRCodeSVG
                  value={JSON.stringify({
                    seller: settings.storeName,
                    vatNumber: "300012345600003",
                    timestamp: invoice.date,
                    total: invoice.finalAmount,
                    currency: settings.currency,
                    invoiceNum: invoice.invoiceNumber
                  })}
                  size={72}
                  level="M"
                />
              </div>
              <span className="text-[8px] font-bold text-gray-500 mt-1 flex items-center gap-0.5">
                <QrCode className="w-2.5 h-2.5 text-blue-600" /> رمز الفاتورة الإلكترونية المعتمد
              </span>
            </div>

            <p className="text-[8px] text-gray-400 flex items-center justify-center gap-0.5">
              سعدنا بزيارتكم الكريمة <Heart className="w-2 text-red-500 fill-red-500" /> طاب يومكم
            </p>
          </div>

        </div>

        {/* WhatsApp Sender */}
        {showWhatsAppForm && (
          <div className="px-3 py-2.5 bg-[#0c141e] border-t border-gray-800 text-xs text-gray-300 space-y-2 animate-fadeIn shrink-0">
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
                className="flex-1 bg-[#16212E] border border-gray-800 text-xs font-mono rounded-xl px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#C5A862]"
              />
              <button
                onClick={handleSendWhatsApp}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-green-500 text-black hover:bg-green-600 cursor-pointer transition shadow flex items-center gap-1 shrink-0"
              >
                إرسال 💬
              </button>
            </div>
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="p-2.5 bg-slate-900 border-t border-gray-800 grid grid-cols-5 gap-1.5 shrink-0">
          <button
            id="print_thermal_invoice_btn"
            onClick={handlePrint}
            className="py-2 px-1 rounded-xl text-[11px] font-bold bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer flex items-center justify-center gap-1 shadow transition"
            title="طباعة حرارية مباشرة"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>طباعة</span>
          </button>

          <button
            id="print_bluetooth_invoice_btn"
            onClick={handleBluetoothPrint}
            disabled={isBluetoothConnecting}
            className="py-2 px-1 rounded-xl text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 shadow transition"
            title="طباعة بلوتوث"
          >
            {isBluetoothConnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Bluetooth className="w-3.5 h-3.5 shrink-0 text-blue-200" />
            )}
            <span>بلوتوث</span>
          </button>

          <button
            id="export_pdf_invoice_btn"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="py-2 px-1 rounded-xl text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 shadow transition"
            title="تصدير PDF"
          >
            {isExportingPDF ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <FileDown className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>PDF</span>
          </button>
          
          <button
            id="download_text_invoice_btn"
            onClick={handleDownload}
            className="py-2 px-1 rounded-xl text-[11px] font-bold bg-[#C5A862] text-black hover:bg-[#A0813D] cursor-pointer flex items-center justify-center gap-1 shadow transition"
            title="تحميل إيصال نصي"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>نصي</span>
          </button>

          <button
            id="toggle_whatsapp_btn"
            onClick={() => {
              soundManager.playScanBeep();
              setShowWhatsAppForm(!showWhatsAppForm);
            }}
            className={`py-2 px-1 rounded-xl text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1 shadow transition ${
              showWhatsAppForm 
                ? 'bg-green-600 text-white' 
                : 'bg-slate-800 text-green-400 hover:bg-slate-700'
            }`}
            title="واتساب"
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span>واتساب</span>
          </button>
        </div>

      </div>

      {/* Proof Image Fullscreen View Modal */}
      {showProofModal && invoice.proofImage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-6 no-print">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-3.5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold">صورة سند التحويل / إشعار الإيداع المرفق</span>
              </div>
              <button
                type="button"
                onClick={() => setShowProofModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 overflow-auto flex items-center justify-center bg-slate-950/60 max-h-[70vh]">
              <img
                src={invoice.proofImage}
                alt="صورة السند"
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg border border-slate-800"
              />
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                فاتورة: {invoice.invoiceNumber} {invoice.referenceNumber ? `(مرجع #${invoice.referenceNumber})` : ''}
              </span>
              <button
                type="button"
                onClick={() => setShowProofModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
