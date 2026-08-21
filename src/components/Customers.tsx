/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  UserPlus, 
  Phone, 
  CreditCard, 
  MessageSquare, 
  CheckCircle2, 
  History, 
  Trash2, 
  Users, 
  Wallet, 
  TrendingUp, 
  Award,
  AlertCircle,
  Filter,
  UserCheck,
  Send,
  Edit2,
  FileText,
  Printer,
  Calendar,
  Share2,
  Sparkles,
  Clock,
  X,
  Plus,
  SlidersHorizontal,
  FileSpreadsheet,
  ShieldCheck,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Customer, Payment, Invoice } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';
import { generateAndSharePDF } from '../services/pdfService';
import { PAYMENT_METHODS, PaymentMethodKey } from '../utils/paymentMethods';
import CustomerEditModal from './CustomerEditModal';
import CustomerReminderModal from './CustomerReminderModal';
import CustomerStatementModal from './CustomerStatementModal';

interface CustomersProps {
  customers: Customer[];
  payments: Payment[];
  invoices?: Invoice[];
  onAddCustomer: (customer: Omit<Customer, 'id' | 'createdAt'> & { totalDebt?: number }) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onPayDebt: (customerId: string, amount: number, note: string, paymentMethod?: string, referenceNumber?: string) => void;
  onDeleteCustomer: (customerId: string) => void;
  currency: string;
  storeName?: string;
  storeLogoUrl?: string;
  isPrivacyMode?: boolean;
  debtReminderTemplate?: string;
  onSaveReminderTemplate?: (template: string) => void;
}

export default function Customers({
  customers,
  payments,
  invoices = [],
  onAddCustomer,
  onUpdateCustomer,
  onPayDebt,
  onDeleteCustomer,
  currency,
  storeName = 'سند المحاسبي',
  storeLogoUrl,
  isPrivacyMode = false,
  debtReminderTemplate,
  onSaveReminderTemplate
}: CustomersProps) {
  const fmtAmount = (num: number) => {
    if (isPrivacyMode) return '**** ' + currency;
    return num.toLocaleString() + ' ' + currency;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debtors' | 'overdue'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Column Visibility States for Table View
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    phone: true,
    debtDueDate: true,
    totalDebt: true,
    loyaltyPoints: true,
    actions: true,
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // New Customer Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustInitialDebt, setNewCustInitialDebt] = useState<number>(0);
  const [newCustCreditLimit, setNewCustCreditLimit] = useState<number | ''>('');
  const [newCustDueDate, setNewCustDueDate] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [addError, setAddError] = useState('');

  // Debt Payment States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNote, setPayNote] = useState('');
  const [payPaymentMethod, setPayPaymentMethod] = useState<PaymentMethodKey>('cash');
  const [payRefNumber, setPayRefNumber] = useState('');
  const [payError, setPayError] = useState('');

  // Modal States
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [reminderCustomer, setReminderCustomer] = useState<Customer | null>(null);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Filter out soft-deleted customers
  const activeCustomers = customers.filter(c => c.isDeleted !== true && c.isActive !== false);

  // Statistics Calculations
  const totalDebts = activeCustomers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
  const debtorCustomers = activeCustomers.filter(c => c.totalDebt > 0);
  const highestDebtor = [...debtorCustomers].sort((a, b) => b.totalDebt - a.totalDebt)[0];

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueCustomers = debtorCustomers.filter(c => c.debtDueDate && c.debtDueDate < todayStr);

  // Handle adding new customer
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      setAddError('⚠️ الرجاء كتابة اسم العميل!');
      soundManager.playWarningBeep();
      return;
    }
    
    // Check if duplicate name
    if (activeCustomers.some(c => c.name.toLowerCase() === newCustName.trim().toLowerCase())) {
      setAddError('⚠️ هذا العميل مسجل مسبقاً بالفعل في قاعدة البيانات!');
      soundManager.playWarningBeep();
      return;
    }

    const initialDebtVal = Math.max(0, Number(newCustInitialDebt) || 0);

    onAddCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim() || 'بدون هاتف',
      debtDueDate: newCustDueDate || undefined,
      creditLimit: newCustCreditLimit === '' ? undefined : Math.max(0, Number(newCustCreditLimit)),
      notes: newCustNotes.trim(),
      loyaltyPoints: 0,
      totalDebt: initialDebtVal,
      initialDebt: initialDebtVal,
      balance: initialDebtVal
    });

    setNewCustName('');
    setNewCustPhone('');
    setNewCustInitialDebt(0);
    setNewCustCreditLimit('');
    setNewCustDueDate('');
    setNewCustNotes('');
    setAddError('');
    setShowAddModal(false);
    soundManager.playSuccessChime();
  };

  // Handle paying off debt
  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setPayError('⚠️ الرجاء اختيار العميل المسدد أولاً!');
      soundManager.playWarningBeep();
      return;
    }

    const debtor = activeCustomers.find(c => c.id === selectedCustomerId);
    if (!debtor) return;

    if (payAmount <= 0) {
      setPayError('⚠️ الرجاء إدخال مبلغ سداد صحيح أكبر من الصفر!');
      soundManager.playWarningBeep();
      return;
    }

    if (payAmount > debtor.totalDebt) {
      setPayError(`⚠️ عذراً، المبلغ المدخل (${payAmount.toLocaleString()}) أكبر من مديونية العميل الكلية (${debtor.totalDebt.toLocaleString()} ${currency})!`);
      soundManager.playWarningBeep();
      return;
    }

    onPayDebt(selectedCustomerId, payAmount, payNote.trim() || 'دفعة لتسديد الحساب', payPaymentMethod, payRefNumber.trim() || undefined);

    setPayAmount(0);
    setPayNote('');
    setPayPaymentMethod('cash');
    setPayRefNumber('');
    setSelectedCustomerId('');
    setPayError('');
    setShowPaymentModal(false);
    soundManager.playSuccessChime();
  };

  // Filter customers for display
  const filteredCustomers = activeCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
    let matchesFilter = true;
    if (filterType === 'debtors') {
      matchesFilter = c.totalDebt > 0;
    } else if (filterType === 'overdue') {
      matchesFilter = c.totalDebt > 0 && Boolean(c.debtDueDate && c.debtDueDate < todayStr);
    }
    return matchesSearch && matchesFilter;
  });

  // Get Avatar Initials
  const getAvatarInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + ' ' + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Export Customers list to CSV
  const handleExportCustomersCSV = async () => {
    soundManager.playSuccessChime();
    let csvData = '\uFEFF';
    csvData += 'اسم العميل,رقم الهاتف,إجمالي المديونية,سقف الائتمان,تاريخ الاستحقاق,نقاط الولاء,الملاحظات\n';
    activeCustomers.forEach(c => {
      csvData += `"${(c.name || '').replace(/"/g, '""')}","${c.phone || ''}",${c.totalDebt || 0},${c.creditLimit || 0},"${c.debtDueDate || ''}",${c.loyaltyPoints || 0},"${(c.notes || '').replace(/"/g, '""')}"\n`;
    });

    const fileName = `عملاء_سند_${new Date().toISOString().split('T')[0]}.csv`;
    await saveAndShareFile({
      fileName,
      data: csvData,
      mimeType: 'text/csv;charset=utf-8',
      title: 'قائمة العملاء والديون',
      text: 'تصدير قائمة العملاء والديون من تطبيق سند المحاسبي'
    });
  };

  // Export Customers & Debts to Excel (.xlsx) ككشف مديونيات مفصل
  const handleExportCustomersExcel = async () => {
    soundManager.playSuccessChime();
    const listToExport = filteredCustomers.length > 0 ? filteredCustomers : activeCustomers;
    const totalDebtSum = listToExport.reduce((acc, c) => acc + (c.totalDebt || 0), 0);
    const totalCreditLimit = listToExport.reduce((acc, c) => acc + (c.creditLimit || 0), 0);

    const data: Record<string, string | number>[] = listToExport.map((c, index) => ({
      'م': index + 1,
      'اسم العميل / الجهة': c.name || '',
      'رقم الهاتف': c.phone || 'بدون هاتف',
      'إجمالي المديونية الحالية': c.totalDebt || 0,
      'سقف الائتمان': c.creditLimit || 0,
      'تاريخ الاستحقاق': c.debtDueDate ? new Date(c.debtDueDate).toLocaleDateString('ar-YE') : 'غير محدد',
      'نقاط الولاء': c.loyaltyPoints || 0,
      'حالة السداد': (c.totalDebt || 0) <= 0 ? 'مستوفي بالكامل ✅' : 'عليه مديونية قائمة ⏳',
      'الملاحظات': c.notes || ''
    }));

    // إضافة صف الإجمالي في نهاية الكشف
    data.push({
      'م': 'الإجمالي الكلي',
      'اسم العميل / الجهة': `إجمالي العملاء: ${listToExport.length} عميل`,
      'رقم الهاتف': '-',
      'إجمالي المديونية الحالية': totalDebtSum,
      'سقف الائتمان': totalCreditLimit,
      'تاريخ الاستحقاق': '-',
      'نقاط الولاء': '-',
      'حالة السداد': 'كشف معتمد',
      'الملاحظات': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },  // م
      { wch: 28 }, // اسم العميل
      { wch: 18 }, // رقم الهاتف
      { wch: 22 }, // إجمالي المديونية
      { wch: 18 }, // سقف الائتمان
      { wch: 18 }, // تاريخ الاستحقاق
      { wch: 14 }, // نقاط الولاء
      { wch: 22 }, // حالة السداد
      { wch: 30 }  // الملاحظات
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'كشف مديونيات العملاء');

    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const fileName = `كشف_مديونيات_العملاء_${new Date().toISOString().split('T')[0]}.xlsx`;

    await saveAndShareFile({
      fileName,
      data: excelBase64,
      isBase64: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'كشف مديونيات العملاء Excel',
      text: `كشف مديونيات وحسابات العملاء (${listToExport.length} عميل، إجمالي ديون: ${totalDebtSum.toLocaleString()} ${currency})`
    });
  };

  // Export Customers & Debts to PDF ككشف رسمي
  const handleExportCustomersPDF = async () => {
    soundManager.playScanBeep();

    const listToExport = filteredCustomers.length > 0 ? filteredCustomers : activeCustomers;
    const totalDebtSum = listToExport.reduce((acc, c) => acc + (c.totalDebt || 0), 0);
    const debtorsCount = listToExport.filter(c => (c.totalDebt || 0) > 0).length;

    const customColumns = [
      { key: 'index', label: 'م', width: '40px', align: 'center' as const },
      { key: 'name', label: 'اسم العميل / الحساب', align: 'right' as const },
      { key: 'phone', label: 'رقم الهاتف', width: '110px', align: 'center' as const },
      { key: 'totalDebt', label: 'المديونية القائمة', width: '120px', align: 'center' as const },
      { key: 'creditLimit', label: 'سقف الائتمان', width: '100px', align: 'center' as const },
      { key: 'dueDate', label: 'تاريخ الاستحقاق', width: '105px', align: 'center' as const },
      { key: 'status', label: 'حالة الحساب', width: '100px', align: 'center' as const }
    ];

    const customRows: Record<string, string | number>[] = listToExport.map((c, idx) => {
      const debt = c.totalDebt || 0;
      const status = debt <= 0 ? '✅ مستوفي' : debt > (c.creditLimit || 99999999) ? '⚠️ تجاوز السقف' : '⏳ مدين';
      return {
        index: idx + 1,
        name: c.name || 'عميل بدون اسم',
        phone: c.phone || '-',
        totalDebt: `${debt.toLocaleString()} ${currency}`,
        creditLimit: `${(c.creditLimit || 0).toLocaleString()} ${currency}`,
        dueDate: c.debtDueDate ? new Date(c.debtDueDate).toLocaleDateString('ar-YE') : 'غير محدد',
        status
      };
    });

    // إضافة صف الإجمالي في ذيل الجدول
    customRows.push({
      index: 'الإجمالي',
      name: `إجمالي العملاء: ${listToExport.length} عميل`,
      phone: `المدينون: ${debtorsCount}`,
      totalDebt: `${totalDebtSum.toLocaleString()} ${currency}`,
      creditLimit: '—',
      dueDate: '—',
      status: debtorsCount > 0 ? '⏳ بحاجة تحصيل' : '✅ مسدد بالكامل'
    });

    const summaryBoxes = [
      { label: 'إجمالي المسجلين', value: `${listToExport.length} عميل`, color: '#0284c7', bg: '#f0f9ff' },
      { label: 'العملاء المدينون', value: `${debtorsCount} عميل`, color: '#d97706', bg: '#fffbeb' },
      { label: 'إجمالي مبالغ الديون', value: `${totalDebtSum.toLocaleString()} ${currency}`, color: '#dc2626', bg: '#fef2f2' },
      { label: 'تاريخ المطابقة', value: new Date().toLocaleDateString('ar-YE'), color: '#475569', bg: '#f8fafc' }
    ];

    try {
      await generateAndSharePDF({
        title: 'كشف مديونيات وحسابات العملاء',
        storeName: storeName || 'سند المحاسبي',
        invoiceNumber: `ديون-${new Date().toISOString().slice(0, 10)}`,
        customerName: 'إدارة الائتمان والتحصيل المالي',
        phone: '',
        date: new Date().toLocaleDateString('ar-YE') + ' ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: `كشف محاسبي بمديونيات العملاء والأرصدة القائمة`,
        orientation: 'p',
        customColumns,
        customRows,
        summaryBoxes,
        subtotal: `إجمالي الديون: ${totalDebtSum.toLocaleString()} ${currency}`,
        discount: '0',
        totalAmount: `${totalDebtSum.toLocaleString()} ${currency}`,
        notes: `كشف مديونيات معتمد رسمي موثق بحسابات العملاء حتى تاريخه. يرجى المتابعة والتحصيل وفق التواريخ المحددة.`,
        footerNote: '✨ كشف الحسابات والمديونيات المعتمد - تطبيق سند المحاسبي'
      });
    } catch (e) {
      console.error('Customer PDF Export Failed:', e);
    }
  };

  return (
    <div id="customers_tab_view" className="space-y-3.5 md:space-y-6 pb-20 md:pb-28">
      
      {/* 1. TOP STATISTICAL SUMMARY BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
        
        {/* Card 1: Total Debts */}
        <div className="p-2.5 sm:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">إجمالي الديون والذمم</span>
            <h3 className="text-lg font-black text-rose-600 mt-1 dir-ltr text-right">
              {fmtAmount(totalDebts)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">مبالغ مسجلة بالدفتر للتحصيل</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Debtor Customers Count */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">عدد العملاء المدينين</span>
            <h3 className="text-lg font-black text-amber-600 mt-1">
              {debtorCustomers.length} <span className="text-xs font-normal text-slate-400">عميل</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">من أصل {activeCustomers.length} عميل في الدفتر</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Overdue Debts Count */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">ديون متأخرة عن الاستحقاق</span>
            <h3 className="text-lg font-black text-purple-600 mt-1">
              {overdueCustomers.length} <span className="text-xs font-normal text-slate-400">عميل متأخر</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">تجاوزوا تاريخ السداد المتفق عليه</p>
          </div>
          <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Highest Debtor */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">أعلى مديونية لعميل</span>
            <h3 className="text-sm font-black text-blue-600 mt-1 truncate max-w-[120px]">
              {highestDebtor ? highestDebtor.name : 'لا يوجد'}
            </h3>
            <p className="text-xs font-bold text-rose-600 font-mono mt-0.5">
              {highestDebtor ? fmtAmount(highestDebtor.totalDebt) : '0 ' + currency}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Award className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* 2. MAIN LAYOUT: Full Width Customer Directory & Top Actions */}
      <div className="space-y-4 md:space-y-6">
        
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3.5">
          
          {/* Header Title & Primary Action Buttons */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                دليل كروت وحسابات العملاء والديون
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">إجمالي العملاء المعتمدين: {activeCustomers.length} عميل</p>
            </div>

            {/* Main Primary Action Buttons Grid */}
            <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
              <button
                id="btn_add_customer_main"
                onClick={() => {
                  soundManager.playScanBeep();
                  setShowAddModal(true);
                }}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span className="truncate">إضافة عميل</span>
              </button>

              <button
                id="btn_pay_debt_main"
                onClick={() => {
                  soundManager.playScanBeep();
                  setShowPaymentModal(true);
                }}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span className="truncate">سند قبض تسديد</span>
              </button>
            </div>
          </div>

          {/* Search Input Bar with Quick Clear */}
          <div className="relative">
            <input
              id="customer_ledger_search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم العميل أو رقم الهاتف للوصول السريع..."
              className="w-full pr-10 pl-9 py-2 sm:py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition shadow-xs"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Chips & View Mode Switcher */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 pt-1">
            {/* Filter Pills */}
            <div className="flex bg-slate-100 p-1 border border-slate-200 rounded-xl text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-none gap-1">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-lg transition shrink-0 ${
                  filterType === 'all' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                الكل ({activeCustomers.length})
              </button>
              <button
                onClick={() => setFilterType('debtors')}
                className={`px-3 py-1 rounded-lg transition shrink-0 ${
                  filterType === 'debtors' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                المدينون ({debtorCustomers.length})
              </button>
              <button
                onClick={() => setFilterType('overdue')}
                className={`px-3 py-1 rounded-lg transition shrink-0 ${
                  filterType === 'overdue' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                المتأخرون ⚠️ ({overdueCustomers.length})
              </button>
            </div>

            {/* View Mode Switcher & Column Picker */}
            <div className="flex items-center justify-end gap-1.5 self-end sm:self-auto">
              <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs font-bold">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    viewMode === 'cards' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  كروت 📇
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    viewMode === 'table' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  جدول 📋
                </button>
              </div>

              {/* Column Picker Button for Table View */}
              {viewMode === 'table' && (
                <div className="relative">
                  <button
                    onClick={() => setShowColumnPicker(!showColumnPicker)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                    title="تحديد وإخفاء/إظهار أعمدة الجدول"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                    <span>الأعمدة</span>
                  </button>

                  {showColumnPicker && (
                    <div className="absolute left-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-30 text-xs space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-800">الأعمدة الظاهرة:</span>
                        <button 
                          onClick={() => setShowColumnPicker(false)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {[
                          { key: 'name', label: 'العميل' },
                          { key: 'phone', label: 'رقم الهاتف' },
                          { key: 'debtDueDate', label: 'تاريخ الاستحقاق' },
                          { key: 'totalDebt', label: 'الرصيد / الدين' },
                          { key: 'loyaltyPoints', label: 'نقاط الولاء' },
                          { key: 'actions', label: 'إجراءات والتعديل' },
                        ].map(col => (
                          <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition">
                            <input
                              type="checkbox"
                              checked={visibleColumns[col.key as keyof typeof visibleColumns]}
                              onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col.key]: e.target.checked }))}
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
          </div>

          {/* Unified Compact Export & Counter Toolbar Row */}
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleExportCustomersPDF}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="تصدير طباعة كشف مديونية العملاء PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>كشف PDF</span>
              </button>

              <button
                onClick={handleExportCustomersExcel}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="تصدير جدول مديونية العملاء Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>إكسل Excel</span>
              </button>

              <button
                onClick={handleExportCustomersCSV}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="تصدير ملف CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>CSV</span>
              </button>
            </div>

            <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
              {filteredCustomers.length} عميل معروض
            </span>
          </div>

            {/* Content Display: Cards vs Table */}
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                {filteredCustomers.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                    لم يتم العثور على عملاء يطابقون خيارات البحث.
                  </div>
                ) : (
                  filteredCustomers.map(customer => {
                    const isOverdue = Boolean(customer.debtDueDate && customer.debtDueDate < todayStr && customer.totalDebt > 0);

                    return (
                      <div 
                        key={customer.id} 
                        className={`p-4 rounded-2xl bg-white hover:bg-slate-50/80 border transition-all shadow-sm space-y-3 flex flex-col justify-between ${
                          isOverdue ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200'
                        }`}
                      >
                        {/* Top Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                              {getAvatarInitials(customer.name)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-bold text-slate-900 text-xs">{customer.name}</h4>
                                {(customer.loyaltyPoints || 0) > 0 && (
                                  <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded-md border border-purple-200">
                                    🎖️ {customer.loyaltyPoints}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5 dir-ltr justify-end">
                                <Phone className="w-3 h-3 text-slate-400" /> {customer.phone}
                              </p>
                            </div>
                          </div>

                          {/* Action Icon Buttons: Edit & Soft Delete */}
                          <div className="flex items-center gap-1">
                            
                            {/* EDIT BUTTON (تعديل بيانات العميل) */}
                            <button
                              onClick={() => {
                                soundManager.playScanBeep();
                                setEditingCustomer(customer);
                              }}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              title="تعديل بيانات العميل وتاريخ الاستحقاق"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* STATEMENT BUTTON (كشف الحساب) */}
                            <button
                              onClick={() => {
                                soundManager.playScanBeep();
                                setStatementCustomer(customer);
                              }}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                              title="كشف حساب عميل مفصل وطباعة PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* SOFT DELETE BUTTON */}
                            <button
                              onClick={() => {
                                if (customer.totalDebt > 0) {
                                  soundManager.playWarningBeep();
                                  alert('⚠️ لا يمكن حذف حساب العميل وهو يحمل مديونية نشطة! قم بتسديد مديونيته أولاً.');
                                  return;
                                }
                                if (confirm(`هل أنت متأكد من رغبتك في نقل العميل "${customer.name}" لأرشيف الحذف الآمن؟`)) {
                                  soundManager.playWarningBeep();
                                  onDeleteCustomer(customer.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="حذف آمن للعميل"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>
                        </div>

                        {/* Debt Status & Due Date Info */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-medium">حالة المديونية:</span>
                            {customer.totalDebt > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-200">
                                <span>مدين بـ:</span> {fmtAmount(customer.totalDebt)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                ✓ حساب نظيف (0)
                              </span>
                            )}
                          </div>

                          {/* Credit Limit Badge */}
                          {customer.creditLimit !== undefined && customer.creditLimit > 0 && (
                            <div className="flex items-center justify-between text-[10px] pt-1">
                              <span className="text-slate-400 font-sans flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-slate-400" />
                                <span>سقف الدين (حد الإئتمان):</span>
                              </span>
                              {customer.totalDebt >= customer.creditLimit ? (
                                <span className="font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white flex items-center gap-1">
                                  <span>⚠️ {customer.creditLimit.toLocaleString()} {currency}</span>
                                  <span className="bg-rose-950/40 px-1 rounded text-[9px]">تجاوز الحد</span>
                                </span>
                              ) : (
                                <span className="font-mono font-bold text-slate-700 px-1.5 py-0.5 rounded bg-slate-100">
                                  {customer.creditLimit.toLocaleString()} {currency}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Debt Due Date Badge */}
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-slate-400 font-sans flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>تاريخ الاستحقاق:</span>
                            </span>
                            {customer.debtDueDate && !isNaN(new Date(customer.debtDueDate).getTime()) ? (
                              <span className={`font-bold px-1.5 py-0.5 rounded ${
                                isOverdue ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {new Date(customer.debtDueDate).toLocaleDateString('ar-YE')} {isOverdue ? '(متأخر)' : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-sans">غير محدد</span>
                            )}
                          </div>
                        </div>

                        {/* Direct Mobile Share & Reminder Action Bar */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          
                          {/* Account Statement Button */}
                          <button
                            onClick={() => {
                              soundManager.playScanBeep();
                              setStatementCustomer(customer);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            <span>كشف الحساب</span>
                          </button>

                          {/* Direct Mobile Reminder Tools */}
                          {customer.totalDebt > 0 && (
                            <button
                              onClick={() => {
                                soundManager.playScanBeep();
                                setReminderCustomer(customer);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                              title="فتح أدوات التذكير المباشرة للهاتف (واتساب / SMS / مشاركة)"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>تذكير ومشاركة 📱</span>
                            </button>
                          )}

                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold">
                      {visibleColumns.name && <th className="pb-3 pr-2">العميل</th>}
                      {visibleColumns.phone && <th className="pb-3 text-center">رقم الهاتف</th>}
                      {visibleColumns.debtDueDate && <th className="pb-3 text-center">الاستحقاق</th>}
                      {visibleColumns.totalDebt && <th className="pb-3 text-center">الرصيد / الدين</th>}
                      {visibleColumns.loyaltyPoints && <th className="pb-3 text-center">نقاط الولاء</th>}
                      {visibleColumns.actions && <th className="pb-3 pl-2 text-left">إجراءات والتعديل</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={Object.values(visibleColumns).filter(Boolean).length || 1} className="py-8 text-center text-slate-400">
                          لم يتم العثور على عملاء.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map(customer => (
                        <tr key={customer.id} className="hover:bg-slate-50">
                          {visibleColumns.name && (
                            <td className="py-3 pr-2 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>{customer.name}</span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.phone && (
                            <td className="py-3 text-center font-mono text-slate-500">
                              {customer.phone}
                            </td>
                          )}
                          {visibleColumns.debtDueDate && (
                            <td className="py-3 text-center font-mono text-[11px] text-slate-600">
                              {customer.debtDueDate ? new Date(customer.debtDueDate).toLocaleDateString('ar-YE') : '-'}
                            </td>
                          )}
                          {visibleColumns.totalDebt && (
                            <td className={`py-3 text-center font-mono font-bold ${
                              customer.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}>
                              {fmtAmount(customer.totalDebt)}
                            </td>
                          )}
                          {visibleColumns.loyaltyPoints && (
                            <td className="py-3 text-center font-mono text-slate-600">
                              {(customer.loyaltyPoints || 0) > 0 ? (
                                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                                  🎖️ {customer.loyaltyPoints}
                                </span>
                              ) : '-'}
                            </td>
                          )}
                          {visibleColumns.actions && (
                            <td className="py-3 pl-2 text-left flex justify-end gap-1">
                              {/* Edit Button */}
                              <button
                                onClick={() => {
                                  soundManager.playScanBeep();
                                  setEditingCustomer(customer);
                                }}
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                                title="تعديل العميل"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Statement Button */}
                              <button
                                onClick={() => {
                                  soundManager.playScanBeep();
                                  setStatementCustomer(customer);
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                                title="كشف الحساب"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>

                              {/* Reminder Modal Button */}
                              {customer.totalDebt > 0 && (
                                <button
                                  onClick={() => {
                                    soundManager.playScanBeep();
                                    setReminderCustomer(customer);
                                  }}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition font-bold text-[10px] flex items-center gap-1"
                                >
                                  <Send className="w-3.5 h-3.5" /> تذكير
                                </button>
                              )}

                              {/* Delete Button */}
                              <button
                                onClick={() => {
                                  if (customer.totalDebt > 0) {
                                    soundManager.playWarningBeep();
                                    alert('⚠️ لا يمكن حذف حساب العميل وهو يحمل مديونية نشطة!');
                                    return;
                                  }
                                  onDeleteCustomer(customer.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* Payments Received History Log */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              سجل تحصيلات وسندات المقبوضات الأخيرة
            </h3>

            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {payments.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  لا توجد أي دفعة محصلة مسجلة بعد.
                </div>
              ) : (
                [...payments].reverse().map(pay => (
                  <div key={pay.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-900">العميل: {pay.customerName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{pay.note}</div>
                    </div>
                    <div className="text-left font-mono">
                      <span className="font-black text-emerald-600">+{pay.amount.toLocaleString()} {currency}</span>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {new Date(pay.date).toLocaleDateString('ar-YE')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      {/* MODAL 1: Edit Customer Modal */}
      {editingCustomer && (
        <CustomerEditModal
          isOpen={Boolean(editingCustomer)}
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSave={(updated) => {
            if (onUpdateCustomer) {
              onUpdateCustomer(updated);
            }
          }}
          currency={currency}
        />
      )}

      {/* MODAL 2: Dynamic Debt Reminder Modal (WhatsApp / SMS / Phone Share) */}
      {reminderCustomer && (
        <CustomerReminderModal
          isOpen={Boolean(reminderCustomer)}
          customer={reminderCustomer}
          onClose={() => setReminderCustomer(null)}
          currency={currency}
          storeName={storeName}
          initialTemplate={debtReminderTemplate}
          onSaveTemplate={onSaveReminderTemplate}
        />
      )}

      {/* BOTTOM SHEET MODAL 1: ADD NEW CUSTOMER */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
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
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">تسجيل عميل جديد بالدفتر</h3>
                    <p className="text-[11px] text-slate-400">إضافة حساب جديد وتحديد تاريخ استحقاق الدين</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {addError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {addError}
                </div>
              )}

              <form onSubmit={handleAddSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">اسم العميل الثلاثي:</label>
                  <input
                    id="new_cust_name"
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="مثال: عبدالمجيد المحواشي..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">رقم الهاتف:</label>
                    <input
                      id="new_cust_phone"
                      type="tel"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                      placeholder="77XXXXXXX"
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-3.5 py-2 text-slate-900 placeholder-slate-400 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">تاريخ الاستحقاق:</label>
                    <input
                      type="date"
                      value={newCustDueDate}
                      onChange={(e) => setNewCustDueDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="space-y-1 bg-amber-50/70 border border-amber-200 p-3 rounded-2xl">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-amber-600" />
                      <span>الرصيد الافتتاحي / الدين السابق ({currency}):</span>
                    </span>
                  </label>
                  <input
                    id="new_cust_initial_debt"
                    type="number"
                    min="0"
                    step="any"
                    value={newCustInitialDebt || ''}
                    onChange={(e) => setNewCustInitialDebt(parseFloat(e.target.value) || 0)}
                    placeholder="0 (أدخل الدين السابق إن وجد)"
                    className="w-full bg-white border border-amber-300 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                  />
                  <p className="text-[10px] text-slate-500">سيتم تسجيل هذا المبلغ كمديونية أولية سابقة على العميل فور الحفظ</p>
                </div>

                <div className="space-y-1 bg-rose-50/60 border border-rose-200 p-3 rounded-2xl">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                      <span>سقف الدين / حد الإئتمان المسموح ({currency}):</span>
                    </span>
                  </label>
                  <input
                    id="new_cust_credit_limit"
                    type="number"
                    min="0"
                    step="any"
                    value={newCustCreditLimit}
                    onChange={(e) => setNewCustCreditLimit(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    placeholder="مثال: 50000 (أترك فارغاً لفتح الدين بدون سقف)"
                    className="w-full bg-white border border-rose-300 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                  />
                  <p className="text-[10px] text-slate-500">حد إئتماني أقصى. سيتم إيقاف وحظر المبيعات الآجلة للعميل فور تجاوزه</p>
                </div>

                <button
                  id="submit_new_customer_btn"
                  type="submit"
                  className="w-full py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>حفظ وتثبيت الحساب الجديد</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BOTTOM SHEET MODAL 2: PAYMENT RECEIPT */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaymentModal(false)}
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
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">سند قبض نقدية (تسديد دين)</h3>
                    <p className="text-[11px] text-slate-400">تنزيل مديونية عميل نقدياً في الصندوق</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {payError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {payError}
                </div>
              )}

              <form onSubmit={handlePaySubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">اختر العميل المدين:</label>
                  <select
                    id="pay_debt_customer_select"
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      const debtor = activeCustomers.find(c => c.id === e.target.value);
                      setPayAmount(debtor ? debtor.totalDebt : 0);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  >
                    <option value="">-- اختر عميلاً للتسديد --</option>
                    {debtorCustomers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (مدين بـ: {c.totalDebt.toLocaleString()} {currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">المبلغ المسلم للتنزيل:</label>
                  <input
                    id="pay_debt_amount_input"
                    type="number"
                    min="1"
                    required
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="مثال: 50000"
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">طريقة الدفع وسند التسليم:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).filter(k => k !== 'debt').map((methodKey) => {
                      const method = PAYMENT_METHODS[methodKey];
                      const isSelected = payPaymentMethod === methodKey;
                      return (
                        <button
                          key={methodKey}
                          type="button"
                          onClick={() => {
                            soundManager.playScanBeep();
                            setPayPaymentMethod(methodKey);
                          }}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 justify-center cursor-pointer ${
                            isSelected
                              ? `${method.bgLightClass} ${method.colorClass} ${method.borderClass} ring-2 ring-emerald-500 shadow-sm font-black`
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

                {payPaymentMethod !== 'cash' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">رقم الحوالة / السند / الإشعار:</label>
                    <input
                      type="text"
                      value={payRefNumber}
                      onChange={(e) => setPayRefNumber(e.target.value)}
                      placeholder="مثال: #88741..."
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-mono font-bold rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">ملاحظات أو بيان السند:</label>
                  <input
                    id="pay_debt_note_input"
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="مثال: تسديد دفعة من الحساب..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <button
                  id="submit_pay_debt_btn"
                  type="submit"
                  className="w-full py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ترحيل سند المقبوضات وتنزيل الدين</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Detailed Customer Account Statement & Print PDF */}
      {statementCustomer && (
        <CustomerStatementModal
          isOpen={Boolean(statementCustomer)}
          customer={statementCustomer}
          invoices={invoices}
          payments={payments}
          onClose={() => setStatementCustomer(null)}
          currency={currency}
          storeName={storeName}
          storeLogoUrl={storeLogoUrl}
          isPrivacyMode={isPrivacyMode}
        />
      )}

    </div>
  );
}
