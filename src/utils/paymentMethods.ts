/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PaymentMethodKey = 'cash' | 'kuraimi' | 'bank_transfer' | 'e_wallet' | 'card' | 'debt';

export interface PaymentMethodMeta {
  key: PaymentMethodKey;
  label: string;
  shortLabel: string;
  emoji: string;
  colorClass: string;
  bgLightClass: string;
  borderClass: string;
  badgeClass: string;
  description: string;
}

export const PAYMENT_METHODS: Record<PaymentMethodKey, PaymentMethodMeta> = {
  cash: {
    key: 'cash',
    label: 'نقداً (كاش بالخزينة)',
    shortLabel: 'نقدي (كاش)',
    emoji: '💵',
    colorClass: 'text-emerald-700',
    bgLightClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'المبالغ المقبوضة كاش باليد في الخزينة'
  },
  kuraimi: {
    key: 'kuraimi',
    label: 'كريمي إكسبرس / جوال باي',
    shortLabel: 'كريمي / جوال باي',
    emoji: '🏦',
    colorClass: 'text-blue-700',
    bgLightClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'حوالات وتدفقات بنك الكريمي إكسبرس وجوال باي'
  },
  bank_transfer: {
    key: 'bank_transfer',
    label: 'تحويل بنكي / شبكة حاسب',
    shortLabel: 'تحويل بنكي / حاسب',
    emoji: '📲',
    colorClass: 'text-indigo-700',
    bgLightClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'تحويلات البنوك والأجهزة الشبكية'
  },
  e_wallet: {
    key: 'e_wallet',
    label: 'محفظة إلكترونية (ون كاش / جيب / فلوسك)',
    shortLabel: 'محفظة إلكترونية',
    emoji: '💳',
    colorClass: 'text-amber-700',
    bgLightClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'محافظ ون كاش، جيب، فلوسك، مالي، كاش، وغيرها'
  },
  card: {
    key: 'card',
    label: 'بطاقة إلكترونية / شبكة',
    shortLabel: 'بطاقة / شبكة',
    emoji: '💳',
    colorClass: 'text-purple-700',
    bgLightClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'أجهزة نقاط البيع والدفع بالبطائق'
  },
  debt: {
    key: 'debt',
    label: 'آجل (تسجيل على الحساب)',
    shortLabel: 'آجل (على الحساب)',
    emoji: '📝',
    colorClass: 'text-rose-700',
    bgLightClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'قيد مالي مؤجل على حساب العميل'
  }
};

export function getPaymentMethodMeta(key?: string): PaymentMethodMeta {
  if (!key) return PAYMENT_METHODS.cash;
  if (key in PAYMENT_METHODS) {
    return PAYMENT_METHODS[key as PaymentMethodKey];
  }
  // Fallbacks for legacy string values
  if (key.includes('كريمي') || key.includes('kuraimi')) return PAYMENT_METHODS.kuraimi;
  if (key.includes('تحويل') || key.includes('بنك') || key.includes('حاسب')) return PAYMENT_METHODS.bank_transfer;
  if (key.includes('محفظة') || key.includes('ون كاش') || key.includes('جيب')) return PAYMENT_METHODS.e_wallet;
  if (key.includes('آجل') || key.includes('debt')) return PAYMENT_METHODS.debt;
  
  return PAYMENT_METHODS.cash;
}

export function formatPaymentMethodLabel(key?: string, refNum?: string): string {
  const meta = getPaymentMethodMeta(key);
  if (refNum && refNum.trim()) {
    return `${meta.shortLabel} (مرجع: ${refNum.trim()})`;
  }
  return meta.shortLabel;
}
