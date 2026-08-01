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
  Building2, 
  DollarSign, 
  MapPin, 
  Phone, 
  Palette, 
  LayoutGrid, 
  Sun, 
  Mail, 
  HardDrive, 
  Cloud, 
  Wifi, 
  Coins, 
  Plus, 
  Trash2, 
  Image as ImageIcon,
  Check,
  CheckCircle,
  ShieldAlert,
  Sparkles,
  Folder,
  FolderOpen,
  RefreshCw,
  Clock,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  CheckCircle2,
  FolderTree,
  Share2
} from 'lucide-react';
import { SystemSettings, AppTheme, CardShape, DisplayDensity, CurrencyRate, BackupFrequency } from '../types';
import { DEFAULT_CURRENCIES } from '../utils/seedData';
import { soundManager } from '../utils/sound';
import { loadLicenseLocally, saveLicenseLocally, generateHWID, LicenseInfo } from '../utils/licensing';
import { activateLicenseOnCloud } from '../utils/firebase';

interface SettingsProps {
  settings: SystemSettings;
  onSaveSettings: (settings: SystemSettings) => void;
  onBackupData: () => void;
  onRestoreData: (restoredData: any) => boolean | Promise<boolean>;
  onResetDatabase: () => void;
  onOpenDevPortal?: () => void;
}

export default function Settings({
  settings,
  onSaveSettings,
  onBackupData,
  onRestoreData,
  onResetDatabase,
  onOpenDevPortal
}: SettingsProps) {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [storeLogoUrl, setStoreLogoUrl] = useState(
    settings.storeLogoUrl || localStorage.getItem('smart_accounting_company_logo') || ''
  );
  const [currency, setCurrency] = useState(settings.currency);
  const [address, setAddress] = useState(settings.address || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [pinCode, setPinCode] = useState(settings.pinCode);
  const [isPinEnabled, setIsPinEnabled] = useState(settings.isPinEnabled);
  const [protectedSections, setProtectedSections] = useState<string[]>(() => {
    return settings.protectedSections || ['settings', 'reports'];
  });
  const [privacyPinCode, setPrivacyPinCode] = useState(settings.privacyPinCode || settings.pinCode || '1234');
  const [isPrivacyPinEnabled, setIsPrivacyPinEnabled] = useState(settings.isPrivacyPinEnabled ?? true);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(() => {
    return localStorage.getItem('sond_biometrics_enabled') === 'true';
  });

  const [upgradeKey, setUpgradeKey] = useState('');
  const [isUpgrading, setIsUpgrading] = useState(false);

  const [appTheme, setAppTheme] = useState<AppTheme>(settings.appTheme || 'financial-blue');
  const [cardShape, setCardShape] = useState<CardShape>(settings.cardShape || 'soft');
  const [density, setDensity] = useState<DisplayDensity>(settings.density || 'comfortable');
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop'>(settings.deviceMode || 'mobile');
  const [layoutPreference, setLayoutPreference] = useState<'mobile' | 'desktop'>(() => {
    return (localStorage.getItem('app_layout_preference') as 'mobile' | 'desktop') || settings.deviceMode || 'mobile';
  });

  const handleLayoutPreferenceChange = (mode: 'mobile' | 'desktop') => {
    soundManager.playScanBeep();
    setLayoutPreference(mode);
    setDeviceMode(mode);
    localStorage.setItem('app_layout_preference', mode);
    window.dispatchEvent(new Event('app_layout_changed'));
  };

  const [backupFolderPath, setBackupFolderPath] = useState<string>(
    settings.backupFolderPath || 'Documents/SanadAccounting'
  );
  const [localBackupSchedule, setLocalBackupSchedule] = useState<BackupFrequency>(
    settings.localBackupSchedule || 'daily'
  );
  const [autoBackupOnExit, setAutoBackupOnExit] = useState<boolean>(
    settings.autoBackupOnExit ?? true
  );
  const [driveBackupAccount, setDriveBackupAccount] = useState<string>(
    settings.driveBackupAccount || 'حساب Google Drive المرتبط'
  );
  const [driveBackupSchedule, setDriveBackupSchedule] = useState<BackupFrequency>(
    settings.driveBackupSchedule || 'weekly'
  );
  const [lastLocalBackupDate] = useState<string>(settings.lastLocalBackupDate || '');
  const [lastDriveBackupDate] = useState<string>(settings.lastDriveBackupDate || '');

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderInputVal, setFolderInputVal] = useState(backupFolderPath);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveAccountInputVal, setDriveAccountInputVal] = useState(driveBackupAccount);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentLicense, setCurrentLicense] = useState<LicenseInfo>(() => loadLicenseLocally());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleUpgradeLicense = async () => {
    const key = upgradeKey.trim();
    if (!key) {
      soundManager.playWarningBeep();
      alert('⚠️ يرجى إدخال كود التفعيل أولاً!');
      return;
    }

    // دعم الكود المجاني التجريبي محلياً وفورياً
    if (key === 'MHTT-TRIAL-7DAY-FREE') {
      soundManager.playSuccessChime();
      const trialLicense: LicenseInfo = {
        licenseKey: key,
        status: 'active',
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        hwid: currentLicense.hwid || generateHWID(),
        subscriptionType: 'trial',
        customerName: storeName || 'عميل سند',
        phone: phone
      };
      saveLicenseLocally(trialLicense);
      setCurrentLicense(trialLicense);
      setUpgradeKey('');
      alert('🎉 تم تفعيل النسخة التجريبية (7 أيام) بنجاح!');
      window.location.reload();
      return;
    }

    setIsUpgrading(true);
    try {
      const hwid = currentLicense.hwid || generateHWID();
      const res = await activateLicenseOnCloud(
        key, 
        hwid, 
        currentLicense.customerName || storeName, 
        phone
      );

      if (res.success && res.data) {
        soundManager.playSuccessChime();
        alert('🎉 تم ترقية اشتراكك وتفعيل الترخيص الجديد بنجاح!');
        const updatedLicense: LicenseInfo = {
          licenseKey: res.data.key,
          status: (res.data.status === 'suspended' ? 'expired' : res.data.status) as any,
          activatedAt: new Date().toISOString(),
          expiresAt: res.data.expiresAt,
          hwid: hwid,
          subscriptionType: res.data.type,
          customerName: res.data.customerName || 'عميل سند'
        };
        saveLicenseLocally(updatedLicense);
        setCurrentLicense(updatedLicense);
        setUpgradeKey('');
        window.location.reload();
      } else {
        soundManager.playWarningBeep();
        alert(`❌ فشل التفعيل: ${res.message || 'الكود غير صالح أو مستخدم'}`);
      }
    } catch (err) {
      soundManager.playWarningBeep();
      alert('❌ حدث خطأ أثناء الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleDeactivate = () => {
    soundManager.playWarningBeep();
    if (confirm('🚨 تنبيه أمني شديد: هل أنت متأكد من إلغاء تفعيل الرخصة على هذا الجهاز وتسجيل الخروج؟')) {
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
      alert('✓ تم إلغاء تفعيل الجهاز بنجاح!');
      window.location.reload();
    }
  };

  const [currenciesList, setCurrenciesList] = useState<CurrencyRate[]>(() => {
    return settings.currencies && settings.currencies.length > 0
      ? settings.currencies
      : DEFAULT_CURRENCIES;
  });
  const [selectedCurrencySymbol, setSelectedCurrencySymbol] = useState(
    settings.selectedCurrencySymbol || settings.currency || 'ر.ي'
  );

  const [newCurrName, setNewCurrName] = useState('');
  const [newCurrCode, setNewCurrCode] = useState('');
  const [newCurrSymbol, setNewCurrSymbol] = useState('');
  const [newCurrRate, setNewCurrRate] = useState<string>('1');
  const [showAddCurrForm, setShowAddCurrForm] = useState(false);

  const handleAddCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurrName.trim() || !newCurrSymbol.trim()) return;
    const rateNum = parseFloat(newCurrRate) || 1;
    const newCurr: CurrencyRate = {
      id: 'curr_' + Date.now(),
      code: (newCurrCode.trim() || newCurrSymbol.trim()).toUpperCase(),
      name: newCurrName.trim(),
      symbol: newCurrSymbol.trim(),
      exchangeRate: rateNum,
      isBase: false
    };
    setCurrenciesList([...currenciesList, newCurr]);
    setNewCurrName('');
    setNewCurrCode('');
    setNewCurrSymbol('');
    setNewCurrRate('1');
    setShowAddCurrForm(false);
    soundManager.playSuccessChime();
  };

  const handleUpdateCurrencyRate = (id: string, newRate: number) => {
    setCurrenciesList(prev => prev.map(c => c.id === id ? { ...c, exchangeRate: Math.max(0.0001, newRate) } : c));
  };

  const handleDeleteCurrency = (id: string) => {
    soundManager.playWarningBeep();
    const target = currenciesList.find(c => c.id === id);
    if (target?.isBase) {
      alert('⚠️ لا يمكن حذف العملة الأساسية للنظام.');
      return;
    }
    setCurrenciesList(prev => prev.filter(c => c.id !== id));
  };

  const getExchangeRatesMap = () => {
    const map: Record<string, number> = {};
    currenciesList.forEach(c => {
      map[c.code] = c.exchangeRate;
    });
    return map;
  };

  const updateThemeInstantly = (newTheme: AppTheme) => {
    soundManager.playScanBeep();
    setAppTheme(newTheme);
    onSaveSettings({
      ...settings,
      storeName,
      currency: selectedCurrencySymbol || currency,
      currencies: currenciesList,
      selectedCurrencySymbol: selectedCurrencySymbol || currency,
      exchangeRates: getExchangeRatesMap(),
      address,
      phone,
      pinCode,
      isPinEnabled,
      protectedSections,
      privacyPinCode,
      isPrivacyPinEnabled,
      appTheme: newTheme,
      cardShape,
      density,
      deviceMode
    });
  };

  // 🎯 دالة رفع الشعار المباشرة والمضمونة عبر المعرض
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 5 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/png');
          setStoreLogoUrl(compressedBase64);
          localStorage.setItem('smart_accounting_company_logo', compressedBase64);
          localStorage.setItem('sanad_store_logo', compressedBase64);
          soundManager.playSuccessChime();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playSuccessChime();
    
    localStorage.setItem('sond_biometrics_enabled', isBiometricEnabled ? 'true' : 'false');
    if (storeLogoUrl) {
      localStorage.setItem('smart_accounting_company_logo', storeLogoUrl);
      localStorage.setItem('sanad_store_logo', storeLogoUrl);
    } else {
      localStorage.removeItem('smart_accounting_company_logo');
      localStorage.removeItem('sanad_store_logo');
    }

    onSaveSettings({
      storeName: storeName.trim(),
      storeLogoUrl,
      currency: (selectedCurrencySymbol || currency).trim(),
      currencies: currenciesList,
      selectedCurrencySymbol: (selectedCurrencySymbol || currency).trim(),
      exchangeRates: getExchangeRatesMap(),
      address: address.trim(),
      phone: phone.trim(),
      pinCode,
      isPinEnabled,
      protectedSections,
      privacyPinCode: privacyPinCode.trim() || '1234',
      isPrivacyPinEnabled,
      appTheme,
      cardShape,
      density,
      deviceMode,
      backupFolderPath: backupFolderPath.trim() || 'Documents/SanadAccounting',
      localBackupSchedule,
      autoBackupOnExit,
      driveBackupAccount: driveBackupAccount.trim() || 'حساب Google Drive المرتبط',
      driveBackupSchedule,
      lastLocalBackupDate,
      lastDriveBackupDate
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ تنبيه هام: استعادة النسخة الاحتياطية ستقوم باستبدال البيانات الحالية. هل أنت متأكد؟')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const result = onRestoreData(json);
        if (result) {
          soundManager.playSuccessChime();
          alert('✓ تم استعادة النسخة الاحتياطية وإعادة تشغيل النظام بنجاح!');
          window.location.reload();
        } else {
          alert('❌ فشل استعادة البيانات: ملف تالف أو غير صالح.');
        }
      } catch (err) {
        alert('❌ صيغة الملف غير مدعومة. يرجى اختيار ملف JSON.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="settings_tab_view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-28 dir-rtl" dir="rtl">
      
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
          </div>

          {/* نموذج ترقية الاشتراك والكود المجاني */}
          <div className="mt-4 pt-3 border-t border-slate-100 bg-blue-50/70 p-3.5 rounded-xl border border-blue-200 space-y-2">
            <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              ترقية الاشتراك أو إدخال كود التفعيل
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="MHTT-TRIAL-7DAY-FREE أو كود خاص"
                value={upgradeKey}
                onChange={(e) => setUpgradeKey(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-mono text-center"
              />
              <button
                type="button"
                onClick={handleUpgradeLicense}
                disabled={isUpgrading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                {isUpgrading ? 'جاري...' : 'تفعيل 🚀'}
              </button>
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
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-sm">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">النسخ الاحتياطي والاستعادة</h3>
                <p className="text-[11px] text-slate-500">حفظ واسترجاع بيانات المحل محلياً</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                soundManager.playSuccessChime();
                onBackupData();
              }}
              className="py-3 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إجراء نسخة احتياطية الآن</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                  fileInputRef.current.click();
                }
              }}
              className="py-3 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer flex items-center justify-center gap-2"
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
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Store Profile Settings (7 cols) */}
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
              <CheckCircle className="w-4 h-4 shrink-0" /> تم حفظ الإعدادات والشعار بنجاح!
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Custom Logo Upload Card (Direct Trigger) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">شعار المنشأة / المحل التجاري</h4>
                    <p className="text-[10px] text-slate-500">يُحفظ الشعار محلياً ويظهر في الفواتير والتقارير</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {storeLogoUrl ? (
                    <img src={storeLogoUrl} alt="شعار المنشأة" className="w-full h-full object-contain p-1" />
                  ) : (
                    <div className="text-center p-2">
                      <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                      <span className="text-[9px] text-slate-400 font-bold block">لا يوجد شعار</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1 w-full text-right">
                  <input 
                    type="file" 
                    ref={logoInputRef}
                    accept="image/*" 
                    onChange={handleLogoFileChange} 
                    className="hidden" 
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (logoInputRef.current) {
                          logoInputRef.current.value = '';
                          logoInputRef.current.click();
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{storeLogoUrl ? 'تغيير الشعار' : 'رفع شعار جديد (من المعرض)'}</span>
                    </button>

                    {storeLogoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setStoreLogoUrl('');
                          localStorage.removeItem('smart_accounting_company_logo');
                          localStorage.removeItem('sanad_store_logo');
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-rose-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>حذف الشعار</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

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
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" /> رمز العملة الرئيسية:
                </label>
                <input
                  type="text"
                  required
                  value={selectedCurrencySymbol}
                  onChange={(e) => {
                    setSelectedCurrencySymbol(e.target.value);
                    setCurrency(e.target.value);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition cursor-pointer flex items-center justify-center gap-2"
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
