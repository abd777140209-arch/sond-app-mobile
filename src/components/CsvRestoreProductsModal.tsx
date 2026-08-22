import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  RotateCcw, 
  Download, 
  FileText, 
  Search, 
  Trash2, 
  Plus, 
  Check, 
  RefreshCw,
  Info,
  PackagePlus,
  Edit3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';

export interface ParsedCsvProduct {
  id: string;
  name: string;
  barcode: string;
  category: string;
  stock: number;
  costPrice: number;
  sellingPrice: number;
  minStock: number;
  isExisting: boolean;
  existingProductId?: string;
  selected: boolean;
  validationError?: string;
}

interface CsvRestoreProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  categoriesList: string[];
  currency: string;
  onBulkAddProducts?: (
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
  onUpdateProduct?: (product: Product) => void;
  onRestoreProducts?: (newProductList: Product[]) => void;
}

type RestoreMode = 'merge_update' | 'add_new_only' | 'full_replace';

export default function CsvRestoreProductsModal({
  isOpen,
  onClose,
  existingProducts,
  categoriesList,
  currency,
  onBulkAddProducts,
  onUpdateProduct,
  onRestoreProducts
}: CsvRestoreProductsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedCsvProduct[]>([]);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge_update');
  const [stockHandling, setStockHandling] = useState<'add' | 'replace'>('replace');
  const [filterType, setFilterType] = useState<'all' | 'new' | 'existing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rawPastedText, setRawPastedText] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [parseError, setParseError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeExistingList = existingProducts.filter(p => p.isDeleted !== true);

  // Normalize Arabic Numerals and clean strings
  const cleanNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    let str = String(val).trim();
    // Convert Arabic/Eastern numerals
    str = str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    // Remove currencies, commas, spaces, ***
    str = str.replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // Convert raw 2D array of cells or objects into ParsedCsvProduct[]
  const processRawData = (rows: any[][], sourceName: string) => {
    if (!rows || rows.length === 0) {
      setParseError('الملف فارغ أو لم يتم العثور على أي صفوف قابلة للقراءة.');
      soundManager.playWarningBeep();
      return;
    }

    setParseError('');
    const parsed: ParsedCsvProduct[] = [];
    let headerRowIdx = 0;

    // Detect header row index (looking for keywords like اسم, name, باركود, barcode)
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const rowStr = rows[i].map(c => String(c).toLowerCase()).join(' ');
      if (
        rowStr.includes('اسم') || 
        rowStr.includes('name') || 
        rowStr.includes('سلعة') || 
        rowStr.includes('صنف') || 
        rowStr.includes('باركود') || 
        rowStr.includes('barcode')
      ) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = rows[headerRowIdx].map(h => String(h || '').trim().toLowerCase());
    
    // Map column indices
    let colName = headers.findIndex(h => h.includes('اسم') || h.includes('صنف') || h.includes('سلعة') || h.includes('name') || h.includes('item') || h.includes('product'));
    let colBarcode = headers.findIndex(h => h.includes('باركود') || h.includes('barcode') || h.includes('كود') || h.includes('رمز') || h.includes('code') || h.includes('sku'));
    let colCategory = headers.findIndex(h => h.includes('تصنيف') || h.includes('قسم') || h.includes('فئة') || h.includes('category') || h.includes('type'));
    let colStock = headers.findIndex(h => h.includes('كمية') || h.includes('مخزون') || h.includes('رصيد') || h.includes('stock') || h.includes('qty') || h.includes('quantity') || h.includes('count'));
    let colCost = headers.findIndex(h => h.includes('شراء') || h.includes('تكلفة') || h.includes('cost') || h.includes('buy') || h.includes('purchase'));
    let colSell = headers.findIndex(h => (h.includes('بيع') || h.includes('سعر') || h.includes('price') || h.includes('sell') || h.includes('sale')) && !h.includes('شراء') && !h.includes('تكلفة'));
    let colMinStock = headers.findIndex(h => h.includes('أدنى') || h.includes('أمان') || h.includes('طلب') || h.includes('min'));

    // Fallbacks if not found by name
    if (colName === -1 && rows[headerRowIdx].length >= 2) colName = 1; // Often index 1 if col 0 is serial "م"
    if (colName === -1) colName = 0;
    if (colBarcode === -1 && rows[headerRowIdx].length >= 3) colBarcode = 2;
    if (colCategory === -1 && rows[headerRowIdx].length >= 4) colCategory = 3;
    if (colStock === -1 && rows[headerRowIdx].length >= 5) colStock = 4;
    if (colCost === -1 && rows[headerRowIdx].length >= 7) colCost = 6;
    if (colSell === -1 && rows[headerRowIdx].length >= 8) colSell = 7;

    const dataRows = rows.slice(headerRowIdx + 1);

    dataRows.forEach((r, idx) => {
      // Skip totally empty rows
      if (!r || r.length === 0 || r.every(cell => !cell || String(cell).trim() === '')) {
        return;
      }

      const rawName = colName !== -1 && r[colName] !== undefined ? String(r[colName]).trim() : '';
      if (!rawName || rawName === 'الإجمالي' || rawName.startsWith('إجمالي')) {
        return; // Skip summary / empty rows
      }

      let rawBarcode = colBarcode !== -1 && r[colBarcode] !== undefined ? String(r[colBarcode]).trim() : '';
      // If barcode is "-" or empty, generate a unique random one
      if (!rawBarcode || rawBarcode === '-' || rawBarcode === '—') {
        rawBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      }

      const rawCat = colCategory !== -1 && r[colCategory] !== undefined ? String(r[colCategory]).trim() : 'عام';
      const stockVal = colStock !== -1 ? cleanNumber(r[colStock]) : 0;
      const costVal = colCost !== -1 ? cleanNumber(r[colCost]) : 0;
      const sellVal = colSell !== -1 ? cleanNumber(r[colSell]) : 0;
      const minStockVal = colMinStock !== -1 ? cleanNumber(r[colMinStock]) : 2;

      // Check if item matches an existing product in DB
      const existingMatch = activeExistingList.find(
        p => (p.barcode && p.barcode.trim() === rawBarcode.trim()) || 
             (p.name && p.name.trim().toLowerCase() === rawName.toLowerCase())
      );

      parsed.push({
        id: `csv-row-${Date.now()}-${idx}`,
        name: rawName,
        barcode: rawBarcode,
        category: rawCat || categoriesList[0] || 'إكسسوارات',
        stock: stockVal,
        costPrice: costVal,
        sellingPrice: sellVal,
        minStock: minStockVal > 0 ? minStockVal : 2,
        isExisting: !!existingMatch,
        existingProductId: existingMatch ? existingMatch.id : undefined,
        selected: true,
        validationError: sellVal < costVal && costVal > 0 ? 'سعر البيع أقل من التكلفة' : undefined
      });
    });

    if (parsed.length === 0) {
      setParseError('لم يتم العثور على أي أصناف صالحة في الملف. يرجى التأكد من احتواء الملف على أعمدة (اسم الصنف، الباركود، السعر، المخزون).');
      soundManager.playWarningBeep();
      return;
    }

    setParsedItems(parsed);
    setFileName(sourceName);
    setShowPasteArea(false);
    soundManager.playSuccessChime();
  };

  // Handle file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readIncomingFile(file);
  };

  const readIncomingFile = (file: File) => {
    setParseError('');
    const reader = new FileReader();

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          processRawData(rows, file.name);
        } catch (err) {
          console.error('Excel Read Error:', err);
          setParseError('تعذر قراءة ملف الإكسل. يرجى التأكد من سلامة الملف.');
          soundManager.playWarningBeep();
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV or plain text
      reader.onload = (evt) => {
        try {
          let text = evt.target?.result as string;
          // Strip UTF-8 BOM if present
          if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1);
          }
          parseCsvString(text, file.name);
        } catch (err) {
          console.error('CSV Read Error:', err);
          setParseError('حدث خطأ أثناء قراءة ملف CSV. يرجى التأكد من التنسيق.');
          soundManager.playWarningBeep();
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  // Robust CSV parser supporting quotes and auto-delimiters (, ; \t)
  const parseCsvString = (text: string, sourceName: string) => {
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      setParseError('الملف أو النص المدخل فارغ.');
      soundManager.playWarningBeep();
      return;
    }

    // Auto-detect delimiter from first line
    const firstLine = lines[0];
    let delimiter = ',';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
    else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

    const parsedRows: string[][] = [];

    lines.forEach(line => {
      const row: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      parsedRows.push(row);
    });

    processRawData(parsedRows, sourceName);
  };

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      readIncomingFile(e.dataTransfer.files[0]);
    }
  };

  // Download Sample Template CSV
  const handleDownloadSampleTemplate = async () => {
    soundManager.playSuccessChime();
    const headers = [
      'اسم الصنف',
      'رمز الباركود',
      'التصنيف',
      'الكمية المتوفرة',
      'سعر الشراء (التكلفة)',
      'سعر البيع',
      'الحد الأدنى'
    ];
    const sampleRows = [
      ['شاشة آيفون 13 أصلية', '628100203040', 'قطع صيانة', 10, 15000, 22000, 3],
      ['شاحن سريع 20 واط تايب سي', '628100506070', 'إكسسوارات', 25, 2500, 4500, 5],
      ['سماعة بلوتوث لاسلكية برو', '628100809010', 'إكسسوارات', 15, 6000, 9500, 2],
      ['باور بانك 20000 ملي أمبير', '628100112233', 'أجهزة', 8, 8500, 13000, 2],
      ['كابل شحن قماشي ضد القطع', '628100445566', 'إكسسوارات', 40, 800, 1500, 10]
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    await saveAndShareFile({
      fileName: 'نموذج_استيراد_اصناف_المخزن_سند.csv',
      data: '\uFEFF' + csvContent,
      isBase64: false,
      mimeType: 'text/csv;charset=utf-8;',
      title: 'نموذج استيراد أصناف المخزن CSV',
      text: 'نموذج استيراد أصناف وبضائع المستودع المتوافق مع نظام سند المحاسبي'
    });
  };

  // Toggle selection
  const handleToggleSelectAll = (select: boolean) => {
    setParsedItems(prev => prev.map(p => ({ ...p, selected: select })));
  };

  const handleToggleSelectItem = (id: string) => {
    setParsedItems(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };

  const handleDeleteParsedItem = (id: string) => {
    setParsedItems(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdateItemField = (id: string, field: keyof ParsedCsvProduct, value: any) => {
    setParsedItems(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        if (field === 'costPrice' || field === 'sellingPrice') {
          const cost = field === 'costPrice' ? Number(value) : p.costPrice;
          const sell = field === 'sellingPrice' ? Number(value) : p.sellingPrice;
          updated.validationError = sell < cost && cost > 0 ? 'سعر البيع أقل من التكلفة' : undefined;
        }
        return updated;
      }
      return p;
    }));
  };

  // Filtered preview items
  const filteredPreview = parsedItems.filter(item => {
    if (filterType === 'new' && item.isExisting) return false;
    if (filterType === 'existing' && !item.isExisting) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.barcode.includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedCount = parsedItems.filter(p => p.selected).length;
  const newCount = parsedItems.filter(p => !p.isExisting).length;
  const existingCount = parsedItems.filter(p => p.isExisting).length;
  const totalStockPieces = parsedItems.filter(p => p.selected).reduce((sum, p) => sum + (p.stock || 0), 0);

  // Execute Restore / Import
  const handleExecuteRestore = () => {
    const itemsToProcess = parsedItems.filter(p => p.selected);

    if (itemsToProcess.length === 0) {
      alert('⚠️ يرجى تحديد صنف واحد على الأقل للاستعادة أو الاستيراد.');
      soundManager.playWarningBeep();
      return;
    }

    setIsProcessing(true);

    try {
      if (restoreMode === 'full_replace') {
        const confirmMsg = `⚠️ تحذير مهم:\nأنت على وشك استبدال كامل بضائع المخزون بـ (${itemsToProcess.length} صنف) من ملف CSV.\nهل تريد المتابعة واستبدال قاعدة بيانات المخزون؟`;
        if (!confirm(confirmMsg)) {
          setIsProcessing(false);
          return;
        }

        const newProductList: Product[] = itemsToProcess.map((item, idx) => ({
          id: `prod-restored-${Date.now()}-${idx}`,
          name: item.name.trim(),
          barcode: item.barcode.trim(),
          category: item.category.trim() || 'عام',
          costPrice: item.costPrice || 0,
          sellingPrice: item.sellingPrice || 0,
          stock: item.stock || 0,
          minStock: item.minStock || 2,
          isDeleted: false
        }));

        if (onRestoreProducts) {
          onRestoreProducts(newProductList);
        } else if (onBulkAddProducts) {
          onBulkAddProducts(newProductList.map(p => ({
            name: p.name,
            barcode: p.barcode,
            costPrice: p.costPrice,
            sellingPrice: p.sellingPrice,
            stock: p.stock,
            minStock: p.minStock,
            category: p.category || 'عام'
          })));
        }

        soundManager.playSuccessChime();
        alert(`✓ تمت استعادة واستبدال المخزون بنجاح بـ ${newProductList.length} صنف (${totalStockPieces} قطعة)!`);
        onClose();
        return;
      }

      // Merge & Update or Add New Only
      const itemsToAdd: Array<{
        name: string;
        barcode: string;
        costPrice: number;
        sellingPrice: number;
        stock: number;
        minStock: number;
        category: string;
      }> = [];

      let updatedCount = 0;
      let addedCount = 0;

      itemsToProcess.forEach(item => {
        if (item.isExisting && item.existingProductId) {
          if (restoreMode === 'merge_update') {
            const existingProd = existingProducts.find(p => p.id === item.existingProductId);
            if (existingProd && onUpdateProduct) {
              const updatedStock = stockHandling === 'add' 
                ? (existingProd.stock || 0) + (item.stock || 0)
                : (item.stock || 0);

              const updatedProd: Product = {
                ...existingProd,
                stock: updatedStock,
                costPrice: item.costPrice > 0 ? item.costPrice : existingProd.costPrice,
                sellingPrice: item.sellingPrice > 0 ? item.sellingPrice : existingProd.sellingPrice,
                category: item.category || existingProd.category
              };
              onUpdateProduct(updatedProd);
              updatedCount++;
            }
          }
          // If 'add_new_only', we skip existing products
        } else {
          // New Product
          itemsToAdd.push({
            name: item.name.trim(),
            barcode: item.barcode.trim(),
            category: item.category.trim() || 'عام',
            costPrice: item.costPrice || 0,
            sellingPrice: item.sellingPrice || 0,
            stock: item.stock || 0,
            minStock: item.minStock || 2
          });
          addedCount++;
        }
      });

      if (itemsToAdd.length > 0 && onBulkAddProducts) {
        onBulkAddProducts(itemsToAdd);
      }

      soundManager.playSuccessChime();
      alert(
        `✓ تم إتمام الاستيراد بنجاح!\n` +
        `• تم إضافة أصناف جديدة: ${addedCount} صنف\n` +
        (restoreMode === 'merge_update' ? `• تم تحديث سلع مسبقة: ${updatedCount} صنف\n` : '') +
        `• إجمالي القطع المخزنية: ${totalStockPieces} قطعة.`
      );
      onClose();

    } catch (err) {
      console.error('Execute CSV Restore Error:', err);
      alert('حدث خطأ أثناء حفظ الأصناف. يرجى المحاولة مجدداً.');
      soundManager.playWarningBeep();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>استعادة واستيراد الأصناف من ملف CSV / Excel</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                  كشف المخزن
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                استرجع بضائعك ومخزونك السابق أو ارفع كشف الجرد المعتمد دفعة واحدة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">

          {/* 1. FILE UPLOAD & DROPZONE (WHEN NO ITEMS PARSED YET OR WANT TO RE-UPLOAD) */}
          {parsedItems.length === 0 ? (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 sm:p-10 border-2 border-dashed rounded-3xl text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-50/60 scale-[0.99]' 
                    : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                  <Upload className="w-8 h-8 animate-bounce" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    اضغط لاختيار ملف كشف الأصناف أو اسحبه وأفلته هنا
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    يدعم ملفات CSV العربية، كشوفات Excel (.xlsx, .xls)، وملفات التصدير من سند
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">
                    📄 ملفات CSV
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                    📊 كشوفات Excel
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold">
                    ✨ كشف جرد سند
                  </span>
                </div>
              </div>

              {/* ACTION TOOLBAR: TEMPLATE DOWNLOAD & PASTE CSV */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>تحميل نموذج CSV تجريبي جاهز (Template) 📥</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPasteArea(!showPasteArea)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>{showPasteArea ? 'إخفاء خانة اللصق المباشر' : 'أو لصق نص CSV من الحافظة 📋'}</span>
                </button>
              </div>

              {/* PASTE TEXTAREA */}
              {showPasteArea && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span>الصق نص CSV هنا (مفصول بفواصل , أو فواصل منقوطة ;):</span>
                    </label>
                    <span className="text-[10px] text-slate-400">مثال: اسم الصنف,الباركود,التصنيف,الكمية,سعر الشراء,سعر البيع</span>
                  </div>
                  <textarea
                    rows={5}
                    value={rawPastedText}
                    onChange={(e) => setRawPastedText(e.target.value)}
                    placeholder="شاشة آيفون 13,628100203040,قطع صيانة,10,15000,22000&#10;شاحن 20W,628100506070,إكسسوارات,25,2500,4500"
                    className="w-full p-3 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 dir-ltr text-right"
                  />
                  <button
                    type="button"
                    onClick={() => parseCsvString(rawPastedText, 'نص CSV ملصوق')}
                    disabled={!rawPastedText.trim()}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                  >
                    معالجة وقراءة النص الملصوق ✨
                  </button>
                </div>
              )}

              {/* Error Box */}
              {parseError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          ) : (

            /* 2. PREVIEW & RESTORE OPTIONS (WHEN ITEMS PARSED SUCCESSFULLY) */
            <div className="space-y-4">
              
              {/* TOP SUMMARY STATS & RE-UPLOAD BUTTON */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                      <span>الملف: {fileName}</span>
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {parsedItems.length} صنف تم التعرف عليها
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono">
                      <span className="text-emerald-700 font-bold">🟢 {newCount} صنف جديد</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-blue-700 font-bold">🔵 {existingCount} صنف موجود مسبقاً</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-600 font-bold">📦 {totalStockPieces} قطعة محددة</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setParsedItems([]);
                    setFileName('');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>اختيار ملف آخر</span>
                </button>
              </div>

              {/* RESTORE STRATEGY SELECTION CARDS */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  ⚙️ اختر طريقة الاستيراد والاستعادة لقاعدة البيانات:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Mode 1: Merge & Update */}
                  <div
                    onClick={() => setRestoreMode('merge_update')}
                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer space-y-1.5 ${
                      restoreMode === 'merge_update'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>🔄 دمج وتحديث (موصى به)</span>
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        restoreMode === 'merge_update' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}>
                        {restoreMode === 'merge_update' && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      يضيف الأصناف الجديدة، ويحدّث أسعار وكميات الأصناف المتطابقة بالباركود أو الاسم.
                    </p>
                  </div>

                  {/* Mode 2: Add New Only */}
                  <div
                    onClick={() => setRestoreMode('add_new_only')}
                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer space-y-1.5 ${
                      restoreMode === 'add_new_only'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>➕ إضافة الأصناف الجديدة فقط</span>
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        restoreMode === 'add_new_only' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}>
                        {restoreMode === 'add_new_only' && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      يكتفي بإضافة الأصناف غير المسجلة ويتجاهل الأصناف الموجودة مسبقاً دون المساس بها.
                    </p>
                  </div>

                  {/* Mode 3: Full Database Replace */}
                  <div
                    onClick={() => setRestoreMode('full_replace')}
                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer space-y-1.5 ${
                      restoreMode === 'full_replace'
                        ? 'border-rose-600 bg-rose-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                        <span>⚠️ استعادة كاملة واستبدال</span>
                      </span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        restoreMode === 'full_replace' ? 'border-rose-600 bg-rose-600' : 'border-slate-300'
                      }`}>
                        {restoreMode === 'full_replace' && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-rose-600 leading-relaxed">
                      يستبدل قائمة الأصناف الحالية بالكامل بالمخزون المستورد كنسخة احتياطية مسترجعة.
                    </p>
                  </div>
                </div>

                {/* Sub-option for Merge Mode: Stock Add vs Replace */}
                {restoreMode === 'merge_update' && (
                  <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-xs mt-2 flex-wrap gap-2">
                    <span className="text-slate-700 font-bold">طريقة احتساب كمية الأصناف المسبقة:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStockHandling('replace')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          stockHandling === 'replace' 
                            ? 'bg-indigo-600 text-white shadow-2xs' 
                            : 'bg-white text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        تعيين الكمية الجديدة للمخزون
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockHandling('add')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          stockHandling === 'add' 
                            ? 'bg-indigo-600 text-white shadow-2xs' 
                            : 'bg-white text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        إضافة الكمية إلى المخزون الحالي (+)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SEARCH & PREVIEW FILTER BAR */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث في الأصناف المستوردة..."
                      className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setFilterType('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      الكل ({parsedItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('new')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterType === 'new' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      جديدة فقط ({newCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('existing')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterType === 'existing' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      موجودة مسبقاً ({existingCount})
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(true)}
                      className="text-indigo-600 hover:underline font-bold"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(false)}
                      className="text-slate-500 hover:underline font-bold"
                    >
                      إلغاء التحديد
                    </button>
                  </div>

                  <span className="font-bold text-slate-700">
                    تم تحديد: <span className="text-indigo-600 font-mono">{selectedCount}</span> من {parsedItems.length} صنف
                  </span>
                </div>
              </div>

              {/* DATA PREVIEW TABLE */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/80 sticky top-0 z-10 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 w-10 text-center">✓</th>
                        <th className="p-2.5">اسم الصنف</th>
                        <th className="p-2.5">الباركود</th>
                        <th className="p-2.5">التصنيف</th>
                        <th className="p-2.5 text-center">الكمية</th>
                        <th className="p-2.5 text-center">التكلفة</th>
                        <th className="p-2.5 text-center">البيع</th>
                        <th className="p-2.5 text-center">الحالة</th>
                        <th className="p-2.5 w-8 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPreview.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400">
                            لا توجد أصناف مطابقة للبحث أو التصفية الحالية.
                          </td>
                        </tr>
                      ) : (
                        filteredPreview.map((item) => (
                          <tr 
                            key={item.id}
                            className={`hover:bg-slate-50 transition ${
                              !item.selected ? 'opacity-40 bg-slate-50/50' : ''
                            }`}
                          >
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() => handleToggleSelectItem(item.id)}
                                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-2 font-bold text-slate-900">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItemField(item.id, 'name', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white px-1 py-0.5 rounded focus:outline-none"
                              />
                            </td>
                            <td className="p-2 font-mono text-[11px] text-slate-600">
                              <input
                                type="text"
                                value={item.barcode}
                                onChange={(e) => handleUpdateItemField(item.id, 'barcode', e.target.value)}
                                className="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white px-1 py-0.5 rounded focus:outline-none"
                              />
                            </td>
                            <td className="p-2 text-slate-600">
                              <input
                                type="text"
                                value={item.category}
                                onChange={(e) => handleUpdateItemField(item.id, 'category', e.target.value)}
                                className="w-20 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white px-1 py-0.5 rounded focus:outline-none"
                              />
                            </td>
                            <td className="p-2 text-center font-mono font-bold">
                              <input
                                type="number"
                                value={item.stock}
                                onChange={(e) => handleUpdateItemField(item.id, 'stock', Number(e.target.value))}
                                className="w-14 text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="p-2 text-center font-mono text-slate-700">
                              <input
                                type="number"
                                value={item.costPrice}
                                onChange={(e) => handleUpdateItemField(item.id, 'costPrice', Number(e.target.value))}
                                className="w-16 text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-indigo-700">
                              <input
                                type="number"
                                value={item.sellingPrice}
                                onChange={(e) => handleUpdateItemField(item.id, 'sellingPrice', Number(e.target.value))}
                                className="w-16 text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="p-2 text-center">
                              {item.isExisting ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                                  موجود مسبقاً 🔵
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                  صنف جديد 🟢
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteParsedItem(item.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                                title="حذف هذا الصف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            إلغاء وإغلاق
          </button>

          {parsedItems.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={selectedCount === 0 || isProcessing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-500/20 active:scale-95 transition flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>
                  {restoreMode === 'full_replace' 
                    ? `تأكيد استبدال المخزون (${selectedCount} صنف) ⚠️` 
                    : `تأكيد الاستيراد والاستعادة (${selectedCount} صنف) ✅`
                  }
                </span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
