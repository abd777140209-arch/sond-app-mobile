/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  Wallet, 
  ArrowDownLeft, 
  AlertCircle, 
  Award, 
  Phone, 
  BarChart3, 
  ArrowLeft, 
  Bell, 
  AlertTriangle, 
  ShieldAlert, 
  Sparkles, 
  X, 
  Volume2, 
  Bot, 
  CheckCircle2,
  ShoppingCart,
  Wrench,
  Briefcase,
  ClipboardCheck,
  History,
  Settings as SettingsIcon
} from 'lucide-react';
import { Product, Customer, Invoice, Payment, Transaction, SystemSettings, Employee } from '../types';
import { soundManager } from '../utils/sound';

interface DashboardProps {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  transactions: Transaction[];
  settings: SystemSettings;
  employees?: Employee[];
  setActiveTab: (tab: string) => void;
  isPrivacyMode?: boolean;
}

export default function Dashboard({
  products,
  customers,
  invoices,
  payments,
  transactions,
  settings,
  employees = [],
  setActiveTab,
  isPrivacyMode = false
}: DashboardProps) {

  const [showZaraModal, setShowZaraModal] = useState(false);

  // Speech synthesis audio summary
  const handleSpeakSummary = () => {
    if (!('speechSynthesis' in window)) {
      alert('ميزة التقرير الصوتي غير مدعومة في متصفحك الحالي.');
      return;
    }
    window.speechSynthesis.cancel();
    const text = `أهلاً بك! أنا زارا، المساعد المحاسبي الذكي لنظام سند في نشاطك التجاري ${settings.storeName || 'سند'}. إليك التقرير المالي الصوتي المباشر: إجمالي المبيعات بلغ ${totalSales.toLocaleString()} ${settings.currency}. إجمالي ديون العملاء المتبقية ${totalDebts.toLocaleString()} ${settings.currency}. عدد الأصناف بالمخزن ${activeProducts.length} صنف بقيمة أرباح متوقعة قدرها ${expectedProfit.toLocaleString()} ${settings.currency}. شكراً لاستخدامك نظام سند المحاسبي.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // Calculations
  const activeProducts = products.filter(p => p.isDeleted !== true);
  const activeCustomers = customers.filter(c => c.isDeleted !== true);

  const totalSales = invoices.reduce((sum, inv) => sum + inv.finalAmount, 0);
  const totalDebts = activeCustomers.reduce((sum, cust) => sum + cust.totalDebt, 0);
  
  // Total Inventory Value (Cost vs Selling)
  const inventoryCostValue = activeProducts.reduce((sum, p) => sum + (p.costPrice * p.stock), 0);
  const inventoryRetailValue = activeProducts.reduce((sum, p) => sum + (p.sellingPrice * p.stock), 0);
  const expectedProfit = inventoryRetailValue - inventoryCostValue;

  const lowStockProducts = activeProducts.filter(p => p.stock <= p.minStock);

  // Top debtor customers
  const topDebtors = [...activeCustomers]
    .filter(c => c.totalDebt > 0)
    .sort((a, b) => b.totalDebt - a.totalDebt)
    .slice(0, 4);

  // High urgency debts (> 50,000 or top debtors)
  const highDebtCustomers = activeCustomers.filter(c => c.totalDebt >= 50000);

  const deviceMode = settings.deviceMode || 'mobile';
  const isMobileMode = deviceMode === 'mobile';

  // Multi-Currency Selection
  const activeCurrencies = settings?.currencies && settings.currencies.length > 0
    ? settings.currencies
    : [
        { id: 'YER', code: 'YER', name: 'الريال اليمني', symbol: 'ر.ي', exchangeRate: 1, isBase: true },
        { id: 'SAR', code: 'SAR', name: 'الريال السعودي', symbol: 'ر.س', exchangeRate: 140, isBase: false },
        { id: 'USD', code: 'USD', name: 'الدولار الأمريكي', symbol: '$', exchangeRate: 530, isBase: false },
      ];

  const [dashCurrencySymbol, setDashCurrencySymbol] = useState<string>(
    settings?.selectedCurrencySymbol || settings?.currency || 'ر.ي'
  );

  const selectedCurr = activeCurrencies.find(c => c.symbol === dashCurrencySymbol || c.code === dashCurrencySymbol) || activeCurrencies[0];
  const currRate = selectedCurr?.exchangeRate && selectedCurr.exchangeRate > 0 ? selectedCurr.exchangeRate : 1;

  // Format currency with Privacy mode support & Multi-currency conversion
  const fmt = (num: number) => {
    const symbol = selectedCurr?.symbol || dashCurrencySymbol || settings.currency;
    if (isPrivacyMode) return '**** ' + symbol;
    const converted = selectedCurr?.isBase ? num : (num / currRate);
    const formatted = selectedCurr?.isBase
      ? Math.round(converted).toLocaleString()
      : converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${symbol}`;
  };


  const maxDebtorVal = topDebtors[0]?.totalDebt || 1;

  return (
    <div id="dashboard_tab_view" className="space-y-3.5 sm:space-y-5 md:space-y-6 pb-20 md:pb-28">
      
      {/* 1. Welcome Header Banner */}
      <div className="p-3.5 sm:p-5 md:p-6 rounded-2xl md:rounded-3xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/40 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 relative overflow-hidden transition-all">
        <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[11px] md:text-xs font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              🏪 {settings.storeName && settings.storeName.trim() ? settings.storeName : 'نظام سند المحاسبي الذكي'}
            </span>
          </div>
          <h1 className="text-lg md:text-2xl font-black text-slate-800 dark:text-white">
            لوحة التحكم المحاسبية والمالية الذكية
          </h1>
          <p className="text-slate-500 dark:text-gray-400 text-[11px] md:text-xs mt-0.5">
            نظام سند المحاسبي • المبيعات، الأرباح، حركة المخزن، والديون المباشرة
          </p>
        </div>

        {/* Developer Credit & Profit Report Shortcut & Currency Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* Multi-Currency Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold px-1 hidden sm:inline">العملة:</span>
            {activeCurrencies.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  soundManager.playScanBeep();
                  setDashCurrencySymbol(c.symbol);
                }}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dashCurrencySymbol === c.symbol
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {c.symbol}
              </button>
            ))}
          </div>

          {/* Zara AI Assistant Button */}
          <button
            onClick={() => {
              soundManager.playSuccessChime();
              setShowZaraModal(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-600 to-[#C5A862] hover:from-amber-400 hover:to-[#d4b771] text-black px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
            title="المساعد المحاسبي الذكي زارا"
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg sm:rounded-xl bg-black/20 flex items-center justify-center font-black text-xs">
              ✨
            </div>
            <div className="text-right">
              <div className="font-extrabold text-black flex items-center gap-1">
                <span>زارا</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-black/20 text-black">AI</span>
              </div>
              <div className="text-[9px] text-black/80 font-bold">المساعد المحاسبي الذكي</div>
            </div>
          </button>

          {/* Voice Report Button */}
          <button
            onClick={handleSpeakSummary}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95"
            title="استمع للملخص المالي صوتاً"
          >
            <span className="text-sm sm:text-base">🔊</span>
            <div className="text-right">
              <div className="text-white">التقرير الصوتي</div>
              <div className="text-[9px] text-blue-200">قراءة صوتية ذكية</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className="flex items-center justify-between gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/20 group"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-200 group-hover:scale-110 transition-transform" />
              <div className="text-right">
                <div className="text-white">التقرير البياني للأرباح 📊</div>
                <div className="text-[10px] text-emerald-100 font-normal hidden sm:block">استعراض تحليل المبيعات بالرسم البياني</div>
              </div>
            </div>
            <ArrowLeft className="w-4 h-4 text-white group-hover:-translate-x-1 transition-transform" />
          </button>


          <div className="hidden lg:flex items-center gap-3 bg-slate-50 dark:bg-[#1A2838]/80 border border-slate-200 dark:border-sky-800/40 px-4 py-2 rounded-2xl text-xs">
            <Award className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <div>
              <div className="text-slate-700 dark:text-gray-200 font-bold">تطوير: م. عبدالمجيد المحواشي</div>
              <div className="text-slate-400 dark:text-gray-400 text-[10px]">نظام سند المحاسبي v2.4</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Smart System Alerts Card (التنبيهات الذكية) */}
      {(lowStockProducts.length > 0 || highDebtCustomers.length > 0) && (
        <div className="p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-500/30 shadow-md space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs sm:text-sm">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 animate-bounce" />
              <span>تنبيهات النظام الذكية 🔔</span>
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
              {lowStockProducts.length + highDebtCustomers.length} تنبيهات تحتاج متابعة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {lowStockProducts.length > 0 && (
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white text-xs">نقص مخزون الأصناف</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      يوجد {lowStockProducts.length} صنف وصل للحد الأدنى للمخزون
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold text-[10px] sm:text-[11px] hover:bg-amber-600 transition"
                >
                  استعراض الأصناف
                </button>
              </div>
            )}

            {highDebtCustomers.length > 0 && (
              <div className="p-2.5 sm:p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white text-xs">مديونيات عالية مستحقة</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      يوجد {highDebtCustomers.length} عملاء تتجاوز ديونهم 50,000
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('customers')}
                  className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold text-[10px] sm:text-[11px] hover:bg-rose-600 transition"
                >
                  دفتر التحصيل
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. KPI Financial Cards */}
      <div className={isMobileMode ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-5"}>
        
        {/* Total Sales */}
        <div className="p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-emerald-400/50 transition-all duration-300 shadow-md group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] sm:text-[11px] md:text-xs text-slate-500 dark:text-gray-400 font-bold">إجمالي المبيعات</span>
              <h3 className="text-sm sm:text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {fmt(totalSales)}
              </h3>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-slate-500 dark:text-gray-400 mt-2 flex justify-between">
            <span>عدد الفواتير:</span>
            <span className="font-bold text-slate-800 dark:text-white">{invoices.length}</span>
          </div>
        </div>

        {/* Total Debts */}
        <div className="p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-rose-400/50 transition-all duration-300 shadow-md group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] sm:text-[11px] md:text-xs text-slate-500 dark:text-gray-400 font-bold">الديون المستحقة</span>
              <h3 className="text-sm sm:text-lg md:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {fmt(totalDebts)}
              </h3>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-slate-500 dark:text-gray-400 mt-2 flex justify-between">
            <span>الدائنون:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              {activeCustomers.filter(c => c.totalDebt > 0).length} عملاء
            </span>
          </div>
        </div>

        {/* Inventory Capital Value */}
        <div className="p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-sky-400/50 transition-all duration-300 shadow-md group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] sm:text-[11px] md:text-xs text-slate-500 dark:text-gray-400 font-bold">رأس مال المخزون</span>
              <h3 className="text-sm sm:text-lg md:text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
                {fmt(inventoryCostValue)}
              </h3>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-slate-500 dark:text-gray-400 mt-2 flex justify-between">
            <span>قيمة البيع:</span>
            <span className="font-bold text-sky-600 dark:text-sky-300">{fmt(inventoryRetailValue)}</span>
          </div>
        </div>

        {/* Expected Net Profit */}
        <div className="p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-indigo-400/50 transition-all duration-300 shadow-md group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] sm:text-[11px] md:text-xs text-slate-500 dark:text-gray-400 font-bold">أرباح المخزون</span>
              <h3 className="text-sm sm:text-lg md:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {fmt(expectedProfit)}
              </h3>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-slate-500 dark:text-gray-400 mt-2 flex justify-between">
            <span>هامش الربح:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-300">
              {inventoryCostValue ? Math.round((expectedProfit / inventoryCostValue) * 100) : 0}%
            </span>
          </div>
        </div>

      </div>

      {/* 3.5 ULTRA-MODERN MOBILE GRID CARDS FOR QUICK NAVIGATION */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>الوصول السريع للأقسام الرئيسية</span>
          </h2>
          <span className="text-[10px] text-slate-400 font-bold">تطبيق سند الجوال</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* POS Sales */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('pos');
            }}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-right flex flex-col justify-between h-28 relative overflow-hidden group cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-md">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/20 text-white backdrop-blur-md">
                فوري ⚡
              </span>
            </div>
            <div>
              <div className="font-black text-sm text-white">نقطة البيع POS</div>
              <p className="text-[10px] text-blue-100">فواتير مبيعات سريعة</p>
            </div>
          </button>

          {/* Inventory */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('inventory');
            }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-sky-500/50 shadow-sm active:scale-95 transition-all text-right flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                <Package className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
                {activeProducts.length} صنف
              </span>
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">المستودع والمخزن</div>
              <p className="text-[10px] text-slate-400">إدارة البضائع والأسعار</p>
            </div>
          </button>

          {/* Maintenance */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('maintenance');
            }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-amber-500/50 shadow-sm active:scale-95 transition-all text-right flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <Wrench className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                ورشة صيانة
              </span>
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">قسم الصيانة</div>
              <p className="text-[10px] text-slate-400">كروت واستلام الأجهزة</p>
            </div>
          </button>

          {/* Customers & Debts */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('customers');
            }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-rose-500/50 shadow-sm active:scale-95 transition-all text-right flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                <Users className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                {activeCustomers.filter(c => c.totalDebt > 0).length} مدينين
              </span>
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">العملاء والديون</div>
              <p className="text-[10px] text-slate-400">كشوفات الحساب والتحصيل</p>
            </div>
          </button>

          {/* Employees & Payroll */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('employees');
            }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-purple-500/50 shadow-sm active:scale-95 transition-all text-right flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                {employees.length} موظف
              </span>
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">العمال والرواتب</div>
              <p className="text-[10px] text-slate-400">السلف وصرف المرتبات</p>
            </div>
          </button>

          {/* Profit Reports */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('reports');
            }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-emerald-500/50 shadow-sm active:scale-95 transition-all text-right flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                تقارير 📊
              </span>
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">الأرباح والتقارير</div>
              <p className="text-[10px] text-slate-400">تحليل المبيعات الشامل</p>
            </div>
          </button>

          {/* Stock Audit */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('stock_audit');
            }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-indigo-500/50 shadow-sm active:scale-95 transition-all text-right flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                حصر جرد
              </span>
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">جرد المنشأة</div>
              <p className="text-[10px] text-slate-400">مطابقة الكميات الميدانية</p>
            </div>
          </button>

          {/* Ledger / Transactions */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('transactions');
            }}
            className="p-4 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-slate-500/50 shadow-sm active:scale-95 transition-all text-right flex flex-col justify-between h-28 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <History className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {transactions.length} حركات
              </span>
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">دفتر القيود والأرشيف</div>
              <p className="text-[10px] text-slate-400">المصاريف وأرشيف الفواتير</p>
            </div>
          </button>
        </div>
      </div>

      {/* Zara AI Financial Assistant Modal */}
      {showZaraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#0F1824] border border-[#C5A862]/50 rounded-3xl p-6 shadow-2xl text-right relative space-y-5 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowZaraModal(false)}
              className="absolute top-4 left-4 text-gray-400 hover:text-white p-1.5 rounded-full bg-slate-800/60 hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-[#C5A862] flex items-center justify-center text-black font-black text-xl shadow-lg">
                ✨
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>زارا - المساعد المحاسبي الذكي</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    نظام سند v2.4
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  تحليلات وإرشادات فورية ذكية لوحة التحكم المالي والمبيعات
                </p>
              </div>
            </div>

            {/* Zara Welcome Voice Prompt */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-300 font-bold text-xs">
                  <Bot className="w-4 h-4 text-sky-400" />
                  <span>رسالة المساعد الذكي زارا:</span>
                </div>
                <button
                  onClick={handleSpeakSummary}
                  className="flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>قراءة صوتاً 🔊</span>
                </button>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed font-medium">
                "أهلاً بك! أنا زارا، المساعد المحاسبي الذكي لنظام سند في نشاطك التجاري <strong className="text-amber-400">{settings.storeName || 'سند'}</strong>. يسعدني متابعة أداء مؤسستك وتزويدك بالتقارير المباشرة."
              </p>
            </div>

            {/* Real-Time Financial Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#132030] border border-gray-800">
                <div className="text-[11px] text-gray-400 font-bold mb-1">إجمالي المبيعات الموثقة</div>
                <div className="text-base font-black text-emerald-400">{fmt(totalSales)}</div>
                <div className="text-[10px] text-emerald-300/80 mt-1">من واقع {invoices.length} فاتورة</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#132030] border border-gray-800">
                <div className="text-[11px] text-gray-400 font-bold mb-1">ديون العملاء المتبقية</div>
                <div className="text-base font-black text-rose-400">{fmt(totalDebts)}</div>
                <div className="text-[10px] text-rose-300/80 mt-1">على {topDebtors.length} عملاء متأخرين</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#132030] border border-gray-800">
                <div className="text-[11px] text-gray-400 font-bold mb-1">الأصناف المسجلة بالمخزن</div>
                <div className="text-base font-black text-sky-400">{activeProducts.length} صنف</div>
                <div className="text-[10px] text-sky-300/80 mt-1">بقيمة {fmt(inventoryRetailValue)}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#132030] border border-gray-800">
                <div className="text-[11px] text-gray-400 font-bold mb-1">الأرباح المتوقعة من المخزون</div>
                <div className="text-base font-black text-[#C5A862]">{fmt(expectedProfit)}</div>
                <div className="text-[10px] text-[#C5A862]/80 mt-1">هامش الأرباح التقديري</div>
              </div>
            </div>

            {/* Zara Recommendations */}
            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-2 text-xs">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>توصيات زارا الذكية لهذا اليوم:</span>
              </div>
              <ul className="space-y-1 text-gray-300 text-[11px] list-disc list-inside">
                {highDebtCustomers.length > 0 ? (
                  <li>تنبيه: توجد ديون كبيرة تفوق 50,000 {settings.currency}. يرجى التواصل مع العملاء لتحصيل المستحقات.</li>
                ) : (
                  <li>الديون تحت السيطرة ضمن الحدود الآمنة.</li>
                )}
                {lowStockProducts.length > 0 ? (
                  <li>تنبيه: يوجد عدد {lowStockProducts.length} أصناف وصلت للحد الأدنى من المخزون. يفضل إعادة الطلب.</li>
                ) : (
                  <li>مستويات المخزون ممتازة لجميع الأصناف.</li>
                )}
                <li>يمكنك الانتقال لقسم "جرد وحصر المنشأة" لمطابقة الكميات الميدانية تلقائياً.</li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setShowZaraModal(false);
                  setActiveTab('stock_audit');
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-[#C5A862] hover:from-amber-400 hover:to-[#d4b771] text-black font-extrabold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>الانتقال لجرد وحصر المنشأة 📦</span>
              </button>
              
              <button
                onClick={() => setShowZaraModal(false)}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
