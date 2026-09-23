/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Settings as SettingsIcon, 
  Check, 
  RotateCcw, 
  Eye, 
  Sliders, 
  Sparkles, 
  FileText, 
  Scissors, 
  Maximize2, 
  QrCode, 
  Barcode, 
  HelpCircle,
  Volume2,
  DollarSign,
  Layers,
  Zap,
  Globe,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  Info,
  Laptop
} from 'lucide-react';
import { ThermalPrinterSettings, SystemSettings } from '../types';
import { 
  loadThermalPrinterSettings, 
  saveThermalPrinterSettings, 
  DEFAULT_GPU80300I_SETTINGS, 
  DEFAULT_58MM_SETTINGS, 
  DEFAULT_STANDARD_80MM_SETTINGS 
} from '../utils/printerConfig';
import { 
  printTestTicketGPU80300I, 
  generateBarcodeDataUrl,
  printShortTextTestTrueType,
  printInvoiceViaRawBT
} from '../services/ReceiptPrinter';
import { 
  testEscPosHardware, 
  sendEscPosDirect, 
  checkBrowserDeviceSupport,
  EscPosBuilder 
} from '../services/EscPosHelper';
import { soundManager } from '../utils/sound';

interface Props {
  settings: SystemSettings;
  onUpdateSystemSettings?: (newSettings: SystemSettings) => void;
}

export const ThermalPrinterSettingsSection: React.FC<Props> = ({
  settings,
  onUpdateSystemSettings
}) => {
  const [printerConfig, setPrinterConfig] = useState<ThermalPrinterSettings>(() => {
    return settings.printerSettings || loadThermalPrinterSettings();
  });

  const [activeTab, setActiveTab] = useState<'esc_profile' | 'presets' | 'fonts' | 'elements' | 'automation'>('esc_profile');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [escPosStatus, setEscPosStatus] = useState<string | null>(null);
  const [isTestingEscPos, setIsTestingEscPos] = useState<boolean>(false);
  const [previewBarcodeUrl, setPreviewBarcodeUrl] = useState<string>('');

  // Update barcode preview when settings or barcode state change
  useEffect(() => {
    if (printerConfig.showBarcode) {
      try {
        const url = generateBarcodeDataUrl('INV-1001-GP80');
        setPreviewBarcodeUrl(url);
      } catch (e) {
        setPreviewBarcodeUrl('');
      }
    }
  }, [printerConfig.showBarcode]);

  const handleUpdate = <K extends keyof ThermalPrinterSettings>(key: K, value: ThermalPrinterSettings[K]) => {
    setPrinterConfig(prev => {
      const updated = { ...prev, [key]: value };
      saveThermalPrinterSettings(updated);
      if (onUpdateSystemSettings) {
        onUpdateSystemSettings({
          ...settings,
          printerSettings: updated
        });
      }
      return updated;
    });
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  const handleSaveAll = () => {
    soundManager.playSuccessChime();
    saveThermalPrinterSettings(printerConfig);

    if (onUpdateSystemSettings) {
      onUpdateSystemSettings({
        ...settings,
        printerSettings: printerConfig
      });
    }

    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const handleApplyPreset = (preset: ThermalPrinterSettings, label: string) => {
    soundManager.playScanBeep();
    setPrinterConfig(preset);
    saveThermalPrinterSettings(preset);
    if (onUpdateSystemSettings) {
      onUpdateSystemSettings({
        ...settings,
        printerSettings: preset
      });
    }
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  const handleRunTestPrint = async () => {
    soundManager.playScanBeep();
    setIsTestPrinting(true);
    try {
      await printTestTicketGPU80300I(settings.storeName || 'مركز سند للأجهزة الذكية', printerConfig, settings.currency || 'ريال');
      soundManager.playSuccessChime();
      setPrintFeedback('🖨️ تم إرسال تذكرة الفحص الكاملة إلى الطابعة بنجاح');
      setTimeout(() => setPrintFeedback(null), 3500);
    } catch (err) {
      console.error('Error running test print:', err);
      setPrintFeedback('تعذر إرسال أمر الطباعة، يرجى التأكد من اتصال الطابعة أو RawBT');
      setTimeout(() => setPrintFeedback(null), 4000);
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleRunShortTextTest = async () => {
    soundManager.playScanBeep();
    setIsTestPrinting(true);
    try {
      await printShortTextTestTrueType(settings.storeName || 'مركز سند للأجهزة الذكية', printerConfig, settings.currency || 'ريال');
      soundManager.playSuccessChime();
      setPrintFeedback('🔤 تم إرسال فحص النص القصير بخط TrueType بنجاح');
      setTimeout(() => setPrintFeedback(null), 3500);
    } catch (err) {
      console.error('Error running short text test print:', err);
      setPrintFeedback('فشل إرسال فحص النص القصير');
      setTimeout(() => setPrintFeedback(null), 4000);
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleTestRawBTPrint = async () => {
    soundManager.playScanBeep();
    setIsTestPrinting(true);
    try {
      const testInvoiceData = {
        invoiceNumber: 'TEST-RAWBT-01',
        customerName: 'فحص تجريبي (RawBT TrueType)',
        date: new Date().toISOString(),
        paymentMethod: 'نقدي (تجربة فحص)',
        cashierName: 'فحص النظام الآلي',
        paperSize: (printerConfig.paperWidth === '58mm' ? '58mm' : '80mm') as ('58mm' | '80mm'),
        items: [
          { name: 'فحص اتصال الحروف العربية: شركة مبيعات', quantity: 1, sellingPrice: 1500, total: 1500 },
          { name: 'فحص خط TrueType المانع للرموز العشوائية', quantity: 1, sellingPrice: 2500, total: 2500 }
        ],
        totalAmount: 4000,
        discount: 0,
        finalAmount: 4000,
        notes: '✓ تم إرسال الأمر لتطبيق RawBT بخط TrueType المتصل.\nخالٍ تماماً من الرموز العشوائية.',
        printerSettings: printerConfig
      };
      await printInvoiceViaRawBT(settings.storeName || 'مركز سند للأجهزة الذكية', testInvoiceData, settings.currency || 'ريال');
      soundManager.playSuccessChime();
      setPrintFeedback('⚡ تم توجيه الفاتورة إلى تطبيق RawBT بنجاح (TrueType)');
      setTimeout(() => setPrintFeedback(null), 3500);
    } catch (err) {
      console.error('Error sending to RawBT:', err);
      setPrintFeedback('تعذر الإرسال إلى RawBT');
      setTimeout(() => setPrintFeedback(null), 4000);
    } finally {
      setIsTestPrinting(false);
    }
  };

  const handleTestHardware = async (action: 'drawer' | 'cut' | 'beep' | 'raw_test') => {
    soundManager.playScanBeep();
    setIsTestingEscPos(true);
    setEscPosStatus('🔌 جاري إرسال أمر ESC/POS مباشرة إلى الطابعة...');

    try {
      let res;
      if (action === 'drawer') {
        res = await testEscPosHardware.openDrawer();
      } else if (action === 'cut') {
        res = await testEscPosHardware.cutPaper();
      } else if (action === 'beep') {
        res = await testEscPosHardware.beep();
      } else {
        const builder = new EscPosBuilder();
        builder.init();
        builder.align('center');
        builder.bold(true);
        builder.fontSize('double_both');
        builder.textLine(settings.storeName || 'سند للمحاسبة');
        builder.fontSize('normal');
        builder.bold(false);
        builder.separator('=', 32);
        builder.textLine('ESC/POS DIRECT PRINT TEST');
        builder.textLine('WebUSB / WebSerial Communication');
        builder.textLine('Status: Connected 100%');
        builder.separator('-', 32);
        builder.feed(3);
        builder.cutPaper(false, 24);
        res = await sendEscPosDirect(builder.toUint8Array());
      }

      if (res.isPermissionsPolicyBlocked) {
        setEscPosStatus('💡 منافذ USB مقيدة داخل إطار المعاينة الحالي (Permissions Policy). يرجى فتح التطبيق في تبويب مستقل أو استخدام الطباعة القياسية.');
      } else {
        setEscPosStatus(res.message);
      }
      if (res.success) {
        soundManager.playSuccessChime();
      }
    } catch (e: any) {
      const errText = String(e?.message || e || '');
      if (e?.name === 'SecurityError' || errText.includes('permissions policy') || errText.includes('disallowed')) {
        setEscPosStatus('💡 منافذ USB مقيدة داخل إطار المعاينة الحالي (Permissions Policy). يرجى فتح التطبيق في تبويب مستقل.');
      } else {
        setEscPosStatus('تعذر الاتصال: ' + (e?.message || e));
      }
    } finally {
      setIsTestingEscPos(false);
      setTimeout(() => setEscPosStatus(null), 5000);
    }
  };

  // Calculations for live preview
  const is58 = printerConfig.paperWidth === '58mm';
  const previewWidthClass = is58 ? 'max-w-[270px]' : 'max-w-[340px]';

  let previewFontFamily = 'Cairo, sans-serif';
  if (printerConfig.fontFamily === 'tahoma') previewFontFamily = 'Tahoma, sans-serif';
  if (printerConfig.fontFamily === 'monospace') previewFontFamily = 'monospace';
  if (printerConfig.fontFamily === 'system') previewFontFamily = 'system-ui, sans-serif';

  let previewFontSizeClass = 'text-[11.5px]';
  if (printerConfig.fontScale === 'small') previewFontSizeClass = 'text-[10px]';
  if (printerConfig.fontScale === 'large') previewFontSizeClass = 'text-[13px]';
  if (printerConfig.fontScale === 'extralarge') previewFontSizeClass = 'text-[14.5px]';

  return (
    <div id="printer_settings_root" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden space-y-0">
      
      {/* 1. Header Banner with Model Badge */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs text-white ring-1 ring-white/20">
            <Printer className="w-6 h-6 text-sky-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight">إعدادات وضبط طابعة الفواتير الحرارية</h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-slate-950 shadow-xs">
                GP-U80300I جاهزة
              </span>
            </div>
            <p className="text-xs text-blue-100 font-medium mt-0.5">
              تخصيص كامل لأبعاد الورق، وضوح وصيغة خروج الحروف، القص التلقائي، وشكل الفاتورة بدون تعب
            </p>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRunTestPrint}
            disabled={isTestPrinting}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="طباعة تجريبية لفحص الطابعة وحروفها"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>{isTestPrinting ? 'جاري الإرسال...' : '🖨️ طباعة تذكرة فحص واختبار'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>حفظ الإعدادات</span>
          </button>
        </div>
      </div>

      {/* Save Success Notice */}
      {saveSuccessNotice && (
        <div className="bg-emerald-500 text-white text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
          <Check className="w-4 h-4" />
          <span>تم حفظ وتثبيت إعدادات الطابعة الحرارية بنجاح في النظام!</span>
        </div>
      )}

      {/* Print Feedback Notice */}
      {printFeedback && (
        <div className="bg-blue-600 text-white text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1 shadow-md">
          <Printer className="w-4 h-4 text-blue-200" />
          <span>{printFeedback}</span>
        </div>
      )}

      {/* 2. Quick Presets Bar */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>الضبط التلقائي السريع لطراز طابعتك:</span>
        </span>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => handleApplyPreset(DEFAULT_GPU80300I_SETTINGS, 'GP-U80300I')}
            className={`px-3 py-1.5 rounded-lg font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              printerConfig.printerModel === 'GP-U80300I'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>⚡ ضبط طابعة Gprinter GP-U80300I (الافتراضي)</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset(DEFAULT_STANDARD_80MM_SETTINGS, '80mm')}
            className={`px-2.5 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
              printerConfig.printerModel === 'standard-80mm'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>طابعة 80mm عامة</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset(DEFAULT_58MM_SETTINGS, '58mm')}
            className={`px-2.5 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
              printerConfig.printerModel === 'portable-58mm'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>طابعة 58mm متنقلة / بلوتوث</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleUpdate('escProfile', 'truetype');
              handleUpdate('useTrueTypeFont', true);
              setActiveTab('esc_profile');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              printerConfig.escProfile === 'truetype' || printerConfig.useTrueTypeFont
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-slate-700'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-300" />
            <span>✨ ملف ESC وخط TrueType (RawBT)</span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset(DEFAULT_GPU80300I_SETTINGS, 'Reset')}
            className="px-2 py-1.5 rounded-lg font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition flex items-center gap-1 cursor-pointer"
            title="استرجاع الإعدادات القياسية"
          >
            <RotateCcw className="w-3 h-3" />
            <span>استعادة</span>
          </button>
        </div>
      </div>

      {/* 3. Main Workspace: Settings Left + Live Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-200 dark:divide-slate-700">
        
        {/* LEFT COLUMN: Configuration Tabs & Inputs (7 Cols) */}
        <div className="lg:col-span-7 p-4 sm:p-5 space-y-4">
          
          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 pb-2 gap-1 overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('esc_profile')}
              className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'esc_profile'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-sky-300" />
              <span>ملف تعريف ESC العام (RawBT & TrueType)</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500 text-white font-black">مستحسن</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'presets'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>أبعاد وورق الطابعة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fonts')}
              className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'fonts'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>صيغة الحروف واللغة العربية</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('elements')}
              className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'elements'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>محتويات وتصميم الفاتورة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('automation')}
              className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'automation'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>القص التلقائي والخدمات</span>
            </button>
          </div>

          {/* TAB 0: ESC General Profile & Internationalization (TrueType / RawBT) */}
          {activeTab === 'esc_profile' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Blue Header Replicating RawBT Screen */}
              <div className="bg-[#1976D2] text-white rounded-xl p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <ArrowRight className="w-5 h-5 text-white" />
                  <span className="text-sm sm:text-base font-bold tracking-tight">ESC general profile (إعدادات الخط والتدويل)</span>
                </div>
                <button
                  type="button"
                  onClick={handleRunTestPrint}
                  disabled={isTestPrinting}
                  className="px-3.5 py-1.5 rounded-lg bg-[#0D47A1] hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs disabled:opacity-50"
                  title="طباعة تذكرة فحص عامة للطابعة (تعمل على الكمبيوتر وأندرويد)"
                >
                  <Printer className="w-4 h-4" />
                  <span>اختبار الطابعة</span>
                </button>
              </div>

              {/* Card: بيئة وجهاز التشغيل (كمبيوتر / ويندوز مقابل أندرويد RawBT) */}
              <div className="bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900 dark:text-white text-sm">بيئة وجهاز التشغيل (Computer vs Android)</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {printerConfig.printEnvironment === 'pc' ? '💻 وضع الكمبيوتر النشط' : printerConfig.printEnvironment === 'android_rawbt' ? '📱 وضع RawBT النشط' : '🤖 وضع الكشف التلقائي'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  إذا كنت تشغل النظام من <strong>جهاز كمبيوتر (PC / لابتوب ويندوز)</strong> وتطبع عبر كابل USB أو الشبكة المحلية، اختر <strong>كمبيوتر / وندوز</strong> أو <strong>كشف تلقائي</strong> لفتح نافذة طباعة وندوز المباشرة بدون الحاجة لتطبيق RawBT.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Option 1: كشف تلقائي */}
                  <label className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    (printerConfig.printEnvironment || 'auto') === 'auto'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>🤖 كشف تلقائي ذكي</span>
                      </span>
                      <input
                        type="radio"
                        name="print_environment_radio"
                        checked={(printerConfig.printEnvironment || 'auto') === 'auto'}
                        onChange={() => handleUpdate('printEnvironment', 'auto')}
                        className="w-4 h-4 text-emerald-600 accent-emerald-600 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      يطبع مباشرة عبر وندوز عند فتح النظام من الكمبيوتر، ويوجه لـ RawBT عند الفتح من هاتف أندرويد.
                    </span>
                  </label>

                  {/* Option 2: كمبيوتر / وندوز */}
                  <label className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    printerConfig.printEnvironment === 'pc'
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>💻 كمبيوتر / وندوز (USB)</span>
                      </span>
                      <input
                        type="radio"
                        name="print_environment_radio"
                        checked={printerConfig.printEnvironment === 'pc'}
                        onChange={() => handleUpdate('printEnvironment', 'pc')}
                        className="w-4 h-4 text-blue-600 accent-blue-600 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      لطابعات USB والشبكة على الكمبيوتر. يفتح نافذة الطباعة مباشرة ويمنع طلب RawBT نهائياً.
                    </span>
                  </label>

                  {/* Option 3: أندرويد / RawBT */}
                  <label className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    printerConfig.printEnvironment === 'android_rawbt'
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>📱 أندرويد (تطبيق RawBT)</span>
                      </span>
                      <input
                        type="radio"
                        name="print_environment_radio"
                        checked={printerConfig.printEnvironment === 'android_rawbt'}
                        onChange={() => handleUpdate('printEnvironment', 'android_rawbt')}
                        className="w-4 h-4 text-amber-600 accent-amber-600 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      إرسال الفواتير بصيغة TrueType إلى تطبيق RawBT المثبت على الهاتف أو التابلت.
                    </span>
                  </label>
                </div>
              </div>

              {/* Section 1: تدويل */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>تدويل</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Option 1: تهيئة نموذجية للغة المختارة */}
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">تهيئة نموذجية للغة المختارة</span>
                    <input
                      type="radio"
                      name="esc_profile_radio"
                      checked={printerConfig.escProfile === 'standard_lang'}
                      onChange={() => {
                        handleUpdate('escProfile', 'standard_lang');
                        handleUpdate('useTrueTypeFont', false);
                      }}
                      className="w-4 h-4 text-blue-600 accent-blue-600 cursor-pointer"
                    />
                  </label>

                  {/* Option 2: Goojprt PT-210 */}
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Goojprt PT-210</span>
                    <input
                      type="radio"
                      name="esc_profile_radio"
                      checked={printerConfig.escProfile === 'goojprt_pt210'}
                      onChange={() => {
                        handleUpdate('escProfile', 'goojprt_pt210');
                        handleUpdate('useTrueTypeFont', false);
                      }}
                      className="w-4 h-4 text-blue-600 accent-blue-600 cursor-pointer"
                    />
                  </label>

                  {/* Option 3: Star */}
                  <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Star</span>
                    <input
                      type="radio"
                      name="esc_profile_radio"
                      checked={printerConfig.escProfile === 'star'}
                      onChange={() => {
                        handleUpdate('escProfile', 'star');
                        handleUpdate('useTrueTypeFont', false);
                      }}
                      className="w-4 h-4 text-blue-600 accent-blue-600 cursor-pointer"
                    />
                  </label>

                  {/* Option 4: استخدم خط TrueType (Requested by User) */}
                  <label className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition ${
                    printerConfig.escProfile === 'truetype' || printerConfig.useTrueTypeFont
                      ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">استخدم خط TrueType</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-xs">
                          الحل المعتمد لمنع الرموز العشوائية ⭐
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                        يقوم برسم الحروف العربية كمتجهات رسومية نقية (TrueType Vector Raster) بدلاً من معالجة الطابعة القديمة، مما يمنع الرموز العشوائية ويجعل الحروف متصلة 100%.
                      </p>
                    </div>
                    <input
                      type="radio"
                      name="esc_profile_radio"
                      checked={printerConfig.escProfile === 'truetype' || printerConfig.useTrueTypeFont}
                      onChange={() => {
                        handleUpdate('escProfile', 'truetype');
                        handleUpdate('useTrueTypeFont', true);
                      }}
                      className="w-5 h-5 text-blue-600 accent-blue-600 cursor-pointer shrink-0 ml-2"
                    />
                  </label>

                  {/* UTF-8 Subheading */}
                  <div className="pt-2">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 px-1">
                      للطابعات ذات UTF-8:
                    </div>

                    <div className="space-y-1 pr-3">
                      <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">تم تكوينه بالفعل على أنه UTF-8</span>
                        <input
                          type="radio"
                          name="esc_profile_radio"
                          checked={printerConfig.escProfile === 'utf8_configured'}
                          onChange={() => {
                            handleUpdate('escProfile', 'utf8_configured');
                            handleUpdate('useTrueTypeFont', false);
                          }}
                          className="w-4 h-4 text-blue-600 accent-blue-600 cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs font-mono">ESC GS t 128</span>
                        <input
                          type="radio"
                          name="esc_profile_radio"
                          checked={printerConfig.escProfile === 'utf8_esc_gs_t128'}
                          onChange={() => {
                            handleUpdate('escProfile', 'utf8_esc_gs_t128');
                            handleUpdate('useTrueTypeFont', false);
                          }}
                          className="w-4 h-4 text-blue-600 accent-blue-600 cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs font-mono">ESC 9 0x01</span>
                        <input
                          type="radio"
                          name="esc_profile_radio"
                          checked={printerConfig.escProfile === 'utf8_esc_9_0x01'}
                          onChange={() => {
                            handleUpdate('escProfile', 'utf8_esc_9_0x01');
                            handleUpdate('useTrueTypeFont', false);
                          }}
                          className="w-4 h-4 text-blue-600 accent-blue-600 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Short Text Test Button (Replicating "نص قصير" Button) */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleRunShortTextTest}
                      disabled={isTestPrinting}
                      className="px-4 py-2 rounded-lg bg-[#1976D2] hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-xs disabled:opacity-50"
                      title="طباعة فحص سريع لسطر نص عربي بخط TrueType"
                    >
                      <Printer className="w-4 h-4" />
                      <span>نص قصير</span>
                    </button>
                    <span className="text-[11px] text-slate-400">فحص تجريبي فوري للحروف العربية وخط TrueType</span>
                  </div>
                </div>
              </div>

              {/* Section 2: قص الورق */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                  <Scissors className="w-4 h-4 text-blue-600" />
                  <span>قص الورق</span>
                </div>

                <div className="space-y-3">
                  {/* عدد الخطوط التي يتم تمريرها */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">عدد الخطوط التي يتم تمريرها</span>
                      <span className="text-[10px] text-slate-500">مسافة دفع الورق البيضاء قبل نزول سكين القص (افتراضي: 2)</span>
                    </div>
                    <select
                      value={printerConfig.feedLinesCount ?? 2}
                      onChange={(e) => handleUpdate('feedLinesCount', Number(e.target.value))}
                      className="text-xs font-bold p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white min-w-[70px] text-center"
                    >
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                      <option value={2}>2 (افتراضي)</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                      <option value={6}>6</option>
                    </select>
                  </div>

                  {/* قص الورق toggle */}
                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">قص الورق</span>
                      <span className="text-[10px] text-slate-500">تفعيل سكين القاطع الآلي بعد الانتهاء من طباعة الفاتورة</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={printerConfig.enablePaperCut ?? true}
                      onChange={(e) => {
                        handleUpdate('enablePaperCut', e.target.checked);
                        handleUpdate('autoCutPaper', e.target.checked);
                      }}
                      className="w-4 h-4 text-blue-600 accent-blue-600 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Section 3: تكامل مباشر مع تطبيق RawBT للأندرويد */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-4 border border-indigo-800 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-amber-400" />
                    <span className="text-xs sm:text-sm font-black">الربط المباشر مع تطبيق RawBT للأندرويد</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-400 text-slate-950">
                    ESC/POS TrueType
                  </span>
                </div>

                <p className="text-[11px] text-indigo-100 leading-relaxed">
                  إذا كان تطبيق RawBT مثبتاً على هاتفك الأندرويد، يمكنك إرسال الفاتورة مباشرة بصيغة رسومات TrueType المتصلة لتجنب الرموز العشوائية تماماً.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestRawBTPrint}
                    disabled={isTestPrinting}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition shadow-md disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>⚡ تجربة إرسال الفاتورة إلى RawBT الآن</span>
                  </button>

                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 cursor-pointer text-xs font-bold text-white transition">
                    <input
                      type="checkbox"
                      checked={printerConfig.directRawBTSupport ?? true}
                      onChange={(e) => handleUpdate('directRawBTSupport', e.target.checked)}
                      className="w-4 h-4 accent-amber-400"
                    />
                    <span>تفعيل زر RawBT في نافذة الفاتورة</span>
                  </label>
                </div>
              </div>

              {/* Section 4: أوامر ESC/POS الخام المباشرة لمتصفح الكمبيوتر */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-xl p-4 border border-purple-800/60 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-purple-400" />
                    <span className="text-xs sm:text-sm font-black">أوامر ESC/POS الخام المباشرة (WebUSB / WebSerial للكمبيوتر)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-purple-500 text-white">
                    Raw Binary Commands
                  </span>
                </div>

                <p className="text-[11px] text-gray-300 leading-relaxed">
                  يتيح لك هذا المحرك إرسال أوامر التحكم الخام (ESC/POS) من متصفح Google Chrome إلى طابعة الكاشير مباشرة عبر كابل USB أو المنفذ التسلسلي الافتراضي COM، مع تحكم فوري في سكين القص ودرج النقود والتنبيهات الصوتية.
                </p>

                {/* ESC/POS Status feedback */}
                {escPosStatus && (
                  <div className="p-2.5 rounded-lg bg-purple-950 border border-purple-600 text-purple-200 text-xs font-bold animate-fadeIn flex items-center gap-2">
                    <Info className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>{escPosStatus}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestHardware('drawer')}
                    disabled={isTestingEscPos}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                    title="إرسال أمر فتح درج الكاشير ESC p عبر USB"
                  >
                    <DollarSign className="w-4 h-4 text-purple-400" />
                    <span>فتح الدرج (ESC p)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestHardware('cut')}
                    disabled={isTestingEscPos}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                    title="إرسال أمر قص الورق GS V عبر USB"
                  >
                    <Scissors className="w-4 h-4 text-purple-400" />
                    <span>قص الورق (GS V)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestHardware('beep')}
                    disabled={isTestingEscPos}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                    title="إرسال أمر تشغيل جرس التنبيه ESC B عبر USB"
                  >
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    <span>تنبيه صوتي (ESC B)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestHardware('raw_test')}
                    disabled={isTestingEscPos}
                    className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-md disabled:opacity-50"
                    title="إرسال إيصال فحص كامل بأوامر ESC/POS الخام عبر متصفح كروم"
                  >
                    <Printer className="w-4 h-4" />
                    <span>فحص طباعة USB</span>
                  </button>
                </div>
              </div>

              {/* Notice Card */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>لماذا تم حل المشكلة بعد تفعيل خيار "استخدم خط TrueType"؟</span>
                </p>
                <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                  معظم طابعات الإيصالات الصينية (مثل Gprinter، Goojprt وغيرها) تحتوي فقط على جداول خطوط إنجليزية وصينية داخلية. عند إرسال نصوص عربية مباشرة إليها تظهر على شكل علامات استفهام ورموز عشوائية. تفعيل خيار <b>استخدم خط TrueType</b> يحول نصوص الفاتورة إلى رسومات متجهة بالغة الدقة، مما ينتج حروفاً عربية متصلة ومقروءة بنسبة 100% دون أي رموز مشوهة.
                </p>
              </div>
            </div>
          )}
          {activeTab === 'presets' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span>💡 مواصفات طابعة GP-U80300I:</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  تستخدم طابعة Gprinter GP-U80300I رول ورق حراري قياسي بعرض 80 مم، مع مساحة طباعة فعالة 72 مم (576 نقطة). تم ضبط الهوامش أدناه لمنع خروج الحروف عن حواف الورقة.
                </p>
              </div>

              {/* Paper Width Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">عرض رول الورق المستخدم (Paper Width):</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdate('paperWidth', '80mm');
                      handleUpdate('printableWidthMm', 72);
                      handleUpdate('feedBeforeCutMm', 16);
                    }}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer ${
                      printerConfig.paperWidth === '80mm'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-600 text-blue-950 dark:text-white font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold">رول عريض 80 مم (GP-U80300I)</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">العرض الفعلي 72 مم - الأنسب لنقاط البيع والفواتير المفصلة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleUpdate('paperWidth', '58mm');
                      handleUpdate('printableWidthMm', 48);
                      handleUpdate('feedBeforeCutMm', 10);
                    }}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer ${
                      printerConfig.paperWidth === '58mm'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-600 text-blue-950 dark:text-white font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold">رول مصغر 58 مم (محمول)</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">العرض الفعلي 48 مم - للطابعات اللاسلكية والصغيرة</div>
                  </button>
                </div>
              </div>

              {/* Printable Width Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-700 dark:text-slate-300">عرض مساحة الطباعة الفعلي (Printable Area Width):</label>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{printerConfig.printableWidthMm || 72} مم</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="76"
                  step="1"
                  value={printerConfig.printableWidthMm || 72}
                  onChange={(e) => handleUpdate('printableWidthMm', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-slate-400">لـ GP-U80300I: 72 مم تضمن عدم اقتصاص أطراف الجداول في اليمين أو اليسار.</p>
              </div>

              {/* Feed Before Cut */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Scissors className="w-3.5 h-3.5 text-amber-500" />
                    <span>مسافة التمرير قبل قطع السكين (Feed Before Cut):</span>
                  </label>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{printerConfig.feedBeforeCutMm || 16} مم</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="28"
                  step="2"
                  value={printerConfig.feedBeforeCutMm || 16}
                  onChange={(e) => handleUpdate('feedBeforeCutMm', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  هام جداً: في طابعة GP-U80300I يقع سكين القص على بعد مسافة من رأس الطباعة. 16 مم تمنع السكين من قص عبارة الشكر أو الباركود.
                </p>
              </div>

              {/* Top & Bottom Margins */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">الهامش العلوي (Top Margin):</label>
                  <select
                    value={printerConfig.marginTopMm ?? 2}
                    onChange={(e) => handleUpdate('marginTopMm', parseInt(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold"
                  >
                    <option value={0}>0 مم (بدون هامش علوي)</option>
                    <option value={2}>2 مم (قياسي ومستحسن)</option>
                    <option value={4}>4 مم</option>
                    <option value={6}>6 مم</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">الهامش السفلي (Bottom Margin):</label>
                  <select
                    value={printerConfig.marginBottomMm ?? 4}
                    onChange={(e) => handleUpdate('marginBottomMm', parseInt(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold"
                  >
                    <option value={0}>0 مم</option>
                    <option value={4}>4 مم (قياسي)</option>
                    <option value={8}>8 مم</option>
                    <option value={12}>12 مم</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Fonts & Arabic Typography */}
          {activeTab === 'fonts' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <p className="font-bold">✨ معالجة حروف اللغة العربية وحل مشكلة التقطيع:</p>
                <p className="text-[11px] leading-relaxed">
                  يستخدم النظام محرك رسم حراري مدمج يضمن اتصال كافة الحروف العربية (بما فيها الهمزات والتنوين والأرقام المركبة) لتخرج الفاتورة بأعلى درجات الجمال والاتصال.
                </p>
              </div>

              {/* Font Family Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">نوع الخط المستخدم في الفاتورة الحرارية:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate('fontFamily', 'cairo')}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      printerConfig.fontFamily === 'cairo'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-600 text-emerald-950 dark:text-white font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold" style={{ fontFamily: 'Cairo, sans-serif' }}>خط كايرو الحراري (Cairo) ⭐</div>
                    <div className="text-[10px] text-slate-500">حروف عريضة ومتصلة، فائق الوضوح في الرول الحراري</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate('fontFamily', 'tahoma')}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      printerConfig.fontFamily === 'tahoma'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-600 text-emerald-950 dark:text-white font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold" style={{ fontFamily: 'Tahoma, sans-serif' }}>خط تاهوما الرسمي (Tahoma)</div>
                    <div className="text-[10px] text-slate-500">كلاسيكي دقيق للأرقام والأسماء الطويلة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate('fontFamily', 'monospace')}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      printerConfig.fontFamily === 'monospace'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-600 text-emerald-950 dark:text-white font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono">خط كاشير أحادي (Monospace)</div>
                    <div className="text-[10px] text-slate-500">أعمدة مصفوفة بدقة هندسية موحدة</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate('fontFamily', 'system')}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      printerConfig.fontFamily === 'system'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-600 text-emerald-950 dark:text-white font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">خط النظام الذكي (System Font)</div>
                    <div className="text-[10px] text-slate-500">يعتمد خط الويندوز / الأندرويد الأصلي</div>
                  </button>
                </div>
              </div>

              {/* Font Scale */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">مقياس حجم الخط (Font Scale):</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'small', label: 'صغير', desc: '10px اقتصادي' },
                    { id: 'standard', label: 'قياسي ⭐', desc: '11.5px ممتاز' },
                    { id: 'large', label: 'عريض', desc: '13px واضح' },
                    { id: 'extralarge', label: 'كبير', desc: '14.5px لكبار السن' }
                  ].map((sizeOpt) => (
                    <button
                      key={sizeOpt.id}
                      type="button"
                      onClick={() => handleUpdate('fontScale', sizeOpt.id as any)}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                        printerConfig.fontScale === sizeOpt.id
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-white font-extrabold ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">{sizeOpt.label}</div>
                      <div className="text-[9px] text-slate-500">{sizeOpt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Print Density / Darkness */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">كثافة وسواد الطباعة الحرارية (Thermal Density):</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate('printDensity', 'normal')}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      printerConfig.printDensity === 'normal'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">عادي (Normal)</div>
                    <div className="text-[9.5px] text-slate-500">سواد قياسي متوازن</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate('printDensity', 'dark')}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      printerConfig.printDensity === 'dark'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">سواد عالي التباين (Dark) ⭐</div>
                    <div className="text-[9.5px] text-slate-500">المفضل لطابعة GP-U80300I لمنع البهتان</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate('printDensity', 'extradark')}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer ${
                      printerConfig.printDensity === 'extradark'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-black">فائق السواد (Ultra Bold)</div>
                    <div className="text-[9.5px] text-slate-500">حبر حراري عريض وواضح جداً</div>
                  </button>
                </div>
              </div>

              {/* Number Format */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">صيغة عرض الأرقام والأسعار:</label>
                  <select
                    value={printerConfig.numberFormat}
                    onChange={(e) => handleUpdate('numberFormat', e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold"
                  >
                    <option value="latin">أرقام لاتينية (12345) - مستحسن لمنع انقلاب الأرقام</option>
                    <option value="arabic">أرقام مشرقية عربية (١٢٣٤٥)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">تباعد الأسطر (Line Spacing):</label>
                  <select
                    value={printerConfig.lineSpacing}
                    onChange={(e) => handleUpdate('lineSpacing', e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold"
                  >
                    <option value="compact">مضغوط (Compact - توفير ورق)</option>
                    <option value="standard">قياسي (Standard - مريح للعين)</option>
                    <option value="relaxed">متسع (Relaxed)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Invoice Visual Elements */}
          {activeTab === 'elements' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">العنوان الرئيسي أعلى الفاتورة:</label>
                <input
                  type="text"
                  value={printerConfig.customHeaderTitle || 'فاتورة مبيعات نقدية'}
                  onChange={(e) => handleUpdate('customHeaderTitle', e.target.value)}
                  placeholder="فاتورة مبيعات نقدية / إيصال قبض"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold"
                />
              </div>

              {/* Toggles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">إظهار شعار المحل (Logo)</span>
                  <input
                    type="checkbox"
                    checked={printerConfig.showLogo}
                    onChange={(e) => handleUpdate('showLogo', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">إظهار اسم المنشأة / المحل</span>
                  <input
                    type="checkbox"
                    checked={printerConfig.showHeaderName}
                    onChange={(e) => handleUpdate('showHeaderName', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">إظهار العنوان ورقم الهاتف</span>
                  <input
                    type="checkbox"
                    checked={printerConfig.showBranchAddress}
                    onChange={(e) => {
                      handleUpdate('showBranchAddress', e.target.checked);
                      handleUpdate('showPhone', e.target.checked);
                    }}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">إظهار اسم الكاشير / البائع</span>
                  <input
                    type="checkbox"
                    checked={printerConfig.showCashierName}
                    onChange={(e) => handleUpdate('showCashierName', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Barcode className="w-3.5 h-3.5 text-blue-600" />
                    <span>طباعة الباركود الخطي للفاتورة</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={printerConfig.showBarcode}
                    onChange={(e) => handleUpdate('showBarcode', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-purple-600" />
                    <span>طباعة رمز الاستجابة QR Code</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={printerConfig.showQrCode}
                    onChange={(e) => handleUpdate('showQrCode', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                </label>

              </div>

              {/* Table Border Selection */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">شكل فواصل وجداول الفاتورة:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'dashed', label: 'متقطع (- - -)', desc: 'حراري أنيق' },
                    { id: 'solid', label: 'متصل (━━)', desc: 'خط كلاسيكي' },
                    { id: 'dotted', label: 'منقط (••••)', desc: 'ناعم وخفيف' },
                    { id: 'double', label: 'مزدوج (══)', desc: 'رسمي بارز' }
                  ].map((borderOpt) => (
                    <button
                      key={borderOpt.id}
                      type="button"
                      onClick={() => handleUpdate('tableBorderType', borderOpt.id as any)}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                        printerConfig.tableBorderType === borderOpt.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-white font-bold ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs">{borderOpt.label}</div>
                      <div className="text-[9px] text-slate-500">{borderOpt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tax & Commercial Record */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printerConfig.showTaxNumber}
                    onChange={(e) => handleUpdate('showTaxNumber', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">إظهار الرقم الضريبي / السجل التجاري في الترويسة</span>
                </label>
                {printerConfig.showTaxNumber && (
                  <input
                    type="text"
                    value={printerConfig.taxNumber || ''}
                    onChange={(e) => handleUpdate('taxNumber', e.target.value)}
                    placeholder="مثال: 300123456700003"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-mono"
                  />
                )}
              </div>

              {/* Return Policy Text */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">نص سياسة الاسترجاع والشروط أسفل الفاتورة:</label>
                <textarea
                  rows={2}
                  value={printerConfig.customFooterNote || ''}
                  onChange={(e) => handleUpdate('customFooterNote', e.target.value)}
                  placeholder="البضاعة المباعة لا تُرد ولا تُستبدل إلا بالفاتورة الأصلية..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white resize-none"
                />
              </div>

              {/* Greeting */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">العبارة الترحيبية الختامية:</label>
                <input
                  type="text"
                  value={printerConfig.footerGreeting || 'سعدنا بخدمتكم وتفضلكم بزيارتنا الكريمة ❤️ طاب يومكم'}
                  onChange={(e) => handleUpdate('footerGreeting', e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                />
              </div>

            </div>
          )}

          {/* TAB 4: Automation, Cutter & Hardware Kick */}
          {activeTab === 'automation' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-900 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Scissors className="w-4 h-4 text-purple-600" />
                  <span>خدمات طابعة Gprinter GP-U80300I المتقدمة:</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  تحتوي طابعة GP-U80300I على قاطع ورق آلي مدمج وسريع، ومنفذ RJ-11 لدعم فتح درج الكاشير الإلكتروني تلقائياً عند الطباعة.
                </p>
              </div>

              {/* Auto Cut Paper Toggle */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Scissors className="w-4 h-4 text-amber-500" />
                    <span>تفعيل القص الآلي للورق (Auto Cut Paper)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    إرسال أمر قطع الورقة تلقائياً بعد إنهاء طباعة الفاتورة
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={printerConfig.autoCutPaper}
                  onChange={(e) => handleUpdate('autoCutPaper', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Cash Drawer Kick */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span>فتح درج النقدية / الكاشير تلقائياً (Cash Drawer Kick)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    إطلاق نبضة كهربائية عبر كيبل RJ11 لفتح صندوق النقود عند الطباعة
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={printerConfig.openCashDrawer}
                  onChange={(e) => handleUpdate('openCashDrawer', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Auto Print on Sale Checkout */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>الطباعة التلقائية المباشرة عند إتمام البيع (POS Auto Print)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    طباعة الفاتورة فوراً عند الضغط على إنهاء البيع أو F4 دون الحاجة لفتح نافذة المعاينة
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={printerConfig.autoPrintOnSale}
                  onChange={(e) => handleUpdate('autoPrintOnSale', e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Print Copies */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">عدد النسخ المطبوعة افتراضياً:</label>
                  <select
                    value={printerConfig.printCopies || 1}
                    onChange={(e) => handleUpdate('printCopies', parseInt(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold"
                  >
                    <option value={1}>نسخة واحدة (للعميل فقط)</option>
                    <option value={2}>نسختان (نسخة للعميل + نسخة للمحل)</option>
                    <option value={3}>3 نسخ (عميل + محل + محاسبة)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">التنبيه الصوتي:</label>
                  <button
                    type="button"
                    onClick={() => handleUpdate('beepOnPrint', !printerConfig.beepOnPrint)}
                    className={`w-full text-xs p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      printerConfig.beepOnPrint
                        ? 'bg-blue-50 border-blue-600 text-blue-900'
                        : 'bg-slate-50 border-slate-300 text-slate-600'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{printerConfig.beepOnPrint ? 'الرنين الصوتي مفعل ✓' : 'صامت بدون رنين'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Interactive Live Thermal Receipt Preview (5 Cols) */}
        <div className="lg:col-span-5 p-4 sm:p-5 bg-slate-100 dark:bg-slate-900/60 flex flex-col items-center justify-start space-y-3">
          
          <div className="w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-500" />
              <span>معاينة حية ومباشرة لرول الفاتورة:</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">
              {printerConfig.paperWidth} ({printerConfig.printableWidthMm || 72}mm)
            </span>
          </div>

          {/* SIMULATED THERMAL PAPER RECEIPT CARD */}
          <div 
            className={`w-full ${previewWidthClass} bg-white text-black p-4 rounded-xl shadow-lg border border-slate-300 space-y-2 select-none transition-all duration-200`}
            style={{ 
              fontFamily: previewFontFamily,
              filter: printerConfig.printDensity === 'extradark' ? 'contrast(1.4)' : 'none',
              boxShadow: '0 4px 20px -2px rgba(0,0,0,0.15)'
            }}
          >
            {/* Top Cutter Edge Simulation */}
            <div className="border-t border-dashed border-slate-300 pb-1 -mt-1 text-[8px] text-center text-slate-400 font-mono">
              --- بداية رول الورق الحراري ---
            </div>

            {/* Store Logo */}
            {printerConfig.showLogo && settings.storeLogoUrl && (
              <img 
                src={settings.storeLogoUrl} 
                alt="Logo" 
                className="w-10 h-10 mx-auto object-contain rounded-md"
              />
            )}

            {/* Store Header */}
            {printerConfig.showHeaderName && (
              <div className="text-center font-black text-sm text-black">
                {settings.storeName || 'مركز سند للأجهزة الذكية'}
              </div>
            )}

            <div className="text-center text-[10px] font-bold text-slate-800">
              {printerConfig.customHeaderTitle || 'فاتورة مبيعات نقدية'}
            </div>

            {/* Contact info */}
            {printerConfig.showBranchAddress && (
              <div className="text-center text-[9px] text-slate-600 font-medium">
                {settings.address || 'صنعاء - شارع صخر'} | هاتف: {settings.phone || '777000000'}
              </div>
            )}

            {/* Tax number */}
            {printerConfig.showTaxNumber && (
              <div className="text-center text-[9px] font-mono border border-black p-0.5 rounded text-black font-bold">
                الرقم الضريبي: {printerConfig.taxNumber || '300123456700003'}
              </div>
            )}

            {/* Divider */}
            <div 
              className="my-1.5" 
              style={{ 
                borderBottom: printerConfig.tableBorderType === 'solid' ? '1.5px solid black' : (printerConfig.tableBorderType === 'dotted' ? '2px dotted #4b5563' : (printerConfig.tableBorderType === 'double' ? '3px double black' : '1.5px dashed #6b7280')) 
              }} 
            />

            {/* Metadata Rows */}
            <div className="space-y-0.5 text-[9.5px]">
              <div className="flex justify-between">
                <span className="text-slate-600">رقم الفاتورة:</span>
                <span className="font-mono font-bold">INV-1001-GP80</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">التاريخ:</span>
                <span className="font-mono">{new Date().toLocaleDateString('ar-YE')}</span>
              </div>
              {printerConfig.showCustomerInfo && (
                <div className="flex justify-between">
                  <span className="text-slate-600">العميل:</span>
                  <span className="font-bold">عميل نقدي / سفري</span>
                </div>
              )}
              {printerConfig.showCashierName && (
                <div className="flex justify-between">
                  <span className="text-slate-600">الكاشير:</span>
                  <span className="font-bold">أحمد الكاشير</span>
                </div>
              )}
              {printerConfig.showPaymentMethod && (
                <div className="flex justify-between">
                  <span className="text-slate-600">الدفع:</span>
                  <span className="font-bold text-emerald-800">نقدي (كاش)</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div 
              className="my-1.5" 
              style={{ 
                borderBottom: printerConfig.tableBorderType === 'solid' ? '1.5px solid black' : (printerConfig.tableBorderType === 'dotted' ? '2px dotted #4b5563' : (printerConfig.tableBorderType === 'double' ? '3px double black' : '1.5px dashed #6b7280')) 
              }} 
            />

            {/* Items Table */}
            <table className={`w-full text-right ${previewFontSizeClass} leading-tight`}>
              <thead>
                <tr className="border-b border-black font-black">
                  <th className="pb-1 text-right">السلعة</th>
                  <th className="pb-1 text-center">الكمية</th>
                  <th className="pb-1 text-left">المجموع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-300">
                <tr>
                  <td className="py-1">شاشة سامسونج A12 أصلية</td>
                  <td className="py-1 text-center font-mono font-bold">1</td>
                  <td className="py-1 text-left font-mono font-bold">8,500</td>
                </tr>
                <tr>
                  <td className="py-1">شاحن سريع أنكر 20W</td>
                  <td className="py-1 text-center font-mono font-bold">2</td>
                  <td className="py-1 text-left font-mono font-bold">3,000</td>
                </tr>
              </tbody>
            </table>

            {/* Divider */}
            <div 
              className="my-1.5" 
              style={{ 
                borderBottom: printerConfig.tableBorderType === 'solid' ? '1.5px solid black' : (printerConfig.tableBorderType === 'dotted' ? '2px dotted #4b5563' : (printerConfig.tableBorderType === 'double' ? '3px double black' : '1.5px dashed #6b7280')) 
              }} 
            />

            {/* Totals */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>المجموع:</span>
                <span className="font-mono font-bold">11,500 {settings.currency || 'ريال'}</span>
              </div>
              <div className="flex justify-between text-red-600 font-bold">
                <span>خصم خاص:</span>
                <span className="font-mono">- 500 {settings.currency || 'ريال'}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-black pt-1 border-t-2 border-black">
                <span>الصافي للتسديد:</span>
                <span className="font-mono text-sm">11,000 {settings.currency || 'ريال'}</span>
              </div>
            </div>

            {/* Barcode Simulator */}
            {printerConfig.showBarcode && previewBarcodeUrl && (
              <div className="pt-1 text-center">
                <img src={previewBarcodeUrl} alt="Barcode" className="max-w-[90%] mx-auto h-7 object-contain" />
              </div>
            )}

            {/* QR Code Simulator */}
            {printerConfig.showQrCode && (
              <div className="pt-1 text-center">
                <div className="inline-block p-1 bg-white border border-black rounded">
                  <div className="w-14 h-14 bg-slate-900 flex items-center justify-center text-white text-[8px] font-bold">
                    QR CODE
                  </div>
                </div>
              </div>
            )}

            {/* Return Policy */}
            {printerConfig.showReturnPolicy && (
              <div className="p-1.5 bg-slate-50 border border-dashed border-slate-300 rounded text-[8.5px] text-center text-slate-700 leading-tight">
                {printerConfig.customFooterNote || 'البضاعة المباعة لا تُرد ولا تُستبدل إلا بالفاتورة الأصلية.'}
              </div>
            )}

            {/* Greeting */}
            {printerConfig.footerGreeting && (
              <div className="text-center text-[9px] font-bold text-black pt-1">
                {printerConfig.footerGreeting}
              </div>
            )}

            {/* Simulated Feed Spacer & Cut Marker */}
            <div 
              className="w-full flex items-center justify-center border-t border-dashed border-red-400 text-red-500 font-mono text-[8px] py-1 bg-red-50/50 rounded mt-2"
              style={{ marginTop: `${Math.min(printerConfig.feedBeforeCutMm || 16, 20)}px` }}
            >
              ✂ موضع سكين القص الآلي (GP-U80300I Auto Cutter)
            </div>

          </div>

          <div className="w-full text-center">
            <button
              type="button"
              onClick={handleRunTestPrint}
              disabled={isTestPrinting}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>{isTestPrinting ? 'جاري طباعة التذكرة...' : '🖨️ طباعة تذكرة تجريبية الآن على GP-U80300I'}</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
