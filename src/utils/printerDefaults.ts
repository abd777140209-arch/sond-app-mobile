/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  PrinterSettings, 
  SystemSettings, 
  InvoiceFontFamily, 
  InvoiceFontWeight, 
  InvoiceFontSizeScale, 
  InvoiceLineHeight 
} from '../types';
import { safeStorage } from './safeStorage';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  // الاتصال ونوع الطابعة
  connectionType: 'browser',
  printerName: 'طابعة الإيصالات الحرارية الافتراضية',
  ipAddress: '192.168.1.100',
  port: 9100,
  bluetoothDeviceName: 'POS-80 Bluetooth Printer',

  // قياس الورق والخصائص
  paperSize: '80mm',
  copiesCount: 1,
  printDensity: 'normal',
  pageMargin: 'normal',
  autoPrintOnSale: false,
  autoCutPaper: true,
  openCashDrawer: false,
  beepOnPrint: true,

  // شكل ونمط وتصميم الفاتورة والمستندات
  templateStyle: 'modern',
  primaryColor: '#0f172a',
  invoiceTitle: 'فاتورة مبيعات نقدية',
  invoiceSubtitle: 'للأجهزة الذكية والصيانة والبرمجة',
  taxNumber: '',
  commercialRegistration: '',

  // تخصيص نوع وسماكة ولون الخطوط
  fontFamily: 'cairo',
  fontColor: '#000000',
  headerFontColor: '#0f172a',
  fontWeight: 'bold',
  fontSizeScale: 'normal',
  lineHeight: 'normal',

  // إظهار وإخفاء الحقول
  showLogo: true,
  logoPosition: 'center',
  logoSize: 'medium',
  showHeaderAddress: true,
  showHeaderPhone: true,
  showCashierName: true,
  showCustomerName: true,
  showCustomerPhone: true,
  showCustomerBalance: true,
  showPaymentMethod: true,
  showItemCodeBarcode: false,
  showUnitPrice: true,
  showItemDiscount: true,
  codeType: 'qr',
  showTaxRow: false,
  taxRate: 0,
  showFooterPolicy: true,
  footerPolicyNote: 'البضاعة المباعة لا تُرد ولا تُستبدل إلا بالوصل وشروط الضمان المعتمدة. شكراً لتعاملكم معنا.',
  footerGreeting: 'سعدنا بزيارتكم الكريمة ❤️ طاب يومكم',
  showSignatureBox: false,
  showDevCredits: true
};

export const sanitizePrinterSettings = (cfg: PrinterSettings): PrinterSettings => {
  const clean = { ...cfg };
  if (clean.invoiceTitle) {
    clean.invoiceTitle = clean.invoiceTitle
      .replace(/فاتورة\s*ضريبية\s*معتمدة/g, 'فاتورة مبيعات')
      .replace(/ضريبية\s*معتمدة|ضريبة\s*معتمدة/g, 'مبيعات رسمية')
      .trim();
    if (!clean.invoiceTitle) {
      clean.invoiceTitle = 'فاتورة مبيعات';
    }
  }
  // Disable tax row and clear tax rate to delete tax text under invoice
  clean.showTaxRow = false;
  clean.taxRate = 0;
  if (clean.footerPolicyNote && (
    clean.footerPolicyNote.includes('مطابقاً للأنظمة واللوائح التجارية') ||
    clean.footerPolicyNote.includes('ضريب')
  )) {
    clean.footerPolicyNote = 'البضاعة المباعة لا تُرد ولا تُستبدل إلا بالوصل وشروط الضمان. شكراً لتعاملكم معنا.';
  }
  return clean;
};

export const getEffectivePrinterSettings = (settings?: SystemSettings): PrinterSettings => {
  let effective: PrinterSettings = { ...DEFAULT_PRINTER_SETTINGS };

  if (settings?.printerSettings) {
    effective = { ...DEFAULT_PRINTER_SETTINGS, ...settings.printerSettings };
  } else {
    const saved = safeStorage.getItem('smart_accounting_printer_settings');
    if (saved) {
      try {
        effective = { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('Failed parsing saved printer settings:', e);
      }
    }
  }

  return sanitizePrinterSettings(effective);
};

export const savePrinterSettingsLocally = (printerSettings: PrinterSettings): void => {
  const sanitized = sanitizePrinterSettings(printerSettings);
  safeStorage.setItem('smart_accounting_printer_settings', JSON.stringify(sanitized));
  safeStorage.setItem('auto_direct_print', sanitized.autoPrintOnSale ? 'true' : 'false');
  safeStorage.setItem('sanad_invoice_footer_note', sanitized.footerPolicyNote || '');
  window.dispatchEvent(new CustomEvent('printer_settings_updated', { detail: sanitized }));
};

export interface QuickPreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  icon: string;
  settings: Partial<PrinterSettings>;
}

export const QUICK_INVOICE_PRESETS: QuickPreset[] = [
  {
    id: 'mobile_shop',
    name: 'محلات الهواتف والصيانة الذكية',
    description: 'ورق حراري 80 ملم، كود QR فوري، شروط الضمان وسياسة استلام وصيانة الأجهزة',
    badge: 'الأكثر شعبية 📱',
    icon: 'Smartphone',
    settings: {
      paperSize: '80mm',
      templateStyle: 'modern',
      connectionType: 'browser',
      invoiceTitle: 'فاتورة مبيعات وضمان أجهزة',
      invoiceSubtitle: 'صيانة وبرمجة وقطع غيار الهواتف الذكية',
      showLogo: true,
      logoPosition: 'center',
      showCashierName: true,
      showCustomerName: true,
      showCustomerPhone: true,
      showCustomerBalance: true,
      codeType: 'qr',
      showFooterPolicy: true,
      footerPolicyNote: 'الضمان ساري مع إحضار أصل الفاتورة. المحل غير مسؤول عن الأجهزة المتروكة لأكثر من 30 يوماً.',
      footerGreeting: 'سعدنا بخدمتكم وتسهيل تعاملكم ❤️ طاب يومكم',
      showSignatureBox: false,
      showDevCredits: true
    }
  },
  {
    id: 'supermarket',
    name: 'سوبرماركت ومواد غذائية (POS سريع)',
    description: 'ورق حراري 80 ملم، مدمج وسريع، قطع آلي للورق، باركود السلعة، إظهار الكاشير والوقت بالثواني',
    badge: 'سريع واقتصادي 🛒',
    icon: 'ShoppingCart',
    settings: {
      paperSize: '80mm',
      templateStyle: 'classic',
      connectionType: 'browser',
      invoiceTitle: 'إيصال مبيعات كاشير',
      invoiceSubtitle: 'تجارة المواد الغذائية والاستهلاكية',
      showLogo: false,
      logoPosition: 'center',
      showCashierName: true,
      showCustomerName: false,
      showCustomerPhone: false,
      showCustomerBalance: false,
      showItemCodeBarcode: true,
      codeType: 'barcode',
      autoCutPaper: true,
      openCashDrawer: true,
      showFooterPolicy: true,
      footerPolicyNote: 'شكراً لزيارتكم! يرجى مراجعة البضاعة والمتبقي قبل مغادرة الصندوق.',
      footerGreeting: 'نسعد بزيارتكم دائماً 🛍️',
      showSignatureBox: false,
      showDevCredits: false
    }
  },
  {
    id: 'corporate_a4',
    name: 'فواتير رسمية وشركات (قياس A4)',
    description: 'ورق كامل A4 للمؤسسات والشركات، جدول مؤطر فاخر، ومساحة مخصصة للختم والتوقيع',
    badge: 'معتمد ورسمي 📄',
    icon: 'Building2',
    settings: {
      paperSize: 'a4',
      templateStyle: 'official',
      connectionType: 'browser',
      invoiceTitle: 'فاتورة مبيعات رسمية',
      invoiceSubtitle: 'توريدات وخدمات تجارية عامة',
      showLogo: true,
      logoPosition: 'right',
      showCashierName: true,
      showCustomerName: true,
      showCustomerPhone: true,
      showCustomerBalance: true,
      codeType: 'both',
      showTaxRow: false,
      taxRate: 0,
      showFooterPolicy: true,
      footerPolicyNote: 'البضاعة المباعة لا تُرد ولا تُستبدل إلا بالفاتورة وشروط الضمان. شكراً لتعاملكم معنا.',
      footerGreeting: 'شاكرين لكم حسن التعاون ونسعد بشراكتكم الدائمة',
      showSignatureBox: true,
      showDevCredits: true
    }
  },
  {
    id: 'portable_58',
    name: 'طابعة بلوتوث متنقلة (58 ملم)',
    description: 'مخصصة لطابعات البلوتوث المحمولة الصغيرة بحجم 58 ملم للمناديب والمبيعات الميدانية',
    badge: 'طابعة جيب بلوتوث 📲',
    icon: 'Bluetooth',
    settings: {
      paperSize: '58mm',
      templateStyle: 'minimal',
      connectionType: 'bluetooth',
      invoiceTitle: 'سند مبيعات ميداني',
      invoiceSubtitle: 'مبيعات وتوزيع',
      showLogo: false,
      showCashierName: true,
      showCustomerName: true,
      showCustomerPhone: false,
      showCustomerBalance: true,
      codeType: 'qr',
      showFooterPolicy: false,
      footerGreeting: 'شكراً لكم 🌸',
      showSignatureBox: false,
      showDevCredits: false
    }
  }
];

export interface InvoiceFontOption {
  id: InvoiceFontFamily;
  name: string;
  nameEn: string;
  fontFamilyCss: string;
  previewSample: string;
  badge: string;
  category: string;
}

export const INVOICE_FONTS: InvoiceFontOption[] = [
  {
    id: 'cairo',
    name: 'خط كايرو العصري (Cairo)',
    nameEn: 'Cairo',
    fontFamilyCss: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
    previewSample: 'فاتورة مبيعات 123.45',
    badge: 'الافتراضي الموصى به ⭐',
    category: 'عصري وحديث'
  },
  {
    id: 'tajawal',
    name: 'خط تجوال الأنيق (Tajawal)',
    nameEn: 'Tajawal',
    fontFamilyCss: "'Tajawal', 'Cairo', sans-serif",
    previewSample: 'تصميم أنيق وواضح جداً 123.45',
    badge: 'أنيق وعصري ✨',
    category: 'عصري وحديث'
  },
  {
    id: 'almarai',
    name: 'خط المراعي السلس (Almarai)',
    nameEn: 'Almarai',
    fontFamilyCss: "'Almarai', 'Cairo', sans-serif",
    previewSample: 'خط مريح وسهل القراءة 123.45',
    badge: 'مقروء ونقي 📖',
    category: 'عصري وحديث'
  },
  {
    id: 'alexandria',
    name: 'خط الإسكندرية الهندسي (Alexandria)',
    nameEn: 'Alexandria',
    fontFamilyCss: "'Alexandria', 'Cairo', sans-serif",
    previewSample: 'طابع هندسي جذاب 123.45',
    badge: 'هندسي وجريء 💎',
    category: 'عصري وحديث'
  },
  {
    id: 'ibm_plex',
    name: 'خط آي بي إم بلكس التقني (IBM Plex)',
    nameEn: 'IBM Plex Sans Arabic',
    fontFamilyCss: "'IBM Plex Sans Arabic', 'Cairo', sans-serif",
    previewSample: 'فواتير تقنية رسمية 123.45',
    badge: 'رسمي وتقني 🏢',
    category: 'رسمي وتقني'
  },
  {
    id: 'changa',
    name: 'خط تشانجا العريض والبارز (Changa)',
    nameEn: 'Changa',
    fontFamilyCss: "'Changa', 'Cairo', sans-serif",
    previewSample: 'خط بارز وقوي الحضور 123.45',
    badge: 'عريض وبارز للطابعات 🖨️',
    category: 'طابعات وكاشير'
  },
  {
    id: 'amiri',
    name: 'خط أميري النسخي الملكي (Amiri)',
    nameEn: 'Amiri',
    fontFamilyCss: "'Amiri', 'Traditional Arabic', serif",
    previewSample: 'طابع كلاسيكي تراثي 123.45',
    badge: 'تراثي ورسمي 📜',
    category: 'كلاسيكي'
  },
  {
    id: 'tahoma',
    name: 'خط تاهوما الكلاسيكي POS (Tahoma)',
    nameEn: 'Tahoma',
    fontFamilyCss: "Tahoma, 'Segoe UI', Geneva, sans-serif",
    previewSample: 'خط نظام كاشير سريع وثابت 123.45',
    badge: 'الأسرع طباعة ⚡',
    category: 'طابعات وكاشير'
  },
  {
    id: 'monospace',
    name: 'خط نقطي كاشير (Monospace / JetBrains)',
    nameEn: 'Monospace',
    fontFamilyCss: "'JetBrains Mono', 'Courier New', Courier, monospace",
    previewSample: 'إيصال نقطي كاشير #123.45',
    badge: 'طابعات نقطية 📟',
    category: 'طابعات وكاشير'
  }
];

export const INVOICE_FONT_WEIGHTS: { id: InvoiceFontWeight; label: string; cssWeight: number; desc: string }[] = [
  { id: 'normal', label: 'عادي (Medium 500)', cssWeight: 500, desc: 'خط قياسي متوازن' },
  { id: 'medium', label: 'شبه عريض (Semi-Bold 600)', cssWeight: 600, desc: 'أكثر وضوحاً على الشاشة والورق' },
  { id: 'bold', label: 'عريض بارز (Bold 700)', cssWeight: 700, desc: 'الموصى به للطابعات الحرارية لمنع البهتان' },
  { id: 'heavy', label: 'سميك جداً داكن (Black 800/900)', cssWeight: 900, desc: 'أقصى درجة وضوح وسواد على الإطلاق' }
];

export const INVOICE_FONT_SIZE_SCALES: { id: InvoiceFontSizeScale; label: string; multiplier: number; desc: string }[] = [
  { id: 'compact', label: 'مضغوط (90%)', multiplier: 0.9, desc: 'يقلل استهلاك الورق ويوفر مساحة' },
  { id: 'normal', label: 'قياسي متوازن (100%)', multiplier: 1.0, desc: 'الحجم الافتراضي المتناسق لجميع الفواتير' },
  { id: 'large', label: 'كبير وواضح (115%)', multiplier: 1.15, desc: 'قراءة مريحة جداً وممتازة للزبائن' },
  { id: 'xlarge', label: 'ضخم ومقروء (130%)', multiplier: 1.3, desc: 'حجم بارز جداً ومناسب للرؤية السريعة' }
];

export const INVOICE_LINE_HEIGHTS: { id: InvoiceLineHeight; label: string; value: number; desc: string }[] = [
  { id: 'compact', label: 'متراص (1.25)', value: 1.25, desc: 'تقليص طول الورقة الحرارية' },
  { id: 'normal', label: 'متوازن (1.45)', value: 1.45, desc: 'الارتفاع الطبيعي المثالي' },
  { id: 'relaxed', label: 'متباعد (1.65)', value: 1.65, desc: 'مسافات واسعة ومريحة بين الأسطر' }
];

export const INVOICE_FONT_COLORS = [
  { color: '#000000', name: 'أسود حالك (الأفضل للطابعات الحرارية)' },
  { color: '#0f172a', name: 'كحلي داكن فاخر (Midnight Slate)' },
  { color: '#1e293b', name: 'رمادي فحمي عميق (Charcoal)' },
  { color: '#1e3a8a', name: 'أزرق ملكي كحلي (Royal Navy)' },
  { color: '#064e3b', name: 'أخضر زمردي داكن (Emerald Dark)' },
  { color: '#451a03', name: 'بني عسلي داكن (Dark Amber)' },
  { color: '#881337', name: 'عنابي داكن ملكي (Deep Rose)' }
];

export const getFontFamilyCss = (family?: InvoiceFontFamily): string => {
  const match = INVOICE_FONTS.find(f => f.id === family);
  return match ? match.fontFamilyCss : "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";
};

export const getFontWeightCss = (weight?: InvoiceFontWeight): number => {
  switch (weight) {
    case 'normal': return 500;
    case 'medium': return 600;
    case 'bold': return 700;
    case 'heavy': return 900;
    default: return 700;
  }
};

export const getFontSizeMultiplier = (scale?: InvoiceFontSizeScale): number => {
  switch (scale) {
    case 'compact': return 0.9;
    case 'normal': return 1.0;
    case 'large': return 1.15;
    case 'xlarge': return 1.3;
    default: return 1.0;
  }
};

export const getLineHeightCss = (lh?: InvoiceLineHeight): number => {
  switch (lh) {
    case 'compact': return 1.25;
    case 'normal': return 1.45;
    case 'relaxed': return 1.65;
    default: return 1.45;
  }
};

