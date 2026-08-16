/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Transaction, Invoice } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';
import { generateAndSharePDF } from '../services/pdfService';
import { PAYMENT_METHODS, getPaymentMethodMeta, formatPaymentMethodLabel, PaymentMethodKey } from '../utils/paymentMethods';

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
  const [subTab, setSubTab] = useState<'ledger' | 'invoices'>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'payment' | 'expense' | 'refund' | 'maintenance_income'>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');

  // Column Visibility States for Invoices & Ledger Tables
  const [visibleInvoiceCols, setVisibleInvoiceCols] = useState({
    invoiceNumber: true,
    customerName: true,
    type: true,
    finalAmount: true,
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

  // Export current transactions ledger as Excel (.xlsx) ككشف حساب تفصيلي
  const handleExportExcel = async () => {
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

    // صف الإجماليات
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
      { wch: 6 },  // م
      { wch: 18 }, // رقم المرجع
      { wch: 22 }, // التاريخ والوقت
      { wch: 16 }, // نوع القيد
      { wch: 34 }, // البيان
      { wch: 16 }, // طريقة الدفع
      { wch: 18 }, // المقبوضات
      { wch: 18 }, // المدفوعات
      { wch: 22 }  // التأثير المالي
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'كشف حركة الصندوق');

    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const fileName = `كشف_حركة_الصندوق_${new Date().toISOString().split('T')[0]}.xlsx`;

    await saveAndShareFile({
      fileName,
      data: excelBase64,
      isBase64: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'كشف حركة الصندوق Excel',
      text: `كشف حركة الصندوق والخزينة (${filteredTransactions.length} حركة) من تطبيق سند المحاسبي`
    });
  };

  // Export current transactions ledger as PDF ككشف محاسبي منظم
  const handleExportPDF = async () => {
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

    // إضافة صف الإجمالي النهائي المعتمد في ذيل جدول حركة الصندوق
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
        notes: `كشف حركة الخزينة والصندوق المعتمد لكافة المقبوضات والمدفوعات المسجلة حتى تاريخه.`,
        footerNote: '✨ كشف القيود وحركة الصندوق اليومية - نظام سند المحاسبي'
      });
    } catch (e) {
      console.error('PDF export failed:', e);
    }
  };

  // Export current transactions ledger as CSV text
  const handleExportCSV = async () => {
    soundManager.playSuccessChime();
    let csv = '\ufeff';
    csv += 'م,المعرف / المرجع,التاريخ والوقت,نوع القيد,البيان والوصف,طريقة الدفع,المبلغ,التأثير\n';

    filteredTransactions.forEach((t, idx) => {
      const typeLabel = 
        t.type === 'sale' ? 'مبيعات' :
        t.type === 'payment' ? 'تحصيل دين' :
        t.type === 'expense' ? 'مصروفات' :
        t.type === 'refund' ? 'مرتجع' : 'صيانة';

      const isOut = t.type === 'expense' || t.type === 'refund';
      const methodLabel = formatPaymentMethodLabel(t.paymentMethod);

      csv += `"${idx + 1}","${t.referenceNumber || t.id}","${new Date(t.date).toLocaleString('ar-YE')}","${typeLabel}","${(t.description || '').replace(/"/g, '""')}","${methodLabel}","${t.amount}","${isOut ? '-' : '+'}"\n`;
    });

    const fileName = `كشف_الحركات_المالية_${new Date().toISOString().split('T')[0]}.csv`;
    await saveAndShareFile({
      fileName,
      data: csv,
      mimeType: 'text/csv;charset=utf-8',
      title: 'كشف الحركات المالية - سند',
      text: 'تقرير كشف الحركات المالية المصدّر من تطبيق سند المحاسبي'
    });
  };

  // Calculations
  const totalSales = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalRefunds = transactions.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0);
  const totalMaintenance = transactions.filter(t => t.type === 'maintenance_income').reduce((sum, t) => sum + t.amount, 0);

  // Cash Liquid register equation
  const netCashFlow = totalSales + totalPayments + totalMaintenance - totalExpenses - totalRefunds;

  const fmt = (num: number) => {
    if (isPrivacyMode) return '**** ' + currency;
    return num.toLocaleString() + ' ' + currency;
  };

  // Breakdown by payment method
  const getMethodTotal = (methodKey: string) => {
    return transactions.filter(t => (t.paymentMethod || 'cash') === methodKey).reduce((sum, t) => {
      if (t.type === 'expense' || t.type === 'refund') return sum - t.amount;
      return sum + t.amount;
    }, 0);
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.includes(searchQuery);
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesMethod = filterPaymentMethod === 'all' || (t.paymentMethod || 'cash') === filterPaymentMethod;
    return matchesSearch && matchesType && matchesMethod;
  });

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    return inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
           inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div id="transactions_tab_view" className="space-y-6 pb-28">
      
      {/* 1. TOP STATS BAR: Full Width Cash Summary */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">موجز الحركة المالية والصندوق</h3>
            <p className="text-xs text-slate-400">ملخص التدفقات المالية والمقبوضات والمصاريف</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                soundManager.playScanBeep();
                setShowExpenseModal(true);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل مصروف جديد</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-red-200"
            >
              <FileText className="w-4 h-4 text-red-600" />
              <span>كشف PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-emerald-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>كشف إكسل Excel</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>تصدير CSV</span>
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="text-slate-500 text-[11px] font-bold">المقبوضات والصيانة</div>
            <div className="font-black text-emerald-600 mt-1 font-mono text-base">{fmt(totalSales + totalPayments + totalMaintenance)}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100">
            <div className="text-slate-500 text-[11px] font-bold">المصاريف والمرتجع</div>
            <div className="font-black text-rose-600 mt-1 font-mono text-base">{fmt(totalExpenses + totalRefunds)}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 text-white flex justify-between items-center shadow-inner">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">صافي السيولة بالصندوق:</span>
              <span className="text-base font-black text-emerald-400 font-mono dir-ltr">{fmt(netCashFlow)}</span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Payment Methods Breakdown Grid */}
        <div className="pt-3 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-600 mb-2">توزيع الصندوق والتحصيل حسب طريقة الدفع:</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).map((key) => {
              const meta = PAYMENT_METHODS[key];
              const total = getMethodTotal(key);
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
      </div>

      {/* 2. LEDGER & HISTORICAL ARCHIVE */}
      <div className="space-y-4">
        
        {/* Navigation Sub-Tabs */}
        <div className="flex bg-slate-100 p-1 border border-slate-200 rounded-xl text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-none gap-1 max-w-full">
          <button
            onClick={() => setSubTab('ledger')}
            className={`px-4 py-2 rounded-lg transition shrink-0 ${
              subTab === 'ledger' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            سجل دفتر الحركات المالية ({transactions.length})
          </button>
          <button
            onClick={() => setSubTab('invoices')}
            className={`px-4 py-2 rounded-lg transition shrink-0 ${
              subTab === 'invoices' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            أرشيف الفواتير المكتملة ({invoices.length})
          </button>
        </div>

        {/* Search Input & Column Picker Toolbar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالبيان، الوصف، أو رقم الفاتورة..."
              className="w-full pr-10 pl-4 py-2.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>

          {/* Column Customizer Button */}
          {subTab === 'invoices' ? (
            <div className="relative">
              <button
                onClick={() => setShowInvoiceColPicker(!showInvoiceColPicker)}
                className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5 transition cursor-pointer shrink-0"
                title="تخصيص أعمدة جدول فواتير المبيعات"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">تخصيص الأعمدة ⚙️</span>
              </button>

              {showInvoiceColPicker && (
                <div className="absolute left-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-30 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-800">أعمدة المبيعات:</span>
                    <button 
                      onClick={() => setShowInvoiceColPicker(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {[
                      { key: 'invoiceNumber', label: 'رقم الفاتورة' },
                      { key: 'customerName', label: 'اسم العميل' },
                      { key: 'type', label: 'طريقة الدفع' },
                      { key: 'finalAmount', label: 'المبلغ الإجمالي' },
                      { key: 'actions', label: 'معاينة / استرجاع' },
                    ].map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={visibleInvoiceCols[col.key as keyof typeof visibleInvoiceCols]}
                          onChange={(e) => setVisibleInvoiceCols(prev => ({ ...prev, [col.key]: e.target.checked }))}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="text-slate-700 font-medium">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowLedgerColPicker(!showLedgerColPicker)}
                className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5 transition cursor-pointer shrink-0"
                title="تخصيص أعمدة جدول حركات الصندوق"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">تخصيص الأعمدة ⚙️</span>
              </button>

              {showLedgerColPicker && (
                <div className="absolute left-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-30 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-800">أعمدة دفتر الحسابات:</span>
                    <button 
                      onClick={() => setShowLedgerColPicker(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {[
                      { key: 'date', label: 'التاريخ والتوقيت' },
                      { key: 'typeAndMethod', label: 'النوع وطريقة الدفع' },
                      { key: 'description', label: 'البيان والشرح' },
                      { key: 'amount', label: 'المبلغ' },
                      { key: 'actions', label: 'الإجراءات' },
                    ].map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition">
                        <input
                          type="checkbox"
                          checked={visibleLedgerCols[col.key as keyof typeof visibleLedgerCols]}
                          onChange={(e) => setVisibleLedgerCols(prev => ({ ...prev, [col.key]: e.target.checked }))}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="text-slate-700 font-medium">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SubTab 1: Ledger */}
        {subTab === 'ledger' ? (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            
            {/* Filter Pills Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100 scrollbar-none">
              <span className="text-xs text-slate-500 font-bold shrink-0">تصفية القناة:</span>
              <button
                type="button"
                onClick={() => setFilterPaymentMethod('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                  filterPaymentMethod === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الكل
              </button>
              {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).map((key) => {
                const meta = PAYMENT_METHODS[key];
                const active = filterPaymentMethod === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterPaymentMethod(key)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{meta.emoji}</span>
                    <span>{meta.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* MOBILE CARDS VIEW (block md:hidden) */}
            <div className="block md:hidden space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  لا توجد حركات مالية مسجلة بالدفتر لهذا الفلتر.
                </div>
              ) : (
                [...filteredTransactions].reverse().map(t => {
                  const isExpense = t.type === 'expense' || t.type === 'refund';
                  const pmMeta = getPaymentMethodMeta(t.paymentMethod || (t.type === 'expense' ? 'cash' : 'cash'));
                  return (
                    <div key={t.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 shadow-xs">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.type === 'expense' ? 'bg-rose-100 text-rose-700' :
                            t.type === 'refund' ? 'bg-amber-100 text-amber-700' :
                            t.type === 'payment' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {t.type === 'expense' ? 'مصروف' :
                             t.type === 'refund' ? 'مرتجع' :
                             t.type === 'payment' ? 'تحصيل' : 'مبيعات'}
                          </span>

                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${pmMeta.bgLightClass} ${pmMeta.colorClass} border ${pmMeta.borderClass}`}>
                            <span>{pmMeta.emoji}</span>
                            <span>{pmMeta.shortLabel}</span>
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(t.date).toLocaleString('ar-YE')}
                        </span>
                      </div>

                      <div className="font-bold text-slate-900 text-xs flex justify-between items-center flex-wrap gap-1">
                        <span>{t.description}</span>
                        <div className="flex items-center gap-1">
                          {t.referenceNumber && (
                            <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              #{t.referenceNumber}
                            </span>
                          )}
                          {t.proofImage && (
                            <button
                              type="button"
                              onClick={() => setProofModalImage(t.proofImage!)}
                              className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <ImageIcon className="w-3 h-3 text-blue-600" />
                              <span>السند</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 font-mono">
                        <span className={`font-bold text-sm ${
                          isExpense ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {isExpense ? '-' : '+'}{t.amount.toLocaleString()} {currency}
                        </span>

                        <button
                          onClick={() => {
                            if (confirm('هل أنت متأكد من حذف هذه الحركة المالية من السجل؟')) {
                              onDeleteTransaction(t.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold">
                    {visibleLedgerCols.date && <th className="pb-3 pr-2">التاريخ والتوقيت</th>}
                    {visibleLedgerCols.typeAndMethod && <th className="pb-3 text-center">النوع والطريقة</th>}
                    {visibleLedgerCols.description && <th className="pb-3">البيان والشرح</th>}
                    {visibleLedgerCols.amount && <th className="pb-3 text-center">المبلغ</th>}
                    {visibleLedgerCols.actions && <th className="pb-3 pl-2 text-left">إجراءات</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleLedgerCols).filter(Boolean).length || 1} className="py-12 text-center text-slate-400">
                        لا توجد حركات مالية مسجلة بالدفتر لهذا الفلتر.
                      </td>
                    </tr>
                  ) : (
                    [...filteredTransactions].reverse().map(t => {
                      const isExpense = t.type === 'expense' || t.type === 'refund';
                      const pmMeta = getPaymentMethodMeta(t.paymentMethod || 'cash');
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition">
                          {visibleLedgerCols.date && (
                            <td className="py-3 pr-2 font-mono text-[11px] text-slate-500">
                              {new Date(t.date).toLocaleString('ar-YE')}
                            </td>
                          )}
                          {visibleLedgerCols.typeAndMethod && (
                            <td className="py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.type === 'expense' ? 'bg-rose-100 text-rose-700' :
                                  t.type === 'refund' ? 'bg-amber-100 text-amber-700' :
                                  t.type === 'payment' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {t.type === 'expense' ? 'مصروف' :
                                   t.type === 'refund' ? 'مرتجع' :
                                   t.type === 'payment' ? 'تحصيل' : 'مبيعات'}
                                </span>

                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${pmMeta.bgLightClass} ${pmMeta.colorClass} border ${pmMeta.borderClass}`}>
                                  <span>{pmMeta.emoji}</span>
                                  <span>{pmMeta.shortLabel}</span>
                                </span>
                              </div>
                            </td>
                          )}
                          {visibleLedgerCols.description && (
                            <td className="py-3 font-medium text-slate-800">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{t.description}</span>
                                {t.referenceNumber && (
                                  <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    #{t.referenceNumber}
                                  </span>
                                )}
                                {t.proofImage && (
                                  <button
                                    type="button"
                                    onClick={() => setProofModalImage(t.proofImage!)}
                                    className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                                    title="معاينة وتكبير صورة السند / الإيداع"
                                  >
                                    <ImageIcon className="w-3 h-3 text-blue-600" />
                                    <span>السند</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleLedgerCols.amount && (
                            <td className={`py-3 text-center font-mono font-bold ${
                              isExpense ? 'text-rose-600' : 'text-emerald-600'
                            }`}>
                              {isExpense ? '-' : '+'}{t.amount.toLocaleString()} {currency}
                            </td>
                          )}
                          {visibleLedgerCols.actions && (
                            <td className="py-3 pl-2 text-left">
                              <button
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذه الحركة المالية من السجل؟')) {
                                    onDeleteTransaction(t.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
        ) : (
          /* SubTab 2: Invoices Archive */
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            {/* MOBILE CARDS VIEW (block md:hidden) */}
            <div className="block md:hidden space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredInvoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  لا توجد فواتير مبيعات مسجلة في الأرشيف.
                </div>
              ) : (
                [...filteredInvoices].reverse().map(inv => (
                  <div key={inv.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 shadow-xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {inv.invoiceNumber}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.type === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {inv.type === 'cash' ? 'نقداً (كاش)' : 'آجل (دين)'}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 text-xs">{inv.customerName}</div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 font-mono">
                      <span className="font-bold text-blue-600 text-sm">
                        {inv.finalAmount.toLocaleString()} {currency}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onViewInvoice(inv)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 transition text-[10px] flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" /> عرض
                        </button>

                        {inv.status !== 'refunded' && (
                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من استرجاع الفاتورة رقم ${inv.invoiceNumber} بالكامل وإرجاع الأصناف للمستودع؟`)) {
                                onRefundInvoice(inv.id);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 transition text-[10px] flex items-center gap-1"
                          >
                            <Undo2 className="w-3.5 h-3.5" /> استرجاع
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* DESKTOP TABLE VIEW (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold">
                    {visibleInvoiceCols.invoiceNumber && <th className="pb-3 pr-2">رقم الفاتورة</th>}
                    {visibleInvoiceCols.customerName && <th className="pb-3">العميل</th>}
                    {visibleInvoiceCols.type && <th className="pb-3 text-center">النوع</th>}
                    {visibleInvoiceCols.finalAmount && <th className="pb-3 text-center">المبلغ</th>}
                    {visibleInvoiceCols.actions && <th className="pb-3 pl-2 text-left">معاينة / استرجاع</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleInvoiceCols).filter(Boolean).length || 1} className="py-12 text-center text-slate-400">
                        لا توجد فواتير مبيعات مسجلة في الأرشيف.
                      </td>
                    </tr>
                  ) : (
                    [...filteredInvoices].reverse().map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        {visibleInvoiceCols.invoiceNumber && (
                          <td className="py-3 pr-2 font-mono font-bold text-slate-900">
                            {inv.invoiceNumber}
                          </td>
                        )}
                        {visibleInvoiceCols.customerName && (
                          <td className="py-3 font-medium text-slate-800">
                            {inv.customerName}
                          </td>
                        )}
                        {visibleInvoiceCols.type && (
                          <td className="py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.type === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {inv.type === 'cash' ? 'نقداً (كاش)' : 'آجل (دين)'}
                            </span>
                          </td>
                        )}
                        {visibleInvoiceCols.finalAmount && (
                          <td className="py-3 text-center font-mono font-bold text-blue-600">
                            {inv.finalAmount.toLocaleString()} {currency}
                          </td>
                        )}
                        {visibleInvoiceCols.actions && (
                          <td className="py-3 pl-2 text-left flex justify-end gap-1.5 items-center">
                            {inv.proofImage && (
                              <button
                                type="button"
                                onClick={() => setProofModalImage(inv.proofImage!)}
                                className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold border border-emerald-200 text-[10px] flex items-center gap-1 transition cursor-pointer"
                                title="عرض صورة السند / الإيداع المرفق"
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                                <span>السند</span>
                              </button>
                            )}

                            <button
                              onClick={() => onViewInvoice(inv)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 transition text-[10px] flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" /> عرض
                            </button>

                            {inv.status !== 'refunded' && (
                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من استرجاع الفاتورة رقم ${inv.invoiceNumber} بالكامل وإرجاع الأصناف للمستودع؟`)) {
                                    onRefundInvoice(inv.id);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 transition text-[10px] flex items-center gap-1"
                              >
                                <Undo2 className="w-3.5 h-3.5" /> استرجاع
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* FLOATING ACTION BUTTON (FAB) FOR EXPENSE REGISTRATION */}
      <motion.div 
        drag
        dragMomentum={false}
        whileDrag={{ scale: 1.1 }}
        className="fixed bottom-6 right-6 z-40 touch-none cursor-grab active:cursor-grabbing"
      >
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setShowExpenseModal(true);
          }}
          className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-2xl flex items-center justify-center transition cursor-pointer border-2 border-white"
          title="تسجيل مصروف جديد (يمكنك سحبه وتحريكه)"
        >
          <Plus className="w-6 h-6" />
        </button>
      </motion.div>

      {/* BOTTOM SHEET MODAL: RECORD NEW EXPENSE */}
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
              {/* Drag Handle */}
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
