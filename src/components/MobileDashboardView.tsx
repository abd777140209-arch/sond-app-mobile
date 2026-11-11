/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  ShoppingCart, 
  Wallet, 
  Users, 
  Package, 
  BarChart3, 
  Settings as SettingsIcon, 
  Shield, 
  TrendingUp, 
  Wrench, 
  Briefcase, 
  ClipboardCheck, 
  History, 
  Sparkles,
  Download,
  Upload,
  Printer,
  Coins,
  Smartphone,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Product, Customer, Invoice, Payment, Transaction, SystemSettings, Employee } from '../types';
import { soundManager } from '../utils/sound';
import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';

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
  transactions,
  settings,
  setActiveTab,
  isPrivacyMode = false,
  onBackupData,
  onRestoreData
}: MobileDashboardViewProps) {
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRestoreJson, setPendingRestoreJson] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const confirmFileRestore = async () => {
    if (!onRestoreData || !pendingRestoreJson) return;
    const jsonToRestore = pendingRestoreJson;
    setPendingRestoreJson(null);
    const success = await onRestoreData(jsonToRestore);
    if (success) {
      soundManager.playSuccessChime();
      setStatusMessage({ type: 'success', text: 'تم استعادة النسخة الاحتياطية بنجاح وتحديث البيانات.' });
    } else {
      soundManager.playWarningBeep();
      setStatusMessage({ type: 'error', text: 'تعذر استعادة الملف. يرجى التأكد من صحة ملف النسخة الاحتياطية.' });
    }
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setPendingRestoreJson(parsed);
      } catch {
        soundManager.playWarningBeep();
        setStatusMessage({ type: 'error', text: 'صيغة الملف المختار غير صالحة.' });
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreClick = async () => {
    soundManager.playScanBeep();
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await FilePicker.pickFiles({
          types: ['*/*'],
          readData: true,
        });

        if (result.files && result.files.length > 0) {
          const pickedFile = result.files[0];
          let jsonContent = '';

          if (pickedFile.data) {
            try {
              const binString = atob(pickedFile.data);
              const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
              jsonContent = new TextDecoder().decode(bytes);
            } catch {
              jsonContent = atob(pickedFile.data);
            }
          } else if (pickedFile.path) {
            const res = await fetch(pickedFile.path);
            jsonContent = await res.text();
          }

          if (jsonContent) {
            const parsed = JSON.parse(jsonContent);
            setPendingRestoreJson(parsed);
            return;
          }
        }
      } catch (err) {
        console.warn('Native FilePicker error or cancelled, falling back to standard input:', err);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
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
  const activeInvoices = invoices.filter(inv => inv.status !== 'refunded');
  const lowStockProducts = activeProducts.filter(p => p.stock <= p.minStock);

  const totalSales = activeInvoices.reduce((sum, inv) => sum + inv.finalAmount, 0);
  const totalDebts = activeCustomers.reduce((sum, cust) => sum + cust.totalDebt, 0);

  // Cashbox / Treasury Balance (Unified with Transactions Ledger)
  const hasSaleTransactions = transactions.some(t => t.type === 'sale');
  const totalInflows = hasSaleTransactions
    ? transactions.filter(t => t.type === 'sale' || t.type === 'payment' || t.type === 'maintenance').reduce((sum, t) => sum + t.amount, 0)
    : activeInvoices.filter(inv => inv.type === 'cash').reduce((sum, inv) => sum + inv.finalAmount, 0) +
      transactions.filter(t => t.type === 'payment' || t.type === 'maintenance').reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const cashboxBalance = totalInflows - expenses;

  // Format helper
  const fmt = (num: number) => {
    const symbol = selectedCurr?.symbol || mobileCurrencySymbol || settings.currency;
    if (isPrivacyMode) return '•••• ' + symbol;
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
    <div id="mobile_dashboard_view_isolated" className="space-y-4 pb-20">
      
      {/* Inline Notification Banner */}
      {statusMessage && (
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="px-2 py-0.5 rounded bg-white/80 text-slate-600 text-[10px]"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Inline Restore Confirmation Modal */}
      {pendingRestoreJson && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3 shadow-sm">
          <div className="text-xs font-bold text-amber-900">
            تنبيه هام: استعادة النسخة الاحتياطية ستقوم باستبدال البيانات الحالية بالبيانات الموجودة في الملف المختار. هل تريد المتابعة؟
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={confirmFileRestore}
              className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
            >
              نعم، استعادة البيانات الآن
            </button>
            <button
              onClick={() => setPendingRestoreJson(null)}
              className="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* 1. STORE HEADER & CURRENCY BAR */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          {settings.storeLogoUrl ? (
            <img 
              src={settings.storeLogoUrl} 
              alt="شعار المتجر" 
              className="w-10 h-10 rounded-xl object-contain border border-slate-200 bg-white p-0.5" 
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0">
              {settings.storeName ? settings.storeName.charAt(0) : 'س'}
            </div>
          )}
          <div>
            <h2 className="text-sm font-black text-slate-900 leading-tight">
              {settings.storeName && settings.storeName.trim() ? settings.storeName : 'نظام سند المحاسبي'}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              ملخص الحسابات والأقسام السريعة
            </p>
          </div>
        </div>

        {/* Multi-Currency Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {activeCurrencies.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                soundManager.playScanBeep();
                setMobileCurrencySymbol(c.symbol);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                mobileCurrencySymbol === c.symbol
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {c.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* 2. FINANCIAL SUMMARY METRICS */}
      <section className="grid grid-cols-3 gap-2">
        {/* Sales */}
        <button
          type="button"
          onClick={() => handleNavClick('reports')}
          className="bg-white rounded-2xl p-3 border border-slate-200 text-right hover:border-emerald-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-500">المبيعات</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xs sm:text-sm font-black font-mono tabular-nums text-emerald-600 truncate">
            {fmt(totalSales)}
          </p>
          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
            {activeInvoices.length} فاتورة
          </span>
        </button>

        {/* Cashbox */}
        <button
          type="button"
          onClick={() => handleNavClick('transactions')}
          className="bg-white rounded-2xl p-3 border border-slate-200 text-right hover:border-blue-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-500">رصيد الصندوق</span>
            <Wallet className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className={`text-xs sm:text-sm font-black font-mono tabular-nums truncate ${
            cashboxBalance >= 0 ? 'text-blue-600' : 'text-rose-600'
          }`}>
            {fmt(cashboxBalance)}
          </p>
          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
            اليومية والسندات
          </span>
        </button>

        {/* Debts */}
        <button
          type="button"
          onClick={() => handleNavClick('customers')}
          className="bg-white rounded-2xl p-3 border border-slate-200 text-right hover:border-rose-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-500">ديون العملاء</span>
            <Users className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-xs sm:text-sm font-black font-mono tabular-nums text-rose-600 truncate">
            {fmt(totalDebts)}
          </p>
          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
            {activeCustomers.filter(c => c.totalDebt > 0).length} عميل مدين
          </span>
        </button>
      </section>

      {/* 3. PRIMARY POS CTA + SMART ALERTS */}
      <div className="space-y-2.5">
        <button
          onClick={() => handleNavClick('pos')}
          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm shadow-sm flex items-center justify-between transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div className="text-right">
              <div className="text-sm font-black">فتح نقطة البيع السريعة (POS)</div>
              <div className="text-[11px] text-emerald-100 font-medium">إصدار فاتورة بيع نقدية أو آجلة</div>
            </div>
          </div>
          <ArrowLeft className="w-5 h-5 text-white/90" />
        </button>

        {lowStockProducts.length > 0 && (
          <button
            onClick={() => handleNavClick('inventory')}
            className="w-full p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-right transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-bold text-amber-900">
                تنبيه المخزن: يوجد {lowStockProducts.length} أصناف قاربت على النفاد
              </span>
            </div>
            <span className="text-[11px] font-bold text-amber-700 underline">عرض</span>
          </button>
        )}
      </div>

      {/* 4. GROUP 1: العمليات اليومية والحسابات */}
      <section className="space-y-2">
        <h3 className="text-xs font-extrabold text-slate-500 px-1">
          العمليات اليومية والحسابات
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {/* اليومية والسندات */}
          <button
            onClick={() => handleNavClick('transactions')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-blue-300 flex items-center gap-3 text-right transition cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">اليومية والسندات</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">قبض، صرف، ومشتريات</div>
            </div>
          </button>

          {/* العملاء والديون */}
          <button
            onClick={() => handleNavClick('customers')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-sky-300 flex items-center gap-3 text-right transition cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">العملاء والديون</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">كشف الحساب والتحصيل</div>
            </div>
          </button>

          {/* المخزن والأصناف */}
          <button
            onClick={() => handleNavClick('inventory')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-purple-300 flex items-center gap-3 text-right transition cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">المخزن والأصناف</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">{activeProducts.length} صنف مسجل</div>
            </div>
          </button>

          {/* الأرباح والتقارير */}
          <button
            onClick={() => handleNavClick('reports')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-rose-300 flex items-center gap-3 text-right transition cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">الأرباح والتقارير</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">صافي الربح والمبيعات</div>
            </div>
          </button>
        </div>
      </section>

      {/* 5. GROUP 2: الصيانة، الجرد، والخدمات المتقدمة */}
      <section className="space-y-2">
        <h3 className="text-xs font-extrabold text-slate-500 px-1">
          الصيانة والجرد والخدمات
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {/* قسم الصيانة */}
          <button
            onClick={() => handleNavClick('maintenance')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-orange-300 flex items-center gap-3 text-right transition cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">قسم الصيانة</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">متابعة الأجهزة والورشة</div>
            </div>
          </button>

          {/* استلام جهاز صيانة */}
          <button
            onClick={() => handleNavClick('device_receipt')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-blue-300 flex items-center gap-3 text-right transition cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">كارت استلام جهاز</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">إيصال استلام صيانة</div>
            </div>
          </button>

          {/* جرد وحصر المنشأة */}
          <button
            onClick={() => handleNavClick('stock_audit')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-amber-300 flex items-center gap-3 text-right transition cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">جرد المنشأة</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">مطابقة وتسوية المخزون</div>
            </div>
          </button>

          {/* التشخيص الذكي */}
          <button
            onClick={() => handleNavClick('diagnostic')}
            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 flex items-center gap-3 text-right transition cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">التشخيص الذكي</div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">فحص الأعطال وقطع الغيار</div>
            </div>
          </button>
        </div>
      </section>

      {/* 6. GROUP 3: الإدارة، الموظفين، والإعدادات */}
      <section className="space-y-2">
        <h3 className="text-xs font-extrabold text-slate-500 px-1">
          الإدارة والموظفين والإعدادات
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {/* العمال والرواتب */}
          <button
            onClick={() => handleNavClick('employees')}
            className="bg-white p-3 rounded-2xl border border-slate-200 hover:border-teal-300 flex items-center gap-2.5 text-right transition cursor-pointer"
          >
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">العمال والرواتب</div>
              <div className="text-[10px] text-slate-500 truncate">السلف والأجور</div>
            </div>
          </button>

          {/* دفتر العملات */}
          <button
            onClick={() => handleNavClick('phone_ledger')}
            className="bg-white p-3 rounded-2xl border border-slate-200 hover:border-emerald-300 flex items-center gap-2.5 text-right transition cursor-pointer"
          >
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <Coins className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">دفتر العملات</div>
              <div className="text-[10px] text-slate-500 truncate">تعدد العملات</div>
            </div>
          </button>

          {/* ضبط الطابعة والفواتير */}
          <button
            onClick={() => handleNavClick('printer_settings')}
            className="bg-white p-3 rounded-2xl border border-slate-200 hover:border-blue-300 flex items-center gap-2.5 text-right transition cursor-pointer"
          >
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">الطابعة والفواتير</div>
              <div className="text-[10px] text-slate-500 truncate">تصميم الفاتورة</div>
            </div>
          </button>

          {/* المستخدمين والصلاحيات */}
          <button
            onClick={() => handleNavClick('users')}
            className="bg-white p-3 rounded-2xl border border-slate-200 hover:border-purple-300 flex items-center gap-2.5 text-right transition cursor-pointer"
          >
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">المستخدمين</div>
              <div className="text-[10px] text-slate-500 truncate">الصلاحيات والرقابة</div>
            </div>
          </button>

          {/* إعدادات النظام */}
          <button
            onClick={() => handleNavClick('settings')}
            className="bg-white p-3 rounded-2xl border border-slate-200 hover:border-slate-400 flex items-center gap-2.5 text-right transition cursor-pointer col-span-2 sm:col-span-1"
          >
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">إعدادات النظام</div>
              <div className="text-[10px] text-slate-500 truncate">المتجر والمظهر والتصفير</div>
            </div>
          </button>
        </div>
      </section>

      {/* 7. QUICK BACKUP & RESTORE STRIP */}
      <section className="bg-white rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between gap-2">
        <div className="text-right">
          <h4 className="text-xs font-bold text-slate-800">النسخ الاحتياطي السريع</h4>
          <p className="text-[10px] text-slate-500">حفظ أو استرجاع نسخة كاملة من بياناتك</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onBackupData) onBackupData();
            }}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>حفظ نسخة</span>
          </button>

          <button
            type="button"
            onClick={handleRestoreClick}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>استعادة</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,*/*"
            onChange={handleFileRestore}
            className="hidden"
          />
        </div>
      </section>

    </div>
  );
}
