/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Key, 
  Building2, 
  Phone, 
  Sparkles
} from 'lucide-react';
import { soundManager } from '../utils/sound';
import { generateHWID, saveLicenseLocally, LicenseInfo } from '../utils/licensing';
import { activateLicenseOnCloud } from '../utils/firebase';

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

  useEffect(() => {
    const hwid = generateHWID();
    setDeviceHwid(hwid);
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = licenseKey.trim();

    if (!cleanKey) {
      soundManager.playWarningBeep();
      alert('يرجى إدخال مفتاح التفعيل أولاً.');
      return;
    }

    setIsLoading(true);

    try {
      const currentHwid = deviceHwid || generateHWID();

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
        alert(result.message || 'كود التفعيل غير مسجل أو تم إلغاؤه من قبل إدارة النظام.');
      }
    } catch (error) {
      console.error('Activation Error:', error);
      soundManager.playWarningBeep();
      alert('حدث خطأ أثناء الاتصال بخادم التراخيص.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrialActivation = () => {
    setLicenseKey('MHTT-TRIAL-7DAY-FREE');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 dir-rtl text-slate-800" dir="rtl">
      
      {/* البطاقة الرئيسية المتميزة بنفس التنسيق والشكل الأصلي */}
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100">
        
        {/* الهيدر الأزرق الدائري المميز */}
        <div className="bg-gradient-to-b from-blue-600 to-indigo-700 p-8 text-white text-center space-y-3 relative">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-black tracking-wide">تفعيل نظام سند المحاسبي</h2>
          <p className="text-xs text-blue-100/90 font-medium">أدخل كود التفعيل المعتمد لربط منشأتك بالسحابة</p>
        </div>

        {/* جسم النموذج الأصلي */}
        <form onSubmit={handleActivate} className="p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-blue-600" /> كود الترخيص / المفتاح السري:
            </label>
            <input
              type="text"
              required
              placeholder="MHTM-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="w-full px-4 py-3 text-xs font-mono font-bold text-center text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition uppercase tracking-wider"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" /> اسم المنشأة / المحل:
            </label>
            <input
              type="text"
              placeholder="ت"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-blue-600" /> رقم الهاتف:
            </label>
            <input
              type="text"
              placeholder="777140"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* مربع المعرف HWID بالشكل والخط المخصص */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-center space-y-1">
            <span className="text-[11px] font-bold text-slate-600 block">معرف الجهاز (HWID):</span>
            <code className="text-[11px] font-mono font-bold text-slate-800 block truncate">
              {deviceHwid || 'MHT-HWID-DB6A25D0206D2BC1'}
            </code>
          </div>

          {/* الزر الأزرق الرئيسي */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-2xl transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>جاري التحقق والربط...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>تفعيل الترخيص وفتح النظام 🚀</span>
              </>
            )}
          </button>

          {/* الرابط السفلي */}
          <div className="text-center pt-1">
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

    </div>
  );
}
