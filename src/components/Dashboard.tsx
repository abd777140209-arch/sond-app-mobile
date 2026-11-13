/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  Wallet, 
  ArrowDownLeft, 
  AlertCircle, 
  Phone, 
  BarChart3, 
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
  Printer,
  Coins,
  Smartphone,
  Shield
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
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
  onOpenCustomerStatement?: (customerId: string) => void;
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
  onOpenCustomerStatement,
  isPrivacyMode = false
}: DashboardProps) {

  const [showZaraModal, setShowZaraModal] = useState(false);
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    const handleBack = () => {
      if (showZaraModal) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
          try { window.speechSynthesis.cancel(); } catch {}
        }
        setShowZaraModal(false);
      }
    };
    window.addEventListener('android-modal-close', handleBack);
    return () => {
      window.removeEventListener('android-modal-close', handleBack);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch {}
      }
    };
  }, [showZaraModal]);

  // Calculations
  const activeProducts = products.filter(p => p.isDeleted !== true);
  const activeCustomers = customers.filter(c => c.isDeleted !== true);
  const activeInvoices = invoices.filter(inv => inv.status !== 'refunded');

  const totalSales = activeInvoices.reduce((sum, inv) => sum + inv.finalAmount, 0);
  const totalDebts = activeCustomers.reduce((sum, cust) => sum + cust.totalDebt, 0);
  
  // Cashbox Balance (Unified with Transactions Ledger)
  const hasSaleTransactions = transactions.some(t => t.type === 'sale');
  const totalInflows = hasSaleTransactions
    ? transactions.filter(t => t.type === 'sale' || t.type === 'payment' || t.type === 'maintenance' || t.type === 'maintenance_income').reduce((sum, t) => sum + t.amount, 0)
    : activeInvoices.filter(inv => inv.type === 'cash').reduce((sum, inv) => sum + inv.finalAmount, 0) +
      transactions.filter(t => t.type === 'payment' || t.type === 'maintenance' || t.type === 'maintenance_income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const cashboxBalance = totalInflows - totalExpenses;

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

  const highDebtCustomers = activeCustomers.filter(c => c.totalDebt >= 50000);

  // Speech synthesis audio summary
  const handleSpeakSummary = () => {
    setShowZaraModal(true);
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const text = `أهلاً بك في ${settings.storeName || 'نظام سند المحاسبي'}. إجمالي المبيعات المعتمدة بلغ ${totalSales.toLocaleString()} ${settings.currency}. الرصيد النقدي المتوفر في الصندوق ${cashboxBalance.toLocaleString()} ${settings.currency}. إجمالي ديون العملاء المتبقية ${totalDebts.toLocaleString()} ${settings.currency}. وعدد الأصناف بالمخزن ${activeProducts.length} صنف.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech exception:', e);
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

  const [dashCurrencySymbol, setDashCurrencySymbol] = useState<string>(
    settings?.selectedCurrencySymbol || settings?.currency || 'ر.ي'
  );

  const selectedCurr = activeCurrencies.find(c => c.symbol === dashCurrencySymbol || c.code === dashCurrencySymbol) || activeCurrencies[0];
  const currRate = selectedCurr?.exchangeRate && selectedCurr.exchangeRate > 0 ? selectedCurr.exchangeRate : 1;

  const fmt = (num: number) => {
    const symbol = selectedCurr?.symbol || dashCurrencySymbol || settings.currency;
    if (isPrivacyMode) return '•••• ' + symbol;
    const converted = selectedCurr?.isBase ? num : (num / currRate);
    const formatted = selectedCurr?.isBase
      ? Math.round(converted).toLocaleString()
      : converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${symbol}`;
  };

  const maxDebtorVal = topDebtors[0]?.totalDebt || 1;

  // Live Sales & Expenses Chart Series (7d or 30d)
  const cashflowChartData = useMemo(() => {
    const days = chartRange === '7d' ? 7 : 30;
    const buckets: Record<string, { label: string; sales: number; expenses: number }> = {};
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const isoKey = d.toISOString().split('T')[0];
      const shortLabel = d.toLocaleDateString('ar-YE', { day: 'numeric', month: 'numeric' });
      buckets[isoKey] = { label: shortLabel, sales: 0, expenses: 0 };
    }

    activeInvoices.forEach((inv) => {
      const key = (inv.date || '').split('T')[0];
      if (buckets[key]) {
        const val = selectedCurr?.isBase ? inv.finalAmount : inv.finalAmount / currRate;
        buckets[key].sales += Number(val.toFixed(2));
      }
    });

    transactions.forEach((t) => {
      const key = (t.date || '').split('T')[0];
      if (!buckets[key]) return;
      const val = selectedCurr?.isBase ? t.amount : t.amount / currRate;
      if (t.type === 'expense' || t.type === 'refund') {
        buckets[key].expenses += Number(val.toFixed(2));
      } else if (t.type === 'maintenance_income' || t.type === 'maintenance' || t.type === 'payment') {
        buckets[key].sales += Number(val.toFixed(2));
      }
    });

    return Object.values(buckets);
  }, [activeInvoices, transactions, chartRange, selectedCurr, currRate]);

  // Top Moving Products by Revenue
  const topMovingProducts = useMemo(() => {
    const agg: Record<string, { name: string; qty: number; revenue: number }> = {};
    activeInvoices.forEach((inv) => {
      (inv.items || []).forEach((it) => {
        const key = it.productId || it.name;
        if (!agg[key]) {
          agg[key] = { name: it.name, qty: 0, revenue: 0 };
        }
        agg[key].qty += it.quantity || 0;
        agg[key].revenue += it.total || 0;
      });
    });
    return Object.values(agg)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [activeInvoices]);

  return (
    <div id="dashboard_tab_view" className="space-y-5 pb-20">
      
      {/* 1. Top Executive Header Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3.5">
          {settings.storeLogoUrl ? (
            <img
              src={settings.storeLogoUrl}
              alt="شعار المتجر"
              className="w-12 h-12 rounded-2xl object-contain border border-slate-200 bg-white p-1"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shrink-0">
              {settings.storeName ? settings.storeName.charAt(0) : 'س'}
            </div>
          )}
          <div>
            <h1 className="text-lg md:text-xl font-black text-slate-900">
              {settings.storeName && settings.storeName.trim() ? settings.storeName : 'نظام سند المحاسبي المتكامل'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-slate-500 text-xs mt-0.5">
              <span>لوحة القيادة المالية</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{activeProducts.length} صنف</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{activeCustomers.length} عميل</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          {/* Currency Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-bold px-2">عملة العرض:</span>
            {activeCurrencies.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  soundManager.playScanBeep();
                  setDashCurrencySymbol(c.symbol);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dashCurrencySymbol === c.symbol
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c.symbol}
              </button>
            ))}
          </div>

          {/* Voice Summary Button */}
          <button
            onClick={handleSpeakSummary}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-blue-600" />
            <span>الملخص الصوتي</span>
          </button>

          {/* Fast POS Action */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('pos');
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>نقطة البيع (POS)</span>
          </button>

          {/* Profit Reports Action */}
          <button
            onClick={() => setActiveTab('reports')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <BarChart3 className="w-4 h-4" />
            <span>تقرير الأرباح</span>
          </button>
        </div>
      </div>

      {/* 2. Smart System Alerts Card */}
      {(lowStockProducts.length > 0 || highDebtCustomers.length > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-xs sm:text-sm">
              <Bell className="w-4 h-4 text-amber-600" />
              <span>تنبيهات المتابعة اليومية</span>
            </div>
            <span className="text-xs font-bold text-amber-700 font-mono tabular-nums">
              {lowStockProducts.length + highDebtCustomers.length} تنبيه
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {lowStockProducts.length > 0 && (
              <div className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 text-xs">نقص مخزون الأصناف</span>
                    <p className="text-[11px] text-slate-500">
                      يوجد {lowStockProducts.length} صنف وصل للحد الأدنى للطلب
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-[11px] hover:bg-amber-600 transition cursor-pointer"
                >
                  مراجعة المخزن
                </button>
              </div>
            )}

            {highDebtCustomers.length > 0 && (
              <div className="p-3 rounded-xl bg-white border border-rose-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 text-xs">مديونيات مستحقة للتحصيل</span>
                    <p className="text-[11px] text-slate-500">
                      يوجد {highDebtCustomers.length} عملاء تتجاوز مديونيتهم 50,000
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('customers')}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 transition cursor-pointer"
                >
                  دفتر العملاء
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. KPI Financial Cards (5 Key Indicators) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Sales */}
        <div
          onClick={() => setActiveTab('reports')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 transition cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-500 font-bold">إجمالي المبيعات</span>
              <h3 className="text-lg font-black font-mono tabular-nums text-emerald-600 mt-1">
                {fmt(totalSales)}
              </h3>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2.5 flex justify-between border-t border-slate-100 pt-2">
            <span>الفواتير المعتمدة:</span>
            <span className="font-bold font-mono tabular-nums text-slate-800">{activeInvoices.length}</span>
          </div>
        </div>

        {/* Cashbox Balance */}
        <div
          onClick={() => setActiveTab('transactions')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 transition cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-500 font-bold">رصيد الصندوق النقدي</span>
              <h3 className={`text-lg font-black font-mono tabular-nums mt-1 ${
                cashboxBalance >= 0 ? 'text-blue-600' : 'text-rose-600'
              }`}>
                {fmt(cashboxBalance)}
              </h3>
            </div>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2.5 flex justify-between border-t border-slate-100 pt-2">
            <span>عدد القيود والسندات:</span>
            <span className="font-bold font-mono tabular-nums text-slate-800">{transactions.length}</span>
          </div>
        </div>

        {/* Total Debts */}
        <div
          onClick={() => setActiveTab('customers')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-rose-400 transition cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-500 font-bold">ديون العملاء (الذمم)</span>
              <h3 className="text-lg font-black font-mono tabular-nums text-rose-600 mt-1">
                {fmt(totalDebts)}
              </h3>
            </div>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2.5 flex justify-between border-t border-slate-100 pt-2">
            <span>العملاء المدينون:</span>
            <span className="font-bold font-mono tabular-nums text-rose-600">
              {activeCustomers.filter(c => c.totalDebt > 0).length} عميل
            </span>
          </div>
        </div>

        {/* Inventory Capital Value */}
        <div
          onClick={() => setActiveTab('inventory')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-sky-400 transition cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-500 font-bold">رأس مال المخزون</span>
              <h3 className="text-lg font-black font-mono tabular-nums text-sky-600 mt-1">
                {fmt(inventoryCostValue)}
              </h3>
            </div>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2.5 flex justify-between border-t border-slate-100 pt-2">
            <span>قيمة البيع المتوقعة:</span>
            <span className="font-bold font-mono tabular-nums text-sky-700">{fmt(inventoryRetailValue)}</span>
          </div>
        </div>

        {/* Expected Net Profit */}
        <div
          onClick={() => setActiveTab('reports')}
          className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 transition cursor-pointer col-span-2 lg:col-span-1"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-slate-500 font-bold">أرباح المخزون المتوقعة</span>
              <h3 className="text-lg font-black font-mono tabular-nums text-indigo-600 mt-1">
                {fmt(expectedProfit)}
              </h3>
            </div>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2.5 flex justify-between border-t border-slate-100 pt-2">
            <span>نسبة الربح التقديرية:</span>
            <span className="font-bold font-mono tabular-nums text-indigo-600">
              {inventoryCostValue ? Math.round((expectedProfit / inventoryCostValue) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Interactive Financial Analytics & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live Cashflow Trend Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">مؤشر التدفق النقدي والمبيعات</h3>
              <p className="text-[11px] text-slate-500">
                مقارنة يومية بين إجمالي الإيرادات (مبيعات وتحصيلات) والمصروفات ({selectedCurr?.symbol || settings.currency})
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setChartRange('7d')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartRange === '7d' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => setChartRange('30d')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartRange === '30d' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                آخر 30 يوم
              </button>
            </div>
          </div>

          <div className="h-56 w-full" dir="ltr">
            {isPrivacyMode ? (
              <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400">
                الرسوم البيانية مخفية حالياً لتفعيل وضع الخصوصية
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflowChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sanadSalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="sanadExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#F8FAFC',
                      direction: 'rtl',
                    }}
                    formatter={(value: any, name: any) => [
                      `${Number(value || 0).toLocaleString()} ${selectedCurr?.symbol || settings.currency}`,
                      name === 'sales' ? 'الإيرادات والمبيعات' : 'المصاريف والمرتجعات',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#10B981"
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#sanadSalesGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#F43F5E"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#sanadExpenseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Moving Products */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3.5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900">الأصناف الأكثر مبيعاً</h3>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs text-blue-600 hover:underline font-bold cursor-pointer"
            >
              المستودع ←
            </button>
          </div>
          {topMovingProducts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              ستظهر هنا الأصناف الأعلى مبيعاً بعد إصدار فواتير
            </div>
          ) : (
            <div className="space-y-2.5">
              {topMovingProducts.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {i + 1}. {item.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                      الكمية المباعة: {item.qty}
                    </div>
                  </div>
                  <div className="text-xs font-black font-mono tabular-nums text-emerald-600 shrink-0">
                    {fmt(item.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Organized Quick Access Directory (All System Modules) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              دليل أقسام النظام السريع
            </h3>
            <p className="text-xs text-slate-500">
              وصول فوري لجميع أقسام المبيعات، الحسابات، المخزون، الصيانة، والإدارة
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { id: 'pos', label: 'نقطة البيع (POS)', sub: 'إصدار فاتورة بيع', icon: ShoppingCart, style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { id: 'transactions', label: 'اليومية والسندات', sub: 'قبض وصرف ومشتريات', icon: History, style: 'bg-blue-50 text-blue-700 border-blue-200' },
            { id: 'customers', label: 'العملاء والديون', sub: 'كشوف الحسابات', icon: Users, style: 'bg-sky-50 text-sky-700 border-sky-200' },
            { id: 'inventory', label: 'المخزن والأصناف', sub: 'إدارة البضائع', icon: Package, style: 'bg-purple-50 text-purple-700 border-purple-200' },
            { id: 'stock_audit', label: 'جرد المنشأة', sub: 'مطابقة الكميات', icon: ClipboardCheck, style: 'bg-amber-50 text-amber-700 border-amber-200' },
            { id: 'maintenance', label: 'قسم الصيانة', sub: 'إدارة الورشة', icon: Wrench, style: 'bg-orange-50 text-orange-700 border-orange-200' },
            { id: 'device_receipt', label: 'استلام جهاز صيانة', sub: 'طباعة كارت استلام', icon: Smartphone, style: 'bg-blue-50 text-blue-700 border-blue-200' },
            { id: 'diagnostic', label: 'التشخيص الذكي', sub: 'فحص الأعطال', icon: Sparkles, style: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
            { id: 'employees', label: 'العمال والرواتب', sub: 'السلف والأجور', icon: Briefcase, style: 'bg-teal-50 text-teal-700 border-teal-200' },
            { id: 'phone_ledger', label: 'دفتر العملات', sub: 'تعدد العملات', icon: Coins, style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { id: 'printer_settings', label: 'الطابعة والفواتير', sub: 'تخصيص الفاتورة', icon: Printer, style: 'bg-blue-50 text-blue-700 border-blue-200' },
            { id: 'users', label: 'المستخدمين والرقابة', sub: 'الصلاحيات والسجل', icon: Shield, style: 'bg-purple-50 text-purple-700 border-purple-200' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  soundManager.playScanBeep();
                  setActiveTab(item.id);
                }}
                className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition flex items-center gap-2.5 text-right cursor-pointer"
              >
                <div className={`p-2 rounded-lg border shrink-0 ${item.style}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{item.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{item.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Operational Insights Grid: Top Debtors & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Top Debtors */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-500" />
              <span>أعلى مديونيات العملاء المستحقة</span>
            </h3>
            <button 
              onClick={() => setActiveTab('customers')}
              className="text-xs text-blue-600 hover:underline font-bold cursor-pointer"
            >
              عرض سجل العملاء ←
            </button>
          </div>

          {topDebtors.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              لا توجد ديون مسجلة على العملاء حالياً
            </div>
          ) : (
            <div className="space-y-2.5">
              {topDebtors.map(cust => {
                const ratio = Math.min(100, Math.round((cust.totalDebt / maxDebtorVal) * 100));
                return (
                  <div 
                    key={cust.id} 
                    onClick={() => {
                      if (onOpenCustomerStatement) {
                        onOpenCustomerStatement(cust.id);
                      } else {
                        setActiveTab('customers');
                      }
                    }}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-rose-300 transition cursor-pointer space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                          {cust.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-xs">{cust.name}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                            <Phone className="w-2.5 h-2.5" /> {cust.phone || 'بدون رقم'}
                          </div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-black font-mono tabular-nums text-rose-600">
                          {fmt(cust.totalDebt)}
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>نواقص المخزن التي تحتاج طلب</span>
            </h3>
            <button 
              onClick={() => setActiveTab('inventory')}
              className="text-xs text-blue-600 hover:underline font-bold cursor-pointer"
            >
              فتح المستودع ←
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8 text-emerald-600 text-xs font-bold">
              جميع الأصناف متوفرة بكميات كافية في المخزن
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lowStockProducts.map(prod => (
                <div 
                  key={prod.id} 
                  onClick={() => setActiveTab('inventory')}
                  className="flex justify-between items-center p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 hover:border-amber-400 transition cursor-pointer"
                >
                  <div>
                    <div className="font-bold text-slate-800 text-xs">{prod.name}</div>
                    <div className="text-[10px] text-slate-500">القسم: {prod.category || 'عام'}</div>
                  </div>
                  <div className="text-left">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono tabular-nums ${
                      prod.stock === 0 
                        ? 'bg-rose-600 text-white' 
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {prod.stock === 0 ? 'نفد (0)' : `متبقي: ${prod.stock}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 6. Recent Financial Movements */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800">آخر الحركات المالية والقيود المسجلة</h3>
          <button 
            onClick={() => setActiveTab('transactions')}
            className="text-xs text-blue-600 hover:underline font-bold cursor-pointer"
          >
            عرض سجل اليومية الكامل ←
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            لم يتم تسجيل أي حركات مالية بعد
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {transactions.slice(0, 6).map(t => (
              <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    t.type === 'sale' ? 'bg-emerald-100 text-emerald-700' :
                    t.type === 'payment' || t.type === 'maintenance' || t.type === 'maintenance_income' ? 'bg-blue-100 text-blue-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    <ArrowDownLeft className={`w-4 h-4 ${t.type === 'expense' ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">{t.description}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{new Date(t.date).toLocaleDateString('ar-YE')}</div>
                  </div>
                </div>
                <div className={`text-xs font-black font-mono tabular-nums shrink-0 ${
                  t.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zara Smart Summary Modal */}
      {showZaraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-right p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    التقرير المالي الذكي
                  </h3>
                  <p className="text-xs text-slate-500">
                    ملخص مباشر لحالة المتجر المالية والمخزنية
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
                    try { window.speechSynthesis.cancel(); } catch {}
                  }
                  setShowZaraModal(false);
                }}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold">إجمالي المبيعات المعتمدة</div>
                <div className="text-sm font-black font-mono tabular-nums text-emerald-600 mt-1">{fmt(totalSales)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold">رصيد الصندوق النقدي</div>
                <div className="text-sm font-black font-mono tabular-nums text-blue-600 mt-1">{fmt(cashboxBalance)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold">إجمالي ديون العملاء</div>
                <div className="text-sm font-black font-mono tabular-nums text-rose-600 mt-1">{fmt(totalDebts)}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold">الأرباح المتوقعة للمخزون</div>
                <div className="text-sm font-black font-mono tabular-nums text-indigo-600 mt-1">{fmt(expectedProfit)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-600">توصيات المتابعة السريعة:</h4>
              <div className="space-y-2 text-xs">
                {lowStockProducts.length > 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>يوجد <b>{lowStockProducts.length} صنف</b> وصل للحد الأدنى للمخزون ويحتاج إعادة توفير.</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>المخزون مكتمل ولا توجد نواقص حرجة حالياً.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={handleSpeakSummary}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>قراءة التقرير صوتياً</span>
              </button>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
                    try { window.speechSynthesis.cancel(); } catch {}
                  }
                  setShowZaraModal(false);
                }}
                className="py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
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
