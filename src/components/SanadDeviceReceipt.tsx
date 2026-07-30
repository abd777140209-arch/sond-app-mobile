/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Smartphone, 
  Save, 
  QrCode, 
  Wrench, 
  Check, 
  Printer, 
  ShieldCheck, 
  User, 
  Phone, 
  FileCheck2, 
  Sparkles, 
  Cpu, 
  DollarSign, 
  CreditCard,
  Share2
} from 'lucide-react';
import { MaintenanceOrder, UserAccount, SystemSettings } from '../types';
import { soundManager } from '../utils/sound';

export interface SanadDeviceReceiptProps {
  apiBaseUrl?: string;
  token?: string;
  userRole?: string;
  currentUser?: UserAccount | null;
  settings?: SystemSettings;
  onAddMaintenanceOrder?: (order: Omit<MaintenanceOrder, 'id' | 'ticketNumber' | 'createdAt'>) => void;
}

export const SanadDeviceReceipt: React.FC<SanadDeviceReceiptProps> = ({
  apiBaseUrl = '',
  token = '',
  userRole = 'admin',
  currentUser,
  settings,
  onAddMaintenanceOrder
}) => {
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    deviceModel: '',
    imei: '',
    serviceType: 'hardware' as 'hardware' | 'software' | 'both',
    problemDescription: '',
    estimatedCost: '',
    advancePayment: ''
  });

  const [savedOrder, setSavedOrder] = useState<any | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playSuccessChime();

    const ticketId = `SND-${Math.floor(100000 + Math.random() * 900000)}`;
    const newTicket = {
      id: Date.now().toString(),
      ticketNumber: ticketId,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      deviceModel: formData.deviceModel,
      serialNumber: formData.imei || 'لا يوجد',
      issueDescription: `[${formData.serviceType === 'hardware' ? 'صيانة شاشات/آيسيات' : formData.serviceType === 'software' ? 'برمجة وتفليش' : 'صيانة + برمجة'}] ${formData.problemDescription}`,
      status: 'pending' as const,
      estimatedCost: Number(formData.estimatedCost) || 0,
      depositAmount: Number(formData.advancePayment) || 0,
      technicianName: currentUser?.name || 'فني الصيانة',
      createdAt: new Date().toISOString()
    };

    if (onAddMaintenanceOrder) {
      onAddMaintenanceOrder(newTicket);
    }

    setSavedOrder(newTicket);
    setIsSaved(true);
  };

  const handlePrint = () => {
    soundManager.playScanBeep();
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!savedOrder) return;
    const msg = `🧾 *سند استلام جهاز للصيانة/البرمجة*\n` +
      `رقم الكارت: ${savedOrder.ticketNumber}\n` +
      `العميل: ${savedOrder.customerName}\n` +
      `الجهاز: ${savedOrder.deviceModel}\n` +
      `التكلفة التقديرية: ${savedOrder.estimatedCost} ${settings?.currency || 'ريال'}\n` +
      `العربون: ${savedOrder.depositAmount} ${settings?.currency || 'ريال'}\n` +
      `شكراً لثقتكم بمركزنا!`;
    
    const url = `https://api.whatsapp.com/send?phone=${savedOrder.customerPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen font-sans text-slate-800 dark:text-slate-100 space-y-6" style={{ direction: 'rtl' }}>
      
      {/* 🔹 Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
            <Smartphone className="w-7 h-7 text-amber-300" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
              <span>كارت استلام جهاز للصيانة والبرمجة (Sanad Phone Receipt)</span>
            </h1>
            <p className="text-xs text-blue-200 mt-0.5">
              تسجيل استلام الهواتف، توثيق الـ IMEI، وتأكيد نوع الخدمة (شاشات، آيسيات، أو تفليش وسوفتوير)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>الصلاحية: {userRole === 'admin' ? 'مدير المحل' : userRole === 'technician' ? 'فني الصيانة' : 'موظف الاستقبال'}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Column */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 font-extrabold text-base">
              <FileCheck2 className="w-5 h-5" />
              <h2>بيانات كارت الاستلام والخدمة</h2>
            </div>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
              Receipt Form
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Customer info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  اسم الزبون <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="مثال: أحمد محمد..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  رقم الواتساب / الهاتف <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    required
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="059... / 050..."
                  />
                </div>
              </div>
            </div>

            {/* Device & IMEI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  موديل وهاتف الجهاز <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    required
                    value={formData.deviceModel}
                    onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="مثال: iPhone 13 Pro / Galaxy S22 Ultra..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  الرقم التسلسلي / IMEI
                </label>
                <div className="relative">
                  <Cpu className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={formData.imei}
                    onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="اختر *#06# لاستخراج الـ IMEI"
                  />
                </div>
              </div>
            </div>

            {/* Service Type Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                نوع الخدمة المطلوب تنفيذها
              </label>
              <select
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value as any })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="hardware">🔧 صيانة قطع ومكونات دقيقة (Hardware - شاشات/آيسيات/بطارية)</option>
                <option value="software">💻 برمجة وتفليش وتخطي حسابات (Software & FRP/iCloud Bypass)</option>
                <option value="both">⚡ صيانة + برمجة وتفليش شاملة</option>
              </select>
            </div>

            {/* Problem Description */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                وصف الأعراض / المطلوب بالتفصيل
              </label>
              <textarea
                rows={3}
                value={formData.problemDescription}
                onChange={(e) => setFormData({ ...formData, problemDescription: e.target.value })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                placeholder="مثال: تبديل شاشة أصلية + إصلاح آيسي الشحن / تخطي رمز الحماية وتفليش روم رسمي..."
              />
            </div>

            {/* Cost & Down Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  التكلفة التقديرية الإجمالية
                </label>
                <input
                  type="number"
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-emerald-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  الدفعة المقدمة (العربون)
                </label>
                <input
                  type="number"
                  value={formData.advancePayment}
                  onChange={(e) => setFormData({ ...formData, advancePayment: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-98"
            >
              <Save className="w-4 h-4" />
              <span>حفظ كارت الاستلام وإنشاء السند</span>
            </button>

          </form>
        </div>

        {/* Printable Ticket Preview */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
              <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>معاينة كارت الاستلام والتلقي</span>
              </h3>
              {isSaved && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> تم المحفوظ
                </span>
              )}
            </div>

            {savedOrder ? (
              <div className="bg-amber-50/50 dark:bg-slate-900 p-4 rounded-xl border border-amber-200 dark:border-slate-700 space-y-3 font-mono text-xs">
                <div className="text-center border-b border-dashed border-amber-300 dark:border-slate-700 pb-2">
                  <h4 className="font-black text-slate-900 dark:text-white text-sm">{settings?.companyName || 'مركز سند لصيانة وبرمجة الهواتف'}</h4>
                  <p className="text-[10px] text-slate-500">رقم السند: {savedOrder.ticketNumber}</p>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                  <p>العميل: <strong className="text-slate-900 dark:text-white">{savedOrder.customerName}</strong></p>
                  <p>الهاتف: <strong>{savedOrder.customerPhone}</strong></p>
                  <p>الجهاز: <strong className="text-blue-600 dark:text-blue-400">{savedOrder.deviceModel}</strong></p>
                  <p>الـ IMEI: <span>{savedOrder.serialNumber}</span></p>
                  <p className="border-t border-dashed border-amber-200 dark:border-slate-700 pt-1.5">
                    التكلفة التقديرية: <strong className="text-emerald-600">{savedOrder.estimatedCost} {settings?.currency || 'ريال'}</strong>
                  </p>
                  <p>
                    العربون المستلم: <strong className="text-blue-600">{savedOrder.depositAmount} {settings?.currency || 'ريال'}</strong>
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-slate-800 dark:text-slate-200" />
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                <Smartphone className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <p>قم بملء البيانات واضغط حفظ لمعاينة كارت الاستلام وطباعته</p>
              </div>
            )}
          </div>

          {savedOrder && (
            <div className="space-y-2 pt-2">
              <button
                onClick={handlePrint}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow cursor-pointer transition"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الكارت الحراري</span>
              </button>

              <button
                onClick={handleWhatsAppShare}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow cursor-pointer transition"
              >
                <Share2 className="w-4 h-4" />
                <span>إرسال السند عبر الواتساب</span>
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default SanadDeviceReceipt;
