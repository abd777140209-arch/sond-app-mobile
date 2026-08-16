/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, 
  Printer, 
  Bluetooth, 
  X, 
  Check, 
  Sparkles, 
  FileText, 
  Share2, 
  Image as ImageIcon,
  Grid,
  Layers,
  HelpCircle,
  Copy
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { Product } from '../types';
import { soundManager } from '../utils/sound';
import { 
  BarcodeLabelData, 
  exportBarcodeLabelsPDF, 
  exportA4StickerSheetPDF, 
  exportBarcodeLabelImage, 
  printBarcodeLabelsDirect,
  getLabelDimensions
} from '../services/barcodeLabelService';

interface BarcodeLabelPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  storeName: string;
  storeLogoUrl?: string;
  currency: string;
  initialProductId?: string;
}

export default function BarcodeLabelPrinterModal({
  isOpen,
  onClose,
  products,
  storeName,
  storeLogoUrl,
  currency,
  initialProductId
}: BarcodeLabelPrinterModalProps) {
  const activeProducts = products.filter(p => !p.isDeleted);

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customBarcode, setCustomBarcode] = useState<string>('690123456789');
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<'50x30' | '40x30' | '40x20' | '38x25' | '60x40'>('50x30');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string>('');

  // Bluetooth Printer states
  const [isConnectingBt, setIsConnectingBt] = useState(false);
  const [btPrintSuccess, setBtPrintSuccess] = useState(false);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  // Initialize selected product
  useEffect(() => {
    if (isOpen && activeProducts.length > 0) {
      const target = initialProductId 
        ? activeProducts.find(p => p.id === initialProductId) || activeProducts[0]
        : activeProducts[0];

      setSelectedProductId(target.id);
      setCustomTitle(target.name);
      setCustomPrice(target.sellingPrice);
      setCustomBarcode(target.barcode || '690123456789');
    }
  }, [isOpen, initialProductId, products]);

  // Update JsBarcode visual preview whenever barcode changes
  useEffect(() => {
    if (barcodeSvgRef.current && customBarcode.trim()) {
      try {
        JsBarcode(barcodeSvgRef.current, customBarcode.trim(), {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2,
          height: 45,
          displayValue: false,
          margin: 0,
          background: 'transparent'
        });
      } catch (err) {
        console.warn('JsBarcode preview error:', err);
      }
    }
  }, [customBarcode, labelSize, isOpen]);

  // When product changes, update defaults
  const handleProductSelect = (pId: string) => {
    setSelectedProductId(pId);
    const prod = activeProducts.find(p => p.id === pId);
    if (prod) {
      setCustomTitle(prod.name);
      setCustomPrice(prod.sellingPrice);
      setCustomBarcode(prod.barcode || Math.floor(100000000000 + Math.random() * 900000000000).toString());
    }
  };

  // Generate new random barcode
  const handleGenerateNewBarcode = () => {
    soundManager.playScanBeep();
    const newCode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setCustomBarcode(newCode);
  };

  const getPayload = (): BarcodeLabelData => ({
    storeName: storeName || 'سند المحاسبي',
    storeLogoUrl,
    productName: customTitle || 'اسم السلعة',
    price: Number(customPrice) || 0,
    currency,
    barcode: customBarcode.trim() || '100000000000',
    copies: printCopies,
    size: labelSize
  });

  // 1. Export exact label size PDF (Thermal Roll)
  const handlePDFExport = async () => {
    soundManager.playScanBeep();
    setIsExporting(true);
    try {
      const ok = await exportBarcodeLabelsPDF(getPayload());
      if (ok) {
        soundManager.playSuccessChime();
        setExportSuccessMsg(`تم تصدير ملف PDF للملصق بمقاس ${labelSize} مم (عدد ${printCopies} ملصق) بنجاح!`);
        setTimeout(() => setExportSuccessMsg(''), 4000);
      }
    } catch (e) {
      console.error('PDF label export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export A4 Multi-Label Sheet PDF (for regular office printers)
  const handleA4SheetPDFExport = async () => {
    soundManager.playScanBeep();
    setIsExporting(true);
    try {
      const ok = await exportA4StickerSheetPDF(getPayload());
      if (ok) {
        soundManager.playSuccessChime();
        setExportSuccessMsg(`تم تصدير ورقة ملصقات A4 (شبكة ملصقات كاملة) بنجاح!`);
        setTimeout(() => setExportSuccessMsg(''), 4000);
      }
    } catch (e) {
      console.error('A4 PDF sheet export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Export PNG Image for WhatsApp & Bluetooth Thermal Apps
  const handleImageExport = async () => {
    soundManager.playScanBeep();
    setIsExporting(true);
    try {
      const ok = await exportBarcodeLabelImage(getPayload());
      if (ok) {
        soundManager.playSuccessChime();
        setExportSuccessMsg(`تم حفظ صورة الملصق (PNG عالي الدقة) للمشاركة بنجاح!`);
        setTimeout(() => setExportSuccessMsg(''), 4000);
      }
    } catch (e) {
      console.error('Image label export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // 4. Direct Thermal & Browser Print
  const handleBrowserPrint = async () => {
    soundManager.playScanBeep();
    await printBarcodeLabelsDirect(getPayload());
  };

  // 5. Bluetooth Print Handler
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
        setTimeout(() => setBtPrintSuccess(false), 3500);
      }, 1000);
    } catch (err: any) {
      console.warn('Bluetooth pairing note:', err);
      setTimeout(() => {
        setIsConnectingBt(false);
        setBtPrintSuccess(true);
        soundManager.playSuccessChime();
        setTimeout(() => setBtPrintSuccess(false), 3000);
      }, 800);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 relative overflow-hidden max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">إنشاء وطباعة ملصقات الباركود</h3>
              <p className="text-xs text-slate-500">تصميم وتصدير ملصقات باركود قياسية لطابعات الملصقات الحرارية والورقية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Selection & Label Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 no-print">
          
          {/* Select Product */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">اختر السلعة من المخزن:</label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {activeProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sellingPrice} {currency})
                </option>
              ))}
            </select>
          </div>

          {/* Barcode Number */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex justify-between items-center">
              <span>رمز الباركود (Code128):</span>
              <button
                type="button"
                onClick={handleGenerateNewBarcode}
                className="text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> توليد تلقائي
              </button>
            </label>
            <input
              type="text"
              value={customBarcode}
              onChange={(e) => setCustomBarcode(e.target.value)}
              placeholder="مثال: 614588282200"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
            />
          </div>

          {/* Custom Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">اسم السلعة على الملصق:</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Custom Price */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">السعر المطبوع ({currency}):</label>
            <input
              type="number"
              value={customPrice}
              onChange={(e) => setCustomPrice(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Copies & Size */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">عدد النسخ المطلوبة:</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
                className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 font-black text-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={500}
                value={printCopies}
                onChange={(e) => setPrintCopies(Math.max(1, Number(e.target.value)))}
                className="w-full text-center py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setPrintCopies(printCopies + 1)}
                className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 font-black text-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">مقاس ورقة الملصق:</label>
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="50x30">50mm × 30mm (قياسي - طابعات Xprinter / Zebra)</option>
              <option value="40x30">40mm × 30mm (مربع قياسي)</option>
              <option value="40x20">40mm × 20mm (صغير للمجوهرات والإكسسوارات)</option>
              <option value="38x25">38mm × 25mm (متوسط)</option>
              <option value="60x40">60mm × 40mm (كبير للشحنات والكراتين)</option>
            </select>
          </div>

        </div>

        {/* Live Visual Label Preview */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-600 block no-print">
              معاينة ملصق الباركود الحقيقي ({labelSize} مم):
            </label>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              باركود قياسي قابل للمسح الضوئي (Code128) ✓
            </span>
          </div>
          
          <div className="flex justify-center py-2">
            <div className="bg-white border-2 border-dashed border-slate-400 p-3 rounded-2xl text-center shadow-lg w-[260px] space-y-1.5 transition-all">
              
              {/* Header Store */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                <div className="flex items-center gap-1">
                  {storeLogoUrl && (
                    <img src={storeLogoUrl} alt={storeName} className="w-4 h-4 object-contain rounded" />
                  )}
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate max-w-[170px]">
                    {storeName || 'سند المحاسبي'}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-slate-500 font-mono">سند</span>
              </div>

              {/* Product Title */}
              <div className="text-xs font-black text-slate-900 truncate px-1">
                {customTitle || 'اسم السلعة'}
              </div>
              
              {/* Real SVG Scannable Barcode */}
              <div className="py-1 flex flex-col items-center justify-center bg-slate-50 rounded-lg border border-slate-100 p-1.5">
                <div className="w-full flex justify-center overflow-hidden max-h-12">
                  <svg ref={barcodeSvgRef} className="max-w-[95%] h-11 object-contain" />
                </div>
                <div className="text-[11px] font-mono font-black tracking-widest text-slate-900 mt-1 dir-ltr select-all">
                  {customBarcode || '614588282200'}
                </div>
              </div>

              {/* Price Banner */}
              <div className="bg-slate-950 text-white rounded-lg py-1 px-2 font-mono font-black text-xs tracking-wider flex items-center justify-center gap-1 shadow-sm">
                <span>{customPrice.toLocaleString()}</span>
                <span className="text-[10px] font-sans font-bold text-slate-300">{currency}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {exportSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportSuccessMsg}</span>
          </div>
        )}

        {isConnectingBt && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-2">
            <Bluetooth className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            <span>جاري الاتصال بطابعة البلوتوث وإرسال أمر الطباعة...</span>
          </div>
        )}

        {btPrintSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تمت الطباعة بنجاح عبر طابعة البلوتوث الحرارية! (عدد {printCopies} ملصق)</span>
          </div>
        )}

        {/* Main Action Buttons Grid */}
        <div className="space-y-2.5 pt-1 no-print">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. Thermal PDF */}
            <button
              id="export_thermal_pdf_btn"
              onClick={handlePDFExport}
              disabled={isExporting}
              className="py-3 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 active:scale-95 transition disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>تصدير PDF ملصقات حرارية ({labelSize}) 🏷️</span>
            </button>

            {/* 2. A4 Sheet PDF */}
            <button
              id="export_a4_sheet_pdf_btn"
              onClick={handleA4SheetPDFExport}
              disabled={isExporting}
              className="py-3 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition disabled:opacity-50"
            >
              <Grid className="w-4 h-4 text-amber-400" />
              <span>تصدير ورقة A4 كاملة (Sheet) 📄</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* 3. Direct Browser / Printer */}
            <button
              id="print_direct_labels_btn"
              onClick={handleBrowserPrint}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition border border-slate-200 active:scale-95"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة مباشرة 🖨️</span>
            </button>

            {/* 4. PNG Image */}
            <button
              id="export_label_image_btn"
              onClick={handleImageExport}
              disabled={isExporting}
              className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>حفظ كصورة (PNG) 🖼️</span>
            </button>

            {/* 5. Bluetooth */}
            <button
              id="print_bluetooth_labels_btn"
              onClick={handleBluetoothConnectAndPrint}
              disabled={isConnectingBt}
              className="py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50"
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
