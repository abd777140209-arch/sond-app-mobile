import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, AlertCircle, Sparkles } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { soundManager } from '../utils/sound';

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
  const containerId = 'barcode-camera-scanner-view';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const initScanner = async () => {
      setIsInitializing(true);
      setErrorMsg('');

      try {
        // Create instance
        const html5Qrcode = new Html5Qrcode(containerId);
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.333333
          },
          (decodedText) => {
            if (isMounted) {
              soundManager.playScanBeep();
              onScanSuccess(decodedText);
              handleClose();
            }
          },
          () => {
            // Frame parse error - ignore standard noise
          }
        );

        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (err: any) {
        console.error('Error opening camera barcode scanner:', err);
        if (isMounted) {
          setIsInitializing(false);
          setErrorMsg('تعذر الوصول للكاميرا! يرجى التأكد من إعطاء الصلاحية للكاميرا بمتصفحك.');
        }
      }
    };

    const timer = setTimeout(() => {
      initScanner();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      }
    } catch (e) {
      console.warn('Error clearing camera scanner:', e);
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

  const handleClose = async () => {
    await stopScanner();
    onClose();
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

            {/* Error state */}
            {errorMsg ? (
              <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold space-y-2 text-center">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <p>{errorMsg}</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            ) : (
              /* Camera view box */
              <div className="relative rounded-2xl overflow-hidden bg-black min-h-[250px] border border-slate-800 flex items-center justify-center">
                {isInitializing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-20 bg-slate-900/90 text-slate-300 text-xs">
                    <Sparkles className="w-6 h-6 text-blue-400 animate-spin" />
                    <span>جاري تشغيل كاميرا الهاتف...</span>
                  </div>
                )}
                <div id={containerId} className="w-full h-full text-slate-900" />
              </div>
            )}

            <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <span>سيتم تعبئة رمز الباركود تلقائياً وإصدار صوت عند النجاح</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
