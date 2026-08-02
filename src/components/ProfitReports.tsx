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
  Sparkles,
  Wrench,
  User,
  AlertTriangle,
  Flame,
  Package,
  Award,
  Zap,
  Tag,
  Download,
  Loader2
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
import { Invoice, Product, Transaction, Customer, SystemSettings, MaintenanceOrder } from '../types';
import { saveAndShareFile } from '../utils/fileExport';
import { soundManager } from '../utils/sound';

interface ProfitReportsProps {
  invoices: Invoice[];
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
  maintenanceOrders?: MaintenanceOrder[];
  currency: string;
  settings?: SystemSettings;
  isPrivacyMode?: boolean;
}

type PeriodPreset = 'today' | 'week' | 'month' | '30days' | 'year' | 'custom' | 'all';
type InvoiceTypeFilter = 'all' | 'cash' | 'debt';
type ReportSubTab = 'sales' | 'maintenance' | 'inventory';

const COLORS = ['#10B981', '#2563EB', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ProfitReports({
  invoices,
  products,
  transactions,
  customers,
  maintenanceOrders = [],
  currency,
  settings,
  isPrivacyMode = false
}: ProfitReportsProps) {
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('sales');
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
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // 1. دالة تصدير تقرير الصيانة الفنية المباشر والسريع
  const handleExportMaintenancePDF = async () => {
    try {
      setIsExportingPDF(true);
      soundManager.playSuccessChime();

      let text = `🛠️ *تقرير الصيانة والورشة الفنية - ${settings?.storeName || 'سند المحاسبي'}*\n`;
      text += `التاريخ: ${new Date().toLocaleDateString('ar-YE')}\n`;
      text += `-----------------------------------------\n`;
      text += `• الأجهزة المنجزة: ${maintenanceStats.completedOrdersCount} من أصل ${maintenanceStats.totalOrdersCount} جهاز\n`;
      text += `• أجور اليد (صافي الربح): ${fmt(maintenanceStats.totalLaborFeeRevenue)}\n`;
      text += `• تكلفة قطع الغيار: ${fmt(maintenanceStats.totalSparePartsCost)}\n`;
      text += `• إجمالي الإيرادات: ${fmt(maintenanceStats.totalMaintenanceRevenue)}\n`;
      text += `-----------------------------------------\n`;
      text += `*أداء الفنيين والإنتاجية:*\n`;

      maintenanceStats.techniciansList.forEach((tech, i) => {
        text += `${i + 1}. الفني: ${tech.name} | أجهزة منجزة: ${tech.completedCount} | أجور اليد: ${fmt(tech.laborFee)}\n`;
      });

      text += `-----------------------------------------\n`;
      text += `برمجة وتطوير م. عبدالمجيد المحواشي\n`;

      const fileName = `Maintenance_Report_${new Date().toISOString().split('T')[0]}.txt`;

      await saveAndShareFile({
        fileName,
        data: text,
        isBase64: false,
        mimeType: 'text/plain',
        title: 'تقرير الصيانة الفنية',
        text: `تقرير أرباح وأداء قسم الصيانة`
      });
    } catch (error) {
      console.error('Error generating Maintenance Report:', error);
      alert('⚠️ تعذر تصدير تقرير الصيانة.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 2. دالة تصدير ملخص التقرير المالي العام
  const handleExportSummaryPDF = async () => {
    try {
      setIsExportingPDF(true);
      soundManager.playSuccessChime();

      let text = `📊 *تقرير الأرباح والمبيعات - ${settings?.storeName || 'سند المحاسبي'}*\n`;
      text += `تاريخ التقرير: ${new Date().toLocaleDateString('ar-YE')}\n`;
      text += `الفترة: ${period === 'today' ? 'اليوم' : period === 'month' ? 'الشهر الحالي' : 'المحدد'}\n`;
      text += `-----------------------------------------\n`;
      text += `• إجمالي المبيعات (الإيرادات): ${fmt(stats.totalRevenue)}\n`;
      text += `• تكلفة البضاعة المباعة: ${fmt(stats.totalCostOfGoods)}\n`;
      text += `• صافي الأرباح: ${fmt(stats.grossProfit)}\n`;
      text += `• نسبة هامش الربح: %${stats.profitMargin.toFixed(1)}\n`;
      text += `• عدد الفواتير: ${stats.invoiceCount}\n`;
      text += `• مبيعات كاش: ${fmt(stats.totalCashRevenue)}\n`;
      text += `• مبيعات آجل (ديون): ${fmt(stats.totalDebtRevenue)}\n`;
      text += `-----------------------------------------\n`;
      text += `برمجة وتطوير م. عبدالمجيد المحواشي\n`;

      const fileName = `Financial_Report_${new Date().toISOString().split('T')[0]}.txt`;

      await saveAndShareFile({
        fileName,
        data: text,
        isBase64: false,
        mimeType: 'text/plain',
        title: 'تقرير الأرباح والمبيعات',
        text: `ملخص تقرير الأرباح والمبيعات الصادر`
      });
    } catch (error) {
      console.error('Error generating Summary PDF:', error);
      alert('⚠️ تعذر تصدير ملخص التقرير.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 3. دالة الطباعة المباشرة بأوامر نظام الهاتف الموثوقة
  const handleDirectPrint = () => {
    soundManager.playSuccessChime();
    try {
      window.print();
    } catch (err) {
      console.error("Print error:", err);
      alert("⚠️ تعذر فتح شاشة الطباعة.");
    }
  };

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

  // 1. Maintenance Profitability & Technician Performance Statistics
  const maintenanceStats = useMemo(() => {
    const orders = maintenanceOrders || [];
    const completedOrDelivered = orders.filter(o => o.status === 'completed' || o.status === 'delivered');

    let totalLaborFeeRevenue = 0;
    let totalSparePartsCost = 0;
    let totalMaintenanceRevenue = 0;

    const techMap = new Map<string, {
      name: string;
      completedCount: number;
      revenue: number;
      laborFee: number;
      spareParts: number;
    }>();

    orders.forEach(o => {
      const tech = o.technicianName?.trim() || 'فني الورشة والصيانة';
      const isCompleted = o.status === 'completed' || o.status === 'delivered';
      const cost = o.cost || 0;
      const parts = o.sparePartsCost || 0;
      const labor = o.laborFee ?? Math.max(0, cost - parts);

      if (isCompleted) {
        totalMaintenanceRevenue += cost;
        totalSparePartsCost += parts;
        totalLaborFeeRevenue += labor;
      }

      const existing = techMap.get(tech) || {
        name: tech,
        completedCount: 0,
        revenue: 0,
        laborFee: 0,
        spareParts: 0
      };

      if (isCompleted) {
        existing.completedCount += 1;
        existing.revenue += cost;
        existing.laborFee += labor;
        existing.spareParts += parts;
      }

      techMap.set(tech, existing);
    });

    const techniciansList = Array.from(techMap.values()).sort((a, b) => b.completedCount - a.completedCount);

    return {
      totalOrdersCount: orders.length,
      completedOrdersCount: completedOrDelivered.length,
      totalMaintenanceRevenue,
      totalSparePartsCost,
      totalLaborFeeRevenue,
      netWorkshopProfit: totalLaborFeeRevenue,
      techniciansList
    };
  }, [maintenanceOrders]);

  // 2. Smart Stock Assistant & Dead Stock Detector
  const deadStockAndTopSellers = useMemo(() => {
    const now = new Date();
    const d30 = new Date();
    d30.setDate(now.getDate() - 30);
    const d30Str = d30.toISOString().split('T')[0];

    const sales30DaysMap = new Map<string, number>();

    invoices.forEach(inv => {
      if (inv.status === 'refunded') return;
      let invDateStr = inv.date;
      if (inv.date.includes('T')) invDateStr = inv.date.split('T')[0];

      if (invDateStr >= d30Str) {
        inv.items.forEach(item => {
          const key = item.productId || item.name.trim().toLowerCase();
          const prev = sales30DaysMap.get(key) || 0;
          sales30DaysMap.set(key, prev + item.quantity);
        });
      }
    });

    const activeProducts = products.filter(p => !p.isDeleted);

    const topSellers = activeProducts
      .map(p => {
        const qtySold = sales30DaysMap.get(p.id) ?? sales30DaysMap.get(p.name.trim().toLowerCase()) ?? 0;
        return { ...p, qtySold30Days: qtySold };
      })
      .sort((a, b) => b.qtySold30Days - a.qtySold30Days)
      .slice(0, 8);

    const deadStockItems = activeProducts
      .map(p => {
        const qtySold = sales30DaysMap.get(p.id) ?? sales30DaysMap.get(p.name.trim().toLowerCase()) ?? 0;
        const tiedCapital = (p.stock || 0) * (p.costPrice || 0);
        return { ...p, qtySold30Days: qtySold, tiedCapital };
      })
      .filter(p => (p.stock || 0) > 0 && p.qtySold30Days === 0)
      .sort((a, b) => b.tiedCapital - a.tiedCapital);

    const totalDeadCapital = deadStockItems.reduce((sum, p) => sum + p.tiedCapital, 0);

    return {
      topSellers,
      deadStockItems,
      totalDeadCapital,
      deadStockCount: deadStockItems.length
    };
  }, [invoices, products]);

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
    <div id="profit_reports_view" className="space-y-6 pb-12 print:p-0 print:m-0">
      
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #profit_reports_view, #profit_reports_view * {
            visibility: visible !important;
          }
          #profit_reports_view {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="p-5 md:p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4 print:shadow-none print:border-none">
        
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

          <div className="flex flex-wrap items-center gap-2 self-end md:self-auto no-print">
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
              onClick={handleExportSummaryPDF}
              disabled={isExportingPDF}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md no-print disabled:opacity-50"
            >
              {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isExportingPDF ? 'جاري التصدير...' : 'تصدير PDF للملخص'}</span>
            </button>

            {reportSubTab === 'maintenance' && (
              <button
                onClick={handleExportMaintenancePDF}
                disabled={isExportingPDF}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md no-print disabled:opacity-50"
              >
                {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{isExportingPDF ? 'جاري التصدير...' : 'تصدير PDF للصيانة'}</span>
              </button>
            )}

            <button
              onClick={handleDirectPrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20 no-print"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة وتصدير التقرير</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 no-print">
          
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

        {/* REPORT SECTION SWITCHER TABS */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-start gap-2 overflow-x-auto pb-1 no-print">
          <button
            onClick={() => setReportSubTab('sales')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              reportSubTab === 'sales'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>📊 أرباح ومبيعات POS</span>
          </button>

          <button
            onClick={() => setReportSubTab('maintenance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              reportSubTab === 'maintenance'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>🛠️ إحصائيات وربحية الصيانة والأداء التنافسي</span>
          </button>

          <button
            onClick={() => setReportSubTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              reportSubTab === 'inventory'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>📦 مُساعد المخزون والأصناف الراكدة</span>
          </button>
        </div>

      </div>

      {/* VIEW 1: SALES & POS PROFITS */}
      {reportSubTab === 'sales' && (
        <div className="space-y-6">
          {/* KPI SUMMARY CARDS GRID */}
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

          {/* TIMELINE REVENUE & PROFIT CHART */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 no-print">
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

          {/* TOP PRODUCTS & PAYMENT DISTRIBUTION */}
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
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 no-print">
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
      )}

      {/* VIEW 2: MAINTENANCE PROFITABILITY & TECHNICIAN PERFORMANCE */}
      {reportSubTab === 'maintenance' && (
        <div className="space-y-6">
          
          {/* Workshop Profitability Header Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white shadow-md space-y-4">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <span className="px-2.5 py-1 rounded-full bg-purple-800/80 text-purple-200 text-[10px] font-bold border border-purple-700">
                  🛠️ قسم الصيانة والورشة الفنية
                </span>
                <h2 className="text-lg font-black mt-2">تقرير أرباح الصيانة والأداء التنافسي لفنيي الورشة</h2>
                <p className="text-xs text-purple-200 mt-0.5">
                  تحليل مالي مفصل لإيرادات أجور اليد، تكلفة قطع الغيار المستخدمة، ومؤشر أداء الفنيين
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                <button
                  onClick={handleExportMaintenancePDF}
                  disabled={isExportingPDF}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 no-print disabled:opacity-50"
                >
                  {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{isExportingPDF ? 'جاري التصدير...' : '📄 تصدير تقرير الصيانة'}</span>
                </button>

                <div className="p-3 rounded-xl bg-purple-800/50 border border-purple-700 text-left font-mono">
                  <span className="text-[10px] text-purple-300 block">صافي أرباح الورشة (أجور اليد):</span>
                  <span className="text-xl font-black text-emerald-300">
                    {fmt(maintenanceStats.netWorkshopProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Maintenance KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              
              <div className="p-3.5 rounded-xl bg-purple-800/40 border border-purple-700/60 space-y-1">
                <span className="text-[11px] text-purple-200 font-bold">إجمالي أجور اليد والخدمات:</span>
                <div className="text-lg font-black text-emerald-300 font-mono">
                  {fmt(maintenanceStats.totalLaborFeeRevenue)}
                </div>
                <p className="text-[10px] text-purple-300">إيرادات صيانة خالية من التكلفة</p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-800/40 border border-purple-700/60 space-y-1">
                <span className="text-[11px] text-purple-200 font-bold">تكلفة قطع الغيار المستخدمة:</span>
                <div className="text-lg font-black text-rose-300 font-mono">
                  {fmt(maintenanceStats.totalSparePartsCost)}
                </div>
                <p className="text-[10px] text-purple-300">قيمة قطع الغيار والقطع المستهلكة</p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-800/40 border border-purple-700/60 space-y-1">
                <span className="text-[11px] text-purple-200 font-bold">الأجهزة المنجزة نهائياً:</span>
                <div className="text-lg font-black text-amber-300 font-mono">
                  {maintenanceStats.completedOrdersCount} <span className="text-xs font-normal text-purple-200">من أصل {maintenanceStats.totalOrdersCount} جهاز</span>
                </div>
                <p className="text-[10px] text-purple-300">أجهزة مكتملة ومسقلبة بالكامل</p>
              </div>

            </div>
          </div>

          {/* Technician Performance Index Section */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-600" />
                  مؤشر أداء وكفاءة فنيي الصيانة (Technician Performance Index)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  عرض إجمالي الأجهزة المنجزة وإيرادات أجور اليد لكل فني صيانة بالمنشأة
                </p>
              </div>
            </div>

            {maintenanceStats.techniciansList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                لا توجد سجلات صيانة منجزة لفنيين حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {maintenanceStats.techniciansList.map((tech, idx) => {
                  const maxCompleted = maintenanceStats.techniciansList[0]?.completedCount || 1;
                  const percent = Math.round((tech.completedCount / maxCompleted) * 100);

                  return (
                    <div key={tech.name} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                            idx === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                            idx === 1 ? 'bg-slate-200 text-slate-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{tech.name}</h4>
                            <span className="text-[10px] text-purple-700 bg-purple-50 font-bold px-2 py-0.5 rounded-md border border-purple-100">
                              فني صيانة معتمد
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-lg font-black text-purple-900 font-mono">{tech.completedCount}</span>
                          <span className="text-[10px] text-slate-400 block font-sans">جهاز منجز</span>
                        </div>
                      </div>

                      {/* Financial performance for technician */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/80 font-mono">
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-[9.5px] text-slate-400 font-sans block">أجور اليد للفني:</span>
                          <span className="font-bold text-emerald-600 text-xs">{fmt(tech.laborFee)}</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <span className="text-[9.5px] text-slate-400 font-sans block">إجمالي الإيرادات:</span>
                          <span className="font-bold text-blue-600 text-xs">{fmt(tech.revenue)}</span>
                        </div>
                      </div>

                      {/* Performance Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                          <span>معدل الإنجاز النسبي:</span>
                          <span className="text-purple-700">{percent}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div 
                            className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* VIEW 3: SMART INVENTORY & DEAD STOCK ASSISTANT */}
      {reportSubTab === 'inventory' && (
        <div className="space-y-6">
          
          {/* Tied Capital & Dead Stock Alert Banner */}
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 shadow-sm space-y-3">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-amber-950 flex items-center gap-2">
                    مُساعد المخزون الذكي وكشف الأصناف الراكدة (Dead Stock Intelligence)
                  </h2>
                  <p className="text-xs text-amber-800 mt-0.5">
                    المنتجات التي تمتلك كميات متوفرة في المخزن ولم يُسجل لها أي حركة مبيعات خلال آخر 30 يوماً
                  </p>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-amber-300 text-left font-mono shrink-0">
                <span className="text-[10px] text-amber-800 font-sans block font-bold">السيولة المعطلة في البضائع الراكدة:</span>
                <span className="text-lg font-black text-rose-700">
                  {fmt(deadStockAndTopSellers.totalDeadCapital)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 pt-2 border-t border-amber-200">
              <Zap className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تم كشف <span className="font-black text-rose-700 underline">{deadStockAndTopSellers.deadStockCount} صنف راكد</span> يتطلب عمل تصفية سريعة أو خصومات ترويجية لزيادة سيولة المنشأة.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Selling Items (الأكثر مبيعاً) */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  الأصناف الأكثر مبيعاً بكثافة (Top Sellers - آخر 30 يوماً)
                </h3>
              </div>

              <div className="space-y-2">
                {deadStockAndTopSellers.topSellers.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">لا توجد سجلات مبيعات في آخر 30 يوماً.</div>
                ) : (
                  deadStockAndTopSellers.topSellers.map((item, idx) => (
                    <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-400">الباركود: {item.barcode} | المخزون المتبقي: {item.stock} حبة</div>
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        <div className="font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {item.qtySold30Days} مبيعة
                        </div>
                        <div className="text-[9.5px] text-slate-500 mt-0.5">{item.sellingPrice.toLocaleString()} {currency}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dead Stock Items (الأصناف الراكدة) */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-rose-600" />
                  الأصناف الراكدة (Dead Stock - بدون بيع منذ 30 يوم)
                </h3>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {deadStockAndTopSellers.deadStockItems.length === 0 ? (
                  <div className="py-8 text-center text-emerald-600 text-xs font-bold">
                    🎉 ممتاز! لا توجد أصناف راكدة معطلة للسيولة بالمنشأة.
                  </div>
                ) : (
                  deadStockAndTopSellers.deadStockItems.map(item => (
                    <div key={item.id} className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{item.name}</span>
                          <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded">
                            راكد ❄️
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          الكمية بالمخزن: <span className="font-bold text-slate-800">{item.stock}</span> | رأس المال المعطل: <span className="font-bold text-rose-700">{fmt(item.tiedCapital)}</span>
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        <span className="text-[10px] text-slate-400 block">السعر الحالي: {item.sellingPrice.toLocaleString()} {currency}</span>
                        <span className="text-[9.5px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                          مقترح تصفية بـ {(item.sellingPrice * 0.85).toFixed(0)} {currency}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
