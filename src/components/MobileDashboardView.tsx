/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Wallet, 
  Users, 
  FileText, 
  Package, 
  BarChart3, 
  Home, 
  Settings as SettingsIcon, 
  Clock, 
  Shield, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Bell, 
  TrendingUp, 
  Wrench, 
  Briefcase, 
  ClipboardCheck, 
  History, 
  Sparkles,
  Calculator,
  Download,
  Upload,
  HardDrive
} from 'lucide-react';
import { Product, Customer, Invoice, Payment, Transaction, SystemSettings, Employee } from '../types';
import { soundManager } from '../utils/sound';
import FloatingCalculator from './FloatingCalculator';

interface MobileDashboardViewProps {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  transactions: Transaction[];
  settings: SystemSettings;
  employees?: Employee[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isPrivacyMode?: boolean;
  setIsPrivacyMode?: (val: boolean) => void;
  isCashierMode?: boolean;
  setIsCashierMode?: (val: boolean) => void;
  setShowPinCheckModal?: (val: boolean) => void;
  setShowPrivacyPinModal?: (val: boolean) => void;
  onBackupData?: () => void;
  onRestoreData?: (data: any) => Promise<boolean>;
}

export default function MobileDashboardView({
  products,
  customers,
  invoices,
  payments,
  transactions,
  settings,
  employees = [],
  activeTab,
  setActiveTab,
  isPrivacyMode = false,
  setIsPrivacyMode,
  isCashierMode = false,
  setIsCashierMode,
  setShowPinCheckModal,
  setShowPrivacyPinModal,
  onBackupData,
  onRestoreData
}: MobileDashboardViewProps) {
  
  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (onRestoreData) {
          const success = await onRestoreData(parsed);
          if (success) {
            soundManager.playSuccessChime();
            alert('✅ تم استعادة النسخة الاحتياطية بنجاح بنسبة 100%!');
          } else {
            alert('❌ فشل استعادة الملف. الرجاء التأكد من صحة ملف النسخة الاحتياطية.');
          }
        }
      } catch (err) {
        alert('❌ صيغة الملف غير صحيحة.');
      }
    };
    reader.readAsText(file);
  };
  
  // Multi-Currency Selection
  const activeCurrencies = settings?.currencies && settings.currencies.length > 0
    ? settings.currencies
    : [
        { id: 'YER', code: 'YER', name: 'الريال اليمني', symbol: 'ر.ي', exchangeRate: 1, isBase: true },
        { id: 'SAR', code: 'SAR', name: 'الريال السعودي', symbol: 'ر.س', exchangeRate: 140, isBase: false },
        { id: 'USD', code: 'USD', name: 'الدولار الأمريكي', symbol: '$', exchangeRate: 530, isBase: false },
      ];

  const [mobileCurrencySymbol, setMobileCurrencySymbol] = useState<string>(
    settings?.selectedCurrencySymbol || settings?.currency || 'ر.ي'
  );

  const selectedCurr = activeCurrencies.find(c => c.symbol === mobileCurrencySymbol || c.code === mobileCurrencySymbol) || activeCurrencies[0];
  const currRate = selectedCurr?.exchangeRate && selectedCurr.exchangeRate > 0 ? selectedCurr.exchangeRate : 1;

  // Active items calculations
  const activeProducts = products.filter(p => p.isDeleted !== true);
  const activeCustomers = customers.filter(c => c.isDeleted !== true);

  const totalSales = invoices.reduce((sum, inv) => sum + inv.finalAmount, 0);
  const totalDebts = activeCustomers.reduce((sum, cust) => sum + cust.totalDebt, 0);

  // Cashbox / Treasury Balance (Total cash sales + Debt payments - Expenses)
  const cashSales = invoices.filter(inv => inv.type === 'cash').reduce((sum, inv) => sum + inv.finalAmount, 0);
  const debtPayments = payments.reduce((sum, pay) => sum + pay.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const cashboxBalance = cashSales + debtPayments - expenses;

  // Format helper
  const fmt = (num: number) => {
    const symbol = selectedCurr?.symbol || mobileCurrencySymbol || settings.currency;
    if (isPrivacyMode) return '**** ' + symbol;
    const converted = selectedCurr?.isBase ? num : (num / currRate);
    const formatted = selectedCurr?.isBase
      ? Math.round(converted).toLocaleString()
      : converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${symbol}`;
  };

  const handleNavClick = (tab: string) => {
    soundManager.playScanBeep();
    setActiveTab(tab);
  };

  return (
    <div id="mobile_dashboard_view_isolated" className="min-h-screen bg-[#F8FAFC] dark:bg-[#070D14] text-slate-800 dark:text-slate-100 pb-28">
      
      {/* 1. MOBILE TOP BRANDING HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B141F]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {/* Store Logo & Name */}
          <div className="flex items-center gap-2.5">
            {settings.storeLogoUrl ? (
              <img 
                src={settings.storeLogoUrl} 
                alt="شعار المتجر" 
                className="w-9 h-9 rounded-xl object-contain border border-slate-200 dark:border-slate-700 bg-white p-0.5 shadow-xs" 
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md flex items-center justify-center font-black text-sm shrink-0">
                📱
              </div>
            )}
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                {settings.storeName && settings.storeName.trim() ? settings.storeName : 'سند المحاسبي الجوال'}
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                واجهة الجوال المبسطة ⚡
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5">
            {/* Privacy Mode Button */}
            <button
              onClick={() => {
                if (isPrivacyMode) {
                  if (setShowPrivacyPinModal) setShowPrivacyPinModal(true);
                  else if (setIsPrivacyMode) setIsPrivacyMode(false);
                } else {
                  soundManager.playScanBeep();
                  if (setIsPrivacyMode) setIsPrivacyMode(true);
                }
              }}
              className={`p-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 border ${
                isPrivacyMode
                  ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title="تفعيل/إلغاء وضع الخصوصية"
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Cashier Mode Badge */}
            <button
              onClick={() => {
                if (isCashierMode && setShowPinCheckModal) {
                  setShowPinCheckModal(true);
                } else if (setIsCashierMode) {
                  soundManager.playSuccessChime();
                  setIsCashierMode(true);
                }
              }}
              className={`p-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                isCashierMode
                  ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 text-amber-800 dark:text-amber-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {isCashierMode ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-emerald-600" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN MOBILE CONTENT BODY */}
      <main className="p-3 space-y-4">
        
        {/* KPI QUICK FINANCIAL SUMMARY STRIP */}
        <div className="grid grid-cols-3 gap-2">
          {/* Sales Total */}
          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#0D1722] border border-slate-200 dark:border-slate-800 shadow-xs text-right">
            <span className="text-[9.5px] font-bold text-slate-400 block">المبيعات</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 truncate dir-ltr">
              {fmt(totalSales)}
            </span>
          </div>

          {/* Debts Total */}
          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#0D1722] border border-slate-200 dark:border-slate-800 shadow-xs text-right">
            <span className="text-[9.5px] font-bold text-slate-400 block">الديون</span>
            <span className="text-xs font-black text-rose-600 dark:text-rose-400 block mt-0.5 truncate dir-ltr">
              {fmt(totalDebts)}
            </span>
          </div>

          {/* Cashbox Balance */}
          <div className="p-2.5 rounded-2xl bg-white dark:bg-[#0D1722] border border-slate-200 dark:border-slate-800 shadow-xs text-right">
            <span className="text-[9.5px] font-bold text-slate-400 block">الصندوق</span>
            <span className="text-xs font-black text-amber-600 dark:text-amber-400 block mt-0.5 truncate dir-ltr">
              {fmt(cashboxBalance)}
            </span>
          </div>
        </div>

        {/* 3. CORE FEATURES GRID (GRID 2-COLS) WITH LARGE TOUCH-FRIENDLY BUTTONS */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>الأقسام والميزات الأساسية</span>
            </h2>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-full">
              كبسات كبيرة مريحة
            </span>
          </div>

          {/* Grid 2-cols */}
          <div className="grid grid-cols-2 gap-3">
            
            {/* 1. المبيعات (Sales / POS) */}
            <button
              id="mobile_btn_sales"
              onClick={() => handleNavClick('pos')}
              className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-right flex flex-col justify-between h-32 relative overflow-hidden cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md text-white">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white/25 text-white backdrop-blur-md">
                  POS ⚡
                </span>
              </div>
              <div>
                <h3 className="font-black text-base text-white leading-tight">المبيعات</h3>
                <p className="text-[10.5px] text-emerald-100 font-medium mt-0.5">نقطة بيع سريعة وفواتير</p>
              </div>
            </button>

            {/* 2. الصندوق (Cashbox / Treasury) */}
            <button
              id="mobile_btn_cashbox"
              onClick={() => handleNavClick('transactions')}
              className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-[#C5A862] text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all text-right flex flex-col justify-between h-32 relative overflow-hidden cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-black/15 backdrop-blur-md text-slate-950">
                  <Wallet className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-black/15 text-slate-950 backdrop-blur-md">
                  المالية 💰
                </span>
              </div>
              <div>
                <h3 className="font-black text-base text-slate-950 leading-tight">الصندوق</h3>
                <p className="text-[10.5px] text-slate-900 font-bold mt-0.5">النقدية والرصيد والمصاريف</p>
              </div>
            </button>

            {/* 3. العملاء (Customers / Debts) */}
            <button
              id="mobile_btn_customers"
              onClick={() => handleNavClick('customers')}
              className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-lg shadow-blue-600/20 active:scale-95 transition-all text-right flex flex-col justify-between h-32 relative overflow-hidden cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md text-white">
                  <Users className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white/25 text-white backdrop-blur-md">
                  {activeCustomers.filter(c => c.totalDebt > 0).length} ديون
                </span>
              </div>
              <div>
                <h3 className="font-black text-base text-white leading-tight">العملاء</h3>
                <p className="text-[10.5px] text-blue-100 font-medium mt-0.5">دفاتر الديون والتحصيل</p>
              </div>
            </button>

            {/* 4. السندات (Vouchers / Payments & Ledger) */}
            <button
              id="mobile_btn_vouchers"
              onClick={() => handleNavClick('transactions')}
              className="p-4 rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-900 text-white shadow-lg shadow-purple-600/20 active:scale-95 transition-all text-right flex flex-col justify-between h-32 relative overflow-hidden cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md text-white">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white/25 text-white backdrop-blur-md">
                  سندات 📜
                </span>
              </div>
              <div>
                <h3 className="font-black text-base text-white leading-tight">السندات</h3>
                <p className="text-[10.5px] text-purple-100 font-medium mt-0.5">سندات القبض والصرف</p>
              </div>
            </button>

            {/* 5. المخزن (Inventory / Stock) */}
            <button
              id="mobile_btn_inventory"
              onClick={() => handleNavClick('inventory')}
              className="p-4 rounded-2xl bg-gradient-to-br from-sky-600 via-sky-700 to-blue-900 text-white shadow-lg shadow-sky-600/20 active:scale-95 transition-all text-right flex flex-col justify-between h-32 relative overflow-hidden cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md text-white">
                  <Package className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white/25 text-white backdrop-blur-md">
                  {activeProducts.length} صنف
                </span>
              </div>
              <div>
                <h3 className="font-black text-base text-white leading-tight">المخزن</h3>
                <p className="text-[10.5px] text-sky-100 font-medium mt-0.5">البضائع والأسعار والجرد</p>
              </div>
            </button>

            {/* 6. التقارير (Reports & Profits) */}
            <button
              id="mobile_btn_reports"
              onClick={() => handleNavClick('reports')}
              className="p-4 rounded-2xl bg-gradient-to-br from-rose-600 via-rose-700 to-pink-900 text-white shadow-lg shadow-rose-600/20 active:scale-95 transition-all text-right flex flex-col justify-between h-32 relative overflow-hidden cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md text-white">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white/25 text-white backdrop-blur-md">
                  أرباح 📊
                </span>
              </div>
              <div>
                <h3 className="font-black text-base text-white leading-tight">التقارير</h3>
                <p className="text-[10.5px] text-rose-100 font-medium mt-0.5">الأرباح والمبيعات البيانية</p>
              </div>
            </button>

          </div>
        </section>

        {/* BACKUP & RESTORE BANNER CARD */}
        <section className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white">النسخ الاحتياطي وحماية البيانات 💾</h3>
                <p className="text-[10px] text-blue-200">تخزين نسختك في ذاكرة الهاتف الداخلية أو مشاركتها بسهولة</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Take Backup Button */}
            <button
              onClick={() => {
                if (onBackupData) {
                  onBackupData();
                }
              }}
              className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>حفظ نسخة احتياطية</span>
            </button>

            {/* Restore Backup Button */}
            <label className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer border border-slate-700">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>استعادة نسخة</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileRestore}
                className="hidden"
              />
            </label>
          </div>
        </section>

        {/* ADDITIONAL SECONDARY MOBILE FEATURES */}
        <section className="space-y-2 pt-1">
          <div className="text-[11px] font-bold text-slate-400 px-1">خدمات وأقسام إضافية:</div>
          <div className="grid grid-cols-3 gap-2">
            
            {/* Maintenance */}
            <button
              onClick={() => handleNavClick('maintenance')}
              className="p-3 rounded-2xl bg-white dark:bg-[#0D1722] border border-slate-200 dark:border-slate-800 text-right active:scale-95 transition cursor-pointer flex flex-col justify-between h-20 shadow-xs"
            >
              <div className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 w-fit">
                <Wrench className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-100">الصيانة</span>
            </button>

            {/* Employees */}
            <button
              onClick={() => handleNavClick('employees')}
              className="p-3 rounded-2xl bg-white dark:bg-[#0D1722] border border-slate-200 dark:border-slate-800 text-right active:scale-95 transition cursor-pointer flex flex-col justify-between h-20 shadow-xs"
            >
              <div className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 w-fit">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-100">الرواتب والسلف</span>
            </button>

            {/* Stock Audit */}
            <button
              onClick={() => handleNavClick('stock_audit')}
              className="p-3 rounded-2xl bg-white dark:bg-[#0D1722] border border-slate-200 dark:border-slate-800 text-right active:scale-95 transition cursor-pointer flex flex-col justify-between h-20 shadow-xs"
            >
              <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 w-fit">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-100">جرد المنشأة</span>
            </button>

          </div>
        </section>

      </main>

      {/* FLOATING CALCULATOR BUTTON POSITIONED AT bottom: 80px FOR MOBILE */}
      <div className="fixed bottom-[80px] right-4 z-50 no-print">
        <FloatingCalculator />
      </div>

      {/* 4. FIXED BOTTOM NAVIGATION BAR WITH 5 EVENLY SPACED OPTIONS (flex-1) */}
      <MobileBottomNavbar activeTab={activeTab} handleNavClick={handleNavClick} />

    </div>
  );
}

export function MobileBottomNavbar({
  activeTab,
  handleNavClick
}: {
  activeTab: string;
  handleNavClick: (tab: string) => void;
}) {
  return (
    <nav id="mobile_fixed_bottom_navbar" className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#09111A]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1 py-1.5 flex items-center justify-between shadow-2xl no-print">
      
      {/* 1. الرئيسية / Home */}
      <button
        id="mobile_nav_home"
        onClick={() => handleNavClick('dashboard')}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center transition cursor-pointer ${
          activeTab === 'dashboard'
            ? 'text-blue-600 dark:text-blue-400 font-extrabold'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
        }`}
      >
        <Home className={`w-5 h-5 ${activeTab === 'dashboard' ? 'scale-110 text-blue-600 dark:text-blue-400' : ''}`} />
        <span className="text-[10px] mt-0.5">الرئيسية</span>
      </button>

      {/* 2. المبيعات / POS */}
      <button
        id="mobile_nav_pos"
        onClick={() => handleNavClick('pos')}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center transition cursor-pointer ${
          activeTab === 'pos'
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
        }`}
      >
        <ShoppingCart className={`w-5 h-5 ${activeTab === 'pos' ? 'scale-110 text-emerald-600 dark:text-emerald-400' : ''}`} />
        <span className="text-[10px] mt-0.5">المبيعات</span>
      </button>

      {/* 3. العملاء / Customers */}
      <button
        id="mobile_nav_customers"
        onClick={() => handleNavClick('customers')}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center transition cursor-pointer ${
          activeTab === 'customers'
            ? 'text-blue-600 dark:text-blue-400 font-extrabold'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
        }`}
      >
        <Users className={`w-5 h-5 ${activeTab === 'customers' ? 'scale-110 text-blue-600 dark:text-blue-400' : ''}`} />
        <span className="text-[10px] mt-0.5">العملاء</span>
      </button>

      {/* 4. المخزن / Inventory */}
      <button
        id="mobile_nav_inventory"
        onClick={() => handleNavClick('inventory')}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center transition cursor-pointer ${
          activeTab === 'inventory'
            ? 'text-sky-600 dark:text-sky-400 font-extrabold'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
        }`}
      >
        <Package className={`w-5 h-5 ${activeTab === 'inventory' ? 'scale-110 text-sky-600 dark:text-sky-400' : ''}`} />
        <span className="text-[10px] mt-0.5">المخزن</span>
      </button>

      {/* 5. الإعدادات / Settings */}
      <button
        id="mobile_nav_settings"
        onClick={() => handleNavClick('settings')}
        className={`flex-1 py-1.5 flex flex-col items-center justify-center transition cursor-pointer ${
          activeTab === 'settings'
            ? 'text-slate-900 dark:text-white font-extrabold'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
        }`}
      >
        <SettingsIcon className={`w-5 h-5 ${activeTab === 'settings' ? 'scale-110 text-slate-900 dark:text-white' : ''}`} />
        <span className="text-[10px] mt-0.5">الإعدادات</span>
      </button>

    </nav>
  );
}
