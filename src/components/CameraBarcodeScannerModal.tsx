import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, AlertCircle, Sparkles, RefreshCw, Barcode } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { soundManager } from '../utils/sound';
import { requestCameraPermissionOnDemand } from '../utils/androidPermissions';
import { cleanBarcode } from '../utils/barcodeMatcher';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
}

export default function CameraBarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess
}: CameraBarcodeScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [manualCode, setManualCode] = useState<string>('');
  const containerId = 'barcode-camera-scanner-view';

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      }
    } catch (e) {
      console.warn('Notice while clearing camera scanner:', e);
    } finally {
      scannerRef.current = null;
    }

    // Extra safety track cleanup for WebView and mobile web
    try {
      const container = document.getElementById(containerId);
      if (container) {
        const videoEls = container.getElementsByTagName('video');
        for (let i = 0; i < videoEls.length; i++) {
          const stream = videoEls[i].srcObject as MediaStream | null;
          if (stream && stream.getTracks) {
            stream.getTracks().forEach((track) => track.stop());
          }
        }
      }
    } catch (e) {
      console.warn('Track cleanup exception:', e);
    }
  };

  const startScanner = async (isMounted: () => boolean) => {
    setIsInitializing(true);
    setErrorMsg('');

    // Ensure camera permissions on mobile/Android bridge
    await requestCameraPermissionOnDemand();

    // Verify DOM element exists
    const container = document.getElementById(containerId);
    if (!container) {
      if (isMounted()) {
        setIsInitializing(false);
        setErrorMsg('جاري تحضير نافذة الكاميرا... يرجى إعادة المحاولة.');
      }
      return;
    }

    // Check mediaDevices support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (isMounted()) {
        setIsInitializing(false);
        setErrorMsg('الكاميرا المباشرة غير مدعومة في بيئة هذا المتصفح. يرجى استخدام الإدخال اليدوي أو قارئ الباركود.');
      }
      return;
    }

    try {
      // Clear any prior instance
      await stopScanner();

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
        { facingMode: 'environment' },
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
          if (isMounted()) {
            const cleaned = cleanBarcode(decodedText);
            soundManager.playScanBeep();
            onScanSuccess(cleaned || decodedText);
            handleClose();
          }
        },
        () => {
          // Frame parse noise - ignore
        }
      );

      if (isMounted()) {
        setIsInitializing(false);
      }
    } catch (err: any) {
      console.warn('Camera scanner initialization notice:', err);
      if (isMounted()) {
        setIsInitializing(false);
        const errStr = String(err?.name || err?.message || err);
        if (errStr.includes('NotAllowedError') || errStr.includes('Permission') || errStr.includes('denied')) {
          setErrorMsg('تم رفض إذن الوصول للكاميرا من إعدادات المتصفح. يمكنك السماح بالوصول للكاميرا أو كتابة الرمز يدوياً أدناه.');
        } else if (errStr.includes('NotFound') || errStr.includes('DevicesNotFoundError')) {
          setErrorMsg('لم يتم العثور على كاميرا متصلة بهذا الجهاز.');
        } else if (errStr.includes('NotReadableError') || errStr.includes('TrackStartError')) {
          setErrorMsg('الكاميرا قيد الاستخدام من تطبيق آخر أو غير متاحة حالياً.');
        } else {
          setErrorMsg('تعذر تشغيل الكاميرا تلقائياً. يمكنك كتابة رمز الباركود أو إعادة المحاولة.');
        }
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const isMounted = () => mounted;

    // Small delay to ensure the modal DOM tree is fully mounted
    const timer = setTimeout(() => {
      startScanner(isMounted);
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    soundManager.playScanBeep();
    onScanSuccess(manualCode.trim());
    setManualCode('');
    handleClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-sm bg-slate-900 text-white rounded-3xl p-5 shadow-2xl z-10 border border-slate-800 text-right space-y-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">ماسح الباركود بالكاميرا</h3>
                  <p className="text-[11px] text-slate-400">وجه الكاميرا نحو رمز الباركود لالتقاطه</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Camera view box (Always kept in DOM to prevent "Element not found" errors) */}
            <div className="relative rounded-2xl overflow-hidden bg-black min-h-[220px] max-h-[260px] border border-slate-800 flex items-center justify-center">
              {isInitializing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-20 bg-slate-900/90 text-slate-300 text-xs">
                  <Sparkles className="w-6 h-6 text-blue-400 animate-spin" />
                  <span>جاري تشغيل كاميرا الهاتف...</span>
                </div>
              )}

              {errorMsg && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-slate-900/95 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs text-amber-200 font-medium leading-relaxed px-2">
                    {errorMsg}
                  </p>
                  <button
                    type="button"
                    onClick={() => startScanner(() => true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة المحاولة</span>
                  </button>
                </div>
              )}

              <div id={containerId} className="w-full h-full text-slate-900" />
            </div>

            {/* Manual input fallback */}
            <form onSubmit={handleManualSubmit} className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-blue-400" />
                <span>إدخال الباركود يدوياً أو بقارئ الليزر:</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="مثال: 690123456789..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  تأكيد
                </button>
              </div>
            </form>

            <div className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <span>سيتم تعبئة رمز الباركود تلقائياً وإصدار صوت عند النجاح</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
