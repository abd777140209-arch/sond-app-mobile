/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Package, 
  PlusCircle, 
  Sparkles, 
  Pencil, 
  Trash2, 
  AlertTriangle, 
  Layers, 
  DollarSign, 
  Barcode, 
  Check, 
  X, 
  Filter, 
  CheckCircle2, 
  Tag, 
  Printer, 
  Eye, 
  EyeOff, 
  Camera, 
  Settings, 
  Download, 
  Volume2, 
  FileSpreadsheet, 
  FileText,
  RotateCcw,
  UploadCloud
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile, exportToCSV } from '../utils/fileExport';
import { safeStorage } from '../utils/safeStorage';
import { generateAndSharePDF } from '../services/pdfService';
import BarcodeLabelPrinterModal from './BarcodeLabelPrinterModal';
import CameraBarcodeScannerModal from './CameraBarcodeScannerModal';
import ManageCategoriesModal from './ManageCategoriesModal';
import BulkProductAddModal from './BulkProductAddModal';
import SmartInvoiceScannerModal from './SmartInvoiceScannerModal';
import CsvRestoreProductsModal from './CsvRestoreProductsModal';

interface InventoryProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onBulkAddProducts?: (
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
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onRestoreProducts?: (newProductList: Product[]) => void;
  currency: string;
  storeName?: string;
  storeLogoUrl?: string;
  isPrivacyMode?: boolean;
}

export default function Inventory({
  products,
  onAddProduct,
  onBulkAddProducts,
  onUpdateProduct,
  onDeleteProduct,
  onRestoreProducts,
  currency,
  storeName = 'سند',
  storeLogoUrl,
  isPrivacyMode = false
}: InventoryProps) {
  const [showLabelPrinterModal, setShowLabelPrinterModal] = useState(false);
  const [selectedBarcodeProductId, setSelectedBarcodeProductId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [showSmartInvoiceScannerModal, setShowSmartInvoiceScannerModal] = useState(false);
  const [showCsvRestoreModal, setShowCsvRestoreModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // New product form states
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(2);
  const [category, setCategory] = useState('إكسسوارات');
  const [addError, setAddError] = useState('');

  // Editing state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Camera Barcode Scanner States
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'ADD' | 'EDIT' | 'SEARCH'>('ADD');

  // Dynamic Categories Management
  const DEFAULT_CATEGORIES = ['أجهزة', 'إكسسوارات', 'قطع صيانة', 'برمجيات', 'أخرى'];
  const [categoriesList, setCategoriesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sanad_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading categories:', e);
    }
    return DEFAULT_CATEGORIES;
  });
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('الكل');

  // Save categories helper
  const saveCategories = (newCats: string[]) => {
    setCategoriesList(newCats);
    safeStorage.setItem('sanad_categories', JSON.stringify(newCats));
  };

  const handleAddCategory = (catName: string) => {
    if (!categoriesList.includes(catName)) {
      const updated = [...categoriesList, catName];
      saveCategories(updated);
    }
  };

  const handleUpdateCategory = (oldName: string, newName: string) => {
    const updated = categoriesList.map(c => c === oldName ? newName : c);
    saveCategories(updated);
    if (category === oldName) setCategory(newName);
    if (editingProduct && editingProduct.category === oldName) {
      setEditingProduct({ ...editingProduct, category: newName });
    }
  };

  const handleDeleteCategory = (catName: string) => {
    const updated = categoriesList.filter(c => c !== catName);
    saveCategories(updated);
    if (category === catName && updated.length > 0) {
      setCategory(updated[0]);
    }
    if (editingProduct && editingProduct.category === catName && updated.length > 0) {
      setEditingProduct({ ...editingProduct, category: updated[0] });
    }
  };

  const handleBulkAddInternal = (
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
  ) => {
    if (onBulkAddProducts) {
      onBulkAddProducts(productsToAdd, purchaseMetadata);
    } else {
      productsToAdd.forEach(p => {
        onAddProduct(p);
      });
    }
  };

  const handleScanSuccess = (scannedCode: string) => {
    if (scannerTarget === 'ADD') {
      setBarcode(scannedCode);
    } else if (scannerTarget === 'EDIT' && editingProduct) {
      setEditingProduct({ ...editingProduct, barcode: scannedCode });
    } else if (scannerTarget === 'SEARCH') {
      setSearchQuery(scannedCode);
    }
  };

  // Auto generate barcode
  const handleGenerateBarcode = () => {
    soundManager.playScanBeep();
    const randomCode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setBarcode(randomCode);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!name.trim()) {
      setAddError('⚠️ اسم السلعة مطلوب!');
      soundManager.playWarningBeep();
      return;
    }

    if (!barcode.trim()) {
      setAddError('⚠️ باركود السلعة مطلوب للبيع بالليزر!');
      soundManager.playWarningBeep();
      return;
    }

    // Check barcode duplication
    const activeProducts = products.filter(p => p.isDeleted !== true);
    if (activeProducts.some(p => p.barcode === barcode.trim())) {
      setAddError('⚠️ الباركود مسجل مسبقاً لسلعة أخرى!');
      soundManager.playWarningBeep();
      return;
    }

    if (costPrice < 0 || sellingPrice < 0) {
      setAddError('⚠️ لا يمكن أن تكون الأسعار سالبة!');
      soundManager.playWarningBeep();
      return;
    }

    onAddProduct({
      name: name.trim(),
      barcode: barcode.trim(),
      costPrice,
      sellingPrice,
      stock,
      minStock,
      category
    });

    // Reset Form
    setName('');
    setBarcode('');
    setCostPrice(0);
    setSellingPrice(0);
    setStock(0);
    setMinStock(2);
    setAddError('');
    setShowAddModal(false);
    soundManager.playSuccessChime();
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editingProduct.name.trim() || !editingProduct.barcode.trim()) {
      soundManager.playWarningBeep();
      alert('⚠️ اسم السلعة والباركود حقول إجبارية!');
      return;
    }

    onUpdateProduct(editingProduct);
    setEditingProduct(null);
    soundManager.playSuccessChime();
  };

  // Active products filter (Soft Delete supported)
  const activeProductsList = products.filter(p => p.isDeleted !== true);

  // Filtered inventory list
  const filteredProducts = activeProductsList.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLowStock = filterLowStock ? p.stock <= p.minStock : true;
    const matchesCategory = selectedCategoryFilter === 'الكل' || p.category === selectedCategoryFilter;

    return matchesSearch && matchesLowStock && matchesCategory;
  });

  // Format currency helper respecting Privacy Mode
  const fmt = (num: number) => {
    if (isPrivacyMode) return '**** ' + currency;
    return num.toLocaleString() + ' ' + currency;
  };

  // 📊 تصدير كشف جرد المستودع إلى إكسل Excel (.xlsx) احترافي ومنسق ككشف حساب تفصيلي
  const handleExportExcel = async () => {
    soundManager.playSuccessChime();
    const listToExport = filteredProducts.length > 0 ? filteredProducts : activeProductsList;

    const totalPieces = listToExport.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalCostSum = listToExport.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || 0)), 0);
    const totalSellingSum = listToExport.reduce((sum, p) => sum + ((p.stock || 0) * (p.sellingPrice || 0)), 0);
    const totalProfitSum = totalSellingSum - totalCostSum;

    // 1. جدول تفاصيل الأصناف ككشف مرتب
    const data: Record<string, string | number>[] = listToExport.map((p, index) => {
      const itemCost = p.costPrice || 0;
      const itemSelling = p.sellingPrice || 0;
      const totalItemCost = (p.stock || 0) * itemCost;
      const totalItemSelling = (p.stock || 0) * itemSelling;
      const itemProfitMargin = itemSelling - itemCost;
      const totalItemProfit = totalItemSelling - totalItemCost;
      const statusText = p.stock <= 0 ? 'نفد من المخزن' : p.stock <= p.minStock ? 'منخفض (تحت الطلب)' : 'متوفر بالمخزن';

      return {
        'م': index + 1,
        'اسم الصنف / المادة': p.name || '',
        'رمز الباركود': p.barcode || 'بدون باركود',
        'التصنيف': p.category || 'عام',
        'الكمية المتوفرة': p.stock || 0,
        'الحد الأدنى': p.minStock || 0,
        'سعر الشراء (التكلفة)': isPrivacyMode ? '***' : itemCost,
        'سعر البيع المعتمد': itemSelling,
        'إجمالي الشراء (رأس المال)': isPrivacyMode ? '***' : totalItemCost,
        'إجمالي البيع (القيمة البيعية)': totalItemSelling,
        'فارق ربح القطعة': isPrivacyMode ? '***' : itemProfitMargin,
        'إجمالي الأرباح المتوقعة': isPrivacyMode ? '***' : totalItemProfit,
        'حالة الصنف': statusText
      };
    });

    // 2. إضافة صف الإجماليات النهائية في ذيل الكشف
    data.push({
      'م': 'الإجمالي الكلي',
      'اسم الصنف / المادة': `إجمالي الأصناف: ${listToExport.length} صنف`,
      'رمز الباركود': '-',
      'التصنيف': '-',
      'الكمية المتوفرة': totalPieces,
      'الحد الأدنى': '-',
      'سعر الشراء (التكلفة)': '-',
      'سعر البيع المعتمد': '-',
      'إجمالي الشراء (رأس المال)': isPrivacyMode ? '***' : totalCostSum,
      'إجمالي البيع (القيمة البيعية)': totalSellingSum,
      'فارق ربح القطعة': '-',
      'إجمالي الأرباح المتوقعة': isPrivacyMode ? '***' : totalProfitSum,
      'حالة الصنف': 'كشف معتمد'
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    // ضبط قياسات الأعمدة بدقة
    worksheet['!cols'] = [
      { wch: 6 },  // م
      { wch: 32 }, // اسم الصنف
      { wch: 18 }, // الباركود
      { wch: 16 }, // التصنيف
      { wch: 16 }, // الكمية المتوفرة
      { wch: 14 }, // الحد الأدنى
      { wch: 20 }, // سعر الشراء
      { wch: 18 }, // سعر البيع
      { wch: 24 }, // إجمالي الشراء
      { wch: 26 }, // إجمالي البيع
      { wch: 18 }, // فارق ربح القطعة
      { wch: 24 }, // إجمالي الأرباح
      { wch: 20 }  // حالة الصنف
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'كشف جرد المستودع');

    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const fileName = `كشف_جرد_المستودع_التفصيلي_${new Date().toISOString().split('T')[0]}.xlsx`;

    await saveAndShareFile({
      fileName,
      data: excelBase64,
      isBase64: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'كشف جرد المستودع Excel',
      text: `كشف جرد المستودع الشامل (${listToExport.length} صنف، إجمالي ${totalPieces} قطعة) من تطبيق سند المحاسبي`
    });
  };

  // 📄 تصدير كشف جرد المستودع والمخزون بصيغة PDF معتمدة ومرتبة ككشف محاسبي
  const handleExportPDF = async () => {
    soundManager.playScanBeep();
    const listToExport = filteredProducts.length > 0 ? filteredProducts : activeProductsList;
    const totalPiecesCount = listToExport.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalSellingSum = listToExport.reduce((sum, p) => sum + ((p.stock || 0) * (p.sellingPrice || 0)), 0);
    const totalCostSum = listToExport.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || 0)), 0);
    const totalProfitSum = totalSellingSum - totalCostSum;
    const lowCount = listToExport.filter(p => p.stock <= p.minStock).length;
    const outOfStockCount = listToExport.filter(p => p.stock <= 0).length;

    // إعداد الأعمدة المنسقة لكشف الجرد
    const customColumns = [
      { key: 'index', label: 'م', width: '35px', align: 'center' as const },
      { key: 'name', label: 'اسم الصنف / المادة', align: 'right' as const },
      { key: 'barcode', label: 'الباركود', width: '90px', align: 'center' as const },
      { key: 'category', label: 'التصنيف', width: '75px', align: 'center' as const },
      { key: 'stock', label: 'المخزون', width: '60px', align: 'center' as const },
      { key: 'costPrice', label: 'سعر الشراء', width: '80px', align: 'center' as const },
      { key: 'sellingPrice', label: 'سعر البيع', width: '80px', align: 'center' as const },
      { key: 'totalCost', label: 'إجمالي الشراء', width: '95px', align: 'center' as const },
      { key: 'totalSelling', label: 'إجمالي البيع', width: '95px', align: 'center' as const },
      { key: 'profit', label: 'الأرباح', width: '85px', align: 'center' as const },
      { key: 'status', label: 'الحالة', width: '85px', align: 'center' as const }
    ];

    // إعداد صفوف الكشف
    const customRows: Record<string, string | number>[] = listToExport.map((p, idx) => {
      const itemCost = p.costPrice || 0;
      const itemSelling = p.sellingPrice || 0;
      const totalItemCost = (p.stock || 0) * itemCost;
      const totalItemSelling = (p.stock || 0) * itemSelling;
      const totalItemProfit = totalItemSelling - totalItemCost;
      const statusText = p.stock <= 0 ? '❌ نافد' : p.stock <= p.minStock ? '⚠️ منخفض' : '✅ متوفر';

      return {
        index: idx + 1,
        name: p.name || 'صنف غير مسمى',
        barcode: p.barcode || '—',
        category: p.category || 'عام',
        stock: p.stock || 0,
        costPrice: isPrivacyMode ? '***' : `${itemCost.toLocaleString()} ${currency}`,
        sellingPrice: `${itemSelling.toLocaleString()} ${currency}`,
        totalCost: isPrivacyMode ? '***' : `${totalItemCost.toLocaleString()} ${currency}`,
        totalSelling: `${totalItemSelling.toLocaleString()} ${currency}`,
        profit: isPrivacyMode ? '***' : `${totalItemProfit.toLocaleString()} ${currency}`,
        status: statusText
      };
    });

    // إضافة صف الإجمالي النهائي المعتمد في ذيل جدول الجرد مباشرة
    customRows.push({
      index: 'الإجمالي',
      name: `إجمالي الأصناف: ${listToExport.length} صنف`,
      barcode: '—',
      category: '—',
      stock: totalPiecesCount,
      costPrice: '—',
      sellingPrice: '—',
      totalCost: isPrivacyMode ? '***' : `${totalCostSum.toLocaleString()} ${currency}`,
      totalSelling: `${totalSellingSum.toLocaleString()} ${currency}`,
      profit: isPrivacyMode ? '***' : `${totalProfitSum.toLocaleString()} ${currency}`,
      status: lowCount > 0 ? `⚠️ ${lowCount} بحاجة طلب` : '✅ مكتمل'
    });

    // شريط إحصائيات وبطاقات الإجماليات
    const summaryBoxes = [
      { label: 'عدد الأصناف', value: `${listToExport.length} صنف`, color: '#0284c7' },
      { label: 'إجمالي القطع', value: `${totalPiecesCount} قطعة`, color: '#4f46e5' },
      { label: 'إجمالي قيمة البضاعة (رأس المال)', value: isPrivacyMode ? '***' : `${totalCostSum.toLocaleString()} ${currency}`, color: '#0f172a' },
      { label: 'القيمة البيعية للمخزون', value: `${totalSellingSum.toLocaleString()} ${currency}`, color: '#059669' },
      { label: 'الأرباح المتوقعة', value: isPrivacyMode ? '***' : `${totalProfitSum.toLocaleString()} ${currency}`, color: '#16a34a' },
      { label: 'الأصناف الناقصة', value: `${lowCount} صنف`, color: lowCount > 0 ? '#dc2626' : '#16a34a' }
    ];

    try {
      await generateAndSharePDF({
        title: 'كشف جرد المستودع والمخزون العام',
        storeName: storeName || 'سند المحاسبي',
        invoiceNumber: `جرد-${new Date().toISOString().slice(0, 10)}`,
        customerName: 'إدارة المستودعات ومراقبة المخزون',
        phone: '',
        date: new Date().toLocaleDateString('ar-YE') + ' ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: `كشف تفصيلي بأسعار الشراء والبيع وإجمالي قيمة البضاعة`,
        orientation: 'l', // نمط أفقي (Landscape) لضمان اتساع ووضوح جميع الأعمدة بدقة
        customColumns,
        customRows,
        summaryBoxes,
        subtotal: isPrivacyMode ? '***' : `إجمالي قيمة البضاعة (الشراء): ${totalCostSum.toLocaleString()} ${currency}`,
        discount: '0',
        totalAmount: isPrivacyMode ? '***' : `${totalCostSum.toLocaleString()} ${currency}`,
        notes: `كشف جرد رسمي مدقق (${listToExport.length} صنف، ${totalPiecesCount} قطعة مخزنية).`,
        footerNote: '✨ كشف جرد المستودع المعتمد - نظام سند المحاسبي'
      });
    } catch (e) {
      console.error('Inventory PDF Export Error:', e);
    }
  };

  // 🎯 Export CSV Handler مرتب ككشف
  const handleExportCSV = async () => {
    soundManager.playSuccessChime();
    const listToExport = filteredProducts.length > 0 ? filteredProducts : activeProductsList;
    const headers = [
      'م',
      'اسم الصنف / السلعة',
      'رمز الباركود',
      'التصنيف',
      'الكمية المتوفرة',
      'الحد الأدنى',
      'سعر الشراء (التكلفة)',
      'سعر البيع',
      'إجمالي الشراء (رأس المال)',
      'إجمالي البيع (القيمة البيعية)',
      'فارق الربح للقطعة',
      'إجمالي الأرباح المتوقعة',
      'حالة التوفر'
    ];
    const rows = listToExport.map((p, idx) => {
      const itemCost = p.costPrice || 0;
      const itemSelling = p.sellingPrice || 0;
      const totalItemCost = (p.stock || 0) * itemCost;
      const totalItemSelling = (p.stock || 0) * itemSelling;
      const itemProfitMargin = itemSelling - itemCost;
      const totalItemProfit = totalItemSelling - totalItemCost;
      const statusText = p.stock <= 0 ? 'نافد' : p.stock <= p.minStock ? 'منخفض' : 'متوفر';

      return [
        idx + 1,
        p.name || '',
        p.barcode || '',
        p.category || 'عام',
        p.stock || 0,
        p.minStock || 0,
        isPrivacyMode ? '***' : itemCost,
        itemSelling,
        isPrivacyMode ? '***' : totalItemCost,
        totalItemSelling,
        isPrivacyMode ? '***' : itemProfitMargin,
        isPrivacyMode ? '***' : totalItemProfit,
        statusText
      ];
    });
    const fileName = `كشف_جرد_المستودع_${new Date().toISOString().slice(0, 10)}.csv`;
    await exportToCSV(fileName, headers, rows);
  };

  // 🎯 Voice Assistant Zara Speech Reading
  const handleVoiceZara = () => {
    soundManager.playScanBeep();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `المساعد الذكي زارا يقرأ لك جرد المستودع: إجمالي السلع المسجلة ${activeProductsList.length} صنف، بإجمالي ${totalStockCount} قطعة. قيمة رأس المال المباشر ${totalCostValue.toLocaleString()} ${currency}. والأرباح المتوقعة ${totalPotentialProfit.toLocaleString()} ${currency}. هناك ${lowStockItemsCount} صنف قارب على النفاد.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      alert(`🤖 المساعد زارا: إجمالي الأصناف ${activeProductsList.length} صنف، بقيمة تكلفة ${totalCostValue.toLocaleString()} ${currency}`);
    }
  };

  // Calculate statistics
  const totalStockCount = activeProductsList.reduce((acc, p) => acc + p.stock, 0);
  const totalCostValue = activeProductsList.reduce((acc, p) => acc + (p.costPrice * p.stock), 0);
  const totalPotentialProfit = activeProductsList.reduce((acc, p) => acc + ((p.sellingPrice - p.costPrice) * p.stock), 0);
  const lowStockItemsCount = activeProductsList.filter(p => p.stock <= p.minStock).length;

  return (
    <div id="inventory_tab_view" className="space-y-3 md:space-y-6 pb-20 md:pb-28">
      
      {/* 1. TOP STATISTICAL BAR (أعلى قسم المخزون) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
        
        <div className="p-2.5 sm:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500">إجمالي السلع</span>
            <h3 className="text-sm sm:text-lg font-black text-slate-900 mt-0.5">{activeProductsList.length} صنف</h3>
            <span className="text-[9px] sm:text-[10px] text-slate-400">القطع: {totalStockCount}</span>
          </div>
          <div className="p-2 sm:p-3 rounded-lg sm:rounded-2xl bg-blue-50 text-blue-600">
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-2.5 sm:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1">
              <span>قيمة التكلفة</span>
              {isPrivacyMode && <EyeOff className="w-3 h-3 text-amber-500 inline" />}
            </span>
            <h3 className="text-sm sm:text-lg font-black text-slate-900 mt-0.5 dir-ltr text-right font-mono">
              {fmt(totalCostValue)}
            </h3>
            <span className="text-[9px] sm:text-[10px] text-slate-400">رأس المال المستثمر</span>
          </div>
          <div className="p-2 sm:p-3 rounded-lg sm:rounded-2xl bg-indigo-50 text-indigo-600">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-2.5 sm:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1">
              <span>الأرباح المتوقعة</span>
              {isPrivacyMode && <EyeOff className="w-3 h-3 text-amber-500 inline" />}
            </span>
            <h3 className="text-sm sm:text-lg font-black text-emerald-600 mt-0.5 dir-ltr text-right font-mono">
              {isPrivacyMode ? '**** ' + currency : '+' + totalPotentialProfit.toLocaleString() + ' ' + currency}
            </h3>
            <span className="text-[9px] sm:text-[10px] text-slate-400">هامش الربح</span>
          </div>
          <div className="p-2 sm:p-3 rounded-lg sm:rounded-2xl bg-emerald-50 text-emerald-600">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">تنبيهات نفاد المخزون</span>
            <h3 className="text-lg font-black text-rose-600 mt-1">
              {lowStockItemsCount} صنف
            </h3>
            <span className="text-[10px] text-slate-400">سلع تحت حد الطلب الأدنى</span>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* 2. SEARCH, ACTION BUTTONS & FILTER TOOLBAR */}
      <div className="lg:col-span-12 p-3 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3.5">
        
        {/* ROW 1: PRIMARY ACTION BUTTONS (3-COL GRID ON MOBILE, NEVER OVERFLOWS) */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {/* 1. إضافة صنف فردي */}
          <button
            id="btn_add_single_product"
            onClick={() => {
              setShowAddModal(true);
              soundManager.playScanBeep();
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-sm shadow-blue-500/20 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs text-center leading-tight truncate">إضافة صنف</span>
          </button>

          {/* 2. مسح فاتورة بالذكاء الاصطناعي */}
          <button
            id="btn_smart_invoice_ocr"
            onClick={() => {
              setShowSmartInvoiceScannerModal(true);
              soundManager.playScanBeep();
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-95 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition cursor-pointer"
            title="تصوير فاتورة المشتريات الورقية واستخراج الأصناف بالذكاء الاصطناعي"
          >
            <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs text-center leading-tight truncate">فاتورة OCR 📸</span>
          </button>

          {/* 3. إضافة عدة أصناف دفعة واحدة */}
          <button
            id="btn_bulk_add_products"
            onClick={() => {
              setShowBulkAddModal(true);
              soundManager.playScanBeep();
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 transition cursor-pointer"
            title="إدخال عدة بضائع وسلع دفعة واحدة في جدول مجمع"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs text-center leading-tight truncate">إدخال مجمع 📑</span>
          </button>
        </div>

        {/* ROW 2: SEARCH INPUT WITH CAMERA SCAN BUTTON & CLEAR */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="top_inventory_search_input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔎 ابحث بالاسم، الموديل، التصنيف، أو امسح الباركود..."
              className="w-full pr-9 pl-8 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setScannerTarget('SEARCH');
              setShowCameraScanner(true);
              soundManager.playScanBeep();
            }}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition shrink-0 cursor-pointer active:scale-95"
            title="مسح باركود بالليزر/الكاميرا للبحث المباشر"
          >
            <Camera className="w-4 h-4 text-blue-600" />
          </button>
        </div>

        {/* ROW 3: CATEGORY PILLS HORIZONTAL SCROLL + LOW STOCK TOGGLE */}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none py-0.5 flex-1">
            <button
              onClick={() => setSelectedCategoryFilter('الكل')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                selectedCategoryFilter === 'الكل'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({activeProductsList.length})
            </button>
            {categoriesList.map(cat => {
              const count = activeProductsList.filter(p => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                    selectedCategoryFilter === cat
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat} {count > 0 ? `(${count})` : ''}
                </button>
              );
            })}
            <button
              onClick={() => setShowManageCategoriesModal(true)}
              className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition shrink-0 cursor-pointer"
              title="إدارة وتعديل التصنيفات"
            >
              <Tag className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filter Low Stock Button */}
          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
              filterLowStock 
                ? 'bg-rose-600 text-white shadow-xs' 
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
            title="تصفية السلع المنتهية أو المنخفضة عن حد الأمان"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="hidden sm:inline">النواقص</span>
            <span className="text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded-full font-black">
              {lowStockItemsCount}
            </span>
          </button>
        </div>

        {/* ROW 4: CLEAN COMPACT TOOLS & EXPORT BAR */}
        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 flex-wrap text-xs">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <span>الأدوات والاستيراد:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* استعادة واستيراد الأصناف من CSV */}
            <button
              id="inventory_restore_csv_btn"
              onClick={() => {
                soundManager.playScanBeep();
                setShowCsvRestoreModal(true);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer active:scale-95"
              title="استعادة واستيراد أصناف وبضائع المخزن من ملف CSV أو Excel"
            >
              <RotateCcw className="w-3 h-3 text-indigo-600" />
              <span>استعادة الأصناف CSV 📥</span>
            </button>

            {/* طباعة ملصقات الباركود */}
            <button
              onClick={() => {
                soundManager.playScanBeep();
                setShowLabelPrinterModal(true);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition flex items-center gap-1 cursor-pointer active:scale-95"
              title="طباعة ملصقات الباركود على طابعات البلوتوث والحرارية"
            >
              <Printer className="w-3 h-3 text-blue-600" />
              <span>طباعة باركود 🖨️</span>
            </button>

            {/* تصدير كشف PDF معتمد */}
            <button
              id="inventory_export_pdf_btn"
              onClick={handleExportPDF}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition flex items-center gap-1 cursor-pointer active:scale-95"
              title="تصدير كشف جرد المستودع كملف PDF معتمد"
            >
              <FileText className="w-3 h-3 text-rose-600" />
              <span>كشف PDF</span>
            </button>

            {/* تصدير إكسل Excel */}
            <button
              id="inventory_export_excel_btn"
              onClick={handleExportExcel}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer active:scale-95"
              title="تصدير بيانات السلع والمخزون كملف إكسل Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
              <span>إكسل 📊</span>
            </button>

            {/* CSV */}
            <button
              onClick={handleExportCSV}
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition flex items-center gap-1 cursor-pointer"
              title="تصدير بيانات الجرد كملف CSV"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span>تصدير CSV</span>
            </button>

            {/* زارا صوتي */}
            <button
              onClick={handleVoiceZara}
              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition flex items-center gap-1 cursor-pointer"
              title="قراءة ملخص الجرد صوتياً عبر المساعد الذكي زارا"
            >
              <Volume2 className="w-3 h-3 text-purple-600" />
              <span>زارا 🎙️</span>
            </button>
          </div>
        </div>

      </div>

      {/* 3. INVENTORY PRODUCTS TABLE & CARDS (FULL WIDTH) */}
      <div className="w-full space-y-6">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
            <h3 className="text-base font-bold text-slate-900">سجل بضائع ومحتويات المستودع</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  id="header_inventory_restore_csv_btn"
                  onClick={() => {
                    soundManager.playScanBeep();
                    setShowCsvRestoreModal(true);
                  }}
                  className="px-2 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer"
                  title="استعادة واستيراد الأصناف من ملف CSV"
                >
                  <RotateCcw className="w-3 h-3 text-indigo-600" />
                  <span>استعادة CSV</span>
                </button>
                <button
                  id="header_inventory_pdf_btn"
                  onClick={handleExportPDF}
                  className="px-2 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition flex items-center gap-1 cursor-pointer"
                  title="تصدير كشف PDF"
                >
                  <FileText className="w-3 h-3 text-rose-600" />
                  <span>PDF</span>
                </button>
                <button
                  id="header_inventory_excel_btn"
                  onClick={handleExportExcel}
                  className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                  title="تصدير إكسل Excel"
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                  <span>Excel</span>
                </button>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
                {filteredProducts.length} صنف معروض
              </span>
            </div>
          </div>

        {/* MOBILE CARDS VIEW (block md:hidden) */}
        <div className="block md:hidden space-y-3 max-h-[550px] overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا توجد أي سلع تطابق معايير البحث بالتصفية.
            </div>
          ) : (
            filteredProducts.map(p => {
              const isLow = p.stock <= p.minStock;
              return (
                <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-xs">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                        <Barcode className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.barcode}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200 shrink-0">
                      {p.category || 'إكسسوارات'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs font-mono">
                    <div className="p-2 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-sans">المخزون المتوفر:</span>
                      {isLow ? (
                        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" /> {p.stock} (منخفض)
                        </span>
                      ) : (
                        <span className="font-bold text-slate-800 text-sm">{p.stock} قطعة</span>
                      )}
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-sans">سعر البيع للزبون:</span>
                      <span className="font-bold text-blue-600 text-sm">{fmt(p.sellingPrice)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 text-[11px] text-slate-500">
                    <div>
                      التكلفة: <span className="font-bold font-mono text-slate-700">{isPrivacyMode ? '****' : p.costPrice.toLocaleString() + ' ' + currency}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedBarcodeProductId(p.id);
                          setShowLabelPrinterModal(true);
                          soundManager.playScanBeep();
                        }}
                        className="p-2 rounded-xl text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1 text-xs font-bold"
                        title="طباعة ملصق باركود للسلعة"
                      >
                        <Barcode className="w-3.5 h-3.5" /> ملصق
                      </button>

                      <button
                        onClick={() => {
                          setEditingProduct(p);
                          soundManager.playScanBeep();
                        }}
                        className="p-2 rounded-xl text-slate-600 bg-white border border-slate-200 hover:text-blue-600 hover:bg-blue-50 transition flex items-center gap-1 text-xs font-bold"
                      >
                        <Pencil className="w-3.5 h-3.5" /> تعديل
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف السلعة "${p.name}"؟`)) {
                            soundManager.playWarningBeep();
                            onDeleteProduct(p.id);
                          }
                        }}
                        className="p-2 rounded-xl text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition flex items-center gap-1 text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto max-h-[550px] overflow-y-auto">
          <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold">
                  <th className="pb-3 pr-2">السلعة والباركود</th>
                  <th className="pb-3 text-center">التصنيف</th>
                  <th className="pb-3 text-center">المخزون</th>
                  <th className="pb-3 text-center">سعر البيع</th>
                  <th className="pb-3 pl-2 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      لا توجد أي سلع تطابق معايير البحث بالتصفية.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => {
                    const isLow = p.stock <= p.minStock;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 pr-2">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1"><Barcode className="w-3 h-3 text-slate-400" /> {p.barcode}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-400">التكلفة: {isPrivacyMode ? '****' : p.costPrice.toLocaleString() + ' ' + currency}</span>
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {p.category || 'إكسسوارات'}
                          </span>
                        </td>
                        <td className="py-3 text-center font-mono">
                          {isLow ? (
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {p.stock}
                            </span>
                          ) : (
                            <span className="font-bold text-slate-800">{p.stock}</span>
                          )}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-blue-600">
                          {fmt(p.sellingPrice)}
                        </td>
                        <td className="py-3 pl-2 text-left flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedBarcodeProductId(p.id);
                              setShowLabelPrinterModal(true);
                              soundManager.playScanBeep();
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                            title="طباعة وتصدير ملصق باركود للسلعة"
                          >
                            <Barcode className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              soundManager.playScanBeep();
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="تعديل السلعة"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف السلعة "${p.name}"؟`)) {
                                soundManager.playWarningBeep();
                                onDeleteProduct(p.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="حذف السلعة"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      <BarcodeLabelPrinterModal
        isOpen={showLabelPrinterModal}
        onClose={() => {
          setShowLabelPrinterModal(false);
          setSelectedBarcodeProductId('');
        }}
        products={products}
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        currency={currency}
        initialProductId={selectedBarcodeProductId}
      />

      {/* BOTTOM SHEET MODAL: ADD NEW PRODUCT */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[90vh] overflow-y-auto text-right"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

              <div className="flex items-center justify-between border-b border-slate-100 pb-3 bg-slate-50 p-2 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">إضافة سلعة جديدة للمستودع</h3>
                    <p className="text-[11px] text-slate-400">سجل البضائع والمنتجات الجديدة</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick mode switches */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowBulkAddModal(true);
                    soundManager.playScanBeep();
                  }}
                  className="p-2 rounded-xl bg-white text-indigo-700 shadow-xs hover:bg-indigo-50 border border-indigo-100 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>إدخال عدة أصناف (جدول)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowSmartInvoiceScannerModal(true);
                    soundManager.playScanBeep();
                  }}
                  className="p-2 rounded-xl bg-emerald-50 text-emerald-800 shadow-xs hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span>تصوير فاتورة (OCR) 📸</span>
                </button>
              </div>

              {addError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {addError}
                </div>
              )}

              <form onSubmit={handleAddSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">اسم السلعة / الموديل:</label>
                  <input
                    id="add_p_name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: شاشة ايفون 13 الأصلية..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700">رمز الباركود:</label>
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> توليد باركود تلقائي
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      id="add_p_barcode"
                      type="text"
                      required
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="امسح بالليزر أو الكاميرا..."
                      className="flex-1 bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playScanBeep();
                        setScannerTarget('ADD');
                        setShowCameraScanner(true);
                      }}
                      className="px-3 py-2.5 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                      title="مسح الباركود باستخدام كاميرا الهاتف"
                    >
                      <Camera className="w-4 h-4" />
                      <span>كاميرا</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">التصنيف:</label>
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          setShowManageCategoriesModal(true);
                        }}
                        className="text-[10px] text-purple-600 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                        title="إدارة وتعديل التصنيفات"
                      >
                        <Settings className="w-3 h-3" /> إدارة
                      </button>
                    </div>
                    <select
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          soundManager.playScanBeep();
                          setShowManageCategoriesModal(true);
                        } else {
                          setCategory(e.target.value);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    >
                      {categoriesList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__ADD_NEW__">+ إضافة تصنيف جديد...</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">الكمية البدائية:</label>
                    <input
                      id="add_p_stock"
                      type="number"
                      min="0"
                      required
                      value={stock || ''}
                      onChange={(e) => setStock(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">سعر الشراء (التكلفة):</label>
                    <input
                      id="add_p_cost"
                      type="number"
                      min="0"
                      required
                      value={costPrice || ''}
                      onChange={(e) => setCostPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">سعر البيع:</label>
                    <input
                      id="add_p_sell"
                      type="number"
                      min="0"
                      required
                      value={sellingPrice || ''}
                      onChange={(e) => setSellingPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <button
                  id="submit_add_product_btn"
                  type="submit"
                  className="w-full py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>اعتماد وإضافة السلعة للمستودع</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BOTTOM SHEET MODAL: EDIT PRODUCT */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[90vh] overflow-y-auto text-right text-slate-900"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

              <div className="flex items-center justify-between border-b border-slate-100 pb-3 bg-slate-50 p-2 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">تعديل بيانات السلعة</h3>
                    <p className="text-[11px] text-slate-400">{editingProduct.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingProduct(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">اسم السلعة / الموديل:</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">الباركود:</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        value={editingProduct.barcode}
                        onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                        className="flex-1 bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-2.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          setScannerTarget('EDIT');
                          setShowCameraScanner(true);
                        }}
                        className="px-2.5 py-2.5 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center shrink-0"
                        title="مسح الباركود بالكاميرا"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">التصنيف:</label>
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          setShowManageCategoriesModal(true);
                        }}
                        className="text-[10px] text-purple-600 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Settings className="w-3 h-3" /> إدارة
                      </button>
                    </div>
                    <select
                      value={editingProduct.category || (categoriesList[0] || 'إكسسوارات')}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          soundManager.playScanBeep();
                          setShowManageCategoriesModal(true);
                        } else {
                          setEditingProduct({ ...editingProduct, category: e.target.value });
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-2.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    >
                      {categoriesList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__ADD_NEW__">+ إضافة تصنيف جديد...</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">الكمية المتوفرة:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingProduct.stock}
                      onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">حد التنبيه الأدنى:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingProduct.minStock}
                      onChange={(e) => setEditingProduct({ ...editingProduct, minStock: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">سعر الشراء (التكلفة):</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingProduct.costPrice}
                      onChange={(e) => setEditingProduct({ ...editingProduct, costPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">سعر البيع:</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingProduct.sellingPrice}
                      onChange={(e) => setEditingProduct({ ...editingProduct, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition cursor-pointer"
                  >
                    حفظ التعديلات
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScanSuccess={handleScanSuccess}
      />

      {/* DYNAMIC CATEGORIES MANAGEMENT MODAL */}
      <ManageCategoriesModal
        isOpen={showManageCategoriesModal}
        onClose={() => setShowManageCategoriesModal(false)}
        categories={categoriesList}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      {/* BULK PRODUCT ADD MODAL (جدول إدخال عدة أصناف دفعة واحدة) */}
      <BulkProductAddModal
        isOpen={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        existingProducts={products}
        categoriesList={categoriesList}
        currency={currency}
        onBulkAddProducts={handleBulkAddInternal}
        onOpenSmartInvoiceScanner={() => setShowSmartInvoiceScannerModal(true)}
      />

      {/* SMART INVOICE OCR SCANNER MODAL (مسح فاتورة كاملة بالذكاء الاصطناعي) */}
      <SmartInvoiceScannerModal
        isOpen={showSmartInvoiceScannerModal}
        onClose={() => setShowSmartInvoiceScannerModal(false)}
        existingProducts={products}
        categoriesList={categoriesList}
        currency={currency}
        onBulkAddProducts={handleBulkAddInternal}
      />

      {/* CSV / EXCEL RESTORE & IMPORT MODAL (استعادة واستيراد الأصناف من ملف) */}
      <CsvRestoreProductsModal
        isOpen={showCsvRestoreModal}
        onClose={() => setShowCsvRestoreModal(false)}
        existingProducts={products}
        categoriesList={categoriesList}
        currency={currency}
        onBulkAddProducts={handleBulkAddInternal}
        onUpdateProduct={onUpdateProduct}
        onRestoreProducts={onRestoreProducts}
      />

    </div>
  );
}
