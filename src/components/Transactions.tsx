/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  DollarSign, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Download, 
  Trash2, 
  Calendar, 
  FileText, 
  RefreshCw, 
  Printer, 
  Undo2,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  Image as ImageIcon,
  Paperclip,
  Eye,
  TrendingUp,
  ShoppingCart,
  Package,
  Clock,
  Share2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Receipt,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Transaction, Invoice, InvoiceItem } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';
import { generateAndSharePDF } from '../services/pdfService';
import { PAYMENT_METHODS, formatPaymentMethodLabel, PaymentMethodKey } from '../utils/paymentMethods';

interface TransactionsProps {
  transactions: Transaction[];
  invoices: Invoice[];
  onAddExpense: (amount: number, description: string, paymentMethod?: string, referenceNumber?: string) => void;
  onDeleteTransaction: (id: string) => void;
  onRefundInvoice: (id: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
  currency: string;
  isPrivacyMode?: boolean;
  storeName?: string;
}

export default function Transactions({
  transactions,
  invoices,
  onAddExpense,
  onDeleteTransaction,
  onRefundInvoice,
  onViewInvoice,
  currency,
  isPrivacyMode = false,
  storeName
}: TransactionsProps) {
  // Main Sub-Tab: 'daily' (الحركة والتقفيل اليومي), 'ledger' (دفتر القيود والحركات المالية), 'invoices' (أرشيف الفواتير والمرتجعات)
  const [subTab, setSubTab] = useState<'daily' | 'ledger' | 'invoices'>('daily');
  
  // Date filtering for Daily / Period view
  const [dailyFilterMode, setDailyFilterMode] = useState<'today' | 'yesterday' | '7days' | 'this_month' | 'custom'>('today');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // General search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'payment' | 'expense' | 'refund' | 'maintenance_income'>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'active' | 'refunded'>('all');

  // Column Visibility States for Tables
  const [visibleInvoiceCols, setVisibleInvoiceCols] = useState({
    invoiceNumber: true,
    customerName: true,
    type: true,
    finalAmount: true,
    status: true,
    actions: true,
  });
  const [showInvoiceColPicker, setShowInvoiceColPicker] = useState(false);

  const [visibleLedgerCols, setVisibleLedgerCols] = useState({
    date: true,
    typeAndMethod: true,
    description: true,
    amount: true,
    actions: true,
  });
  const [showLedgerColPicker, setShowLedgerColPicker] = useState(false);

  // Add Expense form states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethodKey>('cash');
  const [expenseRefNumber, setExpenseRefNumber] = useState('');
  const [proofModalImage, setProofModalImage] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState('');

  // In-app Refund confirmation modal state
  const [refundConfirmInvoice, setRefundConfirmInvoice] = useState<Invoice | null>(null);
  const [refundSuccessToast, setRefundSuccessToast] = useState<string | null>(null);

  // Format helper respecting privacy mode
  const fmt = (num: number) => {
    if (isPrivacyMode) return '**** ' + currency;
    return (num || 0).toLocaleString() + ' ' + currency;
  };

  // Helper date matchers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Filter transactions and invoices based on selected daily/period date filter
  const isDateInFilter = (dateString: string) => {
    if (!dateString) return false;
    const itemDate = dateString.split('T')[0];
    if (dailyFilterMode === 'today') return itemDate === todayStr;
    if (dailyFilterMode === 'yesterday') return itemDate === yesterdayStr;
    if (dailyFilterMode === 'custom') return itemDate === selectedCustomDate;
    if (dailyFilterMode === '7days') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      return new Date(dateString) >= past7;
    }
    if (dailyFilterMode === 'this_month') {
      const now = new Date();
      const itemD = new Date(dateString);
      return itemD.getFullYear() === now.getFullYear() && itemD.getMonth() === now.getMonth();
    }
    return true;
  };

  // Filtered dataset for Daily Movement
  const dailyTransactions = useMemo(() => {
    return transactions.filter(t => isDateInFilter(t.date));
  }, [transactions, dailyFilterMode, selectedCustomDate, todayStr, yesterdayStr]);

  const dailyInvoices = useMemo(() => {
    return invoices.filter(inv => isDateInFilter(inv.date));
  }, [invoices, dailyFilterMode, selectedCustomDate, todayStr, yesterdayStr]);

  // Daily Calculations
  const dailyActiveInvoices = useMemo(() => dailyInvoices.filter(i => i.status !== 'refunded'), [dailyInvoices]);
  const dailyRefundedInvoices = useMemo(() => dailyInvoices.filter(i => i.status === 'refunded'), [dailyInvoices]);

  const dailyCashSales = useMemo(() => {
    return dailyActiveInvoices.filter(i => i.type === 'cash').reduce((sum, i) => sum + i.finalAmount, 0);
  }, [dailyActiveInvoices]);

  const dailyDebtSales = useMemo(() => {
    return dailyActiveInvoices.filter(i => i.type === 'debt').reduce((sum, i) => sum + i.finalAmount, 0);
  }, [dailyActiveInvoices]);

  const dailyTotalSales = dailyCashSales + dailyDebtSales;

  const dailyDebtPayments = useMemo(() => {
    return dailyTransactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);

  const dailyMaintenanceIncome = useMemo(() => {
    return dailyTransactions.filter(t => t.type === 'maintenance_income').reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);

  const dailyExpenses = useMemo(() => {
    return dailyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);

  const dailyRefunds = useMemo(() => {
    return dailyTransactions.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);

  // Actual Cash Net for the selected day/period (Inflows minus Outflows)
  const dailyActualCashInflow = dailyCashSales + dailyDebtPayments + dailyMaintenanceIncome;
  const dailyActualCashOutflow = dailyExpenses + dailyRefunds;
  const dailyNetCashRegister = dailyActualCashInflow - dailyActualCashOutflow;

  // Breakdown of Sold Items during the selected day/period
  const dailySoldItems = useMemo(() => {
    const itemMap = new Map<string, { productId: string; name: string; quantity: number; total: number }>();
    
    dailyActiveInvoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          const key = item.productId || item.name;
          const current = itemMap.get(key) || { productId: item.productId, name: item.name, quantity: 0, total: 0 };
          current.quantity += item.quantity || 1;
          current.total += item.total || (item.sellingPrice * (item.quantity || 1));
          itemMap.set(key, current);
        });
      }
    });

    return Array.from(itemMap.values()).sort((a, b) => b.total - a.total);
  }, [dailyActiveInvoices]);

  const totalSoldPieces = useMemo(() => {
    return dailySoldItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [dailySoldItems]);

  // Payment methods breakdown for the daily period
  const getDailyMethodTotal = (methodKey: string) => {
    return dailyTransactions.filter(t => (t.paymentMethod || 'cash') === methodKey).reduce((sum, t) => {
      if (t.type === 'expense' || t.type === 'refund') return sum - t.amount;
      return sum + t.amount;
    }, 0);
  };

  // Overall (All-time) Calculations for Header & Ledger
  const totalSales = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalRefunds = transactions.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0);
  const totalMaintenance = transactions.filter(t => t.type === 'maintenance_income').reduce((sum, t) => sum + t.amount, 0);
  const netCashFlow = totalSales + totalPayments + totalMaintenance - totalExpenses - totalRefunds;

  const getMethodTotal = (methodKey: string) => {
    return transactions.filter(t => (t.paymentMethod || 'cash') === methodKey).reduce((sum, t) => {
      if (t.type === 'expense' || t.type === 'refund') return sum - t.amount;
      return sum + t.amount;
    }, 0);
  };

  // Filter transactions for Ledger tab
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) || t.id.includes(searchQuery);
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesMethod = filterPaymentMethod === 'all' || (t.paymentMethod || 'cash') === filterPaymentMethod;
      return matchesSearch && matchesType && matchesMethod;
    });
  }, [transactions, searchQuery, filterType, filterPaymentMethod]);

  // Filter invoices for Invoices Archive tab
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (inv.customerName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = invoiceStatusFilter === 'all' || 
                            (invoiceStatusFilter === 'active' && inv.status !== 'refunded') ||
                            (invoiceStatusFilter === 'refunded' && inv.status === 'refunded');
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, invoiceStatusFilter]);

  // Submit new Expense handler
  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');

    if (expenseAmount <= 0) {
      setExpenseError('⚠️ الرجاء إدخال قيمة مصروف صحيحة!');
      soundManager.playWarningBeep();
      return;
    }

    if (!expenseDesc.trim()) {
      setExpenseError('⚠️ الرجاء توضيح سبب المصروف!');
      soundManager.playWarningBeep();
      return;
    }

    onAddExpense(expenseAmount, expenseDesc.trim(), expensePaymentMethod, expenseRefNumber.trim() || undefined);
    setExpenseAmount(0);
    setExpenseDesc('');
    setExpensePaymentMethod('cash');
    setExpenseRefNumber('');
    setShowExpenseModal(false);
    soundManager.playSuccessChime();
  };

  // Execute Refund from in-app modal
  const handleConfirmRefund = () => {
    if (!refundConfirmInvoice) return;
    const invId = refundConfirmInvoice.id;
    const invNum = refundConfirmInvoice.invoiceNumber;
    setRefundConfirmInvoice(null);
    onRefundInvoice(invId);
    setRefundSuccessToast(`✅ تم استرجاع الفاتورة #${invNum} بالكامل وإعادة الأصناف للمستودع وتسوية الحساب.`);
    setTimeout(() => {
      setRefundSuccessToast(null);
    }, 5000);
  };

  // Share WhatsApp Summary for Daily Movement
  const handleShareDailyWhatsApp = () => {
    soundManager.playSuccessChime();
    const periodName = 
      dailyFilterMode === 'today' ? `اليوم (${new Date().toLocaleDateString('ar-YE')})` :
      dailyFilterMode === 'yesterday' ? `يوم أمس` :
      dailyFilterMode === 'custom' ? `تاريخ ${selectedCustomDate}` :
      dailyFilterMode === '7days' ? 'آخر 7 أيام' : 'هذا الشهر';

    const text = `📊 *تقرير الحركة والمبيعات والتقفيل اليومي*
🏪 المنشأة: *${storeName || 'سند المحاسبي'}*
🗓️ الفترة: *${periodName}*
----------------------------------
🟢 إجمالي المبيعات: *${dailyTotalSales.toLocaleString()} ${currency}*
   • مبيعات نقدية (كاش): ${dailyCashSales.toLocaleString()} ${currency}
   • مبيعات آجلة (ديون): ${dailyDebtSales.toLocaleString()} ${currency}

🔵 مقبوضات وتحصيلات الديون: *${dailyDebtPayments.toLocaleString()} ${currency}*
🟡 إيرادات الصيانة والخدمات: *${dailyMaintenanceIncome.toLocaleString()} ${currency}*
🔴 إجمالي المصاريف اليومية: *${dailyExpenses.toLocaleString()} ${currency}*
🔄 مرتجعات المبيعات: *${dailyRefunds.toLocaleString()} ${currency}*

💎 *صافي الكاش والنقدية بالصندوق:*
👉 *${dailyNetCashRegister.toLocaleString()} ${currency}*

📦 عدد الفواتير المصدرة: ${dailyActiveInvoices.length} فاتورة
🛍️ إجمالي القطع المباعة: ${totalSoldPieces} قطعة
----------------------------------
✨ تم استخراج التقرير آلياً عبر نظام سند المحاسبي`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // Export Daily Closing Summary as PDF
  const handleExportDailyPDF = async () => {
    soundManager.playScanBeep();

    const periodName = 
      dailyFilterMode === 'today' ? `اليوم (${new Date().toLocaleDateString('ar-YE')})` :
      dailyFilterMode === 'yesterday' ? `يوم أمس` :
      dailyFilterMode === 'custom' ? `تاريخ ${selectedCustomDate}` :
      dailyFilterMode === '7days' ? 'آخر 7 أيام' : 'هذا الشهر';

    const customColumns = [
      { key: 'index', label: 'م', width: '35px', align: 'center' as const },
      { key: 'itemName', label: 'الصنف / السلعة المباعة', align: 'right' as const },
      { key: 'quantity', label: 'الكمية المباعة', width: '85px', align: 'center' as const },
      { key: 'total', label: 'إجمالي الإيراد', width: '110px', align: 'center' as const }
    ];

    const customRows = dailySoldItems.map((item, idx) => ({
      index: idx + 1,
      itemName: item.name,
      quantity: `${item.quantity} قطعة`,
      total: `${item.total.toLocaleString()} ${currency}`
    }));

    if (customRows.length === 0) {
      customRows.push({
        index: 1,
        itemName: 'لا توجد أصناف مباعة مسجلة خلال الفترة المحددة',
        quantity: '0',
        total: `0 ${currency}`
      });
    }

    const summaryBoxes = [
      { label: 'إجمالي مبيعات اليوم', value: `${dailyTotalSales.toLocaleString()} ${currency}`, color: '#059669', bg: '#ecfdf5' },
      { label: 'تحصيلات ومقبوضات الديون', value: `${dailyDebtPayments.toLocaleString()} ${currency}`, color: '#0284c7', bg: '#f0f9ff' },
      { label: 'المصاريف والمرتجعات', value: `${(dailyExpenses + dailyRefunds).toLocaleString()} ${currency}`, color: '#dc2626', bg: '#fef2f2' },
      { label: 'صافي كاش الخزينة / الصندوق', value: `${dailyNetCashRegister.toLocaleString()} ${currency}`, color: '#7c3aed', bg: '#f5f3ff' }
    ];

    try {
      await generateAndSharePDF({
        title: 'كشف التقفيل والحركة اليومية والمبيعات',
        storeName: storeName || 'سند المحاسبي',
        invoiceNumber: `يومية-${new Date().toISOString().slice(0, 10)}`,
        customerName: 'إدارة المبيعات والرقابة المالية',
        phone: '',
        date: new Date().toLocaleDateString('ar-YE') + ' ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: `تقرير تفصيلي لفترة: ${periodName}`,
        orientation: 'p',
        customColumns,
        customRows,
        summaryBoxes,
        subtotal: `المبيعات النقدية: ${dailyCashSales.toLocaleString()} ${currency} | الآجلة: ${dailyDebtSales.toLocaleString()} ${currency}`,
        discount: `المصروفات: ${dailyExpenses.toLocaleString()} ${currency}`,
        totalAmount: `صافي اليومية: ${dailyNetCashRegister.toLocaleString()} ${currency}`,
        notes: `كشف تقفيل حركة المبيعات والصندوق لـ ${periodName}. عدد الفواتير: ${dailyActiveInvoices.length} فاتورة، وإجمالي القطع المباعة: ${totalSoldPieces} قطعة.`,
        footerNote: '✨ نظام سند المحاسبي - تقرير تقفيل المبيعات والنشاط اليومي'
      });
    } catch (e) {
      console.error('Daily PDF export failed:', e);
    }
  };

  // Export Daily Movement as Excel
  const handleExportDailyExcel = async () => {
    soundManager.playSuccessChime();

    const data: Record<string, string | number>[] = dailySoldItems.map((item, idx) => ({
      'م': idx + 1,
      'الصنف': item.name,
      'الكمية المباعة': item.quantity,
      'إجمالي المبلغ': item.total,
      'العملة': currency
    }));

    data.push({
      'م': 'الإجمالي',
      'الصنف': `عدد الأصناف: ${dailySoldItems.length}`,
      'الكمية المباعة': totalSoldPieces,
      'إجمالي المبلغ': dailyTotalSales,
      'العملة': currency
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 16 }, { wch: 18 }, { wch: 10 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'مبيعات اليومية والأصناف');

    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const fileName = `تقفيل_المبيعات_اليومية_${new Date().toISOString().split('T')[0]}.xlsx`;

    await saveAndShareFile({
      fileName,
      data: excelBase64,
      isBase64: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'كشف المبيعات اليومية Excel',
      text: `تقرير المبيعات والحركة اليومية من نظام سند المحاسبي`
    });
  };

  // Export Ledger as Excel
  const handleExportLedgerExcel = async () => {
    soundManager.playSuccessChime();

    const data: Record<string, string | number>[] = filteredTransactions.map((t, index) => {
      const typeLabel = 
        t.type === 'sale' ? 'مبيعات' :
        t.type === 'payment' ? 'تحصيل دين' :
        t.type === 'expense' ? 'مصروفات' :
        t.type === 'refund' ? 'مرتجع مبيعات' : 'دخل صيانة';

      const isExpenseOrRefund = t.type === 'expense' || t.type === 'refund';
      const inflow = !isExpenseOrRefund ? t.amount : 0;
      const outflow = isExpenseOrRefund ? t.amount : 0;
      const net = !isExpenseOrRefund ? t.amount : -t.amount;
      const methodLabel = formatPaymentMethodLabel(t.paymentMethod);

      return {
        'م': index + 1,
        'رقم المرجع / المعرف': t.referenceNumber || t.id.slice(0, 8),
        'التاريخ والوقت': new Date(t.date).toLocaleString('ar-YE'),
        'نوع القيد / الحركة': typeLabel,
        'البيان والتفاصيل': t.description || '',
        'طريقة الدفع': methodLabel,
        'المقبوضات (+)': inflow,
        'المدفوعات (-)': outflow,
        'التأثير المالي الصافي': net
      };
    });

    const totalInflow = filteredTransactions
      .filter(t => t.type !== 'expense' && t.type !== 'refund')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalOutflow = filteredTransactions
      .filter(t => t.type === 'expense' || t.type === 'refund')
      .reduce((sum, t) => sum + t.amount, 0);

    data.push({
      'م': 'الإجمالي',
      'رقم المرجع / المعرف': `عدد القيود: ${filteredTransactions.length}`,
      'التاريخ والوقت': '-',
      'نوع القيد / الحركة': '-',
      'البيان والتفاصيل': 'إجمالي الحركات المحددة',
      'طريقة الدفع': '-',
      'المقبوضات (+)': totalInflow,
      'المدفوعات (-)': totalOutflow,
      'التأثير المالي الصافي': totalInflow - totalOutflow
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 34 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'دفتر الحركات المالية');

    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const fileName = `دفتر_الحركات_المالية_${new Date().toISOString().split('T')[0]}.xlsx`;

    await saveAndShareFile({
      fileName,
      data: excelBase64,
      isBase64: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'دفتر الحركات المالية Excel',
      text: `دفتر الحركات والقيود المالية من تطبيق سند المحاسبي`
    });
  };

  // Export Ledger as PDF
  const handleExportLedgerPDF = async () => {
    soundManager.playScanBeep();

    const inflowTotal = totalSales + totalPayments + totalMaintenance;
    const outflowTotal = totalExpenses + totalRefunds;

    const customColumns = [
      { key: 'index', label: 'م', width: '35px', align: 'center' as const },
      { key: 'ref', label: 'رقم المرجع', width: '85px', align: 'center' as const },
      { key: 'dateTime', label: 'التاريخ والوقت', width: '115px', align: 'center' as const },
      { key: 'type', label: 'نوع الحركة', width: '85px', align: 'center' as const },
      { key: 'description', label: 'البيان والتفاصيل', align: 'right' as const },
      { key: 'method', label: 'طريقة الدفع', width: '85px', align: 'center' as const },
      { key: 'inflow', label: 'مقبوضات (+)', width: '90px', align: 'center' as const },
      { key: 'outflow', label: 'مدفوعات (-)', width: '90px', align: 'center' as const }
    ];

    const customRows: Record<string, string | number>[] = filteredTransactions.map((t, idx) => {
      const typeLabel = 
        t.type === 'expense' ? 'مصروف' :
        t.type === 'refund' ? 'مرتجع' :
        t.type === 'payment' ? 'تحصيل دين' :
        t.type === 'maintenance_income' ? 'صيانة' : 'مبيعات';

      const isOut = t.type === 'expense' || t.type === 'refund';
      const methodLabel = formatPaymentMethodLabel(t.paymentMethod);

      return {
        index: idx + 1,
        ref: t.referenceNumber || t.id.slice(0, 8),
        dateTime: new Date(t.date).toLocaleDateString('ar-YE') + ' ' + new Date(t.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        type: typeLabel,
        description: t.description || 'حركة مالية',
        method: methodLabel,
        inflow: !isOut ? `${t.amount.toLocaleString()} ${currency}` : '-',
        outflow: isOut ? `${t.amount.toLocaleString()} ${currency}` : '-'
      };
    });

    customRows.push({
      index: 'الإجمالي',
      ref: `القيود: ${filteredTransactions.length}`,
      dateTime: '—',
      type: '—',
      description: `صافي سيولة الخزينة: ${netCashFlow.toLocaleString()} ${currency}`,
      method: '—',
      inflow: `${inflowTotal.toLocaleString()} ${currency}`,
      outflow: `${outflowTotal.toLocaleString()} ${currency}`
    });

    const summaryBoxes = [
      { label: 'إجمالي المقبوضات (+)', value: `${inflowTotal.toLocaleString()} ${currency}`, color: '#059669', bg: '#ecfdf5' },
      { label: 'إجمالي المصاريف والمرتجع (-)', value: `${outflowTotal.toLocaleString()} ${currency}`, color: '#dc2626', bg: '#fef2f2' },
      { label: 'صافي سيولة الصندوق', value: `${netCashFlow.toLocaleString()} ${currency}`, color: '#0284c7', bg: '#f0f9ff' },
      { label: 'عدد الحركات المقيدة', value: `${filteredTransactions.length} قيد مالي`, color: '#6366f1', bg: '#eef2ff' }
    ];

    try {
      await generateAndSharePDF({
        title: 'كشف حركة الصندوق والخزينة العامة',
        storeName: storeName || 'سند المحاسبي',
        invoiceNumber: `صندوق-${new Date().toISOString().slice(0, 10)}`,
        customerName: 'إدارة الرقابة المالية والمراجعة الحسابية',
        phone: '',
        date: new Date().toLocaleDateString('ar-YE') + ' ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: `كشف تفصيلي لحركات الصندوق النقدية والإلكترونية`,
        orientation: 'p',
        customColumns,
        customRows,
        summaryBoxes,
        subtotal: `المقبوضات: ${inflowTotal.toLocaleString()} ${currency}`,
        discount: `المصاريف: ${outflowTotal.toLocaleString()} ${currency}`,
        totalAmount: `${netCashFlow.toLocaleString()} ${currency}`,
        notes: `كشف حركة الخزينة والصندوق المعتمد لكافة المقبوضات والمدفوعات المسجلة.`,
        footerNote: '✨ كشف القيود وحركة الصندوق اليومية - نظام سند المحاسبي'
      });
    } catch (e) {
      console.error('PDF export failed:', e);
    }
  };

  return (
    <div id="transactions_tab_view" className="space-y-5 pb-28">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {refundSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl flex items-center justify-between gap-3 border border-emerald-500"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />
              <span>{refundSuccessToast}</span>
            </div>
            <button onClick={() => setRefundSuccessToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. TOP STATS BAR: Overall Cash Summary */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <span>الحركة المالية واليومية العامة</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400">سجل المبيعات، حركة الصندوق اليومية، القيود وأرشيف الفواتير</p>
          </div>

          {/* Primary Action Button: Add Expense */}
          <button
            id="btn_add_expense_main"
            onClick={() => {
              soundManager.playScanBeep();
              setShowExpenseModal(true);
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-md shadow-rose-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>تسجيل مصروف جديد</span>
          </button>
        </div>
        
        {/* Quick KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 flex sm:block justify-between items-center">
            <div className="text-slate-600 text-[11px] font-bold">المقبوضات والصيانة (+)</div>
            <div className="font-black text-emerald-600 mt-0.5 sm:mt-1 font-mono text-sm sm:text-base">{fmt(totalSales + totalPayments + totalMaintenance)}</div>
          </div>
          <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50 border border-rose-100 flex sm:block justify-between items-center">
            <div className="text-slate-600 text-[11px] font-bold">المصاريف والمرتجع (-)</div>
            <div className="font-black text-rose-600 mt-0.5 sm:mt-1 font-mono text-sm sm:text-base">{fmt(totalExpenses + totalRefunds)}</div>
          </div>
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 text-white flex justify-between items-center shadow-inner">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">صافي السيولة الإجمالية:</span>
              <span className="text-sm sm:text-base font-black text-emerald-400 font-mono dir-ltr">{fmt(netCashFlow)}</span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-TABS NAVIGATION HEADER */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1.5 overflow-x-auto">
        <button
          id="subtab_daily"
          onClick={() => {
            soundManager.playScanBeep();
            setSubTab('daily');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
            subTab === 'daily'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>📊 الحركة والتقفيل اليومي</span>
          <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-bold ${
            subTab === 'daily' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
          }`}>
            اليوم ⚡
          </span>
        </button>

        <button
          id="subtab_ledger"
          onClick={() => {
            soundManager.playScanBeep();
            setSubTab('ledger');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
            subTab === 'ledger'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>📒 دفتر القيود والحركات</span>
          <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-bold ${
            subTab === 'ledger' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {transactions.length}
          </span>
        </button>

        <button
          id="subtab_invoices"
          onClick={() => {
            soundManager.playScanBeep();
            setSubTab('invoices');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
            subTab === 'invoices'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>📑 أرشيف الفواتير والمرتجعات</span>
          <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-bold ${
            subTab === 'invoices' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {invoices.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 🌟 SUB-TAB 1: DAILY MOVEMENT & SALES (الحركة والتقفيل اليومي) */}
      {/* ========================================================================= */}
      {subTab === 'daily' && (
        <div className="space-y-4">
          
          {/* Smart Date Filter Bar */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>الفترة:</span>
              </span>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('today'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === 'today'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                اليوم
              </button>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('yesterday'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === 'yesterday'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                أمس
              </button>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('7days'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === '7days'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                آخر 7 أيام
              </button>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('this_month'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === 'this_month'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                هذا الشهر
              </button>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('custom'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === 'custom'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                تاريخ مخصص 📅
              </button>
            </div>

            {/* Custom Date Picker & Quick Actions */}
            <div className="flex items-center gap-2 justify-end flex-wrap">
              {dailyFilterMode === 'custom' && (
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                  <input
                    type="date"
                    value={selectedCustomDate}
                    onChange={(e) => setSelectedCustomDate(e.target.value)}
                    className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
              )}

              {/* Action Buttons: PDF, Excel, WhatsApp */}
              <button
                onClick={handleExportDailyPDF}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="تصدير كشف التقفيل اليومي PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>تقفيل PDF</span>
              </button>

              <button
                onClick={handleExportDailyExcel}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="تصدير شيت إكسل للمبيعات اليومية"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>إكسل</span>
              </button>

              <button
                onClick={handleShareDailyWhatsApp}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="مشاركة ملخص اليومية عبر واتساب"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </button>
            </div>
          </div>

          {/* Daily KPI Dashboard Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* 1. إجمالي المبيعات */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-emerald-800 block">إجمالي المبيعات</span>
              <span className="text-sm sm:text-base font-black text-emerald-700 font-mono block mt-1 dir-ltr">{fmt(dailyTotalSales)}</span>
              <div className="text-[9.5px] text-emerald-600 font-bold mt-1 flex justify-between">
                <span>كاش: {dailyCashSales.toLocaleString()}</span>
                <span>آجل: {dailyDebtSales.toLocaleString()}</span>
              </div>
            </div>

            {/* 2. مقبوضات الديون */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-blue-800 block">تحصيل الديون (+)</span>
              <span className="text-sm sm:text-base font-black text-blue-700 font-mono block mt-1 dir-ltr">{fmt(dailyDebtPayments)}</span>
              <span className="text-[9.5px] text-blue-600 font-bold block mt-1">سندات قبض</span>
            </div>

            {/* 3. إيرادات الصيانة */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-indigo-800 block">إيراد الصيانة (+)</span>
              <span className="text-sm sm:text-base font-black text-indigo-700 font-mono block mt-1 dir-ltr">{fmt(dailyMaintenanceIncome)}</span>
              <span className="text-[9.5px] text-indigo-600 font-bold block mt-1">خدمات وأجهزة</span>
            </div>

            {/* 4. المصروفات اليومية */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-rose-800 block">المصروفات (-)</span>
              <span className="text-sm sm:text-base font-black text-rose-700 font-mono block mt-1 dir-ltr">{fmt(dailyExpenses)}</span>
              <span className="text-[9.5px] text-rose-600 font-bold block mt-1">مصاريف تشغيل</span>
            </div>

            {/* 5. مرتجعات المبيعات */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-amber-800 block">المرتجعات (-)</span>
              <span className="text-sm sm:text-base font-black text-amber-700 font-mono block mt-1 dir-ltr">{fmt(dailyRefunds)}</span>
              <span className="text-[9.5px] text-amber-600 font-bold block mt-1">{dailyRefundedInvoices.length} فاتورة مرتجعة</span>
            </div>

            {/* 6. صافي كاش الخزينة */}
            <div className="p-3 rounded-2xl bg-slate-900 text-white shadow-md flex flex-col justify-between">
              <span className="text-[10.5px] font-bold text-slate-300 block">صافي الصندوق:</span>
              <span className="text-sm sm:text-base font-black text-emerald-400 font-mono block mt-1 dir-ltr">{fmt(dailyNetCashRegister)}</span>
              <div className="text-[9.5px] text-slate-400 font-bold mt-1">
                {dailyActiveInvoices.length} فواتير | {totalSoldPieces} قطعة
              </div>
            </div>
          </div>

          {/* Payment Methods Breakdown for Selected Daily Period */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-blue-600" />
              <span>توزيع حركة اليوم حسب طرق الدفع والقنوات المالية:</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).map((key) => {
                const meta = PAYMENT_METHODS[key];
                const total = getDailyMethodTotal(key);
                return (
                  <div key={key} className={`p-2.5 rounded-xl border ${meta.bgLightClass} ${meta.borderClass} flex flex-col justify-between`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{meta.emoji}</span>
                      <span className="text-[10px] font-bold text-slate-600">{meta.shortLabel}</span>
                    </div>
                    <div className={`text-xs font-black font-mono mt-1 ${meta.colorClass}`}>
                      {fmt(total)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Two-Column Grid: 1. Sold Items Today / 2. Today's Invoices List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* 1. قائمة الأصناف المباعة خلال اليوم */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">الأصناف والسلع المباعة</h4>
                    <p className="text-[10px] text-slate-400">حصر الكميات المنصرفة من المستودع</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {dailySoldItems.length} صنف ({totalSoldPieces} قطعة)
                </span>
              </div>

              {dailySoldItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Package className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">لا توجد مبيعات أصناف مسجلة خلال الفترة المحددة</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-slate-400 text-[11px] border-b border-slate-100 bg-slate-50/70">
                        <th className="py-2 px-2 font-bold">الصنف</th>
                        <th className="py-2 px-2 font-bold text-center">الكمية</th>
                        <th className="py-2 px-2 font-bold text-left">الإيراد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailySoldItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-2 font-bold text-slate-800">
                            <span>{item.name}</span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-blue-600">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-2 text-left font-mono font-bold text-emerald-600">
                            {item.total.toLocaleString()} {currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. قائمة فواتير المبيعات الصادرة خلال الفترة */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">سجل فواتير المبيعات</h4>
                    <p className="text-[10px] text-slate-400">الفواتير المنفذة والمرتجعة بالفترة</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {dailyInvoices.length} فاتورة
                </span>
              </div>

              {dailyInvoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">لا توجد فواتير مبيعات مسجلة في هذه الفترة</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-slate-400 text-[11px] border-b border-slate-100 bg-slate-50/70">
                        <th className="py-2 px-2 font-bold">الفاتورة والعميل</th>
                        <th className="py-2 px-2 font-bold text-center">النوع</th>
                        <th className="py-2 px-2 font-bold text-center">المبلغ</th>
                        <th className="py-2 px-2 font-bold text-left">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-2">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <span>#{inv.invoiceNumber}</span>
                              {inv.status === 'refunded' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-extrabold">
                                  مرتجعة 🔄
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">{inv.customerName || 'عميل نقدي'}</div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              inv.type === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {inv.type === 'cash' ? 'كاش' : 'دين'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-blue-600">
                            {inv.finalAmount.toLocaleString()} {currency}
                          </td>
                          <td className="py-2 px-2 text-left">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onViewInvoice(inv)}
                                className="p-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                                title="عرض ومعاينة الفاتورة"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {inv.status !== 'refunded' && (
                                <button
                                  onClick={() => {
                                    soundManager.playWarningBeep();
                                    setRefundConfirmInvoice(inv);
                                  }}
                                  className="p-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                  title="استرجاع الفاتورة بالكامل وإعادة الأصناف للمخزن"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 📒 SUB-TAB 2: FINANCIAL LEDGER (دفتر القيود والحركات المالية) */}
      {/* ========================================================================= */}
      {subTab === 'ledger' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث في البيان، رقم السند، أو المعرف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Type & Payment Method Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">جميع أنواع القيود</option>
                <option value="sale">مبيعات</option>
                <option value="payment">تحصيل ديون</option>
                <option value="maintenance_income">إيراد صيانة</option>
                <option value="expense">مصروفات</option>
                <option value="refund">مرتجع مبيعات</option>
              </select>

              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">جميع طرق الدفع</option>
                {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).map(k => (
                  <option key={k} value={k}>{PAYMENT_METHODS[k].label}</option>
                ))}
              </select>

              {/* Column Customizer Toggle */}
              <button
                onClick={() => setShowLedgerColPicker(!showLedgerColPicker)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                title="تخصيص أعمدة الجدول"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              {/* PDF / Excel Export for Ledger */}
              <button
                onClick={handleExportLedgerPDF}
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                title="تصدير كشف PDF"
              >
                <FileText className="w-4 h-4 text-rose-600" />
              </button>

              <button
                onClick={handleExportLedgerExcel}
                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                title="تصدير إكسل Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              </button>
            </div>
          </div>

          {/* Column Visibility Picker Drawer */}
          {showLedgerColPicker && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-4 flex-wrap text-xs font-bold text-slate-700">
              <span className="text-slate-400">إظهار الأعمدة:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLedgerCols.date}
                  onChange={(e) => setVisibleLedgerCols({ ...visibleLedgerCols, date: e.target.checked })}
                />
                <span>التاريخ والوقت</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLedgerCols.typeAndMethod}
                  onChange={(e) => setVisibleLedgerCols({ ...visibleLedgerCols, typeAndMethod: e.target.checked })}
                />
                <span>النوع وطريقة الدفع</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLedgerCols.description}
                  onChange={(e) => setVisibleLedgerCols({ ...visibleLedgerCols, description: e.target.checked })}
                />
                <span>البيان والشرح</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLedgerCols.amount}
                  onChange={(e) => setVisibleLedgerCols({ ...visibleLedgerCols, amount: e.target.checked })}
                />
                <span>المبلغ والتأثير</span>
              </label>
            </div>
          )}

          {/* Transactions Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 text-[11px] border-b border-slate-100 bg-slate-50/70">
                  {visibleLedgerCols.date && <th className="py-2.5 px-3 font-bold">التاريخ والوقت</th>}
                  {visibleLedgerCols.typeAndMethod && <th className="py-2.5 px-3 font-bold text-center">نوع القيد / السداد</th>}
                  {visibleLedgerCols.description && <th className="py-2.5 px-3 font-bold">البيان والشرح</th>}
                  {visibleLedgerCols.amount && <th className="py-2.5 px-3 font-bold text-left">المبلغ والتأثير</th>}
                  {visibleLedgerCols.actions && <th className="py-2.5 px-3 font-bold text-center">إجراء</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold">لا توجد قيود أو حركات تطابق معايير البحث</p>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => {
                    const isExpenseOrRefund = t.type === 'expense' || t.type === 'refund';
                    const methodLabel = formatPaymentMethodLabel(t.paymentMethod);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        {visibleLedgerCols.date && (
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(t.date).toLocaleDateString('ar-YE')} {new Date(t.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        )}
                        {visibleLedgerCols.typeAndMethod && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.type === 'sale' ? 'bg-emerald-100 text-emerald-700' :
                                t.type === 'payment' ? 'bg-blue-100 text-blue-700' :
                                t.type === 'maintenance_income' ? 'bg-indigo-100 text-indigo-700' :
                                t.type === 'refund' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {t.type === 'sale' ? 'مبيعات' :
                                 t.type === 'payment' ? 'تحصيل دين' :
                                 t.type === 'maintenance_income' ? 'صيانة' :
                                 t.type === 'refund' ? 'مرتجع' : 'مصروف'}
                              </span>
                              <span className="text-[9.5px] text-slate-400 font-medium">{methodLabel}</span>
                            </div>
                          </td>
                        )}
                        {visibleLedgerCols.description && (
                          <td className="py-3 px-3 font-bold text-slate-800 max-w-xs truncate">
                            <span>{t.description || 'حركة مالية'}</span>
                            {t.referenceNumber && (
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                مرجع: {t.referenceNumber}
                              </span>
                            )}
                          </td>
                        )}
                        {visibleLedgerCols.amount && (
                          <td className="py-3 px-3 text-left font-mono font-bold">
                            <span className={`text-xs ${isExpenseOrRefund ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {isExpenseOrRefund ? '-' : '+'}{t.amount.toLocaleString()} {currency}
                            </span>
                          </td>
                        )}
                        {visibleLedgerCols.actions && (
                          <td className="py-3 px-3 text-center">
                            {t.type === 'expense' && (
                              <button
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
                                    onDeleteTransaction(t.id);
                                  }
                                }}
                                className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="حذف المصروف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📑 SUB-TAB 3: INVOICES & RETURNS ARCHIVE (أرشيف الفواتير والمرتجعات) */}
      {/* ========================================================================= */}
      {subTab === 'invoices' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          
          {/* Search & Status Filter Bar */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث برقم الفاتورة، اسم العميل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">جميع الفواتير</option>
                <option value="active">الفواتير النشطة فقط</option>
                <option value="refunded">الفواتير المرتجعة فقط</option>
              </select>

              <button
                onClick={() => setShowInvoiceColPicker(!showInvoiceColPicker)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                title="تخصيص أعمدة الجدول"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 text-[11px] border-b border-slate-100 bg-slate-50/70">
                  <th className="py-2.5 px-3 font-bold">رقم الفاتورة</th>
                  <th className="py-2.5 px-3 font-bold">العميل والتاريخ</th>
                  <th className="py-2.5 px-3 font-bold text-center">طريقة الدفع</th>
                  <th className="py-2.5 px-3 font-bold text-center">المبلغ الإجمالي</th>
                  <th className="py-2.5 px-3 font-bold text-center">حالة الفاتورة</th>
                  <th className="py-2.5 px-3 font-bold text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold">لا توجد فواتير تطابق شروط البحث</p>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-bold font-mono text-blue-600">
                        #{inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{inv.customerName || 'عميل نقدي'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {new Date(inv.date).toLocaleDateString('ar-YE')} {new Date(inv.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.type === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {inv.type === 'cash' ? 'نقداً (كاش)' : 'آجل (دين)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                        {inv.finalAmount.toLocaleString()} {currency}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {inv.status === 'refunded' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                            مسترجعة 🔄
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            مكتملة نشطة ✅
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.proofImage && (
                            <button
                              type="button"
                              onClick={() => setProofModalImage(inv.proofImage!)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold border border-emerald-200 text-[10px] flex items-center gap-1 transition cursor-pointer"
                              title="عرض صورة السند"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                              <span>السند</span>
                            </button>
                          )}

                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 transition text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> عرض
                          </button>

                          {inv.status !== 'refunded' && (
                            <button
                              onClick={() => {
                                soundManager.playWarningBeep();
                                setRefundConfirmInvoice(inv);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 border border-rose-200 transition text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              <Undo2 className="w-3.5 h-3.5" /> استرجاع
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔄 MODAL: IN-APP REFUND CONFIRMATION (نافذة تأكيد الاسترجاع التفاعلية) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {refundConfirmInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl z-10 text-right text-slate-900 border border-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
                    <Undo2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">تأكيد استرجاع الفاتورة</h3>
                    <p className="text-[11px] text-slate-400">إرجاع البضاعة وتسوية المبلغ</p>
                  </div>
                </div>
                <button 
                  onClick={() => setRefundConfirmInvoice(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Invoice Summary Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-500">رقم الفاتورة:</span>
                  <span className="font-mono text-blue-600">#{refundConfirmInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-500">اسم العميل:</span>
                  <span className="text-slate-900">{refundConfirmInvoice.customerName || 'عميل نقدي'}</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-500">نوع الفاتورة:</span>
                  <span className={refundConfirmInvoice.type === 'cash' ? 'text-emerald-600' : 'text-rose-600'}>
                    {refundConfirmInvoice.type === 'cash' ? 'نقداً (كاش)' : 'آجل (دين)'}
                  </span>
                </div>
                <div className="flex justify-between items-center font-bold border-t border-slate-200 pt-1.5">
                  <span className="text-slate-700">المبلغ المسترجع:</span>
                  <span className="font-mono text-base font-black text-rose-600">
                    {refundConfirmInvoice.finalAmount.toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              {/* Restored Items List */}
              {Array.isArray(refundConfirmInvoice.items) && refundConfirmInvoice.items.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    الأصناف التي ستتم إعادتها إلى المستودع:
                  </span>
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 max-h-36 overflow-y-auto space-y-1">
                    {refundConfirmInvoice.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xs font-bold text-amber-950">
                        <span>• {item.name}</span>
                        <span className="font-mono text-amber-800">+{item.quantity} قطعة</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundConfirmInvoice(null)}
                  className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRefund}
                  className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>تأكيد الاسترجاع</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* ➕ BOTTOM SHEET MODAL: RECORD NEW EXPENSE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExpenseModal(false)}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[90vh] overflow-y-auto text-right text-slate-900"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

              <div className="flex items-center justify-between border-b border-slate-100 pb-3 bg-slate-50 p-2 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">تسجيل مصروف جديد</h3>
                    <p className="text-[11px] text-slate-400">قيد المصاريف اليومية والتشغيلية</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowExpenseModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {expenseError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {expenseError}
                </div>
              )}

              <form onSubmit={handleExpenseSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">مبلغ المصروف:</label>
                  <input
                    id="expense_amount_input"
                    type="number"
                    min="1"
                    required
                    value={expenseAmount || ''}
                    onChange={(e) => setExpenseAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="مثال: 5000"
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">طريقة الدفع وقناة الخصم:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).filter(k => k !== 'debt').map((methodKey) => {
                      const method = PAYMENT_METHODS[methodKey];
                      const isSelected = expensePaymentMethod === methodKey;
                      return (
                        <button
                          key={methodKey}
                          type="button"
                          onClick={() => {
                            soundManager.playScanBeep();
                            setExpensePaymentMethod(methodKey);
                          }}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 justify-center cursor-pointer ${
                            isSelected
                              ? `${method.bgLightClass} ${method.colorClass} ${method.borderClass} ring-2 ring-rose-500 shadow-sm font-black`
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-sm">{method.emoji}</span>
                          <span className="truncate">{method.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {expensePaymentMethod !== 'cash' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">رقم الحوالة / السند / الإشعار:</label>
                    <input
                      type="text"
                      value={expenseRefNumber}
                      onChange={(e) => setExpenseRefNumber(e.target.value)}
                      placeholder="مثال: #44321..."
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-mono font-bold rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">البيان والشرح التفصيلي:</label>
                  <input
                    id="expense_desc_input"
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="مثال: سداد فاتورة كهرباء المحل..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <button
                  id="submit_expense_btn"
                  type="submit"
                  className="w-full py-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ترحيل بند المصاريف</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Proof Image Fullscreen View Modal */}
      <AnimatePresence>
        {proofModalImage && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-3.5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold">صورة سند التحويل / إشعار الإيداع البنكي</span>
                </div>
                <button
                  type="button"
                  onClick={() => setProofModalImage(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 overflow-auto flex items-center justify-center bg-slate-950/60 max-h-[70vh]">
                <img
                  src={proofModalImage}
                  alt="صورة السند بدقة كاملة"
                  className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg border border-slate-800"
                />
              </div>

              <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  إشعار تسديد / تحويل مالي
                </span>
                <button
                  type="button"
                  onClick={() => setProofModalImage(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition"
                >
                  إغلاق المعاينة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
