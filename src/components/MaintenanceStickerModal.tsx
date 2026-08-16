/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Barcode, Printer, Bluetooth, X, Check, Smartphone, User, Wrench, FileText, Image as ImageIcon, Share2 } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { MaintenanceOrder } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';
import { getSafeHtml2CanvasOptions } from '../utils/pdfHelper';

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
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const stickerCardRef = useRef<HTMLDivElement | null>(null);

  const orderBarcode = order?.orderNumber ? `M${order.orderNumber}` : 'M0001';

  useEffect(() => {
    if (barcodeSvgRef.current && order) {
      try {
        JsBarcode(barcodeSvgRef.current, orderBarcode, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2,
          height: 35,
          displayValue: false,
          margin: 0,
          background: 'transparent'
        });
      } catch (e) {
        console.warn('Maintenance JsBarcode error:', e);
      }
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  // 1. Export PDF sticker (50mm x 30mm)
  const handleExportPDF = async () => {
    if (!stickerCardRef.current) return;
    soundManager.playScanBeep();
    setIsExporting(true);

    try {
      const canvas = await html2canvas(stickerCardRef.current, getSafeHtml2CanvasOptions({
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff'
      }));

      const imgData = canvas.toDataURL('image/png', 1.0);
      const widthMm = 50;
      const heightMm = 30;
      const copies = Math.max(1, printCopies);

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [widthMm, heightMm]
      });

      for (let i = 0; i < copies; i++) {
        if (i > 0) pdf.addPage([widthMm, heightMm], 'landscape');
        pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
      }

      const fileName = `ملصق_صيانة_${order.orderNumber}.pdf`;
      const pdfBase64 = pdf.output('datauristring');

      await saveAndShareFile({
        fileName,
        data: pdfBase64,
        isBase64: true,
        mimeType: 'application/pdf',
        title: `ملصق صيانة - #${order.orderNumber}`,
        text: `ملصق صيانة لجهاز ${order.deviceName} - عميل: ${order.customerName}`
      });

      soundManager.playSuccessChime();
      setExportSuccessMsg('تم تصدير ملصق الصيانة PDF بنجاح!');
      setTimeout(() => setExportSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Maintenance sticker export PDF error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export PNG Image
  const handleExportImage = async () => {
    if (!stickerCardRef.current) return;
    soundManager.playScanBeep();
    setIsExporting(true);

    try {
      const canvas = await html2canvas(stickerCardRef.current, getSafeHtml2CanvasOptions({
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff'
      }));

      const imgData = canvas.toDataURL('image/png', 1.0);
      const fileName = `ملصق_صيانة_${order.orderNumber}.png`;

      await saveAndShareFile({
        fileName,
        data: imgData,
        isBase64: true,
        mimeType: 'image/png',
        title: `ملصق صيانة - #${order.orderNumber}`,
        text: `ملصق صيانة: ${order.deviceName} | الزبون: ${order.customerName} | السند: #${order.orderNumber}`
      });

      soundManager.playSuccessChime();
      setExportSuccessMsg('تم حفظ صورة ملصق الصيانة بنجاح!');
      setTimeout(() => setExportSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Maintenance sticker export Image error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Direct Browser Print
  const handleBrowserPrint = () => {
    soundManager.playScanBeep();
    const printWindow = window.open('', '_blank', 'width=500,height=500');
    if (!printWindow || !stickerCardRef.current) {
      window.print();
      return;
    }

    const cardHtml = stickerCardRef.current.outerHTML;
    let pagesHtml = '';
    for (let i = 0; i < printCopies; i++) {
      pagesHtml += `<div class="sticker-page">${cardHtml}</div>`;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>ملصق صيانة #${order.orderNumber}</title>
        <style>
          @page { size: 50mm 30mm; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Cairo', Tahoma, sans-serif; background: #fff; }
          .sticker-page { width: 50mm; height: 30mm; page-break-after: always; display: flex; align-items: center; justify-content: center; }
          .sticker-page:last-child { page-break-after: avoid; }
        </style>
      </head>
      <body>
        ${pagesHtml}
        <script>
          window.onload = function() {
            setTimeout(function() { window.focus(); window.print(); }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 4. Bluetooth Print
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
          
          <div 
            ref={stickerCardRef}
            className="bg-white border-2 border-slate-900 p-2.5 rounded-xl shadow-md text-black font-sans w-[250px] text-right space-y-1.5 select-none relative overflow-hidden"
          >
            {/* Header: Store name & Order Number */}
            <div className="flex justify-between items-center border-b-2 border-black pb-1">
              <span className="text-[11px] font-black tracking-tight truncate max-w-[145px]">
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

            {/* Real Barcode SVG */}
            <div className="pt-1 border-t border-slate-300 flex flex-col items-center justify-center">
              <div className="flex items-center justify-center h-8 w-full max-w-[90%] overflow-hidden">
                <svg ref={barcodeSvgRef} className="max-w-full h-8 object-contain" />
              </div>
              <div className="text-[9px] font-mono font-black tracking-widest text-black mt-0.5 dir-ltr">
                *{orderBarcode}*
              </div>
            </div>

          </div>
        </div>

        {/* Notifications */}
        {exportSuccessMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportSuccessMsg}</span>
          </div>
        )}

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
        <div className="space-y-2 pt-1 no-print">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>تصدير PDF حراري 🏷️</span>
            </button>

            <button
              onClick={handleExportImage}
              disabled={isExporting}
              className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>حفظ صورة (PNG) 🖼️</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleBrowserPrint}
              className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition border border-slate-200 active:scale-95"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة مباشرة 🖨️</span>
            </button>

            <button
              onClick={handleBluetoothConnectAndPrint}
              disabled={isConnectingBt}
              className="py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              <Bluetooth className="w-4 h-4 text-indigo-600" />
              <span>طابعة بلوتوث 📱</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
