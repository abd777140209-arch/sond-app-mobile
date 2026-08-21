/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { getSafeHtml2CanvasOptions } from '../utils/pdfHelper';
import { motion } from 'motion/react';
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
  X,
  Barcode,
  QrCode,
  Share2,
  Copy,
  Check,
  Download,
  FileText,
  Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { MaintenanceOrder, DeviceChecklist, ChecklistStatus } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';
import { generateAndSharePDF } from '../services/pdfService';
import MaintenanceStickerModal from './MaintenanceStickerModal';

interface MaintenanceProps {
  orders: MaintenanceOrder[];
  onAddOrder: (order: Omit<MaintenanceOrder, 'id' | 'orderNumber' | 'dateReceived'>) => void;
  onUpdateStatus: (id: string, status: MaintenanceOrder['status']) => void;
  onDeleteOrder: (id: string) => void;
  currency: string;
  storeName?: string;
}

export default function Maintenance({
  orders,
  onAddOrder,
  onUpdateStatus,
  onDeleteOrder,
  currency,
  storeName = 'سند المحاسبي للصيانة'
}: MaintenanceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'received' | 'repairing' | 'completed' | 'delivered'>('all');

  // New Order states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [sparePartsCost, setSparePartsCost] = useState<number>(0);
  const [technicianName, setTechnicianName] = useState<string>('مهندس الورشة والصيانة');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Device Quick Checklist State
  const [checklist, setChecklist] = useState<DeviceChecklist>({
    screen: 'intact',
    battery: 'intact',
    camera: 'intact',
    fingerprint: 'untested',
    sound: 'intact',
    power: 'intact'
  });

  // Maintenance sticker modal state
  const [stickerOrder, setStickerOrder] = useState<MaintenanceOrder | null>(null);
  const [showStickerModal, setShowStickerModal] = useState<boolean>(false);

  // Tracking QR Modal state
  const [trackingOrder, setTrackingOrder] = useState<MaintenanceOrder | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // PDF Export state
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  // Delete confirmation modal state
  const [deleteTargetOrder, setDeleteTargetOrder] = useState<MaintenanceOrder | null>(null);

  const handleExportMonthlyMaintenancePDF = async () => {
    soundManager.playSuccessChime();
    try {
      setIsExportingPDF(true);
      const todayStr = new Date().toLocaleDateString('ar-YE');
      const totalCostSum = orders.reduce((acc, o) => acc + (o.cost || 0), 0);

      await generateAndSharePDF({
        title: 'تقرير قسم الصيانة التقنية الشامل',
        customerName: 'إدارة قسم الصيانة',
        date: todayStr,
        items: orders.slice(0, 100).map(o => ({
          description: `${o.deviceName || 'جهاز صيانة'} - العميل: ${o.customerName || 'غير محدد'} (${o.issueDescription || 'بدون تفاصيل'})`,
          amount: `${(o.cost || 0).toLocaleString()} ${currency}`
        })),
        totalAmount: `${totalCostSum.toLocaleString()} ${currency}`
      });
    } catch (error) {
      console.error('Error generating Maintenance PDF:', error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customerName.trim() || !deviceName.trim() || !issueDescription.trim()) {
      setFormError('⚠️ يرجى ملء حقول اسم العميل، اسم الجهاز، والمشكلة!');
      soundManager.playWarningBeep();
      return;
    }

    const calculatedLaborFee = Math.max(0, cost - (sparePartsCost || 0));

    const orderData = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deviceName: deviceName.trim(),
      issueDescription: issueDescription.trim(),
      cost: cost,
      sparePartsCost: sparePartsCost || 0,
      laborFee: calculatedLaborFee,
      technicianName: technicianName.trim() || 'مهندس الورشة والصيانة',
      status: 'received' as const,
      notes: notes.trim(),
      checklist: checklist
    };

    onAddOrder(orderData);

    const generatedOrderNum = `${Math.floor(1000 + Math.random() * 9000)}`;
    setStickerOrder({
      id: `m-${Date.now()}`,
      orderNumber: generatedOrderNum,
      dateReceived: new Date().toISOString(),
      ...orderData
    });
    setShowStickerModal(true);

    // Reset states
    setCustomerName('');
    setCustomerPhone('');
    setDeviceName('');
    setIssueDescription('');
    setCost(0);
    setSparePartsCost(0);
    setTechnicianName('مهندس الورشة والصيانة');
    setNotes('');
    setChecklist({
      screen: 'intact',
      battery: 'intact',
      camera: 'intact',
      fingerprint: 'untested',
      sound: 'intact',
      power: 'intact'
    });
    setShowAddForm(false);
    soundManager.playSuccessChime();
  };

  const getTrackingUrl = (order: MaintenanceOrder) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sanad-app.com';
    return `${origin}/?track=${order.orderNumber}`;
  };

  const getWhatsAppStatusLink = (order: MaintenanceOrder) => {
    let statusHeader = '📥 تم استلام جهازك بنجاح في قسم الصيانة';
    let statusText = 'جهازك حالياً في مرحلة الفحص الأولي وتحديد الأعطال.';
    
    if (order.status === 'repairing') {
      statusHeader = '⚙️ جاري صيانة وإصلاح جهازك حالياً بالورشة';
      statusText = 'يقوم مهندس الصيانة بالعمل على جهازك فوراً.';
    } else if (order.status === 'completed') {
      statusHeader = '🎉 بشرى سارة! جهازك جاهز للاستلام الآن';
      statusText = 'تمت عمليات الصيانة واختبار الكفاءة بنجاح.';
    } else if (order.status === 'delivered') {
      statusHeader = '🤝 تم تسليم الجهاز بنجاح';
      statusText = 'نشكرك لاختيارك مركزنا، ونتمنى لك تجربة رائعة.';
    }

    const trackingUrl = getTrackingUrl(order);

    const text = `*${storeName} - قسم الصيانة والخدمات الفنية* 📱\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `مرحباً أ/ *${order.customerName || 'العميل'}* 👋\n\n` +
      `*${statusHeader}*\n\n` +
      `🏷️ رقم كرت الصيانة: *#${order.orderNumber || ''}*\n` +
      `💻 نوع الجهاز: *${order.deviceName || ''}*\n` +
      `🛠️ العطل المسجل: *${order.issueDescription || ''}*\n` +
      `💰 التكلفة المقدرة: *${(order.cost || 0).toLocaleString()} ${currency}*\n` +
      `📌 التفاصيل: ${statusText}\n\n` +
      `🔗 يمكنك تتبع حالة جهازك مباشرة عبر رمز QR أو هذا الرابط:\n${trackingUrl}\n\n` +
      `مع تحيات فريق *${storeName}* ❤️`;
    
    const cleanPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('77') || cleanPhone.startsWith('73') || cleanPhone.startsWith('71') || cleanPhone.startsWith('70') 
      ? '967' + cleanPhone
      : cleanPhone;

    return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(text)}`;
  };

  const handleDeleteTicket = (order: MaintenanceOrder) => {
    setDeleteTargetOrder(order);
    soundManager.playScanBeep();
  };

  const renderChecklistBadges = (ch?: DeviceChecklist) => {
    if (!ch) return null;
    const items = [
      { key: 'screen', label: 'شاشة', val: ch.screen },
      { key: 'battery', label: 'بطارية', val: ch.battery },
      { key: 'camera', label: 'كاميرا', val: ch.camera },
      { key: 'fingerprint', label: 'بصمة', val: ch.fingerprint },
      { key: 'sound', label: 'صوت', val: ch.sound },
      { key: 'power', label: 'شحن', val: ch.power },
    ];

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {items.map(it => {
          let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';
          let statusText = 'لم تفحص';
          if (it.val === 'intact') {
            colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            statusText = 'سليمة';
          } else if (it.val === 'damaged') {
            colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
            statusText = 'تالفة';
          }
          return (
            <span key={it.key} className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${colorClass}`}>
              {it.label}: {statusText}
            </span>
          );
        })}
      </div>
    );
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
  const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'completed');
  const totalIncome = completedOrders.reduce((sum, o) => sum + (o.cost || 0), 0);
  const totalSpareParts = completedOrders.reduce((sum, o) => sum + (o.sparePartsCost || 0), 0);
  const totalLaborFees = completedOrders.reduce((sum, o) => sum + (o.laborFee ?? Math.max(0, (o.cost || 0) - (o.sparePartsCost || 0))), 0);

  return (
    <div id="maintenance_tab_view" className="space-y-3.5 md:space-y-6 pb-20 md:pb-28">
      
      {/* 1. STATS SUMMARY BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
        <div className="p-2.5 sm:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500">أجهزة أُستلمت / بالانتظار</span>
            <h3 className="text-sm sm:text-lg font-black text-blue-600 mt-0.5">{totalReceived} جهاز</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">تحت الفحص</p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-blue-50 text-blue-600">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-2.5 sm:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500">جاري الصيانة</span>
            <h3 className="text-sm sm:text-lg font-black text-amber-600 mt-0.5">{totalRepairing} جهاز</h3>
            <p className="text-[10px] text-amber-700 font-bold mt-0.5">على طاولة الفني</p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600">
            <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-2.5 sm:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500">الأجهزة المنجزة</span>
            <h3 className="text-sm sm:text-lg font-black text-emerald-600 mt-0.5">{completedOrders.length} جهاز</h3>
            <p className="text-[10px] text-emerald-700 font-bold mt-0.5">جاهزة أو مُسلمة</p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-2.5 sm:p-4 rounded-xl md:rounded-2xl bg-purple-900 text-white border border-purple-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-purple-200">صافي ربح أجور اليد</span>
            <h3 className="text-sm sm:text-lg font-black text-emerald-300 mt-0.5">
              {(totalLaborFees || 0).toLocaleString()} <span className="text-[10px] font-normal text-purple-200">{currency}</span>
            </h3>
            <p className="text-[10px] text-purple-300 mt-0.5">قطع غيار: {(totalSpareParts || 0).toLocaleString()} {currency}</p>
          </div>
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-purple-800 text-purple-200">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* 2. HEADER ACTIONS & NEW ORDER MODAL/BUTTON */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3.5">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              إدارة كروت وأوامر صيانة الأجهزة والبرمجيات
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400">متابعة الأجهزة المستلمة، الفحص الأولي، التكلفة، وإشعارات الواتساب</p>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                soundManager.playScanBeep();
              }}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="truncate">فتح كرت جديد</span>
            </button>

            <button
              onClick={handleExportMonthlyMaintenancePDF}
              disabled={isExportingPDF}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 active:scale-95 text-white shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Download className="w-4 h-4 shrink-0" />}
              <span className="truncate">{isExportingPDF ? 'جاري التصدير...' : 'تقرير شهري PDF'}</span>
            </button>
          </div>
        </div>

        {/* Search Input Bar with Quick Clear */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الكرت، اسم العميل، رقم الهاتف، أو موديل الجهاز..."
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

        {/* Filter & Status Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 pt-1">
          <div className="flex bg-slate-100 p-1 border border-slate-200 rounded-xl text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-none gap-1">
            {[
              { id: 'all', label: `الكل (${orders.length})` },
              { id: 'received', label: `مستلم (${totalReceived})` },
              { id: 'repairing', label: `جاري الصيانة (${totalRepairing})` },
              { id: 'completed', label: 'جاهز للاستلام ✓' },
              { id: 'delivered', label: 'تم التسليم 🤝' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1 rounded-lg transition shrink-0 ${
                  statusFilter === f.id ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full self-end sm:self-auto shrink-0">
            {filteredOrders.length} كرت معروض
          </span>
        </div>

        {/* MOBILE CARDS VIEW (block md:hidden) */}
        <div className="block md:hidden space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا توجد كروت صيانة تطابق خيارات التصفية.
            </div>
          ) : (
            [...filteredOrders].reverse().map(order => (
              <div key={order.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-xs">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      #{order.orderNumber}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-1">{order.deviceName}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{order.issueDescription}</p>
                    {renderChecklistBadges(order.checklist)}
                  </div>
                  
                  <select
                    value={order.status}
                    onChange={(e) => onUpdateStatus(order.id, e.target.value as any)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-xl border focus:outline-none cursor-pointer shrink-0 ${
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
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">العميل: {order.customerName || 'عميل'}</span>
                    <span className="text-slate-600 dir-ltr text-[11px]">{order.customerPhone || 'بدون هاتف'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-sans block">التكلفة:</span>
                    <span className="font-bold text-blue-600 text-sm">{(order.cost || 0).toLocaleString()} {currency}</span>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setStickerOrder(order);
                      setShowStickerModal(true);
                      soundManager.playScanBeep();
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white transition cursor-pointer text-xs font-bold flex items-center gap-1 border border-amber-200"
                    title="طباعة ملصق للجهاز (50mm × 30mm)"
                  >
                    <Barcode className="w-3.5 h-3.5 text-amber-600" />
                    <span>طباعة ملصق للجهاز</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTrackingOrder(order);
                      soundManager.playScanBeep();
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white transition cursor-pointer text-xs font-bold flex items-center gap-1 border border-purple-200"
                    title="رمز QR وتتبع حالة الجهاز"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>تتبع QR</span>
                  </button>

                  <a
                    href={getWhatsAppStatusLink(order)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition cursor-pointer text-xs font-bold flex items-center gap-1 border border-emerald-200"
                    title="إشعار واتساب"
                  >
                    <Send className="w-3.5 h-3.5" /> إشعار واتساب
                  </a>

                  <button
                    onClick={() => handleDeleteTicket(order)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="حذف كرت الصيانة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* DESKTOP TABLE VIEW (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto max-h-[450px] overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold text-xs">
                <th className="pb-3 pr-2">رقم الكرت</th>
                <th className="pb-3">العميل والهاتف</th>
                <th className="pb-3">الجهاز والمشكلة</th>
                <th className="pb-3">الفني المسؤول</th>
                <th className="pb-3 text-center">التكلفة والقطع</th>
                <th className="pb-3 text-center">الحالة</th>
                <th className="pb-3 pl-2 text-left">إجراءات والتحديث</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا توجد كروت صيانة تطابق خيارات التصفية.
                  </td>
                </tr>
              ) : (
                [...filteredOrders].reverse().map(order => {
                  const spareCost = order.sparePartsCost || 0;
                  const labor = order.laborFee ?? Math.max(0, (order.cost || 0) - spareCost);
                  return (
                  <tr key={order.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 pr-2 font-mono font-bold text-slate-900">
                      #{order.orderNumber || ''}
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">{order.customerName || 'عميل'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{order.customerPhone || ''}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-slate-800">{order.deviceName || 'جهاز صيانة'}</div>
                      <div className="text-[10px] text-slate-400">{order.issueDescription || ''}</div>
                      {renderChecklistBadges(order.checklist)}
                    </td>
                    <td className="py-3">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200 text-[11px] font-bold">
                        <User className="w-3 h-3 text-purple-600" />
                        <span>{order.technicianName || 'مهندس الورشة'}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center font-mono">
                      <div className="font-bold text-blue-600 text-xs">
                        {(order.cost || 0).toLocaleString()} {currency}
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        قطع: {(spareCost || 0).toLocaleString()} | يد: <span className="font-bold text-emerald-600">{(labor || 0).toLocaleString()}</span>
                      </div>
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
                      <button
                        type="button"
                        onClick={() => {
                          setStickerOrder(order);
                          setShowStickerModal(true);
                          soundManager.playScanBeep();
                        }}
                        className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition cursor-pointer flex items-center gap-1 border border-amber-200"
                        title="طباعة ملصق للجهاز (50mm × 30mm)"
                      >
                        <Barcode className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[11px] font-bold">ملصق</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTrackingOrder(order);
                          soundManager.playScanBeep();
                        }}
                        className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white transition cursor-pointer flex items-center gap-1 border border-purple-200"
                        title="رمز QR ورابط التتبع"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold">تتبع</span>
                      </button>

                      <a
                        href={getWhatsAppStatusLink(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition cursor-pointer"
                        title="إرسال إشعار وتحديث عبر واتساب"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleDeleteTicket(order)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="حذف كرت الصيانة"
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

      {/* BOTTOM SHEET MODAL: NEW MAINTENANCE TICKET */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-right">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">بيانات كرت استلام الجهاز الجديد</h3>
                  <p className="text-[11px] text-slate-400">فتح امر صيانة وتحديد تكلفة الإرشاد</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">اسم العميل:</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="مثال: عبدالمجيد المحواشي..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">رقم جوال العميل:</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="77XXXXXXX"
                      className="w-full bg-slate-50 border border-slate-200 font-mono rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right focus:bg-white"
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
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">فني الصيانة المسؤول:</label>
                    <input
                      type="text"
                      value={technicianName}
                      onChange={(e) => setTechnicianName(e.target.value)}
                      placeholder="اسم الفني (مثال: مهندس الورشة)"
                      className="w-full bg-slate-50 border border-slate-200 font-bold rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-purple-50/60 p-3 rounded-2xl border border-purple-100">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800">إجمالي المبلغ المطلوب من العميل:</label>
                    <input
                      type="number"
                      min="0"
                      value={cost || ''}
                      onChange={(e) => setCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="مثال: 15000"
                      className="w-full bg-white border border-slate-300 font-bold font-mono rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800">تكلفة قطع الغيار المستخدمة:</label>
                    <input
                      type="number"
                      min="0"
                      value={sparePartsCost || ''}
                      onChange={(e) => setSparePartsCost(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="مثال: 5000"
                      className="w-full bg-white border border-slate-300 font-bold font-mono rounded-xl px-3 py-2 text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2 flex justify-between items-center text-xs font-bold pt-1 border-t border-purple-200 text-purple-950">
                    <span>صافي أجور اليد والخدمة للورشة:</span>
                    <span className="font-black text-emerald-700 font-mono text-sm">
                      {(Math.max(0, (cost || 0) - (sparePartsCost || 0))).toLocaleString()} {currency}
                    </span>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                {/* Quick Device Checklist Grid */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
                    <span>📋 قائمة الفحص السريع للجهاز عند الاستلام:</span>
                    <span className="text-[10px] text-slate-400 font-normal">تحديد حالة المكونات</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    {[
                      { key: 'screen', label: '🖥️ الشاشة' },
                      { key: 'battery', label: '🔋 البطارية' },
                      { key: 'camera', label: '📷 الكاميرا' },
                      { key: 'fingerprint', label: '👆 البصمة/الوجه' },
                      { key: 'sound', label: '🔊 الصوت/السماعة' },
                      { key: 'power', label: '⚡ الباور/الشحن' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-[11px]">
                        <span className="font-bold text-slate-700">{item.label}</span>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playScanBeep();
                              setChecklist(prev => ({ ...prev, [item.key]: 'intact' }));
                            }}
                            className={`px-1.5 py-0.5 rounded transition ${
                              checklist[item.key as keyof DeviceChecklist] === 'intact'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            سليمة
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playScanBeep();
                              setChecklist(prev => ({ ...prev, [item.key]: 'damaged' }));
                            }}
                            className={`px-1.5 py-0.5 rounded transition ${
                              checklist[item.key as keyof DeviceChecklist] === 'damaged'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            تالفة
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playScanBeep();
                              setChecklist(prev => ({ ...prev, [item.key]: 'untested' }));
                            }}
                            className={`px-1.5 py-0.5 rounded transition ${
                              checklist[item.key as keyof DeviceChecklist] === 'untested'
                                ? 'bg-slate-700 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            لم تفحص
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  تثبيت وطباعة كرت الاستلام
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MAINTENANCE DEVICE STICKER MODAL (50mm x 30mm) */}
      <MaintenanceStickerModal
        isOpen={showStickerModal}
        onClose={() => setShowStickerModal(false)}
        order={stickerOrder}
        storeName={storeName}
        currency={currency}
      />

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 text-right">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-100">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">تأكيد حذف كرت الصيانة</h3>
                <p className="text-xs text-slate-500 font-mono">#{deleteTargetOrder.orderNumber}</p>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-700 leading-relaxed">
              هل أنت تأكد من حذف كرت الصيانة الخاص بالعميل <span className="text-slate-900 font-black">({deleteTargetOrder.customerName})</span> للجهاز <span className="text-slate-900 font-black">({deleteTargetOrder.deviceName})</span>؟
              <br />
              <span className="text-[11px] text-rose-500 font-normal">سيتم حذف الكرت نهائياً وتحديث العدادات والمصفوفة فوراً.</span>
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  onDeleteOrder(deleteTargetOrder.id);
                  setDeleteTargetOrder(null);
                  soundManager.playScanBeep();
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm active:scale-95"
              >
                تأكيد الحذف النهائي
              </button>
              <button
                onClick={() => setDeleteTargetOrder(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER QR TRACKING MODAL */}
      {trackingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 text-center relative">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 text-right">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">رمز وقناة تتبع الصيانة</h3>
                  <p className="text-[10px] text-slate-500 font-mono">كرت رقم #{trackingOrder.orderNumber}</p>
                </div>
              </div>

              <button
                onClick={() => setTrackingOrder(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Card Presentation */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs inline-block mx-auto">
                <QRCodeSVG
                  value={getTrackingUrl(trackingOrder)}
                  size={160}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="text-xs space-y-1 text-right bg-white p-3 rounded-xl border border-slate-200 font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-500">العميل:</span>
                  <span className="font-bold text-slate-900">{trackingOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الجهاز:</span>
                  <span className="font-bold text-slate-800">{trackingOrder.deviceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">حالة الجهاز:</span>
                  <span className="font-bold text-blue-600">
                    {trackingOrder.status === 'received' ? 'استلام (تحت الفحص)' :
                     trackingOrder.status === 'repairing' ? 'جاري الصيانة بالورشة' :
                     trackingOrder.status === 'completed' ? 'جاهز للاستلام ✓' : 'تم التسليم'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getTrackingUrl(trackingOrder));
                  setIsCopied(true);
                  soundManager.playScanBeep();
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                <span>{isCopied ? 'تم نسخ رابط التتبع!' : 'نسخ رابط التتبع للعميل'}</span>
              </button>

              <a
                href={getWhatsAppStatusLink(trackingOrder)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20"
              >
                <Send className="w-4 h-4" />
                <span>إرسال بطاقة التتبع عبر الواتساب</span>
              </a>
            </div>

          </div>
        </div>
      )}

      {/* HIDDEN PRINTABLE CONTAINER FOR PDF EXPORT */}
      <div
        id="maintenance-tab-pdf-printable-report"
        className="bg-white text-slate-900 p-8 font-sans"
        style={{ display: 'none', width: '820px', direction: 'rtl' }}
      >
        {/* Document Header */}
        <div className="border-b-2 border-purple-900 pb-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-purple-950">
              {storeName || 'مركز الصيانة والورشة الفنية المعتمدة'}
            </h1>
            <h2 className="text-base font-bold text-slate-700 mt-1">
              تقرير كروت الصيانة والأداء الشهري المالي
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
            </p>
          </div>
          <div className="text-left font-mono bg-purple-50 p-3 rounded-xl border border-purple-200">
            <span className="text-xs text-purple-800 font-sans font-bold block">نوع السند:</span>
            <span className="text-sm font-black text-purple-950">تقرير صيانة شهري رسمـي</span>
          </div>
        </div>

        {/* Financial KPI Grid */}
        <div className="grid grid-cols-4 gap-3 mb-6 font-mono text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-sans font-bold text-slate-500 block">إجمالي كروت الصيانة</span>
            <span className="text-lg font-black text-slate-900">{orders.length} جهاز</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-sans font-bold text-slate-500 block">الأجهزة المنجزة</span>
            <span className="text-lg font-black text-emerald-600">{completedOrders.length} جهاز</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-sans font-bold text-slate-500 block">تكلفة قطع الغيار</span>
            <span className="text-lg font-black text-rose-600">{(totalSpareParts || 0).toLocaleString()} {currency}</span>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-300">
            <span className="text-xs font-sans font-bold text-purple-800 block">صافي ربح أجور اليد</span>
            <span className="text-lg font-black text-emerald-600">{(totalLaborFees || 0).toLocaleString()} {currency}</span>
          </div>
        </div>

        {/* Orders Detailed Table */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-purple-950 mb-2 border-r-4 border-purple-700 pr-2">
            📋 كشف وسجل كروت صيانة الورشة الفنية:
          </h3>
          <table className="w-full text-[11px] text-right border-collapse border border-slate-300">
            <thead>
              <tr className="bg-purple-900 text-white font-bold">
                <th className="p-2 border border-purple-800">رقم الكرت</th>
                <th className="p-2 border border-purple-800">العميل والهاتف</th>
                <th className="p-2 border border-purple-800">الجهاز والعطل</th>
                <th className="p-2 border border-purple-800">الفني</th>
                <th className="p-2 border border-purple-800 text-center">الحالة</th>
                <th className="p-2 border border-purple-800 text-center">التكلفة الإجمالية</th>
                <th className="p-2 border border-purple-800 text-center">أجور اليد</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">لا توجد كروت صيانة مسجلة.</td>
                </tr>
              ) : (
                orders.map((o, i) => {
                  const spare = o.sparePartsCost || 0;
                  const labor = o.laborFee ?? Math.max(0, (o.cost || 0) - spare);
                  return (
                    <tr key={o.id} className={i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="p-2 border border-slate-300 font-mono font-bold">#{o.orderNumber || ''}</td>
                      <td className="p-2 border border-slate-300">
                        <div className="font-bold">{o.customerName || 'عميل'}</div>
                        <div className="text-[9px] text-slate-500 font-mono">{o.customerPhone || ''}</div>
                      </td>
                      <td className="p-2 border border-slate-300">
                        <div className="font-bold">{o.deviceName || 'جهاز'}</div>
                        <div className="text-[9px] text-slate-500">{o.issueDescription || ''}</div>
                      </td>
                      <td className="p-2 border border-slate-300 font-bold">{o.technicianName || 'الورشة'}</td>
                      <td className="p-2 border border-slate-300 text-center font-bold">
                        {o.status === 'received' ? 'مستلم' :
                         o.status === 'repairing' ? 'جاري الصيانة' :
                         o.status === 'completed' ? 'جاهز للاستلام' : 'تم التسليم'}
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-bold">{(o.cost || 0).toLocaleString()} {currency}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-bold text-emerald-700">{(labor || 0).toLocaleString()} {currency}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t-2 border-slate-300 flex justify-between items-center text-xs text-slate-600 font-bold">
          <div>
            <span>توقيع وختم مهندس الورشة والإدارة: ______________________</span>
          </div>
          <div className="text-left font-mono">
            <span>تم الاستخراج عبر نظام سند المحاسبي</span>
          </div>
        </div>
      </div>

    </div>
  );
}
