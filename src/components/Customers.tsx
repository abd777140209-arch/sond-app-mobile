/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, UserPlus, Phone, CreditCard, MessageSquare, Plus, CheckCircle2, History, Trash2 } from 'lucide-react';
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
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [addError, setAddError] = useState('');

  // Debt Payment state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState('');

  // Handle adding new customer
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      setAddError('⚠️ الرجاء كتابة اسم العميل!');
      soundManager.playWarningBeep();
      return;
    }
    
    // Check if duplicate name
    if (customers.some(c => c.name.toLowerCase() === newCustName.trim().toLowerCase())) {
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

    const debtor = customers.find(c => c.id === selectedCustomerId);
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
    const text = `السلام عليكم ورحمة الله وبركاته يا أخي العزيز *${customer.name}*. نحيطكم علماً بأن رصيد مديونيتكم المتبقي والمستحق لدينا في *نظام سند الذكي المحاسبي* هو: *${customer.totalDebt.toLocaleString()} ${currency}*.\nشاكرين ومقدرين لكم كريم تعاونكم وثقتكم بنا.`;
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('77') || cleanPhone.startsWith('73') || cleanPhone.startsWith('71') || cleanPhone.startsWith('70') 
      ? '967' + cleanPhone // append Yemen international code if national phone starting with 7
      : cleanPhone;

    return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(text)}`;
  };

  // Filter active customers (exclude soft-deleted)
  const activeCustomers = customers.filter(c => c.isDeleted !== true && c.isActive !== false);

  // Filter customers for display
  const filteredCustomers = activeCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
    const matchesFilter = filterType === 'all' || c.totalDebt > 0;
    return matchesSearch && matchesFilter;
  });

  return (
    <div id="customers_tab_view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT COLUMN: Customer registry & payments processing (5 columns) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Register New Customer */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 shadow-lg relative overflow-hidden">
          <h3 className="text-sm font-bold text-[#F3E7C4] flex items-center gap-2 mb-1.5">
            <UserPlus className="w-5 h-5 text-[#C5A862]" />
            تسجيل عميل جديد بالدفتر
          </h3>
          <p className="text-[11px] text-gray-400 mb-4">أضف عميلاً جديداً هنا لتقييد مبيعات الآجل وسداد الديون.</p>

          {addError && (
            <div className="p-2 mb-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] font-semibold">
              {addError}
            </div>
          )}

          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">اسم العميل الثلاثي:</label>
              <input
                id="new_cust_name"
                type="text"
                required
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="مثال: عبدالمجيد المحواشي..."
                className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">رقم الهاتف للاتصال / واتساب:</label>
              <input
                id="new_cust_phone"
                type="text"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="مثال: 777714020..."
                className="w-full bg-[#16212E] border border-gray-800 text-xs font-mono rounded-xl px-3 py-2 text-white text-left focus:outline-none focus:border-[#C5A862]"
              />
            </div>

            <button
              id="submit_new_customer_btn"
              type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#C5A862] text-black hover:bg-[#A0813D] transition duration-200 cursor-pointer text-center"
            >
              حفظ وتثبيت الحساب الجديد
            </button>
          </form>
        </div>

        {/* Pay Debt Form */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 shadow-lg">
          <h3 className="text-sm font-bold text-[#F3E7C4] flex items-center gap-2 mb-1.5">
            <CreditCard className="w-5 h-5 text-green-400" />
            سند قبض نقدية (تسديد دين)
          </h3>
          <p className="text-[11px] text-gray-400 mb-4">قم باستلام وتنزيل جزء أو كامل مديونية العميل من صندوق النقدية.</p>

          {payError && (
            <div className="p-2 mb-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] font-semibold">
              {payError}
            </div>
          )}

          <form onSubmit={handlePaySubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">اختر العميل المدين:</label>
              <select
                id="pay_debt_customer_select"
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  const debtor = customers.find(c => c.id === e.target.value);
                  setPayAmount(debtor ? debtor.totalDebt : 0);
                }}
                className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
              >
                <option value="">-- اختر عميلاً للتسديد --</option>
                {activeCustomers.filter(c => c.totalDebt > 0).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (مدين بـ: {c.totalDebt.toLocaleString()} {currency})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">المبلغ المسلم نقدياً للتنزيل:</label>
              <input
                id="pay_debt_amount_input"
                type="number"
                min="1"
                required
                value={payAmount || ''}
                onChange={(e) => setPayAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="مثال: 50000"
                className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold">ملاحظات أو رقم السند:</label>
              <input
                id="pay_debt_note_input"
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="مثال: تسديد جزئي نقدياً لصيانة الشاشات..."
                className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
              />
            </div>

            <button
              id="submit_pay_debt_btn"
              type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-green-500 text-black hover:bg-green-600 transition duration-200 cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> ترحيل سند المقبوضات نقدياً
            </button>
          </form>
        </div>

      </div>

      {/* RIGHT COLUMN: Customers list ledger directory (7 columns) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Customer Database Directory */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#F3E7C4]">دليل سجل وحسابات العملاء الكلية</h3>
              <p className="text-[11px] text-gray-400">مجموع العملاء المسجلين: {customers.length} عميل</p>
            </div>

            {/* Quick Filters */}
            <div className="flex bg-[#16212E] border border-gray-800 rounded-xl p-0.5 text-[10px]">
              <button
                id="filter_cust_all"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-[#C5A862] text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                الجميع
              </button>
              <button
                id="filter_cust_debtors"
                onClick={() => setFilterType('debtors')}
                className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                  filterType === 'debtors'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                المدينون فقط
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-4">
            <input
              id="customer_ledger_search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب اسم العميل أو رقمه للبحث المباشر..."
              className="w-full pr-10 pl-3 py-2 text-xs rounded-xl bg-[#16212E] border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 transition-all"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>

          {/* Table list */}
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 pr-1">العميل</th>
                  <th className="pb-3 text-center">رقم الجوال</th>
                  <th className="pb-3 text-center">الرصيد / الدين</th>
                  <th className="pb-3 pl-1 text-left">مشاركة / إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      لم يتم العثور على أي عملاء يطابقون خيارات البحث.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(customer => (
                    <tr key={customer.id} className="hover:bg-[#182433]/30">
                      <td className="py-3 pr-1 font-bold text-gray-100">
                        {customer.name}
                      </td>
                      <td className="py-3 text-center font-mono text-gray-400">
                        {customer.phone}
                      </td>
                      <td className={`py-3 text-center font-mono font-bold ${
                        customer.totalDebt > 0 ? 'text-red-400' : 'text-green-500'
                      }`}>
                        {customer.totalDebt.toLocaleString()} {currency}
                      </td>
                      <td className="py-3 pl-1 text-left flex justify-end gap-1.5">
                        
                        {/* WhatsApp Demand reminder */}
                        {customer.totalDebt > 0 && (
                          <a
                            id={`wa_remind_link_${customer.id}`}
                            href={getWhatsAppLink(customer)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-black transition cursor-pointer flex items-center gap-1 text-[10px]"
                            title="إرسال مطالبة مالية مهذبة بالواتساب"
                            onClick={() => soundManager.playScanBeep()}
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> تذكير بالدين
                          </a>
                        )}

                        <button
                          id={`del_cust_btn_${customer.id}`}
                          onClick={() => {
                            if (customer.totalDebt > 0) {
                              soundManager.playWarningBeep();
                              alert('⚠️ لا يمكن حذف حساب العميل وهو يحمل مديونية نشطة! قم بتسديد مديونيته أولاً.');
                              return;
                            }
                            if (confirm(`هل أنت متأكد من رغبتك في حذف العميل "${customer.name}" نهائياً من النظام؟`)) {
                              soundManager.playWarningBeep();
                              onDeleteCustomer(customer.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-red-950/20 text-red-400 hover:bg-red-500 hover:text-white transition cursor-pointer"
                          title="حذف العميل"
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

        {/* Payments received history log */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg">
          <h3 className="text-xs font-bold text-gray-300 flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-green-400" />
            سجل سندات القبض والتحصيلات النقدية الأخيرة
          </h3>

          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {payments.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-xs">
                لا توجد دفعات محصلة مستلمة مسجلة بعد.
              </div>
            ) : (
              [...payments].reverse().map(pay => (
                <div key={pay.id} className="p-3 rounded-xl bg-[#14202F] border border-gray-800 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-gray-200">العميل: {pay.customerName}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{pay.note}</div>
                  </div>
                  <div className="text-left font-mono">
                    <span className="font-bold text-green-400">+{pay.amount.toLocaleString()} {currency}</span>
                    <div className="text-[9px] text-gray-500 mt-0.5">
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
  );
}
