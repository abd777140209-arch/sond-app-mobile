/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  category?: string; // e.g. "أجهزة", "إكسسوارات", "صيانة", "أخرى"
  description?: string;
  isDeleted?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalDebt: number;
  initialDebt?: number;
  balance?: number;
  createdAt: string;
  debtDueDate?: string; // تاريخ استحقاق الدين
  creditLimit?: number; // سقف الدين / حد الإئتمان
  loyaltyPoints?: number; // نقاط الولاء
  notes?: string;
  isDeleted?: boolean;
  isActive?: boolean;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  sellingPrice: number;
  total: number;
}

export type InvoiceType = 'cash' | 'debt';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  items: InvoiceItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  type: InvoiceType;
  paymentMethod?: string;
  referenceNumber?: string;
  proofImage?: string; // صورة السند / إشعار التحويل / الإيداع
  date: string;
  status?: 'active' | 'refunded'; // supports returns
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  note: string;
  paymentMethod?: string;
  referenceNumber?: string;
  proofImage?: string; // صورة سند القبض / الإيداع
}

export type ChecklistStatus = 'intact' | 'damaged' | 'untested';

export interface DeviceChecklist {
  screen?: ChecklistStatus;     // الشاشة
  battery?: ChecklistStatus;    // البطارية
  camera?: ChecklistStatus;     // الكاميرا
  fingerprint?: ChecklistStatus;// البصمة/الوجه
  sound?: ChecklistStatus;      // الصوت/السماعة
  power?: ChecklistStatus;      // الباور/الشحن
}

export interface MaintenanceOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deviceName: string;
  issueDescription: string;
  cost: number;
  sparePartsCost?: number;   // تكلفة قطع الغيار المستخدمة
  laborFee?: number;         // أجور اليد والخدمة
  technicianName?: string;   // اسم الفني المسكّن
  status: 'received' | 'repairing' | 'completed' | 'delivered';
  dateReceived: string;
  dateDelivered?: string;
  notes: string;
  checklist?: DeviceChecklist;
  paymentMethod?: string;
  referenceNumber?: string;
  proofImage?: string;
}

export interface Transaction {
  id: string;
  type: 'sale' | 'payment' | 'expense' | 'refund' | 'maintenance_income';
  amount: number;
  date: string;
  description: string;
  paymentMethod?: string;
  referenceNumber?: string;
  proofImage?: string; // صورة سند التحويل أو إشعار الإيداع
}

export type AppTheme = 'financial-blue' | 'emerald-green' | 'warm-amber' | 'dark-luxury';
export type CardShape = 'soft' | 'sharp' | 'glass';
export type DisplayDensity = 'comfortable' | 'compact';

export interface CurrencyRate {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number; // rate relative to base currency (e.g. 1 SAR = 140 YER)
  isBase?: boolean;
}

export type BackupFrequency = 'off' | 'daily' | 'weekly' | 'monthly';

export interface SystemSettings {
  storeName: string;
  companyName?: string;
  currency: string;
  currencies?: CurrencyRate[];
  selectedCurrencySymbol?: string;
  address: string;
  phone: string;
  pinCode: string;
  isPinEnabled: boolean;
  protectedSections?: string[];
  privacyPinCode?: string;
  isPrivacyPinEnabled?: boolean;
  storeLogoUrl?: string;
  debtReminderTemplate?: string;
  invoiceFooterNote?: string;
  exchangeRates?: Record<string, number>;
  appTheme?: AppTheme;
  cardShape?: CardShape;
  density?: DisplayDensity;
  deviceMode?: 'mobile' | 'desktop';
  backupFolderPath?: string;
  localBackupSchedule?: BackupFrequency;
  autoBackupOnExit?: boolean;
  driveBackupAccount?: string;
  driveBackupSchedule?: BackupFrequency;
  lastLocalBackupDate?: string;
  lastDriveBackupDate?: string;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  jobTitle: string;
  monthlySalary: number;
  totalAdvances: number;
  hireDate: string;
  isDeleted?: boolean;
}

export type UserRole = 'admin' | 'cashier' | 'technician' | 'accountant';

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  phone?: string;
  pin?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  actionType: string;
  actionLabel: string;
  details?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'advance' | 'salary_payment';
  amount: number;
  date: string;
  note: string;
}

