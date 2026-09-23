/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThermalPrinterSettings } from '../types';
import { safeStorage } from './safeStorage';

/**
 * 🖨️ الإعدادات الافتراضية القياسية المضبوطة بدقة لطابعة Gprinter GP-U80300I
 * المواصفات المعتمدة:
 * - عرض الورق: 80 مم (عرض الطباعة الفعلي: 72 مم / 576 نقطة)
 * - سرعة الطباعة: 300 مم/ثانية مع قاطع آلي للورق (Auto Cutter)
 * - خط عالي التباين والسواد لمنع البهتان في الإيصالات الحرارية السريعة
 * - تغذية مناسبة قبل القص (16 مم) لمنع بتر نص الخاتمة
 * - تفعيل القص التلقائي ودعم فتح درج الكاشير
 */
export const DEFAULT_GPU80300I_SETTINGS: ThermalPrinterSettings = {
  printerModel: 'GP-U80300I',
  paperWidth: '80mm',
  printableWidthMm: 72,
  fontScale: 'standard', // 11.5px
  fontFamily: 'cairo',
  numberFormat: 'latin', // 1234 (أرقام لاتينية واضحة لا تنقلب في طابعات البوس)
  printDensity: 'dark', // سواد غامق عالي التباين لطباعة سريعة وواضحة
  lineSpacing: 'standard',
  marginTopMm: 2,
  marginBottomMm: 4,
  feedBeforeCutMm: 16, // مسافة تغذية 16مم قبل سكين القص الآلي
  showLogo: true,
  showHeaderName: true,
  showBranchAddress: true,
  showPhone: true,
  showTaxNumber: false,
  taxNumber: '',
  customHeaderTitle: 'فاتورة مبيعات نقدية',
  showCashierName: true,
  showCustomerInfo: true,
  showPaymentMethod: true,
  tableBorderType: 'dashed',
  showQrCode: true,
  qrSize: 'standard',
  showBarcode: true,
  footerGreeting: 'سعدنا بخدمتكم وتفضلكم بزيارتنا الكريمة ❤️ طاب يومكم',
  showReturnPolicy: true,
  customFooterNote: 'البضاعة المباعة لا تُرد ولا تُستبدل إلا بالفاتورة وبحالتها الأصلية خلال المدة المحددة.',
  autoPrintOnSale: false,
  autoCutPaper: true,
  openCashDrawer: false,
  printCopies: 1,
  beepOnPrint: true,
  arabicFixMode: 'bold_crisp',
  escProfile: 'truetype', // خيار "استخدم خط TrueType" المفعل لمنع الرموز العشوائية
  useTrueTypeFont: true, // تفعيل خط TrueType (الطباعة المتصلة المانعة للرموز العشوائية)
  feedLinesCount: 2, // عدد الخطوط التي يتم تمريرها (2) كما في تطبيق RawBT
  enablePaperCut: true, // قص الورق
  directRawBTSupport: true, // دعم الإرسال المباشر لتطبيق RawBT
  printEnvironment: 'auto' // كشف تلقائي: وندوز/كمبيوتر يطبع مباشرة عبر المتصفح، وأندرويد يطبع عبر RawBT
};

export const DEFAULT_58MM_SETTINGS: ThermalPrinterSettings = {
  printerModel: 'portable-58mm',
  paperWidth: '58mm',
  printableWidthMm: 48,
  fontScale: 'small', // 10px
  fontFamily: 'cairo',
  numberFormat: 'latin',
  printDensity: 'dark',
  lineSpacing: 'compact',
  marginTopMm: 1,
  marginBottomMm: 2,
  feedBeforeCutMm: 10,
  showLogo: true,
  showHeaderName: true,
  showBranchAddress: true,
  showPhone: true,
  showTaxNumber: false,
  taxNumber: '',
  customHeaderTitle: 'فاتورة مبيعات',
  showCashierName: false,
  showCustomerInfo: true,
  showPaymentMethod: true,
  tableBorderType: 'dashed',
  showQrCode: true,
  qrSize: 'small',
  showBarcode: false,
  footerGreeting: 'شكراً لزيارتكم الكريمة!',
  showReturnPolicy: false,
  customFooterNote: 'يرجى إبراز السند عند المراجعة.',
  autoPrintOnSale: false,
  autoCutPaper: false,
  openCashDrawer: false,
  printCopies: 1,
  beepOnPrint: false,
  arabicFixMode: 'bold_crisp',
  escProfile: 'truetype',
  useTrueTypeFont: true,
  feedLinesCount: 2,
  enablePaperCut: false,
  directRawBTSupport: true,
  printEnvironment: 'auto'
};

export const DEFAULT_STANDARD_80MM_SETTINGS: ThermalPrinterSettings = {
  ...DEFAULT_GPU80300I_SETTINGS,
  printerModel: 'standard-80mm',
  feedBeforeCutMm: 14
};

const STORAGE_KEY = 'sanad_thermal_printer_settings';

/**
 * استرجاع إعدادات الطابعة الحرارية المخزنة أو الإعدادات الافتراضية لطابعة GP-U80300I
 */
export function loadThermalPrinterSettings(): ThermalPrinterSettings {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_GPU80300I_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Error loading printer settings from storage:', e);
  }
  return { ...DEFAULT_GPU80300I_SETTINGS };
}

/**
 * حفظ إعدادات الطابعة الحرارية في التخزين المحلي الآمن
 */
export function saveThermalPrinterSettings(settings: ThermalPrinterSettings): void {
  try {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // مزامنة حالة الطباعة المباشرة مع auto_direct_print
    safeStorage.setItem('auto_direct_print', settings.autoPrintOnSale ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('printer_settings_updated', { detail: settings }));
  } catch (e) {
    console.error('Error saving printer settings:', e);
  }
}

/**
 * فحص ما إذا كان العميل الحالي يعمل على جهاز أندرويد
 */
export function isAndroidClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

/**
 * تحديد ما إذا كان يجب التوجيه لتطبيق RawBT أو الطباعة المباشرة عبر كمبيوتر / وندوز
 */
export function shouldRouteToRawBT(settings?: ThermalPrinterSettings): boolean {
  const currentSettings = settings || loadThermalPrinterSettings();
  const env = currentSettings.printEnvironment || 'auto';

  // إذا تم اختيار كمبيوتر صراحةً، لا يتم استدعاء RawBT أبداً
  if (env === 'pc') {
    return false;
  }

  // إذا تم اختيار أندرويد RawBT صراحةً
  if (env === 'android_rawbt') {
    return true;
  }

  // في الوضع التلقائي 'auto':
  // التوجيه لـ RawBT فقط إذا كان الجهاز فعلياً أندرويد ودعم RawBT مفعل
  return isAndroidClient() && (currentSettings.directRawBTSupport !== false);
}
