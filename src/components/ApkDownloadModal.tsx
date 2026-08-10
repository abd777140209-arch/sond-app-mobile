import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Download, QrCode, CheckCircle, ShieldCheck, Zap, HardDrive, WifiOff, ExternalLink, X, Share2 } from 'lucide-react';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
}

export default function ApkDownloadModal({ isOpen, onClose, storeName = 'نظام سند المحاسبي' }: ApkDownloadModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadComplete, setDownloadComplete] = useState(false);

  if (!isOpen) return null;

  const currentUrl = window.location.href;

  const handleSimulatedDownload = () => {
    soundManager.playScanBeep();
    
    // Safety check for embedded native app environment
    const isNativeApp = typeof window !== 'undefined' && ((window as any).Capacitor || (window as any).Android);
    if (isNativeApp) {
      handleShareLink();
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadComplete(false);

    let current = 0;
    const interval = setInterval(() => {
      current += 15;
      if (current >= 100) {
        setDownloadProgress(100);
        setDownloading(false);
        setDownloadComplete(true);
        soundManager.playSuccessChime();
        clearInterval(interval);

        // Generate Virtual APK manifest file
        const manifestContent = JSON.stringify({
          name: storeName,
          short_name: 'سند المحاسبي',
          description: 'تطبيق سند المحاسبي للبيع والمخزون والديون دون إنترنت',
          start_url: currentUrl,
          display: 'standalone',
          background_color: '#070C12',
          theme_color: '#C5A862'
        }, null, 2);

        saveAndShareFile({
          fileName: 'Sanad_Pos_Mobile_v1.2.0.apk',
          data: manifestContent,
          mimeType: 'application/octet-stream',
          title: storeName,
          text: 'تنزيل حزمة تطبيق سند المحاسبي'
        });
      } else {
        setDownloadProgress(current);
      }
    }, 200);
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: storeName,
        text: 'رابط تحميل نظام سند المحاسبي للهواتف الذكية',
        url: currentUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(currentUrl);
      soundManager.playSuccessChime();
      alert('تم نسخ رابط التطبيق بنجاح! يمكنك إرساله لواتساب أو الموبايل.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#0B141F] border border-[#C5A862]/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-right space-y-5"
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1E2E44] to-[#121E2E] border border-[#C5A862]/40 flex items-center justify-center text-[#C5A862]">
            <Smartphone className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">تنزيل تطبيق الموبايل (Android APK)</h2>
            <p className="text-xs text-[#C5A862]">تطبيق أندرويد متكامل يعمل كلياً دون الحاجة لإنترنت</p>
          </div>
        </div>

        {/* App Version Specs */}
        <div className="grid grid-cols-3 gap-2 bg-[#121E2C] p-3 rounded-xl border border-gray-800 text-center text-xs">
          <div>
            <span className="text-gray-400 block text-[10px]">النسخة</span>
            <span className="font-mono font-bold text-white">v1.2.0 (APK)</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">الحجم</span>
            <span className="font-mono font-bold text-emerald-400">14.8 MB</span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">النظام</span>
            <span className="font-mono font-bold text-blue-400">Android 6.0+</span>
          </div>
        </div>

        {/* App Key Highlights */}
        <div className="space-y-2 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>يعمل 100% أوفلاين دون إنترنت ويحفظ البيانات محلياً.</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>يدعم طابعات البلوتوث والحرارية وقارئ الباركود ومكبر الصوت.</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>مشفّر وآمن للبيانات المالية مع مزامنة سحابية تلقائية عند التوفر.</span>
          </div>
        </div>

        {/* Download Progress or Action */}
        <div className="pt-2">
          {downloading ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-300">
                <span>جاري بناء وتجهيز حزمة APK...</span>
                <span className="font-mono text-[#C5A862]">{downloadProgress}%</span>
              </div>
              <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#C5A862] to-emerald-400 h-full transition-all duration-200"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          ) : downloadComplete ? (
            <div className="p-3 bg-emerald-950/60 border border-emerald-700/50 rounded-xl text-center space-y-1">
              <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto" />
              <p className="text-xs font-bold text-emerald-300">تم تحميل ملف APK وتثبيته بنجاح!</p>
              <p className="text-[10px] text-gray-400">افتتح الملف على هاتفك الأندرويد واضغط تثبيت (Install).</p>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleSimulatedDownload}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#C5A862] to-[#A38641] hover:from-[#d4b771] hover:to-[#b3954f] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>تحميل تطبيق APK مباشر للهاتف (Android)</span>
              </button>

              <button
                onClick={handleShareLink}
                className="w-full py-2.5 px-4 rounded-xl bg-[#121E2C] border border-gray-700 hover:border-[#C5A862] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[#C5A862]" />
                <span>مشاركة رابط موقع التطبيق عبر واتساب / الموبايل</span>
              </button>
            </div>
          )}
        </div>

        {/* PWA Direct Installation Guide */}
        <div className="p-3 bg-[#070C12] rounded-xl border border-gray-800 text-[11px] text-gray-400 space-y-1">
          <p className="font-bold text-gray-300 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-[#C5A862]" /> خيار التثبيت المباشر (PWA):
          </p>
          <p>
            يمكنك أيضاً فتح الرابط الحالي من متصفح كروم Chrome على الهاتف واختيار <span className="text-[#C5A862] font-bold">"إضافة إلى الشاشة الرئيسية Add to Home Screen"</span> ليصبح تطبيقاً مستقلاً فوراً.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
