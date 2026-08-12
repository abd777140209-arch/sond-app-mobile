/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  FileDown,
  Share2,
  Search,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Loader2,
  MessageCircle
} from 'lucide-react';
import { Product } from '../types';
import { soundManager } from '../utils/sound';
import { exportToCSV } from '../utils/fileExport';
import { generateAndSharePDF } from '../services/pdfService';
import { openWhatsApp } from '../utils/nativeLauncher';
import StockAudit from './StockAudit';

interface PhysicalInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Product[];
  storeName?: string;
  currency?: string;
  initialPhysicalCounts?: Record<string, number>;
}

export function PhysicalInventoryModal({
  isOpen,
  onClose,
  products = [],
  storeName = 'سند المحاسبي',
  currency = 'ر.ي',
  initialPhysicalCounts = {}
}: PhysicalInventoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>(initialPhysicalCounts);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // Filter active products
  const activeProducts = useMemo(() => {
    return products.filter(p => !p.isDeleted);
  }, [products]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    activeProducts.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [activeProducts]);

  // Filtered List
  const filteredProducts = useMemo(() => {
    return activeProducts.filter(p => {
      const matchSearch =
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode || '').includes(searchTerm);
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [activeProducts, searchTerm, selectedCategory]);

  // Inventory Summary Stats
  const stats = useMemo(() => {
    let totalItems = activeProducts.length;
    let matched = 0;
    let deficit = 0;
    let surplus = 0;
    let totalValuation = 0;

    activeProducts.forEach(p => {
      const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
      const diff = physical - p.stock;
      totalValuation += physical * p.costPrice;

      if (diff === 0) matched++;
      else if (diff < 0) deficit += Math.abs(diff);
      else surplus += diff;
    });

    return { totalItems, matched, deficit, surplus, totalValuation };
  }, [activeProducts, physicalCounts]);

  if (!isOpen) return null;

  // 🎯 Fast Text-Based PDF Generation & Print (0% html2canvas screenshots, uses generateAndSharePDF with embedded Arabic font)
  const handlePrintPDF = async () => {
    soundManager.playSuccessChime();
    setIsExportingPDF(true);

    try {
      const todayStr = new Date().toLocaleDateString('ar-YE');
      await generateAndSharePDF({
        title: `تقرير الجرد الميداني والحصر - ${storeName}`,
        customerName: storeName,
        date: todayStr,
        totalAmount: `إجمالي الأصناف: ${stats.totalItems} | قيمة المخزون: ${stats.totalValuation.toLocaleString()} ${currency}`,
        items: filteredProducts.map(p => {
          const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
          const diff = physical - p.stock;
          const statusStr = diff === 0 ? 'مطابق' : diff > 0 ? `زيادة (+${diff})` : `عجز (${diff})`;

          return {
            description: `${p.name} [بارلود: ${p.barcode || 'لا يوجد'}] - نظام: ${p.stock} | فعلي: ${physical}`,
            amount: `${statusStr} (${(physical * p.sellingPrice).toLocaleString()} ${currency})`
          };
        })
      });
    } catch (e) {
      console.error('Physical Inventory PDF Error:', e);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 🎯 Export Excel / CSV with UTF-8 BOM
  const handleExportCSV = async () => {
    soundManager.playSuccessChime();
    setIsExportingCSV(true);

    try {
      const headers = [
        'الباركود',
        'اسم المنتح',
        'التصنيف',
        'كمية النظام',
        'الكمية الفعلية الميدانية',
        'الفارق',
        'الحالة',
        'سعر التكلفة',
        'سعر البيع',
        'القيمة الإجمالية'
      ];

      const rows = activeProducts.map(p => {
        const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
        const diff = physical - p.stock;
        const statusStr = diff === 0 ? 'مطابق' : diff > 0 ? `زيادة (+${diff})` : `عجز (${diff})`;

        return [
          p.barcode || '',
          p.name || '',
          p.category || 'عام',
          p.stock,
          physical,
          diff,
          statusStr,
          p.costPrice,
          p.sellingPrice,
          physical * p.costPrice
        ];
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const fileName = `كشف_الجرد_الميداني_${storeName}_${todayStr}.csv`;
      await exportToCSV(fileName, headers, rows);
    } catch (e) {
      console.error('Physical Inventory CSV Error:', e);
    } finally {
      setIsExportingCSV(false);
    }
  };

  // 🎯 Share via WhatsApp
  const handleShareWhatsApp = async () => {
    soundManager.playSuccessChime();
    const todayStr = new Date().toLocaleDateString('ar-YE');

    let text = `📋 *تقرير الجرد الفعلي والميداني - ${storeName}*\n`;
    text += `التاريخ: ${todayStr}\n`;
    text += `-----------------------------------------\n`;
    text += `📦 إجمالي الأصناف المحصورة: *${stats.totalItems} صنف*\n`;
    text += `✅ أصناف مطابقة: *${stats.matched}*\n`;
    text += `⚠️ إجمالي العجز: *${stats.deficit} قطعة*\n`;
    text += `📈 إجمالي الزيادة: *${stats.surplus} قطعة*\n`;
    text += `💰 تقييم المخزون الميداني: *${stats.totalValuation.toLocaleString()} ${currency}*\n`;
    text += `-----------------------------------------\n`;
    text += `تم استخراج التقرير عبر نظام سند المحاسبي 🚀\n`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePhysicalCountChange = (productId: string, val: number) => {
    setPhysicalCounts(prev => ({
      ...prev,
      [productId]: Math.max(0, val)
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600/30 border border-blue-400/30 text-blue-300">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <span>كشف الجرد الميداني والحصر الفعلي</span>
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  سند
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                حصر المنتجات، مطابقة الكميات الفعلية مع النظام، وتصدير التقارير الفورية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar & Summary Cards */}
        <div className="p-4 md:p-6 bg-slate-50 border-b border-slate-200 space-y-4">
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي الأصناف</span>
              <span className="text-lg font-black text-slate-900">{stats.totalItems} صنف</span>
            </div>
            <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-700 block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                أصناف مطابقة
              </span>
              <span className="text-lg font-black text-emerald-800">{stats.matched}</span>
            </div>
            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-700 block flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                عجز حصر
              </span>
              <span className="text-lg font-black text-amber-800">{stats.deficit} قطعة</span>
            </div>
            <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-700 block flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                زيادة حصر
              </span>
              <span className="text-lg font-black text-blue-800">{stats.surplus} قطعة</span>
            </div>
          </div>

          {/* Controls & Export Buttons Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث بالاسم أو الباركود..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:outline-hidden focus:border-blue-500 shadow-2xs"
              />
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:outline-hidden"
              >
                <option value="all">كل التصنيفات</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {/* Print & Export Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={handlePrintPDF}
                disabled={isExportingPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                title="طباعة / تصدير PDF مباشر بدون لقطة شاشة"
              >
                {isExportingPDF ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                <span>طباعة PDF</span>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={isExportingCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                title="تصدير ملف Excel CSV مع ترميز UTF-8 BOM العربي"
              >
                {isExportingCSV ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                <span>تصدير Excel</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                title="مشاركة التقرير عبر الواتساب"
              >
                <MessageCircle className="w-4 h-4" />
                <span>واتساب</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm font-semibold">لا توجد منتجات مطابقة للبحث</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">المنتج / السلعة</th>
                    <th className="p-3">الباركود</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3 text-center">كمية النظام</th>
                    <th className="p-3 text-center">الكمية الفعلية (الميدانية)</th>
                    <th className="p-3 text-center">الفارق</th>
                    <th className="p-3 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProducts.map((p, idx) => {
                    const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
                    const diff = physical - p.stock;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{p.name}</td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">{p.barcode || '-'}</td>
                        <td className="p-3 text-slate-600">{p.category || 'عام'}</td>
                        <td className="p-3 text-center font-bold text-slate-700">{p.stock}</td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={physical}
                            onChange={e => handlePhysicalCountChange(p.id, parseInt(e.target.value) || 0)}
                            className="w-20 text-center py-1 rounded-lg border border-slate-300 font-extrabold text-slate-900 focus:outline-hidden focus:border-blue-500 bg-white"
                          />
                        </td>
                        <td className="p-3 text-center font-bold">
                          {diff === 0 ? (
                            <span className="text-slate-400">0</span>
                          ) : diff > 0 ? (
                            <span className="text-blue-600 flex items-center justify-center gap-0.5">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              +{diff}
                            </span>
                          ) : (
                            <span className="text-amber-600 flex items-center justify-center gap-0.5">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              {diff}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {diff === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              مطابق
                            </span>
                          ) : diff > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              زيادة
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              عجز
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>نظام سند المحاسبي - وحدة الجرد الفعلي والحصر</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}

export default PhysicalInventoryModal;
export { StockAudit };
