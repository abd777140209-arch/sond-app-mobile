import { Product } from '../types';

/**
 * تحويل الأرقام العربية المشرقية (٠-٩) إلى أرقام إنجليزية (0-9)
 */
export function normalizeDigits(input: string): string {
  if (!input) return '';
  return input
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars
    .trim();
}

/**
 * تنظيف ومطابقة رمز الباركود مع إزالة المسافات وتوحيد الأرقام
 */
export function cleanBarcode(barcode: string): string {
  if (!barcode) return '';
  return normalizeDigits(barcode.trim());
}

/**
 * البحث الذكي عن منتج عبر رمز الباركود أو الرقم التسلسلي أو كود الصنف
 */
export function findProductByScannedBarcode(
  products: Product[],
  scannedCode: string
): Product | undefined {
  if (!products || products.length === 0 || !scannedCode) return undefined;

  const rawClean = scannedCode.trim();
  const normalizedScanned = normalizeDigits(rawClean);
  const scannedLower = normalizedScanned.toLowerCase();
  const scannedWithoutLeadingZeros = normalizedScanned.replace(/^0+/, '');

  // 1. مطابقة مباشرة وتامة للباركود (مع تنظيف الأرقام)
  const exactBarcodeMatch = products.find((p) => {
    if (!p.barcode) return false;
    const prodBarcode = normalizeDigits(p.barcode);
    return (
      prodBarcode === normalizedScanned ||
      prodBarcode.toLowerCase() === scannedLower
    );
  });
  if (exactBarcodeMatch) return exactBarcodeMatch;

  // 2. مطابقة بدون الأصفار البادئة (مثلاً EAN-13 مقابل UPC-A أو باركود مضاف بصفر زائد)
  if (scannedWithoutLeadingZeros.length > 0) {
    const noLeadingZerosMatch = products.find((p) => {
      if (!p.barcode) return false;
      const prodBarcodeNoZeros = normalizeDigits(p.barcode).replace(/^0+/, '');
      return (
        prodBarcodeNoZeros.length > 0 &&
        prodBarcodeNoZeros === scannedWithoutLeadingZeros
      );
    });
    if (noLeadingZerosMatch) return noLeadingZerosMatch;
  }

  // 3. مطابقة معرف المنتج (ID)
  const idMatch = products.find((p) => {
    return p.id === rawClean || p.id === normalizedScanned;
  });
  if (idMatch) return idMatch;

  // 4. مطابقة بالاسم في حال تم إدخال اسم المنتج بالكامل في قارئ الباركود
  const nameMatch = products.find((p) => {
    return p.name.trim().toLowerCase() === rawClean.toLowerCase();
  });

  return nameMatch;
}
