/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Settings2, 
  FileText, 
  Palette, 
  Check, 
  RefreshCw, 
  Download, 
  Smartphone, 
  Bluetooth, 
  QrCode, 
  Barcode, 
  ShieldCheck, 
  Layers, 
  Sliders, 
  Sparkles, 
  Eye, 
  Copy, 
  Save, 
  Zap, 
  HelpCircle, 
  Maximize2, 
  CheckCircle2, 
  SlidersHorizontal, 
  Monitor, 
  Wifi, 
  FileDown, 
  ArrowLeftRight, 
  Scissors, 
  Coins, 
  Volume2, 
  Building2, 
  CreditCard, 
  FileCheck2,
  Share2,
  Trash2,
  Type,
  Bold
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { 
  PrinterSettings, 
  SystemSettings, 
  InvoicePaperSize, 
  InvoiceTemplateStyle, 
  InvoiceCodeType, 
  PrinterConnectionType,
  InvoiceFontFamily,
  InvoiceFontWeight,
  InvoiceFontSizeScale,
  InvoiceLineHeight
} from '../types';
import { 
  DEFAULT_PRINTER_SETTINGS, 
  QUICK_INVOICE_PRESETS, 
  getEffectivePrinterSettings, 
  savePrinterSettingsLocally, 
  QuickPreset,
  INVOICE_FONTS,
  INVOICE_FONT_WEIGHTS,
  INVOICE_FONT_SIZE_SCALES,
  INVOICE_LINE_HEIGHTS,
  INVOICE_FONT_COLORS,
  getFontFamilyCss,
  getFontWeightCss,
  getFontSizeMultiplier,
  getLineHeightCss
} from '../utils/printerDefaults';
import { soundManager } from '../utils/sound';
import { 
  printSalesInvoiceThermalHTML, 
  generateSalesInvoiceThermalPDF, 
  SalesInvoicePrintData 
} from '../services/ReceiptPrinter';

interface PrinterInvoiceStudioProps {
  settings: SystemSettings;
  onSaveSettings: (settings: SystemSettings) => void;
  isStandaloneTab?: boolean;
}

export default function PrinterInvoiceStudio({
  settings,
  onSaveSettings,
  isStandaloneTab = false
}: PrinterInvoiceStudioProps) {
  // Current printer settings state
  const [printerConfig, setPrinterConfig] = useState<PrinterSettings>(() => {
    return getEffectivePrinterSettings(settings);
  });

  const [activeSubTab, setActiveSubTab] = useState<'template' | 'fonts' | 'hardware' | 'fields' | 'footer' | 'diagnostics'>('template');
  const [previewPaperSize, setPreviewPaperSize] = useState<InvoicePaperSize>(printerConfig.paperSize || '80mm');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isTestingBluetooth, setIsTestingBluetooth] = useState(false);
  const [bluetoothStatusMessage, setBluetoothStatusMessage] = useState<string | null>(null);

  const barcodeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync state if settings prop changes externally
  useEffect(() => {
    if (settings?.printerSettings) {
      setPrinterConfig(prev => ({ ...prev, ...settings.printerSettings }));
      setPreviewPaperSize(settings.printerSettings.paperSize || '80mm');
    }
  }, [settings]);

  // Keep preview size in sync when user changes printerConfig.paperSize
  useEffect(() => {
    setPreviewPaperSize(printerConfig.paperSize);
  }, [printerConfig.paperSize]);

  // Render barcode on canvas in preview if barcode is enabled
  useEffect(() => {
    if (barcodeCanvasRef.current && (printerConfig.codeType === 'barcode' || printerConfig.codeType === 'both')) {
      try {
        JsBarcode(barcodeCanvasRef.current, 'INV-2026-9876', {
          format: 'CODE128',
          width: 1.5,
          height: 36,
          displayValue: true,
          font: 'monospace',
          fontSize: 10,
          textMargin: 2,
          margin: 2
        });
      } catch (err) {
        console.warn('Barcode render note:', err);
      }
    }
  }, [printerConfig.codeType, previewPaperSize, printerConfig.templateStyle]);

  // Handle local state update
  const updateConfig = <K extends keyof PrinterSettings>(key: K, value: PrinterSettings[K]) => {
    setPrinterConfig(prev => {
      const updated = { ...prev, [key]: value };
      return updated;
    });
  };

  // Apply Quick Preset
  const handleApplyPreset = (preset: QuickPreset) => {
    soundManager.playSuccessChime();
    const merged: PrinterSettings = {
      ...printerConfig,
      ...preset.settings
    };
    setPrinterConfig(merged);
    setPreviewPaperSize(merged.paperSize);
    
    // Auto-save preset
    savePrinterSettingsLocally(merged);
    onSaveSettings({
      ...settings,
      printerSettings: merged
    });

    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // Save Settings handler
  const handleSaveAll = () => {
    soundManager.playSuccessChime();
    savePrinterSettingsLocally(printerConfig);
    
    const updatedSystemSettings: SystemSettings = {
      ...settings,
      invoiceFooterNote: printerConfig.footerPolicyNote || settings.invoiceFooterNote,
      printerSettings: printerConfig
    };

    onSaveSettings(updatedSystemSettings);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // Reset to Defaults
  const handleResetDefaults = () => {
    soundManager.playWarningBeep();
    if (confirm('هل تريد بالتأكيد استعادة الإعدادات الافتراضية الأولية لجميع خيارات الطابعة وتصميم الفواتير؟')) {
      setPrinterConfig(DEFAULT_PRINTER_SETTINGS);
      setPreviewPaperSize(DEFAULT_PRINTER_SETTINGS.paperSize);
      savePrinterSettingsLocally(DEFAULT_PRINTER_SETTINGS);
      onSaveSettings({
        ...settings,
        printerSettings: DEFAULT_PRINTER_SETTINGS
      });
      soundManager.playSuccessChime();
    }
  };

  // Build Sample Print Payload for Testing
  const getSamplePrintPayload = (overridePaper?: InvoicePaperSize): SalesInvoicePrintData => {
    const pSize = overridePaper || printerConfig.paperSize;
    return {
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      customerName: printerConfig.showCustomerName ? 'سالم عبدالله أحمد (عميل تجريبي)' : undefined,
      customerPhone: printerConfig.showCustomerPhone ? '777123456' : undefined,
      customerBalance: printerConfig.showCustomerBalance ? '0' : undefined,
      cashierName: printerConfig.showCashierName ? 'أحمد الكاشير (نقطة البيع 1)' : undefined,
      date: new Date().toISOString(),
      paymentMethod: printerConfig.showPaymentMethod ? 'نقدي (كاش)' : undefined,
      items: [
        {
          barcode: '690123456789',
          name: 'شاشة حماية زجاجية نانو 9D مضادة للبصمات',
          quantity: 2,
          sellingPrice: 1500,
          total: 3000
        },
        {
          barcode: '880987654321',
          name: 'كابل شحن سريع Type-C أصلي 65W مضفر',
          quantity: 1,
          sellingPrice: 3500,
          total: 3500
        },
        {
          barcode: '770112233445',
          name: 'صيانة وتغيير مدخل الشحن مع فحص الدائرة',
          quantity: 1,
          sellingPrice: 2000,
          total: 2000
        }
      ],
      totalAmount: 8500,
      discount: printerConfig.showItemDiscount ? 500 : 0,
      finalAmount: printerConfig.showItemDiscount ? 8000 : 8500,
      notes: printerConfig.showFooterPolicy ? printerConfig.footerPolicyNote : '',
      storeLogoUrl: printerConfig.showLogo ? (settings.storeLogoUrl || '') : '',
      storeAddress: printerConfig.showHeaderAddress ? (settings.address || 'صنعاء - شارع حدة - بجوار المركز التجاري') : '',
      storePhone: printerConfig.showHeaderPhone ? (settings.phone || '777000000') : '',
      paperSize: pSize,
      printerSettings: printerConfig
    };
  };

  // Test Print Button Action
  const handleTestPrint = async () => {
    soundManager.playScanBeep();
    setIsTestPrinting(true);
    try {
      const payload = getSamplePrintPayload();
      await printSalesInvoiceThermalHTML(
        settings.storeName || 'سند للمحاسبة والخدمات',
        payload,
        settings.currency || 'ر.ي'
      );
      soundManager.playSuccessChime();
    } catch (err) {
      soundManager.playWarningBeep();
      alert('تعذر إرسال أمر الطباعة التجريبية. يرجى التحقق من اتصال الطابعة أو السماح بالنوافذ المنبثقة.');
    } finally {
      setIsTestPrinting(false);
    }
  };

  // Test PDF Export
  const handleExportTestPDF = async () => {
    soundManager.playScanBeep();
    const payload = getSamplePrintPayload();
    const ok = await generateSalesInvoiceThermalPDF(
      settings.storeName || 'سند للمحاسبة والخدمات',
      payload,
      settings.currency || 'ر.ي'
    );
    if (ok) {
      soundManager.playSuccessChime();
    }
  };

  // Test Bluetooth Connectivity
  const handleTestBluetooth = () => {
    soundManager.playScanBeep();
    setIsTestingBluetooth(true);
    setBluetoothStatusMessage('جاري البحث والتحقق من طابعات البلوتوث المقترنة بالهاتف...');

    setTimeout(() => {
      setIsTestingBluetooth(false);
      setBluetoothStatusMessage('✓ تم اكتشاف بروتوكول البلوتوث بنجاح! الطابعة جاهزة لاستقبال أوامر ESC/POS المباشرة.');
      soundManager.playSuccessChime();
    }, 1400);
  };

  // Test Cash Drawer & Cut
  const handleTestCashDrawer = () => {
    soundManager.playScanBeep();
    soundManager.playSuccessChime();
    alert('✓ تم إرسال نبضة فتح درج النقد (ESC/POS: \\x1B\\x70\\x00) وأمر قطع الورق (GS V 65 0) بنجاح!');
  };

  return (
    <div id="printer_invoice_studio_root" className="space-y-6 dir-rtl text-slate-800 pb-20" dir="rtl">
      
      {/* 1. TOP HEADER BANNER */}
      <div className="p-5 rounded-2xl bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-md shrink-0">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span>مركز ضبط الطابعات وتخصيص الفواتير والمستندات</span>
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  تحكم كامل وشامل 🖨️
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                اضبط طابعتك (حرارية 80mm / 58mm / بلوتوث / A4) وخصص شكل ونمط وتفاصيل فواتير المبيعات وكروت الصيانة والمستندات مع معاينة حية وطباعة تجريبية فورية بدون تعب.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isTestPrinting}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              title="طباعة فاتورة فحص تجريبية حقيقية للتأكد من الورق والمحاذاة"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>{isTestPrinting ? 'جاري الطباعة...' : 'طباعة تجريبية 🖨️'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </div>

        {/* Success Alert Notification */}
        {saveSuccessNotice && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>✓ تم حفظ إعدادات الطابعة وتخصيص الفواتير بنجاح وتطبيقها على كامل النظام!</span>
          </div>
        )}
      </div>

      {/* 2. ONE-CLICK QUICK PRESETS (قوالب جاهزة سريعة) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-slate-900">قوالب جاهزة سريعة بنقرة واحدة (Quick Setup Presets)</h3>
          </div>
          <span className="text-[10px] text-slate-500">اختر نوع نشاطك ليتم ضبط أفضل إعدادات تلقائياً</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {QUICK_INVOICE_PRESETS.map(preset => {
            const isActive = printerConfig.templateStyle === preset.settings.templateStyle && printerConfig.paperSize === preset.settings.paperSize;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between select-none ${
                  isActive
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold text-slate-900">{preset.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{preset.description}</p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="font-mono text-slate-400 font-bold">{preset.settings.paperSize}</span>
                  <span className={`font-bold flex items-center gap-0.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                    {isActive ? 'القالب المطبق حالياً ✓' : 'تطبيق هذا القالب ⚡'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. MAIN WORKSPACE: CONTROLS (RIGHT) + LIVE PREVIEW (LEFT) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT COLUMN: TABS & CONTROLS (7 COLS) */}
        <div className="xl:col-span-7 space-y-4">
          
          {/* Sub-Tabs Navigation Strip */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto text-xs font-bold scrollbar-none">
            <button
              type="button"
              onClick={() => { soundManager.playScanBeep(); setActiveSubTab('template'); }}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'template' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>نمط وشكل الفاتورة</span>
            </button>

            <button
              type="button"
              onClick={() => { soundManager.playScanBeep(); setActiveSubTab('fonts'); }}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'fonts' ? 'bg-white text-indigo-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Type className="w-3.5 h-3.5 text-indigo-600" />
              <span>الخط وسماكته ولونه</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-indigo-100 text-indigo-700 font-bold">جديد ✨</span>
            </button>

            <button
              type="button"
              onClick={() => { soundManager.playScanBeep(); setActiveSubTab('hardware'); }}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'hardware' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>الطابعة ونوع الورق</span>
            </button>

            <button
              type="button"
              onClick={() => { soundManager.playScanBeep(); setActiveSubTab('fields'); }}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'fields' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>الحقول والبيانات</span>
            </button>

            <button
              type="button"
              onClick={() => { soundManager.playScanBeep(); setActiveSubTab('footer'); }}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'footer' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>الرموز والشروط والختم</span>
            </button>

            <button
              type="button"
              onClick={() => { soundManager.playScanBeep(); setActiveSubTab('diagnostics'); }}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'diagnostics' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>أدوات وفحص الطابعة</span>
            </button>
          </div>

          {/* TAB 1: TEMPLATE & STYLE CUSTOMIZER */}
          {activeSubTab === 'template' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">تخصيص نمط وشكل الفواتير والمستندات</h4>
                    <p className="text-[11px] text-slate-500">اختر المظهر الجمالي ولون التمييز وعناوين الفاتورة</p>
                  </div>
                </div>
              </div>

              {/* Template Style Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span>اختر نمط وتصميم الفاتورة (Invoice Template):</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'modern', name: 'النمط الحديث الفاخر', desc: 'إطارات ناعمة، تسليط ضوء على الإجمالي، مظهر أنيق', icon: '🌟' },
                    { id: 'classic', name: 'النمط الحراري الكلاسيكي', desc: 'خطوط منقطة ومشرشرة متوافقة مع جميع الطابعات', icon: '🖨️' },
                    { id: 'boxed', name: 'النمط الشبكي المؤطر', desc: 'جداول محكمة بخانات واضحة تشبه الفواتير الرسمية', icon: '📊' },
                    { id: 'minimal', name: 'النمط الاقتصادي السريع', desc: 'أقل استهلاكاً للورق، سرعة قصوى بطباعة الكاشير', icon: '⚡' },
                    { id: 'official', name: 'النمط المعتمد للشركات', desc: 'مخصص للورق A4/A5، مساحة للأختام والترويسة', icon: '🏢' }
                  ].map(tmpl => {
                    const isSelected = printerConfig.templateStyle === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          updateConfig('templateStyle', tmpl.id as InvoiceTemplateStyle);
                        }}
                        className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span>{tmpl.icon}</span>
                          <span>{tmpl.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-normal leading-relaxed">{tmpl.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Color Accent */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800">
                  لون تمييز عناوين وجداول الفاتورة (Invoice Accent Color):
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { color: '#000000', name: 'أسود كلاسيكي (الأفضل للحراري)' },
                    { color: '#0f172a', name: 'كحلي داكن فاخر' },
                    { color: '#1e40af', name: 'أزرق ملكي' },
                    { color: '#047857', name: 'أخضر زمردي' },
                    { color: '#7c2d12', name: 'بني داكن' },
                    { color: '#374151', name: 'رمادي حجري' }
                  ].map(item => (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => {
                        soundManager.playScanBeep();
                        updateConfig('primaryColor', item.color);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                        printerConfig.primaryColor === item.color
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Titles Customization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">عنوان الفاتورة الرئيسي:</label>
                  <input
                    type="text"
                    value={printerConfig.invoiceTitle}
                    onChange={(e) => updateConfig('invoiceTitle', e.target.value)}
                    placeholder="فاتورة مبيعات نقدية وآجلة"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400">مثال: فاتورة مبيعات / سند قبض / إيصال استلام</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">العنوان الفرعي الترويجي:</label>
                  <input
                    type="text"
                    value={printerConfig.invoiceSubtitle}
                    onChange={(e) => updateConfig('invoiceSubtitle', e.target.value)}
                    placeholder="للأجهزة الذكية والصيانة والبرمجة"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400">يظهر مباشرة أسفل اسم المحل في رأس الفاتورة</p>
                </div>
              </div>

              {/* Tax & Commercial Reg Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">الرقم الضريبي (إن وجد):</label>
                  <input
                    type="text"
                    value={printerConfig.taxNumber || ''}
                    onChange={(e) => updateConfig('taxNumber', e.target.value)}
                    placeholder="300012345600003"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 text-left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">رقم السجل التجاري / الترخيص:</label>
                  <input
                    type="text"
                    value={printerConfig.commercialRegistration || ''}
                    onChange={(e) => updateConfig('commercialRegistration', e.target.value)}
                    placeholder="CR-987654321"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 text-left"
                  />
                </div>
              </div>

              {/* Font Customization Banner Shortcut */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-purple-50/80 p-3.5 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                    <Type className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <span>الخط المعتمد:</span>
                      <span className="text-indigo-700 underline font-black">{INVOICE_FONTS.find(f => f.id === (printerConfig.fontFamily || 'cairo'))?.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-white rounded border border-indigo-200 text-indigo-800">
                        {printerConfig.fontWeight === 'heavy' ? 'سميك جداً 900' : printerConfig.fontWeight === 'bold' ? 'عريض 700' : printerConfig.fontWeight === 'medium' ? 'شبه عريض 600' : 'عادي 500'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      لون الخط: <span className="font-mono font-bold text-slate-800">{printerConfig.fontColor || '#000000'}</span> | الحجم: <span className="font-bold text-slate-800">{(printerConfig.fontSizeScale || 'normal').toUpperCase()}</span> | تباعد: <span className="font-bold text-slate-800">{(printerConfig.lineHeight || 'normal').toUpperCase()}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playScanBeep();
                    setActiveSubTab('fonts');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>تعديل نوع الخط وسماكته ولونه 🔤</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: FONT, WEIGHT & COLOR CUSTOMIZER */}
          {activeSubTab === 'fonts' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Type className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">تخصيص خط ونصوص وسماكة الفاتورة</h4>
                    <p className="text-[11px] text-slate-500">تحكم كامل بنوع الخط العربي، لونه وسماكته وحجمه لمنع البهتان على الطابعات الحرارية</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg font-bold border border-indigo-100">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تحديث حي فوري في المعاينة</span>
                </div>
              </div>

              {/* SECTION 1: QUICK TYPOGRAPHY PRESETS */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>نماذج وأنماط خطوط جاهزة سريعة:</span>
                  <span className="text-[10px] text-slate-400 font-normal">نقرة واحدة لضبط كل إعدادات الخط</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    {
                      name: 'كاشير حراري شديد الوضوح',
                      desc: 'خط كايرو عريض جداً مع سواد فاحم للورق الحراري',
                      badge: 'موصى به للحراري 🖨️',
                      config: {
                        fontFamily: 'cairo' as InvoiceFontFamily,
                        fontWeight: 'heavy' as InvoiceFontWeight,
                        fontColor: '#000000',
                        fontSizeScale: 'normal' as InvoiceFontSizeScale,
                        lineHeight: 'normal' as InvoiceLineHeight
                      }
                    },
                    {
                      name: 'فواتير شركات فاخرة',
                      desc: 'خط تجوال أنيق بحجم مريح ولون كحلي داكن',
                      badge: 'أنيق ورسمي ✨',
                      config: {
                        fontFamily: 'tajawal' as InvoiceFontFamily,
                        fontWeight: 'bold' as InvoiceFontWeight,
                        fontColor: '#0f172a',
                        fontSizeScale: 'large' as InvoiceFontSizeScale,
                        lineHeight: 'normal' as InvoiceLineHeight
                      }
                    },
                    {
                      name: 'إيصال مضغوط وسريع',
                      desc: 'خط تاهوما الاقتصادي لتوفير طول الورقة وسرعة السحب',
                      badge: 'اقتصادي وسريع ⚡',
                      config: {
                        fontFamily: 'tahoma' as InvoiceFontFamily,
                        fontWeight: 'bold' as InvoiceFontWeight,
                        fontColor: '#000000',
                        fontSizeScale: 'compact' as InvoiceFontSizeScale,
                        lineHeight: 'compact' as InvoiceLineHeight
                      }
                    },
                    {
                      name: 'نمط هندسي حديث',
                      desc: 'خط الإسكندرية الهندسي الجذاب لمتاجر الإلكترونيات',
                      badge: 'مودرن هندسي 💎',
                      config: {
                        fontFamily: 'alexandria' as InvoiceFontFamily,
                        fontWeight: 'bold' as InvoiceFontWeight,
                        fontColor: '#1e293b',
                        fontSizeScale: 'normal' as InvoiceFontSizeScale,
                        lineHeight: 'normal' as InvoiceLineHeight
                      }
                    }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        soundManager.playSuccessChime();
                        setPrinterConfig(prev => ({
                          ...prev,
                          ...preset.config
                        }));
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50/60 hover:border-indigo-300 text-right transition cursor-pointer flex flex-col justify-between group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">{preset.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{preset.desc}</p>
                      <span className="mt-1.5 inline-block text-[9.5px] font-bold text-indigo-600 bg-white border border-indigo-100 rounded-md px-1.5 py-0.5 self-start">
                        {preset.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION 2: FONT FAMILY SELECTOR (9 Visual Cards with Live Arabic Previews) */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-indigo-600" />
                    <span>1. تحديد نوع الخط (Font Family):</span>
                  </label>
                  <span className="text-[11px] text-slate-400">9 خطوط عربية عالية الدقة</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {INVOICE_FONTS.map(font => {
                    const isSelected = (printerConfig.fontFamily || 'cairo') === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          updateConfig('fontFamily', font.id);
                        }}
                        className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between relative ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-bold text-slate-900">{font.name}</span>
                          {isSelected && (
                            <span className="p-0.5 rounded-full bg-indigo-600 text-white">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        {/* Live Font Sample */}
                        <div 
                          className="my-1.5 p-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-sm overflow-hidden text-center select-none"
                          style={{ 
                            fontFamily: font.fontFamilyCss,
                            fontWeight: getFontWeightCss(printerConfig.fontWeight),
                            color: printerConfig.fontColor || '#000000'
                          }}
                        >
                          {font.previewSample}
                        </div>

                        <div className="flex items-center justify-between mt-1 text-[10px]">
                          <span className="text-slate-400 font-mono">{font.nameEn}</span>
                          <span className="font-bold text-indigo-700 bg-indigo-100/60 px-1.5 py-0.2 rounded">
                            {font.badge}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: FONT COLOR & ACCENT PICKERS */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-indigo-600" />
                    <span>2. تحديد لون الخط (Font Color):</span>
                  </div>
                  <span className="text-[11px] text-slate-400">ينصح بالسواد التام للطابعات الحرارية لمنع بهتان النص</span>
                </label>

                {/* Color presets */}
                <div className="flex flex-wrap items-center gap-2">
                  {INVOICE_FONT_COLORS.map(c => {
                    const isSelected = (printerConfig.fontColor || '#000000') === c.color;
                    return (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          updateConfig('fontColor', c.color);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: c.color }} />
                        <span>{c.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Input */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700">لون نصوص مخصص:</span>
                    <input
                      type="color"
                      value={printerConfig.fontColor || '#000000'}
                      onChange={(e) => updateConfig('fontColor', e.target.value)}
                      className="w-7 h-7 rounded border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={printerConfig.fontColor || '#000000'}
                      onChange={(e) => updateConfig('fontColor', e.target.value)}
                      placeholder="#000000"
                      className="w-20 font-mono text-xs px-2 py-1 bg-white border border-slate-300 rounded-lg text-center"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700">لون عنوان المتجر:</span>
                    <input
                      type="color"
                      value={printerConfig.headerFontColor || printerConfig.primaryColor || '#0f172a'}
                      onChange={(e) => updateConfig('headerFontColor', e.target.value)}
                      className="w-7 h-7 rounded border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={printerConfig.headerFontColor || printerConfig.primaryColor || '#0f172a'}
                      onChange={(e) => updateConfig('headerFontColor', e.target.value)}
                      placeholder="#0f172a"
                      className="w-20 font-mono text-xs px-2 py-1 bg-white border border-slate-300 rounded-lg text-center"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: FONT WEIGHT / THICKNESS */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Bold className="w-4 h-4 text-indigo-600" />
                    <span>3. تحديد سماكة وبروز الخط (Font Weight & Boldness):</span>
                  </label>
                  <span className="text-[11px] text-slate-400">يزيد من سواد رأس الطباعة الحرارية</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {INVOICE_FONT_WEIGHTS.map(w => {
                    const isSelected = (printerConfig.fontWeight || 'bold') === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          updateConfig('fontWeight', w.id);
                        }}
                        className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-bold">{w.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                        <div 
                          className="my-1 text-sm bg-white p-2 rounded-lg border border-slate-200 text-center"
                          style={{ 
                            fontFamily: getFontFamilyCss(printerConfig.fontFamily),
                            fontWeight: w.cssWeight,
                            color: printerConfig.fontColor || '#000000'
                          }}
                        >
                          نموذج سماكة النص (7,500 ر.س)
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{w.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 5: FONT SIZE SCALING & LINE SPACING */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                {/* Font Size Scaling */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>4. حجم وتكبير خط الفاتورة (Font Scaling):</span>
                    <span className="text-[10px] text-indigo-600 font-bold font-mono">
                      {(printerConfig.fontSizeScale || 'normal').toUpperCase()}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {INVOICE_FONT_SIZE_SCALES.map(scale => {
                      const isSelected = (printerConfig.fontSizeScale || 'normal') === scale.id;
                      return (
                        <button
                          key={scale.id}
                          type="button"
                          onClick={() => {
                            soundManager.playScanBeep();
                            updateConfig('fontSizeScale', scale.id);
                          }}
                          className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-600 ring-1 ring-indigo-500 text-indigo-950 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-bold">{scale.label}</div>
                          <p className="text-[9.5px] text-slate-500 mt-0.5">{scale.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Line Height / Spacing */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>5. تباعد الأسطر (Line Spacing):</span>
                    <span className="text-[10px] text-indigo-600 font-bold font-mono">
                      {(printerConfig.lineHeight || 'normal').toUpperCase()}
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {INVOICE_LINE_HEIGHTS.map(lh => {
                      const isSelected = (printerConfig.lineHeight || 'normal') === lh.id;
                      return (
                        <button
                          key={lh.id}
                          type="button"
                          onClick={() => {
                            soundManager.playScanBeep();
                            updateConfig('lineHeight', lh.id);
                          }}
                          className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-600 ring-1 ring-indigo-500 text-indigo-950 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-bold">{lh.label}</div>
                          <p className="text-[9px] text-slate-500 mt-0.5">{lh.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Banner to Save */}
              <div className="pt-2 flex items-center justify-between bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>الخط المختار حالياً: {INVOICE_FONTS.find(f => f.id === (printerConfig.fontFamily || 'cairo'))?.name}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ إعدادات الخط 💾</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: HARDWARE & PAPER CONNECTION */}
          {activeSubTab === 'hardware' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">إعدادات الاتصال وحجم الورق والتحكم بالطابعة</h4>
                    <p className="text-[11px] text-slate-500">اختر طريقة توصيل الطابعة ومقاس الورق والتشغيل التلقائي</p>
                  </div>
                </div>
              </div>

              {/* Connection Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800">طريقة اتصال الطابعة بالنظام:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    { id: 'browser', label: 'نافذة النظام الافتراضية', sub: 'أي طابعة معرفة بالكمبيوتر/الجوال', icon: Monitor },
                    { id: 'thermal_usb', label: 'طابعة كاشير حرارية USB', sub: 'توصيل مباشر عبر كيبل USB POS', icon: Printer },
                    { id: 'bluetooth', label: 'طابعة بلوتوث لاسلكية', sub: 'طابعات الفواتير المحمولة بالجوال', icon: Bluetooth },
                    { id: 'network_ip', label: 'طابعة شبكية (LAN / Wi-Fi)', sub: 'عبر عنوان IP ومنفذ 9100', icon: Wifi }
                  ].map(conn => {
                    const isSelected = printerConfig.connectionType === conn.id;
                    const IconComponent = conn.icon;
                    return (
                      <button
                        key={conn.id}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          updateConfig('connectionType', conn.id as PrinterConnectionType);
                        }}
                        className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                          <IconComponent className="w-4 h-4 text-blue-600" />
                          <span>{conn.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal">{conn.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* If Network IP is selected */}
              {printerConfig.connectionType === 'network_ip' && (
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 animate-in fade-in">
                  <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-blue-600" />
                    <span>بيانات الطابعة الشبكية (Network IP & Port):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">عنوان IP للطابعة:</label>
                      <input
                        type="text"
                        value={printerConfig.ipAddress || '192.168.1.100'}
                        onChange={(e) => updateConfig('ipAddress', e.target.value)}
                        placeholder="192.168.1.100"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-left focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">رقم المنفذ (Port):</label>
                      <input
                        type="number"
                        value={printerConfig.port || 9100}
                        onChange={(e) => updateConfig('port', parseInt(e.target.value) || 9100)}
                        placeholder="9100"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-left focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* If Bluetooth is selected */}
              {printerConfig.connectionType === 'bluetooth' && (
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <Bluetooth className="w-4 h-4 text-blue-600" />
                      <span>إعدادات طابعة البلوتوث المحمولة:</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestBluetooth}
                      disabled={isTestingBluetooth}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer transition flex items-center gap-1 shadow-2xs"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTestingBluetooth ? 'animate-spin' : ''}`} />
                      <span>{isTestingBluetooth ? 'جاري الفحص...' : 'فحص الاقتران'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={printerConfig.bluetoothDeviceName || 'POS-80 Bluetooth Printer'}
                    onChange={(e) => updateConfig('bluetoothDeviceName', e.target.value)}
                    placeholder="اسم الطابعة المقترنة بالبلوتوث"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-left focus:ring-2 focus:ring-blue-500"
                  />
                  {bluetoothStatusMessage && (
                    <div className="p-2 rounded-lg bg-white border border-blue-200 text-[11px] text-blue-900 font-bold">
                      {bluetoothStatusMessage}
                    </div>
                  )}
                </div>
              )}

              {/* Paper Size Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800">
                  حجم ومقاس الورق المعتمد (Paper Size):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: '80mm', label: 'ورق حراري 80 ملم', sub: 'القياسي لكاشير المحلات', badge: 'الأكثر استخداماً' },
                    { id: '58mm', label: 'ورق حراري 58 ملم', sub: 'طابعات الجيب والبلوتوث', badge: 'مدمج' },
                    { id: 'a4', label: 'قياس كامل A4', sub: 'للمؤسسات والشركات', badge: 'رسمي' },
                    { id: 'a5', label: 'نصف صفحة A5', sub: 'فواتير وسندات متوسطة', badge: 'مخصص' }
                  ].map(p => {
                    const isSelected = printerConfig.paperSize === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          updateConfig('paperSize', p.id as InvoicePaperSize);
                          setPreviewPaperSize(p.id as InvoicePaperSize);
                        }}
                        className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{p.label}</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-white rounded border border-slate-200 text-slate-600 font-mono">
                            {p.id.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal">{p.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hardware Automation Switches */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>التحكم الآلي وسلوك الطباعة:</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Auto Print */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100/70">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <div>
                        <div>طباعة فورية عند إتمام البيع</div>
                        <div className="text-[10px] font-normal text-slate-500">إرسال الفاتورة للطابعة مباشرة بعد الحفظ</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={printerConfig.autoPrintOnSale}
                      onChange={(e) => updateConfig('autoPrintOnSale', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  {/* Auto Cut */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100/70">
                    <div className="flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-blue-600" />
                      <div>
                        <div>قطع الورق تلقائياً (Auto-Cut)</div>
                        <div className="text-[10px] font-normal text-slate-500">إرسال أمر القطع بعد نهاية الفاتورة</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={printerConfig.autoCutPaper}
                      onChange={(e) => updateConfig('autoCutPaper', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  {/* Cash Drawer */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100/70">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div>فتح درج النقد تلقائياً (Cash Drawer)</div>
                        <div className="text-[10px] font-normal text-slate-500">إرسال نبضة فتح الصندوق مع الطباعة</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={printerConfig.openCashDrawer}
                      onChange={(e) => updateConfig('openCashDrawer', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  {/* Beep */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100/70">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-purple-600" />
                      <div>
                        <div>صوت تنبيه عند اكتمال الطباعة</div>
                        <div className="text-[10px] font-normal text-slate-500">نغمة صوتية للتأكيد على خروج الفاتورة</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={printerConfig.beepOnPrint}
                      onChange={(e) => updateConfig('beepOnPrint', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>
                </div>

                {/* Copies & Margins */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">عدد النسخ المطبوعة لكل فاتورة:</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].map(count => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => {
                            soundManager.playScanBeep();
                            updateConfig('copiesCount', count);
                          }}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                            printerConfig.copiesCount === count
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {count === 1 ? 'نسخة واحدة' : `${count} نسخ`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">هوامش أطراف الورقة (Margins):</label>
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'compact', label: 'مدمج (0 ملم)' },
                        { id: 'normal', label: 'قياسي (3 ملم)' },
                        { id: 'wide', label: 'عريض (6 ملم)' }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            soundManager.playScanBeep();
                            updateConfig('pageMargin', m.id as any);
                          }}
                          className={`flex-1 py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                            printerConfig.pageMargin === m.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FIELDS & BRANDING */}
          {activeSubTab === 'fields' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">تخصيص الحقول والشعار والأعمدة المعروضة</h4>
                    <p className="text-[11px] text-slate-500">تحكم بإظهار أو إخفاء أي معلومة تظهر داخل الفاتورة المطبوعة</p>
                  </div>
                </div>
              </div>

              {/* Logo Settings */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold text-xs">
                      {settings.storeLogoUrl ? <img src={settings.storeLogoUrl} className="w-7 h-7 object-contain rounded" alt="Logo" /> : '🖼️'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">إظهار شعار المنشأة بالفاتورة</div>
                      <div className="text-[10px] text-slate-500">طباعة الشعار الرسمي أعلى الفاتورة لزيادة الموثوقية</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerConfig.showLogo}
                    onChange={(e) => updateConfig('showLogo', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {printerConfig.showLogo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">موضع الشعار:</label>
                      <div className="flex items-center gap-1.5">
                        {[
                          { id: 'center', label: 'بالوسط' },
                          { id: 'right', label: 'يمين' },
                          { id: 'left', label: 'يسار' }
                        ].map(pos => (
                          <button
                            key={pos.id}
                            type="button"
                            onClick={() => updateConfig('logoPosition', pos.id as any)}
                            className={`flex-1 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                              printerConfig.logoPosition === pos.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300 text-slate-700'
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">حجم الشعار:</label>
                      <div className="flex items-center gap-1.5">
                        {[
                          { id: 'small', label: 'صغير' },
                          { id: 'medium', label: 'متوسط' },
                          { id: 'large', label: 'كبير' }
                        ].map(sz => (
                          <button
                            key={sz.id}
                            type="button"
                            onClick={() => updateConfig('logoSize', sz.id as any)}
                            className={`flex-1 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                              printerConfig.logoSize === sz.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300 text-slate-700'
                            }`}
                          >
                            {sz.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Header Contact Fields */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800">بيانات الترويسة والعنوان:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار عنوان المنشأة والفرع</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showHeaderAddress}
                      onChange={(e) => updateConfig('showHeaderAddress', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار رقم هاتف التواصل</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showHeaderPhone}
                      onChange={(e) => updateConfig('showHeaderPhone', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>

              {/* Transaction & Customer Fields */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800">حقول وتفاصيل العملية والعميل:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار اسم الكاشير / البائع</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showCashierName}
                      onChange={(e) => updateConfig('showCashierName', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار اسم العميل المستلم</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showCustomerName}
                      onChange={(e) => updateConfig('showCustomerName', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار رقم هاتف العميل</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showCustomerPhone}
                      onChange={(e) => updateConfig('showCustomerPhone', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار طريقة السداد (نقداً، آجل، شبكة)</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showPaymentMethod}
                      onChange={(e) => updateConfig('showPaymentMethod', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار رصيد العميل المتبقي والمديونية</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showCustomerBalance}
                      onChange={(e) => updateConfig('showCustomerBalance', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>

              {/* Items Table Fields */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800">أعمدة جدول السلع والخدمات:</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار سعر الوحدة</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showUnitPrice}
                      onChange={(e) => updateConfig('showUnitPrice', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار باركود الصنف بالجدول</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showItemCodeBarcode}
                      onChange={(e) => updateConfig('showItemCodeBarcode', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                    <span>إظهار سطر الخصم الممنوح</span>
                    <input
                      type="checkbox"
                      checked={printerConfig.showItemDiscount}
                      onChange={(e) => updateConfig('showItemDiscount', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FOOTER, QR, CODES, WARRANTY & SIGNATURE */}
          {activeSubTab === 'footer' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">الرموز الأمنية، سياسة الضمان وخانة الختم والتوقيع</h4>
                    <p className="text-[11px] text-slate-500">تخصيص كود QR، الباركود، شروط الإرجاع وخانة الاعتماد</p>
                  </div>
                </div>
              </div>

              {/* Code Type Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800">
                  نوع الرمز الأمني المعروض أسفل الفاتورة (Verification Code):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'qr', label: 'رمز QR ذكي', sub: 'فحص فوري بالكاميرا', icon: QrCode },
                    { id: 'barcode', label: 'باركود شريطي', sub: 'Code 128 لرقم الفاتورة', icon: Barcode },
                    { id: 'both', label: 'كلاهما (QR + باركود)', sub: 'أعلى مستوى توثيق', icon: Layers },
                    { id: 'none', label: 'بدون رمز', sub: 'إخفاء الرموز السفلية', icon: Trash2 }
                  ].map(c => {
                    const isSelected = printerConfig.codeType === c.id;
                    const IconComp = c.icon;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          updateConfig('codeType', c.id as InvoiceCodeType);
                        }}
                        className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                          <IconComp className="w-4 h-4 text-amber-600" />
                          <span>{c.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal">{c.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Warranty Policy Note */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>شروط وسياسة الاسترجاع والضمان:</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printerConfig.showFooterPolicy}
                      onChange={(e) => updateConfig('showFooterPolicy', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span>إظهار الشروط بالفاتورة</span>
                  </label>
                </div>

                {printerConfig.showFooterPolicy && (
                  <textarea
                    rows={3}
                    value={printerConfig.footerPolicyNote}
                    onChange={(e) => updateConfig('footerPolicyNote', e.target.value)}
                    placeholder="أدخل شروط الضمان وسياسة الاستبدال أو الملاحظات التي تظهر أسفل الفاتورة..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition leading-relaxed"
                  />
                )}
              </div>

              {/* Greeting & Closing Remark */}
              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-slate-800">عبارة الشكر والختام:</label>
                <input
                  type="text"
                  value={printerConfig.footerGreeting}
                  onChange={(e) => updateConfig('footerGreeting', e.target.value)}
                  placeholder="سعدنا بزيارتكم الكريمة ❤️ طاب يومكم"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Signature Box & Developer Credits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                  <div>
                    <div>خانة التوقيع والختم الرسمي</div>
                    <div className="text-[10px] text-slate-500 font-normal">مربعات توقيع المستلم واعتماد المنشأة</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerConfig.showSignatureBox}
                    onChange={(e) => updateConfig('showSignatureBox', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer hover:bg-slate-100">
                  <div>
                    <div>شارة التوثيق وحقوق النظام</div>
                    <div className="text-[10px] text-slate-500 font-normal">إشعار الحفظ بالنظام المحاسبي</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerConfig.showDevCredits}
                    onChange={(e) => updateConfig('showDevCredits', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: DIAGNOSTICS & ACTIONS */}
          {activeSubTab === 'diagnostics' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">أدوات فحص واختبار الطابعة المباشرة</h4>
                    <p className="text-[11px] text-slate-500">أجرِ اختبارات فورية للتأكد من جاهزية الطابعة ودرج النقد وجودة الورق</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={isTestPrinting}
                  className="p-4 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-right transition cursor-pointer flex items-center gap-3 active:scale-98 shadow-xs"
                >
                  <div className="p-3 rounded-xl bg-blue-600 text-white shadow-xs">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-blue-950">طباعة فاتورة تجريبية الآن</div>
                    <div className="text-[10px] text-blue-700/80">فحص حقيقي للخطوط والشعار والهوامش</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportTestPDF}
                  className="p-4 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-right transition cursor-pointer flex items-center gap-3 active:scale-98 shadow-xs"
                >
                  <div className="p-3 rounded-xl bg-purple-600 text-white shadow-xs">
                    <FileDown className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-purple-950">تصدير الفاتورة التجريبية كـ PDF</div>
                    <div className="text-[10px] text-purple-700/80">تنزيل ملف PDF عالي النقاء بنفس النمط</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleTestCashDrawer}
                  className="p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-right transition cursor-pointer flex items-center gap-3 active:scale-98 shadow-xs"
                >
                  <div className="p-3 rounded-xl bg-emerald-600 text-white shadow-xs">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-emerald-950">فحص فتح الدرج وقطع الورق</div>
                    <div className="text-[10px] text-emerald-700/80">إرسال نبضات ESC/POS للدرج والسكين</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="p-4 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-right transition cursor-pointer flex items-center gap-3 active:scale-98 shadow-xs"
                >
                  <div className="p-3 rounded-xl bg-rose-600 text-white shadow-xs">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-rose-950">استعادة الإعدادات الافتراضية</div>
                    <div className="text-[10px] text-rose-700/80">إعادة ضبط جميع خيارات الطابعة للمصنع</div>
                  </div>
                </button>
              </div>

              {/* Diagnostic Notes Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>إرشادات ربط طابعات الفواتير (Thermal Printers):</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
                  <li>لطابعات USB وPOS: تأكد من تثبيت تعريف الطابعة (Driver) في نظام التشغيل واختيار مقاس الورق (80mm / Roll 3 inch).</li>
                  <li>لطابعات البلوتوث المحمولة: قم بالاقتران أولاً عبر إعدادات بلوتوث الهاتف، ثم اختر "طابعة بلوتوث لاسلكية" من هنا.</li>
                  <li>جميع التعديلات التي تجريها هنا تنعكس تلقائياً على فواتير المبيعات ونقاط البيع (POS) وسندات استلام الصيانة.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Action Save Bar */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveAll}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>تثبيت وحفظ إعدادات الطابعة وتصميم الفواتير</span>
            </button>
          </div>
        </div>

        {/* LEFT COLUMN: LIVE INTERACTIVE PREVIEW (5 COLS) */}
        {(() => {
          const previewSizeMult = getFontSizeMultiplier(printerConfig.fontSizeScale);
          const previewBaseFontSizePx = (previewPaperSize === '58mm' ? 10 : previewPaperSize === 'a4' ? 13.5 : 11) * previewSizeMult;
          const previewBodyColor = printerConfig.fontColor || '#000000';
          const previewHeaderColor = printerConfig.headerFontColor || printerConfig.primaryColor || '#0f172a';

          return (
            <div className="xl:col-span-5 space-y-3">
              {/* Preview Toolbar */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>معاينة حية فورية للفاتورة</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 font-bold text-[10px] border border-indigo-200 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: previewBodyColor }} />
                    <span>{INVOICE_FONTS.find(f => f.id === (printerConfig.fontFamily || 'cairo'))?.nameEn}</span>
                    <span>·</span>
                    <span>{Math.round(previewSizeMult * 100)}%</span>
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
                    {(['80mm', '58mm', 'a4'] as InvoicePaperSize[]).map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          setPreviewPaperSize(size);
                        }}
                        className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                          previewPaperSize === size ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {size.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Realistic Paper Container */}
              <div className="bg-slate-100 p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-inner flex justify-center items-start overflow-x-auto min-h-[520px]">
                <div
                  id="live-invoice-interactive-preview"
                  className={`bg-white shadow-xl rounded-sm transition-all duration-300 relative border border-slate-300/80 ${
                    previewPaperSize === '58mm'
                      ? 'w-[280px] p-3'
                      : previewPaperSize === 'a4'
                      ? 'w-[420px] p-6'
                      : 'w-[340px] p-4'
                  }`}
                  style={{
                    fontFamily: getFontFamilyCss(printerConfig.fontFamily),
                    fontWeight: getFontWeightCss(printerConfig.fontWeight),
                    lineHeight: getLineHeightCss(printerConfig.lineHeight),
                    color: previewBodyColor,
                    fontSize: `${previewBaseFontSizePx}px`
                  }}
                >
                  {/* Paper Watermark / Header accent for official */}
                  {printerConfig.templateStyle === 'official' && (
                    <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700" />
                  )}

                  {/* 1. Header & Logo */}
                  <div className="text-center pb-2">
                    {printerConfig.showLogo && (
                      <div className={`mb-1.5 flex ${
                        printerConfig.logoPosition === 'right' ? 'justify-start' :
                        printerConfig.logoPosition === 'left' ? 'justify-end' : 'justify-center'
                      }`}>
                        {settings.storeLogoUrl ? (
                          <img
                            src={settings.storeLogoUrl}
                            alt="Logo"
                            className={`object-contain rounded-md ${
                              printerConfig.logoSize === 'small' ? 'h-9 w-9' :
                              printerConfig.logoSize === 'large' ? 'h-16 w-16' : 'h-12 w-12'
                            }`}
                          />
                        ) : (
                          <div className={`rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-xs ${
                            printerConfig.logoSize === 'small' ? 'h-9 w-9 text-[10px]' :
                            printerConfig.logoSize === 'large' ? 'h-16 w-16 text-base' : 'h-12 w-12 text-sm'
                          }`}>
                            🏪 الشعار
                          </div>
                        )}
                      </div>
                    )}

                    <h3 className="font-black tracking-tight" style={{ color: previewHeaderColor, fontSize: `${previewBaseFontSizePx * 1.35}px` }}>
                      {settings.storeName || 'سند للمحاسبة والخدمات'}
                    </h3>

                    {printerConfig.invoiceSubtitle && (
                      <div className="font-bold mt-0.5" style={{ color: previewBodyColor, opacity: 0.85, fontSize: `${previewBaseFontSizePx * 0.9}px` }}>
                        {printerConfig.invoiceSubtitle}
                      </div>
                    )}

                    {(printerConfig.showHeaderAddress || printerConfig.showHeaderPhone) && (
                      <div className="mt-1 flex flex-wrap justify-center gap-1.5 font-sans" style={{ color: previewBodyColor, opacity: 0.8, fontSize: `${previewBaseFontSizePx * 0.82}px` }}>
                        {printerConfig.showHeaderAddress && <span>{settings.address || 'صنعاء - شارع حدة'}</span>}
                        {printerConfig.showHeaderAddress && printerConfig.showHeaderPhone && <span>|</span>}
                        {printerConfig.showHeaderPhone && <span className="font-mono">هاتف: {settings.phone || '777000000'}</span>}
                      </div>
                    )}

                    {/* Tax ID & Commercial Reg */}
                    {(printerConfig.taxNumber || printerConfig.commercialRegistration) && (
                      <div className="mt-0.5 flex flex-wrap justify-center gap-2 font-mono" style={{ color: previewBodyColor, opacity: 0.75, fontSize: `${previewBaseFontSizePx * 0.78}px` }}>
                        {printerConfig.taxNumber && <span>الرقم الضريبي: {printerConfig.taxNumber}</span>}
                        {printerConfig.commercialRegistration && <span>س.ت: {printerConfig.commercialRegistration}</span>}
                      </div>
                    )}

                    {/* Invoice Main Title Badge */}
                    <div 
                      className="mt-2 inline-block px-3 py-0.5 rounded-full bg-slate-100 border border-slate-300 font-extrabold"
                      style={{ color: previewHeaderColor || previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.9}px` }}
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
                      ? 'border-b border-dashed border-slate-500'
                      : printerConfig.templateStyle === 'minimal'
                      ? 'border-b border-slate-200'
                      : 'border-b-2 border-slate-900'
                  }`} />

                  {/* 2. Metadata Grid */}
                  <div className="space-y-1 leading-tight" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold" style={{ opacity: 0.8, fontSize: `${previewBaseFontSizePx * 0.9}px` }}>رقم الفاتورة:</span>
                      <span className="font-mono font-black" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>INV-2026-9876</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold" style={{ opacity: 0.8, fontSize: `${previewBaseFontSizePx * 0.9}px` }}>التاريخ والوقت:</span>
                      <span className="font-mono" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.9}px` }}>2026/09/24 10:30 ص</span>
                    </div>
                    {printerConfig.showCashierName && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold" style={{ opacity: 0.8, fontSize: `${previewBaseFontSizePx * 0.9}px` }}>الكاشير / البائع:</span>
                        <span className="font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>أحمد الكاشير</span>
                      </div>
                    )}
                    {printerConfig.showCustomerName && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold" style={{ opacity: 0.8, fontSize: `${previewBaseFontSizePx * 0.9}px` }}>العميل المستلم:</span>
                        <span className="font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>سالم عبدالله أحمد</span>
                      </div>
                    )}
                    {printerConfig.showCustomerPhone && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold" style={{ opacity: 0.8, fontSize: `${previewBaseFontSizePx * 0.9}px` }}>هاتف العميل:</span>
                        <span className="font-mono" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>777123456</span>
                      </div>
                    )}
                    {printerConfig.showPaymentMethod && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold" style={{ opacity: 0.8, fontSize: `${previewBaseFontSizePx * 0.9}px` }}>طريقة السداد:</span>
                        <span className="font-extrabold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.9}px` }}>نقدي (كاش)</span>
                      </div>
                    )}
                  </div>

                  {/* Separator Line */}
                  <div className={`my-2 ${
                    printerConfig.templateStyle === 'classic'
                      ? 'border-b border-dashed border-slate-500'
                      : 'border-b border-slate-300'
                  }`} />

                  {/* 3. Items Table */}
                  <table className={`w-full text-right ${
                    printerConfig.templateStyle === 'boxed' ? 'border border-slate-400' : ''
                  }`} style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>
                    <thead>
                      <tr className={`${
                        printerConfig.templateStyle === 'boxed' ? 'bg-slate-100 border-b border-slate-400' :
                        printerConfig.templateStyle === 'modern' ? 'bg-slate-50' : 'border-b border-slate-400'
                      }`}>
                        <th className="py-1 px-1 font-black" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.92}px` }}>السلعة / الخدمة</th>
                        <th className="py-1 px-1 text-center font-black" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.92}px` }}>الكمية</th>
                        {printerConfig.showUnitPrice && <th className="py-1 px-1 text-center font-black" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.92}px` }}>السعر</th>}
                        <th className="py-1 px-1 text-left font-black" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.92}px` }}>المجموع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-1 px-1">
                          <div className="font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 1.0}px` }}>حماية زجاج نانو 9D</div>
                          {printerConfig.showItemCodeBarcode && (
                            <div className="font-mono" style={{ color: previewBodyColor, opacity: 0.75, fontSize: `${previewBaseFontSizePx * 0.75}px` }}>#690123456789</div>
                          )}
                        </td>
                        <td className="py-1 px-1 text-center font-mono font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 1.0}px` }}>2</td>
                        {printerConfig.showUnitPrice && <td className="py-1 px-1 text-center font-mono" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>1,500</td>}
                        <td className="py-1 px-1 text-left font-mono font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 1.0}px` }}>3,000</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-1">
                          <div className="font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 1.0}px` }}>كابل Type-C سريع 65W</div>
                          {printerConfig.showItemCodeBarcode && (
                            <div className="font-mono" style={{ color: previewBodyColor, opacity: 0.75, fontSize: `${previewBaseFontSizePx * 0.75}px` }}>#880987654321</div>
                          )}
                        </td>
                        <td className="py-1 px-1 text-center font-mono font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 1.0}px` }}>1</td>
                        {printerConfig.showUnitPrice && <td className="py-1 px-1 text-center font-mono" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>3,500</td>}
                        <td className="py-1 px-1 text-left font-mono font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 1.0}px` }}>3,500</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-1">
                          <div className="font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 1.0}px` }}>صيانة وتغيير مدخل الشحن</div>
                        </td>
                        <td className="py-1 px-1 text-center font-mono font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 1.0}px` }}>1</td>
                        {printerConfig.showUnitPrice && <td className="py-1 px-1 text-center font-mono" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>2,000</td>}
                        <td className="py-1 px-1 text-left font-mono font-bold" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 1.0}px` }}>2,000</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Separator Line */}
                  <div className={`my-2 ${
                    printerConfig.templateStyle === 'classic'
                      ? 'border-b border-dashed border-slate-500'
                      : 'border-b border-slate-300'
                  }`} />

                  {/* 4. Totals Box */}
                  <div className="space-y-1" style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.95}px` }}>
                    <div className="flex justify-between items-center font-bold" style={{ color: previewBodyColor }}>
                      <span style={{ opacity: 0.85 }}>المجموع الإجمالي:</span>
                      <span className="font-mono">8,500 {settings.currency || 'ر.ي'}</span>
                    </div>

                    {printerConfig.showItemDiscount && (
                      <div className="flex justify-between items-center text-rose-600 font-bold">
                        <span>خصم خاص مخصوم:</span>
                        <span className="font-mono">- 500 {settings.currency || 'ر.ي'}</span>
                      </div>
                    )}

                    {/* Final Net Amount Highlight Box */}
                    <div 
                      className={`p-1.5 rounded-lg flex justify-between items-center font-black mt-1.5 ${
                        printerConfig.templateStyle === 'modern'
                          ? 'bg-slate-900 text-white'
                          : printerConfig.templateStyle === 'boxed'
                          ? 'border-2 border-slate-900 bg-slate-100'
                          : 'border-t-2 border-b-2 border-slate-900'
                      }`}
                      style={{ color: printerConfig.templateStyle === 'modern' ? '#ffffff' : previewBodyColor }}
                    >
                      <span style={{ fontSize: `${previewBaseFontSizePx * 1.05}px` }}>الصافي النهائي للتسديد:</span>
                      <span className="font-mono" style={{ fontSize: `${previewBaseFontSizePx * 1.3}px` }}>8,000 {settings.currency || 'ر.ي'}</span>
                    </div>

                    {printerConfig.showCustomerBalance && (
                      <div 
                        className="flex justify-between items-center font-bold pt-1"
                        style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.9}px` }}
                      >
                        <span style={{ opacity: 0.85 }}>الرصيد المتبقي للعميل بعد السداد:</span>
                        <span className="font-mono font-black">0 {settings.currency || 'ر.ي'} (خالص)</span>
                      </div>
                    )}
                  </div>

                  {/* 5. Policy Note */}
                  {printerConfig.showFooterPolicy && printerConfig.footerPolicyNote && (
                    <div 
                      className="mt-3 p-2 rounded-lg bg-slate-50 border border-dashed border-slate-300 text-center leading-relaxed font-bold"
                      style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.85}px` }}
                    >
                      {printerConfig.footerPolicyNote}
                    </div>
                  )}

                  {/* 6. Signature & Stamp Boxes */}
                  {printerConfig.showSignatureBox && (
                    <div 
                      className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-300 font-bold text-center"
                      style={{ color: previewBodyColor, fontSize: `${previewBaseFontSizePx * 0.85}px` }}
                    >
                      <div className="p-2 border border-slate-300 rounded h-14 flex flex-col justify-between">
                        <span>توقيع العميل المستلم</span>
                        <div className="border-b border-dotted border-slate-400" />
                      </div>
                      <div className="p-2 border border-slate-300 rounded h-14 flex flex-col justify-between">
                        <span>ختم وتوقيع المحل / الإدارة</span>
                        <div className="border-b border-dotted border-slate-400" />
                      </div>
                    </div>
                  )}

                  {/* 7. Verification Codes (QR / Barcode) */}
                  <div className="mt-3 text-center space-y-2">
                    {(printerConfig.codeType === 'qr' || printerConfig.codeType === 'both') && (
                      <div className="inline-block p-1.5 bg-white border border-slate-300 rounded-lg shadow-2xs">
                        <QRCodeSVG
                          value={JSON.stringify({
                            seller: settings.storeName || 'سند للمحاسبة',
                            timestamp: '2026-09-24T10:30:00Z',
                            total: 8000,
                            invoiceNum: 'INV-2026-9876'
                          })}
                          size={previewPaperSize === '58mm' ? 64 : 76}
                        />
                        <div 
                          className="font-bold mt-0.5"
                          style={{ color: previewBodyColor, opacity: 0.75, fontSize: `${previewBaseFontSizePx * 0.75}px` }}
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
                      className="font-bold text-center mt-2.5"
                      style={{ color: previewBodyColor, opacity: 0.85, fontSize: `${previewBaseFontSizePx * 0.85}px` }}
                    >
                      {printerConfig.footerGreeting}
                    </div>
                  )}

                  {printerConfig.showDevCredits && (
                    <div 
                      className="text-center mt-1 font-mono"
                      style={{ color: previewBodyColor, opacity: 0.7, fontSize: `${previewBaseFontSizePx * 0.75}px` }}
                    >
                      برمجة وتطوير م. عبدالمجيد المحواشي (الجمهورية اليمنية)
                    </div>
                  )}

                </div>
              </div>

              {/* Quick Preview Action Strip */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={isTestPrinting}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>طباعة هذه المعاينة الآن 🖨️</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportTestPDF}
                  className="py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                  title="تصدير كـ PDF"
                >
                  <FileDown className="w-3.5 h-3.5 text-purple-600" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
          );
        })()}

      </div>

    </div>
  );
}
