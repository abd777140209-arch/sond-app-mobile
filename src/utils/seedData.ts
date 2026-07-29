/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Customer, Invoice, Payment, Transaction, SystemSettings, CurrencyRate } from '../types';

export const DEFAULT_CURRENCIES: CurrencyRate[] = [
  { id: 'YER', code: 'YER', name: 'الريال اليمني', symbol: 'ر.ي', exchangeRate: 1, isBase: true },
  { id: 'SAR', code: 'SAR', name: 'الريال السعودي', symbol: 'ر.س', exchangeRate: 140, isBase: false },
  { id: 'USD', code: 'USD', name: 'الدولار الأمريكي', symbol: '$', exchangeRate: 530, isBase: false },
];

export const DEFAULT_SETTINGS: SystemSettings = {
  storeName: "",
  currency: "ر.ي", // Yemeni Rial, matching Abdulmajeed's yemeni context / phone number 967
  currencies: DEFAULT_CURRENCIES,
  selectedCurrencySymbol: "ر.ي",
  address: "",
  phone: "",
  pinCode: "1234",
  isPinEnabled: true,
  protectedSections: ['reports', 'settings'],
  privacyPinCode: "1234",
  isPrivacyPinEnabled: true,
  exchangeRates: {
    YER: 1,
    SAR: 140,
    USD: 530,
  },
  appTheme: 'financial-blue',
  cardShape: 'soft',
  density: 'comfortable',
  deviceMode: 'mobile',
  backupFolderPath: 'Documents/SanadAccounting',
  localBackupSchedule: 'daily',
  autoBackupOnExit: true,
  driveBackupAccount: '',
  driveBackupSchedule: 'weekly',
  lastLocalBackupDate: '',
  lastDriveBackupDate: ''
};

export const SEED_PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "سامسونج جالكسي S24 ألترا - 512 جيجا",
    barcode: "8806095311234",
    costPrice: 950000,
    sellingPrice: 1100000,
    stock: 8,
    minStock: 2,
    category: "أجهزة"
  },
  {
    id: "p2",
    name: "آيفون 15 برو ماكس - 256 جيجا",
    barcode: "195949031444",
    costPrice: 1100000,
    sellingPrice: 1250000,
    stock: 5,
    minStock: 2,
    category: "أجهزة"
  },
  {
    id: "p3",
    name: "سماعة أبل إيربودز برو 2 (أصلية)",
    barcode: "190199246855",
    costPrice: 180000,
    sellingPrice: 220000,
    stock: 12,
    minStock: 3,
    category: "إكسسوارات"
  },
  {
    id: "p4",
    name: "شاحن أنكر بقوة 65 واط - 3 مخارج",
    barcode: "848061054321",
    costPrice: 25000,
    sellingPrice: 35000,
    stock: 25,
    minStock: 5,
    category: "إكسسوارات"
  },
  {
    id: "p5",
    name: "لاصق شاشة نانو ضد الكسر - حماية كاملة",
    barcode: "00001",
    costPrice: 1500,
    sellingPrice: 4000,
    stock: 90,
    minStock: 10,
    category: "إكسسوارات"
  },
  {
    id: "p6",
    name: "سلك شاحن تايب سي قماش سريع 1.2 متر",
    barcode: "00002",
    costPrice: 2000,
    sellingPrice: 4500,
    stock: 3,
    minStock: 10,
    category: "إكسسوارات"
  },
  {
    id: "p7",
    name: "خدمة صيانة وبرمجة شاشات سوبر أموليد",
    barcode: "00003",
    costPrice: 10000,
    sellingPrice: 30000,
    stock: 500,
    minStock: 0,
    category: "صيانة"
  }
];

export const SEED_CUSTOMERS: Customer[] = [
  {
    id: "c1",
    name: "عبدالملك اليماني",
    phone: "771234567",
    totalDebt: 185000,
    createdAt: "2026-06-15T14:30:00Z"
  },
  {
    id: "c2",
    name: "محمد أحمد الكبسي",
    phone: "770000111",
    totalDebt: 320000,
    createdAt: "2026-07-01T09:15:00Z"
  },
  {
    id: "c3",
    name: "سليم باوزير حضرموت",
    phone: "735554433",
    totalDebt: 0,
    createdAt: "2026-07-05T18:45:00Z"
  },
  {
    id: "c4",
    name: "الشيخ نبيل اليافعي",
    phone: "711223344",
    totalDebt: 75000,
    createdAt: "2026-07-10T11:20:00Z"
  }
];

export const SEED_INVOICES: Invoice[] = [
  {
    id: "inv-1001",
    invoiceNumber: "INV-1001",
    customerId: "c1",
    customerName: "عبدالملك اليماني",
    items: [
      { productId: "p3", name: "سماعة أبل إيربودز برو 2 (أصلية)", quantity: 1, sellingPrice: 220000, total: 220000 },
      { productId: "p5", name: "لاصق شاشة نانو ضد الكسر - حماية كاملة", quantity: 1, sellingPrice: 4000, total: 4000 }
    ],
    totalAmount: 224000,
    discount: 4000,
    finalAmount: 220000,
    type: "debt",
    date: "2026-07-14T15:20:00Z"
  },
  {
    id: "inv-1002",
    invoiceNumber: "INV-1002",
    customerId: null,
    customerName: "عميل سفري / نقدي",
    items: [
      { productId: "p4", name: "شاحن أنكر بقوة 65 واط - 3 مخارج", quantity: 2, sellingPrice: 35000, total: 70000 },
      { productId: "p6", name: "سلك شاحن تايب سي قماش سريع 1.2 متر", quantity: 2, sellingPrice: 4500, total: 9000 }
    ],
    totalAmount: 79000,
    discount: 0,
    finalAmount: 79000,
    type: "cash",
    date: "2026-07-15T11:10:00Z"
  },
  {
    id: "inv-1003",
    invoiceNumber: "INV-1003",
    customerId: "c2",
    customerName: "محمد أحمد الكبسي",
    items: [
      { productId: "p1", name: "سامسونج جالكسي S24 ألترا - 512 جيجا", quantity: 1, sellingPrice: 1100000, total: 1100000 }
    ],
    totalAmount: 1100000,
    discount: 50000,
    finalAmount: 1050000,
    type: "debt",
    date: "2026-07-16T18:00:00Z"
  }
];

export const SEED_PAYMENTS: Payment[] = [
  {
    id: "pay-1",
    customerId: "c1",
    customerName: "عبدالملك اليماني",
    amount: 35000,
    date: "2026-07-15T16:00:00Z",
    note: "دفعة نقدية من حساب سماعة الإيربودز"
  },
  {
    id: "pay-2",
    customerId: "c2",
    customerName: "محمد أحمد الكبسي",
    amount: 730000,
    date: "2026-07-17T08:30:00Z",
    note: "جزء كبير من قيمة تليفون S24 الترا"
  }
];

export const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: "t1",
    type: "sale",
    amount: 79000,
    date: "2026-07-15T11:10:00Z",
    description: "مبيعات نقدية فاتورة INV-1002"
  },
  {
    id: "t2",
    type: "payment",
    amount: 35000,
    date: "2026-07-15T16:00:00Z",
    description: "سداد ديون من العميل: عبدالملك اليماني"
  },
  {
    id: "t3",
    type: "payment",
    amount: 730000,
    date: "2026-07-17T08:30:00Z",
    description: "سداد ديون من العميل: محمد أحمد الكبسي"
  }
];
