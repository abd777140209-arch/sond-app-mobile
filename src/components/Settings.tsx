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
  FolderTree
} from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { SystemSettings, AppTheme, CardShape, DisplayDensity, CurrencyRate, BackupFrequency } from '../types';
import { ensureCustomFolder } from '../utils/fileExport';
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
  // Local state form variables
  const [storeName, setStoreName] = useState(settings.storeName);
  const [storeLogoUrl, setStoreLogoUrl] = useState(
    settings.storeLogoUrl || localStorage.getItem('smart_accounting_company_logo') || ''
  );
  const [currency, setCurrency] = useState(settings.currency);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [pinCode, setPinCode] = useState(settings.pinCode);
  const [isPinEnabled, setIsPinEnabled] = useState(settings.isPinEnabled);
  const [protectedSections, setProtectedSections] = useState<string[]>(() => {
    return settings.protectedSections || ['settings', 'reports'];
  });
  const [privacyPinCode, setPrivacyPinCode] = useState(settings.privacyPinCode || settings.pinCode || '1234');
  const [isPrivacyPinEnabled, setIsPrivacyPinEnabled] = useState(settings.isPrivacyPinEnabled ?? true);
  const [isBiometricEnabled] = useState(() => {
    return localStorage.getItem('sond_biometrics_enabled') === 'true';
  });

  // Upgrade License State
  const [upgradeKey, setUpgradeKey] = useState('');
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Theme & Layout state
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

  // WhatsApp-style Backup State
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
  const [lastLocalBackupDate, setLastLocalBackupDate] = useState<string>(
    settings.lastLocalBackupDate || ''
  );
  const [lastDriveBackupDate, setLastDriveBackupDate] = useState<string>(
    settings.lastDriveBackupDate || ''
  );

  // Folder & Drive Modals State
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderInputVal, setFolderInputVal] = useState(backupFolderPath);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveAccountInputVal, setDriveAccountInputVal] = useState(driveBackupAccount);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentLicense, setCurrentLicense] = useState<LicenseInfo>(() => loadLicenseLocally());

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleUpgradeLicense = async () => {
    if (!upgradeKey.trim()) {
      soundManager.playWarningBeep();
      alert('⚠️ يرجى إدخال كود التفعيل أولاً!');
      return;
    }

    setIsUpgrading(true);
    try {
      const hwid = currentLicense.hwid || generateHWID();
      const res = await activateLicenseOnCloud(
        upgradeKey.trim(), 
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

  // Currencies state
  const [currenciesList, setCurrenciesList] = useState<CurrencyRate[]>(() => {
    return settings.currencies && settings.currencies.length > 0
      ? settings.currencies
      : DEFAULT_CURRENCIES;
  });
  const [selectedCurrencySymbol, setSelectedCurrencySymbol] = useState(
    settings.selectedCurrencySymbol || settings.currency || 'ر.ي'
  );

  // New currency form state
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
    const updated = [...currenciesList, newCurr];
    setCurrenciesList(updated);
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

  // 🎯 دالة رفع ومعالجة الشعار الحقيقية عبر الكاميرا/المعرض المباشر في أندرويد والمتصفح
  const handleLogoClick = async () => {
    if (Capacitor.isNativePlatform() || (window as any).Capacitor?.isNativePlatform?.()) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Photos
        });

        if (image && image.base64String) {
          const format = image.format || 'png';
          const base64Data = `data:image/${format};base64,${image.base64String}`;
          
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
              soundManager.playSuccessChime();
            }
          };
          img.src = base64Data;
          return;
        }
      } catch (err) {
        console.warn('تجاوز منتقي الصور بـ Capacitor أو خطأ، جاري الرجوع لمنتقي الملفات القياسي:', err);
      }
    }

    if (logoInputRef.current) {
      logoInputRef.current.click();
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة بحجم أقل من 3 ميجابايت.');
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
    } else {
      localStorage.removeItem('smart_accounting_company_logo');
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

          {/* نموذج ترقية الاشتراك */}
          <div className="mt-4 pt-3 border-t border-slate-100 bg-blue-50/70 p-3.5 rounded-xl border border-blue-200 space-y-2">
            <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              ترقية الاشتراك إلى ترخيص دائم / مدفوع
            </h4>
            <p className="text-[11px] text-slate-600">أدخل كود التفعيل الجديد المولد لترقية حسابك فوراً دون فقدان بياناتك:</p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="أدخل كود التفعيل (مثال: MHTL-...)"
                value={upgradeKey}
                onChange={(e) => setUpgradeKey(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-slate-800 font-mono text-center tracking-wider"
              />
              <button
                type="button"
                onClick={handleUpgradeLicense}
                disabled={isUpgrading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isUpgrading ? 'جاري...' : 'تفعيل 🚀'}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                if (onOpenDevPortal) onOpenDevPortal();
                else window.location.href = '/admin';
              }}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <span>👨‍💻 معلومات المطور واللوحة (/admin)</span>
            </button>

            <button
              onClick={handleDeactivate}
              className="py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>إلغاء التفعيل الخروج</span>
            </button>
          </div>
        </div>

        {/* WhatsApp-Style Database Backup & Restore Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-sm">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>النسخ الاحتياطي التلقائي (WhatsApp Style Backup)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    مؤمن وتلقائي
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">جدولة وحفظ بيانات المحل تلقائياً بذاكرة الهاتف وسحابة Google Drive</p>
              </div>
            </div>
            <span className="hidden sm:flex text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> مفعّل بنجاح
            </span>
          </div>

          {/* Backup Overview Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>حالة النسخة الاحتياطية الأخيرة</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                Sanad Backup Engine
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>آخر نسخة محلياً (Local):</span>
                </div>
                <div className="font-bold text-white font-mono dir-ltr text-right">
                  {lastLocalBackupDate ? new Date(lastLocalBackupDate).toLocaleString('ar-YE') : 'محلية نشطة وسليمة'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5 text-amber-400" />
                  <span>آخر نسخة سحابية (Drive):</span>
                </div>
                <div className="font-bold text-white font-mono dir-ltr text-right">
                  {lastDriveBackupDate ? new Date(lastDriveBackupDate).toLocaleString('ar-YE') : 'سحابية نشطة وسليمة'}
                </div>
              </div>
            </div>

            {/* Path & Account badges */}
            <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Folder className="w-3.5 h-3.5 text-emerald-400" />
                <span>المسار:</span>
                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-200">
                  {backupFolderPath}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-300">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>الحساب:</span>
                <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-amber-200">
                  {driveBackupAccount}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Local Backup Settings */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
              <HardDrive className="w-4 h-4 text-emerald-600" />
              <span>1. إعدادات النسخ الاحتياطي المحلي بالهاتف (Custom Local Backup)</span>
            </h4>

            {/* Folder selection */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-lg border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-800 block">مجلد تخزين النسخ بالذاكرة المحلية:</label>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{backupFolderPath}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundManager.playScanBeep();
                  setFolderInputVal(backupFolderPath);
                  setShowFolderModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 justify-center cursor-pointer shrink-0"
              >
                <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
                <span>تغيير المجلد المحلي</span>
              </button>
            </div>

            {/* Local Schedule Dropdown & Exit Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>جدولة النسخ التلقائي المحلي:</span>
                </label>
                <select
                  value={localBackupSchedule}
                  onChange={(e) => {
                    soundManager.playScanBeep();
                    setLocalBackupSchedule(e.target.value as BackupFrequency);
                  }}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="off">إيقاف (عبر الضغط اليدوي فقط)</option>
                  <option value="daily">يومياً (Daily) - مستحسن</option>
                  <option value="weekly">أسبوعياً (Weekly)</option>
                  <option value="monthly">شهرياً (Monthly)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  النسخ عند إغلاق/الخروج من التطبيق:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playScanBeep();
                    setAutoBackupOnExit(!autoBackupOnExit);
                  }}
                  className={`w-full p-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                    autoBackupOnExit
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                >
                  <span>إنشاء نسخة احتياطية تلقائياً عند الخروج من التطبيق</span>
                  {autoBackupOnExit ? (
                    <ToggleRight className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Google Drive Cloud Integration */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-3">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-2 border-b border-amber-200/80 pb-2">
              <Cloud className="w-4 h-4 text-amber-600" />
              <span>2. تكامل وجدولة Google Drive (Cloud Drive Backup)</span>
            </h4>

            {/* Google Drive Account selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-lg border border-amber-200">
              <div>
                <label className="text-xs font-bold text-slate-800 block">حساب Google Drive المرتبط:</label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-amber-900 font-mono dir-ltr">{driveBackupAccount}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundManager.playScanBeep();
                  setDriveAccountInputVal(driveBackupAccount);
                  setShowDriveModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 justify-center cursor-pointer shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>تحديد حساب Google Drive</span>
              </button>
            </div>

            {/* Drive Schedule Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>جدولة النسخ السحابي تلقائياً:</span>
              </label>
              <select
                value={driveBackupSchedule}
                onChange={(e) => {
                  soundManager.playScanBeep();
                  setDriveBackupSchedule(e.target.value as BackupFrequency);
                }}
                className="w-full text-xs p-2.5 rounded-lg border border-amber-200 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
              >
                <option value="off">إيقاف (بدون نسخ سحابي تلقائي)</option>
                <option value="daily">يومياً (Daily)</option>
                <option value="weekly">أسبوعياً (Weekly) - مستحسن</option>
                <option value="monthly">شهرياً (Monthly)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={async () => {
                soundManager.playSuccessChime();
                const nowIso = new Date().toISOString();
                setLastLocalBackupDate(nowIso);
                setLastDriveBackupDate(nowIso);
                try {
                  await onBackupData();
                } catch (err) {
                  console.warn('Backup error:', err);
                }
              }}
              className="py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إجراء نسخة احتياطية الآن</span>
            </button>

            <button
              type="button"
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
              type="button"
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

        {/* Offline Guarantee Card */}
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
              <CheckCircle className="w-4 h-4 shrink-0" /> تم حفظ الإعدادات والشعار بنجاح!
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Custom Logo Upload Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">شعار المنشأة / المحل التجاري</h4>
                    <p className="text-[10px] text-slate-500">يُحفظ الشعار محلياً وخاص بهذا الجهاز فقط، ويظهر في الهيدر، الفواتير، والتقارير</p>
                  </div>
                </div>
                {storeLogoUrl ? (
                  <span className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> تم التخصيص
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] bg-slate-200 text-slate-600 rounded-full font-bold">
                    افتراضي
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {storeLogoUrl ? (
                    <img 
                      src={storeLogoUrl} 
                      alt="شعار المنشأة" 
                      className="w-full h-full object-contain p-1" 
                    />
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
                    accept="image/png, image/jpeg, image/svg+xml" 
                    onChange={handleLogoFileChange} 
                    className="hidden" 
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleLogoClick}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{storeLogoUrl ? 'تغيير الشعار' : 'رفع شعار جديد'}</span>
                    </button>

                    {storeLogoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playWarningBeep();
                          if (confirm('هل أنت متأكد من حذف شعار المنشأة العائد للترخيص الحالي؟')) {
                            setStoreLogoUrl('');
                            localStorage.removeItem('smart_accounting_company_logo');
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-rose-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>حذف الشعار</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400">
                    الصيغ المدعومة: PNG, JPG, SVG. يتم حفظ الشعار بنجاح فور الضغط على زر "رفع شعار جديد" ثم الضغط على "حفظ وتثبيت إعدادات النظام".
                  </p>
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
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
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
                  placeholder="ر.ي"
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Multi-currency Rates Manager */}
            <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>إدارة العملات وإعداد أسعار الصرف</span>
                      <span className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded-full font-bold">متعدد العملات</span>
                    </h4>
                    <p className="text-[10px] text-slate-500">أضف عملات أخرى وحدد سعر الصرف للتحويل المباشر في الفواتير والتقارير</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playScanBeep();
                    setShowAddCurrForm(!showAddCurrForm);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة عملة</span>
                </button>
              </div>

              {/* Active Currency Selector */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-600" /> حدد العملة النشطة المعتمدة في شاشات النظام:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {currenciesList.map(curr => {
                    const isSelected = selectedCurrencySymbol === curr.symbol;
                    return (
                      <button
                        key={curr.id}
                        type="button"
                        onClick={() => {
                          soundManager.playScanBeep();
                          setSelectedCurrencySymbol(curr.symbol);
                          setCurrency(curr.symbol);
                        }}
                        className={`p-2 rounded-xl text-xs font-bold border transition text-right cursor-pointer flex justify-between items-center ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 text-amber-950 font-black shadow-xs ring-1 ring-amber-400/50'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-mono text-xs">{curr.symbol}</span>
                          <span className="text-[9px] text-slate-400 font-normal">{curr.name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Currency Form */}
              {showAddCurrForm && (
                <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-2.5 animate-in fade-in duration-200">
                  <h5 className="text-xs font-bold text-amber-950 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-600" /> بيانات العملة الجديدة:
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">اسم العملة:</label>
                      <input
                        type="text"
                        placeholder="درهم إماراتي"
                        value={newCurrName}
                        onChange={(e) => setNewCurrName(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">رمز العملة:</label>
                      <input
                        type="text"
                        placeholder="د.إ"
                        value={newCurrSymbol}
                        onChange={(e) => setNewCurrSymbol(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs font-bold rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">الكود (Code):</label>
                      <input
                        type="text"
                        placeholder="AED"
                        value={newCurrCode}
                        onChange={(e) => setNewCurrCode(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs font-mono uppercase rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">سعر الصرف:</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="144"
                        value={newCurrRate}
                        onChange={(e) => setNewCurrRate(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs font-mono font-bold rounded-lg px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddCurrForm(false)}
                      className="px-2.5 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCurrency}
                      className="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> حفظ العملة
                    </button>
                  </div>
                </div>
              )}

              {/* Table of Exchange Rates */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
                <div className="p-2.5 bg-slate-100/80 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
                  <span>جدول أسعار الصرف للعملات</span>
                  <span className="text-[10px] text-slate-400 font-normal">عدّل سعر الصرف مباشرة ليتم التحويل فوراً</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {currenciesList.map(curr => (
                    <div key={curr.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/70">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 font-mono font-extrabold text-slate-800 flex items-center justify-center text-xs shrink-0">
                          {curr.symbol}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <span>{curr.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">({curr.code})</span>
                            {curr.isBase && (
                              <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">أساسية</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                          <span className="text-[10px] text-slate-500 font-bold">1 {curr.symbol} =</span>
                          <input
                            type="number"
                            step="any"
                            disabled={curr.isBase}
                            value={curr.exchangeRate}
                            onChange={(e) => handleUpdateCurrencyRate(curr.id, parseFloat(e.target.value) || 1)}
                            className="w-16 bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 rounded px-1.5 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                        {!curr.isBase && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCurrency(curr.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="حذف العملة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
                  placeholder="أدخل عنوان المنشأة والفرع..."
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
                  placeholder="أدخل رقم الهاتف للتواصل..."
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-right"
                />
              </div>
            </div>

            {/* Security Locks */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600" /> الحماية وقفل الدخول الأمني
              </h4>

              {/* PIN Protection */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-blue-600" />
                      <span>حماية الأقسام برمز PIN</span>
                    </div>
                    <div className="text-[10px] text-blue-700/80">
                      قفل اختياري لحماية أقسام النظام لمنع الوصول غير المصرح به
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPinEnabled}
                    onChange={(e) => setIsPinEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {isPinEnabled && (
                  <div className="pt-2.5 border-t border-blue-200/80 space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-blue-900">رمز PIN السري المطلوب للأقسام (4 أرقام):</label>
                      <input
                        type="password"
                        maxLength={6}
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        placeholder="1234"
                        className="w-full bg-white border border-blue-300 text-xs font-mono font-extrabold rounded-xl px-3.5 py-2 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest shadow-inner"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold text-blue-900 flex items-center justify-between">
                        <span>حدد الأقسام المراد قفلها برمز PIN:</span>
                        <span className="text-[10px] text-blue-700 font-bold bg-white px-2 py-0.5 rounded-full border border-blue-200">
                          {protectedSections.length} قسم محمي 🔐
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-blue-200/70">
                        {[
                          { id: 'reports', label: 'قسم الأرباح والتقارير البيانية', icon: '📊' },
                          { id: 'employees', label: 'قسم إدارة العمال والرواتب', icon: '💼' },
                          { id: 'customers', label: 'قسم الدفاتر والقيود والتحصيلات', icon: '👥' },
                          { id: 'settings', label: 'شاشة إعدادات النظام والترخيص', icon: '⚙️' },
                          { id: 'transactions', label: 'دفتر القيود وأرشيف الحركة', icon: '📜' },
                          { id: 'inventory', label: 'إدارة المستودع والمخزون', icon: '📦' }
                        ].map(sec => {
                          const isChecked = protectedSections.includes(sec.id);
                          return (
                            <label
                              key={sec.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                                isChecked
                                  ? 'bg-blue-50 border-blue-400 text-blue-950 font-bold shadow-xs'
                                  : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  soundManager.playScanBeep();
                                  if (e.target.checked) {
                                    setProtectedSections([...protectedSections, sec.id]);
                                  } else {
                                    setProtectedSections(protectedSections.filter(id => id !== sec.id));
                                  }
                                }}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="text-sm">{sec.icon}</span>
                              <span className="text-[11px]">{sec.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Privacy PIN */}
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
                  </div>
                )}
              </div>

            </div>

            {/* Theme & Layout Customization */}
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

              <div className="space-y-3 p-3.5 bg-sky-50/70 border border-sky-200 rounded-2xl shadow-xs">
                <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <LayoutGrid className="w-4 h-4 text-sky-600" />
                  <span>معمارية الواجهات (Dual Layout Architecture):</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <label
                    onClick={() => handleLayoutPreferenceChange('mobile')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center gap-3 select-none ${
                      layoutPreference === 'mobile'
                        ? 'bg-white border-sky-600 ring-2 ring-sky-500/30 text-sky-950 font-bold shadow-xs'
                        : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="app_layout_preference"
                      value="mobile"
                      checked={layoutPreference === 'mobile'}
                      onChange={() => handleLayoutPreferenceChange('mobile')}
                      className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">واجهة الجوال المبسطة (Mobile View)</div>
                      <div className="text-[9.5px] text-slate-500 mt-0.5">بلاطات ملونة وشريط تنقل سفلي</div>
                    </div>
                  </label>

                  <label
                    onClick={() => handleLayoutPreferenceChange('desktop')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center gap-3 select-none ${
                      layoutPreference === 'desktop'
                        ? 'bg-white border-sky-600 ring-2 ring-sky-500/30 text-sky-950 font-bold shadow-xs'
                        : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="app_layout_preference"
                      value="desktop"
                      checked={layoutPreference === 'desktop'}
                      onChange={() => handleLayoutPreferenceChange('desktop')}
                      className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">واجهة الكمبيوتر والشاشات العريضة</div>
                      <div className="text-[9.5px] text-slate-500 mt-0.5">قوائم جانبية وهيدر عريض</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Theme Selector Buttons */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>ثيم ألوان التطبيق:</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => updateThemeInstantly('financial-blue')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between h-20 ${
                      appTheme === 'financial-blue'
                        ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/30'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">الأزرق المالي</div>
                    <div className="text-[9.5px] text-slate-500">افتراضي واحترافي</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateThemeInstantly('emerald-green')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between h-20 ${
                      appTheme === 'emerald-green'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/30'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">الأخضر الزمردي</div>
                    <div className="text-[9.5px] text-slate-500">حيوية المبيعات</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateThemeInstantly('warm-amber')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between h-20 ${
                      appTheme === 'warm-amber'
                        ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-500/30'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">البني الدافئ</div>
                    <div className="text-[9.5px] text-slate-500">فخامة وذهب</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateThemeInstantly('dark-luxury')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between h-20 ${
                      appTheme === 'dark-luxury'
                        ? 'bg-slate-900 border-amber-500 ring-2 ring-amber-500/30 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold text-amber-400">الداكن الفخم</div>
                    <div className="text-[9.5px] text-slate-400">ليلي مريح</div>
                  </button>
                </div>
              </div>

            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <Save className="w-4 h-4" />
              <span>حفظ وتثبيت إعدادات النظام</span>
            </button>

          </form>
        </div>

      </div>

      {/* Modal: Custom Backup Folder Picker */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <FolderTree className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">تحديد مجلد النسخ الاحتياطي المحلي</h3>
                <p className="text-[11px] text-slate-500">اختر اسم أو مسار المجلد المفضل بذاكرة الهاتف (Documents)</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">اسم المجلد بذاكرة المستندات (Documents):</label>
              <input
                type="text"
                value={folderInputVal}
                onChange={(e) => setFolderInputVal(e.target.value)}
                placeholder="Documents/SanadAccounting"
                className="w-full text-xs p-3 rounded-xl border border-slate-300 font-mono text-slate-800 dir-ltr text-right focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400">
                المسار الافتراضي برمجياً بداخل ذاكرة الجوال: <span className="font-mono text-emerald-700 font-bold">Documents/SanadAccounting</span>
              </p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  const cleaned = folderInputVal.trim() || 'Documents/SanadAccounting';
                  setBackupFolderPath(cleaned);
                  await ensureCustomFolder(cleaned);
                  setShowFolderModal(false);
                  soundManager.playSuccessChime();
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
              >
                حفظ المجلد المختار
              </button>
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Google Drive Account Selector */}
      {showDriveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">تحديد حساب Google Drive للمزامنة</h3>
                <p className="text-[11px] text-slate-500">اختر البريد الإلكتروني المراد ربط النسخ الاحتياطي عليه</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">بريد حساب Google Drive:</label>
              <input
                type="email"
                value={driveAccountInputVal}
                onChange={(e) => setDriveAccountInputVal(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full text-xs p-3 rounded-xl border border-slate-300 font-mono text-slate-800 dir-ltr text-right focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 font-bold">ملاحظة:</span>
                <span className="text-[10px] text-slate-500">سيتم مزامنة واستعادة النسخة السحابية على هذا الحساب تلقائياً.</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const cleaned = driveAccountInputVal.trim() || 'حساب Google Drive المرتبط';
                  setDriveBackupAccount(cleaned);
                  setShowDriveModal(false);
                  soundManager.playSuccessChime();
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer"
              >
                اعتماد حساب Google Drive
              </button>
              <button
                type="button"
                onClick={() => setShowDriveModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
