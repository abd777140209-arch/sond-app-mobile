/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Smartphone, 
  Search, 
  Plus, 
  Wrench, 
  CheckCircle2, 
  Clock, 
  Send, 
  User, 
  Phone, 
  DollarSign, 
  AlertCircle, 
  Trash2, 
  Printer, 
  TrendingUp,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { MaintenanceOrder } from '../types';
import { soundManager } from '../utils/sound';

interface MaintenanceProps {
  orders: MaintenanceOrder[];
  onAddOrder: (order: Omit<MaintenanceOrder, 'id' | 'orderNumber' | 'dateReceived'>) => void;
  onUpdateStatus: (id: string, status: MaintenanceOrder['status']) => void;
  onDeleteOrder: (id: string) => void;
  currency: string;
}

export default function Maintenance({
  orders,
  onAddOrder,
  onUpdateStatus,
  onDeleteOrder,
  currency
}: MaintenanceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'received' | 'repairing' | 'completed' | 'delivered'>('all');

  // New Order states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Quick ticket print state
  const [printOrder, setPrintOrder] = useState<MaintenanceOrder | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customerName.trim() || !deviceName.trim() || !issueDescription.trim()) {
      setFormError('⚠️ يرجى ملء حقول اسم العميل، اسم الجهاز، والمشكلة!');
      soundManager.playWarningBeep();
      return;
    }

    onAddOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deviceName: deviceName.trim(),
      issueDescription: issueDescription.trim(),
      cost: cost,
      status: 'received',
      notes: notes.trim()
    });

    // Reset states
    setCustomerName('');
    setCustomerPhone('');
    setDeviceName('');
    setIssueDescription('');
    setCost(0);
    setNotes('');
    setShowAddForm(false);
    soundManager.playSuccessChime();
  };

  const getWhatsAppStatusLink = (order: MaintenanceOrder) => {
    let statusText = 'تم استلام جهازكم كرت صيانة جديد.';
    if (order.status === 'repairing') statusText = 'جاري العمل وصيانة جهازكم حالياً بالورشة.';
    if (order.status === 'completed') statusText = 'تمت صيانة وإصلاح جهازكم بنجاح وهو جاهز للاستلام.';
    if (order.status === 'delivered') statusText = 'تم تسليم الجهاز إليكم، شاكرين لكم ثقتكم بنا.';

    const text = `السلام عليكم ورحمة الله وبركاته يا أخي العزيز *${order.customerName}*.\nنود إحاطتكم بحالة طلب الصيانة رقم (*${order.orderNumber}*) للجهاز (*${order.deviceName}*):\n📌 الحالة: *${statusText}*\n💰 التكلفة المقدرة: *${order.cost.toLocaleString()} ${currency}*.\n*نظام سند المحاسبي للصيانة*`;
    
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('77') || cleanPhone.startsWith('73') || cleanPhone.startsWith('71') || cleanPhone.startsWith('70') 
      ? '967' + cleanPhone
      : cleanPhone;

    return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(text)}`;
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone.includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalReceived = orders.filter(o => o.status === 'received').length;
  const totalRepairing = orders.filter(o => o.status === 'repairing').length;
  const totalCompleted = orders.filter(o => o.status === 'completed').length;
  const totalIncome = orders.filter(o => o.status === 'delivered' || o.status === 'completed').reduce((sum, o) => sum + o.cost, 0);

  return (
    <div id="maintenance_tab_view" className="space-y-6 pb-12">
      
      {/* 1. STATS SUMMARY BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">أجهزة تحت الاستلام</span>
            <h3 className="text-lg font-black text-blue-600 mt-1">{totalReceived} جهاز</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">جاري الصيانة بالورشة</span>
            <h3 className="text-lg font-black text-amber-600 mt-1">{totalRepairing} جهاز</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">جاهزة للاستلام</span>
            <h3 className="text-lg font-black text-emerald-600 mt-1">{totalCompleted} جهاز</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">إيرادات أجور الصيانة</span>
            <h3 className="text-lg font-black text-slate-900 mt-1 dir-ltr text-right">
              {totalIncome.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span>
            </h3>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. HEADER ACTIONS & NEW ORDER MODAL/BUTTON */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              إدارة كروت وأوامر صيانة الأجهزة والبرمجيات
            </h2>
            <p className="text-xs text-slate-400">متابعة الأجهزة المستلمة، التكلفة، ورسائل التحديث</p>
          </div>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              soundManager.playScanBeep();
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>فتح كرت صيانة جديد</span>
          </button>
        </div>

        {/* Add New Maintenance Form */}
        {showAddForm && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-blue-200 space-y-3 pt-4 animate-fadeIn">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-900">بيانات كرت استلام الجهاز الجديد</h3>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">اسم العميل:</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: عبدالمجيد المحواشي..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">رقم جوال العميل:</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="77XXXXXXX"
                    className="w-full bg-white border border-slate-200 font-mono rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">اسم الجهاز والموديل:</label>
                  <input
                    type="text"
                    required
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="مثال: Samsung Galaxy S21 Ultra"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">التكلفة / الأجرة المقدرة:</label>
                  <input
                    type="number"
                    min="0"
                    value={cost || ''}
                    onChange={(e) => setCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="مثال: 15000"
                    className="w-full bg-white border border-slate-200 font-bold font-mono rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">وصف المشكلة والأعطال:</label>
                <input
                  type="text"
                  required
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="مثال: الشاشة مكسورة + تغيير منفذ الشحن..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition cursor-pointer"
              >
                تثبيت وطباعة كرت الاستلام
              </button>
            </form>
          </div>
        )}

        {/* Filter & Search Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pt-2">
          
          <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs font-bold overflow-x-auto max-w-full">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'received', label: 'مستلم' },
              { id: 'repairing', label: 'جاري الصيانة' },
              { id: 'completed', label: 'جاهز للاستلام' },
              { id: 'delivered', label: 'تم التسليم' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1 rounded-lg transition shrink-0 ${
                  statusFilter === f.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الكرت، الاسم، أو نوع الجهاز..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>

        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold">
                <th className="pb-3 pr-2">رقم الكرت</th>
                <th className="pb-3">العميل والهاتف</th>
                <th className="pb-3">الجهاز والمشكلة</th>
                <th className="pb-3 text-center">التكلفة</th>
                <th className="pb-3 text-center">الحالة</th>
                <th className="pb-3 pl-2 text-left">إجراءات والتحديث</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    لا توجد كروت صيانة تطابق خيارات التصفية.
                  </td>
                </tr>
              ) : (
                [...filteredOrders].reverse().map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 pr-2 font-mono font-bold text-slate-900">
                      #{order.orderNumber}
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">{order.customerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{order.customerPhone}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-slate-800">{order.deviceName}</div>
                      <div className="text-[10px] text-slate-400">{order.issueDescription}</div>
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-blue-600">
                      {order.cost.toLocaleString()} {currency}
                    </td>
                    <td className="py-3 text-center">
                      <select
                        value={order.status}
                        onChange={(e) => onUpdateStatus(order.id, e.target.value as any)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-xl border focus:outline-none cursor-pointer ${
                          order.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          order.status === 'repairing' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          order.status === 'delivered' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        <option value="received">مستلم (تحت الفحص)</option>
                        <option value="repairing">جاري الصيانة (بالورشة)</option>
                        <option value="completed">جاهز للاستلام ✓</option>
                        <option value="delivered">تم التسليم النهائي</option>
                      </select>
                    </td>
                    <td className="py-3 pl-2 text-left flex justify-end gap-1.5">
                      <a
                        href={getWhatsAppStatusLink(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition cursor-pointer"
                        title="إرسال تحديث الحالة عبر واتساب"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف كرت الصيانة رقم #${order.orderNumber}؟`)) {
                            onDeleteOrder(order.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="حذف الكرت"
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

    </div>
  );
}
