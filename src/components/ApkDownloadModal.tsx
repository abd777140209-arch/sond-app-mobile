import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Smartphone, Download, QrCode, CheckCircle, ShieldCheck, Zap, WifiOff, X, Share2, MonitorSmartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { soundManager } from '../utils/sound';
import { showToast } from '../utils/toast';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
}

export default function ApkDownloadModal({ isOpen, onClose, storeName = 'نظام سند المحاسبي' }: ApkDownloadModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installing, setInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setInstalledSuccess(true);
      setDeferredPrompt(null);
      showToast('تم تثبيت تطبيق سند كتطبيق مستقل بنجاح!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleInstallPWA = async () => {
    soundManager.playScanBeep();
    if (deferredPrompt) {
      setInstalling(true);
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setInstalledSuccess(true);
          soundManager.playSuccessChime();
          showToast('تم قبول تثبيت التطبيق بنجاح!', 'success');
        } else {
          showToast('تم إلغاء التثبيت؛ يمكنك التثبيت في أي وقت من قائمة المتصفح.', 'info');
        }
        setDeferredPrompt(null);
      } catch {
        showToast('تعذر فتح نافذة التثبيت التلقائية، استخدم التثبيت من قائمة المتصفح (⋮).', 'info');
      } finally {
        setInstalling(false);
      }
      return;
    }

    // Standard guidance when prompt isn't emitted by browser (e.g. already installed or iOS/Safari/iframe)
    soundManager.playSuccessChime();
    showToast('للتثبيت المباشر: افتح قائمة المتصفح (⋮) واختر "تثبيت التطبيق / Add to Home Screen".', 'info');
  };

  const handleShareLink = async () => {
    soundManager.playScanBeep();
    if (navigator.share) {
      try {
        await navigator.share({
          title: storeName,
          text: `رابط تشغيل وتثبيت نظام ${storeName}`,
          url: currentUrl
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(currentUrl);
      soundManager.playSuccessChime();
      showToast('تم نسخ رابط التطبيق بنجاح! يمكنك إرساله عبر واتساب أو فتحه من الجوال.', 'success');
    } catch {
      showToast('يرجى نسخ الرابط من شريط العنوان يدوياً.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" dir="rtl">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="bg-[#0B141F] border border-[#C5A862]/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-right space-y-5"
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1E2E44] to-[#121E2E] border border-[#C5A862]/40 flex items-center justify-center text-[#C5A862]">
            <MonitorSmartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">تثبيت التطبيق والربط بالهاتف (PWA / Mobile)</h2>
            <p className="text-xs text-[#C5A862]">تثبيت مباشر كتطبيق مستقل على الكمبيوتر والأندرويد والآيفون</p>
          </div>
        </div>

        {/* QR Code + Link Box */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#121E2C] p-4 rounded-xl border border-gray-800">
          <div className="p-2.5 bg-white rounded-xl shrink-0">
            <QRCodeSVG value={currentUrl || 'https://sanad.app'} size={96} />
          </div>
          <div className="space-y-2 text-xs text-gray-300 text-center sm:text-right">
            <p className="font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
              <QrCode className="w-4 h-4 text-[#C5A862]" />
              <span>امسح الكود بكاميرا الهاتف للفتح الفوري</span>
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              بعد الفتح من كروم أو سفاري اختر "إضافة للشاشة الرئيسية" ليصبح تطبيقاً مستقلاً يدعم العمل دون إنترنت.
            </p>
          </div>
        </div>

        {/* App Key Highlights */}
        <div className="space-y-2 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>يحفظ البيانات محلياً ويزامنها سحابياً فور توفر الإنترنت.</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>واجهة سريعة متوافقة مع الطابعات الحرارية وقارئ الباركود.</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>حماية برقم PIN وخصوصية فورية للمبالغ المالية.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-1 space-y-2.5">
          {installedSuccess ? (
            <div className="p-3 bg-emerald-950/60 border border-emerald-700/50 rounded-xl text-center space-y-1">
              <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto" />
              <p className="text-xs font-bold text-emerald-300">تم تثبيت التطبيق بنجاح على جهازك!</p>
            </div>
          ) : (
            <button
              onClick={handleInstallPWA}
              disabled={installing}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#C5A862] to-[#A38641] hover:from-[#d4b771] hover:to-[#b3954f] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              <span>{deferredPrompt ? 'تثبيت التطبيق الآن بضغطة واحدة (PWA)' : 'دليل التثبيت المباشر على الجهاز'}</span>
            </button>
          )}

          <button
            onClick={handleShareLink}
            className="w-full py-2.5 px-4 rounded-xl bg-[#121E2C] border border-gray-700 hover:border-[#C5A862] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[#C5A862]" />
            <span>مشاركة أو نسخ رابط التطبيق للجوال</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
