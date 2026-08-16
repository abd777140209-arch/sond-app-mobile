/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Barcode, 
  X, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Zap, 
  Layers, 
  Search, 
  Volume2, 
  ShoppingCart,
  SwitchCamera
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Product } from '../types';
import { soundManager } from '../utils/sound';
import { requestCameraPermissionOnDemand } from '../utils/androidPermissions';
import { findProductByScannedBarcode, cleanBarcode } from '../utils/barcodeMatcher';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onScanCode: (barcode: string, matchedProduct?: Product) => void;
  currency?: string;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  products,
  onScanCode,
  currency = 'ريال'
}: BarcodeScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'catalog'>('camera');
  const [cameraError, setCameraError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [continuousScan, setContinuousScan] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannedSessionCount, setScannedSessionCount] = useState<number>(0);
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    product?: Product;
    timestamp: number;
  } | null>(null);

  // Manual / Catalog state
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'pos-live-camera-barcode-reader';
  const isHandlingScanRef = useRef<boolean>(false);

  const activeProducts = products.filter(p => !p.isDeleted);

  // Stop scanner safely
  const stopCameraScanner = async () => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      }
    } catch (err) {
      console.warn('Notice while stopping POS barcode camera:', err);
    } finally {
      scannerRef.current = null;
    }

    // Safety track cleanup
    try {
      const container = document.getElementById(containerId);
      if (container) {
        const videoEls = container.getElementsByTagName('video');
        for (let i = 0; i < videoEls.length; i++) {
          const stream = videoEls[i].srcObject as MediaStream | null;
          if (stream && stream.getTracks) {
            stream.getTracks().forEach(t => t.stop());
          }
        }
      }
    } catch (e) {
      console.warn('Track cleanup exception:', e);
    }
  };

  // Start Html5Qrcode scanner with support for all 1D & 2D formats
  const startCameraScanner = async (isMounted: () => boolean) => {
    setIsInitializing(true);
    setCameraError('');

    await requestCameraPermissionOnDemand();

    const container = document.getElementById(containerId);
    if (!container) {
      if (isMounted()) {
        setIsInitializing(false);
        setCameraError('جاري تهيئة عدسة الكاميرا... يرجى إعادة المحاولة.');
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (isMounted()) {
        setIsInitializing(false);
        setCameraError('الكاميرا غير مدعومة في بيئة هذا المتصفح. يمكنك إدخال الرمز يدوياً أو اختيار الصنف.');
      }
      return;
    }

    try {
      await stopCameraScanner();
      if (!isMounted()) return;

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.CODABAR,
      ];

      const html5Qrcode = new Html5Qrcode(containerId, {
        formatsToSupport,
        verbose: false
      });
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode },
        {
          fps: 20,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(viewfinderWidth * 0.88, 300);
            const height = Math.min(viewfinderHeight * 0.55, 170);
            return { width: Math.floor(width), height: Math.floor(height) };
          },
          aspectRatio: 1.333333,
          disableFlip: false
        },
        (decodedText) => {
          if (!isMounted()) return;
          handleBarcodeDetected(decodedText);
        },
        () => {
          // Standard frame scan cycle
        }
      );

      if (isMounted()) {
        setIsInitializing(false);
      }
    } catch (err: any) {
      console.warn('Barcode camera initialization notice:', err);
      if (isMounted()) {
        setIsInitializing(false);
        const errStr = String(err?.name || err?.message || err);
        if (errStr.includes('NotAllowedError') || errStr.includes('Permission') || errStr.includes('denied')) {
          setCameraError('تم رفض إذن الوصول للكاميرا. يرجى السماح للمتصفح بالوصول للكاميرا أو استخدام الإدخال اليدوي.');
        } else if (errStr.includes('NotFound') || errStr.includes('DevicesNotFoundError')) {
          setCameraError('لم يتم العثور على كاميرا متصلة بالجهاز.');
        } else if (errStr.includes('NotReadableError') || errStr.includes('TrackStartError')) {
          setCameraError('الكاميرا قيد الاستخدام من تطبيق آخر أو غير متاحة حالياً.');
        } else {
          setCameraError('تعذر فتح الكاميرا تلقائياً. يمكنك إعادة المحاولة أو إدخال الرمز يدوياً.');
        }
      }
    }
  };

  // Handle successful barcode read
  const handleBarcodeDetected = (rawCode: string) => {
    const cleaned = cleanBarcode(rawCode);
    if (!cleaned) return;

    // Debounce rapid continuous scans of same code
    if (isHandlingScanRef.current) return;
    isHandlingScanRef.current = true;
    setTimeout(() => {
      isHandlingScanRef.current = false;
    }, 1200);

    // Play feedback
    soundManager.playScanBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(80); } catch (e) {}
    }

    // Lookup product in database
    const matchedProduct = findProductByScannedBarcode(activeProducts, cleaned);

    setLastScannedResult({
      code: cleaned,
      product: matchedProduct,
      timestamp: Date.now()
    });

    setScannedSessionCount(prev => prev + 1);

    // Trigger parent callback to add to cart
    onScanCode(cleaned, matchedProduct);

    // If single scan mode, close modal after short visual confirmation
    if (!continuousScan) {
      setTimeout(() => {
        handleModalClose();
      }, 500);
    }
  };

  // Switch camera when requested
  const handleToggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Lifecycle
  useEffect(() => {
    if (!isOpen) return;

    setScannedSessionCount(0);
    setLastScannedResult(null);
    isHandlingScanRef.current = false;

    let mounted = true;
    const isMounted = () => mounted;

    if (activeTab === 'camera') {
      const timer = setTimeout(() => {
        startCameraScanner(isMounted);
      }, 150);

      return () => {
        mounted = false;
        clearTimeout(timer);
        stopCameraScanner();
      };
    } else {
      stopCameraScanner();
    }

    return () => {
      mounted = false;
      stopCameraScanner();
    };
  }, [isOpen, activeTab, facingMode]);

  const handleModalClose = async () => {
    await stopCameraScanner();
    onClose();
  };

  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleBarcodeDetected(manualCodeInput.trim());
    setManualCodeInput('');
  };

  const filteredCatalogProducts = activeProducts.filter(p => {
    if (!catalogSearch.trim()) return true;
    const q = catalogSearch.toLowerCase().trim();
    return p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)) || (p.category && p.category.includes(q));
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 dir-rtl animate-in fade-in duration-200">
        <motion.div 
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 relative overflow-hidden flex flex-col max-h-[90vh]"
        >
          
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">قارئ الباركود الذكي</h3>
                <p className="text-xs text-slate-500">مسح باركود السلعة بالكاميرا وإضافتها مباشرة للسلة</p>
              </div>
            </div>
            <button
              onClick={handleModalClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'camera' 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-4 h-4 text-blue-600" />
              <span>الكاميرا المباشرة 📷</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'manual' 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>إدخال يدوي / ليزر ⚡</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'catalog' 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>كتالوج السلع ({activeProducts.length})</span>
            </button>
          </div>

          {/* TAB 1: Live Camera Scanner */}
          {activeTab === 'camera' && (
            <div className="space-y-3 flex-1 flex flex-col">
              
              {/* Camera Scanner Viewfinder Box */}
              <div className="relative rounded-2xl overflow-hidden bg-black min-h-[220px] max-h-[260px] border border-slate-800 flex items-center justify-center shadow-inner">
                
                {isInitializing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-20 bg-slate-900/90 text-slate-200 text-xs">
                    <Sparkles className="w-6 h-6 text-blue-400 animate-spin" />
                    <span>جاري تشغيل كاميرا الهاتف وقارئ الباركود...</span>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-slate-900/95 text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="text-xs text-amber-200 font-medium leading-relaxed px-2">
                      {cameraError}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startCameraScanner(() => true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>إعادة المحاولة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('manual')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>الإدخال اليدوي</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Laser aim visual guide overlay */}
                {!isInitializing && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                    <div className="w-[80%] h-[55%] border-2 border-dashed border-blue-400/80 rounded-xl relative flex items-center justify-center">
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse shadow-glow" />
                      <span className="absolute -bottom-6 bg-black/70 text-white text-[10px] px-2.5 py-0.5 rounded-full font-mono">
                        ضع خط الباركود داخل الإطار
                      </span>
                    </div>
                  </div>
                )}

                {/* Switch Camera Button Overlay */}
                {!cameraError && (
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    title="تبديل الكاميرا (أمامية / خلفية)"
                    className="absolute top-2 left-2 z-20 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl border border-white/20 text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <SwitchCamera className="w-4 h-4 text-blue-400" />
                  </button>
                )}

                {/* Actual Html5Qrcode mount container */}
                <div id={containerId} className="w-full h-full text-slate-900" />
              </div>

              {/* Real-time Last Scanned Result Banner */}
              {lastScannedResult && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                    lastScannedResult.product 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {lastScannedResult.product ? (
                    <div className="p-1.5 rounded-xl bg-emerald-500 text-white shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-xl bg-amber-500 text-white shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="font-bold flex items-center justify-between">
                      <span className="truncate">
                        {lastScannedResult.product ? lastScannedResult.product.name : '⚠️ صنف غير مسجل بالباركود'}
                      </span>
                      <span className="font-mono text-[11px] opacity-75">
                        {lastScannedResult.code}
                      </span>
                    </div>
                    {lastScannedResult.product ? (
                      <div className="text-[11px] text-emerald-700 flex items-center gap-3">
                        <span>السعر: <b>{lastScannedResult.product.sellingPrice.toLocaleString()} {currency}</b></span>
                        <span>المخزون: <b>{lastScannedResult.product.stock} قطعة</b></span>
                        <span className="text-emerald-600 font-bold">✅ تمت الإضافة للسلة!</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700">
                        الرمز مقروء بنجاح ولكن لم يتم العثور على منتج بهذا الباركود بالمخزن.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Continuous Scan Toggle Bar */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={continuousScan}
                    onChange={(e) => setContinuousScan(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span>وضع المسح المستمر (لمسح عدة سلع متتالية)</span>
                </label>
                {scannedSessionCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded-lg text-[10px] flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" />
                    <span>{scannedSessionCount} ممسوح</span>
                  </span>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: Manual / Laser Input */}
          {activeTab === 'manual' && (
            <div className="space-y-4 py-2">
              <form onSubmit={handleManualFormSubmit} className="space-y-3">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-blue-600" />
                  <span>أدخل رمز الباركود أو مرر قارئ الليزر:</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    placeholder="مثال: 690123456789 أو اسم الصنف..."
                    className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                  <button
                    type="submit"
                    disabled={!manualCodeInput.trim()}
                    className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95 transition"
                  >
                    إضافة للسلة
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  💡 يدعم هذا الحقل القراءة التلقائية المباشرة من أجهزة قارئ الباركود اليدوية اللاسلكية وUSB.
                </p>
              </form>

              {/* Quick Barcode Examples from inventory */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-700">أحدث الباركودات المسجلة في مخزونك:</div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {activeProducts.filter(p => p.barcode).slice(0, 10).map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleBarcodeDetected(prod.barcode)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-[11px] font-medium text-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Barcode className="w-3 h-3 text-slate-500" />
                      <span className="truncate max-w-[120px]">{prod.name}</span>
                      <span className="font-mono text-[10px] text-blue-600">({prod.barcode})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Fast Product Picker / Catalog */}
          {activeTab === 'catalog' && (
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="ابحث باسم السلعة أو رمز الباركود..."
                  className="w-full pr-9 pl-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex-1 max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {filteredCatalogProducts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    لا توجد سلع مطابقة في المخزون.
                  </div>
                ) : (
                  filteredCatalogProducts.map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleBarcodeDetected(prod.barcode || prod.id)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition flex items-center justify-between text-right cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{prod.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                          <span>رمز: {prod.barcode || 'بدون باركود'}</span>
                          <span>المخزون: {prod.stock}</span>
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-blue-600 font-mono">
                          {prod.sellingPrice.toLocaleString()} {currency}
                        </span>
                        <div className="text-[10px] text-emerald-600 font-bold">+ إضافة</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Footer Action Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <span>يتم إصدار صوت تلقائي عند التقاط الباركود</span>
            </div>
            <button
              type="button"
              onClick={handleModalClose}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-sm transition active:scale-95"
            >
              تم / إغلاق
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
