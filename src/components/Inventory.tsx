/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  Tag
} from 'lucide-react';
import { Product } from '../types';
import { soundManager } from '../utils/sound';

interface InventoryProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  currency: string;
}

export default function Inventory({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  currency
}: InventoryProps) {
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

  // Category list
  const categoriesList = ['أجهزة', 'إكسسوارات', 'قطع صيانة', 'برمجيات', 'أخرى'];
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('الكل');

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

  // Calculate statistics
  const totalStockCount = activeProductsList.reduce((acc, p) => acc + p.stock, 0);
  const totalCostValue = activeProductsList.reduce((acc, p) => acc + (p.costPrice * p.stock), 0);
  const totalPotentialProfit = activeProductsList.reduce((acc, p) => acc + ((p.sellingPrice - p.costPrice) * p.stock), 0);
  const lowStockItemsCount = activeProductsList.filter(p => p.stock <= p.minStock).length;

  return (
    <div id="inventory_tab_view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* 1. TOP STATISTICAL BAR */}
      <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">إجمالي السلع بالمستودع</span>
            <h3 className="text-lg font-black text-slate-900 mt-1">{activeProductsList.length} صنف</h3>
            <span className="text-[10px] text-slate-400">عدد القطع الكلي: {totalStockCount} قطعة</span>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">قيمة المخزون بسعر التكلفة</span>
            <h3 className="text-lg font-black text-slate-900 mt-1 dir-ltr text-right">
              {totalCostValue.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span>
            </h3>
            <span className="text-[10px] text-slate-400">رأس المال المستثمر بالمخزن</span>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">الأرباح المتوقعة عند البيع</span>
            <h3 className="text-lg font-black text-emerald-600 mt-1 dir-ltr text-right">
              +{totalPotentialProfit.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span>
            </h3>
            <span className="text-[10px] text-slate-400">هامش الربح الإجمالي</span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
            <Sparkles className="w-5 h-5" />
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

      {/* 2. SEARCH & FILTER BAR */}
      <div className="lg:col-span-12 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              البحث المباشر والتصفية الذكية للأصناف
            </h2>
            <p className="text-xs text-slate-400">ابحث باسم السلعة أو امسح الباركود بالليزر لتصفية المستودع</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter Pills */}
            <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs font-bold">
              <button
                onClick={() => setSelectedCategoryFilter('الكل')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  selectedCategoryFilter === 'الكل' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                الكل
              </button>
              {categoriesList.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    selectedCategoryFilter === cat ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                filterLowStock 
                  ? 'bg-rose-600 text-white shadow-sm' 
                  : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>المنتهية والمنخفضة فقط</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            id="top_inventory_search_input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔎 ابحث بالاسم، الموديل، التصنيف، أو امسح رمز الباركود بالليزر..."
            className="w-full pr-10 pl-4 py-3 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* 3. LEFT COLUMN: Add / Edit Product Form (5 Cols) */}
      <div className="lg:col-span-5 space-y-6">
        
        {editingProduct ? (
          /* EDIT PRODUCT FORM */
          <div className="p-5 rounded-2xl bg-white border border-blue-500/50 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                تعديل بيانات السلعة
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">اسم السلعة / الموديل:</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">الباركود:</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.barcode}
                    onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">التصنيف:</label>
                  <select
                    value={editingProduct.category || 'إكسسوارات'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
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
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ADD NEW PRODUCT FORM */
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">إضافة سلعة جديدة للمستودع</h3>
                <p className="text-[11px] text-slate-400">سجل البضائع والمنتجات الجديدة</p>
              </div>
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
                    className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> توليد باركود تلقائي
                  </button>
                </div>
                <input
                  id="add_p_barcode"
                  type="text"
                  required
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="امسح بالليزر أو ولد باركود..."
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">التصنيف:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
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
          </div>
        )}

      </div>

      {/* 4. RIGHT COLUMN: Inventory Products Table (7 Cols) */}
      <div className="lg:col-span-7 space-y-6">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900">سجل بضائع ومحتويات المستودع</h3>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
              {filteredProducts.length} صنف مسجل
            </span>
          </div>

          <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
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
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Barcode className="w-3 h-3 text-slate-400" /> {p.barcode}
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
                          {p.sellingPrice.toLocaleString()} {currency}
                        </td>
                        <td className="py-3 pl-2 text-left flex justify-end gap-1.5">
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

    </div>
  );
}
