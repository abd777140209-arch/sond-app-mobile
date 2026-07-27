/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Smartphone, 
  Building2, 
  Phone, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  MessageCircle,
  HelpCircle
} from 'lucide-react';
import { soundManager } from '../utils/sound';
import { generateHWID, saveLicenseLocally, LicenseInfo } from '../utils/licensing';
import { activateLicenseOnCloud, checkLicenseOnCloud } from '../utils/firebase';

interface SaaSActivatorProps {
  onSuccess: (license: LicenseInfo) => void;
  initialKey?: string;
}

export default function SaaSActivator({ onSuccess, initialKey = '' }: SaaSActivatorProps) {
  const [licenseKey, setLicenseKey] = useState(initialKey);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [deviceHwid, setDeviceHwid] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    const hwid = generateHWID();
    setDeviceHwid(hwid);
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = licenseKey.trim();

    if (!cleanKey) {
      soundManager.playWarningBeep();
      setErrorMessage('يرجى إدخال مفتاح التفعيل أولاً.');
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const currentHwid = deviceHwid || generateHWID();

      // 🎯 ربط المفتاح مباشرة برقم الجهاز سحابياً في الفايربيس
      const result = await activateLicenseOnCloud(cleanKey, currentHwid, customerName, phone);

      if (result.success && result.data) {
        soundManager.playSuccessChime();

        const newLicense: LicenseInfo = {
          licenseKey: result.data.key,
          status: 'active',
          activatedAt: new Date().toISOString(),
          expiresAt: result.data.expiresAt,
          hwid: currentHwid,
          subscriptionType: result.data.type,
          customerName: result.data.customerName || customerName || 'عميل سند'
        };

        saveLicenseLocally(newLicense);
        onSuccess(newLicense);
        window.location.reload();
      } else {
        soundManager.playWarningBeep();
        if (result.message === 'KEY_SUSPENDED') {
          setErrorMessage('كود التفعيل موقوف أو معطل من قبل إدارة النظام.');
        } else if (result.message === 'KEY_EXPIRED') {
          setErrorMessage('انتهت صلاحية كود التفعيل المرفق.');
        } else {
          setErrorMessage('كود التفعيل غير مسجل أو تم إلغاؤه من قبل إدارة النظام.');
        }
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Activation Error:', error);
      soundManager.playWarningBeep();
      setErrorMessage('حدث خطأ أثناء الاتصال بخادم التراخيص، يرجى التأكد من الشابكة والمحاولة لاحقاً.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrialActivation = () => {
    setLicenseKey('MHTT-TRIAL-7DAY-FREE');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 dir-rtl text-slate-800" dir="rtl">
      
      {/* 💳 بطاقة نافذة التفعيل الرئيسية */}
      <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* الهيدر العلوي */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center space-y-2 relative">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-lg font-black tracking-wide">تفعيل نظام سند المحاسبي</h2>
          <p className="text-xs text-blue-100">أدخل كود التفعيل المعتمد لربط منشأتك بالسحابة</p>
        </div>

        {/* جسم النموذج */}
        <form onSubmit={handleActivate} className="p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-600" /> كود الترخيص / المفتاح السري:
            </label>
            <input
              type="text"
              required
              placeholder="MHTL-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-mono font-bold text-center text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition uppercase tracking-wider"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" /> اسم المنشأة / المحل:
              </label>
              <input
                type="text"
                placeholder="مؤسسة البركة"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-blue-600" /> رقم الهاتف:
              </label>
              <input
                type="text"
                placeholder="777140209"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <span className="text-slate-500 font-bold block">معرف الجهاز (HWID):</span>
            <code className="text-[10px] font-mono font-bold text-slate-700 block truncate">
              {deviceHwid || 'جاري توليد معرف الجهاز...'}
            </code>
          </div>

          {/* زر التفعيل الرئيسي */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>جاري التحقق وربط الجهاز...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>تفعيل الترخيص وفتح النظام 🚀</span>
              </>
            )}
          </button>

          {/* زر تجربة الكود المجاني المباشر */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleTrialActivation}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              استخدام كود النسخة التجريبية المجانية (7 أيام)
            </button>
          </div>

        </form>

      </div>

      {/* 🚨 النافذة المنبثقة للتنبيه عند الخطأ */}
      {showErrorModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150 border border-slate-100">
            
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">تنبيه نظام التفعيل</h3>
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-2xl border border-rose-100 leading-relaxed">
                ⚠️ {errorMessage || 'كود التفعيل غير مسجل أو تم إلغاؤه من قبل إدارة النظام.'}
              </p>
            </div>

            <div className="text-xs text-slate-500 font-bold">
              للتواصل والدعم الفني: <span className="font-mono text-blue-700 dir-ltr inline-block">777140209</span>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href="https://wa.me/96777140209"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>التواصل عبر واتساب (777140209)</span>
              </a>

              <button
                type="button"
                onClick={() => setShowErrorModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>إغلاق ✖</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
