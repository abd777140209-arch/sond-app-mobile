/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Printer,
  Share2,
  Send,
  FileText,
  Filter,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Customer, Invoice, Payment } from '../types';
import { soundManager } from '../utils/sound';
import { openWhatsApp } from '../utils/nativeLauncher';
import { generateAndSharePDF } from '../services/pdfService';

export type StatementFilterType = 'all' | 'unpaid' | 'invoices' | 'payments';

interface CustomerStatementModalProps {
  isOpen: boolean;
  customer: Customer | null;
  invoices: Invoice[];
  payments: Payment[];
  onClose: () => void;
  currency: string;
  storeName?: string;
  storeLogoUrl?: string;
  isPrivacyMode?: boolean;
  initialFilter?: StatementFilterType;
}

interface EnrichedLedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment';
  description: string;
  debit: number;
  credit: number;
  itemsCount: number;
  balance: number;
  paidAmount: number;
  remainingUnpaid: number;
  settlementStatus: 'paid' | 'partial' | 'unpaid' | 'payment_entry';
}

export default function CustomerStatementModal({
  isOpen,
  customer,
  invoices,
  payments,
  onClose,
  currency,
  storeName = 'سند المحاسبي',
  storeLogoUrl,
  isPrivacyMode = false,
  initialFilter = 'all'
}: CustomerStatementModalProps) {
  const statementRef = useRef<HTMLDivElement>(null);

  const [statementFilter, setStatementFilter] = useState<StatementFilterType>(initialFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);

  useEffect(() => {
    setStatementFilter(initialFilter);
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  }, [customer?.id, initialFilter, isOpen]);

  if (!isOpen || !customer) return null;

  const fmtAmount = (num: number) => {
    if (isPrivacyMode) return '•••• ' + currency;
    return num.toLocaleString() + ' ' + currency;
  };

  // Filter invoices and payments for this specific customer
  const customerInvoices = invoices.filter(inv => inv.customerId === customer.id && inv.status !== 'refunded');
  const customerPayments = payments.filter(p => p.customerId === customer.id);

  const totalInvoicedDebit = customerInvoices.reduce((s, inv) => s + (inv.finalAmount || 0), 0);
  const totalPaidCredit = customerPayments.reduce((s, pay) => s + (pay.amount || 0), 0);
  const netFromTransactions = totalInvoicedDebit - totalPaidCredit;
  const impliedOpeningDebt = Math.max(0, (customer.totalDebt || 0) - netFromTransactions);

  // Combine into single chronological ledger list
  const rawEntries = [
    ...customerInvoices.map(inv => ({
      id: inv.id,
      date: inv.date,
      type: 'invoice' as const,
      description: `فاتورة مبيعات آجل رقم #${inv.invoiceNumber}`,
      debit: inv.finalAmount,
      credit: 0,
      itemsCount: inv.items.reduce((s, i) => s + i.quantity, 0)
    })),
    ...customerPayments.map(pay => ({
      id: pay.id,
      date: pay.date,
      type: 'payment' as const,
      description: `سند قبض نقدية: ${pay.note || 'تسديد دفعة'}${pay.referenceNumber ? ` (#${pay.referenceNumber})` : ''}`,
      debit: 0,
      credit: pay.amount,
      itemsCount: 0
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const ledgerEntries = impliedOpeningDebt > 0
    ? [
        {
          id: `opening-${customer.id}`,
          date: rawEntries[0]?.date || new Date().toISOString(),
          type: 'invoice' as const,
          description: 'رصيد مديونية افتتاحي / سابق مقيد على الحساب',
          debit: impliedOpeningDebt,
          credit: 0,
          itemsCount: 0
        },
        ...rawEntries
      ]
    : rawEntries;

  // FIFO Invoice Settlement Allocation & Running Balance Calculation
  let runningBalance = 0;
  let availableCreditPool = totalPaidCredit;

  const ledgerWithBalance: EnrichedLedgerEntry[] = ledgerEntries.map(entry => {
    runningBalance += (entry.debit - entry.credit);

    if (entry.type === 'invoice') {
      const covered = Math.min(entry.debit, Math.max(0, availableCreditPool));
      availableCreditPool = Math.max(0, availableCreditPool - covered);
      const remainingUnpaid = Math.max(0, entry.debit - covered);
      const settlementStatus: EnrichedLedgerEntry['settlementStatus'] =
        remainingUnpaid <= 0 ? 'paid' : covered > 0 ? 'partial' : 'unpaid';

      return {
        ...entry,
        balance: runningBalance,
        paidAmount: covered,
        remainingUnpaid,
        settlementStatus
      };
    }

    return {
      ...entry,
      balance: runningBalance,
      paidAmount: entry.credit,
      remainingUnpaid: 0,
      settlementStatus: 'payment_entry'
    };
  });

  // Counts for Filter Tabs
  const unpaidEntriesCount = ledgerWithBalance.filter(
    e => e.type === 'invoice' && e.remainingUnpaid > 0
  ).length;
  const totalInvoicesCount = ledgerWithBalance.filter(e => e.type === 'invoice').length;
  const totalPaymentsCount = ledgerWithBalance.filter(e => e.type === 'payment').length;

  // Apply Active Filters (Type + Search + Date Range)
  const filteredEntries = ledgerWithBalance.filter(entry => {
    if (statementFilter === 'unpaid') {
      if (entry.type !== 'invoice' || entry.remainingUnpaid <= 0) return false;
    } else if (statementFilter === 'invoices') {
      if (entry.type !== 'invoice') return false;
    } else if (statementFilter === 'payments') {
      if (entry.type !== 'payment') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!entry.description.toLowerCase().includes(q)) return false;
    }

    const entryDateStr = new Date(entry.date).toISOString().split('T')[0];
    if (dateFrom && entryDateStr < dateFrom) return false;
    if (dateTo && entryDateStr > dateTo) return false;

    return true;
  });

  const hasCustomFilter =
    statementFilter !== 'all' || Boolean(searchQuery.trim()) || Boolean(dateFrom) || Boolean(dateTo);

  // Filtered Totals
  const filteredDebitTotal = filteredEntries.reduce((s, e) => s + e.debit, 0);
  const filteredCreditTotal = filteredEntries.reduce((s, e) => s + e.credit, 0);
  const filteredRemainingUnpaidTotal = filteredEntries.reduce((s, e) => s + e.remainingUnpaid, 0);

  const getFilterLabel = () => {
    switch (statementFilter) {
      case 'unpaid':
        return 'كشف الفواتير غير المسددة فقط';
      case 'invoices':
        return 'كشف فواتير المبيعات الآجلة فقط';
      case 'payments':
        return 'كشف الدفعات وسندات القبض فقط';
      default:
        return 'كشف حساب عميل مفصل (جميع الحركات)';
    }
  };

  const generatePDFAndShare = async () => {
    if (isGeneratingPDF) return;
    soundManager.playSuccessChime();
    setIsGeneratingPDF(true);

    try {
      const reportTitle = getFilterLabel();
      const targetTotal =
        statementFilter === 'unpaid'
          ? filteredRemainingUnpaidTotal
          : statementFilter === 'invoices'
          ? filteredDebitTotal
          : statementFilter === 'payments'
          ? filteredCreditTotal
          : customer.totalDebt;

      await generateAndSharePDF({
        title: reportTitle,
        storeName: storeName || 'نظام سند المحاسبي',
        invoiceNumber: `كشف-${customer.id.substring(0, 6)}`,
        customerName: customer.name,
        phone: customer.phone || 'غير مسجل',
        date: new Date().toLocaleDateString('ar-YE'),
        paymentMethod: reportTitle,
        subtotal: `${targetTotal.toLocaleString()} ${currency}`,
        totalAmount: `${customer.totalDebt.toLocaleString()} ${currency}`,
        items: filteredEntries.map((e, idx) => ({
          description:
            statementFilter === 'unpaid'
              ? `${e.description} ${e.paidAmount > 0 ? `(سُدد منها: ${e.paidAmount.toLocaleString()} | المتبقي: ${e.remainingUnpaid.toLocaleString()})` : '(غير مسددة بالكامل)'}`
              : `${e.description} (الرصيد: ${e.balance.toLocaleString()} ${currency})`,
          quantity: idx + 1,
          unitPrice:
            statementFilter === 'unpaid'
              ? `أصل الفاتورة: ${e.debit.toLocaleString()}`
              : e.debit > 0
              ? `مدين +${e.debit.toLocaleString()}`
              : `دائن -${e.credit.toLocaleString()}`,
          amount:
            statementFilter === 'unpaid'
              ? `${e.remainingUnpaid.toLocaleString()} ${currency}`
              : `${e.balance.toLocaleString()} ${currency}`
        }))
      });
    } catch (err) {
      console.error('Customer statement PDF generation error:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = async () => {
    soundManager.playScanBeep();
    await generatePDFAndShare();
  };

  // Phone clean formatting
  const cleanPhone = (customer.phone || '').replace(/[^0-9]/g, '');
  const finalWhatsAppPhone =
    cleanPhone.startsWith('77') || cleanPhone.startsWith('73') || cleanPhone.startsWith('71') || cleanPhone.startsWith('70')
      ? '967' + cleanPhone
      : cleanPhone;

  const formattedDueDate =
    customer.debtDueDate && !isNaN(new Date(customer.debtDueDate).getTime())
      ? new Date(customer.debtDueDate).toLocaleDateString('ar-YE')
      : 'غير محدد';

  // Dynamic WhatsApp text reflecting active filter
  const buildWhatsAppSummary = () => {
    const header = `*${getFilterLabel()} - ${storeName}*\nالعميل: *${customer.name}*\n`;
    if (statementFilter === 'unpaid') {
      const unpaidLines = filteredEntries
        .slice(0, 10)
        .map(
          (e, idx) =>
            `${idx + 1}. ${e.description}: المتبقي *${e.remainingUnpaid.toLocaleString()} ${currency}*` +
            (e.paidAmount > 0 ? ` (من أصل ${e.debit.toLocaleString()})` : '')
        )
        .join('\n');
      return (
        header +
        `عدد الفواتير غير المسددة: *${filteredEntries.length}*\n` +
        (unpaidLines ? `\n*تفاصيل الفواتير المتبقية:*\n${unpaidLines}\n\n` : '') +
        `إجمالي المتبقي غير المسدد: *${filteredRemainingUnpaidTotal.toLocaleString()} ${currency}*\n` +
        `تاريخ الاستحقاق: *${formattedDueDate}*`
      );
    }
    return (
      header +
      `عدد الحركات المعروضة: *${filteredEntries.length}*\n` +
      `رصيد المديونية النهائي: *${customer.totalDebt.toLocaleString()} ${currency}*\n` +
      `تاريخ استحقاق الدين: *${formattedDueDate}*`
    );
  };

  const handleNativeShare = async () => {
    soundManager.playScanBeep();
    await generatePDFAndShare();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        
        {/* 1. Modal Top Bar (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 rounded-xl text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">كشف حساب عميل وتصفية الذمم</h3>
              <p className="text-[11px] text-slate-400">{customer.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Integrated Statement Filter Bar (Hidden in Print) */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5 print:hidden">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>تصفية كشف الحساب:</span>
            </div>

            {hasCustomFilter && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playScanBeep();
                  setStatementFilter('all');
                  setSearchQuery('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إعادة ضبط التصفية</span>
              </button>
            )}
          </div>

          {/* Primary Filter Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => {
                soundManager.playScanBeep();
                setStatementFilter('all');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-between gap-1.5 cursor-pointer ${
                statementFilter === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>الكل</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                statementFilter === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {ledgerWithBalance.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playScanBeep();
                setStatementFilter('unpaid');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-between gap-1.5 cursor-pointer ${
                statementFilter === 'unpaid'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              <span className="truncate">غير المسددة فقط</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                statementFilter === 'unpaid' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-700'
              }`}>
                {unpaidEntriesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playScanBeep();
                setStatementFilter('invoices');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-between gap-1.5 cursor-pointer ${
                statementFilter === 'invoices'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>الفواتير فقط</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                statementFilter === 'invoices' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {totalInvoicesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playScanBeep();
                setStatementFilter('payments');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-between gap-1.5 cursor-pointer ${
                statementFilter === 'payments'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>الدفعات فقط</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums ${
                statementFilter === 'payments' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {totalPaymentsCount}
              </span>
            </button>
          </div>

          {/* Search & Date Range Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الفاتورة أو البيان..."
                className="w-full bg-white border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-bold text-slate-400 shrink-0">من:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-xs font-mono text-slate-700 bg-transparent focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-[10px] font-bold text-slate-400 shrink-0">إلى:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full text-xs font-mono text-slate-700 bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. Printable Statement Content */}
        <div ref={statementRef} className="p-5 sm:p-6 space-y-4 overflow-y-auto print:overflow-visible print:p-8">
          
          {/* Statement Header Branding */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              {storeLogoUrl && (
                <img 
                  src={storeLogoUrl} 
                  alt={storeName} 
                  className="w-12 h-12 rounded-xl object-contain border border-slate-200 bg-white p-0.5" 
                />
              )}
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">{storeName}</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">{getFilterLabel()}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">تاريخ التقرير: {new Date().toLocaleDateString('ar-YE')}</p>
              </div>
            </div>
            <div className="text-left font-mono space-y-1">
              <div className="inline-block px-3 py-1 bg-slate-100 text-slate-900 border border-slate-300 rounded-lg text-xs font-bold">
                #CUST-{customer.id.slice(-4)}
              </div>
              {statementFilter === 'unpaid' && (
                <div className="block px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[10px] font-sans font-bold text-center">
                  الفواتير غير المسددة فقط
                </div>
              )}
            </div>
          </div>

          {/* Customer Metadata Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">اسم العميل:</span>
              <span className="font-black text-slate-900">{customer.name}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">رقم الهاتف:</span>
              <span className="font-mono tabular-nums font-bold text-slate-800">{customer.phone}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">تاريخ استحقاق الدين:</span>
              <span className="font-mono tabular-nums font-bold text-amber-700">
                {customer.debtDueDate ? new Date(customer.debtDueDate).toLocaleDateString('ar-YE') : 'غير محدد'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">إجمالي المديونية الحالية:</span>
              <span className="font-mono tabular-nums font-black text-rose-600">{fmtAmount(customer.totalDebt)}</span>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">
                {getFilterLabel()} ({filteredEntries.length} حركة):
              </h4>
              {statementFilter === 'unpaid' && (
                <span className="text-[11px] font-bold text-rose-600">
                  يتم احتساب المسدد والمتبقي آلياً من أقدم الفواتير للأحدث
                </span>
              )}
            </div>
            
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead>
                  {statementFilter === 'unpaid' ? (
                    <tr className="bg-rose-50/80 border-b border-rose-200 text-slate-800 font-bold">
                      <th className="p-2.5">التاريخ</th>
                      <th className="p-2.5">الفاتورة / البيان</th>
                      <th className="p-2.5 text-center">الحالة</th>
                      <th className="p-2.5 text-center">أصل الفاتورة</th>
                      <th className="p-2.5 text-center text-emerald-700">المسدد منها</th>
                      <th className="p-2.5 text-center text-rose-700">المتبقي غير المسدد</th>
                    </tr>
                  ) : (
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-2.5">التاريخ</th>
                      <th className="p-2.5">البيان / تفاصيل العملية</th>
                      <th className="p-2.5 text-center">حالة الفاتورة</th>
                      <th className="p-2.5 text-center text-rose-700">مدين (عليه)</th>
                      <th className="p-2.5 text-center text-emerald-700">دائن (له)</th>
                      <th className="p-2.5 text-center">الرصيد التراكمي</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 font-sans">
                        {statementFilter === 'unpaid'
                          ? 'ممتاز! لا توجد أي فواتير غير مسددة لهذا العميل ضمن النطاق المحدد.'
                          : 'لا توجد حركات مالية تطابق خيارات التصفية المحددة.'}
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 text-slate-500 whitespace-nowrap text-[11px]">
                          {new Date(item.date).toLocaleDateString('ar-YE')}
                        </td>
                        <td className="p-2.5 font-sans font-bold text-slate-900">
                          <div>{item.description}</div>
                          {item.type === 'invoice' && item.settlementStatus === 'partial' && statementFilter !== 'unpaid' && (
                            <div className="text-[10px] text-amber-700 font-normal mt-0.5">
                              سُدد منها: {item.paidAmount.toLocaleString()} {currency} • المتبقي: {item.remainingUnpaid.toLocaleString()} {currency}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-sans">
                          {item.type === 'payment' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> دفعة مسددة
                            </span>
                          ) : item.settlementStatus === 'paid' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> مسددة بالكامل
                            </span>
                          ) : item.settlementStatus === 'partial' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3" /> مسددة جزئياً
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3" /> غير مسددة
                            </span>
                          )}
                        </td>

                        {statementFilter === 'unpaid' ? (
                          <>
                            <td className="p-2.5 text-center font-bold text-slate-700">
                              {item.debit.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-center font-bold text-emerald-600">
                              {item.paidAmount > 0 ? item.paidAmount.toLocaleString() : '0'}
                            </td>
                            <td className="p-2.5 text-center font-black text-rose-600 dir-ltr">
                              {item.remainingUnpaid.toLocaleString()} {currency}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2.5 text-center font-bold text-rose-600">
                              {item.debit > 0 ? item.debit.toLocaleString() : '-'}
                            </td>
                            <td className="p-2.5 text-center font-bold text-emerald-600">
                              {item.credit > 0 ? item.credit.toLocaleString() : '-'}
                            </td>
                            <td className="p-2.5 text-center font-black text-slate-900 dir-ltr">
                              {item.balance.toLocaleString()} {currency}
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statement Summary Footer */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-wrap justify-between items-center gap-3 shadow-md">
            <div>
              <span className="text-xs text-slate-300 font-bold block">
                {statementFilter === 'unpaid'
                  ? 'إجمالي المتبقي من الفواتير غير المسددة المعروضة:'
                  : statementFilter === 'invoices'
                  ? 'إجمالي الفواتير المعروضة:'
                  : statementFilter === 'payments'
                  ? 'إجمالي الدفعات المسددة المعروضة:'
                  : 'إجمالي صافي المديونية المستحقة المطلوبة:'}
              </span>
              <span className="text-[11px] text-slate-400">
                {statementFilter === 'unpaid'
                  ? `عدد الفواتير المفتوحة: ${filteredEntries.length} فاتورة`
                  : `إجمالي رصيد الحساب الكلي: ${fmtAmount(customer.totalDebt)}`}
              </span>
            </div>
            <div className="text-left font-mono tabular-nums">
              <span className="text-lg font-black text-emerald-400 dir-ltr">
                {statementFilter === 'unpaid'
                  ? fmtAmount(filteredRemainingUnpaidTotal)
                  : statementFilter === 'invoices'
                  ? fmtAmount(filteredDebitTotal)
                  : statementFilter === 'payments'
                  ? fmtAmount(filteredCreditTotal)
                  : fmtAmount(customer.totalDebt)}
              </span>
            </div>
          </div>

          {/* Stamp / Signature placeholder for printed docs */}
          <div className="hidden print:flex justify-between items-center pt-8 border-t border-slate-300 text-xs font-bold text-slate-700">
            <div>توقيع وتختيم المتجر: ....................</div>
            <div>توقيع وإقرار العميل بالسداد: ....................</div>
          </div>

        </div>

        {/* 4. Action Controls Footer (Hidden in Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundManager.playScanBeep();
                openWhatsApp(finalWhatsAppPhone, buildWhatsAppSummary());
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>إرسال الكشف عبر واتساب</span>
            </button>

            <button
              onClick={handleNativeShare}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة PDF</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isGeneratingPDF}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>
                {statementFilter === 'unpaid'
                  ? 'طباعة الفواتير غير المسددة / PDF'
                  : 'طباعة كشف الحساب / PDF'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
