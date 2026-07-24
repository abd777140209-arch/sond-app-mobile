/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Barcode, X, RefreshCw, Check, AlertCircle, Sparkles, Volume2 } from 'lucide-react';
import { Product } from '../types';
import { soundManager } from '../utils/sound';
import { requestCameraPermissionOnDemand } from '../utils/androidPermissions';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onScanCode: (barcode: string) => void;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  products,
  onScanCode
}: BarcodeScannerModalProps) {
  const [mode, setMode] = useState<'camera' | 'simulation'>('simulation');
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const activeProducts = products.filter(p => !p.isDeleted);

  // Start/Stop Camera stream when camera mode is active
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  const startCamera = async () => {
    setCameraError('');
    try {
      await requestCameraPermissionOnDemand();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('⚠️ الكاميرا غير مدعومة في هذا المتصفح. استخدم وضع المحاكاة المباشر بالأسفل.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Camera permission or availability error:', err);
      setCameraError('⚠️ لا يمكن الوصول للكاميرا (قد تكون محظورة أو غير متوفرة). استخدم وضع المحاكاة المباشر بالأسفل.');
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleSelectSimulatedBarcode = (code: string) => {
    soundManager.playScanBeep();
    onScanCode(code);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    soundManager.playScanBeep();
    onScanCode(manualCode.trim());
    setManualCode('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">ماسح الباركود الذكي</h3>
              <p className="text-xs text-slate-500">مسح السلع للكاميرا المباشرة أو محاكاة الليزر</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setMode('simulation')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'simulation' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>وضع المحاكاة السريع ⚡</span>
          </button>
          <button
            onClick={() => setMode('camera')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'camera' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            <span>الكاميرا الحية 📷</span>
          </button>
        </div>

        {/* Camera Live View Mode */}
        {mode === 'camera' && (
          <div className="space-y-3">
            {cameraError ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{cameraError}</span>
                </div>
                <button
                  onClick={() => setMode('simulation')}
                  className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer transition text-xs"
                >
                  التحويل إلى وضع المحاكاة السريع
                </button>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-blue-500 shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-dashed border-red-500/80 m-12 rounded-xl pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-red-500 animate-pulse shadow-glow" />
                </div>
                <div className="absolute bottom-2 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-mono">
                  وجه الكاميرا نحو رمز الباركود
                </div>
              </div>
            )}
          </div>
        )}

        {/* Simulation / Instant Barcode Picker Mode */}
        {mode === 'simulation' && (
          <div className="space-y-4">
            
            <form onSubmit={handleManualSubmit} className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">إدخال رمز باركود يدوي أو بالليزر:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="مثال: 690123456789..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95"
                >
                  مسح
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex justify-between items-center">
                <span>اختر صنفاً للمحاكاة الفورية:</span>
                <span className="text-[10px] text-slate-400">({activeProducts.length} باركود مسجل)</span>
              </label>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {activeProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">لا توجد سلع مسجلة بالمخزن حالياً.</p>
                ) : (
                  activeProducts.map(prod => (
                    <button
                      key={prod.id}
                      onClick={() => handleSelectSimulatedBarcode(prod.barcode)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition flex items-center justify-between text-right cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">{prod.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">رمز: {prod.barcode}</div>
                      </div>
                      <span className="text-xs font-bold text-blue-600 font-mono">
                        {prod.sellingPrice}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-sm"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
}
