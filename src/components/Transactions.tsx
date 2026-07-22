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
  Undo2 
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
}

export default function Transactions({
  transactions,
  invoices,
  onAddExpense,
  onDeleteTransaction,
  onRefundInvoice,
  onViewInvoice,
  currency
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

    transactions.forEach(t => {
      let typeAr = 'مصروف';
      if (t.type === 'sale') typeAr = 'مبيعات فاتورة';
      else if (t.type === 'payment') typeAr = 'سند قبض ديون';
      else if (t.type === 'refund') typeAr = 'مرتجع مبيعات';
      else if (t.type === 'maintenance_income') typeAr = 'إيراد صيانة';

      csv += `"${t.id}","${new Date(t.date).toLocaleString('ar-YE')}","${typeAr}","${t.description}",${t.amount}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_ledger_export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  // Filtered invoices
  const filteredInvoices = invoices.filter(inv => {
    const query = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(query) ||
      inv.customerName.toLowerCase().includes(query) ||
      inv.items.some(item => item.name.toLowerCase().includes(query))
    );
  });

  // Calculate totals
  const totalSales = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalRefunds = transactions.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0);
  const totalMaintenance = transactions.filter(t => t.type === 'maintenance_income').reduce((sum, t) => sum + t.amount, 0);

  // Cash Liquid register equation
  const netCashFlow = totalSales + totalPayments + totalMaintenance - totalExpenses - totalRefunds;

  const fmt = (num: number) => num.toLocaleString() + ' ' + currency;

  return (
    <div id="transactions_tab_view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT: Stats & Expenses Form (5 columns) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Net Cash Flow Summary card */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg space-y-4">
          <h3 className="text-xs font-bold text-gray-300">موجز الحركة المالية والصندوق</h3>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/15">
              <div className="text-gray-400 text-[10px]">إجمالي المقبوضات وصيانة</div>
              <div className="font-bold text-green-400 mt-1 font-mono">{fmt(totalSales + totalPayments + totalMaintenance)}</div>
            </div>
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15">
              <div className="text-gray-400 text-[10px]">إجمالي مصاريف ومرتجع</div>
              <div className="font-bold text-red-400 mt-1 font-mono">{fmt(totalExpenses + totalRefunds)}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-[#122030] to-[#0D1520] border border-[#C5A862]/30 flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-[10px] text-gray-400 font-semibold block">صافي السيولة النقدية بالصندوق:</span>
              <span className="text-lg font-bold text-white font-mono">{fmt(netCashFlow)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Record Expense Form */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 shadow-lg">
          <h3 className="text-sm font-bold text-[#F3E7C4] flex items-center gap-2 mb-1.5">
            <Plus className="w-5 h-5 text-red-400" />
            تسجيل مصروف يومي أو تشغيلي
          </h3>
          <p className="text-[11px] text-gray-400 mb-4">قيد المصاريف الكهربائية، الإيجارات، الأجور، والقطع من الصندوق اليومي.</p>

          {expenseError && (
            <div className="p-2 mb-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] font-semibold">
              {expenseError}
            </div>
          )}

          <form onSubmit={handleExpenseSubmit} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">مبلغ المصروف نقدياً:</label>
              <input
                id="expense_amount_input"
                type="number"
                min="1"
                required
                value={expenseAmount || ''}
                onChange={(e) => setExpenseAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="مثال: 5000"
                className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">البيان والشرح (السبب التفصيلي):</label>
              <input
                id="expense_desc_input"
                type="text"
                required
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                placeholder="مثال: سداد فاتورة كهرباء المحل لشهر يوليو..."
                className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
              />
            </div>

            <button
              id="submit_expense_btn"
              type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-950/60 border border-red-500/50 hover:bg-red-500 text-red-200 hover:text-black transition duration-200 cursor-pointer text-center"
            >
              تسجيل وترحيل بند المصاريف ⚡
            </button>
          </form>
        </div>

      </div>

      {/* RIGHT: Ledger and historical archive (8 columns) */}
      <div className="lg:col-span-8 space-y-4">
        
        {/* Sub Navigation tabs */}
        <div className="flex bg-[#121D2A] p-1 border border-gray-800 rounded-xl max-w-sm">
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setSubTab('ledger');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              subTab === 'ledger' 
                ? 'bg-[#C5A862] text-black shadow-md' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Wallet className="w-4 h-4" /> دفتر الحركات والقيود
          </button>
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setSubTab('invoices');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              subTab === 'invoices' 
                ? 'bg-[#C5A862] text-black shadow-md' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" /> أرشيف الفواتير الصادرة
          </button>
        </div>

        {/* Tab 1: Ledger view */}
        {subTab === 'ledger' && (
          <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg animate-fadeIn">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#F3E7C4]">حركة قيود اليومية التفصيلية</h3>
                <p className="text-[11px] text-gray-400">تدقيق إجمالي الحركات المسجلة بالصندوق: {transactions.length} حركات</p>
              </div>

              {/* Transactions Type filter buttons */}
              <div className="flex bg-[#16212E] border border-gray-800 rounded-xl p-0.5 text-[9px] font-bold">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2 py-1 rounded cursor-pointer ${filterType === 'all' ? 'bg-[#C5A862] text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setFilterType('sale')}
                  className={`px-2 py-1 rounded cursor-pointer ${filterType === 'sale' ? 'bg-green-600/20 text-green-400 border border-green-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  مبيعات
                </button>
                <button
                  onClick={() => setFilterType('payment')}
                  className={`px-2 py-1 rounded cursor-pointer ${filterType === 'payment' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  قبض ديون
                </button>
                <button
                  onClick={() => setFilterType('maintenance_income')}
                  className={`px-2 py-1 rounded cursor-pointer ${filterType === 'maintenance_income' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  صيانة
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  className={`px-2 py-1 rounded cursor-pointer ${filterType === 'expense' ? 'bg-red-600/20 text-red-400 border border-red-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  مصاريف
                </button>
                <button
                  onClick={() => setFilterType('refund')}
                  className={`px-2 py-1 rounded cursor-pointer ${filterType === 'refund' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  مرتجعات
                </button>
              </div>
            </div>

            {/* Search and export toolbar */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالبيان أو تفاصيل القيد..."
                  className="w-full pr-10 pl-3 py-2 text-xs rounded-xl bg-[#16212E] border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 transition"
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              </div>

              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[#16212E] border border-gray-800 text-gray-300 hover:border-gray-700 cursor-pointer flex items-center gap-1.5 transition"
                title="تصدير السجل كملف إكسل CSV"
              >
                <Download className="w-4 h-4" /> تصدير CSV
              </button>
            </div>

            {/* Logs table */}
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="pb-3 pr-1">النوع</th>
                    <th className="pb-3 text-right">البيان والوصف القيدي</th>
                    <th className="pb-3 text-center">التاريخ والوقت</th>
                    <th className="pb-3 text-center">المبلغ</th>
                    <th className="pb-3 pl-1 text-left">خيارات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        لا توجد قيود مالية في دفتر اليومية مطابقة لخيار البحث.
                      </td>
                    </tr>
                  ) : (
                    [...filteredTransactions].reverse().map(t => (
                      <tr key={t.id} className="hover:bg-[#182433]/20">
                        <td className="py-3 pr-1">
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] flex items-center gap-1 w-max ${
                            t.type === 'sale' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : t.type === 'payment'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : t.type === 'maintenance_income'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : t.type === 'refund'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {t.type === 'sale' ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : t.type === 'payment' ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : t.type === 'maintenance_income' ? (
                              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                            ) : t.type === 'refund' ? (
                              <ArrowDownRight className="w-3 h-3 text-amber-400" />
                            ) : (
                              <Calendar className="w-3 h-3" />
                            )}
                            {t.type === 'sale' 
                              ? 'فاتورة' 
                              : t.type === 'payment' 
                              ? 'قبض ديون' 
                              : t.type === 'maintenance_income'
                              ? 'صيانة'
                              : t.type === 'refund'
                              ? 'مرتجع'
                              : 'مصروف'}
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-200 font-medium">
                          {t.description}
                        </td>
                        <td className="py-3 text-center text-gray-400 font-mono">
                          {new Date(t.date).toLocaleDateString('ar-YE')} {new Date(t.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className={`py-3 text-center font-mono font-bold ${
                          t.type === 'sale' || t.type === 'payment' || t.type === 'maintenance_income' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {t.type === 'sale' || t.type === 'payment' || t.type === 'maintenance_income' ? '+' : '-'}{t.amount.toLocaleString()} {currency}
                        </td>
                        <td className="py-3 pl-1 text-left">
                          <button
                            onClick={() => {
                              if (confirm('⚠️ تنبيه: حذف القيود المالية قد يتلف توازن الحسابات، يوصى فقط بحذف القيود المدخلة بالخطأ. هل تود الحذف الحقيقي؟')) {
                                soundManager.playWarningBeep();
                                onDeleteTransaction(t.id);
                              }
                            }}
                            className="p-1 rounded text-red-400 hover:bg-red-500/10 cursor-pointer transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* Tab 2: Invoices Archive view */}
        {subTab === 'invoices' && (
          <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg animate-fadeIn">
            
            <div className="mb-4">
              <h3 className="text-sm font-bold text-[#F3E7C4]">أرشيف الفواتير الصادرة والمبيعات الجارية</h3>
              <p className="text-[11px] text-gray-400">مراجعة وإرجاع وطباعة جميع الفواتير المسجلة بالنظام</p>
            </div>

            {/* Search input */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الفاتورة، اسم العميل، أو المنتجات المشتراة..."
                className="w-full pr-10 pl-3 py-2 text-xs rounded-xl bg-[#16212E] border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 transition"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>

            {/* Invoices list */}
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="pb-3 pr-1">رقم الفاتورة</th>
                    <th className="pb-3 text-right">العميل</th>
                    <th className="pb-3 text-center">التاريخ والوقت</th>
                    <th className="pb-3 text-center">الصافي</th>
                    <th className="pb-3 text-center">حالة الفاتورة</th>
                    <th className="pb-3 pl-1 text-left">خيارات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        لا توجد أي فواتير صادر مسجلة تطابق محددات البحث.
                      </td>
                    </tr>
                  ) : (
                    [...filteredInvoices].reverse().map(inv => {
                      const isRefunded = inv.status === 'refunded';
                      return (
                        <tr key={inv.id} className={`hover:bg-[#182433]/20 ${isRefunded ? 'opacity-50 line-through' : ''}`}>
                          <td className="py-3 pr-1 font-mono font-bold text-[#C5A862]">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3 text-right text-gray-200">
                            <div>{inv.customerName}</div>
                            <span className="text-[9px] text-gray-400 font-semibold bg-slate-800 px-1 py-0.5 rounded">
                              {inv.type === 'cash' ? '💵 خلاص نقدي' : '📝 ذمة آجلة'}
                            </span>
                          </td>
                          <td className="py-3 text-center text-gray-400 font-mono">
                            {new Date(inv.date).toLocaleDateString('ar-YE')} {new Date(inv.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 text-center font-mono font-bold text-white">
                            {inv.finalAmount.toLocaleString()} {currency}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                              isRefunded 
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                : 'bg-green-500/10 text-green-400 border border-green-500/20'
                            }`}>
                              {isRefunded ? '↩️ مرتجعة/ملغاة' : '✓ سارية ومثبتة'}
                            </span>
                          </td>
                          <td className="py-3 pl-1 text-left flex justify-end gap-1.5">
                            
                            {/* Reprint button */}
                            <button
                              onClick={() => {
                                soundManager.playSuccessChime();
                                onViewInvoice(inv);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white cursor-pointer transition"
                              title="عرض الفاتورة وإعادة طباعتها"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Refund return button */}
                            {!isRefunded && (
                              <button
                                onClick={() => {
                                  if (confirm(`⚠️ تحذير: هل أنت متأكد من استرجاع سلع الفاتورة "${inv.invoiceNumber}" وإعادة كميات المنتجات إلى مخزن المحل وإلغاء القيمة؟`)) {
                                    soundManager.playWarningBeep();
                                    onRefundInvoice(inv.id);
                                  }
                                }}
                                className="p-1 rounded bg-amber-950/20 hover:bg-amber-500 hover:text-black text-amber-400 cursor-pointer transition"
                                title="عمل مرتجع وإرجاع السلع بالكامل"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                          </td>
                        </tr>
                      );
                    })
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
