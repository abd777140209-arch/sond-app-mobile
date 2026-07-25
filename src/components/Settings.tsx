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
  Phone,
  Palette,
  Maximize2,
  LayoutGrid,
  Layers,
  Moon,
  Sun,
  Square,
  Mail,
  HardDrive,
  Cloud,
  Wifi,
  WifiOff
} from 'lucide-react';
import { SystemSettings, AppTheme, CardShape, DisplayDensity } from '../types';
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
  const [privacyPinCode, setPrivacyPinCode] = useState(settings.privacyPinCode || settings.pinCode || '1234');
  const [isPrivacyPinEnabled, setIsPrivacyPinEnabled] = useState(settings.isPrivacyPinEnabled ?? true);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(() => {
    return localStorage.getItem('sond_biometrics_enabled') === 'true';
  });

  // Theme & Layout state
  const [appTheme, setAppTheme] = useState<AppTheme>(settings.appTheme || 'financial-blue');
  const [cardShape, setCardShape] = useState<CardShape>(settings.cardShape || 'soft');
  const [density, setDensity] = useState<DisplayDensity>(settings.density || 'comfortable');
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop'>(settings.deviceMode || 'mobile');

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

  const updateThemeInstantly = (newTheme: AppTheme) => {
    soundManager.playScanBeep();
    setAppTheme(newTheme);

    const themeClass = `theme-${newTheme}`;
    const shapeClass = `shape-${cardShape}`;
    const densityClass = `density-${density}`;
    const fullClass = `${themeClass} ${shapeClass} ${densityClass}`;

    document.documentElement.className = fullClass;
    if (newTheme === 'dark-luxury') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    onSaveSettings({
      ...settings,
      storeName,
      currency,
      address,
      phone,
      pinCode,
      isPinEnabled,
      privacyPinCode,
      isPrivacyPinEnabled,
      appTheme: newTheme,
      cardShape,
      density,
      deviceMode
    });
  };

  const updateCardShapeInstantly = (newShape: CardShape) => {
    soundManager.playScanBeep();
    setCardShape(newShape);

    const themeClass = `theme-${appTheme}`;
    const shapeClass = `shape-${newShape}`;
    const densityClass = `density-${density}`;
    document.documentElement.className = `${themeClass} ${shapeClass} ${densityClass}`;

    onSaveSettings({
      ...settings,
      storeName,
      currency,
      address,
      phone,
      pinCode,
      isPinEnabled,
      privacyPinCode,
      isPrivacyPinEnabled,
      appTheme,
      cardShape: newShape,
      density,
      deviceMode
    });
  };

  const updateDensityInstantly = (newDensity: DisplayDensity) => {
    soundManager.playScanBeep();
    setDensity(newDensity);

    const themeClass = `theme-${appTheme}`;
    const shapeClass = `shape-${cardShape}`;
    const densityClass = `density-${newDensity}`;
    document.documentElement.className = `${themeClass} ${shapeClass} ${densityClass}`;

    onSaveSettings({
      ...settings,
      storeName,
      currency,
      address,
      phone,
      pinCode,
      isPinEnabled,
      privacyPinCode,
      isPrivacyPinEnabled,
      appTheme,
      cardShape,
      density: newDensity,
      deviceMode
    });
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
      isPinEnabled,
      privacyPinCode: privacyPinCode.trim() || '1234',
      isPrivacyPinEnabled,
      appTheme,
      cardShape,
      density,
      deviceMode
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
                {currentLicense.subscriptionType === 'monthly'
                  ? 'اشتراك شهري (1 Month)'
                  : currentLicense.subscriptionType === 'yearly'
                  ? 'اشتراك سنوي (1 Year Pro)'
                  : currentLicense.subscriptionType === 'lifetime'
                  ? 'ترخيص دائم مدى الحياة'
                  : 'نسخة تجريبية مؤقتة'}
              </span>
            </div>

            {currentLicense.expiresAt && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-bold">تاريخ انتهاء الترخيص:</span>
                <span className="font-mono font-bold text-slate-800">
                  {new Date(currentLicense.expiresAt).toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}

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
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">النسخ الاحتياطي والاستعادة (Backup & Sync)</h3>
                <p className="text-[11px] text-slate-400">حفظ واسترجاع البيانات محلياً وعبر البريد و Google Drive</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> أوفلاين مؤمن
            </span>
          </div>

          {/* Backup Channel Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Local Storage File */}
            <button
              type="button"
              onClick={() => {
                soundManager.playSuccessChime();
                onBackupData();
              }}
              className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center shadow-xs"
            >
              <HardDrive className="w-5 h-5 text-emerald-600" />
              <span>الذاكرة المحلية (JSON)</span>
            </button>

            {/* Email Backup */}
            <button
              type="button"
              onClick={() => {
                soundManager.playSuccessChime();
                const subject = encodeURIComponent(`النسخة الاحتياطية لنظام سند المحاسبي - ${storeName || 'المنشأة'}`);
                const body = encodeURIComponent(
                  `السلام عليكم ورحمة الله وبركاته،\n\nتجدون برفقه النسخة الاحتياطية المعتمدة لقاعدة بيانات نظام سند المحاسبي للمنشأة (${storeName}).\nتاريخ التصدير: ${new Date().toLocaleString('ar-YE')}\n\nيرجى حفظ الملف الاحتياطي في مكان آمن.`
                );
                window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                onBackupData();
              }}
              className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-900 font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center shadow-xs"
            >
              <Mail className="w-5 h-5 text-blue-600" />
              <span>إرسال عبر البريد</span>
            </button>

            {/* Google Drive / Cloud Backup */}
            <button
              type="button"
              onClick={() => {
                soundManager.playSuccessChime();
                onBackupData();
                alert('⚡ تم تجهيز وتحميل ملف النسخة الاحتياطية لجهازك بنجاح. يتم فتح صفحة Google Drive الآن لتخزين الملف في السحابة الخاص بك.');
                window.open('https://drive.google.com/drive/my-drive', '_blank');
              }}
              className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center shadow-xs"
            >
              <Cloud className="w-5 h-5 text-amber-600" />
              <span>Google Drive / السحابة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4 text-blue-600" />
              <span>استعادة ملف بيانات سابق</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => {
                if (confirm('🚨 تنبيه خطير: هل أنت متأكد من رغبتك في مسح وتصفير كافة قاعدة البيانات المحلية والبدء من جديد؟ لا يمكن التراجع عن هذا الإجراء!')) {
                  soundManager.playWarningBeep();
                  onResetDatabase();
                }
              }}
              className="py-3 px-4 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>تصفير وإعادة ضبط القاعدة</span>
            </button>
          </div>
        </div>

        {/* Offline-First Operational Guarantee Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Wifi className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>وضع العمل بدون إنترنت (Offline-First Ready)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </h4>
                <p className="text-[10px] text-slate-400">كافة العمليات والفواتير تُحفظ فورياً محلياً بدون الحاجة لإنترنت</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              نشط 100% ⚡
            </span>
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

              {/* General Manager PIN */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">تفعيل قفل البصمة / رمز PIN العام</div>
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

              {/* Privacy Mode Password Settings */}
              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                      <span>👁️ كلمة سر وضع الخصوصية (إخفاء/إظهار المبالغ والأسعار)</span>
                    </div>
                    <div className="text-[10px] text-amber-700/80">
                      طلب كلمة سر عند الضغط على زر العين لإظهار المبالغ والأسعار المخفية
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPrivacyPinEnabled}
                    onChange={(e) => setIsPrivacyPinEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                </div>

                {isPrivacyPinEnabled && (
                  <div className="pt-2.5 border-t border-amber-200/60 space-y-2">
                    <label className="text-xs font-bold text-amber-900 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>تحديد / تغيير كلمة سر وضع الخصوصية (PIN):</span>
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={privacyPinCode}
                      onChange={(e) => setPrivacyPinCode(e.target.value)}
                      placeholder="1234"
                      className="w-full bg-white border border-amber-300 text-xs font-mono font-extrabold rounded-xl px-3.5 py-2 text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center tracking-widest shadow-inner"
                    />
                    <div className="text-[10px] text-amber-800/80 font-medium text-right">
                      💡 افتراضياً: <code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded text-amber-900 font-bold">1234</code>. يمكنك تغييرها لأي رمز سري يتكون من 4 أرقام.
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Theme & Layout Customization Section */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-purple-600" />
                  <span>تخصيص المظهر ونوع الجهاز (Device Layout & Themes)</span>
                </h4>
                <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                  تطبيق فوري ✨
                </span>
              </div>

              {/* 0. Device Layout Option (Mobile vs Desktop) */}
              <div className="space-y-2 p-3 bg-sky-50/60 border border-sky-200 rounded-2xl">
                <label className="text-[11px] font-bold text-sky-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-sky-600" />
                  <span>نوع واجهة الجهاز وتخطيط الشاشة (Device Mode):</span>
                </label>
                <p className="text-[10px] text-slate-500">اختر نمط العرض المناسب لجهازك (واجهة الهاتف هي الافتراضية)</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Mobile View */}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      setDeviceMode('mobile');
                    }}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center gap-3 ${
                      deviceMode === 'mobile'
                        ? 'bg-white border-sky-600 ring-2 ring-sky-500/30 text-sky-950 font-bold shadow-xs'
                        : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-sky-100 text-sky-700 shrink-0">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <span>واجهة الهاتف (Mobile View)</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">افتراضي</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500">مخصصة للهواتف واستخدام اللمس باليد</div>
                    </div>
                  </button>

                  {/* Desktop View */}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      setDeviceMode('desktop');
                    }}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center gap-3 ${
                      deviceMode === 'desktop'
                        ? 'bg-white border-sky-600 ring-2 ring-sky-500/30 text-sky-950 font-bold shadow-xs'
                        : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-sky-100 text-sky-700 shrink-0">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">واجهة الكمبيوتر والتابلت</div>
                      <div className="text-[9.5px] text-slate-500">عرض عريض للشاشات الكبيرة واللوحية</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 1. App Color Theme */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>ثيم ألوان التطبيق (Color Theme):</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Financial Blue */}
                  <button
                    type="button"
                    onClick={() => updateThemeInstantly('financial-blue')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between h-20 ${
                      appTheme === 'financial-blue'
                        ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/30'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex gap-1">
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-600 shadow-xs" />
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-200 border border-slate-300" />
                      </div>
                      {appTheme === 'financial-blue' && <Check className="w-3.5 h-3.5 text-blue-600 font-bold" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">الأزرق المالي</div>
                      <div className="text-[9.5px] text-slate-500">افتراضي واحترافي</div>
                    </div>
                  </button>

                  {/* Emerald Green */}
                  <button
                    type="button"
                    onClick={() => updateThemeInstantly('emerald-green')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between h-20 ${
                      appTheme === 'emerald-green'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/30'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex gap-1">
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 shadow-xs" />
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-200 border border-emerald-300" />
                      </div>
                      {appTheme === 'emerald-green' && <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">الأخضر الزمردي</div>
                      <div className="text-[9.5px] text-slate-500">حيوية المبيعات</div>
                    </div>
                  </button>

                  {/* Warm Amber */}
                  <button
                    type="button"
                    onClick={() => updateThemeInstantly('warm-amber')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between h-20 ${
                      appTheme === 'warm-amber'
                        ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-500/30'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex gap-1">
                        <span className="w-3.5 h-3.5 rounded-full bg-amber-600 shadow-xs" />
                        <span className="w-3.5 h-3.5 rounded-full bg-[#C5A862]" />
                      </div>
                      {appTheme === 'warm-amber' && <Check className="w-3.5 h-3.5 text-amber-600 font-bold" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">البني الدافئ</div>
                      <div className="text-[9.5px] text-slate-500">فخامة وذهب</div>
                    </div>
                  </button>

                  {/* Dark Luxury */}
                  <button
                    type="button"
                    onClick={() => updateThemeInstantly('dark-luxury')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between h-20 ${
                      appTheme === 'dark-luxury'
                        ? 'bg-slate-900 border-amber-500 ring-2 ring-amber-500/30 text-white'
                        : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex gap-1">
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-700" />
                        <span className="w-3.5 h-3.5 rounded-full bg-[#C5A862]" />
                      </div>
                      {appTheme === 'dark-luxury' && <Check className="w-3.5 h-3.5 text-amber-400 font-bold" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                        <Moon className="w-3 h-3" /> الداكن الفخم
                      </div>
                      <div className="text-[9.5px] text-slate-400">ليلي مريح جداً</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Card Shapes */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Square className="w-3.5 h-3.5 text-blue-600" />
                  <span>شكل الكروت والمربعات (Card Shapes):</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Soft Rounded */}
                  <button
                    type="button"
                    onClick={() => updateCardShapeInstantly('soft')}
                    className={`p-2.5 rounded-2xl border text-center transition cursor-pointer ${
                      cardShape === 'soft'
                        ? 'bg-blue-50 border-blue-600 text-blue-950 font-bold ring-2 ring-blue-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5">حواف ناعمة</div>
                    <div className="text-[9.5px] text-slate-500">انسيابية Rounded</div>
                  </button>

                  {/* Sharp */}
                  <button
                    type="button"
                    onClick={() => updateCardShapeInstantly('sharp')}
                    className={`p-2.5 rounded-none border text-center transition cursor-pointer ${
                      cardShape === 'sharp'
                        ? 'bg-blue-50 border-blue-600 text-blue-950 font-bold ring-2 ring-blue-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5">حواف حادة</div>
                    <div className="text-[9.5px] text-slate-500">كلاسيكية Sharp</div>
                  </button>

                  {/* Glassmorphism */}
                  <button
                    type="button"
                    onClick={() => updateCardShapeInstantly('glass')}
                    className={`p-2.5 rounded-2xl border text-center transition cursor-pointer backdrop-blur-md ${
                      cardShape === 'glass'
                        ? 'bg-blue-50/80 border-blue-600 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-md'
                        : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold mb-0.5 flex items-center justify-center gap-1">
                      <span>زجاجية</span>
                      <Sparkles className="w-3 h-3 text-purple-600" />
                    </div>
                    <div className="text-[9.5px] text-slate-500">بلورية Glass</div>
                  </button>
                </div>
              </div>

              {/* 3. Screen Density */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>كثافة عرض الشاشة والبيانات (Display Density):</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Comfortable */}
                  <button
                    type="button"
                    onClick={() => updateDensityInstantly('comfortable')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center gap-3 ${
                      density === 'comfortable'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">مريح واسع (Comfortable)</div>
                      <div className="text-[9.5px] text-slate-500">مساحات واسعة وسهولة المس</div>
                    </div>
                  </button>

                  {/* Compact */}
                  <button
                    type="button"
                    onClick={() => updateDensityInstantly('compact')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center gap-3 ${
                      density === 'compact'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">مكثف (Compact)</div>
                      <div className="text-[9.5px] text-slate-500">عرض أقصى قدر من الجداول</div>
                    </div>
                  </button>
                </div>
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
