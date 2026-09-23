/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Printer, Download, X, ShieldCheck, Heart, Smartphone, SlidersHorizontal, MessageCircle, FileDown, Loader2, Share2, Bluetooth, QrCode, ArrowRight, Eye, Paperclip, Image as ImageIcon, Zap, Check, Laptop } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Invoice, SystemSettings, Customer, ThermalPrinterSettings } from '../types';
import { soundManager } from '../utils/sound';
import { formatPaymentMethodLabel } from '../utils/paymentMethods';
import { requestStoragePermissionOnDemand } from '../utils/androidPermissions';
import { safeStorage } from '../utils/safeStorage';
import { saveAndShareFile } from '../utils/fileExport';
import { openWhatsApp } from '../utils/nativeLauncher';
import { 
  printSalesInvoiceThermalHTML, 
  generateSalesInvoiceThermalPDF, 
  SalesInvoicePrintData, 
  generateBarcodeDataUrl, 
  generateInvoiceQrPng,
  printInvoiceViaRawBT
} from '../services/ReceiptPrinter';
import { 
  convertInvoiceToEscPos, 
  printSalesInvoiceEscPosDirect, 
  downloadEscPosBinaryFile, 
  checkBrowserDeviceSupport 
} from '../services/EscPosHelper';
import { loadThermalPrinterSettings, saveThermalPrinterSettings, isAndroidClient } from '../utils/printerConfig';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  settings: SystemSettings;
  customers?: Customer[];
}

export default function InvoiceModal({ invoice, onClose, settings, customers }: InvoiceModalProps) {
  const [printerConfig, setPrinterConfig] = useState<ThermalPrinterSettings>(() => {
    return settings.printerSettings || loadThermalPrinterSettings();
  });
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>(() => {
    return (settings.printerSettings?.paperWidth as '80mm' | '58mm') || (loadThermalPrinterSettings().paperWidth as '80mm' | '58mm') || '80mm';
  });
  const [autoDirectPrint, setAutoDirectPrint] = useState(() => {
    return safeStorage.getItem('auto_direct_print') === 'true';
  });

  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');
  const [qrPngDataUrl, setQrPngDataUrl] = useState<string>('');
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isEscPosPrinting, setIsEscPosPrinting] = useState(false);
  const [isBluetoothConnecting, setIsBluetoothConnecting] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Sync settings when parent passes updated props
  useEffect(() => {
    const current = settings.printerSettings || loadThermalPrinterSettings();
    setPrinterConfig(current);
    if (current.paperWidth) {
      setPaperSize(current.paperWidth as '80mm' | '58mm');
    }
  }, [settings.printerSettings]);

  // Listen for live printer settings events
  useEffect(() => {
    const handlePrinterSettingsChange = (e: any) => {
      if (e.detail) {
        setPrinterConfig(e.detail);
        if (e.detail.paperWidth) {
          setPaperSize(e.detail.paperWidth as '80mm' | '58mm');
        }
      }
    };
    window.addEventListener('printer_settings_updated', handlePrinterSettingsChange);
    return () => window.removeEventListener('printer_settings_updated', handlePrinterSettingsChange);
  }, []);

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

  const getInvoicePrintPayload = (): SalesInvoicePrintData => {
    const activePrinterSettings: ThermalPrinterSettings = {
      ...printerConfig,
      paperWidth: paperSize
    };
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
      notes: (invoice as any).notes || activePrinterSettings.customFooterNote || settings.invoiceFooterNote || '',
      storeLogoUrl: settings.storeLogoUrl || '',
      storeAddress: settings.address || '',
      storePhone: settings.phone || '',
      paperSize: paperSize,
      qrCodeUrl: qrPngDataUrl || getQrCodeDataUrl(),
      cashierName: (invoice as any).cashierName || localStorage.getItem('sanad_cashier_name') || '',
      printerSettings: activePrinterSettings
    };
  };

  // Generate real barcode and real QR code data URL dynamically
  useEffect(() => {
    if (invoice) {
      try {
        setBarcodeDataUrl(generateBarcodeDataUrl(invoice.invoiceNumber));
      } catch (err) {
        setBarcodeDataUrl('');
      }

      const payload = getInvoicePrintPayload();
      generateInvoiceQrPng(payload, settings.storeName || 'سند للمحاسبة والخدمات', settings.currency || 'ريال')
        .then(url => setQrPngDataUrl(url))
        .catch(() => setQrPngDataUrl(''));
    }
  }, [invoice, settings.storeName, settings.currency, printerConfig, paperSize]);

  // Auto-route print when invoice loads if configured
  useEffect(() => {
    const shouldAutoPrint = autoDirectPrint || printerConfig.autoPrintOnSale;
    if (shouldAutoPrint && invoice) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoice, autoDirectPrint, printerConfig.autoPrintOnSale]);

  useEffect(() => {
    if (!invoice) return;
    document.body.classList.add('modal-invoice-open');
    const handleBack = () => {
      onClose();
    };
    window.addEventListener('android-modal-close', handleBack);
    return () => {
      document.body.classList.remove('modal-invoice-open');
      window.removeEventListener('android-modal-close', handleBack);
    };
  }, [invoice, onClose]);

  if (!invoice) return null;

  // فحص بيئة التشغيل: هل العميل على جهاز كمبيوتر (وندوز/ماك) أم هاتف أندرويد
  const isPC = printerConfig.printEnvironment === 'pc' || (!printerConfig.printEnvironment && !isAndroidClient()) || (printerConfig.printEnvironment === 'auto' && !isAndroidClient());

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

  const handlePaperSizeChange = (newSize: '80mm' | '58mm') => {
    soundManager.playScanBeep();
    setPaperSize(newSize);
    const updated: ThermalPrinterSettings = { ...printerConfig, paperWidth: newSize };
    setPrinterConfig(updated);
    saveThermalPrinterSettings(updated);
  };

  // 1. [طباعة] - طباعة حرارية (Thermal 80mm / 58mm) متطابقة 100% مع شكل الفاتورة المعروضة
  // تعمل مباشرة على أندرويد والكمبيوتر (وندوز) بدون أي تعليق
  const handlePrint = async () => {
    soundManager.playSuccessChime();

    if (isPC) {
      setActionFeedback('💻 جاري فتح نافذة طباعة وندوز (طابعة الإيصالات)...');
      setTimeout(() => setActionFeedback(null), 3000);
      document.body.classList.add('modal-invoice-open');
      setTimeout(() => {
        window.focus();
        window.print();
      }, 60);
      return;
    }

    const payload = getInvoicePrintPayload();
    setActionFeedback('🖨️ جاري إرسال الفاتورة إلى أمر الطباعة...');
    setTimeout(() => setActionFeedback(null), 3000);

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
    setActionFeedback('📶 جاري الاتصال والطباعة عبر البلوتوث...');

    try {
      if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
        try {
          const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
              '000018f0-0000-1000-8000-00805f9b34fb',
              '00001101-0000-1000-8000-00805f9b34fb',
              '49535343-fe7d-4ae5-8fa9-9fafd205e455',
              'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
            ]
          });
          if (device) {
            console.log('Bluetooth Thermal Printer Paired:', device.name);
          }
        } catch (btErr) {
          console.warn('Bluetooth pairing skipped or user cancelled:', btErr);
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
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // 3. [RawBT] - طباعة فورية مخصصة للأندرويد عبر تطبيق RawBT
  const handleRawBTPrint = async () => {
    soundManager.playSuccessChime();
    
    if (isPC) {
      setActionFeedback('💡 تطبيق RawBT مخصص للهواتف. جاري فتح طباعة وندوز...');
      setTimeout(() => setActionFeedback(null), 3500);
      document.body.classList.add('modal-invoice-open');
      setTimeout(() => {
        window.focus();
        window.print();
      }, 60);
      return;
    }

    setActionFeedback('⚡ جاري إرسال الفاتورة إلى تطبيق RawBT (TrueType)...');
    setTimeout(() => setActionFeedback(null), 3500);

    const payload = getInvoicePrintPayload();
    await printInvoiceViaRawBT(
      settings.storeName || 'سند للمحاسبة والخدمات',
      payload,
      settings.currency
    );
  };

  // 3. [PDF] - حفظ الفاتورة كملف PDF نصي عالي الدقة بنفس شكل الفاتورة الحرارية تماماً
  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    soundManager.playSuccessChime();
    setIsExportingPDF(true);
    setActionFeedback('📄 جاري تصدير الفاتورة إلى ملف PDF...');

    try {
      const payload = getInvoicePrintPayload();
      await generateSalesInvoiceThermalPDF(
        settings.storeName || 'سند للمحاسبة والخدمات',
        payload,
        settings.currency
      );
      setActionFeedback('✓ تم حفظ ومشاركة ملف PDF بنجاح');
    } catch (error) {
      console.error('فشل تصدير الفاتورة كـ PDF:', error);
      setActionFeedback('فشل تصدير ملف PDF');
    } finally {
      setIsExportingPDF(false);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  // 4. [ESC/POS] - إرسال أوامر ESC/POS الخام مباشرة عبر متصفح الكمبيوتر (WebUSB / WebSerial)
  const handleEscPosDirectPrint = async () => {
    if (isEscPosPrinting) return;
    soundManager.playSuccessChime();
    setIsEscPosPrinting(true);
    setActionFeedback('🔌 جاري فحص الاتصال بالطابعة الحرارية...');

    try {
      const payload = getInvoicePrintPayload();
      const res = await printSalesInvoiceEscPosDirect(
        settings.storeName || 'سند للمحاسبة والخدمات',
        payload,
        settings.currency,
        {
          paperSize: paperSize,
          cutPaper: printerConfig.enablePaperCut ?? true,
          openDrawer: printerConfig.openCashDrawer ?? false
        }
      );

      if (res.success) {
        soundManager.playCashRegister();
        setActionFeedback('✓ ' + res.message);
      } else if (res.isPermissionsPolicyBlocked) {
        // منفذ USB مقيد داخل إطار المعاينة (Permissions Policy) -> تحويل تلقائي فوري لطباعة وندوز
        setActionFeedback('💡 منافذ USB مقيدة داخل إطار المعاينة. جاري تشغيل طباعة وندوز الرسمية...');
        setTimeout(() => {
          handlePrint();
        }, 600);
      } else {
        setActionFeedback('⚠️ ' + res.message);
      }
    } catch (err: any) {
      const errText = String(err?.message || err || '');
      if (err?.name === 'SecurityError' || errText.includes('permissions policy') || errText.includes('disallowed')) {
        setActionFeedback('💡 منافذ USB مقيدة داخل إطار المعاينة. جاري تشغيل طباعة وندوز الرسمية...');
        setTimeout(() => {
          handlePrint();
        }, 600);
      } else {
        console.warn('ESC/POS Direct Print notice:', err);
        setActionFeedback('تعذر إرسال ESC/POS: ' + (err?.message || ''));
      }
    } finally {
      setIsEscPosPrinting(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // 5. [ESC/POS Bin] - تنزيل ملف أوامر ESC/POS الخام بصيغة ثنائية (.bin)
  const handleDownloadEscPos = async () => {
    soundManager.playSuccessChime();
    setActionFeedback('💾 جاري إنشاء وتنزيل ملف أوامر ESC/POS الخام (.bin)...');
    try {
      const payload = getInvoicePrintPayload();
      const rawBytes = await convertInvoiceToEscPos(
        payload,
        settings.storeName || 'سند للمحاسبة والخدمات',
        settings.currency,
        {
          paperSize: paperSize,
          cutPaper: true,
          openDrawer: printerConfig.openCashDrawer ?? false
        }
      );
      downloadEscPosBinaryFile(rawBytes, `invoice_${invoice.invoiceNumber}_escpos.bin`);
      setActionFeedback('✓ تم تنزيل ملف أوامر ESC/POS الخام بنجاح');
    } catch (err: any) {
      setActionFeedback('فشل تنزيل ملف ESC/POS');
    } finally {
      setTimeout(() => setActionFeedback(null), 3500);
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

  const is58 = paperSize === '58mm';
  const previewFontFamily = 
    printerConfig.fontFamily === 'tahoma' ? "Tahoma, 'Segoe UI', Arial, sans-serif" :
    printerConfig.fontFamily === 'monospace' ? "monospace, 'Courier New', Courier" :
    printerConfig.fontFamily === 'system' ? "system-ui, -apple-system, sans-serif" :
    "'Cairo', 'Segoe UI', Tahoma, sans-serif";

  let previewBaseSize = is58 ? '11px' : '12px';
  let previewHeaderSize = is58 ? '15px' : '17px';
  let previewDetailsSize = is58 ? '10px' : '11px';
  let previewFinalSize = is58 ? '13.5px' : '15px';

  if (printerConfig.fontScale === 'small') {
    previewBaseSize = is58 ? '9.5px' : '10.5px';
    previewHeaderSize = is58 ? '13px' : '15px';
    previewDetailsSize = is58 ? '8.5px' : '9.5px';
    previewFinalSize = is58 ? '12px' : '13.5px';
  } else if (printerConfig.fontScale === 'large') {
    previewBaseSize = is58 ? '12.5px' : '13.5px';
    previewHeaderSize = is58 ? '16px' : '18.5px';
    previewDetailsSize = is58 ? '11px' : '12px';
    previewFinalSize = is58 ? '15px' : '16.5px';
  } else if (printerConfig.fontScale === 'extralarge') {
    previewBaseSize = is58 ? '13.5px' : '15px';
    previewHeaderSize = is58 ? '17px' : '20px';
    previewDetailsSize = is58 ? '12px' : '13.5px';
    previewFinalSize = is58 ? '16.5px' : '18.5px';
  }

  const previewLineSpacing = printerConfig.lineSpacing === 'compact' ? 1.3 : (printerConfig.lineSpacing === 'relaxed' ? 1.65 : 1.45);
  const previewWeight = printerConfig.printDensity === 'extradark' ? '900' : (printerConfig.printDensity === 'dark' ? '800' : '600');
  const previewColor = printerConfig.printDensity === 'normal' ? '#1f2937' : '#000000';

  const previewBorderStyle = 
    printerConfig.tableBorderType === 'solid' ? '1.5px solid #000000' :
    printerConfig.tableBorderType === 'dotted' ? '2px dotted #4b5563' :
    printerConfig.tableBorderType === 'double' ? '3px double #000000' :
    '1.5px dashed #6b7280';

  return (
    <div id="invoice_modal_overlay" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 print:bg-white print:p-0 print:m-0 print:static print:inset-auto">
      
      <div className="w-full max-w-sm h-[92dvh] sm:h-auto sm:max-h-[88vh] rounded-2xl bg-white text-black shadow-2xl border border-gray-200 overflow-hidden relative animate-fadeIn flex flex-col print:h-auto print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        
        {/* Modal Top Control Bar */}
        <div className="p-2.5 sm:p-3 bg-slate-900 text-white flex justify-between items-center border-b border-gray-800 shrink-0 no-print">
          <button
            id="return_to_pos_btn"
            onClick={onClose}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع للمبيعات</span>
          </button>

          <div className="flex items-center gap-2">
            {isPC ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold">
                  نظام الكمبيوتر (وندوز)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold">
                  نظام الهاتف (أندرويد)
                </span>
              </div>
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

        {/* Paper format selector & Environment Switcher */}
        <div className="p-2 bg-slate-950 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300 shrink-0 no-print">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#C5A862]" />
            <span>الرول:</span>
            <div className="flex items-center bg-slate-900 border border-gray-800 rounded p-0.5">
              <button
                type="button"
                onClick={() => handlePaperSizeChange('80mm')}
                className={`px-2 py-0.5 text-xs font-bold rounded transition cursor-pointer ${
                  paperSize === '80mm' ? 'bg-[#C5A862] text-slate-950 shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => handlePaperSizeChange('58mm')}
                className={`px-2 py-0.5 text-xs font-bold rounded transition cursor-pointer ${
                  paperSize === '58mm' ? 'bg-[#C5A862] text-slate-950 shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
              >
                58mm
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* جهاز التشغيل: تبديل صريح فوري بين كمبيوتر وهاتف */}
            <div className="flex items-center bg-slate-900 border border-gray-800 rounded p-0.5">
              <button
                type="button"
                onClick={() => {
                  const updated = { ...printerConfig, printEnvironment: 'pc' as const };
                  setPrinterConfig(updated);
                  saveThermalPrinterSettings(updated);
                  soundManager.playScanBeep();
                }}
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded transition flex items-center gap-1 cursor-pointer ${
                  isPC
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="تفعيل وضع الكمبيوتر للطباعة المباشرة عبر متصفح كروم لطابعة وندوز (USB أو شبكة)"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>كمبيوتر (وندوز)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...printerConfig, printEnvironment: 'android_rawbt' as const };
                  setPrinterConfig(updated);
                  saveThermalPrinterSettings(updated);
                  soundManager.playScanBeep();
                }}
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded transition flex items-center gap-1 cursor-pointer ${
                  !isPC
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="تفعيل وضع الهواتف الذكية (لتطبيق RawBT)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>هاتف (RawBT)</span>
              </button>
            </div>

            <label className="flex items-center gap-1 cursor-pointer hover:text-white select-none mr-1">
              <input
                type="checkbox"
                checked={autoDirectPrint}
                onChange={(e) => handleAutoPrintToggle(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-800 bg-[#16212E] accent-[#C5A862]"
              />
              <span className="text-[11px]">فوري ⚡</span>
            </label>

            {/* تصدير ملف أوامر ESC/POS الخام ثنائي */}
            <button
              type="button"
              onClick={handleDownloadEscPos}
              className="text-[10px] text-gray-300 hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-slate-900 border border-gray-800 hover:border-indigo-500 rounded px-1.5 py-0.5 transition"
              title="تصدير مخرجات الفاتورة الحالية كملف أوامر خام ESC/POS ثنائي (.bin) لتمريرها مباشرة إلى الطابعة"
            >
              <FileDown className="w-3 h-3 text-indigo-400" />
              <span>أوامر .bin</span>
            </button>
          </div>
        </div>

        {/* PRINTABLE BILL CANVAS AREA */}
        <div 
          id="invoice-printable-card" 
          data-export-container="true" 
          data-receipt-card="true"
          className="p-3 sm:p-4 bg-white overflow-y-auto flex-1 min-h-0 printable-invoice-card mx-auto w-full transition-all duration-200" 
          style={{ 
            direction: 'rtl', 
            boxSizing: 'border-box',
            maxWidth: is58 ? '300px' : '380px',
            fontFamily: previewFontFamily,
            fontSize: previewBaseSize,
            fontWeight: previewWeight as any,
            color: previewColor,
            lineHeight: previewLineSpacing
          }}
        >
          {/* Header section */}
          <div className="text-center space-y-0.5">
            {printerConfig.showLogo !== false && settings.storeLogoUrl && (
              <img 
                src={settings.storeLogoUrl} 
                alt={settings.storeName} 
                className="w-11 h-11 mx-auto object-contain mb-1 rounded-lg"
              />
            )}
            {printerConfig.showHeaderName !== false && (
              <h2 
                style={{ fontSize: previewHeaderSize }}
                className="font-extrabold tracking-tight text-gray-900 leading-tight"
              >
                {settings.storeName}
              </h2>
            )}
            
            {printerConfig.customHeaderTitle ? (
              <p className="text-[10.5px] font-bold text-gray-700">{printerConfig.customHeaderTitle}</p>
            ) : (
              <p className="text-[10px] text-gray-500 font-bold">فاتورة مبيعات نقدية معتمدة</p>
            )}

            {printerConfig.showBranchAddress !== false && settings.address && (
              <p className="text-[9.5px] text-gray-500">{settings.address}</p>
            )}
            {printerConfig.showPhone !== false && settings.phone && (
              <p className="text-[9.5px] text-gray-500 font-mono">هاتف / خدمة العملاء: {settings.phone}</p>
            )}

            {printerConfig.showTaxNumber && printerConfig.taxNumber && (
              <div className="inline-block px-2 py-0.5 mt-1 border border-black rounded text-[9.5px] font-bold">
                الرقم الضريبي / السجل: {printerConfig.taxNumber}
              </div>
            )}
          </div>

          <div 
            className="my-2"
            style={{ borderTop: previewBorderStyle }}
          ></div>

          {/* Bill Metadata Block */}
          <div 
            style={{ fontSize: previewDetailsSize }}
            className="space-y-1 text-gray-800"
          >
            <div className="flex justify-between">
              <span className="text-gray-500">رقم الفاتورة:</span>
              <span className="font-bold font-mono">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">التاريخ والوقت:</span>
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
            {printerConfig.showCustomerInfo !== false && (
              <div className="flex justify-between">
                <span className="text-gray-500">العميل المستلم:</span>
                <span className="font-bold">{invoice.customerName}</span>
              </div>
            )}
            {printerConfig.showCashierName !== false && (
              <div className="flex justify-between">
                <span className="text-gray-500">الكاشير / البائع:</span>
                <span className="font-bold">
                  {(invoice as any).cashierName || localStorage.getItem('sanad_cashier_name') || 'أحمد الكاشير'}
                </span>
              </div>
            )}
            {printerConfig.showPaymentMethod !== false && (
              <div className="flex justify-between">
                <span className="text-gray-500">طريقة السداد:</span>
                <span className="font-bold text-[#C5A862]">
                  {formatPaymentMethodLabel(invoice.paymentMethod || invoice.type, invoice.referenceNumber)}
                </span>
              </div>
            )}
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

          <div 
            className="my-2"
            style={{ borderTop: previewBorderStyle }}
          ></div>

          {/* Itemized list of purchase */}
          <table 
            style={{ fontSize: previewDetailsSize }}
            className="w-full text-right text-gray-900"
          >
            <thead>
              <tr 
                style={{ borderBottom: previewBorderStyle }}
                className="pb-1 font-bold"
              >
                <th className="pb-1 text-right">السلعة</th>
                <th className="pb-1 text-center">الكمية</th>
                <th className="pb-1 text-left">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr 
                  key={idx} 
                  className="py-1"
                  style={{ borderBottom: `0.5px dashed #cbd5e1` }}
                >
                  <td className="py-1 font-medium">
                    <div className="font-bold">{item.name}</div>
                    <div className="text-[9px] text-gray-500 font-mono">
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

          <div 
            className="my-2"
            style={{ borderTop: previewBorderStyle }}
          ></div>

          {/* Financial calculations */}
          <div 
            style={{ fontSize: previewDetailsSize }}
            className="space-y-1 text-gray-900"
          >
            <div className="flex justify-between">
              <span className="text-gray-600">المجموع الفرعي:</span>
              <span className="font-mono font-bold">{invoice.totalAmount.toLocaleString()} {settings.currency}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-red-700 font-bold">
                <span>خصم خاص مخصوم:</span>
                <span className="font-mono">- {invoice.discount.toLocaleString()} {settings.currency}</span>
              </div>
            )}
            <div 
              className="my-1.5"
              style={{ borderTop: previewBorderStyle }}
            ></div>
            <div 
              style={{ fontSize: previewFinalSize }}
              className="flex justify-between items-center font-extrabold text-black"
            >
              <span>الصافي النهائي للتسديد:</span>
              <span className="font-mono">
                {invoice.finalAmount.toLocaleString()} {settings.currency}
              </span>
            </div>
          </div>

          {/* Barcode section */}
          {printerConfig.showBarcode !== false && barcodeDataUrl && (
            <div className="my-2 text-center">
              <img 
                src={barcodeDataUrl} 
                alt={invoice.invoiceNumber} 
                className="max-w-[92%] h-9 mx-auto object-contain"
              />
              <div className="text-[9px] font-mono font-bold text-gray-700 tracking-wider">
                *{invoice.invoiceNumber}*
              </div>
            </div>
          )}

          {/* QR Code section */}
          {printerConfig.showQrCode !== false && (
            <div className="my-2 text-center">
              <div className="inline-block p-1 bg-white border border-gray-300 rounded shadow-2xs">
                {qrPngDataUrl ? (
                  <img 
                    src={qrPngDataUrl} 
                    alt="QR" 
                    style={{ 
                      width: printerConfig.qrSize === 'small' ? 75 : printerConfig.qrSize === 'large' ? 115 : 95, 
                      height: printerConfig.qrSize === 'small' ? 75 : printerConfig.qrSize === 'large' ? 115 : 95 
                    }} 
                    className="mx-auto block"
                  />
                ) : (
                  <QRCodeSVG 
                    value={JSON.stringify({ seller: settings.storeName, invoice: invoice.invoiceNumber, total: invoice.finalAmount })}
                    size={printerConfig.qrSize === 'small' ? 75 : printerConfig.qrSize === 'large' ? 115 : 95}
                    level="M"
                  />
                )}
                <div className="text-[8px] font-bold text-gray-600 mt-0.5">رمز التحقق الإلكتروني</div>
              </div>
            </div>
          )}

          {/* Return policy note */}
          {printerConfig.showReturnPolicy !== false && (printerConfig.customFooterNote || settings.invoiceFooterNote) && (
            <div className="my-2 p-1.5 bg-gray-50 border border-dashed border-gray-400 rounded text-[9px] text-gray-800 font-bold leading-relaxed whitespace-pre-line text-center">
              {printerConfig.customFooterNote || settings.invoiceFooterNote}
            </div>
          )}

          {/* Footer message / Greetings */}
          <div className="text-center space-y-1 text-gray-600 pt-1">
            {printerConfig.footerGreeting ? (
              <p className="text-[9px] font-bold text-gray-800">
                {printerConfig.footerGreeting}
              </p>
            ) : (
              <p className="text-[8.5px] text-gray-500 flex items-center justify-center gap-0.5">
                سعدنا بزيارتكم الكريمة <Heart className="w-2 text-red-500 fill-red-500 inline" /> طاب يومكم
              </p>
            )}

            <p className="text-[8.5px] font-semibold flex items-center justify-center gap-1 text-green-700">
              <ShieldCheck className="w-3 h-3 text-green-600 inline" />
              نظام محاسبي معتمد وسريع
            </p>
            <p className="text-[8px] text-gray-400 font-mono">
              برمجة وتطوير م. عبدالمجيد المحواشي
            </p>
          </div>

          {/* Simulated Auto-Cutter feed gap */}
          <div 
            style={{ marginTop: `${Math.max(8, Number(printerConfig.feedBeforeCutMm || 12))}px` }}
            className="pt-1 border-t border-dashed border-gray-300 text-[8px] text-gray-400 text-center font-mono select-none"
          >
            ✂ خط قطع الورق الآلي للطابعة ({paperSize})
          </div>

        </div>

        {/* WhatsApp Sender */}
        {showWhatsAppForm && (
          <div className="px-3 py-2.5 bg-[#0c141e] border-t border-gray-800 text-xs text-gray-300 space-y-2 animate-fadeIn shrink-0 no-print">
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

        {/* Live Action Feedback Notice */}
        {actionFeedback && (
          <div className="bg-emerald-600 text-white text-[11px] font-bold py-1.5 px-3 flex items-center justify-center gap-1.5 animate-fadeIn shrink-0 no-print border-t border-emerald-500 shadow-inner">
            <Check className="w-3.5 h-3.5" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="p-2.5 bg-slate-900 border-t border-gray-800 grid grid-cols-4 sm:grid-cols-7 gap-1.5 shrink-0 no-print">
          <button
            id="print_thermal_invoice_btn"
            onClick={handlePrint}
            className="py-2 px-1 rounded-xl text-[11px] font-black bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer flex items-center justify-center gap-1 shadow transition active:scale-95"
            title={isPC ? "فتح نافذة طباعة وندوز الرسمية لطابعة الإيصالات USB أو الشبكة" : "طباعة حرارية فورية"}
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>{isPC ? 'طباعة (وندوز)' : 'طباعة'}</span>
          </button>

          {/* زر إرسال أوامر ESC/POS الخام مباشرة عبر متصفح الكمبيوتر */}
          <button
            id="print_escpos_direct_btn"
            onClick={handleEscPosDirectPrint}
            disabled={isEscPosPrinting}
            className="py-2 px-1 rounded-xl text-[11px] font-black bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 shadow transition active:scale-95"
            title="إرسال أوامر ESC/POS الخام مباشرة إلى الطابعة عبر متصفح الكمبيوتر (WebUSB / WebSerial)"
          >
            {isEscPosPrinting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Zap className="w-3.5 h-3.5 shrink-0 text-amber-300" />
            )}
            <span>ESC/POS</span>
          </button>

          <button
            id="print_rawbt_invoice_btn"
            onClick={handleRawBTPrint}
            className={`py-2 px-1 rounded-xl text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1 shadow transition active:scale-95 ${
              !isPC
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-black'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
            }`}
            title="طباعة عبر تطبيق RawBT لهواتف أندرويد"
          >
            <Zap className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>RawBT</span>
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
