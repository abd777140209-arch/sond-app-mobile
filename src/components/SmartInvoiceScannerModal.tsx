import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Camera, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Trash2, 
  Plus, 
  Barcode, 
  FileSpreadsheet, 
  RefreshCw,
  DollarSign,
  Building2,
  Calendar,
  Hash,
  ShoppingBag
} from 'lucide-react';
import { Product } from '../types';
import { soundManager } from '../utils/sound';
import { parseInvoiceImageWithGemini, ParsedInvoiceResult, ParsedInvoiceItem } from '../services/GoogleAIService';
import CameraBarcodeScannerModal from './CameraBarcodeScannerModal';

interface SmartInvoiceScannerModalProps {
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
    }>,
    purchaseMetadata?: {
      supplierName?: string;
      invoiceNumber?: string;
      totalAmount?: number;
      recordAsExpense?: boolean;
    }
  ) => void;
}

export default function SmartInvoiceScannerModal({
  isOpen,
  onClose,
  existingProducts,
  categoriesList,
  currency,
  onBulkAddProducts,
}: SmartInvoiceScannerModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedInvoiceResult | null>(null);
  const [editableItems, setEditableItems] = useState<ParsedInvoiceItem[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordAsExpense, setRecordAsExpense] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeBarcodeRowIndex, setActiveBarcodeRowIndex] = useState<number | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleImageSelected = (file: File) => {
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setSelectedImage(base64);
      processInvoiceImage(base64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const processInvoiceImage = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setErrorMsg('');
    soundManager.playScanBeep();

    try {
      const result = await parseInvoiceImageWithGemini(base64, mimeType, categoriesList);
      setParsedData(result);
      setSupplierName(result.supplierName || '');
      setInvoiceNumber(result.invoiceNumber || `INV-${Math.floor(10000 + Math.random() * 90000)}`);
      setInvoiceDate(result.invoiceDate || new Date().toISOString().split('T')[0]);

      // Assign unique random barcodes for rows that don't have one
      const preparedItems = result.items.map((it) => {
        let code = it.barcode?.trim();
        if (!code) {
          // Check if already exists in system by name
          const existing = existingProducts.find(
            p => p.isDeleted !== true && p.name.trim().toLowerCase() === it.name.trim().toLowerCase()
          );
          if (existing) {
            code = existing.barcode;
          } else {
            code = Math.floor(100000000000 + Math.random() * 900000000000).toString();
          }
        }
        return {
          ...it,
          barcode: code
        };
      });

      setEditableItems(preparedItems);
      soundManager.playSuccessChime();
    } catch (err: any) {
      console.error('Invoice parsing error:', err);
      setErrorMsg('تعذر تحليل صورة الفاتورة، يرجى المحاولة مرة أخرى أو إدخال الأصناف يدوياً.');
      soundManager.playWarningBeep();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateItem = (index: number, field: keyof ParsedInvoiceItem, value: any) => {
    setEditableItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'costPrice' || field === 'quantity') {
        item.total = (Number(item.costPrice) || 0) * (Number(item.quantity) || 0);
      }
      updated[index] = item;
      return updated;
    });
  };

  const handleDeleteItem = (index: number) => {
    soundManager.playWarningBeep();
    setEditableItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNewItem = () => {
    soundManager.playScanBeep();
    const newItem: ParsedInvoiceItem = {
      name: '',
      quantity: 1,
      costPrice: 0,
      sellingPrice: 0,
      category: categoriesList[0] || 'إكسسوارات',
      barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      total: 0
    };
    setEditableItems(prev => [...prev, newItem]);
  };

  const handleGenerateBarcodeForRow = (index: number) => {
    soundManager.playScanBeep();
    const newBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    handleUpdateItem(index, 'barcode', newBarcode);
  };

  const handleScanBarcodeSuccess = (scanned: string) => {
    if (activeBarcodeRowIndex !== null) {
      handleUpdateItem(activeBarcodeRowIndex, 'barcode', scanned);
    }
    setShowBarcodeScanner(false);
    setActiveBarcodeRowIndex(null);
  };

  // Calculations
  const totalInvoiceSum = editableItems.reduce(
    (sum, it) => sum + ((Number(it.costPrice) || 0) * (Number(it.quantity) || 0)), 
    0
  );
  const totalPiecesCount = editableItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

  const handleConfirmAndImport = () => {
    if (editableItems.length === 0) {
      setErrorMsg('لا توجد أصناف في الجدول للاعتماد!');
      soundManager.playWarningBeep();
      return;
    }

    // Validation
    for (let i = 0; i < editableItems.length; i++) {
      const it = editableItems[i];
      if (!it.name.trim()) {
        setErrorMsg(`السطر رقم ${i + 1}: اسم الصنف مطلوب!`);
        soundManager.playWarningBeep();
        return;
      }
      if (!it.barcode?.trim()) {
        setErrorMsg(`السطر رقم ${i + 1}: الباركود مطلوب!`);
        soundManager.playWarningBeep();
        return;
      }
    }

    const payload = editableItems.map(it => ({
      name: it.name.trim(),
      barcode: (it.barcode || '').trim(),
      costPrice: Number(it.costPrice) || 0,
      sellingPrice: Number(it.sellingPrice) || Math.round((Number(it.costPrice) || 0) * 1.3),
      stock: Number(it.quantity) || 1,
      minStock: 2,
      category: it.category || 'إكسسوارات'
    }));

    onBulkAddProducts(payload, {
      supplierName: supplierName.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      totalAmount: totalInvoiceSum,
      recordAsExpense
    });

    soundManager.playSuccessChime();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-5xl max-h-[94vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>مسح وإدخال الفاتورة بالذكاء الاصطناعي (Smart OCR)</span>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Gemini 3.7 Vision
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                صوّر فاتورة المشتريات الورقية وسيقوم الذكاء الاصطناعي باستخراج كافة الأصناف والأسعار في ثوانٍ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Upload / Capture Section */}
          {!selectedImage ? (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 sm:p-10 text-center bg-slate-50/50 hover:bg-slate-50 transition space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <Camera className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900">
                  التقط صورة الفاتورة أو ارفع ملف من جهازك
                </h3>
                <p className="text-xs text-slate-500">
                  يدعم فواتير المشتريات الورقية، سندات القبض، وفواتير الموزعين المطبوعة واليدوية
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageSelected(e.target.files[0]);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-5 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>تصوير بكاميرا الهاتف 📸</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageSelected(e.target.files[0]);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span>اختيار صورة من المعرض 🖼️</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Top Controls when image selected */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">الصورة المحملة:</span>
                  <span className="text-emerald-700 font-bold bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تم الاستخراج بنجاح</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setParsedData(null);
                      setEditableItems([]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>تصوير فاتورة أخرى</span>
                  </button>
                </div>
              </div>

              {/* Processing Loader */}
              {isProcessing && (
                <div className="p-8 text-center bg-slate-900 text-white rounded-2xl space-y-4 shadow-xl border border-slate-800 animate-pulse">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <Sparkles className="w-7 h-7 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-white">جاري تحليل بنود الفاتورة بالذكاء الاصطناعي...</h4>
                    <p className="text-xs text-slate-400">
                      محرك Google Gemini 3.7 يستخرج أسماء السلع، الكميات، أسعار التكلفة والتصنيف تلقائياً
                    </p>
                  </div>
                </div>
              )}

              {/* Invoice Meta Bar */}
              {!isProcessing && editableItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      اسم المورد / المحل:
                    </label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="مثال: شركة البركة للمستلزمات"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-blue-600" />
                      رقم الفاتورة:
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="INV-1234"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      تاريخ الفاتورة:
                    </label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Items Table */}
              {!isProcessing && editableItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      <span>الأصناف المستخرجة من الفاتورة ({editableItems.length} صنف)</span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddNewItem}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة صنف آخر</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3 min-w-[200px]">اسم السلعة / الموديل</th>
                          <th className="p-3 min-w-[160px]">الباركود</th>
                          <th className="p-3 min-w-[120px]">التصنيف</th>
                          <th className="p-3 min-w-[80px]">الكمية</th>
                          <th className="p-3 min-w-[110px]">سعر التكلفة</th>
                          <th className="p-3 min-w-[110px]">سعر البيع المقترح</th>
                          <th className="p-3 min-w-[100px]">الإجمالي</th>
                          <th className="p-3 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {editableItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-3 text-slate-400 font-mono font-bold text-center">
                              {idx + 1}
                            </td>

                            <td className="p-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                                placeholder="اسم الصنف..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                              />
                            </td>

                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={item.barcode || ''}
                                  onChange={(e) => handleUpdateItem(idx, 'barcode', e.target.value)}
                                  placeholder="الباركود..."
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-[11px] text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleGenerateBarcodeForRow(idx)}
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
                                value={item.category}
                                onChange={(e) => handleUpdateItem(idx, 'category', e.target.value)}
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
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono font-bold text-center text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                              />
                            </td>

                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={item.costPrice || ''}
                                onChange={(e) => handleUpdateItem(idx, 'costPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                              />
                            </td>

                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={item.sellingPrice || ''}
                                onChange={(e) => handleUpdateItem(idx, 'sellingPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 font-mono font-bold text-emerald-800 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>

                            <td className="p-3 font-mono font-bold text-slate-900">
                              {((Number(item.costPrice) || 0) * (Number(item.quantity) || 0)).toLocaleString()} {currency}
                            </td>

                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(idx)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="حذف السطر"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary & Actions */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
                        <span>إجمالي الأصناف: <strong className="text-white">{editableItems.length}</strong></span>
                        <span>إجمالي القطع: <strong className="text-white">{totalPiecesCount} قطعة</strong></span>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
                        مجموع تكلفة الفاتورة: {totalInvoiceSum.toLocaleString()} {currency}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700">
                        <input
                          type="checkbox"
                          checked={recordAsExpense}
                          onChange={(e) => setRecordAsExpense(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>تسجيل قيد مشتريات بالصندوق</span>
                      </label>

                      <button
                        type="button"
                        onClick={handleConfirmAndImport}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>اعتماد وإدخال الكل للمخزن ({editableItems.length} صنف)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
