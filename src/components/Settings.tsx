/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Save, Shield, Download, Upload, AlertTriangle, KeyRound, Award, Globe, Smartphone, RefreshCw, Sparkles, Key, CheckCircle, ShieldAlert } from 'lucide-react';
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
        alert('❌ عذراً، حدث خطأ أثناء قراءة الملف الاحتياطي. تأكد من أن الملف بصيغة JSON سليمة.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="settings_tab_view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT: System Parameters Config Form (7 columns) */}
      <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
        
        <div className="p-6 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 shadow-lg relative">
          
          <h2 className="text-base font-bold text-[#F3E7C4] flex items-center gap-2 mb-1.5">
            <Shield className="w-5 h-5 text-[#C5A862]" />
            إعدادات وخصائص النظام المحاسبي العامة
          </h2>
          <p className="text-xs text-gray-400 mb-6">قم بتهيئة اسم المحل وعنوان الفواتير وعملة التداول وتفعيل خيارات الحماية الحيوية.</p>

          {saveSuccess && (
            <div className="p-3 mb-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold animate-pulse">
              ✓ تم حفظ الإعدادات بنجاح في ذاكرة الكمبيوتر!
            </div>
          )}

          <div className="space-y-4 text-xs">
            
            {/* Store Name & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">اسم المحل التجاري / الشركة:</label>
                <input
                  id="settings_store_name"
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">عملة الفواتير الافتراضية:</label>
                <input
                  id="settings_currency"
                  type="text"
                  required
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862] text-center font-bold"
                />
              </div>
            </div>

            {/* Address & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">عنوان المتجر (يظهر برأس الفاتورة):</label>
                <input
                  id="settings_address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#16212E] border border-gray-800 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#C5A862]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold">رقم تواصل الواتساب والمبيعات:</label>
                <input
                  id="settings_phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#16212E] border border-gray-800 text-xs font-mono rounded-xl px-3 py-2 text-white text-left focus:outline-none focus:border-[#C5A862]"
                />
              </div>
            </div>

            <div className="h-px bg-gray-800/80 my-4"></div>

            <button
              id="save_settings_btn"
              type="submit"
              className="w-full py-3 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#BF953F] via-[#F3E7C4] to-[#B38728] hover:from-[#A0813D] hover:to-[#9F8342] shadow-[0_4px_12px_rgba(197,168,98,0.2)] cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" /> حفظ المعطيات العامة
            </button>

          </div>
        </div>

        {/* Database backup & restoration panel */}
        <div className="p-6 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 shadow-lg space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-200">النسخ الاحتياطي وحماية البيانات</h3>
            <p className="text-[11px] text-gray-400">تجنب فقدان البيانات المحاسبية بمزامنة وتحميل نسخة احتياطية محلية.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Backup button */}
            <button
              id="backup_data_btn"
              type="button"
              onClick={() => {
                soundManager.playSuccessChime();
                onBackupData();
              }}
              className="p-4 rounded-xl border border-gray-800 hover:border-[#C5A862]/40 bg-[#141F2D] hover:bg-[#1A2838] transition text-right cursor-pointer flex items-start gap-3 group"
            >
              <div className="p-2.5 rounded-lg bg-[#C5A862]/10 text-[#C5A862] group-hover:bg-[#C5A862] group-hover:text-black transition">
                <Download className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-gray-200">تصدير نسخة احتياطية</div>
                <div className="text-[9px] text-gray-500">حفظ ملف JSON على جهاز الكمبيوتر</div>
              </div>
            </button>

            {/* Restore button */}
            <button
              id="restore_data_trigger_btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-4 rounded-xl border border-gray-800 hover:border-[#C5A862]/40 bg-[#141F2D] hover:bg-[#1A2838] transition text-right cursor-pointer flex items-start gap-3 group"
            >
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-black transition">
                <Upload className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-gray-200">استيراد واستعادة البيانات</div>
                <div className="text-[9px] text-gray-500">رفع ملف JSON احترازي مخزن سابقاً</div>
              </div>
            </button>
            <input
              id="hidden_restore_file_input"
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

        </div>

      </form>

      {/* RIGHT: Developer Tribute Screen & Spec Sheet (5 columns) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Tribute Card to Abdulmajeed Al-Mahwashi */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#122030] via-[#0D1621] to-[#060B10] border border-[#C5A862]/30 shadow-2xl relative overflow-hidden text-right">
          
          {/* Subtle gold luxury emblem in bg */}
          <div className="absolute right-[-10px] bottom-[-20px] text-[120px] text-[#C5A862]/5 font-serif select-none pointer-events-none">
            👑
          </div>

          <div className="absolute top-4 left-4">
            <Sparkles className="w-5 h-5 text-[#C5A862] animate-pulse" />
          </div>

          <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF] via-[#F3E7C4] to-[#C5A862] flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-[#C5A862]" />
            ملف المبرمج والمطور الحصري
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-lg font-extrabold text-white">الأستاذ عبدالمجيد المحواشي</h2>
              <p className="text-[11px] text-gray-400 font-medium">الجمهورية اليمنية • مهندس برمجيات ونظم كمبيوتر</p>
            </div>

            <p className="text-[11px] text-gray-300 leading-relaxed">
              تم تخطيط وهيكلة هذا البرنامج المحاسبي المتكامل كحل لسطح المكتب المستقل (Desktop Application) استناداً إلى دليل الهجرة الخاص بالبنية البرمجية لنظام <strong>"الأندرويد فون الذكي"</strong> المعتمد على إطار عمل <strong>Compose Multiplatform</strong>.
            </p>

            <div className="h-px bg-gray-800/60"></div>

            <div className="space-y-2 text-[10px] text-gray-400">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#C5A862]" />
                <span>البيئة المقترحة: IntelliJ IDEA / Kotlin JVM</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-400" />
                <span>توافق الواجهات: Jetpack Compose (90%+ Reusability)</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-green-400" />
                <span>تخزين البيانات البديل: Local Safe JSON / SQLite Engine</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/50 text-[10px] text-amber-400 leading-relaxed font-semibold">
              ⭐ توصية المبرمج عبدالمجيد: "عند تشغيل البرنامج على أجهزة الكمبيوتر بمحلات التجزئة، يرجى الاستعانة بـ قارئ باركود ليزري سلكي USB ليعمل بمثابة كيبورد تلقائي (Keyboard Wedge) لتسريع عمليات البيع الفورية للزبائن بنسبة 100%!"
            </div>
          </div>
        </div>

        {/* SaaS Subscription Info Card */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/30 text-xs text-gray-300 space-y-4 relative overflow-hidden">
          {/* Shiny gold corner accents */}
          <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-[#C5A862]/40 rounded-tr-xl"></div>
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-[#C5A862]/40 rounded-bl-xl"></div>

          <h4 className="font-bold text-[#F3E7C4] flex items-center gap-1.5">
            <Key className="w-4 h-4 text-[#C5A862]" /> حالة ترخيص واشتراك البرنامج (SaaS):
          </h4>

          <div className="space-y-3 text-[10px] text-gray-400">
            <div className="flex justify-between border-b border-gray-800/80 pb-1.5">
              <span>مفتاح التفعيل النشط:</span>
              <span className="text-yellow-400 font-mono font-bold tracking-wider">{currentLicense.licenseKey}</span>
            </div>
            
            <div className="flex justify-between border-b border-gray-800/80 pb-1.5">
              <span>مالك الترخيص:</span>
              <span className="text-white font-bold">{currentLicense.customerName || 'نسخة تجريبية مجانية'}</span>
            </div>

            <div className="flex justify-between border-b border-gray-800/80 pb-1.5">
              <span>نوع الاشتراك الحالي:</span>
              <span className="text-green-400 font-bold">{currentLicense.subscriptionType.toUpperCase()}</span>
            </div>

            <div className="flex justify-between border-b border-gray-800/80 pb-1.5">
              <span>تاريخ انتهاء الترخيص:</span>
              <span className="text-red-400 font-mono font-bold">{new Date(currentLicense.expiresAt).toLocaleDateString('ar-YE')}</span>
            </div>

            <div className="flex justify-between border-b border-gray-800/80 pb-1.5">
              <span>بصمة جهازك المرتبط (HWID):</span>
              <span className="text-gray-300 font-mono text-[9px] truncate max-w-[150px]" title={currentLicense.hwid}>{currentLicense.hwid}</span>
            </div>
          </div>

          <div className="pt-1.5 flex gap-2">
            <button
              id="deactivate_license_btn"
              type="button"
              onClick={handleDeactivate}
              className="w-full py-2 bg-red-950/40 border border-red-500/20 hover:border-red-500 text-red-300 hover:text-white rounded-xl transition text-[10px] font-bold cursor-pointer text-center"
            >
              🔒 إلغاء تفعيل هذا الجهاز وتسجيل الخروج
            </button>
          </div>
        </div>

        {/* Spec Comparison Sheet Card */}
        <div className="p-5 rounded-2xl bg-[#0F1824] border border-gray-800 text-xs text-gray-300 space-y-4">
          <h4 className="font-bold text-gray-200">مقارنة معايير النقل المعتمدة في النظام:</h4>
          
          <div className="space-y-2.5 text-[10px] text-gray-400">
            <div className="flex justify-between border-b border-gray-800 pb-1.5">
              <span>تخزين البيانات:</span>
              <span className="text-white font-mono">SharedPreferences ➔ Local JSON File</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-1.5">
              <span>طباعة المستندات:</span>
              <span className="text-white font-mono">PrintManager ➔ Java Print Service</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-1.5">
              <span>صناعة الـ PDF:</span>
              <span className="text-white font-mono">Android Graphics ➔ Apache PDFBox</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-1.5">
              <span>مسح الباركود:</span>
              <span className="text-white font-mono">Google ML Kit ➔ USB Hardware Reader</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
