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
  Plus
} from 'lucide-react';
import { Customer, Payment, Invoice } from '../types';
import { soundManager } from '../utils/sound';
import CustomerEditModal from './CustomerEditModal';
import CustomerReminderModal from './CustomerReminderModal';
import CustomerStatementModal from './CustomerStatementModal';

interface CustomersProps {
  customers: Customer[];
  payments: Payment[];
  invoices?: Invoice[];
  onAddCustomer: (customer: Omit<Customer, 'id' | 'totalDebt' | 'createdAt'>) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onPayDebt: (customerId: string, amount: number, note: string) => void;
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

  // New Customer Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustDueDate, setNewCustDueDate] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [addError, setAddError] = useState('');

  // Debt Payment States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNote, setPayNote] = useState('');
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

    onAddCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim() || 'بدون هاتف',
      debtDueDate: newCustDueDate || undefined,
      notes: newCustNotes.trim(),
      loyaltyPoints: 0
    });

    setNewCustName('');
    setNewCustPhone('');
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

    onPayDebt(selectedCustomerId, payAmount, payNote.trim() || 'دفعة نقدية لتسديد الحساب');

    setPayAmount(0);
    setPayNote('');
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
      <div className="space-y-6">
        
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          
          {/* Header & Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">دليل كروت وحسابات العملاء</h3>
              <p className="text-xs text-slate-400">مجموع الحسابات المعتمدة: {activeCustomers.length} عميل</p>
            </div>

            {/* Action Buttons: Add Customer & Pay Debt */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  soundManager.playScanBeep();
                  setShowAddModal(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة عميل جديد</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playScanBeep();
                  setShowPaymentModal(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>سند قبض تسديد</span>
              </button>

              <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-none gap-1 max-w-full">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg transition shrink-0 ${
                    filterType === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setFilterType('debtors')}
                  className={`px-2.5 py-1 rounded-lg transition shrink-0 ${
                    filterType === 'debtors' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  المدينون
                </button>
                <button
                  onClick={() => setFilterType('overdue')}
                  className={`px-2.5 py-1 rounded-lg transition shrink-0 ${
                    filterType === 'overdue' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  المتأخرون ⚠️
                </button>
              </div>

              <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs font-bold">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    viewMode === 'cards' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  كروت 📇
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  جدول 📋
                </button>
              </div>
            </div>
          </div>

          {/* Search Input */}
            <div className="relative">
              <input
                id="customer_ledger_search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم العميل أو رقم الهاتف للوصول السريع..."
                className="w-full pr-10 pl-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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

                          {/* Debt Due Date Badge */}
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-slate-400 font-sans flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>تاريخ الاستحقاق:</span>
                            </span>
                            {customer.debtDueDate ? (
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
                      <th className="pb-3 pr-2">العميل</th>
                      <th className="pb-3 text-center">رقم الهاتف</th>
                      <th className="pb-3 text-center">الاستحقاق</th>
                      <th className="pb-3 text-center">الرصيد / الدين</th>
                      <th className="pb-3 pl-2 text-left">إجراءات والتعديل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          لم يتم العثور على عملاء.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map(customer => (
                        <tr key={customer.id} className="hover:bg-slate-50">
                          <td className="py-3 pr-2 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{customer.name}</span>
                              {(customer.loyaltyPoints || 0) > 0 && (
                                <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded">🎖️ {customer.loyaltyPoints}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-center font-mono text-slate-500">
                            {customer.phone}
                          </td>
                          <td className="py-3 text-center font-mono text-[11px] text-slate-600">
                            {customer.debtDueDate ? new Date(customer.debtDueDate).toLocaleDateString('ar-YE') : '-'}
                          </td>
                          <td className={`py-3 text-center font-mono font-bold ${
                            customer.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {fmtAmount(customer.totalDebt)}
                          </td>
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

      {/* FLOATING ACTION BUTTON (FAB) FOR MOBILE & QUICK ACCESS */}
      <motion.div 
        drag
        dragMomentum={false}
        whileDrag={{ scale: 1.1 }}
        className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 touch-none cursor-grab active:cursor-grabbing"
      >
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setShowAddModal(true);
          }}
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-2xl flex items-center justify-center transition cursor-pointer border-2 border-white dark:border-slate-800"
          title="إضافة عميل جديد (يمكنك سحبه وتحريكه)"
        >
          <UserPlus className="w-6 h-6" />
        </button>
      </motion.div>

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
                  <label className="text-xs font-bold text-slate-700">المبلغ المسلم نقدياً للتنزيل:</label>
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
                  <label className="text-xs font-bold text-slate-700">ملاحظات أو رقم السند:</label>
                  <input
                    id="pay_debt_note_input"
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="مثال: تسديد جزئي نقدياً لصيانة الشاشات..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <button
                  id="submit_pay_debt_btn"
                  type="submit"
                  className="w-full py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ترحيل سند المقبوضات نقدياً</span>
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
