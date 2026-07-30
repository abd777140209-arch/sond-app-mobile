/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Wrench, 
  Search, 
  Boxes, 
  CheckCircle2, 
  AlertTriangle, 
  Receipt, 
  Loader2, 
  Plus, 
  ShoppingCart, 
  Sparkles, 
  Package, 
  ClipboardCheck,
  ArrowLeft
} from 'lucide-react';
import { Product } from '../types';
import { diagnoseVehicleProblem, checkPartInventory, DiagnosticResult } from '../services/SanadDiagnosticService';
import { soundManager } from '../utils/sound';

export interface SanadDiagnosticScreenProps {
  apiBaseUrl?: string;
  token?: string;
  products?: Product[];
  currency?: string;
  onNavigateToPOSWithItems?: (items: Array<{ product: Product; quantity: number }>) => void;
  onNavigateToMaintenanceWithProblem?: (problem: string, notes: string) => void;
}

export const SanadDiagnosticScreen: React.FC<SanadDiagnosticScreenProps> = ({
  apiBaseUrl = '',
  token = '',
  products = [],
  currency = 'ريال',
  onNavigateToPOSWithItems,
  onNavigateToMaintenanceWithProblem
}) => {
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosticResult | null>(null);
  
  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [inventorySearchMessage, setInventorySearchMessage] = useState<string | null>(null);
  const [foundProducts, setFoundProducts] = useState<Product[]>([]);

  // 🔍 تشغيل محرك التشخيص
  const handleDiagnose = async () => {
    if (!symptoms.trim()) return;
    soundManager.playScanBeep();
    setLoading(true);
    setDiagnosisResult(null);

    try {
      const result = await diagnoseVehicleProblem(apiBaseUrl, token, symptoms);
      setDiagnosisResult(result);
      soundManager.playSuccessChime();
    } catch (err: any) {
      alert('حدث خطأ أثناء التشخيص: ' + (err.message || 'فشل الاتصال'));
    } finally {
      setLoading(false);
    }
  };

  // 📦 البحث المباشر في المخزون
  const handleCheckPart = async (queryToSearch?: string) => {
    const query = (queryToSearch || partSearchQuery).trim();
    if (!query) return;
    soundManager.playScanBeep();
    setSearchLoading(true);
    setInventorySearchMessage(null);

    try {
      // 1. Local product search matching real products state
      const lowerQuery = query.toLowerCase();
      const matchedLocal = products.filter(p => 
        !p.isDeleted && (
          p.name.toLowerCase().includes(lowerQuery) ||
          p.barcode.toLowerCase().includes(lowerQuery) ||
          (p.category && p.category.toLowerCase().includes(lowerQuery)) ||
          (p.description && p.description.toLowerCase().includes(lowerQuery))
        )
      );

      setFoundProducts(matchedLocal);

      // 2. Call diagnostic service for additional feedback
      const result = await checkPartInventory(apiBaseUrl, token, query);
      setInventorySearchMessage(result.response);
      soundManager.playSuccessChime();
    } catch (err: any) {
      alert('خطأ في فحص المخزون: ' + (err.message || 'فشل الاتصال'));
    } finally {
      setSearchLoading(false);
    }
  };

  // 🛒 تحويل القطع المكتشفة إلى فاتورة بيع
  const handleTransferToPOS = (partNames?: string[]) => {
    if (!onNavigateToPOSWithItems) {
      alert('ميزة التحويل المباشر لشاشة البيع مفعلة في شاشة الكاشير (POS).');
      return;
    }

    soundManager.playSuccessChime();
    const itemsToTransfer: Array<{ product: Product; quantity: number }> = [];

    if (partNames && partNames.length > 0) {
      partNames.forEach(name => {
        const lower = name.toLowerCase();
        const matched = products.find(p => !p.isDeleted && p.name.toLowerCase().includes(lower));
        if (matched) {
          itemsToTransfer.push({ product: matched, quantity: 1 });
        }
      });
    }

    // If no exact match found, add found search products or prompt user
    if (itemsToTransfer.length === 0 && foundProducts.length > 0) {
      foundProducts.forEach(p => itemsToTransfer.push({ product: p, quantity: 1 }));
    }

    if (itemsToTransfer.length > 0) {
      onNavigateToPOSWithItems(itemsToTransfer);
    } else {
      alert('تم إعداد بيانات التشخيص. يمكنك اختيار القطع من المخزون وإدراجها بفاتورة البيع.');
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen font-sans text-slate-800 dark:text-slate-100 space-y-6" style={{ direction: 'rtl' }}>
      
      {/* 🔹 Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
            <Wrench className="w-7 h-7 text-amber-300" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
              <span>محرك التشخيص الذكي وفحص المخزون (Sanad Diagnostic)</span>
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </h1>
            <p className="text-xs text-blue-200 mt-0.5">
              ربط أعراض الأعطال بالتشخيص الميكانيكي والبحث المباشر في قطع الغيار المتوفرة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 flex items-center gap-1 shadow-sm">
            ⚡ الإصدار 2.0 الذكي
          </span>
        </div>
      </div>

      {/* 🔹 Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 🔹 كارت 1: مدخل الأعراض والتشخيص */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 font-extrabold text-base">
              <Wrench className="w-5 h-5" />
              <h2>التشخيص الميكانيكي والفني الذكي</h2>
            </div>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
              AI Motor
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            اكتب الأعراض التي تعاني منها السيارة أو الجهاز (مثل: صوت صرير بالفرامل، ارتجاج عند السرعة، حرارة مرتفعة...):
          </p>

          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            rows={3}
            placeholder="صف العطل أو الصوت أو الملاحظات هنا..."
            className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-none"
          />

          <button
            onClick={handleDiagnose}
            disabled={loading || !symptoms.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 active:scale-98"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>شخّص المشكلة وافحص القطع المطلوبة</span>
          </button>

          {/* 🔹 نتيجة التشخيص */}
          {diagnosisResult && (
            <div className="mt-4 bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border-r-4 border-blue-600 dark:border-blue-500 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>المشكلة المحتملة: <strong className="text-blue-600 dark:text-blue-400">{diagnosisResult.problem}</strong></span>
                </h3>
              </div>

              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                {diagnosisResult.response}
              </div>

              {/* القطع المقترحة */}
              {diagnosisResult.parts_needed && diagnosisResult.parts_needed.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    📦 قطع الغيار والمستلزمات الموصى بها:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {diagnosisResult.parts_needed.map((part, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPartSearchQuery(part);
                          handleCheckPart(part);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold hover:bg-blue-100 transition cursor-pointer flex items-center gap-1"
                      >
                        <Search className="w-3 h-3 text-blue-500" />
                        <span>{part}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* أزرار الإجراءات الفورية */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleTransferToPOS(diagnosisResult.parts_needed)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>إنشاء فاتورة مبيعات بالقطع</span>
                </button>

                {onNavigateToMaintenanceWithProblem && (
                  <button
                    onClick={() => onNavigateToMaintenanceWithProblem(diagnosisResult.problem || 'صيانة من التشخيص', symptoms)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>تحويل لكارت صيانة فورية</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 🔹 كارت 2: الاستعلام المباشر عن المخزون والقطع */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-base">
              <Boxes className="w-5 h-5" />
              <h2>فحص المخزون والقطع المتوفرة</h2>
            </div>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
              Stock Check
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={partSearchQuery}
              onChange={(e) => setPartSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheckPart()}
              placeholder="ابحث باسم القطعة، الباربود، أو الصنف..."
              className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
            <button
              onClick={() => handleCheckPart()}
              disabled={searchLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer transition disabled:opacity-50"
            >
              {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>فحص</span>
            </button>
          </div>

          {/* نتائج القطع المطابقة محلياً */}
          {foundProducts.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                📋 الأصناف المطابقة في المخزون الحالي ({foundProducts.length}):
              </span>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {foundProducts.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">{p.name}</h4>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>الكمية: <strong className={p.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}>{p.stock}</strong></span>
                        <span>السعر: <strong>{p.sellingPrice.toLocaleString()} {currency}</strong></span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTransferToPOS()}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[11px] flex items-center gap-1 shadow cursor-pointer transition"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>إضافة للبيع</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ملخص رد محرك المخزون */}
          {inventorySearchMessage && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap leading-relaxed">
              {inventorySearchMessage}
            </div>
          )}

          {/* دليل إرشادي سريع */}
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <span className="font-bold block text-slate-800 dark:text-slate-200">💡 تلميحات سريعة للمستودع والصيانة:</span>
            <p>• يمكنك الضغط على أي قطعة مقترحة للبحث التلقائي عنها في المخزون.</p>
            <p>• الزر الأخصر يسمح بتحويل القطع مباشرة لسلة البيع في واجهة الكاشير.</p>
          </div>
        </div>

      </div>

    </div>
  );
};

export default SanadDiagnosticScreen;
