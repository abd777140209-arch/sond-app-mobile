/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Save, 
  Shield, 
  Download, 
  Upload, 
  AlertTriangle, 
  KeyRound, 
  Award, 
  Globe, 
  Smartphone, 
  RefreshCw, 
  Sparkles, 
  Key, 
  CheckCircle, 
  ShieldAlert,
  Fingerprint,
  Check,
  Building2,
  DollarSign,
  MapPin,
  Phone
} from 'lucide-react';
import { SystemSettings } from '../types';
import { soundManager } from '../utils/sound';
import { loadLicenseLocally, saveLicenseLocally, generateHWID, LicenseInfo } from '../utils/licensing';

interface SettingsProps {
  settings: SystemSettings;
  onSaveSettings: (settings: SystemSettings) => void;
  onBackupData: () => void;
  onRestoreData: (restoredData: any) => boolean | Promise<boolean>;
  onResetDatabase: () => void;
}

export default function Settings({
  settings,
  onSaveSettings,
  onBackupData,
  onRestoreData,
  onResetDatabase
}: SettingsProps) {
  // Local state form variables
  const [storeName, setStoreName] = useState(settings.storeName);
  const [currency, setCurrency] = useState(settings.currency);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [pinCode, setPinCode] = useState(settings.pinCode);
  const [isPinEnabled, setIsPinEnabled] = useState(settings.isPinEnabled);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(() => {
    return localStorage.getItem('sond_biometrics_enabled') === 'true';
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [currentLicense, setCurrentLicense] = useState<LicenseInfo>(() => loadLicenseLocally());

  const handleDeactivate = () => {
    soundManager.playWarningBeep();
    if (confirm('🚨 تنبيه أمني شديد: هل أنت متأكد من إلغاء تفعيل الرخصة على هذا الجهاز وتسجيل الخروج؟ سيتم قفل البرنامج فوراً ومطالبتك بإدخال مفتاح تفعيل جديد للوصول لبياناتك.')) {
      const unlicensed: LicenseInfo = {
        licenseKey: '',
        status: 'unlicensed',
        activatedAt: '',
        expiresAt: '',
        hwid: generateHWID(),
        subscriptionType: 'trial'
      };
      saveLicenseLocally(unlicensed);
      soundManager.playSuccessChime();
      alert('✓ تم إلغاء تفعيل الجهاز بنجاح! سيتم إعادة تحميل الصفحة لقفل البرنامج.');
      window.location.reload();
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playSuccessChime();
    
    localStorage.setItem('sond_biometrics_enabled', isBiometricEnabled ? 'true' : 'false');

    onSaveSettings({
      storeName: storeName.trim(),
      currency: currency.trim(),
      address: address.trim(),
      phone: phone.trim(),
      pinCode,
      isPinEnabled
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const result = onRestoreData(json);
        
        const handleResult = (ok: boolean) => {
          if (ok) {
            soundManager.playSuccessChime();
            alert('✓ تم استعادة النسخة الاحتياطية وإعادة تشغيل النظام بنجاح تام!');
            window.location.reload();
          } else {
            soundManager.playWarningBeep();
            alert('❌ فشل استعادة البيانات: الملف المرفق لا يحتوي على بنية بيانات محاسبية صحيحة.');
          }
        };

        if (result instanceof Promise) {
          result.then(handleResult).catch((err) => {
            soundManager.playWarningBeep();
            console.error("Backup Restore Error: ", err);
            alert('❌ عذراً، حدث خطأ أثناء رفع النسخة الاحتياطية للسحاب.');
          });
        } else {
          handleResult(result);
        }

      } catch (err) {
        soundManager.playWarningBeep();
        alert('❌ صيغة الملف غير مدعومة أو تالفة.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="settings_tab_view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12">
      
      {/* LEFT COLUMN: System Info & License (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* License Info Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">بيانات التوثيق والترخيص الملكي</h3>
              <p className="text-[11px] text-slate-400">حالة التفعيل الأمني للجهاز الحالي</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
              <span className="text-slate-500 font-bold">اسم المنشأة/العميل:</span>
              <span className="font-bold text-slate-900">{currentLicense.customerName || storeName || 'مؤسسة تجارية'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
              <span className="text-slate-500 font-bold">حالة التفعيل:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <Check className="w-3.5 h-3.5" /> مرخص ونشط ⚡
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
              <span className="text-slate-500 font-bold">نوع الاشتراك:</span>
              <span className="font-mono font-bold text-blue-600">
                {currentLicense.subscriptionType === 'lifetime' ? 'ترخيص دائم مدى الحياة' : 'اشتراك سنوي (Pro)'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
              <span className="text-slate-500 font-bold">معرف الجهاز الموثق (HWID):</span>
              <span className="font-mono text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                {currentLicense.hwid}
              </span>
            </div>
          </div>

          <button
            onClick={handleDeactivate}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>إلغاء تفعيل الترخيص وتسجيل الخروج</span>
          </button>
        </div>

        {/* Database Backup & Restore Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">النسخ الاحتياطي والاستعادة</h3>
              <p className="text-[11px] text-slate-400">حفظ واسترجاع كافة البيانات المحلية والسحابية</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => {
                soundManager.playSuccessChime();
                onBackupData();
              }}
              className="py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>تحميل نسخة احتياطية</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4 text-blue-600" />
              <span>استعادة ملف بيانات</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                if (confirm('🚨 تنبيه خطير: هل أنت متأكد من رغبتك في مسح وتصفير كافة قاعدة البيانات المحلية والبدء من جديد؟ لا يمكن التراجع عن هذا الإجراء!')) {
                  soundManager.playWarningBeep();
                  onResetDatabase();
                }
              }}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>تصفير وإعادة ضبط قاعدة البيانات</span>
            </button>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Store Profile & Security Settings (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">إعدادات بيانات النشاط التجاري</h3>
              <p className="text-[11px] text-slate-400">تظهر هذه البيانات في رأس الفواتير والتقارير المطبوعة</p>
            </div>
          </div>

          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" /> تم حفظ الإعدادات بنجاح!
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" /> اسم المحل / النشاط:
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" /> العملة المعتمدة:
                </label>
                <input
                  type="text"
                  required
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" /> العنوان والفرع:
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="صنعاء - شارع صخر..."
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-blue-600" /> رقم الهاتف للتواصل:
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="777714020"
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-right"
                />
              </div>
            </div>

            {/* Security Locks */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600" /> الحماية وقفل الدخول الأمني
              </h4>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">تفعيل قفل البصمة / رمز PIN</div>
                    <div className="text-[10px] text-slate-400">قفل الواجهة لحماية الحسابات عند الابتعاد عن الشاشة</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isBiometricEnabled}
                    onChange={(e) => setIsBiometricEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {isBiometricEnabled && (
                  <div className="pt-2 border-t border-slate-200 space-y-1">
                    <label className="text-xs font-bold text-slate-700">رمز PIN السري لإلغاء القفل (4 أرقام):</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="1234"
                      className="w-full bg-white border border-slate-200 text-xs font-mono rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>حفظ وتثبيت إعدادات النظام</span>
            </button>

          </form>
        </div>

      </div>

    </div>
  );
}
