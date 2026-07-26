/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Filter, 
  BarChart3, 
  PieChart as PieIcon, 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  ArrowUpRight, 
  ShoppingBag, 
  CreditCard, 
  Percent, 
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Invoice, Product, Transaction, Customer, SystemSettings } from '../types';

interface ProfitReportsProps {
  invoices: Invoice[];
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
  currency: string;
  settings?: SystemSettings;
  isPrivacyMode?: boolean;
}

type PeriodPreset = 'today' | 'week' | 'month' | '30days' | 'year' | 'custom' | 'all';
type InvoiceTypeFilter = 'all' | 'cash' | 'debt';

const COLORS = ['#10B981', '#2563EB', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ProfitReports({
  invoices,
  products,
  transactions,
  customers,
  currency,
  settings,
  isPrivacyMode = false
}: ProfitReportsProps) {
  // Multi-Currency Selection
  const activeCurrencies = settings?.currencies && settings.currencies.length > 0
    ? settings.currencies
    : [
        { id: 'YER', code: 'YER', name: 'الريال اليمني', symbol: 'ر.ي', exchangeRate: 1, isBase: true },
        { id: 'SAR', code: 'SAR', name: 'الريال السعودي', symbol: 'ر.س', exchangeRate: 140, isBase: false },
        { id: 'USD', code: 'USD', name: 'الدولار الأمريكي', symbol: '$', exchangeRate: 530, isBase: false },
      ];

  const [reportCurrencySymbol, setReportCurrencySymbol] = useState<string>(
    settings?.selectedCurrencySymbol || currency || 'ر.ي'
  );

  const selectedCurr = activeCurrencies.find(c => c.symbol === reportCurrencySymbol || c.code === reportCurrencySymbol) || activeCurrencies[0];
  const currRate = selectedCurr?.exchangeRate && selectedCurr.exchangeRate > 0 ? selectedCurr.exchangeRate : 1;

  const convertAmount = (numInBase: number) => {
    if (selectedCurr?.isBase) return numInBase;
    return numInBase / currRate;
  };

  // Filter States
  const [period, setPeriod] = useState<PeriodPreset>('month');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<InvoiceTypeFilter>('all');
  const [copied, setCopied] = useState(false);

  // Helper map for fast product cost lookup
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      map.set(p.id, p.costPrice || 0);
      map.set(p.name.trim().toLowerCase(), p.costPrice || 0);
    });
    return map;
  }, [products]);

  // Date Filtering Logic
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return invoices.filter(inv => {
      if (inv.status === 'refunded') return false; // exclude refunded

      // Invoice type check
      if (invoiceTypeFilter !== 'all' && inv.type !== invoiceTypeFilter) {
        return false;
      }

      // Date parsing
      let invDateStr = inv.date;
      if (inv.date.includes('T')) {
        invDateStr = inv.date.split('T')[0];
      }

      if (period === 'today') {
        return invDateStr === todayStr;
      }

      if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        return invDateStr >= weekAgoStr && invDateStr <= todayStr;
      }

      if (period === 'month') {
        const firstDayOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        return invDateStr >= firstDayOfMonthStr && invDateStr <= todayStr;
      }

      if (period === '30days') {
        const d30 = new Date();
        d30.setDate(now.getDate() - 30);
        const d30Str = d30.toISOString().split('T')[0];
        return invDateStr >= d30Str && invDateStr <= todayStr;
      }

      if (period === 'year') {
        const firstDayOfYearStr = `${now.getFullYear()}-01-01`;
        return invDateStr >= firstDayOfYearStr && invDateStr <= todayStr;
      }

      if (period === 'custom') {
        if (!startDate || !endDate) return true;
        return invDateStr >= startDate && invDateStr <= endDate;
      }

      return true; // 'all'
    });
  }, [invoices, period, startDate, endDate, invoiceTypeFilter]);

  // Comprehensive KPI Statistics
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let totalDiscount = 0;
    let totalCashRevenue = 0;
    let totalDebtRevenue = 0;

    const productSalesTracker = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();

    filteredInvoices.forEach(inv => {
      const invFinalAmount = inv.finalAmount || 0;
      totalRevenue += invFinalAmount;
      totalDiscount += (inv.discount || 0);

      if (inv.type === 'cash') totalCashRevenue += invFinalAmount;
      else if (inv.type === 'debt') totalDebtRevenue += invFinalAmount;

      inv.items.forEach(item => {
        const costPrice = productCostMap.get(item.productId) ?? productCostMap.get(item.name.trim().toLowerCase()) ?? 0;
        const itemCostTotal = item.quantity * costPrice;
        totalCostOfGoods += itemCostTotal;

        const itemProfit = item.total - itemCostTotal;

        const existing = productSalesTracker.get(item.name) || { name: item.name, qty: 0, revenue: 0, profit: 0 };
        productSalesTracker.set(item.name, {
          name: item.name,
          qty: existing.qty + item.quantity,
          revenue: existing.revenue + item.total,
          profit: existing.profit + itemProfit
        });
      });
    });

    const grossProfit = totalRevenue - totalCostOfGoods;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const avgInvoiceValue = filteredInvoices.length > 0 ? totalRevenue / filteredInvoices.length : 0;
    const avgInvoiceProfit = filteredInvoices.length > 0 ? grossProfit / filteredInvoices.length : 0;

    const topProducts = Array.from(productSalesTracker.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    return {
      totalRevenue,
      totalCostOfGoods,
      grossProfit,
      profitMargin,
      totalDiscount,
      totalCashRevenue,
      totalDebtRevenue,
      invoiceCount: filteredInvoices.length,
      avgInvoiceValue,
      avgInvoiceProfit,
      topProducts
    };
  }, [filteredInvoices, productCostMap]);

  // Aggregation for Timeline Chart
  const timelineChartData = useMemo(() => {
    const isYearOrAll = period === 'year' || period === 'all';
    const grouped = new Map<string, { dateLabel: string; revenue: number; cost: number; profit: number; count: number }>();

    filteredInvoices.forEach(inv => {
      let dateKey = inv.date;
      if (inv.date.includes('T')) {
        dateKey = inv.date.split('T')[0];
      }

      let label = dateKey;
      if (isYearOrAll && dateKey.length >= 7) {
        label = dateKey.substring(0, 7); // YYYY-MM
      }

      let invCost = 0;
      inv.items.forEach(item => {
        const costPrice = productCostMap.get(item.productId) ?? productCostMap.get(item.name.trim().toLowerCase()) ?? 0;
        invCost += item.quantity * costPrice;
      });

      const invRevenue = inv.finalAmount;
      const invProfit = invRevenue - invCost;

      const curr = grouped.get(label) || { dateLabel: label, revenue: 0, cost: 0, profit: 0, count: 0 };
      grouped.set(label, {
        dateLabel: label,
        revenue: curr.revenue + invRevenue,
        cost: curr.cost + invCost,
        profit: curr.profit + invProfit,
        count: curr.count + 1
      });
    });

    return Array.from(grouped.values()).sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));
  }, [filteredInvoices, period, productCostMap]);

  // Pie chart data: Cash vs Debt
  const piePaymentData = useMemo(() => [
    { name: 'مبيعات نقدية (كاش)', value: stats.totalCashRevenue, color: '#10B981' },
    { name: 'مبيعات آجل (ديون)', value: stats.totalDebtRevenue, color: '#2563EB' }
  ].filter(d => d.value > 0), [stats.totalCashRevenue, stats.totalDebtRevenue]);

  const fmt = (num: number) => {
    const symbol = selectedCurr?.symbol || reportCurrencySymbol || currency;
    if (isPrivacyMode) return '**** ' + symbol;
    const converted = convertAmount(num);
    const formatted = selectedCurr?.isBase
      ? Math.round(converted).toLocaleString('ar-YE')
      : converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${symbol}`;
  };

  const handleCopySummary = () => {
    const text = `📊 *تقرير أرباح مبيعات - نظام سند المحاسبي*
📅 الفترة: ${period === 'today' ? 'اليوم' : period === 'month' ? 'الشهر الحالي' : period === '30days' ? 'آخر 30 يوم' : 'مخصص'}
----------------------------------
💰 إجمالي المبيعات (الإيرادات): ${fmt(stats.totalRevenue)}
📦 تكلفة البضاعة المباعة: ${fmt(stats.totalCostOfGoods)}
📈 صافي الأرباح: ${fmt(stats.grossProfit)}
📊 نسبة هامش الربح: %${stats.profitMargin.toFixed(1)}
🧾 عدد الفواتير: ${stats.invoiceCount}
💵 مبيعات نقداً: ${fmt(stats.totalCashRevenue)}
📑 مبيعات آجل (ديون): ${fmt(stats.totalDebtRevenue)}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="profit_reports_view" className="space-y-6 pb-12">
      
      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="p-5 md:p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              {settings?.storeLogoUrl ? (
                <img 
                  src={settings.storeLogoUrl} 
                  alt={settings.storeName} 
                  className="w-10 h-10 rounded-xl object-contain border border-slate-200 bg-white p-0.5 shadow-xs shrink-0" 
                />
              ) : (
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <BarChart3 className="w-5 h-5" />
                </div>
              )}
              <h1 className="text-lg md:text-xl font-bold text-slate-900">
                التقرير البياني المفصل لأرباح المبيعات - {settings?.storeName || 'المنشأة'}
              </h1>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              تحليل إحصائي لمبيعات نقاط البيع (POS)، هامش الربح الصافي، وتكلفة المبيعات
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
            {/* Multi-Currency Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold px-1 flex items-center gap-0.5">
                <DollarSign className="w-3 h-3 text-amber-600" /> عملة العرض:
              </span>
              {activeCurrencies.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setReportCurrencySymbol(c.symbol)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    reportCurrencySymbol === c.symbol
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {c.symbol}
                </button>
              ))}
            </div>

            <button
              onClick={handleCopySummary}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-blue-600" />}
              <span>{copied ? 'تم نسخ التقرير' : 'نسخ الملخص'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20 no-print"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          
          {/* Period Preset Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 font-bold flex items-center gap-1 ml-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> الفترة:
            </span>

            {[
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'الأسبوع' },
              { id: 'month', label: 'الشهر الحالي' },
              { id: '30days', label: 'آخر 30 يوم' },
              { id: 'year', label: 'السنة' },
              { id: 'custom', label: 'مخصص' },
              { id: 'all', label: 'الكل' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as PeriodPreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  period === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold">نوع الفاتورة:</span>
            <select
              value={invoiceTypeFilter}
              onChange={(e) => setInvoiceTypeFilter(e.target.value as InvoiceTypeFilter)}
              className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">كافة الفواتير</option>
              <option value="cash">نقداً (كاش) فقط</option>
              <option value="debt">آجل (ديون) فقط</option>
            </select>
          </div>

        </div>

      </div>

      {/* 2. KPI SUMMARY CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Sales Revenue */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>إجمالي المبيعات (الإيرادات)</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono dir-ltr text-right">
            {fmt(stats.totalRevenue)}
          </div>
          <div className="text-[10px] text-slate-400">
            عدد الفواتير الصادرة: <span className="font-bold text-slate-700">{stats.invoiceCount} فاتورة</span>
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>تكلفة البضاعة المباعة</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-700 font-mono dir-ltr text-right">
            {fmt(stats.totalCostOfGoods)}
          </div>
          <div className="text-[10px] text-slate-400">
            تأدية رأس المال الصافي للمبيعات
          </div>
        </div>

        {/* Net Gross Profit */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>صافي الأرباح الصافية</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono dir-ltr text-right">
            +{fmt(stats.grossProfit)}
          </div>
          <div className="text-[10px] text-slate-400">
            متوسط الربح بالفاتورة: <span className="font-bold text-emerald-600">{fmt(stats.avgInvoiceProfit)}</span>
          </div>
        </div>

        {/* Profit Margin % */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>نسبة هامش الربح</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-600 font-mono">
            %{stats.profitMargin.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-400">
            مؤشر كفاءة الربحية التشغيلية
          </div>
        </div>

      </div>

      {/* 3. TIMELINE REVENUE & PROFIT CHART */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          المخطط الزمني لحركة المبيعات والأرباح
        </h3>

        <div className="h-72 w-full">
          {timelineChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              لا توجد بيانات مبيعات متوفرة للفترة المحددة.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="dateLabel" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', borderColor: '#E2E8F0', color: '#0F172A', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="revenue" name="إجمالي المبيعات" stroke="#2563EB" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                <Area type="monotone" dataKey="profit" name="صافي الأرباح" stroke="#10B981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. TOP PRODUCTS & PAYMENT DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Profitable Products */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            أكثر الأصناف ربحية للفترة
          </h3>

          <div className="space-y-2">
            {stats.topProducts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">لا توجد بيانات أصناف.</div>
            ) : (
              stats.topProducts.map((p, idx) => (
                <div key={p.name} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 font-black text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400">الكمية المباعة: {p.qty} حبة</div>
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <div className="font-black text-emerald-600">+{p.profit.toLocaleString()} {currency}</div>
                    <div className="text-[9px] text-slate-400">إجمالي المبيعات: {p.revenue.toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cash vs Debt Payment Breakdown */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-blue-600" />
            توزيع المبيعات النقدية والآجلة
          </h3>

          <div className="h-56 w-full flex items-center justify-center">
            {piePaymentData.length === 0 ? (
              <div className="text-slate-400 text-xs">لا توجد بيانات تسديد.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={piePaymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {piePaymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', borderColor: '#E2E8F0', color: '#0F172A', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
