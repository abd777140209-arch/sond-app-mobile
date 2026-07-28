/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Cpu, 
  CalendarClock, 
  Copy, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  Smartphone,
  Store,
  Fingerprint
} from 'lucide-react';
import { soundManager } from '../utils/sound';
import { LicenseInfo, saveLicenseLocally, generateHWID } from '../utils/licensing';
import { isFirebaseConfigured, activateLicenseOnCloud } from '../utils/firebase';

interface SaaSActivatorProps {
  license: LicenseInfo;
  setLicense: React.Dispatch<React.SetStateAction<LicenseInfo>>;
  onActivationSuccess: (license: LicenseInfo) => void;
  onOpenDevPortal?: () => void;
}

export default function SaaSActivator({ license, setLicense, onActivationSuccess, onOpenDevPortal }: SaaSActivatorProps) {
  const [activationKeyInput, setActivationKeyInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  
  // UX UI states
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | null }>({ text: '', type: null });
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [isCloud, setIsCloud] = useState(false);
  const [showInvalidKeyModal, setShowInvalidKeyModal] = useState(false);

  useEffect(() => {
    setIsCloud(isFirebaseConfigured());
  }, []);

  // Copy Hardware ID helper
  const handleCopyHwid = () => {
    soundManager.playSuccessChime();
    navigator.clipboard.writeText(license.hwid);
    setCopiedHwid(true);
    setTimeout(() => setCopiedHwid(false), 2000);
  };

  const showToastOrAlert = (msg: string) => {
    if (typeof window !== 'undefined' && (window as any).AndroidInterface?.showToast) {
      try {
        (window as any).AndroidInterface.showToast(msg);
      } catch {
        // Fallback to inline status banner without native browser alert
      }
    }
  };

  // Submit Activation Request
  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage({ text: '', type: null });
    
    const key = activationKeyInput.trim();
    const phone = phoneInput.trim();
    const storeName = customerNameInput.trim() || 'محل سند للخدمات المحاسبية';

    if (!phone) {
      soundManager.playWarningBeep();
      const warningMsg = '⚠️ الرجاء إدخال رقم الهاتف أولاً للتأكيد والتوثيق!';
      setStatusMessage({ text: warningMsg, type: 'error' });
      showToastOrAlert(warningMsg);
      return;
    }

    if (!key) {
      soundManager.playWarningBeep();
      const warningMsg = '⚠️ الرجاء إدخال رمز التفعيل (Activation Code) أولاً!';
      setStatusMessage({ text: warningMsg, type: 'error' });
      showToastOrAlert(warningMsg);
      return;
    }

    setLoading(true);

    setTimeout(async () => {
      try {
        localStorage.removeItem('smart_accounting_logged_out');

        if (enableBiometrics) {
          localStorage.setItem('sond_biometrics_enabled', 'true');
        } else {
          localStorage.setItem('sond_biometrics_enabled', 'false');
        }

        const currentHwid = generateHWID();

        // Attempt direct cloud activation and device binding
        const result = await activateLicenseOnCloud(key, currentHwid, storeName, phone);
        
        if (result.success && result.data) {
          const activeLic: LicenseInfo = {
            licenseKey: key,
            status: 'active',
            activatedAt: new Date().toISOString(),
            expiresAt: result.data.expiresAt,
            hwid: currentHwid,
            subscriptionType: result.data.type,
            customerName: storeName,
            phone: phone
          };
          saveLicenseLocally(activeLic);
          setLicense(activeLic);
          soundManager.playSuccessChime();
          const succMsg = `🎉 تم تفعيل وتوثيق الترخيص وربط جهازك الجديد بنجاح برقم الهاتف (${phone})`;
          setStatusMessage({ text: succMsg, type: 'success' });
          showToastOrAlert(succMsg);
          onActivationSuccess(activeLic);
        } else {
          soundManager.playWarningBeep();
          let failMsg = '';

          switch (result.message) {
            case 'KEY_SUSPENDED':
              failMsg = '❌ تم إيقاف وتعطيل هذا الترخيص من قبل إدارة النظام!';
              break;
            case 'KEY_EXPIRED':
              failMsg = '❌ انتهت صلاحية كود التفعيل المنسوب لهذا الترخيص!';
              break;
            case 'KEY_NOT_FOUND':
              setShowInvalidKeyModal(true);
              failMsg = '⚠️ كود التفعيل غير مسجل أو تم إلغاؤه من قبل إدارة النظام. للتواصل والدعم الفني: 777140209';
              break;
            case 'MAX_DEVICES_REACHED':
              failMsg = '❌ تم استهلاك حد الأجهزة المسموح به لهذا الكود (2/2)';
              break;
            case 'SERVER_ERROR':
              failMsg = '❌ فشل الاتصال بالسيرفر السحابي. يرجى التأكد من توفر الاتصال بالإنترنت والمحاولة مجدداً.';
              break;
            default:
              if (result.message?.includes('تم استهلاك')) {
                failMsg = `❌ ${result.message}`;
              } else {
                setShowInvalidKeyModal(true);
                failMsg = '⚠️ كود التفعيل غير مسجل أو تم إلغاؤه من قبل إدارة النظام. للتواصل والدعم الفني: 777140209';
              }
          }

          setStatusMessage({ text: failMsg, type: 'error' });
          showToastOrAlert(failMsg);
        }
      } catch (err: any) {
        soundManager.playWarningBeep();
        const errStr = `❌ حدث خطأ أثناء التفعيل: ${err.message || 'فشل الاتصال'}`;
        setStatusMessage({ text: errStr, type: 'error' });
        showToastOrAlert(errStr);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div id="saas_activator_panel" className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-center items-center p-4 md:p-8 relative overflow-y-auto font-sans" dir="rtl">
      
      {/* Top Header Badge */}
      <div className="absolute top-4 left-4 text-[11px] text-slate-400 dark:text-sky-400/80 font-mono tracking-widest hidden md:block">
        SOND ACCOUNTING SYSTEM v2.4 • MOBILE & DESKTOP
      </div>
      <div className="absolute top-4 right-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-bold font-mono">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
        {isCloud ? 'سحابي موثق (FIREBASE ONLINE)' : 'نظام محمي متكامل'}
      </div>

      <div className="w-full max-w-xl bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-sky-800/40 p-6 md:p-8 shadow-2xl relative space-y-6 my-8">
        
        {/* White Luxury App Icon Header */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-white border border-slate-200 p-2.5 shadow-xl flex items-center justify-center relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-400 to-blue-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-300" />
            <svg viewBox="0 0 512 512" className="w-16 h-16 relative z-10">
              <rect width="512" height="512" rx="120" fill="#FFFFFF" />
              <g transform="translate(256, 256)">
                <rect x="-90" y="-120" width="180" height="48" rx="24" fill="#0284C7" transform="rotate(-45)" />
                <rect x="-90" y="72" width="180" height="48" rx="24" fill="#0284C7" transform="rotate(-45)" />
                <rect x="-100" y="-24" width="200" height="48" rx="24" fill="#0284C7" transform="rotate(45)" />
              </g>
            </svg>
          </div>
          
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            تفعيل نظام سند الذكي المحاسبي
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
            شاشة التوثيق والتسجيل المباشر برقم الهاتف وكود التفعيل الخاص بنشاطك التجاري.
          </p>
        </div>

        {/* Dynamic Trial / Expired Banner */}
        {license.status === 'trial' && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <CalendarClock className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <span className="font-bold block">🚨 نسخة تجريبية مجانية نشطة:</span>
              تاريخ الانتهاء: <span className="font-mono font-bold">{new Date(license.expiresAt).toLocaleDateString('ar-YE')}</span>.
              يرجى التفعيل بكود التفعيل المعتمد لاستمرار الخدمات المحاسبية.
            </div>
          </div>
        )}

        {/* Status messages banner */}
        {statusMessage.text && (
          <div className={`p-3.5 rounded-2xl text-xs font-bold text-center leading-relaxed ${
            statusMessage.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300' :
            statusMessage.type === 'error' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300' :
            'bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300'
          }`}>
            {statusMessage.text}
          </div>
        )}

        {/* Hardware ID Copy Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#060B10] border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" /> بصمة الجهاز الموثقة (Hardware ID):
            </span>
            <span className="text-[10px] text-slate-400 font-mono">SHA-1 SECURED</span>
          </div>

          <div className="flex gap-2" dir="ltr">
            <button
              type="button"
              onClick={handleCopyHwid}
              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:text-sky-600 cursor-pointer active:scale-95 transition flex items-center justify-center shrink-0 shadow-sm"
              title="نسخ بصمة الجهاز"
            >
              {copiedHwid ? '✓' : <Copy className="w-4 h-4" />}
            </button>
            <div className="flex-1 font-mono text-center text-xs font-black bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2.5 select-all text-sky-700 dark:text-sky-300 tracking-wider shadow-inner">
              {license.hwid}
            </div>
          </div>
        </div>

        {/* Phone + Code Activation Form */}
        <form onSubmit={handleActivateLicense} className="space-y-4">
          
          {/* Store / Business Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-sky-600 dark:text-sky-400" /> اسم المحل أو النشاط التجاري:
            </label>
            <input
              type="text"
              value={customerNameInput}
              onChange={(e) => setCustomerNameInput(e.target.value)}
              placeholder="مثال: مركز سند للالكترونيات والهواتف"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#060B10] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
              required
            />
          </div>

          {/* Customer Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-sky-600 dark:text-sky-400" /> رقم هاتف المالك للتوثيق والربط:
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="77XXXXXXX"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#060B10] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-sky-500 transition text-right"
              required
            />
          </div>

          {/* Activation Key Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-sky-600 dark:text-sky-400" /> كود التفعيل (Activation Key / OTP):
            </label>
            <input
              type="text"
              value={activationKeyInput}
              onChange={(e) => setActivationKeyInput(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#060B10] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs font-bold font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-sky-500 transition uppercase"
              required
            />
          </div>

          {/* Enable Biometrics Option */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">تفعيل الدخول بالبصمة / PIN</span>
                <p className="text-[10px] text-slate-400">فتح التطبيق فوراً في المرات القادمة بلمسة بصمة</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableBiometrics}
              onChange={(e) => setEnableBiometrics(e.target.checked)}
              className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-black text-sm transition-all duration-300 shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>جاري التحقق من التفعيل برقم الهاتف...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>توثيق وتفعيل المحل فوراً</span>
              </>
            )}
          </button>
        </form>

        {/* WhatsApp Developer Contact Footnote */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            💬 للتفعيل المباشر، انسخ بصمة جهازك وتواصل عبر واتساب: <a href="https://wa.me/967777140209" target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 font-bold font-mono hover:underline">777140209</a>
          </p>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (onOpenDevPortal) onOpenDevPortal();
                else window.location.href = '/admin';
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>👨‍💻 معلومات المطور واللوحة (/admin)</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400">
            برمجة وتطوير: م. عبدالمجيد المحواشي • نظام سند المحاسبي
          </p>
        </div>

      </div>

      {/* Clean Alert Modal for Invalid or Deleted Activation Key */}
      {showInvalidKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" dir="rtl">
          <div className="w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-rose-900/40 rounded-3xl p-6 text-center space-y-5 shadow-2xl relative overflow-hidden">
            
            {/* Warning Icon Header */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                تنبيه نظام التفعيل
              </h3>
              <div className="text-xs text-slate-700 dark:text-slate-200 font-bold leading-relaxed p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/30 text-right space-y-2">
                <p className="text-sm text-rose-700 dark:text-rose-300 font-extrabold">
                  ⚠️ كود التفعيل غير مسجل أو تم إلغاؤه من قبل إدارة النظام.
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold pt-1 border-t border-rose-200/40 dark:border-rose-900/20">
                  للتواصل والدعم الفني: <span className="font-mono text-sky-600 dark:text-sky-400 font-black text-sm select-all">777140209</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <a
                href="https://wa.me/967777140209"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                💬 التواصل عبر واتساب (777140209)
              </a>
              <button
                type="button"
                onClick={() => setShowInvalidKeyModal(false)}
                className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                إغلاق ❌
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
