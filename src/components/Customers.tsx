/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  Send
} from 'lucide-react';
import { Customer, Payment } from '../types';
import { soundManager } from '../utils/sound';

interface CustomersProps {
  customers: Customer[];
  payments: Payment[];
  onAddCustomer: (customer: Omit<Customer, 'id' | 'totalDebt' | 'createdAt'>) => void;
  onPayDebt: (customerId: string, amount: number, note: string) => void;
  onDeleteCustomer: (customerId: string) => void;
  currency: string;
}

export default function Customers({
  customers,
  payments,
  onAddCustomer,
  onPayDebt,
  onDeleteCustomer,
  currency
}: CustomersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debtors'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // New Customer Form States
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [addError, setAddError] = useState('');

  // Debt Payment States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState('');

  // Filter out soft-deleted customers
  const activeCustomers = customers.filter(c => c.isDeleted !== true && c.isActive !== false);

  // Statistics Calculations
  const totalDebts = activeCustomers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
  const debtorCustomers = activeCustomers.filter(c => c.totalDebt > 0);
  const highestDebtor = [...debtorCustomers].sort((a, b) => b.totalDebt - a.totalDebt)[0];

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
      phone: newCustPhone.trim() || 'بدون هاتف'
    });

    setNewCustName('');
    setNewCustPhone('');
    setAddError('');
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
    soundManager.playSuccessChime();
  };

  // Generate WhatsApp debt collection message link
  const getWhatsAppLink = (customer: Customer) => {
    const text = `السلام عليكم ورحمة الله وبركاته يا أخي العزيز *${customer.name}*.\nنحيطكم علماً بأن رصيد مديونيتكم المتبقي والمستحق لدينا في *نظام سند المحاسبي* هو: *${customer.totalDebt.toLocaleString()} ${currency}*.\nشاكرين ومقدرين لكم كريم تعاونكم وثقتكم بنا.`;
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('77') || cleanPhone.startsWith('73') || cleanPhone.startsWith('71') || cleanPhone.startsWith('70') 
      ? '967' + cleanPhone
      : cleanPhone;

    return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(text)}`;
  };

  // Filter customers for display
  const filteredCustomers = activeCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
    const matchesFilter = filterType === 'all' || c.totalDebt > 0;
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
    <div id="customers_tab_view" className="space-y-6">
      
      {/* 1. TOP STATISTICAL SUMMARY BAR (Light Modern Theme) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Total Debts */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">إجمالي الديون والذمم المستحقة</span>
            <h3 className="text-xl font-black text-rose-600 mt-1 dir-ltr text-right">
              {totalDebts.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">مبالغ مسجلة بالدفتر للتحصيل المباشر</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Debtor Customers Count */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">عدد العملاء المدينين</span>
            <h3 className="text-xl font-black text-amber-600 mt-1">
              {debtorCustomers.length} <span className="text-xs font-normal text-slate-400">عميل مدين</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">من أصل {activeCustomers.length} عميل في السجل</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Highest Debtor */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">أعلى مديونية لعميل واحد</span>
            <h3 className="text-base font-black text-blue-600 mt-1">
              {highestDebtor ? highestDebtor.name : 'لا يوجد'}
            </h3>
            <p className="text-xs font-bold text-rose-600 font-mono mt-0.5">
              {highestDebtor ? `${highestDebtor.totalDebt.toLocaleString()} ${currency}` : '0 ' + currency}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Award className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* 2. MAIN LAYOUT: Forms (Left) & Customer Directory (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: New Customer Form + Payment Receipt (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Form 1: New Customer Registration Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">تسجيل عميل جديد بالدفتر</h3>
                <p className="text-[11px] text-slate-400">إضافة حساب جديد للآجل والتحصيل</p>
              </div>
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

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">رقم الهاتف للاتصال / واتساب:</label>
                <input
                  id="new_cust_phone"
                  type="tel"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="77XXXXXXX"
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
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
          </div>

          {/* Form 2: Payment Receipt (سند قبض نقدية) Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">سند قبض نقدية (تسديد دين)</h3>
                <p className="text-[11px] text-slate-400">تنزيل مديونية عميل نقدياً في الصندوق</p>
              </div>
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
          </div>

        </div>

        {/* RIGHT COLUMN: Interactive Customer Ledger Directory (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">دليل سجل وحسابات العملاء</h3>
                <p className="text-xs text-slate-400">مجموع الحسابات المعتمدة: {activeCustomers.length} عميل</p>
              </div>

              {/* View Switcher & Quick Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs font-bold">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 rounded-lg transition ${
                      filterType === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setFilterType('debtors')}
                    className={`px-3 py-1 rounded-lg transition ${
                      filterType === 'debtors' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    المدينون فقط
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredCustomers.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                    لم يتم العثور على عملاء يطابقون خيارات البحث.
                  </div>
                ) : (
                  filteredCustomers.map(customer => (
                    <div 
                      key={customer.id} 
                      className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all shadow-sm space-y-3 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {getAvatarInitials(customer.name)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{customer.name}</h4>
                            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5 dir-ltr justify-end">
                              <Phone className="w-3 h-3 text-slate-400" /> {customer.phone}
                            </p>
                          </div>
                        </div>

                        {/* Soft Delete Action */}
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
                          title="حذف العميل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Debt Status Pill */}
                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">حالة الحساب المالية:</span>
                          {customer.totalDebt > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-200">
                              <span>مدين بـ:</span> {customer.totalDebt.toLocaleString()} {currency}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              ✓ حساب نظيف (0)
                            </span>
                          )}
                        </div>

                        {/* Direct WhatsApp Reminder Button */}
                        {customer.totalDebt > 0 && (
                          <a
                            href={getWhatsAppLink(customer)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => soundManager.playScanBeep()}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                            title="إرسال تذكير مباشر بالدين عبر واتساب"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>تذكير واتساب</span>
                          </a>
                        )}
                      </div>

                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold">
                      <th className="pb-3 pr-2">العميل</th>
                      <th className="pb-3 text-center">رقم الهاتف</th>
                      <th className="pb-3 text-center">الرصيد / الدين</th>
                      <th className="pb-3 pl-2 text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          لم يتم العثور على عملاء.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map(customer => (
                        <tr key={customer.id} className="hover:bg-slate-50">
                          <td className="py-3 pr-2 font-bold text-slate-900">
                            {customer.name}
                          </td>
                          <td className="py-3 text-center font-mono text-slate-500">
                            {customer.phone}
                          </td>
                          <td className={`py-3 text-center font-mono font-bold ${
                            customer.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {customer.totalDebt.toLocaleString()} {currency}
                          </td>
                          <td className="py-3 pl-2 text-left flex justify-end gap-1.5">
                            {customer.totalDebt > 0 && (
                              <a
                                href={getWhatsAppLink(customer)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition font-bold text-[10px] flex items-center gap-1"
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> واتساب
                              </a>
                            )}
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

      </div>

    </div>
  );
}
