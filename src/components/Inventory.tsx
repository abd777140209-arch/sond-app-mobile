/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Package, PlusCircle, Sparkles, Pencil, Trash2, AlertTriangle, Layers, Percent, DollarSign } from 'lucide-react';
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

  // Auto generate a unique random barcode for accessories or repairs that don't have tags
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
    if (products.some(p => p.barcode === barcode.trim())) {
      setAddError('⚠️ الباركود مسجل مسبقاً لسلعة أخرى!');
      soundManager.playWarningBeep();
      return;
    }

    if (costPrice < 0 || sellingPrice < 0) {
      setAddError('⚠️ لا يمكن أن تكون الأسعار سالبة!');
      soundManager.playWarningBeep();
      return;
    }

    if (sellingPrice < costPrice) {
      // Just a warning in console but allow it
      console.warn('Selling price is less than cost price');
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
    setCategory('إكسسوارات');
    soundManager.playSuccessChime();
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editingProduct.name.trim() || !editingProduct.barcode.trim()) {
      soundManager.playWarningBeep();
      alert('⚠️ اسم المنتج والباركود حقول مطلوبة!');
      return;
    }

    // Check barcode duplication
    const duplicate = products.find(p => p.barcode === editingProduct.barcode.trim() && p.id !== editingProduct.id);
    if (duplicate) {
      soundManager.playWarningBeep();
      alert('⚠️ هذا الباركود مسجل مسبقاً لسلعة أخرى في المستودع!');
      return;
    }

    onUpdateProduct(editingProduct);
    setEditingProduct(null);
    soundManager.playSuccessChime();
  };

  // Stats summaries
  const totalItems = products.length;
  const totalStockCount = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    const matchesLowStock = !filterLowStock || p.stock <= p.minStock;
    const matchesCategory = selectedCategoryFilter === 'الكل' || p.category === selectedCategoryFilter;
    return matchesSearch && matchesLowStock && matchesCategory;
  });

  return (
    <div id="inventory_tab_view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* TOP: Prominent Real-time Search and Filter Bar */}
      <div className="lg:col-span-12 p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/30 shadow-xl relative overflow-hidden">
        {/* Shiny gold corner accents */}
        <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-[#C5A862]/30 rounded-tr-xl"></div>
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-[#C5A862]/30 rounded-bl-xl"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[#F3E7C4] flex items-center gap-2">
              <Search className="w-5 h-5 text-[#C5A862]" />
              البحث المباشر والتصفية الذكية للأصناف
            </h2>
            <p className="text-[11px] text-gray-400">
              اكتب اسم الصنف أو امسح رمز الباركود بالليزر للتصفية التلقائية الفورية لكافة تفاصيل المستودع.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full font-bold">
              {filteredProducts.length} أصناف مطابقة للبحث
            </span>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  soundManager.playScanBeep();
                }}
                className="text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2.5 py-1 rounded-full font-bold cursor-pointer transition"
              >
                مسح البحث ×
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 relative">
          <input
            id="top_inventory_search_input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔎 اكتب اسم الصنف، الموديل، الشركة المصنعة، أو امسح الباركود مباشرة بالليزر..."
            className="w-full pr-11 pl-4 py-3 text-xs md:text-sm rounded-xl bg-[#16212E] border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-[#C5A862] transition-all font-sans font-medium shadow-inner"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#C5A862]" />
        </div>
      </div>

      {/* LEFT: Add/Edit Product panel (5 columns) */}
      <div className="lg:col-span-5 space-y-6">
        
        {editingProduct ? (
          /* EDIT PRODUCT FORM */
          <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862] shadow-xl relative animate-fadeIn">
            <h3 className="text-sm font-bold text-[#F3E7C4] flex items-center gap-2 mb-1.5">
              <Pencil className="w-5 h-5 text-[#C5A862]" />
              تعديل بيانات السلعة الحالية
            </h3>
            <p className="text-[11px] text-gray-400 mb-4">قم بتعديل مواصفات المنتج أو الأسعار أو تعديل مستويات مخزونه.</p>

            <form onSubmit={handleUpdateSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">اسم السلعة / الموديل:</label>
                <input
                  id="edit_p_name"
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-[#16212E] border border-[#C5A862]/30 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">الباركود المسجل:</label>
                  <input
                    id="edit_p_barcode"
                    type="text"
                    required
                    value={editingProduct.barcode}
                    onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-mono rounded-xl px-3 py-2 text-white text-left focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">قسم السلعة (التصنيف):</label>
                  <select
                    value={editingProduct.category || 'إكسسوارات'}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">الكمية المتوفرة حالياً:</label>
                  <input
                    id="edit_p_stock"
                    type="number"
                    min="0"
                    required
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">حد الطلب الأدنى للتنبيه بنفاد الكمية:</label>
                  <input
                    id="edit_p_min"
                    type="number"
                    min="0"
                    required
                    value={editingProduct.minStock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, minStock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">سعر التكلفة (سعر الشراء):</label>
                  <input
                    id="edit_p_cost"
                    type="number"
                    min="0"
                    required
                    value={editingProduct.costPrice}
                    onChange={(e) => setEditingProduct({ ...editingProduct, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">سعر البيع للمستهلك:</label>
                  <input
                    id="edit_p_sell"
                    type="number"
                    min="0"
                    required
                    value={editingProduct.sellingPrice}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">حد الطلب الأدنى للتنبيه بنفاد الكمية:</label>
                  <input
                    id="edit_p_min"
                    type="number"
                    min="0"
                    required
                    value={editingProduct.minStock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, minStock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  id="update_product_btn"
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#C5A862] text-black hover:bg-[#A0813D] transition cursor-pointer"
                >
                  حفظ التعديلات
                </button>
                <button
                  id="cancel_edit_product_btn"
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-800 text-gray-300 hover:bg-gray-700 transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ADD NEW PRODUCT FORM */
          <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 shadow-lg relative">
            <h3 className="text-sm font-bold text-[#F3E7C4] flex items-center gap-2 mb-1.5">
              <PlusCircle className="w-5 h-5 text-[#C5A862]" />
              إضافة سلعة أو بضاعة جديدة للمستودع
            </h3>
            <p className="text-[11px] text-gray-400 mb-4">سجل السلع الجديدة، الهواتف الذكية، الاكسسوارات، أو خدمات الصيانة هنا.</p>

            {addError && (
              <div className="p-2 mb-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] font-semibold">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">اسم السلعة / الماركة والموديل:</label>
                <input
                  id="new_p_name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: سماعة شاومي ريدمي بودز 5..."
                  className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">الرقم التسلسلي (الباركود):</label>
                  <div className="relative">
                    <input
                      id="new_p_barcode"
                      type="text"
                      required
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="امسح بالليزر أو ولد تلقائي..."
                      className="w-full bg-[#16212E] border border-gray-800 text-xs font-mono rounded-xl pl-8 pr-3 py-2 text-white text-left focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 text-[#C5A862] hover:bg-slate-800 rounded cursor-pointer"
                      title="توليد باركود فريد عشوائي"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">الكمية الابتدائية الواردة:</label>
                  <input
                    id="new_p_stock"
                    type="number"
                    min="0"
                    required
                    value={stock || ''}
                    onChange={(e) => setStock(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="مثال: 15"
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">سعر تكلفة الشراء ({currency}):</label>
                  <input
                    id="new_p_cost"
                    type="number"
                    min="0"
                    required
                    value={costPrice || ''}
                    onChange={(e) => setCostPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="التكلفة"
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">سعر البيع للمستهلك ({currency}):</label>
                  <input
                    id="new_p_sell"
                    type="number"
                    min="0"
                    required
                    value={sellingPrice || ''}
                    onChange={(e) => setSellingPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="البيع"
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">حد الطلب الأدنى للتنبيه بنقص المخزون:</label>
                  <input
                    id="new_p_min"
                    type="number"
                    min="0"
                    required
                    value={minStock || ''}
                    onChange={(e) => setMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="2"
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold">تصنيف / فئة السلعة:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {costPrice > 0 && sellingPrice > 0 && (
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] space-y-1 text-gray-400">
                  <div className="flex justify-between">
                    <span>الهامش الربحي المفترض للقطعة:</span>
                    <span className="font-bold text-green-400">+{((sellingPrice - costPrice)).toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>نسبة الربح المئوية:</span>
                    <span className="font-bold text-green-400">{Math.round(((sellingPrice - costPrice) / costPrice) * 100)}%</span>
                  </div>
                </div>
              )}

              <button
                id="submit_new_product_btn"
                type="submit"
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#C5A862] text-black hover:bg-[#A0813D] transition duration-200 cursor-pointer text-center"
              >
                تثبيت وإدراج الصنف بالمخزن
              </button>
            </form>
          </div>
        )}

      </div>

      {/* RIGHT: Inventory List auditing panel (7 columns) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Quick Inventory Stock statistics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-[#0F1824] border border-[#C5A862]/10 flex items-center gap-2.5 shadow">
            <Layers className="w-5 h-5 text-[#C5A862]" />
            <div>
              <div className="text-[10px] text-gray-400">عدد الأصناف</div>
              <div className="text-sm font-bold text-white font-mono">{totalItems} أصناف</div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0F1824] border border-[#C5A862]/10 flex items-center gap-2.5 shadow">
            <Package className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-[10px] text-gray-400">قطع البضائع الكلية</div>
              <div className="text-sm font-bold text-white font-mono">{totalStockCount} حبة</div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#0F1824] border border-[#C5A862]/10 flex items-center gap-2.5 shadow">
            <AlertTriangle className={`w-5 h-5 ${lowStockCount > 0 ? 'text-amber-400 animate-pulse' : 'text-green-500'}`} />
            <div>
              <div className="text-[10px] text-gray-400">نواقص المخزون</div>
              <div className={`text-sm font-bold font-mono ${lowStockCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {lowStockCount} أصناف
              </div>
            </div>
          </div>
        </div>

        {/* Database Directory Filterable table */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#F3E7C4]">قائمة السلع والخدمات بالمخزن</h3>
              <p className="text-[11px] text-gray-400">تدقيق ومراجعة كميات وأسعار بضائع المحل</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Category Filter */}
              <div className="flex items-center gap-1 bg-[#16212E] border border-gray-800 rounded-xl px-2.5 py-1 text-[11px]">
                <span className="text-gray-400 font-bold">التصنيف:</span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="bg-transparent text-[#C5A862] font-bold focus:outline-none text-[11px] cursor-pointer"
                >
                  <option value="الكل">الكل</option>
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Filter alerts */}
              <label className="flex items-center gap-2 text-[11px] cursor-pointer text-gray-300 hover:text-white">
                <input
                  id="filter_low_stock_checkbox"
                  type="checkbox"
                  checked={filterLowStock}
                  onChange={(e) => setFilterLowStock(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-800 text-[#C5A862] focus:ring-0 focus:ring-offset-0 bg-[#16212E] accent-[#C5A862]"
                />
                تصفية السلع الناقصة فقط
              </label>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-4">
            <input
              id="inventory_search_input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو بمسح الباركود..."
              className="w-full pr-10 pl-3 py-2 text-xs rounded-xl bg-[#16212E] border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 transition-all"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>

          {/* Table list */}
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 pr-1">السلعة</th>
                  <th className="pb-3 text-center">التكلفة</th>
                  <th className="pb-3 text-center">البيع</th>
                  <th className="pb-3 text-center">المتوفر</th>
                  <th className="pb-3 pl-1 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      لا توجد بضائع تطابق خيارات التصفية والبحث في المخازن.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(product => {
                    const isLow = product.stock <= product.minStock;
                    const outOfStock = product.stock === 0;
                    return (
                      <tr key={product.id} className="hover:bg-[#182433]/30">
                        <td className="py-3 pr-1">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-gray-100">{product.name}</div>
                            {product.category && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-800 text-gray-400 border border-gray-700 font-semibold">
                                {product.category}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">{product.barcode}</div>
                        </td>
                        <td className="py-3 text-center font-mono text-gray-400">
                          {product.costPrice.toLocaleString()} {currency}
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-[#C5A862]">
                          {product.sellingPrice.toLocaleString()} {currency}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[10px] ${
                            outOfStock 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                              : isLow
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-green-500/10 text-green-400 border border-green-500/20'
                          }`}>
                            {product.stock} حبة
                          </span>
                        </td>
                        <td className="py-3 pl-1 text-left flex justify-end gap-1.5">
                          
                          <button
                            id={`edit_product_btn_${product.id}`}
                            onClick={() => {
                              soundManager.playScanBeep();
                              setEditingProduct(product);
                            }}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-black transition cursor-pointer"
                            title="تعديل بيانات السلعة"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`delete_product_btn_${product.id}`}
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من رغبتك في حذف الصنف "${product.name}" نهائياً من المستودع؟`)) {
                                soundManager.playWarningBeep();
                                onDeleteProduct(product.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-red-950/20 text-red-400 hover:bg-red-500 hover:text-white transition cursor-pointer"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
