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
  Layers
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
import { Invoice, Product, Transaction, Customer } from '../types';

interface ProfitReportsProps {
  invoices: Invoice[];
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
  currency: string;
}

type PeriodPreset = 'today' | 'week' | 'month' | '30days' | 'year' | 'custom' | 'all';
type InvoiceTypeFilter = 'all' | 'cash' | 'debt';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ProfitReports({
  invoices,
  products,
  transactions,
  customers,
  currency
}: ProfitReportsProps) {
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

      const invDate = new Date(invDateStr);

      switch (period) {
        case 'today':
          return invDateStr === todayStr;

        case 'week': {
          const startOfWeek = new Date(now);
          const day = startOfWeek.getDay(); // 0 is Sunday
          startOfWeek.setDate(now.getDate() - day);
          startOfWeek.setHours(0, 0, 0, 0);
          return invDate >= startOfWeek;
        }

        case 'month': {
          return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
        }

        case '30days': {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          thirtyDaysAgo.setHours(0, 0, 0, 0);
          return invDate >= thirtyDaysAgo;
        }

        case 'year': {
          return invDate.getFullYear() === now.getFullYear();
        }

        case 'custom': {
          if (!startDate || !endDate) return true;
          return invDateStr >= startDate && invDateStr <= endDate;
        }

        case 'all':
        default:
          return true;
      }
    });
  }, [invoices, period, startDate, endDate, invoiceTypeFilter]);

  // Detailed Financial Calculations
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let totalDiscount = 0;
    let totalCashRevenue = 0;
    let totalDebtRevenue = 0;

    // Per Product Profit Tracker
    const productProfitMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();

    filteredInvoices.forEach(inv => {
      totalRevenue += inv.finalAmount;
      totalDiscount += inv.discount || 0;

      if (inv.type === 'cash') totalCashRevenue += inv.finalAmount;
      if (inv.type === 'debt') totalDebtRevenue += inv.finalAmount;

      let invCost = 0;
      inv.items.forEach(item => {
        const costPrice = productCostMap.get(item.productId) ?? productCostMap.get(item.name.trim().toLowerCase()) ?? 0;
        const itemCost = item.quantity * costPrice;
        const itemRevenue = item.total || (item.quantity * item.sellingPrice);
        const itemProfit = itemRevenue - itemCost;

        invCost += itemCost;

        // Track per product
        const key = item.productId || item.name;
        const existing = productProfitMap.get(key) || { name: item.name, qty: 0, revenue: 0, profit: 0 };
        productProfitMap.set(key, {
          name: item.name,
          qty: existing.qty + item.quantity,
          revenue: existing.revenue + itemRevenue,
          profit: existing.profit + itemProfit
        });
      });

      totalCostOfGoods += invCost;
    });

    const grossProfit = totalRevenue - totalCostOfGoods;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const avgInvoiceValue = filteredInvoices.length > 0 ? totalRevenue / filteredInvoices.length : 0;
    const avgInvoiceProfit = filteredInvoices.length > 0 ? grossProfit / filteredInvoices.length : 0;

    // Top products sorted by profit
    const topProducts = Array.from(productProfitMap.values())
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

  // Aggregation for Timeline Chart (Daily or Monthly depending on selected range)
  const timelineChartData = useMemo(() => {
    // Group invoices by date string (YYYY-MM-DD or YYYY-MM)
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

    // Sort chronologically
    return Array.from(grouped.values()).sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));
  }, [filteredInvoices, period, productCostMap]);

  // Pie chart data: Cash vs Debt
  const piePaymentData = useMemo(() => [
    { name: 'مبيعات نقدية (Cash)', value: stats.totalCashRevenue, color: '#10B981' },
    { name: 'مبيعات أجلة (Debt)', value: stats.totalDebtRevenue, color: '#F59E0B' }
  ].filter(d => d.value > 0), [stats.totalCashRevenue, stats.totalDebtRevenue]);

  // Format currency string
  const fmt = (num: number) => {
    return Math.round(num).toLocaleString('ar-YE') + ' ' + currency;
  };

  // Copy summary to clipboard
  const handleCopySummary = () => {
    const text = `📊 *تقرير أرباح مبيعات POS - نظام سند المحاسبي*
📅 الفترة: ${period === 'today' ? 'اليوم' : period === 'month' ? 'الشهر الحالي' : period === '30days' ? 'آخر 30 يوم' : 'مخصص'}
----------------------------------
💰 إجمالي المبيعات (الإيرادات): ${fmt(stats.totalRevenue)}
📦 تكلفة البضاعة المباعة (COGS): ${fmt(stats.totalCostOfGoods)}
📈 صافي الأرباح الصافية: ${fmt(stats.grossProfit)}
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
      <div className="p-4 md:p-6 rounded-2xl border border-[#C5A862]/30 bg-gradient-to-r from-[#121F2E] via-[#0B1521] to-[#060B10] shadow-xl space-y-4">
        
        {/* Title and Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#C5A862]" />
              <h1 className="text-lg md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-[#F3E7C4] to-[#C5A862]">
                التقرير البياني المفصل لأرباح المبيعات
              </h1>
            </div>
            <p className="text-gray-400 text-xs mt-1">
              تحليل إحصائي دقيق لمبيعات نقاط البيع (POS)، هامش الربح الصافي، وتكلفة المبيعات اليومية والشهرية
            </p>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleCopySummary}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-gray-700 text-gray-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-[#C5A862]" />}
              <span>{copied ? 'تم نسخ التقرير' : 'نسخ الملخص'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-[#C5A862] hover:bg-[#b09352] text-black text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg no-print"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="pt-3 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-3">
          
          {/* Period Preset Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1 ml-1">
              <Calendar className="w-3.5 h-3.5 text-[#C5A862]" /> الفترة:
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-[#C5A862] text-black shadow-md'
                    : 'bg-[#162231] text-gray-300 hover:bg-[#1f2d40] border border-gray-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Invoice Type Selector & Custom Date Inputs */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            
            {/* Payment Type Filter */}
            <div className="flex items-center gap-1.5 bg-[#162231] border border-gray-800 rounded-xl px-2.5 py-1">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={invoiceTypeFilter}
                onChange={(e) => setInvoiceTypeFilter(e.target.value as InvoiceTypeFilter)}
                className="bg-transparent text-xs text-gray-200 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#101823]">جميع الفواتير</option>
                <option value="cash" className="bg-[#101823]">نقداً فقط</option>
                <option value="debt" className="bg-[#101823]">آجل (ديون) فقط</option>
              </select>
            </div>

            {/* Custom Date Pickers */}
            {period === 'custom' && (
              <div className="flex items-center gap-2 text-xs bg-[#162231] border border-gray-800 p-1 rounded-xl">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-gray-200 px-2 py-0.5 rounded focus:outline-none"
                />
                <span className="text-gray-500">إلى</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-gray-200 px-2 py-0.5 rounded focus:outline-none"
                />
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 2. MAIN KPI METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Net Sales Revenue */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 hover:border-[#C5A862]/50 transition-all shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium block">إجمالي المبيعات (الإيرادات)</span>
              <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#C5A862] mt-1">
                {fmt(stats.totalRevenue)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-800/80 flex justify-between text-[11px] text-gray-400">
            <span>عدد الفواتير: <strong className="text-white">{stats.invoiceCount}</strong></span>
            <span>خصومات: <strong className="text-amber-400">{fmt(stats.totalDiscount)}</strong></span>
          </div>
        </div>

        {/* KPI 2: Cost of Goods Sold (COGS) */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 hover:border-[#C5A862]/50 transition-all shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium block">تكلفة البضاعة المباعة (COGS)</span>
              <h3 className="text-xl font-black text-amber-400 mt-1">
                {fmt(stats.totalCostOfGoods)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-800/80 flex justify-between text-[11px] text-gray-400">
            <span>نسبة التكلفة:</span>
            <span className="font-bold text-amber-300">
              %{stats.totalRevenue > 0 ? ((stats.totalCostOfGoods / stats.totalRevenue) * 100).toFixed(1) : '0'}
            </span>
          </div>
        </div>

        {/* KPI 3: Net Gross Profit */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium block">صافي أرباح المبيعات</span>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">
                {fmt(stats.grossProfit)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-800/80 flex justify-between text-[11px] text-gray-400">
            <span>هامش الربح الصافي:</span>
            <span className="font-bold text-emerald-400 flex items-center gap-0.5">
              <Percent className="w-3 h-3" /> %{stats.profitMargin.toFixed(1)}
            </span>
          </div>
        </div>

        {/* KPI 4: Avg Invoice & Sales Breakdown */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 hover:border-[#C5A862]/50 transition-all shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-gray-400 font-medium block">متوسط ربح الفاتورة الواحدة</span>
              <h3 className="text-xl font-black text-white mt-1">
                {fmt(stats.avgInvoiceProfit)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-800/80 flex justify-between text-[11px] text-gray-400">
            <span>متوسط قيمة الفاتورة:</span>
            <span className="font-bold text-gray-200">{fmt(stats.avgInvoiceValue)}</span>
          </div>
        </div>

      </div>

      {/* 3. MAIN RECHARTS VISUALIZATION CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Area Timeline Chart: Sales vs Profit vs Cost */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0F1824] border border-gray-800 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" /> الرسم البياني للنمو والأرباح عبر الزمن
              </h2>
              <p className="text-gray-400 text-xs">مقارنة الإيرادات الصافية والأرباح وتكلفة المنتجات للفترة المحددة</p>
            </div>
            <span className="text-[10px] bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 px-2.5 py-1 rounded-full font-bold">
              مباشر ⚡
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            {timelineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="dateLabel" stroke="#6B7280" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0B141F', borderColor: '#374151', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value: any) => [Math.round(Number(value)).toLocaleString() + ' ' + currency, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  
                  <Area type="monotone" dataKey="revenue" name="المبيعات (الإيراد)" stroke="#3B82F6" fillOpacity={1} fill="url(#revenueGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="profit" name="صافي الأرباح" stroke="#10B981" fillOpacity={1} fill="url(#profitGrad)" strokeWidth={3} />
                  <Area type="monotone" dataKey="cost" name="التكلفة (COGS)" stroke="#F59E0B" fillOpacity={0.1} fill="#F59E0B" strokeWidth={1.5} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs">
                <BarChart3 className="w-8 h-8 text-gray-700 mb-2 animate-bounce" />
                لا توجد مبيعات مسجلة في هذه الفترة المحددة
              </div>
            )}
          </div>
        </div>

        {/* Payment Type Breakdown (Pie / Donut Chart) */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-gray-800 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-amber-400" /> نسبة مبيعات النقد مقابل الآجل (الديون)
            </h2>
            <p className="text-gray-400 text-xs">توزيع السيولة المالية في المبيعات المحصلة والديون</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            {piePaymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={piePaymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {piePaymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0B141F', borderColor: '#374151', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(val: any) => [Math.round(Number(val)).toLocaleString() + ' ' + currency, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-500 text-xs">لا توجد مبيعات متاحة للتحليل</div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-800">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-2 text-gray-300">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> مبيعات نقداً (Cash):
              </span>
              <span className="font-bold text-emerald-400">{fmt(stats.totalCashRevenue)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-2 text-gray-300">
                <span className="w-3 h-3 rounded-full bg-amber-500" /> مبيعات آجل (ديون):
              </span>
              <span className="font-bold text-amber-400">{fmt(stats.totalDebtRevenue)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. TOP PROFITABLE PRODUCTS & DETAILED BAR CHART */}
      <div className="p-5 rounded-2xl bg-[#0F1824] border border-gray-800 shadow-xl space-y-4">
        <div>
          <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-[#C5A862]" /> أكثر 5 منتجات تحقيقاً للأرباح الصافية
          </h2>
          <p className="text-gray-400 text-xs">ترتيب المنتجات الأعلى ربحية بناءً على كميات المبيعات وهامش الربح</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          
          {/* Top Products Bar Chart */}
          <div className="h-60 w-full">
            {stats.topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topProducts} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
                  <XAxis type="number" stroke="#6B7280" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" stroke="#6B7280" tick={{ fontSize: 10, fill: '#E5E7EB' }} width={90} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0B141F', borderColor: '#374151', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(val: any) => [Math.round(Number(val)).toLocaleString() + ' ' + currency, 'ربح']}
                  />
                  <Bar dataKey="profit" fill="#10B981" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                لا توجد بيانات كافية
              </div>
            )}
          </div>

          {/* Top Products Cards List */}
          <div className="space-y-2.5">
            {stats.topProducts.map((p, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#142130] border border-gray-800 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-[#C5A862]/20 text-[#C5A862] font-black text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-white">{p.name}</h4>
                    <span className="text-[10px] text-gray-400">الكمية المباعة: {p.qty} قطعة</span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-emerald-400">{fmt(p.profit)}</span>
                  <span className="text-[10px] text-gray-400">الإيراد: {fmt(p.revenue)}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* 5. INVOICES BREAKDOWN TABLE */}
      <div className="p-5 rounded-2xl bg-[#0F1824] border border-gray-800 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#C5A862]" /> جدول الفواتير والأرباح المحسوبة ({filteredInvoices.length} فاتورة)
            </h2>
            <p className="text-gray-400 text-xs">تفاصيل إيرادات وتكلفة وأرباح كل فاتورة مبيعات في الفترة المختارة</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#14202E] text-gray-300 font-bold border-b border-gray-800">
              <tr>
                <th className="p-3">رقم الفاتورة</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">العميل</th>
                <th className="p-3">نوع البيع</th>
                <th className="p-3">إجمالي الإيراد</th>
                <th className="p-3">التكلفة (COGS)</th>
                <th className="p-3">الربح الصافي</th>
                <th className="p-3">هامش الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-gray-300">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => {
                  let invCost = 0;
                  inv.items.forEach(item => {
                    const costPrice = productCostMap.get(item.productId) ?? productCostMap.get(item.name.trim().toLowerCase()) ?? 0;
                    invCost += item.quantity * costPrice;
                  });
                  const invProfit = inv.finalAmount - invCost;
                  const invMargin = inv.finalAmount > 0 ? (invProfit / inv.finalAmount) * 100 : 0;

                  return (
                    <tr key={inv.id} className="hover:bg-[#121d2a] transition-colors">
                      <td className="p-3 font-mono font-bold text-amber-400">{inv.invoiceNumber}</td>
                      <td className="p-3 text-gray-400 font-mono text-[11px]">
                        {inv.date.includes('T') ? inv.date.split('T')[0] : inv.date}
                      </td>
                      <td className="p-3 font-medium text-white">{inv.customerName || 'عميل نقدي'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.type === 'cash' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' : 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                        }`}>
                          {inv.type === 'cash' ? 'نقداً' : 'آجل'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-white">{fmt(inv.finalAmount)}</td>
                      <td className="p-3 text-gray-400">{fmt(invCost)}</td>
                      <td className="p-3 font-bold text-emerald-400">{fmt(invProfit)}</td>
                      <td className="p-3 font-mono text-gray-300">%{invMargin.toFixed(1)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    لا توجد فواتير مبيعات مطابقة للفترة المحددة.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredInvoices.length > 0 && (
              <tfoot className="bg-[#14202E] font-bold text-white border-t border-gray-700">
                <tr>
                  <td colSpan={4} className="p-3 text-left">المجموع الإجمالي:</td>
                  <td className="p-3 text-blue-400">{fmt(stats.totalRevenue)}</td>
                  <td className="p-3 text-amber-400">{fmt(stats.totalCostOfGoods)}</td>
                  <td className="p-3 text-emerald-400">{fmt(stats.grossProfit)}</td>
                  <td className="p-3 text-gray-300">%{stats.profitMargin.toFixed(1)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
}
