/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  ShieldCheck, 
  Heart, 
  Smartphone, 
  SlidersHorizontal, 
  MessageCircle, 
  FileDown, 
  Loader2, 
  Share2, 
  Bluetooth, 
  QrCode, 
  ArrowRight, 
  Eye, 
  Paperclip, 
  Image as ImageIcon,
  Palette,
  Sparkles,
  Settings,
  Scissors,
  Type
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { 
  Invoice, 
  SystemSettings, 
  Customer, 
  InvoicePaperSize, 
  InvoiceTemplateStyle, 
  PrinterSettings,
  InvoiceFontFamily,
  InvoiceFontSizeScale,
  InvoiceFontWeight
} from '../types';
import { soundManager } from '../utils/sound';
import { formatPaymentMethodLabel } from '../utils/paymentMethods';
import { safeStorage } from '../utils/safeStorage';
import { saveAndShareFile } from '../utils/fileExport';
import { openWhatsApp } from '../utils/nativeLauncher';
import { 
  printSalesInvoiceThermalHTML, 
  generateSalesInvoiceThermalPDF, 
  SalesInvoicePrintData 
} from '../services/ReceiptPrinter';
import { 
  getEffectivePrinterSettings, 
  savePrinterSettingsLocally,
  INVOICE_FONTS,
  INVOICE_FONT_COLORS,
  INVOICE_FONT_WEIGHTS,
  INVOICE_FONT_SIZE_SCALES,
  getFontFamilyCss,
  getFontWeightCss,
  getLineHeightCss,
  getFontSizeMultiplier
} from '../utils/printerDefaults';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  settings: SystemSettings;
  customers?: Customer[];
  onOpenPrinterSettings?: () => void;
  onSaveSettings?: (settings: SystemSettings) => void;
}

export default function InvoiceModal({ 
  invoice, 
  onClose, 
  settings, 
  customers,
  onOpenPrinterSettings,
  onSaveSettings
}: InvoiceModalProps) {
  // 1. Reactive Printer & Template Settings
  const [printerConfig, setPrinterConfig] = useState<PrinterSettings>(() => {
    return getEffectivePrinterSettings(settings);
  });

  const [paperSize, setPaperSize] = useState<InvoicePaperSize>(
    printerConfig.paperSize || '80mm'
  );

  const [autoDirectPrint, setAutoDirectPrint] = useState(() => {
    return safeStorage.getItem('auto_direct_print') === 'true' || printerConfig.autoPrintOnSale;
  });

  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isBluetoothConnecting, setIsBluetoothConnecting] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showQuickTemplatePicker, setShowQuickTemplatePicker] = useState(false);

  const barcodeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync settings when external props change
  useEffect(() => {
    const updated = getEffectivePrinterSettings(settings);
    setPrinterConfig(updated);
    if (updated.paperSize) {
      setPaperSize(updated.paperSize);
    }
  }, [settings]);

  // Listen to cross-tab or global printer settings updates
  useEffect(() => {
    const handleSettingsUpdated = (e: any) => {
      if (e?.detail) {
        setPrinterConfig(prev => ({ ...prev, ...e.detail }));
        if (e.detail.paperSize) {
          setPaperSize(e.detail.paperSize);
        }
      } else {
        setPrinterConfig(getEffectivePrinterSettings(settings));
      }
    };
    window.addEventListener('printer_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('printer_settings_updated', handleSettingsUpdated);
  }, [settings]);

  // Customer phone matching
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

  // Render Barcode dynamically on Canvas
  useEffect(() => {
    if (
      barcodeCanvasRef.current && 
      (printerConfig.codeType === 'barcode' || printerConfig.codeType === 'both') && 
      invoice
    ) {
      try {
        JsBarcode(barcodeCanvasRef.current, invoice.invoiceNumber, {
          format: 'CODE128',
          width: paperSize === '58mm' ? 1.2 : 1.5,
          height: paperSize === '58mm' ? 28 : 34,
          displayValue: true,
          font: 'monospace',
          fontSize: 9,
          textMargin: 2,
          margin: 2
        });
      } catch (err) {
        console.warn('Barcode render notice in InvoiceModal:', err);
      }
    }
  }, [printerConfig.codeType, paperSize, printerConfig.templateStyle, invoice]);

  // Auto-route direct print if configured
  useEffect(() => {
    if (autoDirectPrint && invoice) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoice, autoDirectPrint]);

  // Back button for Android
  useEffect(() => {
    if (!invoice) return;
    const handleBack = () => {
      onClose();
    };
    window.addEventListener('android-modal-close', handleBack);
    return () => window.removeEventListener('android-modal-close', handleBack);
  }, [invoice, onClose]);

  if (!invoice) return null;

  // Extract SVG QR code as base64 data URL
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

  const matchedCustomer = customers?.find(c => c.id === invoice.customerId);

  const getInvoicePrintPayload = (): SalesInvoicePrintData => {
    return {
      invoiceNumber: invoice.invoiceNumber,
      customerName: matchedCustomer?.name || invoice.customerName || 'عميل سفري / نقدي (كاش)',
      customerPhone: phoneInput || matchedCustomer?.phone || '',
      customerBalance: matchedCustomer?.totalDebt,
      cashierName: printerConfig.showCashierName ? 'الكاشير' : undefined,
      date: invoice.date,
      paymentMethod: formatPaymentMethodLabel(invoice.paymentMethod || invoice.type, invoice.referenceNumber),
      items: invoice.items,
      totalAmount: invoice.totalAmount,
      discount: invoice.discount || 0,
      finalAmount: invoice.finalAmount,
      notes: printerConfig.showFooterPolicy ? (printerConfig.footerPolicyNote || settings.invoiceFooterNote || '') : '',
      storeLogoUrl: printerConfig.showLogo ? (settings.storeLogoUrl || '') : '',
      storeAddress: printerConfig.showHeaderAddress ? (settings.address || '') : '',
      storePhone: printerConfig.showHeaderPhone ? (settings.phone || '') : '',
      paperSize: paperSize,
      qrCodeUrl: getQrCodeDataUrl(),
      printerSettings: {
        ...printerConfig,
        paperSize: paperSize
      }
    };
  };

  // Quick Template Change Handler
  const handleQuickTemplateChange = (newStyle: InvoiceTemplateStyle) => {
    soundManager.playScanBeep();
    const updated: PrinterSettings = {
      ...printerConfig,
      templateStyle: newStyle
    };
    setPrinterConfig(updated);
    savePrinterSettingsLocally(updated);
    if (onSaveSettings) {
      onSaveSettings({
        ...settings,
        printerSettings: updated
      });
    }
  };

  // Paper Size Change Handler
  const handlePaperSizeChange = (newSize: InvoicePaperSize) => {
    soundManager.playScanBeep();
    setPaperSize(newSize);
    const updated: PrinterSettings = {
      ...printerConfig,
      paperSize: newSize
    };
    setPrinterConfig(updated);
    savePrinterSettingsLocally(updated);
    if (onSaveSettings) {
      onSaveSettings({
        ...settings,
        printerSettings: updated
      });
    }
  };

  // Font Family Change Handler
  const handleFontFamilyChange = (newFamily: InvoiceFontFamily) => {
    soundManager.playScanBeep();
    const updated: PrinterSettings = {
      ...printerConfig,
      fontFamily: newFamily
    };
    setPrinterConfig(updated);
    savePrinterSettingsLocally(updated);
    if (onSaveSettings) {
      onSaveSettings({
        ...settings,
        printerSettings: updated
      });
    }
  };

  // Font Size Scale Change Handler
  const handleFontSizeScaleChange = (newScale: InvoiceFontSizeScale) => {
    soundManager.playScanBeep();
    const updated: PrinterSettings = {
      ...printerConfig,
      fontSizeScale: newScale
    };
    setPrinterConfig(updated);
    savePrinterSettingsLocally(updated);
    if (onSaveSettings) {
      onSaveSettings({
        ...settings,
        printerSettings: updated
      });
    }
  };

  // Font Color Change Handler
  const handleFontColorChange = (newColor: string) => {
    soundManager.playScanBeep();
    const updated: PrinterSettings = {
      ...printerConfig,
      fontColor: newColor
    };
    setPrinterConfig(updated);
    savePrinterSettingsLocally(updated);
    if (onSaveSettings) {
      onSaveSettings({
        ...settings,
        printerSettings: updated
      });
    }
  };

  // Font Weight Change Handler
  const handleFontWeightChange = (newWeight: InvoiceFontWeight) => {
    soundManager.playScanBeep();
    const updated: PrinterSettings = {
      ...printerConfig,
      fontWeight: newWeight
    };
    setPrinterConfig(updated);
    savePrinterSettingsLocally(updated);
    if (onSaveSettings) {
      onSaveSettings({
        ...settings,
        printerSettings: updated
      });
    }
  };

  // 1. [طباعة] - طباعة حرارية فورية متطابقة 100% مع التصميم المختار
  const handlePrint = async () => {
    soundManager.playSuccessChime();
    const payload = getInvoicePrintPayload();
    await printSalesInvoiceThermalHTML(
      settings.storeName || 'سند للمحاسبة والخدمات',
      payload,
      settings.currency
    );
  };

  // 2. [بلوتوث] - طباعة عبر البلوتوث للطابعات المحمولة
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

  // 3. [PDF] - حفظ الفاتورة كملف PDF عالي الدقة بنفس نمط وقالب الفاتورة تماماً
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

  // 4. [واتساب] - إرسال الفاتورة عبر واتساب
  const handleSendWhatsApp = async () => {
    soundManager.playSuccessChime();

    let cleanedPhone = phoneInput.replace(/\D/g, '');
    if (cleanedPhone.startsWith('00')) {
      cleanedPhone = cleanedPhone.slice(2);
    }
    if (cleanedPhone.length === 9 && (cleanedPhone.startsWith('77') || cleanedPhone.startsWith('73') || cleanedPhone.startsWith('71') || cleanedPhone.startsWith('70') || cleanedPhone.startsWith('78'))) {
      cleanedPhone = '967' + cleanedPhone;
    }

    const cleanTitle = (printerConfig.invoiceTitle || 'فاتورة مبيعات')
      .replace(/فاتورة\s*ضريبية\s*معتمدة/g, 'فاتورة مبيعات')
      .replace(/ضريبية\s*معتمدة|ضريبة\s*معتمدة/g, 'مبيعات')
      .trim() || 'فاتورة مبيعات';
    let text = `👑 *${settings.storeName.toUpperCase()}* 👑\n`;
    text += `*${cleanTitle} رقم:* ${invoice.invoiceNumber}\n`;
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
    if (printerConfig.footerPolicyNote) text += `ملاحظة: ${printerConfig.footerPolicyNote}\n`;
    text += `برمجة وتطوير م.عبدالمجيد المحواشي\n`;
    text += `${printerConfig.footerGreeting || 'شكراً لزيارتكم وتعاملكم الراقي معنا! 🌸'}\n`;

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

  const isWidePaper = paperSize === 'a4' || paperSize === 'a5';
  const primaryColor = printerConfig.primaryColor || '#0f172a';
  const sizeMult = getFontSizeMultiplier(printerConfig.fontSizeScale);
  const baseFontSizePx = (paperSize === '58mm' ? 10 : paperSize === 'a4' ? 13.5 : paperSize === 'a5' ? 12 : 11) * sizeMult;
  const bodyColor = printerConfig.fontColor || '#000000';
  const headerColor = printerConfig.headerFontColor || primaryColor;

  return (
    <div id="invoice_modal_overlay" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 print:bg-white print:absolute print:inset-0">
      
      <div className={`w-full ${isWidePaper ? 'max-w-lg' : 'max-w-sm'} h-[94dvh] sm:h-auto sm:max-h-[90vh] rounded-2xl bg-white text-black shadow-2xl border border-gray-200 overflow-hidden relative animate-fadeIn flex flex-col no-print`}>
        
        {/* Modal Top Control Bar */}
        <div className="p-2 sm:p-2.5 bg-slate-900 text-white flex justify-between items-center border-b border-gray-800 shrink-0">
          <button
            id="return_to_pos_btn"
            onClick={onClose}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع للمبيعات</span>
          </button>

          <div className="flex items-center gap-1.5">
            {/* Quick Template Switcher Toggle */}
            <button
              type="button"
              onClick={() => {
                soundManager.playScanBeep();
                setShowQuickTemplatePicker(!showQuickTemplatePicker);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                showQuickTemplatePicker 
                  ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                  : 'bg-slate-800 text-purple-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="تغيير شكل ونمط الفاتورة فورياً"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>القالب</span>
            </button>

            {onOpenPrinterSettings && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playScanBeep();
                  onOpenPrinterSettings();
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-amber-400 hover:text-amber-300 cursor-pointer transition border border-slate-800"
                title="تخصيص كامل الإعدادات في مركز الطابعة"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            
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

        {/* Quick Template Selection Sub-bar */}
        {showQuickTemplatePicker && (
          <div className="p-2 bg-purple-950/90 border-b border-purple-800/60 text-white shrink-0 animate-fadeIn">
            <div className="text-[11px] font-bold text-purple-200 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>اختر تصميم الفاتورة الفعلي:</span>
              </span>
              {onOpenPrinterSettings && (
                <button
                  type="button"
                  onClick={onOpenPrinterSettings}
                  className="text-[10px] text-amber-300 hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <span>مزيد من الضبط ⚙️</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1 text-[10px]">
              {[
                { id: 'modern', name: 'حديث', icon: '🌟' },
                { id: 'classic', name: 'كلاسيكي', icon: '🖨️' },
                { id: 'boxed', name: 'شبكي', icon: '📊' },
                { id: 'minimal', name: 'اقتصادي', icon: '⚡' },
                { id: 'official', name: 'رسمي', icon: '🏢' }
              ].map(t => {
                const active = printerConfig.templateStyle === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleQuickTemplateChange(t.id as InvoiceTemplateStyle)}
                    className={`py-1 px-1 rounded-lg font-bold text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                      active
                        ? 'bg-white text-purple-950 shadow-sm ring-2 ring-purple-400 font-black'
                        : 'bg-purple-900/60 text-purple-200 hover:bg-purple-800/80 border border-purple-700/50'
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Paper format, font, size, color & direct print selector bar */}
        <div className="p-2 bg-slate-950 border-b border-gray-800 flex items-center justify-between text-xs text-gray-300 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Paper Size */}
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A862]" />
              <span className="text-[11px]">الورق:</span>
              <select
                value={paperSize}
                onChange={(e) => handlePaperSizeChange(e.target.value as any)}
                className="bg-slate-900 border border-gray-800 text-[11px] font-bold text-[#C5A862] rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
              >
                <option value="80mm">حراري 80mm</option>
                <option value="58mm">مصغر 58mm</option>
                <option value="a4">صفحة كاملة (A4)</option>
                <option value="a5">نصف صفحة (A5)</option>
              </select>
            </div>

            {/* Font Family */}
            <div className="flex items-center gap-1">
              <Type className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px]">الخط:</span>
              <select
                value={printerConfig.fontFamily || 'cairo'}
                onChange={(e) => handleFontFamilyChange(e.target.value as InvoiceFontFamily)}
                className="bg-slate-900 border border-gray-800 text-[11px] font-bold text-purple-300 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
              >
                {INVOICE_FONTS.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Font Size Scaling */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-blue-400 font-bold">الحجم:</span>
              <select
                value={printerConfig.fontSizeScale || 'normal'}
                onChange={(e) => handleFontSizeScaleChange(e.target.value as InvoiceFontSizeScale)}
                className="bg-slate-900 border border-gray-800 text-[11px] font-bold text-blue-300 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
              >
                {INVOICE_FONT_SIZE_SCALES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Font Color */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-gray-800 rounded px-1.5 py-0.5">
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px]">اللون:</span>
              <input
                type="color"
                value={printerConfig.fontColor || '#000000'}
                onChange={(e) => handleFontColorChange(e.target.value)}
                className="w-4 h-4 rounded border-0 cursor-pointer p-0 bg-transparent"
                title="تخصيص لون الخط"
              />
              <select
                value={printerConfig.fontColor || '#000000'}
                onChange={(e) => handleFontColorChange(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-emerald-300 focus:outline-none cursor-pointer"
              >
                {INVOICE_FONT_COLORS.map(c => (
                  <option key={c.color} value={c.color} className="bg-slate-900 text-white">
                    {c.name.split(' ')[0]}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Weight */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-amber-400 font-bold">السماكة:</span>
              <select
                value={printerConfig.fontWeight || 'bold'}
                onChange={(e) => handleFontWeightChange(e.target.value as InvoiceFontWeight)}
                className="bg-slate-900 border border-gray-800 text-[11px] font-bold text-amber-300 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
              >
                {INVOICE_FONT_WEIGHTS.map(w => (
                  <option key={w.id} value={w.id}>{w.label.split(' ')[0]} ({w.cssWeight})</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none text-[11px]">
            <input
              type="checkbox"
              checked={autoDirectPrint}
              onChange={(e) => handleAutoPrintToggle(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-800 bg-[#16212E] accent-[#C5A862]"
            />
            <span>مباشر ⚡</span>
          </label>
        </div>

        {/* PRINTABLE BILL CANVAS AREA - DYNAMIC & TEMPLATE DRIVEN */}
        <div 
          id="invoice-printable-card" 
          data-export-container="true" 
          data-receipt-card="true"
          className="p-3 sm:p-4 bg-white overflow-y-auto flex-1 min-h-0 printable-invoice-card" 
          style={{ 
            direction: 'rtl', 
            boxSizing: 'border-box',
            fontFamily: getFontFamilyCss(printerConfig.fontFamily),
            fontWeight: getFontWeightCss(printerConfig.fontWeight),
            lineHeight: getLineHeightCss(printerConfig.lineHeight),
            color: bodyColor,
            fontSize: `${baseFontSizePx}px`
          }}
        >
          {/* Top Accent Band for Official Template */}
          {printerConfig.templateStyle === 'official' && (
            <div 
              className="h-1.5 w-full rounded-sm mb-2" 
              style={{ backgroundColor: primaryColor }} 
            />
          )}

          {/* 1. Header & Logo Block */}
          <div className="text-center pb-1">
            {printerConfig.showLogo && settings.storeLogoUrl && (
              <div className={`mb-1.5 flex ${
                printerConfig.logoPosition === 'right' ? 'justify-start' :
                printerConfig.logoPosition === 'left' ? 'justify-end' : 'justify-center'
              }`}>
                <img 
                  src={settings.storeLogoUrl} 
                  alt={settings.storeName} 
                  className={`object-contain rounded-lg ${
                    printerConfig.logoSize === 'small' ? 'h-8 w-8' :
                    printerConfig.logoSize === 'large' ? 'h-16 w-16' : 'h-11 w-11'
                  }`}
                />
              </div>
            )}

            <h2 
              className="font-black tracking-tight"
              style={{ color: headerColor, fontSize: `${baseFontSizePx * 1.35}px` }}
            >
              {settings.storeName || 'سند للمحاسبة والخدمات'}
            </h2>

            {printerConfig.invoiceSubtitle && (
              <p 
                className="font-bold mt-0.5"
                style={{ color: bodyColor, opacity: 0.85, fontSize: `${baseFontSizePx * 0.9}px` }}
              >
                {printerConfig.invoiceSubtitle}
              </p>
            )}

            {(printerConfig.showHeaderAddress || printerConfig.showHeaderPhone) && (
              <div 
                className="mt-0.5 flex flex-wrap justify-center gap-1.5 font-sans"
                style={{ color: bodyColor, opacity: 0.8, fontSize: `${baseFontSizePx * 0.82}px` }}
              >
                {printerConfig.showHeaderAddress && settings.address && (
                  <span>{settings.address}</span>
                )}
                {printerConfig.showHeaderAddress && settings.address && printerConfig.showHeaderPhone && settings.phone && (
                  <span>|</span>
                )}
                {printerConfig.showHeaderPhone && settings.phone && (
                  <span className="font-mono">هاتف: {settings.phone}</span>
                )}
              </div>
            )}

            {/* Tax ID & Commercial Reg */}
            {(printerConfig.taxNumber || printerConfig.commercialRegistration) && (
              <div 
                className="mt-0.5 flex flex-wrap justify-center gap-2 font-mono"
                style={{ color: bodyColor, opacity: 0.75, fontSize: `${baseFontSizePx * 0.78}px` }}
              >
                {printerConfig.taxNumber && (
                  <span>الرقم الضريبي: {printerConfig.taxNumber}</span>
                )}
                {printerConfig.commercialRegistration && (
                  <span>س.ت: {printerConfig.commercialRegistration}</span>
                )}
              </div>
            )}

            {/* Invoice Main Title Badge */}
            <div 
              className="mt-1.5 inline-block px-3 py-0.5 rounded-full bg-slate-100 border border-slate-300 font-extrabold"
              style={{ color: headerColor || bodyColor, fontSize: `${baseFontSizePx * 0.9}px` }}
            >
              {(printerConfig.invoiceTitle || 'فاتورة مبيعات')
                .replace(/فاتورة\s*ضريبية\s*معتمدة/g, 'فاتورة مبيعات')
                .replace(/ضريبية\s*معتمدة|ضريبة\s*معتمدة/g, 'مبيعات')
                .trim() || 'فاتورة مبيعات'}
            </div>
          </div>

          {/* Separator Line */}
          <div className={`my-2 ${
            printerConfig.templateStyle === 'classic'
              ? 'border-b border-dashed border-gray-400'
              : printerConfig.templateStyle === 'minimal'
              ? 'border-b border-gray-200'
              : 'border-b-2 border-slate-900'
          }`} />

          {/* 2. Metadata Grid */}
          <div 
            className="space-y-1 leading-tight"
            style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.95}px` }}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold" style={{ opacity: 0.8, fontSize: `${baseFontSizePx * 0.9}px` }}>رقم الفاتورة:</span>
              <span className="font-mono font-black" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.95}px` }}>{invoice.invoiceNumber}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="font-bold" style={{ opacity: 0.8, fontSize: `${baseFontSizePx * 0.9}px` }}>التاريخ والوقت:</span>
              <span className="font-mono" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.9}px` }}>
                {new Date(invoice.date).toLocaleString('ar-YE', {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            {printerConfig.showCashierName && (
              <div className="flex justify-between items-center">
                <span className="font-bold" style={{ opacity: 0.8, fontSize: `${baseFontSizePx * 0.9}px` }}>الكاشير / البائع:</span>
                <span className="font-bold" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.95}px` }}>أحمد (نقطة البيع 1)</span>
              </div>
            )}

            {printerConfig.showCustomerName && (
              <div className="flex justify-between items-center">
                <span className="font-bold" style={{ opacity: 0.8, fontSize: `${baseFontSizePx * 0.9}px` }}>العميل المستلم:</span>
                <span className="font-bold" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.95}px` }}>{invoice.customerName}</span>
              </div>
            )}

            {printerConfig.showCustomerPhone && phoneInput && (
              <div className="flex justify-between items-center">
                <span className="font-bold" style={{ opacity: 0.8, fontSize: `${baseFontSizePx * 0.9}px` }}>هاتف العميل:</span>
                <span className="font-mono" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.95}px` }}>{phoneInput}</span>
              </div>
            )}

            {printerConfig.showPaymentMethod && (
              <div className="flex justify-between items-center">
                <span className="font-bold" style={{ opacity: 0.8, fontSize: `${baseFontSizePx * 0.9}px` }}>طريقة السداد:</span>
                <span className="font-bold" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.9}px` }}>
                  {formatPaymentMethodLabel(invoice.paymentMethod || invoice.type, invoice.referenceNumber)}
                </span>
              </div>
            )}

            {invoice.proofImage && (
              <div className="flex justify-between items-center bg-blue-50/80 p-1.5 rounded-lg border border-blue-200 mt-1">
                <span className="flex items-center gap-1 font-bold text-blue-950" style={{ fontSize: `${baseFontSizePx * 0.85}px` }}>
                  <Paperclip className="w-3 h-3 text-blue-600" />
                  <span>إشعار السند المرفق:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowProofModal(true)}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  style={{ fontSize: `${baseFontSizePx * 0.85}px` }}
                >
                  <Eye className="w-2.5 h-2.5" />
                  <span>عرض السند</span>
                </button>
              </div>
            )}
          </div>

          {/* Separator Line */}
          <div className={`my-2 ${
            printerConfig.templateStyle === 'classic'
              ? 'border-b border-dashed border-gray-400'
              : 'border-b border-gray-300'
          }`} />

          {/* 3. Items Table */}
          <table 
            className={`w-full text-right ${
              printerConfig.templateStyle === 'boxed' ? 'border border-slate-400' : ''
            }`}
            style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.95}px` }}
          >
            <thead>
              <tr className={`${
                printerConfig.templateStyle === 'boxed' ? 'bg-slate-100 border-b border-slate-400' :
                printerConfig.templateStyle === 'modern' ? 'bg-slate-50 border-b border-slate-300' : 
                'border-b border-dashed border-gray-400'
              }`}>
                <th className="py-1 px-1 font-black text-right" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.92}px` }}>السلعة / الخدمة</th>
                <th className="py-1 px-1 font-black text-center" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.92}px` }}>الكمية</th>
                {printerConfig.showUnitPrice && (
                  <th className="py-1 px-1 font-black text-center" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.92}px` }}>السعر</th>
                )}
                <th className="py-1 px-1 font-black text-left" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.92}px` }}>المجموع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoice.items.map((item, idx) => (
                <tr key={idx} className="py-1">
                  <td className={`py-1 px-1 font-medium ${printerConfig.templateStyle === 'boxed' ? 'border-l border-slate-200' : ''}`}>
                    <div className="font-bold" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 1.0}px` }}>{item.name}</div>
                    {printerConfig.showItemCodeBarcode && item.barcode && (
                      <div className="font-mono" style={{ color: bodyColor, opacity: 0.75, fontSize: `${baseFontSizePx * 0.75}px` }}>#{item.barcode}</div>
                    )}
                  </td>
                  <td className={`py-1 px-1 text-center font-bold font-mono ${printerConfig.templateStyle === 'boxed' ? 'border-l border-slate-200' : ''}`} style={{ color: bodyColor, fontSize: `${baseFontSizePx * 1.0}px` }}>
                    {item.quantity}
                  </td>
                  {printerConfig.showUnitPrice && (
                    <td className={`py-1 px-1 text-center font-mono ${printerConfig.templateStyle === 'boxed' ? 'border-l border-slate-200' : ''}`} style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.95}px` }}>
                      {item.sellingPrice.toLocaleString()}
                    </td>
                  )}
                  <td className="py-1 px-1 text-left font-bold font-mono" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 1.0}px` }}>
                    {item.total.toLocaleString()} {settings.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Separator Line */}
          <div className={`my-2 ${
            printerConfig.templateStyle === 'classic'
              ? 'border-b border-dashed border-gray-400'
              : 'border-b border-gray-300'
          }`} />

          {/* 4. Financial Calculations & Totals */}
          <div className="space-y-1" style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.95}px` }}>
            <div className="flex justify-between items-center font-bold" style={{ color: bodyColor }}>
              <span style={{ opacity: 0.85 }}>المجموع الفرعي:</span>
              <span className="font-mono">{invoice.totalAmount.toLocaleString()} {settings.currency}</span>
            </div>

            {printerConfig.showItemDiscount && invoice.discount > 0 && (
              <div className="flex justify-between items-center text-rose-600 font-bold">
                <span>خصم خاص مخصوم:</span>
                <span className="font-mono">- {invoice.discount.toLocaleString()} {settings.currency}</span>
              </div>
            )}

            {/* Highlighted Final Net Total */}
            <div 
              className={`p-1.5 rounded-lg flex justify-between items-center font-black mt-1.5 ${
                printerConfig.templateStyle === 'modern'
                  ? 'bg-slate-900 text-white'
                  : printerConfig.templateStyle === 'boxed'
                  ? 'border-2 border-slate-900 bg-slate-100'
                  : printerConfig.templateStyle === 'official'
                  ? 'border-t-2 border-b-2 border-slate-900 py-2'
                  : printerConfig.templateStyle === 'minimal'
                  ? 'border-t border-slate-300 py-1.5'
                  : 'border-t-2 border-b-2 border-dashed border-slate-700 py-1.5'
              }`}
              style={{ color: printerConfig.templateStyle === 'modern' ? '#ffffff' : bodyColor }}
            >
              <span style={{ fontSize: `${baseFontSizePx * 1.05}px` }}>الصافي النهائي للتسديد:</span>
              <span className="font-mono" style={{ fontSize: `${baseFontSizePx * 1.3}px` }}>
                {invoice.finalAmount.toLocaleString()} {settings.currency}
              </span>
            </div>

            {printerConfig.showCustomerBalance && matchedCustomer && matchedCustomer.totalDebt !== undefined && (
              <div 
                className="flex justify-between items-center font-bold pt-1"
                style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.9}px` }}
              >
                <span style={{ opacity: 0.85 }}>الرصيد المتبقي للعميل:</span>
                <span className="font-mono font-black">{matchedCustomer.totalDebt.toLocaleString()} {settings.currency}</span>
              </div>
            )}
          </div>

          {/* 5. Policy / Terms / Warranty Box */}
          {printerConfig.showFooterPolicy && (printerConfig.footerPolicyNote || settings.invoiceFooterNote) && (
            <div 
              className="my-2 p-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg font-bold leading-relaxed whitespace-pre-line text-center"
              style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.85}px` }}
            >
              {printerConfig.footerPolicyNote || settings.invoiceFooterNote}
            </div>
          )}

          {/* 6. Signature & Stamp Boxes */}
          {printerConfig.showSignatureBox && (
            <div 
              className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-gray-300 font-bold text-center"
              style={{ color: bodyColor, fontSize: `${baseFontSizePx * 0.85}px` }}
            >
              <div className="p-2 border border-gray-300 rounded h-14 flex flex-col justify-between">
                <span>توقيع العميل المستلم</span>
                <div className="border-b border-dotted border-gray-400" />
              </div>
              <div className="p-2 border border-gray-300 rounded h-14 flex flex-col justify-between">
                <span>ختم وتوقيع المنشأة</span>
                <div className="border-b border-dotted border-gray-400" />
              </div>
            </div>
          )}

          {/* 7. Verification Codes (QR & Barcode) */}
          <div className="mt-3 text-center space-y-2">
            {(printerConfig.codeType === 'qr' || printerConfig.codeType === 'both') && (
              <div className="inline-block p-1.5 bg-white border border-gray-300 rounded-lg shadow-2xs">
                <QRCodeSVG
                  value={JSON.stringify({
                    seller: settings.storeName || 'سند للمحاسبة',
                    timestamp: invoice.date,
                    total: invoice.finalAmount,
                    invoiceNum: invoice.invoiceNumber
                  })}
                  size={paperSize === '58mm' ? 64 : 76}
                />
                <div 
                  className="font-bold mt-0.5"
                  style={{ color: bodyColor, opacity: 0.75, fontSize: `${baseFontSizePx * 0.75}px` }}
                >
                  مسح QR للتحقق
                </div>
              </div>
            )}

            {(printerConfig.codeType === 'barcode' || printerConfig.codeType === 'both') && (
              <div className="flex justify-center overflow-hidden">
                <canvas ref={barcodeCanvasRef} className="max-w-full" />
              </div>
            )}
          </div>

          {/* 8. Greeting & Dev Credits */}
          {printerConfig.footerGreeting && (
            <div 
              className="font-bold text-center mt-2"
              style={{ color: bodyColor, opacity: 0.85, fontSize: `${baseFontSizePx * 0.85}px` }}
            >
              {printerConfig.footerGreeting}
            </div>
          )}

          {printerConfig.showDevCredits && (
            <div className="text-center space-y-0.5 mt-2 pt-1 border-t border-gray-100">
              <p 
                className="font-semibold flex items-center justify-center gap-1"
                style={{ color: bodyColor, opacity: 0.85, fontSize: `${baseFontSizePx * 0.75}px` }}
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>تم الحفظ بنجاح في النظام المحاسبي للكمبيوتر</span>
              </p>
              <p 
                className="font-mono"
                style={{ color: bodyColor, opacity: 0.65, fontSize: `${baseFontSizePx * 0.7}px` }}
              >
                برمجة وتطوير م. عبدالمجيد المحواشي (الجمهورية اليمنية)
              </p>
            </div>
          )}
        </div>

        {/* WhatsApp Sender */}
        {showWhatsAppForm && (
          <div className="px-3 py-2 bg-[#0c141e] border-t border-gray-800 text-xs text-gray-300 space-y-2 animate-fadeIn shrink-0">
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
        <div className="p-2 sm:p-2.5 bg-slate-900 border-t border-gray-800 grid grid-cols-5 gap-1.5 shrink-0">
          <button
            id="print_thermal_invoice_btn"
            onClick={handlePrint}
            className="py-2 px-1 rounded-xl text-[11px] font-bold bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer flex items-center justify-center gap-1 shadow transition active:scale-95"
            title="طباعة حرارية مباشرة"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>طباعة</span>
          </button>

          <button
            id="print_bluetooth_invoice_btn"
            onClick={handleBluetoothPrint}
            disabled={isBluetoothConnecting}
            className="py-2 px-1 rounded-xl text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 shadow transition active:scale-95"
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
            className="py-2 px-1 rounded-xl text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 shadow transition active:scale-95"
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
            className="py-2 px-1 rounded-xl text-[11px] font-bold bg-[#C5A862] text-black hover:bg-[#A0813D] cursor-pointer flex items-center justify-center gap-1 shadow transition active:scale-95"
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
            className={`py-2 px-1 rounded-xl text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1 shadow transition active:scale-95 ${
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
