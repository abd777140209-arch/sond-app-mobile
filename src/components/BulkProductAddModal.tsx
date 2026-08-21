import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Layers, 
  Sparkles, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  DollarSign, 
  PackagePlus, 
  Copy,
  ScanLine
} from 'lucide-react';
import { Product } from '../types';
import { soundManager } from '../utils/sound';
import CameraBarcodeScannerModal from './CameraBarcodeScannerModal';

interface BulkProductRow {
  id: string;
  name: string;
  barcode: string;
  category: string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
  minStock: number;
}

interface BulkProductAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  categoriesList: string[];
  currency: string;
  onBulkAddProducts: (
    productsToAdd: Array<{
      name: string;
      barcode: string;
      costPrice: number;
      sellingPrice: number;
      stock: number;
      minStock: number;
      category: string;
    }>
  ) => void;
  onOpenSmartInvoiceScanner?: () => void;
}

export default function BulkProductAddModal({
  isOpen,
  onClose,
  existingProducts,
  categoriesList,
  currency,
  onBulkAddProducts,
  onOpenSmartInvoiceScanner
}: BulkProductAddModalProps) {
  const createEmptyRow = (cat?: string): BulkProductRow => ({
    id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: '',
    barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
    category: cat || categoriesList[0] || 'إكسسوارات',
    stock: 1,
    costPrice: 0,
    sellingPrice: 0,
    minStock: 2,
  });

  const [rows, setRows] = useState<BulkProductRow[]>(() => [
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);

  const [bulkCategory, setBulkCategory] = useState<string>(categoriesList[0] || 'إكسسوارات');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeBarcodeRowIndex, setActiveBarcodeRowIndex] = useState<number | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  if (!isOpen) return null;

  const handleUpdateRow = (index: number, field: keyof BulkProductRow, value: any) => {
    setRows(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      
      // Auto suggest selling price if cost price is entered and selling price is 0
      if (field === 'costPrice' && (!item.sellingPrice || item.sellingPrice === 0)) {
        const cost = parseFloat(value) || 0;
        if (cost > 0) {
          item.sellingPrice = Math.round(cost * 1.3);
        }
      }
      
      updated[index] = item;
      return updated;
    });
  };

  const handleAddRows = (count: number = 1) => {
    soundManager.playScanBeep();
    const newRows: BulkProductRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow(bulkCategory));
    }
    setRows(prev => [...prev, ...newRows]);
  };

  const handleDeleteRow = (index: number) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow()]);
      return;
    }
    soundManager.playWarningBeep();
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleDuplicateRow = (index: number) => {
    soundManager.playScanBeep();
    const source = rows[index];
    const newRow: BulkProductRow = {
      ...source,
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
    };
    setRows(prev => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newRow);
      return updated;
    });
  };

  const handleGenerateBarcode = (index: number) => {
    soundManager.playScanBeep();
    const newBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    handleUpdateRow(index, 'barcode', newBarcode);
  };

  const handleGenerateAllBarcodes = () => {
    soundManager.playScanBeep();
    setRows(prev => prev.map(r => ({
      ...r,
      barcode: r.barcode?.trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString()
    })));
  };

  const handleApplyCategoryToAll = () => {
    soundManager.playScanBeep();
    setRows(prev => prev.map(r => ({ ...r, category: bulkCategory })));
  };

  const handleScanBarcodeSuccess = (scanned: string) => {
    if (activeBarcodeRowIndex !== null) {
      handleUpdateRow(activeBarcodeRowIndex, 'barcode', scanned);
    }
    setShowBarcodeScanner(false);
    setActiveBarcodeRowIndex(null);
  };

  // Calculations
  const validRows = rows.filter(r => r.name.trim().length > 0);
  const totalCostSum = validRows.reduce((sum, r) => sum + (r.costPrice * r.stock), 0);
  const totalSellingSum = validRows.reduce((sum, r) => sum + (r.sellingPrice * r.stock), 0);
  const totalPieces = validRows.reduce((sum, r) => sum + r.stock, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (validRows.length === 0) {
      setErrorMsg('يرجى ملء اسم صنف واحد على الأقل في الجدول!');
      soundManager.playWarningBeep();
      return;
    }

    // Check barcode duplicates within the rows
    const barcodesSeen = new Set<string>();
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const code = r.barcode.trim();
      if (!code) {
        setErrorMsg(`الصنف "${r.name}" ينقصه الباركود! يمكنك توليد باركود تلقائي.`);
        soundManager.playWarningBeep();
        return;
      }
      if (barcodesSeen.has(code)) {
        setErrorMsg(`الباركود "${code}" مكرر لأكثر من صنف في هذا النموذج!`);
        soundManager.playWarningBeep();
        return;
      }
      barcodesSeen.add(code);
    }

    const payload = validRows.map(r => ({
      name: r.name.trim(),
      barcode: r.barcode.trim(),
      costPrice: Number(r.costPrice) || 0,
      sellingPrice: Number(r.sellingPrice) || 0,
      stock: Number(r.stock) || 0,
      minStock: Number(r.minStock) || 2,
      category: r.category || 'إكسسوارات'
    }));

    onBulkAddProducts(payload);
    soundManager.playSuccessChime();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-6xl max-h-[94vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>إضافة أصناف متعددة دفعة واحدة إلى المخزن</span>
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  إدخال سريع (جدول ذكي)
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                أدخل عدة بضائع وسلع بسرعة في جدول واحد مع توليد الباركود وحفظ الكل بضغطة زر واحدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSmartInvoiceScanner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSmartInvoiceScanner();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title="مسح فاتورة ورقية بالذكاء الاصطناعي"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">مسح فاتورة بالكاميرا 📸</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleAddRows(1)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ إضافة سطر</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRows(5)}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>+ 5 أسطر</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateAllBarcodes}
              className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 font-bold transition flex items-center gap-1 cursor-pointer"
              title="توليد باركود فريد للأسطر التي لا تحتوي على باركود"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>توليد باركود تلقائي للكل</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-bold">تطبيق تصنيف:</span>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 font-bold focus:ring-1 focus:ring-blue-500"
            >
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleApplyCategoryToAll}
              className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition cursor-pointer"
            >
              تطبيق على الكل
            </button>
          </div>
        </div>

        {/* Form & Table */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5 min-w-[200px]">اسم السلعة / الموديل <span className="text-rose-500">*</span></th>
                    <th className="p-2.5 min-w-[170px]">رمز الباركود <span className="text-rose-500">*</span></th>
                    <th className="p-2.5 min-w-[120px]">التصنيف</th>
                    <th className="p-2.5 min-w-[80px]">الكمية</th>
                    <th className="p-2.5 min-w-[100px]">سعر التكلفة</th>
                    <th className="p-2.5 min-w-[100px]">سعر البيع</th>
                    <th className="p-2.5 min-w-[80px]">حد التنبيه</th>
                    <th className="p-2.5 text-center min-w-[70px]">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rows.map((row, idx) => {
                    const isFilled = row.name.trim().length > 0;
                    return (
                      <tr 
                        key={row.id} 
                        className={`transition ${isFilled ? 'bg-blue-50/20 hover:bg-blue-50/40' : 'hover:bg-slate-50'}`}
                      >
                        <td className="p-2 text-slate-400 font-mono font-bold text-center">
                          {idx + 1}
                        </td>

                        <td className="p-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleUpdateRow(idx, 'name', e.target.value)}
                            placeholder="مثال: شاشة سامسونج A12، كفر جلد..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={row.barcode}
                              onChange={(e) => handleUpdateRow(idx, 'barcode', e.target.value)}
                              placeholder="امسح أو اكتب الباركود..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-[11px] text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleGenerateBarcode(idx)}
                              title="توليد باركود تلقائي"
                              className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg shrink-0 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveBarcodeRowIndex(idx);
                                setShowBarcodeScanner(true);
                              }}
                              title="مسح بالكاميرا"
                              className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg shrink-0 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="p-2">
                          <select
                            value={row.category}
                            onChange={(e) => handleUpdateRow(idx, 'category', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 font-bold focus:bg-white focus:ring-1 focus:ring-blue-500"
                          >
                            {categoriesList.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            value={row.stock}
                            onChange={(e) => handleUpdateRow(idx, 'stock', Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono font-bold text-center text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            value={row.costPrice || ''}
                            onChange={(e) => handleUpdateRow(idx, 'costPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            value={row.sellingPrice || ''}
                            onChange={(e) => handleUpdateRow(idx, 'sellingPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="0"
                            className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 font-mono font-bold text-emerald-800 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            value={row.minStock}
                            onChange={(e) => handleUpdateRow(idx, 'minStock', Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-center text-slate-700 focus:bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(idx)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                              title="تكرار السطر"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="حذف السطر"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Summary & Submit */}
          <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 border-t border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
                <span>الأصناف المجهزة: <strong className="text-emerald-400">{validRows.length} صنف</strong></span>
                <span>إجمالي القطع: <strong className="text-white">{totalPieces} قطعة</strong></span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-200 font-mono flex items-center gap-3">
                <span>إجمالي التكلفة: <strong className="text-amber-400">{totalCostSum.toLocaleString()} {currency}</strong></span>
                <span>•</span>
                <span>إجمالي المبيعات المتوقعة: <strong className="text-emerald-400">{totalSellingSum.toLocaleString()} {currency}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={validRows.length === 0}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ وإضافة جميع الأصناف للمخزن ({validRows.length})</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>

      {/* Barcode Camera Modal */}
      {showBarcodeScanner && (
        <CameraBarcodeScannerModal
          isOpen={showBarcodeScanner}
          onClose={() => {
            setShowBarcodeScanner(false);
            setActiveBarcodeRowIndex(null);
          }}
          onScanSuccess={handleScanBarcodeSuccess}
        />
      )}
    </div>
  );
}
