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
  X
} from 'lucide-react';
import { Transaction, Invoice } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';

interface TransactionsProps {
  transactions: Transaction[];
  invoices: Invoice[];
  onAddExpense: (amount: number, description: string) => void;
  onDeleteTransaction: (id: string) => void;
  onRefundInvoice: (id: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
  currency: string;
  isPrivacyMode?: boolean;
}

export default function Transactions({
  transactions,
  invoices,
  onAddExpense,
  onDeleteTransaction,
  onRefundInvoice,
  onViewInvoice,
  currency,
  isPrivacyMode = false
}: TransactionsProps) {
  const [subTab, setSubTab] = useState<'ledger' | 'invoices'>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'payment' | 'expense' | 'refund' | 'maintenance_income'>('all');

  // Add Expense form states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseDesc, setExpenseDesc] = useState('');
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

    onAddExpense(expenseAmount, expenseDesc.trim());
    setExpenseAmount(0);
    setExpenseDesc('');
    setShowExpenseModal(false);
    soundManager.playSuccessChime();
  };

  // Export current transactions ledger as CSV text
  const handleExportCSV = async () => {
    soundManager.playSuccessChime();
    // Explicit UTF-8 BOM prefix (\ufeff) to prevent Arabic text encoding corruption in Mobile Excel
    let csv = '\ufeff';
    csv += 'المعرف,التاريخ والوقت,نوع القيد,البيان والوصف,المبلغ\n';

    filteredTransactions.forEach(t => {
      const typeLabel = 
        t.type === 'sale' ? 'مبيعات' :
        t.type === 'payment' ? 'تحصيل دين' :
        t.type === 'expense' ? 'مصروفات' :
        t.type === 'refund' ? 'مرتجع' : 'صيانة';

      csv += `"${t.id}","${new Date(t.date).toLocaleString('ar-YE')}","${typeLabel}","${t.description.replace(/"/g, '""')}","${t.amount}"\n`;
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

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.includes(searchQuery);
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
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

          <div className="flex items-center gap-2">
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

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالبيان، الوصف، أو رقم الفاتورة..."
            className="w-full pr-10 pl-4 py-2.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        {/* SubTab 1: Ledger */}
        {subTab === 'ledger' ? (
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            {/* MOBILE CARDS VIEW (block md:hidden) */}
            <div className="block md:hidden space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  لا توجد حركات مالية مسجلة بالدفتر.
                </div>
              ) : (
                [...filteredTransactions].reverse().map(t => {
                  const isExpense = t.type === 'expense' || t.type === 'refund';
                  return (
                    <div key={t.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 shadow-xs">
                      <div className="flex justify-between items-center text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.type === 'expense' ? 'bg-rose-100 text-rose-700' :
                          t.type === 'refund' ? 'bg-amber-100 text-amber-700' :
                          t.type === 'payment' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {t.type === 'expense' ? 'مصروف' :
                           t.type === 'refund' ? 'مرتجع' :
                           t.type === 'payment' ? 'تحصيل' : 'مبيعات'}
                        </span>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(t.date).toLocaleString('ar-YE')}
                        </span>
                      </div>

                      <div className="font-bold text-slate-900 text-xs">{t.description}</div>

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
                    <th className="pb-3 pr-2">التاريخ والتوقيت</th>
                    <th className="pb-3 text-center">النوع</th>
                    <th className="pb-3">البيان والشرح</th>
                    <th className="pb-3 text-center">المبلغ</th>
                    <th className="pb-3 pl-2 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        لا توجد حركات مالية مسجلة بالدفتر.
                      </td>
                    </tr>
                  ) : (
                    [...filteredTransactions].reverse().map(t => {
                      const isExpense = t.type === 'expense' || t.type === 'refund';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 pr-2 font-mono text-[11px] text-slate-500">
                            {new Date(t.date).toLocaleString('ar-YE')}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              t.type === 'expense' ? 'bg-rose-100 text-rose-700' :
                              t.type === 'refund' ? 'bg-amber-100 text-amber-700' :
                              t.type === 'payment' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {t.type === 'expense' ? 'مصروف' :
                               t.type === 'refund' ? 'مرتجع' :
                               t.type === 'payment' ? 'تحصيل' : 'مبيعات'}
                            </span>
                          </td>
                          <td className="py-3 font-medium text-slate-800">
                            {t.description}
                          </td>
                          <td className={`py-3 text-center font-mono font-bold ${
                            isExpense ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {isExpense ? '-' : '+'}{t.amount.toLocaleString()} {currency}
                          </td>
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
                    <th className="pb-3 pr-2">رقم الفاتورة</th>
                    <th className="pb-3">العميل</th>
                    <th className="pb-3 text-center">النوع</th>
                    <th className="pb-3 text-center">المبلغ</th>
                    <th className="pb-3 pl-2 text-left">معاينة / استرجاع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        لا توجد فواتير مبيعات مسجلة في الأرشيف.
                      </td>
                    </tr>
                  ) : (
                    [...filteredInvoices].reverse().map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 pr-2 font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 font-medium text-slate-800">
                          {inv.customerName}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.type === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {inv.type === 'cash' ? 'نقداً (كاش)' : 'آجل (دين)'}
                          </span>
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-blue-600">
                          {inv.finalAmount.toLocaleString()} {currency}
                        </td>
                        <td className="py-3 pl-2 text-left flex justify-end gap-1.5">
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
                  <label className="text-xs font-bold text-slate-700">مبلغ المصروف نقدياً:</label>
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
                  <span>ترحيل بند المصاريف نقدياً</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
