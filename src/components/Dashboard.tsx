/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TrendingUp, Users, Package, Wallet, ArrowDownLeft, AlertCircle, Award, Phone, BarChart3, ArrowLeft, Bell, AlertTriangle, ShieldAlert, Sparkles, X, Volume2, Bot, CheckCircle2 } from 'lucide-react';
import { Product, Customer, Invoice, Payment, Transaction, SystemSettings } from '../types';
import { soundManager } from '../utils/sound';

interface DashboardProps {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  transactions: Transaction[];
  settings: SystemSettings;
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

  // Format currency with Privacy mode support
  const fmt = (num: number) => {
    if (isPrivacyMode) return '**** ' + settings.currency;
    return num.toLocaleString() + ' ' + settings.currency;
  };


  const maxDebtorVal = topDebtors[0]?.totalDebt || 1;

  return (
    <div id="dashboard_tab_view" className="space-y-6">
      
      {/* 1. Welcome Header Banner */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/40 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden transition-all">
        <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              🏪 {settings.storeName || 'النشاط التجاري الموثق'}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white">
            لوحة التحكم المحاسبية والمالية الذكية
          </h1>
          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">
            نظام سند المحاسبي • المبيعات، الأرباح، حركة المخزن، والديون المباشرة
          </p>
        </div>

        {/* Developer Credit & Profit Report Shortcut */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Zara AI Assistant Button */}
          <button
            onClick={() => {
              soundManager.playSuccessChime();
              setShowZaraModal(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-600 to-[#C5A862] hover:from-amber-400 hover:to-[#d4b771] text-black px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
            title="المساعد المحاسبي الذكي زارا"
          >
            <div className="w-6 h-6 rounded-xl bg-black/20 flex items-center justify-center font-black text-xs">
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
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95"
            title="استمع للملخص المالي صوتاً"
          >
            <span className="text-base">🔊</span>
            <div className="text-right">
              <div className="text-white">التقرير الصوتي</div>
              <div className="text-[9px] text-blue-200">قراءة صوتية ذكية</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className="flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/20 group"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-200 group-hover:scale-110 transition-transform" />
              <div className="text-right">
                <div className="text-white">التقرير البياني للأرباح 📊</div>
                <div className="text-[10px] text-emerald-100 font-normal">استعراض تحليل المبيعات بالرسم البياني</div>
              </div>
            </div>
            <ArrowLeft className="w-4 h-4 text-white group-hover:-translate-x-1 transition-transform" />
          </button>


          <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#1A2838]/80 border border-slate-200 dark:border-sky-800/40 px-4 py-2 rounded-2xl text-xs">
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
        <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-500/30 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <Bell className="w-5 h-5 text-amber-500 animate-bounce" />
              <span>تنبيهات النظام الذكية 🔔</span>
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {lowStockProducts.length + highDebtCustomers.length} تنبيهات تحتاج متابعة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {lowStockProducts.length > 0 && (
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">نقص مخزون الأصناف</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      يوجد {lowStockProducts.length} صنف وصل للحد الأدنى للمخزون
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="px-3 py-1 rounded-lg bg-amber-500 text-white font-bold text-[11px] hover:bg-amber-600 transition"
                >
                  استعراض الأصناف
                </button>
              </div>
            )}

            {highDebtCustomers.length > 0 && (
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">مديونيات عالية مستحقة</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      يوجد {highDebtCustomers.length} عملاء تتجاوز ديونهم 50,000
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('customers')}
                  className="px-3 py-1 rounded-lg bg-rose-500 text-white font-bold text-[11px] hover:bg-rose-600 transition"
                >
                  دفتر التحصيل
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. KPI Financial Cards */}
      <div className={isMobileMode ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5"}>
        
        {/* Total Sales */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-emerald-400/50 transition-all duration-300 shadow-md group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] md:text-xs text-slate-500 dark:text-gray-400 font-bold">إجمالي المبيعات</span>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {fmt(totalSales)}
              </h3>
            </div>
            <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-slate-500 dark:text-gray-400 mt-3 flex justify-between">
            <span>عدد الفواتير الصادرة:</span>
            <span className="font-bold text-slate-800 dark:text-white">{invoices.length} فاتورة</span>
          </div>
        </div>

        {/* Total Debts */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-rose-400/50 transition-all duration-300 shadow-md group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] md:text-xs text-slate-500 dark:text-gray-400 font-bold">الديون والذمم المستحقة</span>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {fmt(totalDebts)}
              </h3>
            </div>
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-slate-500 dark:text-gray-400 mt-3 flex justify-between">
            <span>العملاء الدائنون:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              {activeCustomers.filter(c => c.totalDebt > 0).length} عملاء
            </span>
          </div>
        </div>

        {/* Inventory Capital Value */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-sky-400/50 transition-all duration-300 shadow-md group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] md:text-xs text-slate-500 dark:text-gray-400 font-bold">رأس مال المخزون الحالي</span>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-sky-600 dark:text-sky-400 mt-1">
                {fmt(inventoryCostValue)}
              </h3>
            </div>
            <div className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-slate-500 dark:text-gray-400 mt-3 flex justify-between">
            <span>قيمة البيع المتوقعة:</span>
            <span className="font-bold text-sky-600 dark:text-sky-300">{fmt(inventoryRetailValue)}</span>
          </div>
        </div>

        {/* Expected Net Profit */}
        <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 hover:border-indigo-400/50 transition-all duration-300 shadow-md group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] md:text-xs text-slate-500 dark:text-gray-400 font-bold">الأرباح المتوقعة من المخزون</span>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {fmt(expectedProfit)}
              </h3>
            </div>
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-slate-500 dark:text-gray-400 mt-3 flex justify-between">
            <span>هامش الربح التجاري:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-300">
              {inventoryCostValue ? Math.round((expectedProfit / inventoryCostValue) * 100) : 0}%
            </span>
          </div>
        </div>

      </div>

      {/* 4. Debt Analytics & Low Stock Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Debtors Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                أكبر مديونيات العملاء للتحصيل
              </h2>
              <button 
                onClick={() => setActiveTab('customers')} 
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer font-bold"
              >
                دفتر التحصيل الكامل ←
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-6">
              تحليل مالي مباشر لأعلى مبالغ الذمم والديون المترتبة على العملاء لسرعة المتابعة والتحصيل.
            </p>

            <div className="space-y-4">
              {topDebtors.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  لا توجد مديونيات مستحقة حالياً. ممتاز!
                </div>
              ) : (
                topDebtors.map(debtor => {
                  const pct = Math.max(8, (debtor.totalDebt / maxDebtorVal) * 100);
                  return (
                    <div key={debtor.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-gray-200">{debtor.name}</span>
                        <span className="font-bold font-mono text-rose-600 dark:text-rose-400">{fmt(debtor.totalDebt)}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-[#182535] h-3 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${pct}%` }}
                          className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-500 shadow-sm"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-gray-800 text-xs text-slate-500 dark:text-gray-400 flex justify-between items-center">
            <span>مجموع ديون العملاء الإجمالي:</span>
            <span className="font-black text-rose-600 dark:text-rose-400 text-sm font-mono">{fmt(totalDebts)}</span>
          </div>
        </div>

        {/* Low Stock Items List */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              تنبيهات نقص المخزون
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
              الأصناف التي وصلت إلى حد النقص الأدنى:
            </p>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {lowStockProducts.length === 0 ? (
                <div className="py-8 text-center text-emerald-600 dark:text-emerald-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center border border-emerald-300 dark:border-emerald-800 text-emerald-600">✓</div>
                  جميع مستويات المخزون ممتازة!
                </div>
              ) : (
                lowStockProducts.map(p => (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-rose-900/30 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-800 dark:text-gray-200">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">باركود: {p.barcode}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-rose-600 dark:text-rose-400 font-bold font-mono">المتبقي: {p.stock}</div>
                      <div className="text-[10px] text-slate-400">الحد الأدنى: {p.minStock}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('inventory')}
            className="w-full mt-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition-all cursor-pointer text-center shadow-md"
          >
            إضافة كميات للمستودع
          </button>
        </div>

      </div>

      {/* 5. Recent Transactions Log */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0F1824] border border-slate-200 dark:border-sky-900/30 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
            دفتر العمليات والقيود الأخيرة
          </h2>
          <button 
            onClick={() => setActiveTab('transactions')} 
            className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-bold cursor-pointer"
          >
            جميع القيود ←
          </button>
        </div>

        {/* Mobile Mode Card View vs Desktop Table View */}
        {isMobileMode ? (
          <div className="space-y-2.5">
            {transactions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200">
                لا توجد أي قيود مسجلة بعد.
              </div>
            ) : (
              [...transactions].reverse().slice(0, 5).map(t => (
                <div 
                  key={t.id} 
                  className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-sky-900/30 flex items-center justify-between text-xs transition hover:bg-white"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 dark:text-gray-100">{t.description}</div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                        t.type === 'sale' 
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200' 
                          : t.type === 'payment'
                          ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border border-sky-200'
                          : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200'
                      }`}>
                        {t.type === 'sale' ? 'مبيعات' : t.type === 'payment' ? 'سداد ديون' : 'مصروف'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(t.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className={`text-left font-black font-mono text-sm ${
                    t.type === 'sale' ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'
                  }`}>
                    {t.type === 'sale' ? '+' : ''}{fmt(t.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-gray-800 text-slate-400">
                  <th className="pb-3 pr-2">تفاصيل العملية</th>
                  <th className="pb-3 text-center">التاريخ والوقت</th>
                  <th className="pb-3 text-center">النوع</th>
                  <th className="pb-3 pl-2 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800/50">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      لا توجد أي قيود مسجلة بعد.
                    </td>
                  </tr>
                ) : (
                  [...transactions].reverse().slice(0, 5).map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                      <td className="py-3 pr-2 font-bold text-slate-800 dark:text-gray-200">
                        {t.description}
                      </td>
                      <td className="py-3 text-center text-slate-400 font-mono">
                        {new Date(t.date).toLocaleString('ar-YE', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.type === 'sale' 
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                            : t.type === 'payment'
                            ? 'bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800'
                            : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {t.type === 'sale' ? 'مبيعات' : t.type === 'payment' ? 'سداد ديون' : 'مصروف'}
                        </span>
                      </td>
                      <td className={`py-3 pl-2 text-left font-black font-mono ${
                        t.type === 'sale' ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'
                      }`}>
                        {t.type === 'sale' ? '+' : ''}{fmt(t.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
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
