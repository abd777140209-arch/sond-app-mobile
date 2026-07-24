/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Transaction, Invoice } from '../types';
import { soundManager } from '../utils/sound';

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
    soundManager.playSuccessChime();
  };

  // Export current transactions ledger as CSV text
  const handleExportCSV = () => {
    soundManager.playSuccessChime();
    let csv = '\ufeff'; // UTF-8 BOM
    csv += 'المعرف,التاريخ والوقت,نوع القيد,البيان والوصف,المبلغ\n';

    filteredTransactions.forEach(t => {
      const typeLabel = 
        t.type === 'sale' ? 'مبيعات' :
        t.type === 'payment' ? 'تحصيل دين' :
        t.type === 'expense' ? 'مصروفات' :
        t.type === 'refund' ? 'مرتجع' : 'صيانة';

      csv += `"${t.id}","${new Date(t.date).toLocaleString('ar-YE')}","${typeLabel}","${t.description.replace(/"/g, '""')}","${t.amount}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `كشف_الحركات_المالية_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div id="transactions_tab_view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT: Stats & Expenses Form (4 columns) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Net Cash Flow Summary Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-700">موجز الحركة المالية والصندوق</h3>
          
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="text-slate-500 text-[10px]">المقبوضات والصيانة</div>
              <div className="font-black text-emerald-600 mt-1 font-mono">{fmt(totalSales + totalPayments + totalMaintenance)}</div>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
              <div className="text-slate-500 text-[10px]">المصاريف والمرتجع</div>
              <div className="font-black text-rose-600 mt-1 font-mono">{fmt(totalExpenses + totalRefunds)}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center shadow-inner">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold block">صافي السيولة بالصندوق:</span>
              <span className="text-lg font-black text-emerald-400 font-mono dir-ltr">{fmt(netCashFlow)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Record Expense Form Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">تسجيل مصروف جديد</h3>
              <p className="text-[11px] text-slate-400">قيد المصاريف اليومية والتشغيلية</p>
            </div>
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
        </div>

      </div>

      {/* RIGHT: Ledger & Historical Archive (8 columns) */}
      <div className="lg:col-span-8 space-y-4">
        
        {/* Navigation Sub-Tabs & Export */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex bg-slate-100 p-1 border border-slate-200 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSubTab('ledger')}
              className={`px-4 py-2 rounded-lg transition ${
                subTab === 'ledger' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              سجل دفتر الحركات المالية ({transactions.length})
            </button>
            <button
              onClick={() => setSubTab('invoices')}
              className={`px-4 py-2 rounded-lg transition ${
                subTab === 'invoices' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              أرشيف الفواتير المكتملة ({invoices.length})
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>تصدير CSV</span>
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
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
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
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
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

    </div>
  );
}
