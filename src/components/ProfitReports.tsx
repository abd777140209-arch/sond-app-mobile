/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { generateAndSharePDF } from '../services/pdfService';
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
  Loader2,
  Table,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
type DisplayMode = 'charts' | 'tables';

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
  const [displayMode, setDisplayMode] = useState<DisplayMode>('charts');
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

  // Recharts Data: Current Week Sales & Daily Trends Breakdown
  const currentWeekStats = useMemo(() => {
    const dayNamesArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const now = new Date();
    const currentDayIndex = now.getDay(); // 0 is Sunday, 6 is Saturday
    
    // Middle Eastern work week starts Saturday (Saturday = 0 offset, Friday = 6)
    const diffToSaturday = (currentDayIndex + 1) % 7; 
    const saturdayDate = new Date(now);
    saturdayDate.setDate(now.getDate() - diffToSaturday);

    const weekDays: Array<{
      dateStr: string;
      dayName: string;
      dayLabel: string;
      revenue: number;
      profit: number;
      count: number;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(saturdayDate);
      d.setDate(saturdayDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = dayNamesArabic[d.getDay()];
      const dayLabel = `${dayName} (${d.getDate()}/${d.getMonth() + 1})`;

      weekDays.push({
        dateStr,
        dayName,
        dayLabel,
        revenue: 0,
        profit: 0,
        count: 0
      });
    }

    // Process all non-refunded invoices for these 7 days
    invoices.forEach(inv => {
      if (inv.status === 'refunded') return;
      let invDateStr = inv.date;
      if (inv.date.includes('T')) invDateStr = inv.date.split('T')[0];

      const found = weekDays.find(w => w.dateStr === invDateStr);
      if (found) {
        let invCost = 0;
        inv.items.forEach(item => {
          const costPrice = productCostMap.get(item.productId) ?? productCostMap.get(item.name.trim().toLowerCase()) ?? 0;
          invCost += item.quantity * costPrice;
        });

        const rev = inv.finalAmount || 0;
        found.revenue += rev;
        found.profit += (rev - invCost);
        found.count += 1;
      }
    });

    const totalRevenue = weekDays.reduce((acc, d) => acc + d.revenue, 0);
    const totalProfit = weekDays.reduce((acc, d) => acc + d.profit, 0);
    const totalCount = weekDays.reduce((acc, d) => acc + d.count, 0);

    let peakDay = weekDays[0];
    weekDays.forEach(d => {
      if (d.revenue > peakDay.revenue) {
        peakDay = d;
      }
    });

    return {
      chartData: weekDays,
      totalRevenue,
      totalProfit,
      totalCount,
      peakDay
    };
  }, [invoices, productCostMap]);

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

  // 📊 تصدير كشف أرباح ومبيعات الأصناف إلى إكسل Excel (.xlsx) احترافي ككشف تفصيلي
  const handleExportSalesProfitExcel = async () => {
    soundManager.playSuccessChime();

    // تجميع المبيعات حسب الصنف
    const productStatsMap = new Map<string, { name: string; qty: number; totalCost: number; totalRev: number; profit: number }>();

    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const costPrice = productCostMap.get(item.productId) ?? productCostMap.get(item.name.trim().toLowerCase()) ?? 0;
        const itemCostTotal = item.quantity * costPrice;
        const itemProfit = item.total - itemCostTotal;

        const prev = productStatsMap.get(item.name) || { name: item.name, qty: 0, totalCost: 0, totalRev: 0, profit: 0 };
        productStatsMap.set(item.name, {
          name: item.name,
          qty: prev.qty + item.quantity,
          totalCost: prev.totalCost + itemCostTotal,
          totalRev: prev.totalRev + item.total,
          profit: prev.profit + itemProfit
        });
      });
    });

    const itemsList = Array.from(productStatsMap.values()).sort((a, b) => b.profit - a.profit);
    const totalQtySold = itemsList.reduce((sum, it) => sum + it.qty, 0);

    const data: Record<string, string | number>[] = itemsList.map((it, idx) => {
      const avgCost = it.qty > 0 ? it.totalCost / it.qty : 0;
      const avgSelling = it.qty > 0 ? it.totalRev / it.qty : 0;
      const margin = it.totalRev > 0 ? (it.profit / it.totalRev) * 100 : 0;

      return {
        'م': idx + 1,
        'اسم الصنف / السلعة': it.name,
        'الكمية المباعة': it.qty,
        'سعر الشراء (التكلفة)': isPrivacyMode ? '***' : Math.round(avgCost),
        'متوسط سعر البيع': Math.round(avgSelling),
        'إجمالي التكلفة': isPrivacyMode ? '***' : it.totalCost,
        'إجمالي الإيرادات (المبيعات)': it.totalRev,
        'صافي الأرباح المحققة': isPrivacyMode ? '***' : it.profit,
        'نسبة هامش الربح %': isPrivacyMode ? '***' : `%${margin.toFixed(1)}`
      };
    });

    // إضافة صف الإجمالي
    data.push({
      'م': 'الإجمالي الكلي',
      'اسم الصنف / السلعة': `إجمالي الأصناف المباعة: ${itemsList.length} صنف (${stats.invoiceCount} فاتورة)`,
      'الكمية المباعة': totalQtySold,
      'سعر الشراء (التكلفة)': '-',
      'متوسط سعر البيع': '-',
      'إجمالي التكلفة': isPrivacyMode ? '***' : stats.totalCostOfGoods,
      'إجمالي الإيرادات (المبيعات)': stats.totalRevenue,
      'صافي الأرباح المحققة': isPrivacyMode ? '***' : stats.grossProfit,
      'نسبة هامش الربح %': isPrivacyMode ? '***' : `%${stats.profitMargin.toFixed(1)}`
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    worksheet['!cols'] = [
      { wch: 6 },  // م
      { wch: 32 }, // اسم الصنف
      { wch: 16 }, // الكمية المباعة
      { wch: 20 }, // سعر الشراء
      { wch: 18 }, // متوسط سعر البيع
      { wch: 20 }, // إجمالي التكلفة
      { wch: 24 }, // إجمالي الإيرادات
      { wch: 22 }, // صافي الأرباح
      { wch: 18 }  // هامش الربح
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'كشف أرباح المبيعات');

    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const fileName = `كشف_أرباح_المبيعات_${new Date().toISOString().split('T')[0]}.xlsx`;

    await saveAndShareFile({
      fileName,
      data: excelBase64,
      isBase64: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'كشف أرباح المبيعات Excel',
      text: `كشف أرباح ومبيعات الأصناف التفصيلي من تطبيق سند المحاسبي`
    });
  };

  // 📄 تصدير كشف أرباح ومبيعات الأصناف PDF ككشف رسمي
  const handleExportSummaryPDF = async () => {
    soundManager.playSuccessChime();
    try {
      setIsExportingPDF(true);

      const productStatsMap = new Map<string, { name: string; qty: number; totalCost: number; totalRev: number; profit: number }>();

      filteredInvoices.forEach(inv => {
        inv.items.forEach(item => {
          const costPrice = productCostMap.get(item.productId) ?? productCostMap.get(item.name.trim().toLowerCase()) ?? 0;
          const itemCostTotal = item.quantity * costPrice;
          const itemProfit = item.total - itemCostTotal;

          const prev = productStatsMap.get(item.name) || { name: item.name, qty: 0, totalCost: 0, totalRev: 0, profit: 0 };
          productStatsMap.set(item.name, {
            name: item.name,
            qty: prev.qty + item.quantity,
            totalCost: prev.totalCost + itemCostTotal,
            totalRev: prev.totalRev + item.total,
            profit: prev.profit + itemProfit
          });
        });
      });

      const itemsList = Array.from(productStatsMap.values()).sort((a, b) => b.profit - a.profit);

      const customColumns = [
        { key: 'index', label: 'م', width: '35px', align: 'center' as const },
        { key: 'name', label: 'اسم الصنف / المادة المباعة', align: 'right' as const },
        { key: 'qty', label: 'الكمية', width: '60px', align: 'center' as const },
        { key: 'unitCost', label: 'سعر الشراء', width: '85px', align: 'center' as const },
        { key: 'unitPrice', label: 'سعر البيع', width: '85px', align: 'center' as const },
        { key: 'totalCost', label: 'إجمالي التكلفة', width: '95px', align: 'center' as const },
        { key: 'totalRev', label: 'إجمالي المبيعات', width: '95px', align: 'center' as const },
        { key: 'profit', label: 'صافي الربح', width: '90px', align: 'center' as const },
        { key: 'margin', label: 'الهامش %', width: '70px', align: 'center' as const }
      ];

      const customRows: Record<string, string | number>[] = itemsList.map((it, idx) => {
        const avgCost = it.qty > 0 ? it.totalCost / it.qty : 0;
        const avgSelling = it.qty > 0 ? it.totalRev / it.qty : 0;
        const margin = it.totalRev > 0 ? (it.profit / it.totalRev) * 100 : 0;

        return {
          index: idx + 1,
          name: it.name || 'صنف',
          qty: it.qty,
          unitCost: isPrivacyMode ? '***' : `${Math.round(avgCost).toLocaleString()} ${currency}`,
          unitPrice: `${Math.round(avgSelling).toLocaleString()} ${currency}`,
          totalCost: isPrivacyMode ? '***' : `${it.totalCost.toLocaleString()} ${currency}`,
          totalRev: `${it.totalRev.toLocaleString()} ${currency}`,
          profit: isPrivacyMode ? '***' : `${it.profit.toLocaleString()} ${currency}`,
          margin: `%${margin.toFixed(0)}`
        };
      });

      if (itemsList.length > 0) {
        customRows.push({
          index: 'الإجمالي',
          name: `إجمالي الأصناف: ${itemsList.length} صنف`,
          qty: itemsList.reduce((sum, it) => sum + it.qty, 0),
          unitCost: '—',
          unitPrice: '—',
          totalCost: isPrivacyMode ? '***' : `${stats.totalCostOfGoods.toLocaleString()} ${currency}`,
          totalRev: `${stats.totalRevenue.toLocaleString()} ${currency}`,
          profit: isPrivacyMode ? '***' : `${stats.grossProfit.toLocaleString()} ${currency}`,
          margin: `%${stats.profitMargin.toFixed(1)}`
        });
      }

      const periodLabel = period === 'today' ? 'اليوم' : period === 'week' ? 'الأسبوع الحالي' : period === 'month' ? 'الشهر الحالي' : period === '30days' ? 'آخر 30 يوم' : period === 'year' ? 'السنة الحالية' : 'فترة مخصصة';

      const summaryBoxes = [
        { label: 'إجمالي المبيعات', value: `${stats.totalRevenue.toLocaleString()} ${currency}`, color: '#0284c7', bg: '#f0f9ff' },
        { label: 'تكلفة البضاعة المباعة', value: isPrivacyMode ? '***' : `${stats.totalCostOfGoods.toLocaleString()} ${currency}`, color: '#0f172a', bg: '#f8fafc' },
        { label: 'صافي الأرباح المحققة', value: isPrivacyMode ? '***' : `${stats.grossProfit.toLocaleString()} ${currency}`, color: '#059669', bg: '#ecfdf5' },
        { label: 'نسبة هامش الربح', value: `%${stats.profitMargin.toFixed(1)}`, color: '#16a34a', bg: '#f0fdf4' },
        { label: 'عدد الفواتير الصادرة', value: `${stats.invoiceCount} فاتورة`, color: '#6366f1', bg: '#eef2ff' },
        { label: 'مبيعات نقداً / آجل', value: `كاش: ${stats.totalCashRevenue.toLocaleString()} | آجل: ${stats.totalDebtRevenue.toLocaleString()}`, color: '#d97706', bg: '#fffbeb' }
      ];

      await generateAndSharePDF({
        title: 'كشف حساب أرباح ومبيعات الأصناف التفصيلي',
        storeName: settings?.storeName || 'سند المحاسبي',
        invoiceNumber: `أرباح-${Date.now().toString().slice(-4)}`,
        customerName: 'الإدارة العامة ومراقبة الأرباح',
        phone: settings?.phone || '',
        date: new Date().toLocaleDateString('ar-YE') + ' ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: `الفترة المحددة: ${periodLabel}`,
        orientation: 'l',
        customColumns,
        customRows: customRows.length > 0 ? customRows : [
          { index: 1, name: 'لا توجد مبيعات مسجلة في هذه الفترة', qty: 0, unitCost: '-', unitPrice: '-', totalCost: '0', totalRev: '0', profit: '0', margin: '0%' }
        ],
        summaryBoxes,
        subtotal: `إجمالي الإيرادات: ${stats.totalRevenue.toLocaleString()} ${currency}`,
        discount: `التكلفة: ${stats.totalCostOfGoods.toLocaleString()} ${currency}`,
        totalAmount: `${stats.grossProfit.toLocaleString()} ${currency}`,
        notes: `تقرير مالي رسمي مفصل للأرباح ومبيعات الأصناف عن الفترة: ${periodLabel}. تم إصدار ${stats.invoiceCount} فاتورة.`,
        footerNote: '✨ كشف الأرباح والمبيعات المعتمد - نظام سند المحاسبي'
      });
    } catch (error) {
      console.error('Error generating Summary PDF:', error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 📄 تصدير كشف عمليات الصيانة PDF ككشف محاسبي
  const handleExportMaintenancePDF = async () => {
    try {
      setIsExportingPDF(true);
      const totalMaintenanceCost = maintenanceOrders.reduce((sum, m) => sum + (m.cost || 0), 0);
      const totalMaintenanceSpareCost = maintenanceOrders.reduce((sum, m) => sum + (m.sparePartsCost || 0), 0);
      const netMaintenanceProfit = totalMaintenanceCost - totalMaintenanceSpareCost;

      const customColumns = [
        { key: 'index', label: 'م', width: '35px', align: 'center' as const },
        { key: 'orderNum', label: 'رقم الكرت', width: '80px', align: 'center' as const },
        { key: 'date', label: 'تاريخ الاستلام', width: '95px', align: 'center' as const },
        { key: 'device', label: 'الجهاز والموديل', align: 'right' as const },
        { key: 'customer', label: 'العميل والهاتف', width: '130px', align: 'right' as const },
        { key: 'issue', label: 'العطل المطلوب', align: 'right' as const },
        { key: 'fee', label: 'قيمة الصيانة', width: '90px', align: 'center' as const },
        { key: 'status', label: 'الحالة', width: '85px', align: 'center' as const }
      ];

      const customRows: Record<string, string | number>[] = maintenanceOrders.map((m, idx) => {
        const statusLabel = 
          m.status === 'delivered' ? '✅ تم التسليم' :
          m.status === 'completed' ? '🎉 تم الإنجاز' :
          m.status === 'repairing' ? '🔧 قيد العمل' :
          m.status === 'received' ? '📥 مستلم' : '—';

        return {
          index: idx + 1,
          orderNum: m.orderNumber || m.id.slice(0, 6),
          date: m.dateReceived ? new Date(m.dateReceived).toLocaleDateString('ar-YE') : '-',
          device: m.deviceName || 'جهاز صيانة',
          customer: `${m.customerName || 'عميل'} ${m.customerPhone ? ' (' + m.customerPhone + ')' : ''}`,
          issue: m.issueDescription || 'فحص وصيانة',
          fee: `${(m.cost || 0).toLocaleString()} ${currency}`,
          status: statusLabel
        };
      });

      if (maintenanceOrders.length > 0) {
        customRows.push({
          index: 'الإجمالي',
          orderNum: `العدد: ${maintenanceOrders.length}`,
          date: '—',
          device: '—',
          customer: '—',
          issue: `صافي الربح: ${netMaintenanceProfit.toLocaleString()} ${currency}`,
          fee: `${totalMaintenanceCost.toLocaleString()} ${currency}`,
          status: '✅ معتمد'
        });
      }

      const summaryBoxes = [
        { label: 'إجمالي أوامر الصيانة', value: `${maintenanceOrders.length} كرت صيانة`, color: '#6366f1', bg: '#eef2ff' },
        { label: 'إجمالي دخل الصيانة', value: `${totalMaintenanceCost.toLocaleString()} ${currency}`, color: '#059669', bg: '#ecfdf5' },
        { label: 'صافي ربح الصيانة', value: `${netMaintenanceProfit.toLocaleString()} ${currency}`, color: '#0284c7', bg: '#f0f9ff' },
        { label: 'تاريخ إصدار الكشف', value: new Date().toLocaleDateString('ar-YE'), color: '#475569', bg: '#f8fafc' }
      ];

      await generateAndSharePDF({
        title: 'كشف حساب وعمليات الصيانة الفنية',
        storeName: settings?.storeName || 'سند المحاسبي',
        invoiceNumber: `صيانة-${new Date().getMonth() + 1}`,
        customerName: 'قسم الصيانة والدعم الفني',
        phone: settings?.phone || '',
        date: new Date().toLocaleDateString('ar-YE') + ' ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: 'كشف تشغيلي ومالي مفصل لخدمات الصيانة',
        orientation: 'l',
        customColumns,
        customRows,
        summaryBoxes,
        subtotal: `إجمالي الصيانة: ${totalMaintenanceCost.toLocaleString()} ${currency}`,
        discount: '0',
        totalAmount: `${totalMaintenanceCost.toLocaleString()} ${currency}`,
        notes: `كشف رسمي بكافة كروت وعمليات الصيانة المسجلة.`,
        footerNote: '✨ كشف خدمات الصيانة الفنية المعتمد - نظام سند المحاسبي'
      });
    } catch (error) {
      console.error('Error generating Maintenance PDF:', error);
    } finally {
      setIsExportingPDF(false);
    }
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
              onClick={handleExportSummaryPDF}
              disabled={isExportingPDF}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md no-print disabled:opacity-50"
            >
              {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isExportingPDF ? 'جاري التصدير...' : 'كشف أرباح PDF'}</span>
            </button>

            <button
              onClick={handleExportSalesProfitExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-emerald-200 shadow-sm no-print"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>كشف أرباح Excel</span>
            </button>

            {reportSubTab === 'maintenance' && (
              <button
                onClick={handleExportMaintenancePDF}
                disabled={isExportingPDF}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md no-print disabled:opacity-50"
              >
                {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{isExportingPDF ? 'جاري التصدير...' : 'كشف صيانة PDF'}</span>
              </button>
            )}

            <button
              onClick={() => {
                soundManager.playSuccessChime();
                if (Capacitor.isNativePlatform() || window.innerWidth < 768) {
                  handleExportSummaryPDF();
                } else {
                  window.print();
                }
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20 no-print"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة وتصدير التقرير</span>
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
              { id: 'custom', label: 'مخصص 📅' },
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

          {/* Date Range Picker (Shown for custom period or easily accessible) */}
          <div className={`flex items-center gap-2 flex-wrap bg-slate-50 border border-slate-200 p-2 rounded-xl transition ${period === 'custom' ? 'ring-2 ring-blue-500/30 bg-blue-50/60 border-blue-300' : ''}`}>
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              تحديد نطاق تاريخ:
            </span>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">من:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (period !== 'custom') setPeriod('custom');
                }}
                className="bg-white border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-slate-500">إلى:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (period !== 'custom') setPeriod('custom');
                }}
                className="bg-white border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              />
            </div>
            {period === 'custom' && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                مفعل
              </span>
            )}
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

        {/* REPORT SECTION SWITCHER TABS & DISPLAY MODE SWITCHER */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center justify-start gap-2 overflow-x-auto pb-1">
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
              <span>🛠️ إحصائيات وربحية الصيانة</span>
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
              <span>📦 مُساعد المخزون والراكد</span>
            </button>
          </div>

          {/* Toggle View Mode (Interactive Charts vs Mobile Tables) */}
          <div className="flex items-center justify-center self-end md:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <span className="text-[10px] text-slate-500 font-bold px-1.5 hidden sm:inline">نمط العرض:</span>
            <button
              type="button"
              onClick={() => {
                soundManager.playScanBeep();
                setDisplayMode('charts');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                displayMode === 'charts'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض المخططات البيانية التفاعلية"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>عرض تفاعلي (مخططات)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playScanBeep();
                setDisplayMode('tables');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                displayMode === 'tables'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض الجداول المبسطة لتناسب الهواتف الذكية"
            >
              <Table className="w-3.5 h-3.5" />
              <span>جداول مبسطة (هواتف) 📱</span>
            </button>
          </div>
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

          {/* CONDITIONAL RENDERING: INTERACTIVE CHARTS VS SIMPLIFIED TABLES */}
          {displayMode === 'charts' ? (
            <>
              {/* CURRENT WEEK SALES & TRENDS CHART (RECHARTS INTEGRATION) */}
              <div className="p-5 md:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      اتجاهات مبيعات الأسبوع الحالي (Recharts)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      مخطط بياني تفاعلي يوضح حركة البيع والأرباح اليومية لأيام الأسبوع السبعة الحالية (من السبت إلى الجمعة)
                    </p>
                  </div>

                  {/* Summary Badges for current week */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold">
                      مبيعات الأسبوع: <span className="font-black font-mono dir-ltr">{fmt(currentWeekStats.totalRevenue)}</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
                      الأرباح: <span className="font-black font-mono dir-ltr">+{fmt(currentWeekStats.totalProfit)}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Indicators Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="text-slate-400 font-bold text-[11px]">مبيعات الأسبوع الكلية</div>
                    <div className="text-sm font-black text-slate-900 font-mono mt-0.5 dir-ltr text-right">{fmt(currentWeekStats.totalRevenue)}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs">
                    <div className="text-emerald-700 font-bold text-[11px]">أرباح الأسبوع الصافية</div>
                    <div className="text-sm font-black text-emerald-700 font-mono mt-0.5 dir-ltr text-right">+{fmt(currentWeekStats.totalProfit)}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="text-slate-400 font-bold text-[11px]">فواتير الأسبوع</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">{currentWeekStats.totalCount} فاتورة</div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
                    <div className="text-amber-800 font-bold text-[11px]">أعلى يوم مبيعات</div>
                    <div className="text-xs font-black text-amber-900 mt-0.5 truncate">
                      {currentWeekStats.peakDay.revenue > 0 
                        ? `${currentWeekStats.peakDay.dayName} (${fmt(currentWeekStats.peakDay.revenue)})`
                        : 'لا توجد مبيعات بعد'}
                    </div>
                  </div>
                </div>

                {/* Recharts BarChart Container */}
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={currentWeekStats.chartData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="dayLabel" stroke="#64748B" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                        }}
                        formatter={(value: any, name: any) => [
                          typeof value === 'number' ? fmt(value) : value,
                          name === 'revenue' ? 'إجمالي المبيعات' : name === 'profit' ? 'صافي الربح' : name
                        ]}
                        labelStyle={{ color: '#94A3B8', fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                        formatter={(value) => (value === 'revenue' ? 'إجمالي المبيعات' : 'صافي الربح')}
                      />
                      <Bar
                        dataKey="revenue"
                        name="revenue"
                        fill="#4F46E5"
                        radius={[8, 8, 0, 0]}
                        barSize={24}
                      />
                      <Bar
                        dataKey="profit"
                        name="profit"
                        fill="#10B981"
                        radius={[8, 8, 0, 0]}
                        barSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* TIMELINE REVENUE & PROFIT CHART */}
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
            </>
          ) : (
            /* SIMPLIFIED TABLE VIEW FOR MOBILE / COMPACT SCREENS */
            <div className="space-y-6">
              {/* Timeline Sales Table */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Table className="w-4 h-4 text-emerald-600" />
                    جدول البيانات الزمنيّة للمبيعات والأرباح
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    السجلات: {timelineChartData.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse min-w-[550px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2.5">التاريخ / الفترة</th>
                        <th className="p-2.5 text-center">الفواتير</th>
                        <th className="p-2.5 text-left">المبيعات</th>
                        <th className="p-2.5 text-left">التكلفة</th>
                        <th className="p-2.5 text-left">صافي الربح</th>
                        <th className="p-2.5 text-center">الهامش %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {timelineChartData.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">لا توجد بيانات للفترة المحددة</td>
                        </tr>
                      ) : (
                        timelineChartData.map((row) => {
                          const margin = row.revenue > 0 ? ((row.profit / row.revenue) * 100).toFixed(1) : '0';
                          return (
                            <tr key={row.dateLabel} className="hover:bg-slate-50 transition">
                              <td className="p-2.5 font-bold text-slate-900 font-mono dir-ltr text-right">{row.dateLabel}</td>
                              <td className="p-2.5 text-center font-mono font-bold text-slate-600">{row.count}</td>
                              <td className="p-2.5 text-left font-mono font-bold text-blue-600">{fmt(row.revenue)}</td>
                              <td className="p-2.5 text-left font-mono text-slate-600">{fmt(row.cost)}</td>
                              <td className="p-2.5 text-left font-mono font-bold text-emerald-600">+{fmt(row.profit)}</td>
                              <td className="p-2.5 text-center font-mono font-bold">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px]">
                                  %{margin}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {timelineChartData.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-900 text-white font-bold text-xs">
                          <td className="p-2.5">الإجمالي الكلي</td>
                          <td className="p-2.5 text-center font-mono">{stats.invoiceCount}</td>
                          <td className="p-2.5 text-left font-mono text-blue-300">{fmt(stats.totalRevenue)}</td>
                          <td className="p-2.5 text-left font-mono text-slate-300">{fmt(stats.totalCostOfGoods)}</td>
                          <td className="p-2.5 text-left font-mono text-emerald-300">+{fmt(stats.grossProfit)}</td>
                          <td className="p-2.5 text-center font-mono text-amber-300">%{stats.profitMargin.toFixed(1)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Top Products & Payment Breakdown Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Top Products Table */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    جدول الأكثر مبيعاً وربحية
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse min-w-[320px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-2">#</th>
                          <th className="p-2">اسم الصنف</th>
                          <th className="p-2 text-center">الكمية</th>
                          <th className="p-2 text-left">المبيعات</th>
                          <th className="p-2 text-left">الربح الصافي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.topProducts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400">لا توجد بيانات أصناف</td>
                          </tr>
                        ) : (
                          stats.topProducts.map((p, idx) => (
                            <tr key={p.name} className="hover:bg-slate-50">
                              <td className="p-2 font-black text-blue-600">#{idx + 1}</td>
                              <td className="p-2 font-bold text-slate-900">{p.name}</td>
                              <td className="p-2 text-center font-mono font-bold text-slate-700">{p.qty}</td>
                              <td className="p-2 text-left font-mono text-slate-600">{fmt(p.revenue)}</td>
                              <td className="p-2 text-left font-mono font-bold text-emerald-600">+{fmt(p.profit)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Breakdown Table */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <PieIcon className="w-4 h-4 text-blue-600" />
                    جدول توزيع مبيعات الدفع (كاش / آجل)
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse min-w-[300px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-2.5">طريقة الدفع</th>
                          <th className="p-2.5 text-left">إجمالي المبيعات</th>
                          <th className="p-2.5 text-center">النسبة المئوية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {piePaymentData.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-slate-400">لا توجد عمليات مبيعات</td>
                          </tr>
                        ) : (
                          piePaymentData.map((item) => {
                            const pct = stats.totalRevenue > 0 ? ((item.value / stats.totalRevenue) * 100).toFixed(1) : '0';
                            return (
                              <tr key={item.name} className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900 flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                  {item.name}
                                </td>
                                <td className="p-2.5 text-left font-mono font-bold text-slate-800">{fmt(item.value)}</td>
                                <td className="p-2.5 text-center font-mono font-bold text-blue-600">%{pct}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}
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
                  <span>{isExportingPDF ? 'جاري التصدير...' : '📄 تصدير تقرير الصيانة (PDF)'}</span>
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

          {/* CONDITIONAL RENDERING: CARDS VS TABLE */}
          {displayMode === 'charts' ? (
            /* Technician Performance Index Section (Cards View) */
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
          ) : (
            /* Simplified Table View for Maintenance */
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Table className="w-4 h-4 text-purple-600" />
                جدول أداء وفنيي قسم الصيانة
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-purple-900 text-white font-bold">
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">اسم الفني</th>
                      <th className="p-2.5 text-center">الأجهزة المنجزة</th>
                      <th className="p-2.5 text-left">أجور اليد (صافي الربح)</th>
                      <th className="p-2.5 text-left">قطع الغيار</th>
                      <th className="p-2.5 text-left">إجمالي الإيرادات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {maintenanceStats.techniciansList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">لا توجد سجلات فنيين صيانة</td>
                      </tr>
                    ) : (
                      maintenanceStats.techniciansList.map((tech, idx) => (
                        <tr key={tech.name} className="hover:bg-purple-50/50">
                          <td className="p-2.5 font-bold text-purple-900">#{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900">{tech.name}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-purple-700">{tech.completedCount}</td>
                          <td className="p-2.5 text-left font-mono font-bold text-emerald-600">{fmt(tech.laborFee)}</td>
                          <td className="p-2.5 text-left font-mono text-rose-600">{fmt(tech.spareParts)}</td>
                          <td className="p-2.5 text-left font-mono font-bold text-slate-900">{fmt(tech.revenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

          {/* CONDITIONAL RENDERING: CARDS VS TABLES */}
          {displayMode === 'charts' ? (
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
          ) : (
            /* SIMPLIFIED TABLES FOR INVENTORY */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Top Sellers Table */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  جدول الأصناف الأكثر مبيعاً (آخر 30 يوماً)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse min-w-[320px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2">#</th>
                        <th className="p-2">اسم الصنف</th>
                        <th className="p-2 text-center">المباع</th>
                        <th className="p-2 text-center">المتبقي</th>
                        <th className="p-2 text-left">سعر البيع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deadStockAndTopSellers.topSellers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">لا توجد مبيعات في 30 يوماً</td>
                        </tr>
                      ) : (
                        deadStockAndTopSellers.topSellers.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-2 font-black text-amber-600">#{idx + 1}</td>
                            <td className="p-2 font-bold text-slate-900">{item.name}</td>
                            <td className="p-2 text-center font-mono font-bold text-emerald-600">{item.qtySold30Days}</td>
                            <td className="p-2 text-center font-mono text-slate-600">{item.stock}</td>
                            <td className="p-2 text-left font-mono font-bold">{fmt(item.sellingPrice)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dead Stock Table */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-rose-600" />
                  جدول الأصناف الراكدة (السيولة المعطلة)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse min-w-[360px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2">الصنف</th>
                        <th className="p-2 text-center">المخزون</th>
                        <th className="p-2 text-left">السيولة المعطلة</th>
                        <th className="p-2 text-left">مقترح التصفية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deadStockAndTopSellers.deadStockItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-emerald-600 font-bold">🎉 لا توجد أصناف راكدة معطلة!</td>
                        </tr>
                      ) : (
                        deadStockAndTopSellers.deadStockItems.map((item) => (
                          <tr key={item.id} className="hover:bg-rose-50/50">
                            <td className="p-2 font-bold text-slate-900">{item.name}</td>
                            <td className="p-2 text-center font-mono font-bold text-slate-700">{item.stock}</td>
                            <td className="p-2 text-left font-mono font-bold text-rose-600">{fmt(item.tiedCapital)}</td>
                            <td className="p-2 text-left font-mono text-purple-700 font-bold">{fmt(item.sellingPrice * 0.85)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* HIDDEN PRINTABLE CONTAINER FOR HIGH-RES PDF EXPORT */}
      <div
        id="maintenance-pdf-printable-report"
        className="bg-white text-slate-900 p-8 font-sans"
        style={{ display: 'none', width: '820px', direction: 'rtl' }}
      >
        {/* Document Header */}
        <div className="border-b-2 border-purple-900 pb-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-purple-950">
              {settings?.storeName || 'مركز الصيانة والورشة الفنية المعتمدة'}
            </h1>
            <h2 className="text-base font-bold text-slate-700 mt-1">
              تقرير أرباح الصيانة ومؤشر كفاءة فنيي الورشة
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
            </p>
          </div>
          <div className="text-left font-mono bg-purple-50 p-3 rounded-xl border border-purple-200">
            <span className="text-xs text-purple-800 font-sans font-bold block">الفترة المحددة:</span>
            <span className="text-sm font-black text-purple-950">
              {period === 'today' ? 'اليوم' : period === 'week' ? 'الأسبوع الحالي' : period === 'month' ? 'الشهر الحالي' : period === '30days' ? 'آخر 30 يوماً' : 'الكلي'}
            </span>
          </div>
        </div>

        {/* Financial Overview Cards */}
        <div className="grid grid-cols-4 gap-3 mb-6 font-mono text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-sans font-bold text-slate-500 block">الأجهزة المنجزة</span>
            <span className="text-lg font-black text-blue-600">{maintenanceStats.completedOrdersCount} جهاز</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-sans font-bold text-slate-500 block">إجمالي الإيرادات</span>
            <span className="text-lg font-black text-slate-900">{maintenanceStats.totalMaintenanceRevenue.toLocaleString()} {currency}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-sans font-bold text-slate-500 block">تكلفة قطع الغيار</span>
            <span className="text-lg font-black text-rose-600">{maintenanceStats.totalSparePartsCost.toLocaleString()} {currency}</span>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-300">
            <span className="text-xs font-sans font-bold text-purple-800 block">صافي أجور اليد (الربح)</span>
            <span className="text-lg font-black text-emerald-600">{maintenanceStats.totalLaborFeeRevenue.toLocaleString()} {currency}</span>
          </div>
        </div>

        {/* Technician Efficiency Leaderboard Table */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-purple-950 mb-2 border-r-4 border-purple-700 pr-2">
            🏆 تقرير أداء وكفاءة فنيي الصيانة بالورشة:
          </h3>
          <table className="w-full text-xs text-right border-collapse border border-slate-300">
            <thead>
              <tr className="bg-purple-900 text-white font-bold">
                <th className="p-2 border border-purple-800">#</th>
                <th className="p-2 border border-purple-800">اسم الفني</th>
                <th className="p-2 border border-purple-800 text-center">الأجهزة المنجزة</th>
                <th className="p-2 border border-purple-800 text-center">قطع الغيار</th>
                <th className="p-2 border border-purple-800 text-center">أجور اليد</th>
                <th className="p-2 border border-purple-800 text-center">إجمالي المبيعات</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceStats.techniciansList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">لا توجد سجلات فنيين.</td>
                </tr>
              ) : (
                maintenanceStats.techniciansList.map((tech, i) => (
                  <tr key={tech.name} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="p-2 border border-slate-300 font-bold">{i + 1}</td>
                    <td className="p-2 border border-slate-300 font-bold">{tech.name}</td>
                    <td className="p-2 border border-slate-300 text-center font-mono font-bold">{tech.completedCount}</td>
                    <td className="p-2 border border-slate-300 text-center font-mono">{tech.spareParts.toLocaleString()} {currency}</td>
                    <td className="p-2 border border-slate-300 text-center font-mono font-bold text-emerald-700">{tech.laborFee.toLocaleString()} {currency}</td>
                    <td className="p-2 border border-slate-300 text-center font-mono font-bold">{tech.revenue.toLocaleString()} {currency}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Breakdown Table of Completed Repair Orders */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-purple-950 mb-2 border-r-4 border-purple-700 pr-2">
            📋 سجل كروت الصيانة المنجزة تفصيلياً:
          </h3>
          <table className="w-full text-[11px] text-right border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-800 text-white font-bold">
                <th className="p-2 border border-slate-700">رقم الكرت</th>
                <th className="p-2 border border-slate-700">العميل والهاتف</th>
                <th className="p-2 border border-slate-700">الجهاز والمشكلة</th>
                <th className="p-2 border border-slate-700">الفني المسؤول</th>
                <th className="p-2 border border-slate-700 text-center">التكلفة</th>
                <th className="p-2 border border-slate-700 text-center">قطع الغيار</th>
                <th className="p-2 border border-slate-700 text-center">أجور اليد</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">لا توجد كروت صيانة منجزة.</td>
                </tr>
              ) : (
                maintenanceOrders
                  .filter(o => o.status === 'completed' || o.status === 'delivered')
                  .slice(0, 40)
                  .map((order, idx) => {
                    const spare = order.sparePartsCost || 0;
                    const labor = order.laborFee ?? Math.max(0, order.cost - spare);
                    return (
                      <tr key={order.id} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="p-2 border border-slate-300 font-mono font-bold">#{order.orderNumber}</td>
                        <td className="p-2 border border-slate-300">
                          <div className="font-bold">{order.customerName}</div>
                          <div className="text-[9px] text-slate-500 font-mono">{order.customerPhone}</div>
                        </td>
                        <td className="p-2 border border-slate-300">
                          <div className="font-bold">{order.deviceName}</div>
                          <div className="text-[9px] text-slate-500">{order.issueDescription}</div>
                        </td>
                        <td className="p-2 border border-slate-300 font-bold">{order.technicianName || 'الورشة'}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono font-bold">{order.cost.toLocaleString()} {currency}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">{spare.toLocaleString()} {currency}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono font-bold text-emerald-700">{labor.toLocaleString()} {currency}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Official Footer / Stamp */}
        <div className="pt-6 border-t-2 border-slate-300 flex justify-between items-center text-xs text-slate-600 font-bold">
          <div>
            <span>ختم وتوقيع مسكّن الصيانة / المدير المسؤول: ______________________</span>
          </div>
          <div className="text-left font-mono">
            <span>تم استخراج التقرير آلياً عبر نظام سند المحاسبي</span>
          </div>
        </div>
      </div>

    </div>
  );
}
