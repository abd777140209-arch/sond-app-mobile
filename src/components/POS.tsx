/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  CreditCard, 
  Banknote, 
  Tag, 
  ShieldCheck, 
  Barcode,
  X,
  Check,
  AlertCircle,
  FileText,
  Mic,
  Camera,
  Printer,
  ShieldAlert,
  Edit2
} from 'lucide-react';
import { Product, Customer, Invoice, InvoiceItem, InvoiceType, SystemSettings } from '../types';
import { soundManager } from '../utils/sound';
import VoicePOSModal from './VoicePOSModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import BarcodeLabelPrinterModal from './BarcodeLabelPrinterModal';
import TypoGuardModal, { TypoGuardDetails } from './TypoGuardModal';

interface POSProps {
  products: Product[];
  customers: Customer[];
  onCompleteSale: (invoice: Omit<Invoice, 'id' | 'invoiceNumber'>) => void;
  currency: string;
  storeName?: string;
  settings?: SystemSettings;
}

export default function POS({ products, customers, onCompleteSale, currency, storeName = 'سند', settings }: POSProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<InvoiceType>('cash');
  const [posError, setPosError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  
  // Dynamic Currency Selector State
  const activeCurrencies = settings?.currencies && settings.currencies.length > 0
    ? settings.currencies
    : [
        { id: 'YER', code: 'YER', name: 'الريال اليمني', symbol: 'ر.ي', exchangeRate: 1, isBase: true },
        { id: 'SAR', code: 'SAR', name: 'الريال السعودي', symbol: 'ر.س', exchangeRate: 140, isBase: false },
        { id: 'USD', code: 'USD', name: 'الدولار الأمريكي', symbol: '$', exchangeRate: 530, isBase: false },
      ];

  const [saleCurrencySymbol, setSaleCurrencySymbol] = useState<string>(
    settings?.selectedCurrencySymbol || settings?.currency || 'ر.ي'
  );

  // Modal Visibility States
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showLabelPrinterModal, setShowLabelPrinterModal] = useState(false);

  // Typo Guard State
  const [typoGuardModalOpen, setTypoGuardModalOpen] = useState(false);
  const [typoGuardDetails, setTypoGuardDetails] = useState<TypoGuardDetails | null>(null);

  const categoriesList = ['الكل', 'أجهزة', 'إكسسوارات', 'قطع صيانة', 'برمجيات', 'أخرى'];

  // Filter out soft-deleted items
  const activeProducts = products.filter(p => p.isDeleted !== true);
  const activeCustomers = customers.filter(c => c.isDeleted !== true && c.isActive !== false);

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

    const matchedProduct = activeProducts.find(p => p.barcode === cleanBarcode);
    if (matchedProduct) {
      addProductToCart(matchedProduct);
      setBarcodeInput('');
      setPosError('');
    } else {
      soundManager.playWarningBeep();
      setPosError(`⚠️ لم يتم العثور على سلعة بالباركود: ${cleanBarcode}`);
    }
  };

  const addProductToCart = (product: Product, quantityToAdd = 1) => {
    soundManager.playScanBeep();
    if (product.stock <= 0) {
      setPosError(`⚠️ المنتج "${product.name}" غير متوفر حالياً بالمستودع!`);
      soundManager.playWarningBeep();
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      
      if (existingItem) {
        const newQty = existingItem.quantity + quantityToAdd;
        if (newQty > product.stock) {
          setPosError(`⚠️ عذراً، الكمية المطلوبة تتجاوز المخزون المتوفر في المستودع (${product.stock} حبات).`);
          soundManager.playWarningBeep();
          return prevCart;
        }
        return prevCart.map(item =>
          item.productId === product.id
            ? { ...item, quantity: newQty, total: newQty * item.sellingPrice }
            : item
        );
      } else {
        return [...prevCart, {
          productId: product.id,
          name: product.name,
          quantity: quantityToAdd,
          sellingPrice: product.sellingPrice,
          total: product.sellingPrice * quantityToAdd
        }];
      }
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    soundManager.playScanBeep();
    const targetProduct = activeProducts.find(p => p.id === productId);
    if (!targetProduct) return;

    const currentItem = cart.find(i => i.productId === productId);
    if (!currentItem) return;

    const newQty = currentItem.quantity + delta;

    // Typo Guard check if quantity > 50
    if (newQty > 50 && delta > 0) {
      soundManager.playWarningBeep();
      setTypoGuardDetails({
        title: 'درع حماية الأخطاء: كمية كبيرة جداً',
        itemName: currentItem.name,
        expectedValue: currentItem.quantity,
        enteredValue: newQty,
        reason: `الكمية المطلوب إضافتها كبيرة (${newQty} قطعة). هل أنت متأكد من صحة هذا الإدخال؟`,
        onConfirm: () => {
          applyQuantityChange(productId, newQty, targetProduct.stock);
        },
        onCancel: () => {}
      });
      setTypoGuardModalOpen(true);
      return;
    }

    applyQuantityChange(productId, newQty, targetProduct.stock);
  };

  const applyQuantityChange = (productId: string, newQty: number, maxStock: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.productId === productId) {
          if (newQty <= 0) return null;
          if (newQty > maxStock) {
            setPosError(`⚠️ الحد الأقصى المتوفر في المخزن هو ${maxStock} حبة.`);
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

  // Typo Guard for custom price edit in cart
  const handleEditItemPrice = (productId: string, newPrice: number) => {
    const targetProduct = activeProducts.find(p => p.id === productId);
    if (!targetProduct) return;

    const currentItem = cart.find(i => i.productId === productId);
    if (!currentItem) return;

    if (targetProduct.sellingPrice > 0) {
      const ratio = newPrice / targetProduct.sellingPrice;
      if (ratio < 0.5 || ratio > 2.0) {
        soundManager.playWarningBeep();
        setTypoGuardDetails({
          title: 'درع حماية الأخطاء: تفاوات كبير في السعر',
          itemName: currentItem.name,
          expectedValue: targetProduct.sellingPrice,
          enteredValue: newPrice,
          reason: `السعر المدخل (${newPrice} ${currency}) يختلف بأكثر من 50% عن السعر الافتراضي للسلعة (${targetProduct.sellingPrice} ${currency}).`,
          currency: currency,
          onConfirm: () => {
            applyItemPriceChange(productId, newPrice);
          },
          onCancel: () => {}
        });
        setTypoGuardModalOpen(true);
        return;
      }
    }

    applyItemPriceChange(productId, newPrice);
  };

  const applyItemPriceChange = (productId: string, newPrice: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          sellingPrice: newPrice,
          total: newPrice * item.quantity
        };
      }
      return item;
    }));
  };

  // Typo Guard for Discount Input
  const handleDiscountInputChange = (value: number) => {
    const cartSubtotal = cart.reduce((sum, item) => sum + item.total, 0);
    
    // Check if discount is more than 30% of subtotal
    if (cartSubtotal > 0 && value > cartSubtotal * 0.3) {
      soundManager.playWarningBeep();
      setTypoGuardDetails({
        title: 'درع حماية الأخطاء: خصم مرتفع جداً',
        itemName: 'خصم الفاتورة الكلي',
        expectedValue: Math.round(cartSubtotal * 0.1),
        enteredValue: value,
        reason: `مبلغ الخصم المدخل (${value} ${currency}) يتجاوز 30% من إجمالي الفاتورة (${cartSubtotal} ${currency}).`,
        currency: currency,
        onConfirm: () => {
          setDiscountInput(value);
        },
        onCancel: () => {}
      });
      setTypoGuardModalOpen(true);
      return;
    }

    setDiscountInput(value);
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

  const selectedCurrObj = activeCurrencies.find(c => c.symbol === saleCurrencySymbol || c.code === saleCurrencySymbol) || activeCurrencies[0];
  const selectedRate = selectedCurrObj?.exchangeRate && selectedCurrObj.exchangeRate > 0 ? selectedCurrObj.exchangeRate : 1;
  const convertedTotal = selectedCurrObj?.isBase ? cartTotal : (cartTotal / selectedRate);

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

    const selectedCustomer = activeCustomers.find(c => c.id === selectedCustomerId);
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
  const filteredProducts = activeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    const matchesCategory = selectedCategory === 'الكل' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div id="pos_tab_view" className="space-y-2.5 md:space-y-4">
      
      {/* 0. SMART TOOLS ACTION HEADER BAR */}
      <div className="bg-white border border-slate-200 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-blue-50 text-blue-600 font-bold text-xs flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>محطة البيع الذكية (Smart POS)</span>
          </div>
          <span className="hidden md:inline px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
            درع Typo Guard نشط 🛡️
          </span>
        </div>

        {/* Action Tool Launchers */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          
          {/* Voice POS Button */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setShowVoiceModal(true);
            }}
            className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-[11px] sm:text-xs flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer transition"
          >
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
            <span>المساعد الصوتي</span>
          </button>

          {/* Camera / Barcode Scanner */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setShowScannerModal(true);
            }}
            className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] sm:text-xs flex items-center gap-1 border border-slate-200 cursor-pointer transition"
          >
            <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
            <span>قارئ الكاميرا</span>
          </button>

          {/* Bluetooth Barcode Label Printer */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setShowLabelPrinterModal(true);
            }}
            className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] sm:text-xs flex items-center gap-1 border border-slate-200 cursor-pointer transition"
          >
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
            <span>طباعة الملصقات</span>
          </button>

        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 md:gap-6 items-start">
        
        {/* LEFT: Products selection catalogue & Barcode scanning (7 cols) */}
        <div className="xl:col-span-7 space-y-4">
          
          {/* Error Notification Bar */}
          {posError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex justify-between items-center shadow-sm">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                {posError}
              </span>
              <button onClick={() => setPosError('')} className="text-rose-400 hover:text-rose-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Barcode & Search Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Barcode Scanner Input */}
            <form onSubmit={handleBarcodeSubmit} className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-blue-600" />
                <span>قارئ الباركود (الماسح الليزري)</span>
              </label>
              <div className="relative">
                <input
                  id="pos_barcode_input"
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="امسح الباركود بالليزر..."
                  className="w-full pl-16 pr-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-right"
                />
                <button
                  type="submit"
                  className="absolute left-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 cursor-pointer shadow-sm"
                >
                  مسح
                </button>
              </div>
            </form>

            {/* Text Search Bar */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">بحث بالاسم أو الصنف</label>
              <div className="relative">
                <input
                  id="pos_search_input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم السلعة..."
                  className="w-full pr-10 pl-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

          </div>

          {/* Quick Products Catalog Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">كاتلوج السلع السريع ({filteredProducts.length} صنف)</h3>
                <p className="text-xs text-slate-400">اضغط على السلعة لإضافتها مباشرة لفاتورة المبيعات</p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-none gap-1 max-w-full">
                {categoriesList.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg transition shrink-0 ${
                      selectedCategory === cat ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Products */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                  لا توجد أصناف متوفرة بالبحث.
                </div>
              ) : (
                filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addProductToCart(product)}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition text-right cursor-pointer flex flex-col justify-between space-y-2 shadow-sm group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition line-clamp-1">
                        {product.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        رمز: {product.barcode}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        product.stock <= product.minStock ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        المخزون: {product.stock}
                      </span>
                      <span className="text-xs font-black text-blue-600 font-mono">
                        {product.sellingPrice.toLocaleString()} {currency}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT: Current Invoice Shopping Cart & Checkout (5 cols) */}
        <div className="xl:col-span-5 space-y-4">
          
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">سلة فاتورة المبيعات الحالية</h3>
                  <p className="text-[11px] text-slate-400">{cart.length} الأصناف بالافتراض</p>
                </div>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition"
                >
                  تفريغ السلة
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  السلة فارغة حالياً. امسح الباركود أو اختر أصنافاً من الكاتلوج أو عبر المساعد الصوتي.
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                        <input
                          type="number"
                          value={item.sellingPrice}
                          onChange={(e) => handleEditItemPrice(item.productId, Number(e.target.value))}
                          className="w-16 px-1 py-0.5 bg-white border border-slate-300 rounded text-center text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          title="تعديل السعر المباشر للسلعة"
                        />
                        <span>× {item.quantity} =</span>
                        <span className="font-bold text-blue-600">{item.total.toLocaleString()} {currency}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-xs font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => removeCartItem(item.productId)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition mr-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer Selection & Payment Type */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">نوع العملية والتسديد:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('cash')}
                    className={`py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      paymentType === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>نقداً (كاش)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentType('debt')}
                    className={`py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      paymentType === 'debt'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>آجل (على الحساب)</span>
                  </button>
                </div>
              </div>

              {/* Select Customer */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">اختر العميل (مطلوب للآجل):</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="">-- عميل نقدي (سفري) --</option>
                  {activeCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.totalDebt > 0 ? `(مدين: ${c.totalDebt.toLocaleString()} ${currency})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">خصم إضافي على الفاتورة:</label>
                <input
                  type="number"
                  min="0"
                  value={discountInput || ''}
                  onChange={(e) => handleDiscountInputChange(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Total Calculation & Multi-currency Display */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-inner">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-[11px] text-slate-400 font-bold">عملة التسديد المباشر:</span>
                  <div className="flex gap-1 bg-slate-800 p-1 rounded-lg overflow-x-auto max-w-[200px]">
                    {activeCurrencies.map(curr => (
                      <button
                        key={curr.id}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          setSaleCurrencySymbol(curr.symbol);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer whitespace-nowrap ${
                          saleCurrencySymbol === curr.symbol
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {curr.symbol}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between text-xs text-slate-400">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono">{cartSubtotal.toLocaleString()} {currency}</span>
                </div>
                {discountInput > 0 && (
                  <div className="flex justify-between text-xs text-rose-400">
                    <span>الخصم الممنوح:</span>
                    <span className="font-mono">-{discountInput.toLocaleString()} {currency}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-base font-black pt-2 border-t border-slate-800 text-emerald-400">
                  <span>المبلغ الإجمالي النهائي:</span>
                  <span className="font-mono dir-ltr">{cartTotal.toLocaleString()} {currency}</span>
                </div>

                {/* Dynamic Currency Equivalent Output */}
                <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 flex justify-between items-center text-xs">
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <span>⚡ المعادل بـ ({selectedCurrObj?.name || saleCurrencySymbol}):</span>
                  </span>
                  <span className="font-mono font-extrabold text-amber-300 text-sm dir-ltr">
                    {convertedTotal.toLocaleString(undefined, { minimumFractionDigits: selectedCurrObj?.isBase ? 0 : 2, maximumFractionDigits: 2 })} {selectedCurrObj?.symbol || saleCurrencySymbol}
                  </span>
                </div>
              </div>

              {/* Checkout Action Button */}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className={`w-full py-3.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-md ${
                  cart.length > 0 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>إصدار وتثبيت فاتورة المبيعات</span>
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* Voice POS Modal */}
      <VoicePOSModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        products={activeProducts}
        customers={activeCustomers}
        onAddToCartByVoice={(product, qty) => addProductToCart(product, qty)}
        onSetCustomerByVoice={(cust) => setSelectedCustomerId(cust.id)}
        onSetDiscountByVoice={(disc) => handleDiscountInputChange(disc)}
        onSetPaymentTypeByVoice={(type) => setPaymentType(type)}
        onCompleteSaleByVoice={() => handleCheckout()}
        onClearCartByVoice={() => clearCart()}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        products={activeProducts}
        onScanCode={(code) => {
          setBarcodeInput(code);
          const matched = activeProducts.find(p => p.barcode === code);
          if (matched) {
            addProductToCart(matched);
            setPosError('');
          } else {
            soundManager.playWarningBeep();
            setPosError(`⚠️ لم يتم العثور على سلعة بالباركود: ${code}`);
          }
        }}
      />

      {/* Bluetooth Label Printer Modal */}
      <BarcodeLabelPrinterModal
        isOpen={showLabelPrinterModal}
        onClose={() => setShowLabelPrinterModal(false)}
        products={activeProducts}
        storeName={storeName}
        storeLogoUrl={settings?.storeLogoUrl}
        currency={currency}
      />

      {/* Typo Guard Warning Modal */}
      <TypoGuardModal
        isOpen={typoGuardModalOpen}
        details={typoGuardDetails}
        onClose={() => setTypoGuardModalOpen(false)}
      />

    </div>
  );
}
