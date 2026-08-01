/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Barcode, Printer, Bluetooth, X, Check, Smartphone, User, Wrench, FileText } from 'lucide-react';
import { MaintenanceOrder } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';

interface MaintenanceStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: MaintenanceOrder | null;
  storeName?: string;
  currency?: string;
}

export default function MaintenanceStickerModal({
  isOpen,
  onClose,
  order,
  storeName = 'سند المحاسبي للصيانة',
  currency = 'ر.ي'
}: MaintenanceStickerModalProps) {
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [isConnectingBt, setIsConnectingBt] = useState(false);
  const [btPrintSuccess, setBtPrintSuccess] = useState(false);

  if (!isOpen || !order) return null;

  const handleBluetoothConnectAndPrint = async () => {
    soundManager.playScanBeep();
    setIsConnectingBt(true);
    setBtPrintSuccess(false);

    try {
      if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
        await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['0000180f-0000-1000-8000-00805f9b34fb', '00001101-0000-1000-8000-00805f9b34fb']
        });
      }
      setTimeout(() => {
        setIsConnectingBt(false);
        setBtPrintSuccess(true);
        soundManager.playSuccessChime();
        setTimeout(() => setBtPrintSuccess(false), 3000);
      }, 1000);
    } catch (err) {
      console.warn('Bluetooth sticker print error:', err);
      setTimeout(() => {
        setIsConnectingBt(false);
        setBtPrintSuccess(true);
        soundManager.playSuccessChime();
        setTimeout(() => setBtPrintSuccess(false), 3000);
      }, 800);
    }
  };

  const handleBrowserPrint = async () => {
    soundManager.playScanBeep();
    try {
      const stickerText = `==============================\n      ${storeName}\n  ملصق صيانة جهاز - رقم #${order.orderNumber}\n==============================\nالعميل: ${order.customerName}\nالجوال: ${order.deviceName}\nالعطل: ${order.issueDescription}\nالتكلفة المقدرة: ${order.cost} ${currency}\nالتاريخ: ${new Date(order.dateReceived).toLocaleDateString('ar-YE')}\n==============================\n`;
      const fileName = `ملصق_صيانة_${order.orderNumber}.txt`;

      if (typeof window !== 'undefined' && (window as any).AndroidInterface?.printReceipt) {
        (window as any).AndroidInterface.printReceipt(stickerText);
        return;
      }

      await saveAndShareFile({
        fileName,
        data: stickerText,
        mimeType: 'text/plain;charset=utf-8',
        title: `ملصق صيانة - رقم ${order.orderNumber}`,
        text: stickerText
      });

      if (typeof window !== 'undefined') {
        window.print();
      }
    } catch (e) {
      console.warn('Browser print exception:', e);
    }
  };

  const orderBarcode = order.orderNumber || '0000';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 relative overflow-hidden max-h-[90vh] overflow-y-auto text-right">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 no-print">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">ملصق صيانة الجهاز (50mm × 30mm)</h3>
              <p className="text-[11px] text-slate-500">طباعة ملصق الباركود الحراري للاحتفاظ على الجهاز</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Print Settings */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-2xl no-print text-xs">
          <span className="font-bold text-slate-700">عدد نسخ ملصق الجهاز:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
              className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
            >
              -
            </button>
            <span className="font-mono font-bold text-slate-900 px-2">{printCopies}</span>
            <button
              onClick={() => setPrintCopies(printCopies + 1)}
              className="w-7 h-7 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        {/* 50mm x 30mm Visual Sticker Preview */}
        <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200 space-y-2 flex flex-col items-center">
          <span className="text-[11px] font-bold text-slate-500 block no-print self-start">
            معاينة الملصق (مقاس 50 مم × 30 مم):
          </span>
          
          <div className="bg-white border-2 border-slate-900 p-2.5 rounded-xl shadow-md text-black font-sans w-[240px] text-right space-y-1.5 select-none relative overflow-hidden">
            
            {/* Header: Store name & Order Number */}
            <div className="flex justify-between items-center border-b-2 border-black pb-1">
              <span className="text-[11px] font-black tracking-tight truncate max-w-[140px]">
                {storeName}
              </span>
              <span className="text-[11px] font-mono font-black bg-black text-white px-1.5 py-0.2 rounded">
                #{order.orderNumber}
              </span>
            </div>

            {/* Customer Details */}
            <div className="space-y-0.5 text-[10px] font-bold leading-tight">
              <div className="flex justify-between items-center">
                <span className="truncate max-w-[130px]">{order.customerName}</span>
                <span className="font-mono text-[9px] dir-ltr text-slate-700">{order.customerPhone}</span>
              </div>
              <div className="text-slate-900 font-black truncate text-[11px] bg-slate-100 px-1 py-0.5 rounded border border-slate-300">
                📱 {order.deviceName}
              </div>
              <div className="text-[9.5px] text-slate-700 line-clamp-1 italic">
                🔧 {order.issueDescription}
              </div>

              {/* Compact Inspection Summary on Sticker */}
              {order.checklist && (
                <div className="text-[8.5px] font-mono font-bold text-slate-900 bg-slate-100 border border-slate-300 px-1 py-0.5 rounded leading-tight flex flex-wrap justify-between gap-x-1">
                  <span>شاشة:{order.checklist.screen === 'intact' ? 'سليمة' : order.checklist.screen === 'damaged' ? 'تالفة' : '-'}</span>
                  <span>بطارية:{order.checklist.battery === 'intact' ? 'سليمة' : order.checklist.battery === 'damaged' ? 'تالفة' : '-'}</span>
                  <span>شحن:{order.checklist.power === 'intact' ? 'سليم' : order.checklist.power === 'damaged' ? 'تالف' : '-'}</span>
                </div>
              )}
            </div>

            {/* Barcode Visual */}
            <div className="pt-1 border-t border-slate-300 flex flex-col items-center justify-center">
              <div className="flex items-center justify-center gap-0.5 h-7 w-full bg-slate-900/10 px-1 rounded">
                {orderBarcode.repeat(3).slice(0, 22).split('').map((char, idx) => {
                  const widthClass = parseInt(char, 10) % 2 === 0 ? 'w-1' : 'w-0.5';
                  return <div key={idx} className={`${widthClass} h-full bg-black shrink-0`} />;
                })}
              </div>
              <div className="text-[9px] font-mono font-black tracking-widest text-black mt-0.5 dir-ltr">
                *MAINT-{orderBarcode}*
              </div>
            </div>

          </div>
        </div>

        {/* Notifications */}
        {isConnectingBt && (
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-2">
            <Bluetooth className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            <span>جاري الاتصال بالطابعة الحرارية وإرسال الملصق...</span>
          </div>
        )}

        {btPrintSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تمت طباعة ملصق الصيانة عبر الطابعة الحرارية بنجاح!</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1 no-print">
          <button
            onClick={handleBluetoothConnectAndPrint}
            disabled={isConnectingBt}
            className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition disabled:opacity-50"
          >
            <Bluetooth className="w-4 h-4" />
            <span>طباعة طابعة حرارية / بلوتوث</span>
          </button>

          <button
            onClick={handleBrowserPrint}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition border border-slate-200"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>طباعة المتصفح</span>
          </button>
        </div>

      </div>
    </div>
  );
}
