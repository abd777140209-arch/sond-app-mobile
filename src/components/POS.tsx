/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, User, CreditCard, Banknote, Tag, ShieldCheck, Barcode } from 'lucide-react';
import { Product, Customer, Invoice, InvoiceItem, InvoiceType } from '../types';
import { soundManager } from '../utils/sound';

interface POSProps {
  products: Product[];
  customers: Customer[];
  onCompleteSale: (invoice: Omit<Invoice, 'id' | 'invoiceNumber'>) => void;
  currency: string;
}

export default function POS({ products, customers, onCompleteSale, currency }: POSProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<InvoiceType>('cash');
  const [posError, setPosError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');

  const categoriesList = ['الكل', 'أجهزة', 'إكسسوارات', 'قطع صيانة', 'برمجيات', 'أخرى'];

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Auto focus barcode scanner input on mount
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  // Handle manual or scanned barcode submission
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanBarcode = barcodeInput.trim();
    if (!cleanBarcode) return;

    const matchedProduct = products.find(p => p.barcode === cleanBarcode);
    if (matchedProduct) {
      addProductToCart(matchedProduct);
      setBarcodeInput('');
      setPosError('');
    } else {
      soundManager.playWarningBeep();
      setPosError(`⚠️ لم يتم العثور على سلعة بالباركود: ${cleanBarcode}`);
    }
  };

  const addProductToCart = (product: Product) => {
    soundManager.playScanBeep();
    if (product.stock <= 0) {
      setPosError(`⚠️ المنتج "${product.name}" غير متوفر حالياً بالمستودع!`);
      soundManager.playWarningBeep();
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          setPosError(`⚠️ عذراً، الكمية المطلوبة تتجاوز المخزون المتوفر في المستودع (${product.stock} حبات).`);
          soundManager.playWarningBeep();
          return prevCart;
        }
        return prevCart.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.sellingPrice }
            : item
        );
      } else {
        return [...prevCart, {
          productId: product.id,
          name: product.name,
          quantity: 1,
          sellingPrice: product.sellingPrice,
          total: product.sellingPrice
        }];
      }
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    soundManager.playScanBeep();
    const targetProduct = products.find(p => p.id === productId);
    if (!targetProduct) return;

    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.productId === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > targetProduct.stock) {
            setPosError(`⚠️ الحد الأقصى المتوفر في المخزن هو ${targetProduct.stock} حبة.`);
            soundManager.playWarningBeep();
            return item;
          }
          return {
            ...item,
            quantity: newQty,
            total: newQty * item.sellingPrice
          };
        }
        return item;
      }).filter(Boolean) as InvoiceItem[];
    });
  };

  const removeCartItem = (productId: string) => {
    soundManager.playWarningBeep();
    setCart(prevCart => prevCart.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    soundManager.playWarningBeep();
    setCart([]);
    setDiscountInput(0);
    setSelectedCustomerId('');
    setPaymentType('cash');
    setPosError('');
  };

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const cartTotal = Math.max(0, cartSubtotal - discountInput);

  const handleCheckout = () => {
    if (cart.length === 0) {
      soundManager.playWarningBeep();
      setPosError('⚠️ لا توجد أي سلع في سلة المبيعات لإتمام الفاتورة!');
      return;
    }

    if (paymentType === 'debt' && !selectedCustomerId) {
      soundManager.playWarningBeep();
      setPosError('⚠️ مبيعات الآجل (الذمم) تتطلب اختيار عميل مسجل من القائمة لتقييد الدين عليه!');
      return;
    }

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    const customerName = selectedCustomer ? selectedCustomer.name : 'عميل سفري / نقدي';

    // Call callback to finish sale
    onCompleteSale({
      customerId: selectedCustomerId || null,
      customerName: customerName,
      items: cart,
      totalAmount: cartSubtotal,
      discount: discountInput,
      finalAmount: cartTotal,
      type: paymentType,
      date: new Date().toISOString()
    });

    // Reset POS form
    setCart([]);
    setDiscountInput(0);
    setSelectedCustomerId('');
    setPaymentType('cash');
    setPosError('');
    soundManager.playSuccessChime();
  };

  // Filter products for quick selection grid
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    const matchesCategory = selectedCategory === 'الكل' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div id="pos_tab_view" className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      
      {/* LEFT: Products selection catalogue & Barcode scanning (8 columns on large screens) */}
      <div className="xl:col-span-7 space-y-4">
        
        {/* Error notification bar */}
        {posError && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-semibold animate-pulse flex justify-between items-center">
            <span>{posError}</span>
            <button onClick={() => setPosError('')} className="text-gray-400 hover:text-white px-1">✕</button>
          </div>
        )}

        {/* Dual Input Section (Barcode Scanner and Search) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Simulated Barcode Wedge Wedge Input */}
          <form onSubmit={handleBarcodeSubmit} className="relative">
            <label className="block text-[11px] text-gray-400 mb-1 font-semibold flex items-center gap-1.5">
              <Barcode className="w-3.5 h-3.5 text-[#C5A862]" />
              قارئ الباركود والليزري (Auto Focus)
            </label>
            <div className="relative">
              <input
                id="pos_barcode_input"
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="امسح بالليزر أو اكتب الباركود..."
                className="w-full pl-10 pr-3 py-2 text-xs rounded-xl bg-[#0F1824] border border-[#C5A862]/30 text-white font-mono placeholder-gray-500 focus:outline-none focus:border-[#C5A862] focus:ring-1 focus:ring-[#C5A862]/50 transition-all text-left"
              />
              <button
                type="submit"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[#C5A862]/10 hover:bg-[#C5A862]/30 text-[#C5A862] cursor-pointer font-bold text-[10px]"
              >
                إدخال
              </button>
            </div>
          </form>

          {/* Search bar */}
          <div className="relative">
            <label className="block text-[11px] text-gray-400 mb-1 font-semibold">بحث سريع بالاسم أو الباركود</label>
            <div className="relative">
              <input
                id="pos_search_input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن المنتجات بالاسم أو رمز الباركود..."
                className="w-full pr-10 pl-3 py-2 text-xs rounded-xl bg-[#0F1824] border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-[#C5A862] transition-all"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
          </div>

        </div>

        {/* Quick Products Catalog Grid */}
        <div className="p-4 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <div>
              <h3 className="text-xs font-bold text-gray-300">كاتلوج السلع السريع ({filteredProducts.length} صنف)</h3>
              <p className="text-[10px] text-gray-500">اضغط على الصنف لإضافته مباشرة للفاتورة</p>
            </div>
            
            {/* Category Pills */}
            <div className="flex flex-wrap gap-1 bg-[#141E2B] border border-gray-800 p-0.5 rounded-lg text-[9px] font-bold">
              {categoriesList.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    soundManager.playScanBeep();
                    setSelectedCategory(cat);
                  }}
                  className={`px-2 py-1 rounded cursor-pointer transition ${
                    selectedCategory === cat 
                      ? 'bg-[#C5A862] text-black' 
                      : 'text-gray-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto p-1">
            {filteredProducts.map(product => {
              const outOfStock = product.stock <= 0;
              const isLow = product.stock <= product.minStock;
              return (
                <button
                  id={`add_p_btn_${product.id}`}
                  key={product.id}
                  disabled={outOfStock}
                  onClick={() => addProductToCart(product)}
                  className={`p-3 rounded-xl border text-right transition-all duration-200 cursor-pointer flex flex-col justify-between h-[105px] group ${
                    outOfStock
                      ? 'bg-red-950/10 border-red-950/30 opacity-50 cursor-not-allowed'
                      : isLow
                      ? 'bg-[#182330] border-amber-600/30 hover:border-[#C5A862] hover:bg-[#1E2E40]'
                      : 'bg-[#121D29] border-gray-800/80 hover:border-[#C5A862] hover:bg-[#1A2838]'
                  }`}
                >
                  <div>
                    <div className="text-[11px] font-bold text-gray-100 line-clamp-2 leading-relaxed">
                      {product.name}
                    </div>
                    <div className="text-[9px] text-gray-500 font-mono mt-1">
                      {product.barcode}
                    </div>
                  </div>

                  <div className="flex justify-between items-end mt-2 w-full border-t border-gray-800/40 pt-1">
                    <span className="text-[11px] font-bold text-[#C5A862] font-mono">
                      {(product.sellingPrice).toLocaleString()} {currency}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${
                      outOfStock ? 'text-red-500' : isLow ? 'text-amber-400' : 'text-green-500'
                    }`}>
                      {outOfStock ? 'نفد' : `متاح: ${product.stock}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Sample Barcodes Wedge helper */}
        <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-gray-400 flex flex-wrap gap-2 items-center">
          <span className="font-semibold text-[11px] text-[#C5A862] flex items-center gap-1">
            <Barcode className="w-3.5 h-3.5" /> باركودات محاكاة للتجربة السريعة:
          </span>
          {products.slice(0, 5).map(p => (
            <button
              id={`quick_barcode_${p.barcode}`}
              key={p.id}
              onClick={() => {
                setBarcodeInput(p.barcode);
                soundManager.playScanBeep();
              }}
              className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:text-white transition text-[10px] font-mono text-gray-300 cursor-pointer"
            >
              {p.name.split(' ')[0]} ({p.barcode})
            </button>
          ))}
        </div>

      </div>

      {/* RIGHT: Active Invoice Receipt Draft & Checkout (5 columns) */}
      <div className="xl:col-span-5 space-y-4">
        
        <div className="rounded-2xl border border-[#C5A862]/30 bg-[#0F1824] shadow-xl overflow-hidden flex flex-col justify-between">
          
          {/* Receipt Header */}
          <div className="p-4 bg-gradient-to-l from-[#182433] to-[#0F1824] border-b border-[#C5A862]/20 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#C5A862]" />
              <div>
                <h3 className="text-xs font-bold text-[#F3E7C4]">مسودة الفاتورة الجارية</h3>
                <p className="text-[10px] text-gray-400">سجل مشتريات الزبون</p>
              </div>
            </div>
            
            {cart.length > 0 && (
              <button
                id="clear_cart_btn"
                onClick={clearCart}
                className="px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition text-[10px] font-semibold cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> تصفير السلة
              </button>
            )}
          </div>

          {/* Cart items list */}
          <div className="p-4 min-h-[220px] max-h-[300px] overflow-y-auto divide-y divide-gray-800/40">
            {cart.length === 0 ? (
              <div className="py-16 text-center text-gray-500 text-xs flex flex-col items-center justify-center gap-2">
                <ShoppingCart className="w-8 h-8 text-gray-600 animate-pulse" />
                سلة المبيعات فارغة تماماً.
                <br />
                اكتب باركوداً باليسار أو اختر سلعة للبدء!
              </div>
            ) : (
              cart.map(item => (
                <div key={item.productId} className="py-2.5 flex justify-between items-center gap-3">
                  
                  {/* Item Description */}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-gray-200 truncate">{item.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {item.sellingPrice.toLocaleString()} × {item.quantity} = {item.total.toLocaleString()} {currency}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      id={`dec_qty_btn_${item.productId}`}
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="p-1 rounded bg-[#182330] hover:bg-[#203144] border border-gray-800 text-gray-300 hover:text-white cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-xs text-white font-mono">{item.quantity}</span>
                    <button
                      id={`inc_qty_btn_${item.productId}`}
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="p-1 rounded bg-[#182330] hover:bg-[#203144] border border-gray-800 text-gray-300 hover:text-white cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Delete Button */}
                  <button
                    id={`del_cart_item_${item.productId}`}
                    onClick={() => removeCartItem(item.productId)}
                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                </div>
              ))
            )}
          </div>

          {/* Checkout & Bill Summary controls */}
          <div className="p-4 bg-gradient-to-b from-[#111A26] to-[#0D151F] border-t border-gray-800 space-y-4">
            
            {/* Customer Linker Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#C5A862]" />
                ربط الفاتورة بعميل (اختياري للنقدي، إجباري للآجل):
              </label>
              <select
                id="pos_customer_select"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
              >
                <option value="">-- عميل مجهول / بيع نقدي سفري --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.totalDebt > 0 ? `(عليه دين: ${c.totalDebt.toLocaleString()} ${currency})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Discount & Promo Input */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-[#C5A862]" />
                  خصم نقدي مباشر ({currency}):
                </label>
                <input
                  id="pos_discount_input"
                  type="number"
                  min="0"
                  value={discountInput || ''}
                  onChange={(e) => setDiscountInput(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-full bg-[#16212E] border border-gray-800 text-xs font-bold font-mono rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-[#C5A862]"
                />
              </div>

              {/* Payment Terms Selector */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-[#C5A862]" />
                  شروط وطريقة الدفع:
                </label>
                <div className="flex bg-[#16212E] border border-gray-800 rounded-xl p-0.5">
                  <button
                    id="pay_type_cash"
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      setPaymentType('cash');
                    }}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      paymentType === 'cash'
                        ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-3 h-3" /> نقدي
                  </button>
                  <button
                    id="pay_type_debt"
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      setPaymentType('debt');
                    }}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      paymentType === 'debt'
                        ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" /> بيع آجل
                  </button>
                </div>
              </div>
            </div>

            {/* Calculations readout */}
            <div className="p-3 rounded-xl bg-[#090E14]/80 border border-gray-800/60 text-xs space-y-2">
              <div className="flex justify-between text-gray-400">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{cartSubtotal.toLocaleString()} {currency}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>الخصم المطبق:</span>
                <span className="font-mono text-amber-400">-{discountInput.toLocaleString()} {currency}</span>
              </div>
              <div className="h-px bg-gray-800/60 my-1"></div>
              <div className="flex justify-between items-center text-sm font-bold text-white">
                <span>الصافي المطلوب للتسديد:</span>
                <span className="font-mono text-xl text-transparent bg-clip-text bg-gradient-to-r from-white to-[#C5A862]">
                  {cartTotal.toLocaleString()} {currency}
                </span>
              </div>
            </div>

            {/* Checkout Trigger Button */}
            <button
              id="pos_complete_checkout_btn"
              type="button"
              onClick={handleCheckout}
              className={`w-full py-3 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#BF953F] via-[#F3E7C4] to-[#B38728] hover:from-[#A0813D] hover:to-[#9F8342] shadow-[0_4px_12px_rgba(197,168,98,0.25)] hover:shadow-[0_4px_16px_rgba(197,168,98,0.4)] active:scale-[0.98] transition-all cursor-pointer text-center flex items-center justify-center gap-2`}
            >
              <Banknote className="w-4 h-4" /> إتمام وحفظ فاتورة المبيعات الجديدة
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}
