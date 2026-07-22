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
  SlidersHorizontal
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

  const handlePrintTicket = (order: MaintenanceOrder) => {
    setPrintOrder(order);
    soundManager.playSuccessChime();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      o.customerName.toLowerCase().includes(query) || 
      o.deviceName.toLowerCase().includes(query) || 
      o.orderNumber.toLowerCase().includes(query) ||
      o.customerPhone.includes(query);
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const pendingCount = orders.filter(o => o.status === 'received' || o.status === 'repairing').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const totalRepairRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.cost, 0);

  return (
    <div id="maintenance_management_view" className="space-y-6">
      
      {/* Printable Maintenance Ticket Overlay */}
      {printOrder && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 print:absolute print:inset-0 print:bg-white print:text-black">
          <div className="bg-white text-black p-6 rounded-2xl w-full max-w-xs border border-gray-200 print:border-0 font-sans print-area" style={{ direction: 'rtl' }}>
            <div className="text-center space-y-1">
              <h2 className="text-base font-extrabold text-gray-900">👑 مركز الصيانة والبرمجة</h2>
              <p className="text-[10px] text-gray-500">كرت استلام جهاز صيانة</p>
              <div className="border-t border-dashed border-gray-400 my-2"></div>
            </div>

            <div className="text-[11px] space-y-2 mt-3 text-gray-800">
              <div className="flex justify-between">
                <span>رقم الطلب:</span>
                <span className="font-bold font-mono">{printOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>تاريخ الاستلام:</span>
                <span className="font-mono">{new Date(printOrder.dateReceived).toLocaleDateString('ar-YE')}</span>
              </div>
              <div className="flex justify-between">
                <span>اسم العميل:</span>
                <span className="font-bold">{printOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>رقم التلفون:</span>
                <span className="font-mono">{printOrder.customerPhone || 'غير مسجل'}</span>
              </div>
              <div className="border-t border-dashed border-gray-300 my-1"></div>
              <div className="flex justify-between">
                <span>الجهاز:</span>
                <span className="font-bold">{printOrder.deviceName}</span>
              </div>
              <div className="flex justify-between">
                <span>المشكلة/العطل:</span>
                <span className="text-red-700 font-medium">{printOrder.issueDescription}</span>
              </div>
              <div className="flex justify-between">
                <span>التكلفة التقريبية:</span>
                <span className="font-bold font-mono text-green-700">{printOrder.cost.toLocaleString()} {currency}</span>
              </div>
              {printOrder.notes && (
                <div className="bg-gray-100 p-1.5 rounded text-[10px] text-gray-600 mt-1">
                  <strong>ملاحظات:</strong> {printOrder.notes}
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-4"></div>
            <div className="text-center text-[9px] text-gray-500 space-y-1">
              <p>يرجى إبراز هذا الكرت عند الاستلام والتدقيق</p>
              <p className="font-bold">المحل غير مسؤول عن الأجهزة التي تترك أكثر من 30 يوماً</p>
              <p className="text-[8px] text-gray-400 mt-2">نظام سند الذكي المحاسبي © 2026</p>
            </div>

            <div className="mt-4 flex gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold cursor-pointer"
              >
                طباعة الكرت
              </button>
              <button
                onClick={() => setPrintOrder(null)}
                className="flex-1 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-black text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="p-4 rounded-xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block">أجهزة قيد الصيانة والانتظار</span>
            <span className="text-xl font-bold text-amber-400 font-mono">{pendingCount} أجهزة</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block">أجهزة جاهزة للتسليم</span>
            <span className="text-xl font-bold text-green-400 font-mono">{completedCount} أجهزة</span>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block">أجهزة تم تسليمها بنجاح</span>
            <span className="text-xl font-bold text-blue-400 font-mono">{deliveredCount} أجهزة</span>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-[#122030] to-[#0D1520] border border-[#C5A862]/20 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block">أرباح وإيرادات الصيانة المحصلة</span>
            <span className="text-xl font-bold text-[#C5A862] font-mono">{totalRepairRevenue.toLocaleString()} {currency}</span>
          </div>
          <div className="p-3 rounded-lg bg-[#C5A862]/10 text-[#C5A862]">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Control panel (Left) + Orders List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">
        
        {/* LEFT: Add Order Form */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-[#F3E7C4] flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#C5A862]" />
                استلام جهاز جديد للصيانة
              </h3>
            </div>

            {formError && (
              <div className="p-2 mb-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">اسم العميل ورقم الملف:</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: يحيى صالح الحيمي"
                    className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl pr-9 pl-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">رقم هاتف العميل للتواصل:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="مثال: 777123456"
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-mono rounded-xl pr-9 pl-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                  />
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">نوع وموديل الهاتف الذكي:</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="مثال: Redmi Note 13 Pro"
                    className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl pr-9 pl-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                  />
                  <Smartphone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">وصف المشكلة / القطع المراد برمجتها:</label>
                <textarea
                  required
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="مثال: كسر شاشة داخلية + بحاجة لتغيير باغة حماية خارجية وصيانة منفذ الشحن"
                  rows={2}
                  className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">التكلفة التقريبية:</label>
                  <input
                    type="number"
                    min="0"
                    value={cost || ''}
                    onChange={(e) => setCost(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="25000"
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-mono font-bold rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">حالة الكرت الافتراضية:</label>
                  <div className="bg-[#121D2A] border border-gray-800 text-[11px] font-bold text-amber-400 rounded-xl px-3 py-2.5">
                    📥 مستلم وقيد الانتظار
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">ملاحظات وقطع مرفقة (بطارية، كفر):</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: تم استلام كفر حماية خارجي مع الجهاز"
                  className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#C5A862] hover:bg-[#9F8342] text-black transition duration-200 cursor-pointer text-center shadow-lg"
              >
                تسجيل وتأكيد كرت الاستلام ⚙️
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: Orders Ledger */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg">
            
            {/* Header / Filter Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#F3E7C4]">سجل أجهزة الصيانة والبرمجيات</h3>
                <p className="text-[11px] text-gray-400">إجمالي طلبات الصيانة بالمركز: {orders.length} أجهزة</p>
              </div>

              {/* Status Filters */}
              <div className="flex flex-wrap gap-1 bg-[#16212E] border border-gray-800 rounded-xl p-0.5 text-[10px] font-bold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${statusFilter === 'all' ? 'bg-[#C5A862] text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setStatusFilter('received')}
                  className={`px-2 py-1 rounded-lg cursor-pointer transition ${statusFilter === 'received' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  بالانتظار
                </button>
                <button
                  onClick={() => setStatusFilter('repairing')}
                  className={`px-2 py-1 rounded-lg cursor-pointer transition ${statusFilter === 'repairing' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  قيد العمل
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-2 py-1 rounded-lg cursor-pointer transition ${statusFilter === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  جاهز
                </button>
                <button
                  onClick={() => setStatusFilter('delivered')}
                  className={`px-2 py-1 rounded-lg cursor-pointer transition ${statusFilter === 'delivered' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:text-white'}`}
                >
                  المستلمة
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الكرت، اسم العميل، التلفون أو موديل الجهاز..."
                className="w-full pr-10 pl-3 py-2 text-xs rounded-xl bg-[#16212E] border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 transition"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>

            {/* List Table */}
            <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="pb-3 pr-2">رقم الكرت</th>
                    <th className="pb-3">العميل والجهاز</th>
                    <th className="pb-3 text-center">المشكلة / العطل</th>
                    <th className="pb-3 text-center">التكلفة</th>
                    <th className="pb-3 text-center">الحالة</th>
                    <th className="pb-3 text-left pl-2">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        لا توجد كروت صيانة تطابق خيارات التصفية المحددة.
                      </td>
                    </tr>
                  ) : (
                    [...filteredOrders].reverse().map(o => (
                      <tr key={o.id} className="hover:bg-[#182433]/20">
                        <td className="py-3 pr-2 font-mono font-bold text-[#C5A862]">
                          {o.orderNumber}
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-gray-200">{o.deviceName}</div>
                          <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                            <span>{o.customerName}</span>
                            {o.customerPhone && <span className="font-mono text-gray-500">({o.customerPhone})</span>}
                          </div>
                        </td>
                        <td className="py-3 text-center text-red-300 font-semibold max-w-[150px] truncate" title={o.issueDescription}>
                          {o.issueDescription}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-green-400">
                          {o.cost.toLocaleString()} {currency}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] inline-block ${
                            o.status === 'received' 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : o.status === 'repairing'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : o.status === 'completed'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {o.status === 'received' ? '📥 بالانتظار' : o.status === 'repairing' ? '⚙️ قيد الإصلاح' : o.status === 'completed' ? '✅ جاهز' : '📱 تم التسليم'}
                          </span>
                        </td>
                        <td className="py-3 pl-2 text-left space-x-1.5 space-x-reverse">
                          
                          {/* Print mini repair invoice card */}
                          <button
                            onClick={() => handlePrintTicket(o)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-gray-300 cursor-pointer"
                            title="طباعة كرت الاستلام"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick change status selector */}
                          {o.status !== 'delivered' && (
                            <select
                              value={o.status}
                              onChange={(e) => {
                                onUpdateStatus(o.id, e.target.value as any);
                                if (e.target.value === 'delivered') {
                                  soundManager.playSuccessChime();
                                } else {
                                  soundManager.playScanBeep();
                                }
                              }}
                              className="bg-[#121D2A] border border-gray-800 text-gray-300 rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none"
                            >
                              <option value="received">قيد الانتظار</option>
                              <option value="repairing">بدء التصليح</option>
                              <option value="completed">تم الإصلاح (جاهز)</option>
                              <option value="delivered">تسليم للعميل وقبض التكلفة</option>
                            </select>
                          )}

                          {/* Delete order */}
                          <button
                            onClick={() => {
                              if (confirm('⚠️ تحذير: هل أنت متأكد من رغبتك في حذف كرت استلام صيانة هذا الجهاز نهائياً؟')) {
                                soundManager.playWarningBeep();
                                onDeleteOrder(o.id);
                              }
                            }}
                            className="p-1 rounded bg-red-950/20 hover:bg-red-500/10 text-red-400 cursor-pointer"
                            title="حذف كرت الصيانة"
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

      </div>

    </div>
  );
}
