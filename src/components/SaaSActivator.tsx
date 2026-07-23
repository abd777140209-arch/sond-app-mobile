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
  LockKeyhole, 
  ShieldAlert, 
  ShieldCheck, 
  XCircle
} from 'lucide-react';
import { soundManager } from '../utils/sound';
import { LicenseInfo, saveLicenseLocally } from '../utils/licensing';
import { isFirebaseConfigured, checkLicenseOnCloud, activateLicenseOnCloud, isUnboundHwid } from '../utils/firebase';

interface SaaSActivatorProps {
  license: LicenseInfo;
  setLicense: React.Dispatch<React.SetStateAction<LicenseInfo>>;
  onActivationSuccess: (license: LicenseInfo) => void;
}

export default function SaaSActivator({ license, setLicense, onActivationSuccess }: SaaSActivatorProps) {
  const [activationKeyInput, setActivationKeyInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [customerNameInput, setCustomerNameInput] = useState('');
  
  // UX UI states
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | null }>({ text: '', type: null });
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [isCloud, setIsCloud] = useState(false);

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

  // Submit Activation Request (Checks online Firestore OR local secure list)
  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage({ text: '', type: null });
    
    const key = activationKeyInput.trim();
    const phone = phoneInput.trim();
    const storeName = customerNameInput.trim() || 'محل سند للخدمات المحاسبية';

    if (!phone) {
      soundManager.playWarningBeep();
      setStatusMessage({ text: '⚠️ الرجاء إدخال رقم الهاتف أولاً للتأكيد والتوثيق!', type: 'error' });
      return;
    }

    if (!key) {
      soundManager.playWarningBeep();
      setStatusMessage({ text: '⚠️ الرجاء إدخال رمز التفعيل (Activation Code / OTP) أولاً!', type: 'error' });
      return;
    }

    setLoading(true);

    setTimeout(async () => {
      try {
        // Remove logged out flag upon active login attempt
        localStorage.removeItem('smart_accounting_logged_out');

        const response = await checkLicenseOnCloud(key, license.hwid);
        
        if (response.success && response.data) {
          if (!response.data.hwid || isUnboundHwid(response.data.hwid)) {
            const bindResult = await activateLicenseOnCloud(key, license.hwid, storeName);
            if (!bindResult.success) {
              soundManager.playWarningBeep();
              setStatusMessage({ text: '❌ فشل ربط مفتاح التفعيل بقاعدة البيانات السحابية. يرجى المحاولة لاحقاً.', type: 'error' });
              setLoading(false);
              return;
            }
          }

          const activeLic: LicenseInfo = {
            licenseKey: key,
            status: 'active',
            activatedAt: new Date().toISOString(),
            expiresAt: response.data.expiresAt,
            hwid: license.hwid,
            subscriptionType: response.data.type,
            customerName: storeName,
            phone: phone
          };
          saveLicenseLocally(activeLic);
          setLicense(activeLic);
          soundManager.playSuccessChime();
          setStatusMessage({ text: `🎉 تم التوثيق بنجاح برقم الهاتف (${phone}) لنشاطك التجاري (${storeName})`, type: 'success' });
          onActivationSuccess(activeLic);
        } else {
          soundManager.playWarningBeep();
          if (response.message === 'KEY_NOT_FOUND') {
            const activationResult = await activateLicenseOnCloud(key, license.hwid, storeName);
            if (activationResult.success) {
              const recheck = await checkLicenseOnCloud(key, license.hwid);
              if (recheck.success && recheck.data) {
                const activeLic: LicenseInfo = {
                  licenseKey: key,
                  status: 'active',
                  activatedAt: new Date().toISOString(),
                  expiresAt: recheck.data.expiresAt,
                  hwid: license.hwid,
                  subscriptionType: recheck.data.type,
                  customerName: storeName,
                  phone: phone
                };
                saveLicenseLocally(activeLic);
                setLicense(activeLic);
                soundManager.playSuccessChime();
                setStatusMessage({ text: `🎉 تم توثيق رقم الهاتف ودخول النظام بنجاح!`, type: 'success' });
                onActivationSuccess(activeLic);
                setLoading(false);
                return;
              }
            }
            setStatusMessage({ text: '❌ رمز التفعيل / OTP غير صحيح! يرجى التواصل مع المطور لتوليد كود التفعيل برقم هاتفك.', type: 'error' });
          } else if (response.message === 'HWID_MISMATCH') {
            setStatusMessage({ text: '🔒 خطأ حماية: رمز التفعيل مستخدم بالفعل على جهاز آخر ولا يمكن مشاركته!', type: 'error' });
          } else if (response.message === 'KEY_EXPIRED') {
            setStatusMessage({ text: '⏳ انتهت صلاحية هذا الرمز! يرجى التواصل مع المطور للتجديد.', type: 'error' });
          } else if (response.message === 'KEY_SUSPENDED') {
            setStatusMessage({ text: '🚫 تم تعليق هذا الحساب من قبل الإدارة.', type: 'error' });
          } else if (response.message === 'ERROR') {
            setStatusMessage({ text: '⚠️ فشل الاتصال بقاعدة البيانات السحابية (Firebase). يرجى التحقق من الاتصال.', type: 'error' });
          } else {
            setStatusMessage({ text: '❌ رمز التفعيل غير صحيح أو غير متطابق!', type: 'error' });
          }
        }
      } catch (err: any) {
        console.error(err);
        setStatusMessage({ text: `❌ خطأ أثناء الاتصال: ${err?.message || 'يرجى التحقق من اتصالك بالإنترنت'}`, type: 'error' });
      } finally {
        setLoading(false);
      }
    }, 1200);
  };

  if (license.status === 'expired') {
    return (
      <div id="saas_expired_lock" className="min-h-screen bg-radial from-[#0e1726] to-[#030712] text-[#f1f5f9] flex flex-col justify-center items-center p-4 md:p-8 relative overflow-y-auto" dir="rtl">
        {/* Decorative Ornaments */}
        <div className="absolute top-4 left-4 text-[10px] text-[#C5A862]/40 font-mono tracking-widest hidden md:block">
          CENTRAL LICENSE HANDSHAKE v3.5 • SECURE AES-256
        </div>
        <div className="absolute top-4 right-4 text-xs text-green-400/70 flex items-center gap-1.5 font-mono">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
          {isCloud ? 'سحابي متصل (FIREBASE ONLINE)' : 'نظام محمي متكامل (LOCAL SECURED)'}
        </div>

        <div className="w-full max-w-2xl bg-[#090d16]/95 backdrop-blur-md rounded-2xl border border-red-600/30 p-6 md:p-8 shadow-2xl relative space-y-6 my-8">
          {/* Shiny red corner accents */}
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-red-500/40 rounded-tr-xl"></div>
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-red-500/40 rounded-tl-xl"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-red-500/40 rounded-br-xl"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-red-500/40 rounded-bl-xl"></div>

          {/* Icon */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-4 rounded-full bg-red-950/40 border border-red-500/30 shadow-inner animate-pulse">
              <ShieldAlert className="w-12 h-12 text-red-500" />
            </div>
            
            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-red-200 to-red-400">
              تنبيه انتهاء الفترة التجريبية
            </h1>
          </div>

          {/* Luxurious message requested by user */}
          <div className="p-6 rounded-xl bg-red-950/25 border border-red-500/20 text-center leading-relaxed">
            <p className="text-base font-bold text-red-300 leading-relaxed">
              "انتهت الفترة التجريبية الممنوحة لك من المطور م. عبدالمجيد المحواشي. يرجى التواصل لشراء النسخة الكاملة."
            </p>
          </div>

          {/* HWID for renewal */}
          <div className="p-4 rounded-xl bg-[#0e131f] border border-gray-800 space-y-3">
            <h3 className="text-xs font-bold text-gray-300 text-center">
              بصمة جهازك الفريدة للتفعيل (Hardware ID):
            </h3>
            <div className="flex gap-2 max-w-sm mx-auto" dir="ltr">
              <button
                type="button"
                onClick={handleCopyHwid}
                className="p-2.5 bg-[#171e2e] border border-gray-700 rounded-lg text-gray-300 hover:text-white cursor-pointer active:scale-95 transition flex items-center justify-center shrink-0"
                title="نسخ بصمة الجهاز"
              >
                {copiedHwid ? '✓' : <Copy className="w-4 h-4" />}
              </button>
              <div className="flex-1 font-mono text-center text-xs font-bold bg-[#04060b] border border-gray-800 rounded-lg px-2 py-2.5 select-all text-yellow-400 tracking-wider">
                {license.hwid}
              </div>
            </div>
          </div>

          {/* Direct WhatsApp info */}
          <div className="text-center text-xs text-gray-400">
            💬 للتفعيل المباشر، انسخ بصمة جهازك أعلاه وتواصل عبر الواتساب: <span className="font-mono text-[#C5A862] font-bold">777140209</span>
          </div>

          {/* Developer Footer Credit */}
          <div className="text-center pt-2 border-t border-gray-800/50">
            <p className="text-[10px] text-gray-500">
              تصميم وبرمجة م. عبدالمجيد المحواشي • الجمهورية اليمنية 🇾🇪
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="saas_activator_panel" className="min-h-screen bg-radial from-[#0e1726] to-[#030712] text-[#f1f5f9] flex flex-col justify-center items-center p-4 md:p-8 relative overflow-y-auto" dir="rtl">
      
      {/* Decorative Ornaments */}
      <div className="absolute top-4 left-4 text-[10px] text-[#C5A862]/40 font-mono tracking-widest hidden md:block">
        CENTRAL LICENSE HANDSHAKE v3.5 • SECURE AES-256
      </div>
      <div className="absolute top-4 right-4 text-xs text-green-400/70 flex items-center gap-1.5 font-mono">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
        {isCloud ? 'سحابي متصل (FIREBASE ONLINE)' : 'نظام محمي متكامل (LOCAL SECURED)'}
      </div>

      <div className="w-full max-w-2xl bg-[#090d16]/95 backdrop-blur-md rounded-2xl border border-[#C5A862]/30 p-6 md:p-8 shadow-2xl relative space-y-6 my-8">
        
        {/* Shiny gold corner accents */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#C5A862]/40 rounded-tr-xl"></div>
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#C5A862]/40 rounded-tl-xl"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#C5A862]/40 rounded-br-xl"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#C5A862]/40 rounded-tl-xl"></div>

        {/* Branding header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 rounded-full bg-[#111927] border border-[#C5A862]/40 shadow-inner">
            {license.status === 'active' ? (
              <ShieldCheck className="w-12 h-12 text-[#C5A862]" />
            ) : (
              <LockKeyhole className="w-12 h-12 text-[#C5A862] animate-pulse" />
            )}
          </div>
          
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-[#f3e7c4] to-[#C5A862]">
            تفعيل نظام سند الذكي المحاسبي
          </h1>
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            تأمين مالي وبرمجي متكامل لتراخيص الموزعين والعملاء بخصائص قفل البصمة والهاردوير لمنع التكرار وحفظ حقوق المبرمج.
          </p>
        </div>

        {/* Dynamic Warning Card */}
        {license.status === 'trial' && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-3">
            <CalendarClock className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-bold block text-amber-200">🚨 نسخة تجريبية مجانية نشطة:</span>
              ينتهي مفعول التجربة المجانية بتاريخ: <span className="font-mono font-bold text-amber-400">{new Date(license.expiresAt).toLocaleDateString('ar-YE')}</span>. 
              يرجى تفعيل الكود السيرفري المدفوع لتجنب توقف النظام ومواصلة عملك بأمان.
            </div>
          </div>
        )}

        {(license.status as string) === 'expired' && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">⏳ انتهت صلاحية اشتراكك المالي!</span>
              توقفت صلاحيات النظام المحاسبي مؤقتاً لتجاوزك مهلة الدفع المتفق عليها. يرجى سداد الاشتراك للمبرمج لتوليد مفتاح تفعيل جديد لفتح المحل فوراً.
            </div>
          </div>
        )}

        {license.status === 'unlicensed' && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-3">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">🔒 خطأ أمني: كود جهاز غير متطابق أو منسوخ!</span>
              لقد تم رصد تشغيل هذا المجلد على جهاز هاردوير جديد ببصمة مختلفة. يرجى دفع الاشتراك الفردي لكل جهاز للحصول على تفعيل شرعي.
            </div>
          </div>
        )}

        {/* Status messages banner */}
        {statusMessage.text && (
          <div className={`p-3 rounded-xl text-xs font-semibold text-center leading-relaxed ${
            statusMessage.type === 'success' ? 'bg-green-500/15 border border-green-500/30 text-green-300 animate-fadeIn' :
            statusMessage.type === 'error' ? 'bg-red-500/15 border border-red-500/30 text-red-300 animate-fadeIn' :
            'bg-blue-500/15 border border-blue-500/30 text-blue-300 animate-fadeIn'
          }`}>
            {statusMessage.text}
          </div>
        )}

        {/* Firebase Config Warning if not configured */}
        {!isCloud && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-3 leading-relaxed">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <div>
              <span className="font-bold block text-red-200 mb-0.5">⚠️ تنبيه فني: قاعدة البيانات السحابية (Firebase) غير متصلة!</span>
              متغيرات البيئة <span className="font-mono text-[#C5A862] font-semibold bg-black/30 px-1 py-0.5 rounded">.env</span> الخاصة بـ Firebase غير مهيأة على السيرفر (Cloud Run) أو لم تتم قراءتها بنجاح.
              يرجى إضافتها في إعدادات السيرفر لتفعيل التحقق الفوري، أو التواصل مع المطور م. عبدالمجيد المحواشي لحل المشكلة.
            </div>
          </div>
        )}

        {/* MAIN DESIGN: Hardware ID & Activation Forms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Box 1: Hardware footprint verification */}
          <div className="p-4 rounded-xl bg-[#0e131f] border border-gray-800 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#C5A862]" /> بصمة جهازك الفريدة (Hardware ID):
            </h3>
            
            <p className="text-[11px] text-gray-400 leading-relaxed">
              قم بنسخ هذا الكود ومشاركته مع <span className="text-[#C5A862] font-semibold">م. عبدالمجيد المحواشي</span> ليقوم بتوليد رخصة خاصة ومطابقة لقطع جهازك المحمية.
            </p>

            <div className="flex gap-2" dir="ltr">
              <button
                onClick={handleCopyHwid}
                className="p-2.5 bg-[#171e2e] border border-gray-700 rounded-lg text-gray-300 hover:text-white cursor-pointer active:scale-95 transition flex items-center justify-center shrink-0"
                title="نسخ بصمة الجهاز"
              >
                {copiedHwid ? '✓' : <Copy className="w-4 h-4" />}
              </button>
              <div className="flex-1 font-mono text-center text-xs font-bold bg-[#04060b] border border-gray-800 rounded-lg px-2 py-2.5 select-all text-yellow-400 tracking-wider">
                {license.hwid}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-800/60 text-[10px] text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>🖥️ طراز تشفير هاردوير:</span>
                <span className="text-gray-300">Secure Binding SHA-1</span>
              </div>
              <div className="flex justify-between">
                <span>🔑 نوع رخصة جهازك:</span>
                <span className="text-[#C5A862] font-bold">{license.subscriptionType.toUpperCase()}</span>
              </div>
              {license.status === 'active' && (
                <div className="text-green-400 font-semibold text-right mt-1.5 flex items-center justify-end gap-1">
                  ✓ سارية حتى: {new Date(license.expiresAt).toLocaleDateString('ar-YE')}
                </div>
              )}
            </div>
          </div>

          {/* Box 2: Phone Authentication & Activation Form */}
          <form onSubmit={handleActivateLicense} className="p-4 rounded-xl bg-[#0e131f] border border-gray-800 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-green-400" /> تسجيل الدخول برقم الهاتف والرمز:
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold block">📱 رقم الهاتف (Phone Number):</label>
                <input
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="مثال: 777140209 أو +967777140209"
                  dir="ltr"
                  className="w-full bg-[#04060b] border border-gray-800 rounded-xl px-3 py-2 text-center text-xs font-bold font-mono tracking-widest text-blue-400 focus:outline-none focus:border-blue-400 placeholder-gray-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold block">🔑 رمز التفعيل / OTP Code:</label>
                <input
                  type="text"
                  required
                  value={activationKeyInput}
                  onChange={(e) => setActivationKeyInput(e.target.value.toUpperCase())}
                  placeholder="MHTM-XXXX-XXXX-XXXX"
                  dir="ltr"
                  className="w-full bg-[#04060b] border border-gray-800 rounded-xl px-3 py-2 text-center text-xs font-bold font-mono tracking-widest text-green-400 focus:outline-none focus:border-green-400 placeholder-gray-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold block">🏪 اسم المحل / النشاط التجاري:</label>
                <input
                  type="text"
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                  placeholder="مثال: مركز سند للاتصالات والتجارة"
                  className="w-full bg-[#04060b] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A862]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-green-500 text-black hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-400 cursor-pointer transition shadow-md font-sans text-center flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> جاري التوثيق وفحص الرمز...
                  </>
                ) : (
                  <>
                    تسجيل الدخول والتوثيق ⚡
                  </>
                )}
              </button>
            </div>
          </form>

        </div>

        {/* Developer Footer Credit */}
        <div className="text-center pt-2 border-t border-gray-800/50">
          <p className="text-[10px] text-gray-500">
            تصميم وبرمجة م. عبدالمجيد المحواشي • الجمهورية اليمنية 🇾🇪
          </p>
          <p className="text-[9px] text-gray-600 mt-0.5 font-mono">
            SaaS Central Licensing Engine v3.5 • Secured Node.js + Firebase
          </p>
        </div>

      </div>

    </div>
  );
}
