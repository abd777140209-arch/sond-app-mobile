/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Boxes, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles, 
  RefreshCw, 
  Printer, 
  Search, 
  CheckCircle2, 
  DollarSign, 
  Layers, 
  FileText, 
  Check, 
  X, 
  ArrowDownRight, 
  Percent, 
  ShieldAlert,
  Calendar,
  Clock,
  ChevronDown,
  Volume2,
  Bot,
  FileUp,
  FileDown,
  FileSpreadsheet,
  Download,
  Upload,
  Info
} from 'lucide-react';
import { Product, Invoice } from '../types';
import * as XLSX from 'xlsx';
import { soundManager } from '../utils/sound';
import { saveAndShareFile, exportToCSV } from '../utils/fileExport';
import { generateAndSharePDF } from '../services/pdfService';

interface ImportedAuditRow {
  productId?: string;
  barcode: string;
  name: string;
  systemStock: number;
  importedPhysicalStock: number;
  diff: number;
  status: 'matched' | 'not_found';
}

interface StockAuditProps {
  products: Product[];
  invoices: Invoice[];
  onUpdateProductStock: (productId: string, newStock: number) => void;
  currency: string;
  storeName?: string;
  isPrivacyMode?: boolean;
}

export default function StockAudit({
  products,
  invoices,
  onUpdateProductStock,
  currency,
  storeName = 'سند',
  isPrivacyMode = false
}: StockAuditProps) {
  const [activeAuditTab, setActiveAuditTab] = useState<'reconciliation' | 'stagnant' | 'profitable'>('reconciliation');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [filterDiscrepancy, setFilterDiscrepancy] = useState<'all' | 'deficit' | 'surplus' | 'match'>('all');
  const [showZaraAuditModal, setShowZaraAuditModal] = useState<boolean>(false);

  // CSV Import/Export States & Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportPreviewModal, setShowImportPreviewModal] = useState<boolean>(false);
  const [importedRows, setImportedRows] = useState<ImportedAuditRow[]>([]);

  useEffect(() => {
    const handleBack = () => {
      if (showZaraAuditModal) {
        setShowZaraAuditModal(false);
      }
      if (showImportPreviewModal) {
        setShowImportPreviewModal(false);
      }
    };
    window.addEventListener('android-modal-close', handleBack);
    return () => window.removeEventListener('android-modal-close', handleBack);
  }, [showZaraAuditModal, showImportPreviewModal]);

    // Export Stock Audit Sheet to CSV / Excel with guaranteed UTF-8 BOM
    const handleExportCSV = async () => {
      soundManager.playSuccessChime();
      const headers = ['الباركود', 'اسم السلعة', 'التصنيف', 'كمية النظام', 'الكمية الفعلية الميدانية', 'سعر التكلفة', 'سعر البيع'];
      const rows = activeProducts.map(p => {
        const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
        return [
          p.barcode || '',
          p.name || '',
          p.category || 'عام',
          p.stock,
          physical,
          p.costPrice,
          p.sellingPrice
        ];
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const fileName = `كشف_جرد_المستودع_${storeName}_${todayStr}.csv`;
      await exportToCSV(fileName, headers, rows);
    };

  // Helper to parse CSV line handling quotes
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  // Import Stock Audit Sheet from CSV
  const handleFileImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length <= 1) {
          alert('ملف CSV فارغ أو لا يحتوي على بيانات جرد كافية.');
          return;
        }

        const rows: ImportedAuditRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;

          const columns = parseCSVLine(line);
          if (columns.length < 2) continue;

          const rawBarcode = columns[0]?.trim().replace(/^"|"$/g, '') || '';
          const rawName = columns[1]?.trim().replace(/^"|"$/g, '') || '';

          // Determine column containing physical stock:
          let physicalValStr = '';
          if (columns.length >= 5) {
            physicalValStr = columns[4]?.trim().replace(/^"|"$/g, '') || '';
          } else if (columns.length >= 4) {
            physicalValStr = columns[3]?.trim().replace(/^"|"$/g, '') || '';
          } else if (columns.length >= 2) {
            physicalValStr = columns[columns.length - 1]?.trim().replace(/^"|"$/g, '') || '';
          }

          const importedStock = parseInt(physicalValStr, 10);

          const matchedProd = activeProducts.find(p => 
            (rawBarcode && p.barcode.toLowerCase() === rawBarcode.toLowerCase()) ||
            (rawName && p.name.toLowerCase() === rawName.toLowerCase())
          );

          if (matchedProd && !isNaN(importedStock)) {
            rows.push({
              productId: matchedProd.id,
              barcode: matchedProd.barcode,
              name: matchedProd.name,
              systemStock: matchedProd.stock,
              importedPhysicalStock: Math.max(0, importedStock),
              diff: Math.max(0, importedStock) - matchedProd.stock,
              status: 'matched'
            });
          } else if (rawBarcode || rawName) {
            rows.push({
              barcode: rawBarcode,
              name: rawName || 'غير معروف',
              systemStock: 0,
              importedPhysicalStock: isNaN(importedStock) ? 0 : importedStock,
              diff: 0,
              status: 'not_found'
            });
          }
        }

        if (rows.length === 0) {
          alert('لم يتم العثور على أي منتجات مطابقة في ملف CSV المرفق.');
          return;
        }

        setImportedRows(rows);
        setShowImportPreviewModal(true);
        soundManager.playSuccessChime();

      } catch (err) {
        console.error('CSV Import Error:', err);
        alert('حدث خطأ أثناء قراءة ملف CSV. يرجى التأكد من المنسق الصحيح.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleApplyImportAsDraft = () => {
    const matched = importedRows.filter(r => r.status === 'matched' && r.productId);
    const newCounts: Record<string, number> = { ...physicalCounts };
    matched.forEach(r => {
      if (r.productId) {
        newCounts[r.productId] = r.importedPhysicalStock;
      }
    });
    setPhysicalCounts(newCounts);
    setShowImportPreviewModal(false);
    soundManager.playSuccessChime();
    alert(`✓ تم تحميل ${matched.length} كمية جرد إلى جدول المطابقة كمسودة للمراجعة والاعتماد.`);
  };

  const handleApplyImportDirectly = () => {
    const matched = importedRows.filter(r => r.status === 'matched' && r.productId);
    if (matched.length === 0) {
      alert('لا توجد أصناف مطابقة للتحديث.');
      return;
    }
    if (confirm(`هل أنت متأكد من تحديث واعتماد المخزون فوراً لعدد ${matched.length} صنف في قاعدة البيانات؟`)) {
      matched.forEach(r => {
        if (r.productId) {
          onUpdateProductStock(r.productId, r.importedPhysicalStock);
          setAppliedReconciliations(prev => ({ ...prev, [r.productId]: true }));
        }
      });
      setShowImportPreviewModal(false);
      soundManager.playSuccessChime();
      alert(`✓ تم تحديث واعتماد المخزون بنجاح لـ ${matched.length} صنف!`);
    }
  };

  // Privacy Mode currency formatter
  const fmt = (num: number) => {
    if (isPrivacyMode) return '**** ' + currency;
    return num.toLocaleString() + ' ' + currency;
  };

  // Zara Speech Synthesis for Stock Audit
  const handleSpeakZaraAudit = () => {
    setShowZaraAuditModal(true);
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !window.speechSynthesis) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      
      let text = `أهلاً بك! أنا زارا، مساعدتك الذكية لجرد وتدقيق المنشأة والمخزون في ${storeName}. تم فحص أرصدة المستودع الميدانية، إجمالي الأصناف المسجلة بالمستودع ${activeProducts.length} صنف. `;
      
      if (totalDeficitValue > 0) {
        text += `تم حصر عجز بالكميات الميدانية بقيمة ${totalDeficitValue.toLocaleString()} ${currency} لعدد ${totalDeficitCount} قطعة مفقودة. `;
      } else {
        text += `الكميات الميدانية متطابقة ولا يوجد عجز مالي بالكميات المحصورة. `;
      }

      if (stagnantProducts.length > 0) {
        text += `توجد لدينا ${stagnantProducts.length} سلع راكضة برأس مال مجمد قدره ${totalTiedUpCapital.toLocaleString()} ${currency}. أنصحك بتشغيل عروض تصفية لتسريع تدوير رأس المال. `;
      }

      text += `شكراً لك، ويمكنك الاعتماد النهائي لتسوية الجرد مباشرة.`;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.95;
      utterance.onerror = (e) => {
        console.warn('Zara speech error:', e);
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Zara speech exception:', e);
    }
  };

  // Audit Physical Counts State: Map of productId -> actualPhysicalCount
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [auditNotes, setAuditNotes] = useState<Record<string, string>>({});
  const [appliedReconciliations, setAppliedReconciliations] = useState<Record<string, boolean>>({});

  const activeProducts = products.filter(p => !p.isDeleted);
  const categoriesList = ['الكل', 'أجهزة', 'إكسسوارات', 'قطع صيانة', 'برمجيات', 'أخرى'];

  // Handle setting physical count for a product
  const handlePhysicalCountChange = (productId: string, val: string) => {
    const num = val === '' ? NaN : parseInt(val, 10);
    setPhysicalCounts(prev => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : Math.max(0, num)
    }));
  };

  // Single Product Reconciliation
  const handleReconcileSingle = (product: Product) => {
    const actualCount = physicalCounts[product.id] !== undefined ? physicalCounts[product.id] : product.stock;
    soundManager.playSuccessChime();
    onUpdateProductStock(product.id, actualCount);
    setAppliedReconciliations(prev => ({ ...prev, [product.id]: true }));
  };

  // Bulk Reconciliation for all modified items
  const handleBulkReconcile = () => {
    const itemsToUpdate = activeProducts.filter(p => {
      const physical = physicalCounts[p.id];
      return physical !== undefined && physical !== p.stock;
    });

    if (itemsToUpdate.length === 0) {
      soundManager.playWarningBeep();
      alert('لا توجد أي فروقات كميات معدلة لتطبيقها!');
      return;
    }

    if (confirm(`هل أنت متأكد من تطبيق وتسوية الجرد لعدد ${itemsToUpdate.length} صنف بالمستودع؟`)) {
      soundManager.playSuccessChime();
      itemsToUpdate.forEach(p => {
        const physical = physicalCounts[p.id];
        onUpdateProductStock(p.id, physical);
        setAppliedReconciliations(prev => ({ ...prev, [p.id]: true }));
      });
      alert('✓ تم اعتماد وتسوية الفروقات الميدانية للمستودع بنجاح!');
    }
  };

  // Filtering products for Reconciliation Tab
  const filteredProducts = activeProducts.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'الكل' || p.category === selectedCategory;

    const actual = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
    const diff = actual - p.stock;

    let matchesDiscrepancy = true;
    if (filterDiscrepancy === 'deficit') matchesDiscrepancy = diff < 0;
    if (filterDiscrepancy === 'surplus') matchesDiscrepancy = diff > 0;
    if (filterDiscrepancy === 'match') matchesDiscrepancy = diff === 0;

    return matchesSearch && matchesCategory && matchesDiscrepancy;
  });

  // Calculate Reconciliation Statistics
  let totalDeficitCount = 0;
  let totalDeficitValue = 0;
  let totalSurplusCount = 0;
  let totalSurplusValue = 0;
  let itemsAuditedWithDiff = 0;

  activeProducts.forEach(p => {
    const actual = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
    const diff = actual - p.stock;
    if (diff < 0) {
      totalDeficitCount += Math.abs(diff);
      totalDeficitValue += Math.abs(diff) * p.costPrice;
      itemsAuditedWithDiff++;
    } else if (diff > 0) {
      totalSurplusCount += diff;
      totalSurplusValue += diff * p.costPrice;
      itemsAuditedWithDiff++;
    }
  });

  // --- ANALYSIS 1: STAGNANT / SLOW-MOVING GOODS (السلع الراكضة) ---
  // Calculate total sold quantity per product from invoices
  const salesMap: Record<string, { totalQty: number; totalRevenue: number; totalProfit: number }> = {};
  
  invoices.forEach(inv => {
    inv.items.forEach(item => {
      if (!salesMap[item.productId]) {
        salesMap[item.productId] = { totalQty: 0, totalRevenue: 0, totalProfit: 0 };
      }
      const prod = activeProducts.find(p => p.id === item.productId);
      const cost = prod ? prod.costPrice : 0;
      const itemProfit = (item.sellingPrice - cost) * item.quantity;

      salesMap[item.productId].totalQty += item.quantity;
      salesMap[item.productId].totalRevenue += item.total;
      salesMap[item.productId].totalProfit += itemProfit;
    });
  });

  // Stagnant items: High stock or low sales ratio
  const stagnantProducts = activeProducts.map(p => {
    const salesInfo = salesMap[p.id] || { totalQty: 0, totalRevenue: 0, totalProfit: 0 };
    const tiedUpCapital = p.stock * p.costPrice;
    const turnoverRatio = p.stock > 0 ? (salesInfo.totalQty / (p.stock + salesInfo.totalQty)) * 100 : 0;
    
    let status: 'highly_stagnant' | 'slow' | 'normal' = 'normal';
    if (p.stock >= 3 && salesInfo.totalQty === 0) {
      status = 'highly_stagnant';
    } else if (p.stock >= 5 && turnoverRatio < 15) {
      status = 'slow';
    }

    return {
      product: p,
      salesQty: salesInfo.totalQty,
      tiedUpCapital,
      turnoverRatio,
      status
    };
  })
  .filter(item => item.status === 'highly_stagnant' || item.status === 'slow' || item.salesQty === 0)
  .sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);

  const totalTiedUpCapital = stagnantProducts.reduce((acc, curr) => acc + curr.tiedUpCapital, 0);

  // --- ANALYSIS 2: MOST PROFITABLE GOODS (السلع الأكثر ربحاً) ---
  const profitableProducts = activeProducts.map(p => {
    const salesInfo = salesMap[p.id] || { totalQty: 0, totalRevenue: 0, totalProfit: 0 };
    const unitMargin = p.sellingPrice - p.costPrice;
    const marginPercent = p.sellingPrice > 0 ? (unitMargin / p.sellingPrice) * 100 : 0;
    const generatedProfit = salesInfo.totalProfit;

    return {
      product: p,
      salesQty: salesInfo.totalQty,
      unitMargin,
      marginPercent,
      generatedProfit
    };
  })
  .sort((a, b) => b.generatedProfit - a.generatedProfit || b.marginPercent - a.marginPercent);

  // 📊 تصدير كشف الجرد الفعلي إلى إكسل Excel (.xlsx) ككشف محاسبي منظم
  const handleExportExcel = async () => {
    soundManager.playSuccessChime();

    const data: Record<string, string | number>[] = activeProducts.map((p, idx) => {
      const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
      const diff = physical - p.stock;
      const diffCost = diff * p.costPrice;
      const statusStr = diff === 0 ? 'مطابق تماماً' : diff > 0 ? `زيادة (+${diff})` : `عجز (${diff})`;

      return {
        'م': idx + 1,
        'اسم الصنف / السلعة': p.name || 'بدون اسم',
        'الباركود': p.barcode || '—',
        'التصنيف': p.category || 'عام',
        'رصيد النظام (المسجل)': p.stock,
        'الرصيد الفعلي (الميداني)': physical,
        'فارق الكمية': diff,
        'سعر الشراء (التكلفة)': isPrivacyMode ? '***' : p.costPrice,
        'سعر البيع': p.sellingPrice,
        'قيمة الفارق بالتكلفة': isPrivacyMode ? '***' : diffCost,
        'حالة المطابقة': statusStr
      };
    });

    // إضافة صف الإجماليات
    const totalSystemQty = activeProducts.reduce((sum, p) => sum + p.stock, 0);
    const totalPhysicalQty = activeProducts.reduce((sum, p) => sum + (physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock), 0);

    data.push({
      'م': 'الإجمالي الكلي',
      'اسم الصنف / السلعة': `إجمالي الأصناف: ${activeProducts.length} صنف`,
      'الباركود': '-',
      'التصنيف': '-',
      'رصيد النظام (المسجل)': totalSystemQty,
      'الرصيد الفعلي (الميداني)': totalPhysicalQty,
      'فارق الكمية': totalPhysicalQty - totalSystemQty,
      'سعر الشراء (التكلفة)': '-',
      'سعر البيع': '-',
      'قيمة الفارق بالتكلفة': isPrivacyMode ? '***' : (totalSurplusValue - totalDeficitValue),
      'حالة المطابقة': totalDeficitValue > 0 ? `عجز: ${totalDeficitValue.toLocaleString()}` : 'مطابق'
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 6 },  // م
      { wch: 32 }, // اسم الصنف
      { wch: 18 }, // الباركود
      { wch: 15 }, // التصنيف
      { wch: 16 }, // رصيد النظام
      { wch: 18 }, // الرصيد الفعلي
      { wch: 14 }, // فارق الكمية
      { wch: 18 }, // سعر الشراء
      { wch: 16 }, // سعر البيع
      { wch: 20 }, // قيمة الفارق
      { wch: 16 }  // حالة المطابقة
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'كشف جرد المستودع');

    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const todayStr = new Date().toISOString().split('T')[0];
    const fileName = `كشف_جرد_المستودع_${storeName}_${todayStr}.xlsx`;

    await saveAndShareFile({
      fileName,
      data: excelBase64,
      isBase64: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'كشف جرد المستودع Excel',
      text: `كشف جرد المستودع الفعلي من تطبيق سند المحاسبي`
    });
  };

  // 📄 طباعة وتصدير كشف الجرد الفعلي PDF ككشف رسمي
  const handlePrintAuditSheet = async () => {
    soundManager.playSuccessChime();
    try {
      const todayStr = new Date().toLocaleDateString('ar-YE');

      const customColumns = [
        { key: 'index', label: 'م', width: '35px', align: 'center' as const },
        { key: 'name', label: 'اسم الصنف / السلعة', align: 'right' as const },
        { key: 'barcode', label: 'الباركود', width: '90px', align: 'center' as const },
        { key: 'category', label: 'التصنيف', width: '85px', align: 'center' as const },
        { key: 'systemStock', label: 'النظام', width: '55px', align: 'center' as const },
        { key: 'physicalStock', label: 'الفعلي', width: '55px', align: 'center' as const },
        { key: 'diff', label: 'الفارق', width: '60px', align: 'center' as const },
        { key: 'costPrice', label: 'سعر الشراء', width: '80px', align: 'center' as const },
        { key: 'sellingPrice', label: 'سعر البيع', width: '80px', align: 'center' as const },
        { key: 'status', label: 'حالة المطابقة', width: '85px', align: 'center' as const }
      ];

      const customRows: Record<string, string | number>[] = activeProducts.map((p, idx) => {
        const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
        const diff = physical - p.stock;
        const statusStr = diff === 0 ? '✅ مطابق' : diff > 0 ? `+${diff} زيادة` : `${diff} عجز`;

        return {
          index: idx + 1,
          name: p.name || 'بدون اسم',
          barcode: p.barcode || '—',
          category: p.category || 'عام',
          systemStock: p.stock,
          physicalStock: physical,
          diff: diff > 0 ? `+${diff}` : diff,
          costPrice: isPrivacyMode ? '***' : `${p.costPrice.toLocaleString()} ${currency}`,
          sellingPrice: `${p.sellingPrice.toLocaleString()} ${currency}`,
          status: statusStr
        };
      });

      // إضافة صف الإجمالي النهائي
      customRows.push({
        index: 'الإجمالي',
        name: `إجمالي الأصناف: ${activeProducts.length} صنف`,
        barcode: '—',
        category: '—',
        systemStock: activeProducts.reduce((sum, p) => sum + p.stock, 0),
        physicalStock: activeProducts.reduce((sum, p) => sum + (physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock), 0),
        diff: itemsAuditedWithDiff > 0 ? `${itemsAuditedWithDiff} صنف فيه فرق` : '0',
        costPrice: '—',
        sellingPrice: '—',
        status: itemsAuditedWithDiff > 0 ? '⚠️ يحتاج تسوية' : '✅ مطابق بالكامل'
      });

      const summaryBoxes = [
        { label: 'الأصناف', value: `${activeProducts.length} صنف`, color: '#0284c7' },
        { label: 'المتطابقة', value: `${activeProducts.length - itemsAuditedWithDiff} صنف`, color: '#059669' },
        { label: 'عجز ميداني', value: isPrivacyMode ? '***' : `${totalDeficitValue.toLocaleString()} ${currency}`, color: '#dc2626' },
        { label: 'فائض ميداني', value: isPrivacyMode ? '***' : `${totalSurplusValue.toLocaleString()} ${currency}`, color: '#16a34a' }
      ];

      await generateAndSharePDF({
        title: 'كشف الجرد الفعلي والميداني للمخزون',
        storeName: storeName || 'سند المحاسبي',
        invoiceNumber: `جرد-${Date.now().toString().slice(-4)}`,
        customerName: 'إدارة المستودعات والجرد الميداني',
        phone: '',
        date: todayStr + ' ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: 'كشف مطابقة المخزون الفعلي',
        orientation: 'l',
        customColumns,
        customRows,
        summaryBoxes,
        subtotal: `${activeProducts.length} صنف مسجل`,
        discount: totalDeficitValue > 0 ? `عجز: ${totalDeficitValue.toLocaleString()} ${currency}` : 'مطابق',
        totalAmount: `${activeProducts.length} صنف`,
        notes: `كشف مطابقة وجرد ميداني رسمي لكافة كميات المستودع. الأصناف التي تحتوي على فروقات: ${itemsAuditedWithDiff} صنف.`,
        footerNote: '✨ كشف الجرد المعتمد - نظام سند المحاسبي'
      });
    } catch (e) {
      console.error('Stock Audit PDF Error:', e);
    }
  };

  return (
    <div className="space-y-6 pb-28">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
            <span>جرد وحصر المنشأة والمخزون الميداني</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مطابقة الكميات الفعلية بالمستودع، حصر الفروقات والعجز، وتحديد البضائع الراكضة والأكثر ربحية.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Zara AI Assistant Button */}
          <button
            onClick={() => {
              soundManager.playSuccessChime();
              setShowZaraAuditModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold text-xs border border-amber-300 shadow-xs transition cursor-pointer active:scale-95"
            title="المساعد الذكي للجرد زارا"
          >
            <span className="text-sm">✨</span>
            <div className="text-right">
              <div className="leading-tight font-black">زارا - المساعد الذكي للجرد</div>
              <div className="text-[9px] text-amber-700 font-bold">تحليل وتوجيه المخزون</div>
            </div>
          </button>

          {/* Zara Voice Report Button */}
          <button
            onClick={handleSpeakZaraAudit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold transition border border-sky-200 cursor-pointer active:scale-95"
            title="استمع لتقرير الجرد بصوت زارا"
          >
            <span className="text-sm">🔊</span>
            <span>التقرير الصوتي للجرد</span>
          </button>

          <button
            onClick={handlePrintAuditSheet}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            title="تصدير وطباعة كشف الجرد الميداني PDF"
          >
            <Printer className="w-4 h-4" />
            <span>كشف جرد PDF</span>
          </button>

          {/* Export Excel (.xlsx) Button */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition border border-emerald-300 cursor-pointer shadow-xs"
            title="تصدير كشف الجرد الفعلي بصيغة Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>كشف جرد Excel</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition border border-slate-300 cursor-pointer shadow-xs"
            title="تصدير كشف الجرد إلى ملف CSV"
          >
            <FileDown className="w-4 h-4 text-slate-600" />
            <span>تصدير CSV</span>
          </button>

          {/* Import CSV Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold transition border border-purple-300 cursor-pointer shadow-xs"
            title="استيراد كشف الجرد الميداني وتحديث الكميات بشكل جماعي"
          >
            <FileUp className="w-4 h-4 text-purple-600" />
            <span>استيراد ملف الجرد</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImportChange}
            accept=".csv, .txt"
            className="hidden"
          />
          
          <button
            onClick={handleBulkReconcile}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تطبيق الجرد</span>
          </button>
        </div>
      </div>

      {/* Audit Navigation Tabs */}
      <div className="flex bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 gap-2">
        <button
          onClick={() => setActiveAuditTab('reconciliation')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeAuditTab === 'reconciliation'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>مطابقة الكميات والحصر الميداني</span>
        </button>

        <button
          onClick={() => setActiveAuditTab('stagnant')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeAuditTab === 'stagnant'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
          }`}
        >
          <ArrowDownRight className="w-4 h-4" />
          <span>تحديد السلع الراكضة ({stagnantProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveAuditTab('profitable')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeAuditTab === 'profitable'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>السلع الأكثر ربحاً ومساهمة</span>
        </button>
      </div>

      {/* TAB 1: STOCK RECONCILIATION */}
      {activeAuditTab === 'reconciliation' && (
        <div className="space-y-6">
          {/* Audit Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">أصناف تم تعديلها</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{itemsAuditedWithDiff} صنف</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                <ClipboardCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">إجمالي العجز المالي</span>
                <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
                  -{totalDeficitValue.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span>
                </div>
                <span className="text-[10px] text-rose-500 font-bold">عجز: {totalDeficitCount} قطعة</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">إجمالي الزيادة غير المسجلة</span>
                <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                  +{totalSurplusValue.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-bold">زيادة: {totalSurplusCount} قطعة</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">إجمالي الأصناف بالمستودع</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{activeProducts.length} صنف</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
                <Boxes className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم السلعة أو الباركود لإجراء الحصر الميداني..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                {/* Category Selector */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat === 'الكل' ? 'جميع التصنيفات' : cat}</option>
                  ))}
                </select>

                {/* Discrepancy Filter Pills */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    onClick={() => setFilterDiscrepancy('all')}
                    className={`px-3 py-1 rounded-lg transition ${filterDiscrepancy === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600'}`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setFilterDiscrepancy('deficit')}
                    className={`px-3 py-1 rounded-lg transition ${filterDiscrepancy === 'deficit' ? 'bg-rose-600 text-white font-bold' : 'text-slate-600'}`}
                  >
                    عجز ⚠️
                  </button>
                  <button
                    onClick={() => setFilterDiscrepancy('surplus')}
                    className={`px-3 py-1 rounded-lg transition ${filterDiscrepancy === 'surplus' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600'}`}
                  >
                    زيادة 📈
                  </button>
                  <button
                    onClick={() => setFilterDiscrepancy('match')}
                    className={`px-3 py-1 rounded-lg transition ${filterDiscrepancy === 'match' ? 'bg-sky-600 text-white font-bold' : 'text-slate-600'}`}
                  >
                    متطابق ✅
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Reconciliation Cards & Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-4">
            
            {/* MOBILE CARDS VIEW (block md:hidden) */}
            <div className="block md:hidden space-y-3">
              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  لا توجد أصناف تطابق شروط البحث والجرد بالتصفية الحالية.
                </div>
              ) : (
                filteredProducts.map(p => {
                  const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
                  const diff = physical - p.stock;
                  const financialImpact = diff * p.costPrice;
                  const isApplied = appliedReconciliations[p.id];

                  return (
                    <div key={p.id} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.barcode}</div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                          {p.category || 'عام'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-400 text-[10px] block">كمية السيستم</span>
                          <span className="font-mono font-bold text-slate-800 text-sm">{p.stock}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">الكمية الفعلية الميدانية</span>
                          <input
                            type="number"
                            min="0"
                            value={physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock}
                            onChange={(e) => handlePhysicalCountChange(p.id, e.target.value)}
                            className={`w-full p-1 rounded-lg text-center font-mono font-bold text-sm bg-slate-50 border transition focus:outline-none ${
                              diff < 0 
                                ? 'border-rose-400 text-rose-600 bg-rose-50' 
                                : diff > 0 
                                ? 'border-emerald-400 text-emerald-600 bg-emerald-50' 
                                : 'border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60">
                        <div>
                          <span className="text-slate-400 text-[10px] ml-1">الفارق:</span>
                          {diff === 0 ? (
                            <span className="text-slate-400 font-bold">0 (متطابق)</span>
                          ) : diff < 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-bold text-[11px]">
                              {diff} (عجز)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold text-[11px]">
                              +{diff} (زيادة)
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-slate-400 text-[10px] ml-1">الأثر:</span>
                          <span className={`font-mono font-bold ${financialImpact < 0 ? 'text-rose-600' : financialImpact > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {financialImpact === 0 ? '0' : (financialImpact > 0 ? '+' : '') + financialImpact.toLocaleString()} {currency}
                          </span>
                        </div>
                      </div>

                      {diff !== 0 && (
                        <button
                          onClick={() => handleReconcileSingle(p)}
                          disabled={isApplied}
                          className={`w-full py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1 ${
                            isApplied
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isApplied ? 'تمت التسوية بنجاح ✅' : 'اعتماد تسوية هذا الصنف'}</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-right text-slate-700">
                <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">السلعة والباركود</th>
                    <th className="p-3.5 text-center">التصنيف</th>
                    <th className="p-3.5 text-center">كمية السيستم</th>
                    <th className="p-3.5 text-center">الكمية الفعلية (الجرد)</th>
                    <th className="p-3.5 text-center">الفارق (الفرق)</th>
                    <th className="p-3.5 text-center">الأثر المالي</th>
                    <th className="p-3.5 text-left">إجراء التسوية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        لا توجد أصناف تطابق شروط البحث والجرد بالتصفية الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => {
                      const physical = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock;
                      const diff = physical - p.stock;
                      const financialImpact = diff * p.costPrice;
                      const isApplied = appliedReconciliations[p.id];

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5 font-bold text-slate-900">
                            <div>{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.barcode}</div>
                          </td>

                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                              {p.category || 'عام'}
                            </span>
                          </td>

                          <td className="p-3.5 text-center font-mono font-bold text-slate-800 text-sm">
                            {p.stock}
                          </td>

                          <td className="p-3.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : p.stock}
                              onChange={(e) => handlePhysicalCountChange(p.id, e.target.value)}
                              className={`w-20 p-1.5 rounded-xl text-center font-mono font-bold text-sm bg-slate-50 border transition focus:outline-none ${
                                diff < 0 
                                  ? 'border-rose-400 text-rose-600 bg-rose-50' 
                                  : diff > 0 
                                  ? 'border-emerald-400 text-emerald-600 bg-emerald-50' 
                                  : 'border-slate-300 text-slate-900'
                              }`}
                            />
                          </td>

                          <td className="p-3.5 text-center font-mono font-bold">
                            {diff === 0 ? (
                              <span className="text-slate-400">0 (متطابق)</span>
                            ) : diff < 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 text-xs">
                                {diff} (عجز)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs">
                                +{diff} (زيادة)
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-center font-mono font-bold">
                            {financialImpact === 0 ? (
                              <span className="text-slate-400">0 {currency}</span>
                            ) : financialImpact < 0 ? (
                              <span className="text-rose-600">{financialImpact.toLocaleString()} {currency}</span>
                            ) : (
                              <span className="text-emerald-600">+{financialImpact.toLocaleString()} {currency}</span>
                            )}
                          </td>

                          <td className="p-3.5 text-left">
                            {isApplied ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                                <Check className="w-4 h-4" /> تم التسوية
                              </span>
                            ) : (
                              <button
                                onClick={() => handleReconcileSingle(p)}
                                disabled={diff === 0}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                                  diff !== 0
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs cursor-pointer'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                }`}
                              >
                                اعتماد الفارق
                              </button>
                            )}
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
      )}

      {/* TAB 2: STAGNANT / SLOW-MOVING GOODS */}
      {activeAuditTab === 'stagnant' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>تحليل وتحديد البضائع والسلع الراكضة</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                البضائع ذات المبيعات المنخفضة أو المعدومة والتي تحتوي على رأس مال مجمد بالمستودع.
              </p>
            </div>

            <div className="bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-200 text-right">
              <span className="text-[11px] text-amber-800 font-bold block">إجمالي رأس المال المجمد بالسلع الراكضة</span>
              <div className="text-lg font-black text-amber-700 font-mono">
                {totalTiedUpCapital.toLocaleString()} <span className="text-xs font-normal text-amber-800">{currency}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stagnantProducts.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
                🎉 ممتاز! جميع بضائع المنشأة تتمتع بحركة مبيعات نشطة ولا يوجد سلع راكضة.
              </div>
            ) : (
              stagnantProducts.map(({ product, salesQty, tiedUpCapital, status }) => (
                <div
                  key={product.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs hover:border-blue-300 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{product.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{product.barcode}</p>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      status === 'highly_stagnant'
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {status === 'highly_stagnant' ? 'راكد جداً (0 مبيعات)' : 'بطيء الحركة'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">الكمية بالمخزن:</span>
                      <span className="font-mono font-bold text-slate-900">{product.stock} قطعة</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">المبيعات الإجمالية:</span>
                      <span className="font-mono font-bold text-amber-600">{salesQty} تم بيعها</span>
                    </div>

                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span className="text-slate-500">رأس المال المجمد:</span>
                      <span className="font-mono font-bold text-rose-600">
                        {tiedUpCapital.toLocaleString()} {currency}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>توصية: إعداد عرض تخفيض لتصريف المخزون واستعادة رأس المال.</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MOST PROFITABLE GOODS */}
      {activeAuditTab === 'profitable' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>ترتيب السلع والمنتجات الأكثر ربحية ومساهمة</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              تحليل المنتجات التي تحقق أكبر صافي أرباح للمنشأة وهامش ربح تشغيلي مرتفع.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right text-slate-700">
                <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">المرتبة</th>
                    <th className="p-3.5">اسم السلعة</th>
                    <th className="p-3.5 text-center">الكمية المباعة</th>
                    <th className="p-3.5 text-center">سعر التكلفة</th>
                    <th className="p-3.5 text-center">سعر البيع</th>
                    <th className="p-3.5 text-center">هامش الربح القطاعي</th>
                    <th className="p-3.5 text-left">إجمالي الأرباح المحققة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profitableProducts.slice(0, 15).map(({ product, salesQty, unitMargin, marginPercent, generatedProfit }, idx) => (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-bold font-mono text-center">
                        <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-amber-400 text-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-slate-900">
                        <div>{product.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{product.barcode}</div>
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-blue-600">
                        {salesQty} قطعة
                      </td>

                      <td className="p-3.5 text-center font-mono text-slate-500">
                        {product.costPrice.toLocaleString()} {currency}
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-slate-900">
                        {product.sellingPrice.toLocaleString()} {currency}
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-emerald-600">
                        +{unitMargin.toLocaleString()} {currency} ({marginPercent.toFixed(1)}%)
                      </td>

                      <td className="p-3.5 text-left font-mono font-black text-emerald-600 text-sm">
                        +{generatedProfit.toLocaleString()} {currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Zara Stock Audit AI Modal */}
      {showZaraAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl text-right relative space-y-5 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowZaraAuditModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 font-black text-xl shadow-xs">
                ✨
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>زارا - المساعد الذكي للجرد وحصر المنشأة</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                    Audit AI
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  تحليل جرد المستودع، مطابقة الكميات، وتوصيات تسوية الفروقات
                </p>
              </div>
            </div>

            {/* Zara Welcome Voice Prompt */}
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                  <Bot className="w-4 h-4 text-sky-600" />
                  <span>تقرير زارا الصوتي المباشر للجرد:</span>
                </div>
                <button
                  onClick={handleSpeakZaraAudit}
                  className="flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>قراءة صوتاً 🔊</span>
                </button>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                "أهلاً بك! أنا زارا مساعدتك الذكية لجرد وتدقيق المنشأة في <strong className="text-blue-700">{storeName}</strong>. قمت بتحليل {activeProducts.length} صنف بالمستودع وإليك النتائج الفورية."
              </p>
            </div>

            {/* Inventory Audit Insights */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold mb-1">عجز الفروقات الميدانية</div>
                <div className="text-base font-black text-rose-600">{totalDeficitValue.toLocaleString()} {currency}</div>
                <div className="text-[10px] text-rose-500 mt-1">{totalDeficitCount} قطعة مفقودة</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold mb-1">زيادات الكميات الميدانية</div>
                <div className="text-base font-black text-emerald-600">{totalSurplusValue.toLocaleString()} {currency}</div>
                <div className="text-[10px] text-emerald-600 mt-1">{totalSurplusCount} قطعة إضافية</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold mb-1">رأس المال المجمد (الركود)</div>
                <div className="text-base font-black text-amber-600">{totalTiedUpCapital.toLocaleString()} {currency}</div>
                <div className="text-[10px] text-amber-600 mt-1">{stagnantProducts.length} صنف بطيء/راكد</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold mb-1">السلعة الأكثر ربحية</div>
                <div className="text-xs font-black text-blue-700 truncate">{profitableProducts[0]?.product.name || 'لا يوجد'}</div>
                <div className="text-[10px] text-emerald-600 font-bold mt-1">ربح: {profitableProducts[0]?.generatedProfit.toLocaleString() || 0} {currency}</div>
              </div>
            </div>

            {/* Zara Recommendations */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>توصيات زارا لضبط الجرد والمستودع:</span>
              </div>
              <ul className="space-y-1 text-slate-700 text-[11px] list-disc list-inside">
                {itemsAuditedWithDiff > 0 ? (
                  <li>توجد فروقات بـ {itemsAuditedWithDiff} أصناف. ينصح بضغط زر "تطبيق وتسوية الجرد النهائي" لتعديل النظام تلقائياً.</li>
                ) : (
                  <li>جميع أصناف المخزون مطابقة 100% بين النظام والواقع الميداني.</li>
                )}
                {stagnantProducts.length > 0 && (
                  <li>تسييل السلع الراكضة عبر عروض ترويجية يساهم بتوفير {totalTiedUpCapital.toLocaleString()} {currency} نقدية.</li>
                )}
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setShowZaraAuditModal(false);
                  handleBulkReconcile();
                }}
                className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>تطبيق وتسوية كافة الفروقات الآن 🚀</span>
              </button>
              
              <button
                onClick={() => setShowZaraAuditModal(false)}
                className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CSV Import Preview & Reconciliation Modal */}
      {showImportPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl text-right relative space-y-5 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowImportPreviewModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4 shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-black text-xl shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>معاينة وتأكيد استيراد كشف الجرد الميداني</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 font-bold">
                    CSV / Excel
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  تمت قراءة البيانات بنجاح، يرجى مراجعة الكميات والفروقات قبل الاعتماد النهائي
                </p>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <div className="text-[10px] text-slate-500 font-bold">إجمالي الأسطر المقروءة</div>
                <div className="text-lg font-black text-slate-900 font-mono mt-0.5">{importedRows.length} صنف</div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <div className="text-[10px] text-emerald-800 font-bold">أصناف مطابقة بالنظام</div>
                <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">
                  {importedRows.filter(r => r.status === 'matched').length} صنف
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                <div className="text-[10px] text-amber-800 font-bold">أصناف فيها فارق كمية</div>
                <div className="text-lg font-black text-amber-700 font-mono mt-0.5">
                  {importedRows.filter(r => r.status === 'matched' && r.diff !== 0).length} صنف
                </div>
              </div>
            </div>

            {/* Table list */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-right text-slate-700">
                <thead className="bg-slate-50 text-slate-900 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-3">السلعة والباركود</th>
                    <th className="p-3 text-center">الكمية بالنظام</th>
                    <th className="p-3 text-center">الكمية المستوردة</th>
                    <th className="p-3 text-center">الفارق</th>
                    <th className="p-3 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-900">
                        <div>{row.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{row.barcode}</div>
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-slate-700">
                        {row.systemStock}
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-purple-700 bg-purple-50/50">
                        {row.importedPhysicalStock}
                      </td>

                      <td className="p-3 text-center font-mono font-bold">
                        {row.status === 'not_found' ? (
                          <span className="text-slate-400">-</span>
                        ) : row.diff === 0 ? (
                          <span className="text-slate-400">0 (متطابق)</span>
                        ) : row.diff < 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 text-[10px]">
                            {row.diff} (عجز)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px]">
                            +{row.diff} (زيادة)
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        {row.status === 'matched' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            مطابق بالنظام
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            غير مسجل بالنظام
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleApplyImportAsDraft}
                className="w-full sm:flex-1 py-2.5 px-3 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-extrabold text-xs border border-purple-300 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>تحميل كمسودة في جدول الجرد للمراجعة 📝</span>
              </button>

              <button
                type="button"
                onClick={handleApplyImportDirectly}
                className="w-full sm:flex-1 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تحديث واعتماد المخزون فوراً 🚀</span>
              </button>

              <button
                type="button"
                onClick={() => setShowImportPreviewModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
