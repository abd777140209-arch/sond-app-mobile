/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Filter, 
  Check, 
  Sliders, 
  Package, 
  Sparkles,
  Info
} from 'lucide-react';
import { Product } from '../types';
import { soundManager } from '../utils/sound';

interface BulkMinStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: string[];
  currentFilteredCount?: number;
  filteredProductIds?: string[];
  onApplyBulkMinStock: (
    newMinStock: number, 
    scope: 'all' | 'category' | 'filtered', 
    targetCategory?: string
  ) => void;
}

export default function BulkMinStockModal({
  isOpen,
  onClose,
  products,
  categories,
  currentFilteredCount = 0,
  filteredProductIds = [],
  onApplyBulkMinStock
}: BulkMinStockModalProps) {
  const [minStockValue, setMinStockValue] = useState<number>(3);
  const [scope, setScope] = useState<'all' | 'category' | 'filtered'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] || 'الكل');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [updatedCount, setUpdatedCount] = useState<number>(0);

  const activeProducts = useMemo(() => {
    return products.filter(p => !p.isDeleted);
  }, [products]);

  // حساب عدد الأصناف المستهدفة بالتعديل
  const targetedProducts = useMemo(() => {
    if (scope === 'all') {
      return activeProducts;
    } else if (scope === 'category') {
      if (selectedCategory === 'الكل') return activeProducts;
      return activeProducts.filter(p => p.category === selectedCategory);
    } else if (scope === 'filtered') {
      const set = new Set(filteredProductIds);
      return activeProducts.filter(p => set.has(p.id));
    }
    return activeProducts;
  }, [activeProducts, scope, selectedCategory, filteredProductIds]);

  // حساب كم صنف سيصبح في حالة "نقص مخزون" بعد تطبيق القيمة الجديدة
  const expectedLowStockCount = useMemo(() => {
    return targetedProducts.filter(p => (p.stock || 0) <= minStockValue).length;
  }, [targetedProducts, minStockValue]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (minStockValue < 0) return;
    soundManager.playSuccessChime();
    onApplyBulkMinStock(minStockValue, scope, selectedCategory);
    setUpdatedCount(targetedProducts.length);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1400);
  };

  const quickValues = [0, 1, 2, 3, 5, 10, 15, 20];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-right"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-l from-amber-600 to-amber-700 text-white relative flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-xs text-white">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">ضبط حد تنبيه النواقص لجميع الأصناف</h3>
              <p className="text-amber-100 text-xs mt-0.5 font-medium">
                تحديد رقم التنبيه لنفاد الكمية (الحد الأدنى) دفعة واحدة
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {isSuccess ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-10 text-center space-y-3"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-black text-slate-800">تم ضبط حد التنبيه بنجاح!</h4>
              <p className="text-xs text-slate-600">
                تم تحديث حد التنبيه إلى <strong className="text-emerald-700 font-black">{minStockValue} قطع</strong> لـ {updatedCount} صنف بالمخزن.
              </p>
            </motion.div>
          ) : (
            <>
              {/* 1. قيمة حد التنبيه الجديدة */}
              <div className="space-y-3 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                <label className="block text-xs font-black text-amber-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-600" />
                    <span>رقم التنبيه المطلوب (الحد الأدنى للكمية):</span>
                  </span>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-lg">
                    عند وصول المخزون لهذه القيمة أو أقل يُنبهك النظام
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="9999"
                    value={minStockValue}
                    onChange={(e) => setMinStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32 px-4 py-2.5 rounded-xl border-2 border-amber-300 bg-white font-black text-xl text-center text-amber-950 focus:outline-hidden focus:border-amber-500 shadow-inner"
                  />
                  <div className="text-xs text-slate-600 font-bold">
                    قطع / وحدات كحد أدنى للتنبيه
                  </div>
                </div>

                {/* أزرار سريعة للاختيار */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-bold text-slate-500">قيم سريعة جاهزة:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {quickValues.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          setMinStockValue(val);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 ${
                          minStockValue === val
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100/60'
                        }`}
                      >
                        {val === 0 ? '0 (تعطيل)' : `${val} قطع`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. نطاق تطبيق التعديل */}
              <div className="space-y-2.5">
                <label className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-slate-600" />
                  <span>تطبيق على أي أصناف؟</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* كل المخزن */}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      setScope('all');
                    }}
                    className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1 ${
                      scope === 'all'
                        ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900">جميع الأصناف</span>
                      {scope === 'all' && <Check className="w-4 h-4 text-amber-600" />}
                    </div>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      كامل المخزن ({activeProducts.length} صنف)
                    </span>
                  </button>

                  {/* حسب التصنيف */}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      setScope('category');
                    }}
                    className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1 ${
                      scope === 'category'
                        ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900">حسب القسم</span>
                      {scope === 'category' && <Check className="w-4 h-4 text-amber-600" />}
                    </div>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      تحديد تصنيف معين
                    </span>
                  </button>

                  {/* المعروضة في التصفية الحالية */}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      setScope('filtered');
                    }}
                    disabled={currentFilteredCount === 0 || currentFilteredCount === activeProducts.length}
                    className={`p-3 rounded-2xl border text-right transition flex flex-col justify-between gap-1 ${
                      scope === 'filtered'
                        ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                        : (currentFilteredCount === 0 || currentFilteredCount === activeProducts.length)
                        ? 'border-slate-100 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900">نتائج البحث</span>
                      {scope === 'filtered' && <Check className="w-4 h-4 text-amber-600" />}
                    </div>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      المعروضة فقط ({currentFilteredCount} صنف)
                    </span>
                  </button>
                </div>

                {/* اختيار التصنيف إذا كان النطاق بالقسم */}
                {scope === 'category' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 mt-2"
                  >
                    <label className="text-xs font-bold text-slate-700 block">اختر القسم المستهدف:</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-hidden focus:border-amber-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat} ({products.filter(p => !p.isDeleted && (cat === 'الكل' || p.category === cat)).length} صنف)
                        </option>
                      ))}
                    </select>
                  </motion.div>
                )}
              </div>

              {/* 3. ملخص التأثير والمعاينة المباشرة */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Package className="w-3.5 h-3.5" />
                    <span>عدد الأصناف التي ستتأثر:</span>
                  </span>
                  <span className="text-amber-700 font-black text-sm bg-amber-100/70 px-2.5 py-0.5 rounded-lg">
                    {targetedProducts.length} صنف
                  </span>
                </div>

                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1 text-slate-600">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>أصناف ستعتبر منخفضة فوراً:</span>
                  </span>
                  <span className="text-rose-700 font-black text-sm bg-rose-100/70 px-2.5 py-0.5 rounded-lg">
                    {expectedLowStockCount} صنف
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-start gap-1.5 text-[11px] text-slate-500">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    عندما تنخفض كمية أي من هذه الأصناف في نقطة البيع إلى {minStockValue} قطع أو أقل، سيظهر تنبيه نقص الكمية بلون مميز في كروت البيع وكشوفات النواقص.
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!isSuccess && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              id="confirm_bulk_min_stock_btn"
              onClick={handleApply}
              disabled={targetedProducts.length === 0}
              className={`px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                targetedProducts.length === 0
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>تطبيق وتحديث حد التنبيه ({targetedProducts.length} صنف)</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
