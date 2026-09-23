/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 🖨️ ESC/POS Raw Commands Engine & Browser WebUSB/WebSerial Utility
 * دالة ومحرك متكامل لتحويل مخرجات الفواتير إلى أوامر ESC/POS الخام (Raw Commands)
 * وإرسالها مباشرة من متصفح الكمبيوتر (Chrome / Edge) إلى طابعة الإيصالات الحرارية.
 */

import html2canvas from 'html2canvas';
import { SalesInvoicePrintData, buildSalesInvoiceThermalHTML, generateInvoiceQrPng } from './ReceiptPrinter';
import { loadThermalPrinterSettings } from '../utils/printerConfig';
import { ThermalPrinterSettings } from '../types';
import { getSafeHtml2CanvasOptions } from '../utils/pdfHelper';

// ثوابت أوامر ESC/POS القياسية
export const ESC = 0x1B;
export const FS = 0x1C;
export const GS = 0x1D;
export const DLE = 0x10;

export interface EscPosOptions {
  mode?: 'raster' | 'text' | 'auto'; // 'raster' لضمان الحروف العربية 100% أو 'text' للأوامر النصية
  paperSize?: '80mm' | '58mm';
  cutPaper?: boolean;
  openDrawer?: boolean;
  beep?: boolean;
  feedLines?: number;
  threshold?: number; // حساسية اللون الأسود في Raster (افتراضي: 160)
  codepage?: number; // 71 = Windows-1256, 28 = CP864
}

/**
 * فئة تجميع وإعداد أوامر ESC/POS الثنائية (Binary Command Builder)
 */
export class EscPosBuilder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  /**
   * تهيئة الطابعة وإعادة تعيين الإعدادات للافتراضي: ESC @
   */
  init(): this {
    this.buffer.push(ESC, 0x40);
    return this;
  }

  /**
   * إرسال بايتات خام مباشرة
   */
  raw(bytes: number[] | Uint8Array): this {
    if (bytes instanceof Uint8Array) {
      for (let i = 0; i < bytes.length; i++) {
        this.buffer.push(bytes[i]);
      }
    } else {
      this.buffer.push(...bytes);
    }
    return this;
  }

  /**
   * محاذاة النص: ESC a n (0: يسار، 1: وسط، 2: يمين)
   */
  align(alignment: 'left' | 'center' | 'right'): this {
    const val = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(ESC, 0x61, val);
    return this;
  }

  /**
   * تعيين الخط الغامق (Bold): ESC E n
   */
  bold(enable: boolean = true): this {
    this.buffer.push(ESC, 0x45, enable ? 1 : 0);
    return this;
  }

  /**
   * خط تحتي (Underline): ESC - n
   */
  underline(enable: boolean = true): this {
    this.buffer.push(ESC, 0x2D, enable ? 1 : 0);
    return this;
  }

  /**
   * حجم الخط: GS ! n
   */
  fontSize(size: 'normal' | 'double_height' | 'double_width' | 'double_both'): this {
    let val = 0x00;
    if (size === 'double_height') val = 0x01;
    else if (size === 'double_width') val = 0x10;
    else if (size === 'double_both') val = 0x11;
    this.buffer.push(GS, 0x21, val);
    return this;
  }

  /**
   * تعيين جدول الأحرف (Code Table): ESC t n
   */
  codepage(cp: number = 71): this {
    this.buffer.push(ESC, 0x74, cp);
    return this;
  }

  /**
   * سطر جديد وتغذية: LF
   */
  feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0A);
    }
    return this;
  }

  /**
   * كتابة نص بصيغة UTF-8 أو ASCII
   */
  text(str: string): this {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    for (let i = 0; i < encoded.length; i++) {
      this.buffer.push(encoded[i]);
    }
    return this;
  }

  /**
   * طباعة سطر نصي مع الانتقال لسطر جديد
   */
  textLine(str: string): this {
    this.text(str);
    this.feed(1);
    return this;
  }

  /**
   * طباعة خط فاصل أفقي
   */
  separator(char: string = '-', length: number = 42): this {
    const line = char.repeat(length);
    this.textLine(line);
    return this;
  }

  /**
   * فتح درج النقود (Cash Drawer Kick): ESC p m t1 t2
   */
  openCashDrawer(): this {
    this.buffer.push(ESC, 0x70, 0x00, 0x19, 0xFA);
    return this;
  }

  /**
   * تشغيل جرس التنبيه (Beep / Buzzer): ESC B n t
   */
  beep(count: number = 1): this {
    this.buffer.push(ESC, 0x42, Math.min(count, 9), 0x02);
    return this;
  }

  /**
   * قص الورق جزئياً مع تغذية مسافة أمان: GS V B n
   */
  cutPaper(full: boolean = false, feedDots: number = 24): this {
    if (full) {
      this.buffer.push(GS, 0x56, 0x00);
    } else {
      this.buffer.push(GS, 0x56, 0x42, feedDots);
    }
    return this;
  }

  /**
   * طباعة باركود Code 128 القياسي: GS k 73 len data
   */
  barcode128(content: string, height: number = 48): this {
    this.buffer.push(GS, 0x68, Math.min(height, 255)); // ارتفاع الباركود
    this.buffer.push(GS, 0x77, 2); // عرض الخطوط
    this.buffer.push(GS, 0x48, 2); // مكان ظهور النص أسفل الباركود
    this.buffer.push(GS, 0x6B, 73, content.length); // نوع Code 128
    for (let i = 0; i < content.length; i++) {
      this.buffer.push(content.charCodeAt(i));
    }
    return this;
  }

  /**
   * طباعة رمز الاستجابة السريعة QR Code بأمر ESC/POS المباشر: GS ( k
   */
  qrCode(content: string, moduleSize: number = 5): this {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const storeLen = data.length + 3;
    const pL = storeLen & 0xFF;
    const pH = (storeLen >> 8) & 0xFF;

    // 1. Model: QR Code Model 2
    this.buffer.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Size: moduleSize (عادة 4 إلى 8)
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, Math.min(Math.max(moduleSize, 1), 16));
    // 3. Error correction: Level M (49)
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31);
    // 4. Store the data in symbol storage area
    this.buffer.push(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data[i]);
    }
    // 5. Print the symbol data
    this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);

    return this;
  }

  /**
   * تحويل صورة Canvas مباشرة إلى صورة نقطية حرارية بصيغة ESC/POS Raster Bit Image: GS v 0
   * هذه الطريقة هي الأكثر كفاءة وموثوقية في العالم للغات المعقدة كالعربية،
   * حيث تضمن طباعة الحروف العربية متصلة 100% كخطوط TrueType دون الحاجة لتعريفات طابعة أو خطوط صينية مسبقة.
   */
  rasterImage(canvas: HTMLCanvasElement, threshold: number = 160): this {
    const ctx = canvas.getContext('2d');
    if (!ctx) return this;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const rgba = imgData.data;

    // عدد البايتات أفقياً (كل 8 بيكسل = 1 بايت)
    const widthBytes = Math.ceil(width / 8);
    const xL = widthBytes & 0xFF;
    const xH = (widthBytes >> 8) & 0xFF;
    const yL = height & 0xFF;
    const yH = (height >> 8) & 0xFF;

    // رأس أمر GS v 0 m xL xH yL yH
    // m = 0 (Normal density)
    this.buffer.push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    for (let y = 0; y < height; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byteVal = 0;
        for (let b = 0; b < 8; b++) {
          const x = xByte * 8 + b;
          if (x < width) {
            const idx = (y * width + x) * 4;
            const r = rgba[idx];
            const g = rgba[idx + 1];
            const bVal = rgba[idx + 2];
            const a = rgba[idx + 3];

            // حساب الإضاءة (Luminance)
            // إذا كانت الشفافية عالية اعتبرها بيضاء
            if (a > 30) {
              const luminance = (0.299 * r) + (0.587 * g) + (0.114 * bVal);
              // البيكسل الأسود يمثل بالبت 1
              if (luminance < threshold) {
                byteVal |= (1 << (7 - b));
              }
            }
          }
        }
        this.buffer.push(byteVal);
      }
    }

    return this;
  }

  /**
   * استخراج البايتات كـ Uint8Array جاهز للإرسال المباشر
   */
  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * استخراج مصفوفة الأرقام
   */
  getBuffer(): number[] {
    return this.buffer;
  }
}

/**
 * 1. دالة مساعدة رئيسية: تحويل مخرجات الفاتورة الحالية إلى أوامر ESC/POS الخام (Raw Commands)
 * تستقبل بيانات الفاتورة وتنتج مصفوفة Uint8Array تحوي أوامر ESC/POS جاهزة
 * بنمط الرسوم النقطية الفائقة (Raster Bit-Image GS v 0) لضمان اتصال الحروف العربية وظهور اللوجو والباركود والكود الذكي بدقة تامة.
 */
export const convertInvoiceToEscPos = async (
  invoiceData: SalesInvoicePrintData,
  shopName: string = 'سند للمحاسبة والخدمات',
  currency: string = 'ريال',
  options: EscPosOptions = {}
): Promise<Uint8Array> => {
  const pSettings: ThermalPrinterSettings = invoiceData.printerSettings || loadThermalPrinterSettings();
  const is58 = (options.paperSize || invoiceData.paperSize || pSettings.paperWidth) === '58mm';
  
  // نقاط رأس الطباعة الفعلي (576 نقطة لـ 80mm أو 384 نقطة لـ 58mm)
  const targetDotsWidth = is58 ? 384 : 576;
  const builder = new EscPosBuilder();

  // 1. فتح درج النقود أولاً إذا كان مفعلاً
  if (options.openDrawer ?? pSettings.openCashDrawer) {
    builder.openCashDrawer();
  }

  // 2. إصدار تنبيه صوتي إذا كان مفعلاً
  if (options.beep ?? pSettings.beepOnPrint) {
    builder.beep(1);
  }

  let qrPng = '';
  try {
    qrPng = await generateInvoiceQrPng(invoiceData, shopName, currency);
  } catch (e) {
    qrPng = invoiceData.qrCodeUrl || '';
  }

  // إنشاء عنصر DOM مؤقت لرسم الفاتورة بأعلى دقة
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'fixed';
  tempContainer.style.left = '-10000px';
  tempContainer.style.top = '0';
  tempContainer.style.width = `${targetDotsWidth}px`;
  tempContainer.style.maxWidth = `${targetDotsWidth}px`;
  tempContainer.style.background = '#ffffff';
  tempContainer.style.color = '#000000';
  tempContainer.style.padding = is58 ? '8px 6px 16px 6px' : '12px 14px 24px 14px';
  tempContainer.style.boxSizing = 'border-box';
  tempContainer.style.direction = 'rtl';
  tempContainer.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";
  tempContainer.innerHTML = buildSalesInvoiceThermalHTML(shopName, invoiceData, currency, qrPng);

  document.body.appendChild(tempContainer);

  try {
    // انتظار تحميل كافة الصور
    const images = Array.from(tempContainer.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // تحويل الـ HTML إلى Canvas
    const canvas = await html2canvas(tempContainer, getSafeHtml2CanvasOptions({
      scale: 1,
      useCORS: true,
      backgroundColor: '#ffffff'
    }));

    // إضافة صورة الفاتورة النقطية بأمر GS v 0
    builder.align('center');
    builder.rasterImage(canvas, options.threshold || 160);

    // تغذية أسطر الأمان قبل القص
    const feedLines = options.feedLines ?? pSettings.feedLinesCount ?? 4;
    builder.feed(feedLines);

    // أمر قص الورق إذا كان مفعلاً
    if (options.cutPaper ?? pSettings.enablePaperCut ?? pSettings.autoCutPaper ?? true) {
      builder.cutPaper(false, 24);
    }

    return builder.toUint8Array();
  } finally {
    if (document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }
  }
};

/**
 * 2. دالة مساعدة لتحويل أي عنصر Canvas مباشرة إلى أوامر ESC/POS خام
 */
export const convertCanvasToEscPos = (
  canvas: HTMLCanvasElement,
  options: { cutPaper?: boolean; openDrawer?: boolean; feedLines?: number; threshold?: number } = {}
): Uint8Array => {
  const builder = new EscPosBuilder();
  if (options.openDrawer) {
    builder.openCashDrawer();
  }
  builder.align('center');
  builder.rasterImage(canvas, options.threshold || 160);
  builder.feed(options.feedLines ?? 3);
  if (options.cutPaper ?? true) {
    builder.cutPaper(false, 24);
  }
  return builder.toUint8Array();
};

export interface DeviceSupportInfo {
  webUsb: boolean;
  webSerial: boolean;
  isIframe: boolean;
  isPolicyBlocked: boolean;
}

/**
 * 3. دالة فحص اتصال متصفح الكمبيوتر ببروتوكولات الأجهزة (WebUSB / WebSerial)
 */
export const checkBrowserDeviceSupport = (): DeviceSupportInfo => {
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  let webUsb = typeof navigator !== 'undefined' && 'usb' in navigator;
  let webSerial = typeof navigator !== 'undefined' && 'serial' in navigator;
  let isPolicyBlocked = false;

  // فحص سياسة الأمان (Permissions Policy / Feature Policy) إذا كانت مدعومة في المتصفح
  if (typeof document !== 'undefined') {
    const docAny = document as any;
    if (docAny?.permissionsPolicy && typeof docAny.permissionsPolicy.allowsFeature === 'function') {
      try {
        if (!docAny.permissionsPolicy.allowsFeature('usb')) {
          webUsb = false;
          isPolicyBlocked = true;
        }
        if (!docAny.permissionsPolicy.allowsFeature('serial')) {
          webSerial = false;
          isPolicyBlocked = true;
        }
      } catch {
        // تجاهل آمن
      }
    }
  }

  return {
    webUsb,
    webSerial,
    isIframe,
    isPolicyBlocked
  };
};

/**
 * 4. إرسال أوامر ESC/POS الخام مباشرة عبر منفذ USB بواسطة تقنية WebUSB في متصفح الكمبيوتر (Chrome / Edge)
 * تتصل مباشرة بطابعة الإيصالات الحرارية المتصلة بكابل USB
 */
export const sendEscPosViaWebUsb = async (
  rawCommands: Uint8Array
): Promise<{ success: boolean; message: string; isPermissionsPolicyBlocked?: boolean }> => {
  const navAny = navigator as any;
  if (!navAny?.usb) {
    return {
      success: false,
      message: 'متصفحك الحالي لا يدعم WebUSB. يرجى استخدام Google Chrome أو Microsoft Edge على الكمبيوتر.'
    };
  }

  // التحقق المسبق من سياسة الأمان لمنع استثناء SecurityError
  if (typeof document !== 'undefined') {
    const docAny = document as any;
    if (docAny?.permissionsPolicy && typeof docAny.permissionsPolicy.allowsFeature === 'function') {
      try {
        if (!docAny.permissionsPolicy.allowsFeature('usb')) {
          return {
            success: false,
            isPermissionsPolicyBlocked: true,
            message: 'الوصول المباشر لمنفذ USB مقيد داخل إطار المعاينة (Permissions Policy). يرجى استخدام خيار "طباعة (وندوز)" المباشر.'
          };
        }
      } catch {
        // متابعة
      }
    }
  }

  try {
    // طلب اختيار الطابعة من المستخدم عبر نافذة المتصفح الرسمية
    // معظم طابعات الإيصالات تتبع فئة Printers (Class 0x07) أو Vendor Specific (Class 0xFF)
    const device = await navAny.usb.requestDevice({
      filters: [] // السماح باختيار أي جهاز USB متصل
    });

    if (!device) {
      return { success: false, message: 'لم يتم تحديد أي جهاز USB.' };
    }

    await device.open();

    // اختيار الإعداد الأساسي
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // البحث عن واجهة الطابعة ونقطة الخروج (OUT Endpoint)
    let targetInterfaceNumber = 0;
    let targetEndpointNumber = 1;
    let foundOutEndpoint = false;

    for (const conf of device.configurations) {
      for (const iface of conf.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'out') {
              targetInterfaceNumber = iface.interfaceNumber;
              targetEndpointNumber = ep.endpointNumber;
              foundOutEndpoint = true;
              break;
            }
          }
          if (foundOutEndpoint) break;
        }
        if (foundOutEndpoint) break;
      }
      if (foundOutEndpoint) break;
    }

    // حجز الواجهة
    await device.claimInterface(targetInterfaceNumber);

    // إرسال البيانات كحزم لتجنب تجاوز حد الـ Buffer (حزم 1024 بايت)
    const chunkSize = 1024;
    for (let offset = 0; offset < rawCommands.length; offset += chunkSize) {
      const slice = rawCommands.slice(offset, offset + chunkSize);
      await device.transferOut(targetEndpointNumber, slice);
    }

    // إغلاق الاتصال بعد الانتهاء
    try {
      await device.releaseInterface(targetInterfaceNumber);
      await device.close();
    } catch (e) {
      // safe ignore
    }

    return {
      success: true,
      message: 'تم إرسال أوامر ESC/POS بنجاح إلى طابعة USB مباشرة!'
    };
  } catch (error: any) {
    const errText = String(error?.message || error || '');
    if (error?.name === 'SecurityError' || errText.includes('permissions policy') || errText.includes('disallowed')) {
      return {
        success: false,
        isPermissionsPolicyBlocked: true,
        message: 'منفذ USB مقيد داخل إطار المعاينة الحالي (Permissions Policy). يرجى استخدام زر "طباعة (وندوز)" المباشر أو فتح التطبيق في نافذة مستقلة.'
      };
    }
    if (error?.name === 'NotFoundError') {
      return { success: false, message: 'تم إلغاء تحديد الطابعة من قبل المستخدم.' };
    }
    console.warn('WebUSB connection notice:', error);
    return {
      success: false,
      message: `تعذر الاتصال بطابعة USB: ${error?.message || error}`
    };
  }
};

/**
 * 5. إرسال أوامر ESC/POS الخام عبر منفذ التسلسلي الافتراضي (WebSerial)
 * ممتاز لطابعات USB التي تتعرف كـ Virtual COM Port (مثل COM3, COM4, /dev/ttyUSB0)
 */
export const sendEscPosViaWebSerial = async (
  rawCommands: Uint8Array,
  baudRate: number = 9600
): Promise<{ success: boolean; message: string; isPermissionsPolicyBlocked?: boolean }> => {
  const navAny = navigator as any;
  if (!navAny?.serial) {
    return {
      success: false,
      message: 'متصفحك الحالي لا يدعم WebSerial. يرجى استخدام Google Chrome أو Microsoft Edge.'
    };
  }

  // التحقق المسبق من سياسة الأمان
  if (typeof document !== 'undefined') {
    const docAny = document as any;
    if (docAny?.permissionsPolicy && typeof docAny.permissionsPolicy.allowsFeature === 'function') {
      try {
        if (!docAny.permissionsPolicy.allowsFeature('serial')) {
          return {
            success: false,
            isPermissionsPolicyBlocked: true,
            message: 'المنفذ التسلسلي مقيد داخل إطار المعاينة (Permissions Policy). يرجى استخدام خيار "طباعة (وندوز)".'
          };
        }
      } catch {
        // متابعة
      }
    }
  }

  try {
    const port = await navAny.serial.requestPort();
    if (!port) {
      return { success: false, message: 'لم يتم تحديد منفذ تسلسلي.' };
    }

    await port.open({ baudRate });

    const writer = port.writable.getWriter();
    await writer.write(rawCommands);
    writer.releaseLock();

    await port.close();

    return {
      success: true,
      message: 'تم إرسال أوامر ESC/POS بنجاح عبر المنفذ التسلسلي (COM)!'
    };
  } catch (error: any) {
    const errText = String(error?.message || error || '');
    if (error?.name === 'SecurityError' || errText.includes('permissions policy') || errText.includes('disallowed')) {
      return {
        success: false,
        isPermissionsPolicyBlocked: true,
        message: 'المنفذ التسلسلي مقيد داخل إطار المعاينة الحالي (Permissions Policy). يرجى استخدام زر "طباعة (وندوز)" المباشر أو فتح التطبيق في نافذة مستقلة.'
      };
    }
    if (error?.name === 'NotFoundError') {
      return { success: false, message: 'تم إلغاء اختيار المنفذ.' };
    }
    console.warn('WebSerial connection notice:', error);
    return {
      success: false,
      message: `تعذر الاتصال بالمنفذ التسلسلي: ${error?.message || error}`
    };
  }
};

/**
 * 6. دالة الإرسال الذكية الموحدة: تجرب WebUSB أولاً ثم تتيح خيار WebSerial
 */
export const sendEscPosDirect = async (
  rawCommands: Uint8Array,
  preferredMethod: 'usb' | 'serial' | 'auto' = 'auto'
): Promise<{ success: boolean; message: string; isPermissionsPolicyBlocked?: boolean }> => {
  const { webUsb, webSerial, isPolicyBlocked } = checkBrowserDeviceSupport();

  if (isPolicyBlocked) {
    return {
      success: false,
      isPermissionsPolicyBlocked: true,
      message: 'منافذ USB/Serial مقيدة بسياسة الأمان داخل إطار المعاينة. يرجى استخدام زر "طباعة (وندوز)" المباشر أو فتح التطبيق في نافذة مستقلة.'
    };
  }

  if (preferredMethod === 'serial' && webSerial) {
    return await sendEscPosViaWebSerial(rawCommands);
  }

  if (webUsb) {
    const res = await sendEscPosViaWebUsb(rawCommands);
    if (res.success) return res;
    if (res.isPermissionsPolicyBlocked) {
      return res;
    }
    // إذا تعذر WebUSB ولم يكن مقيداً بسياسة الأمان ولم يلغِ المستخدم الاختيار
    if (webSerial && !res.message.includes('لا يدعم') && !res.message.includes('إلغاء')) {
      return await sendEscPosViaWebSerial(rawCommands);
    }
    return res;
  }

  if (webSerial) {
    return await sendEscPosViaWebSerial(rawCommands);
  }

  return {
    success: false,
    message: 'المتصفح الحالي لا يدعم الاتصال المباشر عبر WebUSB أو WebSerial. يرجى استخدام متصفح Google Chrome على جهاز الكمبيوتر.'
  };
};

/**
 * 7. تنزيل ملف الأوامر الخام (.bin / .prn) لتمريرها يدوياً أو عبر خدمات التخزين المؤقت Spooler
 */
export const downloadEscPosBinaryFile = (
  rawCommands: Uint8Array,
  fileName: string = 'invoice_escpos.bin'
): void => {
  const blob = new Blob([rawCommands], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 1000);
};

/**
 * 8. دالة شاملة لطباعة الفاتورة بأوامر ESC/POS مباشرة من متصفح الكمبيوتر إلى الطابعة
 */
export const printSalesInvoiceEscPosDirect = async (
  shopName: string = 'سند للمحاسبة والخدمات',
  invoiceData: SalesInvoicePrintData,
  currency: string = 'ريال',
  options: EscPosOptions = {},
  preferredMethod: 'usb' | 'serial' | 'auto' = 'auto'
): Promise<{ success: boolean; message: string; isPermissionsPolicyBlocked?: boolean }> => {
  try {
    const rawCommands = await convertInvoiceToEscPos(invoiceData, shopName, currency, options);
    return await sendEscPosDirect(rawCommands, preferredMethod);
  } catch (error: any) {
    const errText = String(error?.message || error || '');
    if (error?.name === 'SecurityError' || errText.includes('permissions policy') || errText.includes('disallowed')) {
      return {
        success: false,
        isPermissionsPolicyBlocked: true,
        message: 'منفذ USB مقيد داخل إطار المعاينة الحالي (Permissions Policy).'
      };
    }
    console.warn('printSalesInvoiceEscPosDirect notice:', error);
    return {
      success: false,
      message: `فشل تجهيز أو إرسال أوامر ESC/POS: ${error?.message || error}`
    };
  }
};

/**
 * 9. دوال اختبار سريعة للعتاد (Hardware Diagnostics) عبر ESC/POS المباشر
 */
export const testEscPosHardware = {
  // فحص فتح درج النقود
  openDrawer: async (): Promise<{ success: boolean; message: string; isPermissionsPolicyBlocked?: boolean }> => {
    const builder = new EscPosBuilder();
    builder.openCashDrawer();
    return await sendEscPosDirect(builder.toUint8Array());
  },
  // فحص جرس التنبيه
  beep: async (): Promise<{ success: boolean; message: string; isPermissionsPolicyBlocked?: boolean }> => {
    const builder = new EscPosBuilder();
    builder.beep(2);
    return await sendEscPosDirect(builder.toUint8Array());
  },
  // فحص قص الورق
  cutPaper: async (): Promise<{ success: boolean; message: string; isPermissionsPolicyBlocked?: boolean }> => {
    const builder = new EscPosBuilder();
    builder.feed(4);
    builder.cutPaper(false, 24);
    return await sendEscPosDirect(builder.toUint8Array());
  }
};

