import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Cpu, 
  CalendarClock, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  RefreshCw, 
  Terminal, 
  LockKeyhole, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles,
  Plus,
  Trash2,
  Lock,
  ExternalLink,
  Laptop,
  Download,
  FileText,
  Share2,
  Globe,
  RotateCcw,
  AlertTriangle,
  Phone,
  Edit3,
  Save,
  Smartphone
} from 'lucide-react';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';
import { openWhatsApp, openPhoneCall } from '../utils/nativeLauncher';
import { LicenseInfo, generateLicenseKey, getExpiryDate } from '../utils/licensing';
import { isFirebaseConfigured, checkLicenseOnCloud, activateLicenseOnCloud, createLicenseOnCloud, CloudLicense, getAllLicensesFromCloud, deleteLicenseFromCloud, updateLicenseHwidOnCloud, updateLicenseHwidsOnCloud, getLicenseHwidSlots, resetCloudData, resetClientCloudData, toggleLicenseSuspendOnCloud, renewLicenseOnCloud } from '../utils/firebase';

interface DeveloperPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHwid: string;
  onResetCloudComplete?: () => void;
}

export default function DeveloperPortalModal({ isOpen, onClose, currentHwid, onResetCloudComplete }: DeveloperPortalModalProps) {
  const [devPassword, setDevPassword] = useState('');
  const [isDevUnlocked, setIsDevUnlocked] = useState(false);
  const [showLoginSection, setShowLoginSection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCloud, setIsCloud] = useState(false);
  
  // Developer key generator states
  const [genType, setGenType] = useState<'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'trial' | 'custom'>('monthly');
  const [genCustomDays, setGenCustomDays] = useState<number>(30);
  const [genCustomer, setGenCustomer] = useState('');
  const [genPhone, setGenPhone] = useState('');
  const [genHwid, setGenHwid] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [lastGeneratedInfo, setLastGeneratedInfo] = useState<{
    key: string;
    customer: string;
    phone: string;
    type: 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'trial' | 'custom';
    createdAt: string;
    expiresAt: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | null }>({ text: '', type: null });

  // License Renewal modal state
  const [renewingLicense, setRenewingLicense] = useState<CloudLicense | null>(null);
  const [renewType, setRenewType] = useState<'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'trial' | 'custom'>('monthly');
  const [renewCustomDays, setRenewCustomDays] = useState<number>(30);
  const [isRenewing, setIsRenewing] = useState(false);

  // Update Device IDs (HWID 1 & HWID 2) modal state
  const [editingHwidLicense, setEditingHwidLicense] = useState<CloudLicense | null>(null);
  const [hwid1Input, setHwid1Input] = useState('');
  const [hwid2Input, setHwid2Input] = useState('');
  const [isSavingHwid, setIsSavingHwid] = useState(false);

  // Developer keys history list (Local database synced with LocalStorage/Cloud)
  const [allLicenseKeys, setAllLicenseKeys] = useState<{ [key: string]: CloudLicense }>({});
  const [licenseToDelete, setLicenseToDelete] = useState<string | null>(null);

  // Cloud Reset states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Client Specific Cloud Reset states
  const [clientToReset, setClientToReset] = useState<CloudLicense | null>(null);
  const [clientResetConfirmText, setClientResetConfirmText] = useState('');
  const [isResettingClient, setIsResettingClient] = useState(false);

  useEffect(() => {
    setIsCloud(isFirebaseConfigured());
  }, []);

  const handleFetchCloudLicenses = async () => {
    try {
      const cloudLicenses = await getAllLicensesFromCloud();
      const mapped: { [key: string]: CloudLicense } = {};
      cloudLicenses.forEach(l => {
        mapped[l.key] = l;
      });
      setAllLicenseKeys(mapped);
    } catch (err) {
      console.warn('Error fetching licenses:', err);
    }
  };

  useEffect(() => {
    if (isDevUnlocked) {
      handleFetchCloudLicenses();
    }
  }, [isDevUnlocked]);

  useEffect(() => {
    if (!isOpen) {
      setShowLoginSection(false);
      setDevPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Developer portal unlocking handler
  const handleUnlockDeveloperPortal = (e: React.FormEvent) => {
    e.preventDefault();
    if (devPassword === '1997615' || devPassword.toLowerCase() === 'admin') {
      soundManager.playSuccessChime();
      setIsDevUnlocked(true);
      setDevPassword('');
      setStatusMessage({ text: '🔓 تم الدخول كـ "مطور مرخص"! مرحباً بك يا مهندس عبدالمجيد المحواشي.', type: 'success' });
    } else {
      soundManager.playWarningBeep();
      setStatusMessage({ text: '❌ الرمز البرمجي السري خاطئ! يمنع تلاعب غير المطورين.', type: 'error' });
    }
  };

  // Developer action: Generate and store new License Key
  const handleCreateLicenseKey = async () => {
    if (!genCustomer.trim()) {
      soundManager.playWarningBeep();
      alert('الرجاء إدخال اسم العميل/المحل لتسجيل الترخيص باسمه!');
      return;
    }

    const resolvedType = genType === 'custom' ? 'monthly' : genType;
    const newKey = generateLicenseKey(resolvedType);
    const expiresAt = getExpiryDate(genType, genType === 'custom' ? genCustomDays : undefined);
    const createdAt = new Date().toISOString();

    const newLicense: CloudLicense = {
      key: newKey,
      hwid: genHwid.trim(), // Pre-bind if provided
      customerName: genCustomer.trim(),
      phone: genPhone.trim(),
      createdAt,
      expiresAt,
      type: resolvedType as any,
      status: 'active'
    };

    setGeneratedKey(newKey);
    setLastGeneratedInfo({
      key: newKey,
      customer: genCustomer.trim(),
      phone: genPhone.trim(),
      type: genType,
      createdAt,
      expiresAt
    });
    setGenCustomer('');
    setGenPhone('');
    setGenHwid('');
    soundManager.playSuccessChime();

    // Persist on cloud or mock db
    try {
      const success = await createLicenseOnCloud(newKey, newLicense);
      if (success) {
        setStatusMessage({ text: `✓ تم توليد الكود السحابي وترحيله لقاعدة البيانات بنجاح!`, type: 'success' });
      } else {
        setStatusMessage({ text: `❌ فشل ترحيل الكود إلى قاعدة البيانات.`, type: 'error' });
      }
      await handleFetchCloudLicenses();
    } catch (e) {
      console.error(e);
      setStatusMessage({ text: `✓ تم توليد الكود محلياً (خطأ اتصال بالخادم السحابي)`, type: 'info' });
      await handleFetchCloudLicenses();
    }
  };

  // Developer action: Toggle License Status (Active <-> Suspended)
  const handleToggleSuspend = async (key: string, currentStatus: 'active' | 'suspended') => {
    const targetStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      const success = await toggleLicenseSuspendOnCloud(key, targetStatus);
      if (success) {
        soundManager.playSuccessChime();
        setStatusMessage({
          text: targetStatus === 'suspended'
            ? `🛑 تم إيقاف وتعليق الترخيص (${key}) بنجاح!`
            : `🟢 تم إعادة تفعيل الترخيص (${key}) بنجاح!`,
          type: 'success'
        });
        await handleFetchCloudLicenses();
      } else {
        soundManager.playWarningBeep();
        setStatusMessage({ text: '❌ فشل تغيير حالة الترخيص.', type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setStatusMessage({ text: '❌ حدث خطأ أثناء تغيير حالة الترخيص.', type: 'error' });
    }
  };

  // Developer action: Perform License Renewal
  const handlePerformRenewLicense = async () => {
    if (!renewingLicense) return;
    setIsRenewing(true);
    try {
      const res = await renewLicenseOnCloud(
        renewingLicense.key, 
        renewType, 
        renewType === 'custom' ? renewCustomDays : undefined
      );
      if (res.success) {
        soundManager.playSuccessChime();
        setStatusMessage({
          text: `🎉 ${res.message} للعميل (${renewingLicense.customerName || renewingLicense.key})!`,
          type: 'success'
        });
        await handleFetchCloudLicenses();
        setRenewingLicense(null);
      } else {
        soundManager.playWarningBeep();
        setStatusMessage({ text: `❌ ${res.message}`, type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage({ text: '❌ حدث خطأ غير متوقع أثناء تجديد الترخيص.', type: 'error' });
    } finally {
      setIsRenewing(false);
    }
  };

  // Developer action: Update License Device IDs (HWID 1 & HWID 2)
  const handleUpdateHwid = async () => {
    if (!editingHwidLicense) return;
    setIsSavingHwid(true);
    try {
      const hw1 = hwid1Input.trim();
      const hw2 = hwid2Input.trim();
      const success = await updateLicenseHwidsOnCloud(
        editingHwidLicense.key,
        hw1,
        hw2
      );
      if (success) {
        soundManager.playSuccessChime();
        setStatusMessage({
          text: `✓ تم تحديث وحفظ معرفات الأجهزة (HWID 1 & HWID 2) بنجاح بالسحابة للعميل (${editingHwidLicense.customerName || editingHwidLicense.key})!`,
          type: 'success'
        });
        await handleFetchCloudLicenses();
      } else {
        soundManager.playWarningBeep();
        setStatusMessage({ text: `❌ فشل تحديث معرفات الأجهزة.`, type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setStatusMessage({ text: `❌ حدث خطأ أثناء تحديث معرفات الأجهزة.`, type: 'error' });
    } finally {
      setIsSavingHwid(false);
      setEditingHwidLicense(null);
      setHwid1Input('');
      setHwid2Input('');
    }
  };

  // Developer action: Remove License Key
  const handleDeleteLicenseKey = (key: string) => {
    setLicenseToDelete(key);
  };

  const confirmDeleteLicense = async () => {
    if (!licenseToDelete) return;
    const key = licenseToDelete;
    soundManager.playWarningBeep();

    try {
      await deleteLicenseFromCloud(key);
      setStatusMessage({ text: `✓ تم حذف ترخيص العميل بنجاح!`, type: 'success' });
      await handleFetchCloudLicenses();
    } catch (e) {
      console.error(e);
      setStatusMessage({ text: `❌ فشل حذف الترخيص.`, type: 'error' });
    } finally {
      setLicenseToDelete(null);
    }
  };

  // Developer action: Reset Cloud Data (Clear products, sales, purchases, customers, suppliers)
  const handlePerformResetCloudData = async () => {
    if (resetConfirmText.trim() !== 'تصفير') {
      return;
    }

    setIsResetting(true);
    soundManager.playWarningBeep();

    try {
      const result = await resetCloudData();
      if (result.success) {
        soundManager.playSuccessChime();
        setStatusMessage({
          text: `✓ تم تصفير البيانات السحابية بنجاح! تم إفراغ وتصفير وثائق المجموعات (المنتجات، المبيعات، المشتريات، العملاء، والموردين).`,
          type: 'success'
        });
        if (onResetCloudComplete) {
          onResetCloudComplete();
        }
      } else {
        setStatusMessage({
          text: `❌ حدث خطأ أثناء تصفير البيانات السحابية: ${result.message}`,
          type: 'error'
        });
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage({
        text: `❌ حدث خطأ غير متوقع أثناء تصفير البيانات السحابية.`,
        type: 'error'
      });
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
      setResetConfirmText('');
    }
  };

  // Developer action: Reset Cloud Data for a Specific Client
  const handlePerformResetClientCloudData = async () => {
    if (!clientToReset) return;
    if (clientResetConfirmText.trim() !== 'تصفير') return;

    setIsResettingClient(true);
    soundManager.playWarningBeep();

    try {
      const result = await resetClientCloudData(clientToReset.key, clientToReset.hwid);
      if (result.success) {
        soundManager.playSuccessChime();
        setStatusMessage({
          text: `✓ تم تصفير بيانات العميل (${clientToReset.customerName || clientToReset.key}) بنجاح! تم إفراغ وتصفير المنتجات، المبيعات، والمشتريات الخاصة برخصته من السحابة.`,
          type: 'success'
        });
        if (onResetCloudComplete) {
          onResetCloudComplete();
        }
      } else {
        setStatusMessage({
          text: `❌ حدث خطأ أثناء تصفير بيانات العميل: ${result.message}`,
          type: 'error'
        });
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage({
        text: `❌ حدث خطأ غير متوقع أثناء تصفير بيانات العميل.`,
        type: 'error'
      });
    } finally {
      setIsResettingClient(false);
      setClientToReset(null);
      setClientResetConfirmText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all" dir="rtl">
      <div className="w-full max-w-4xl bg-[#090d16] border border-[#C5A862]/30 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        
        {/* Shiny corner accents */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#C5A862]/40 rounded-tr-xl pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#C5A862]/40 rounded-tl-xl pointer-events-none"></div>

        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#0d1320]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#1a253a] border border-[#C5A862]/20">
              <Terminal className="w-5 h-5 text-[#C5A862]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">بوابة مطور النظام م.عبدالمجيد المحواشي</h2>
              <p className="text-[9px] text-gray-500 font-mono tracking-wider mt-0.5">CENTRAL SAAS LICENSING CONTROL PORTAL</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Status Alert Area */}
          {statusMessage.text && (
            <div className={`p-3 rounded-xl border text-xs text-center ${
              statusMessage.type === 'success' ? 'bg-green-950/20 border-green-500/20 text-green-300' :
              statusMessage.type === 'error' ? 'bg-red-950/20 border-red-500/20 text-red-300' :
              'bg-blue-950/20 border-blue-500/20 text-blue-300'
            }`}>
              {statusMessage.text}
            </div>
          )}

          {!isDevUnlocked ? (
            <div className="max-w-lg mx-auto py-6 space-y-5 text-center">
              {/* Developer Info Card */}
              <div className="p-5 rounded-2xl bg-[#0f172a] border border-[#C5A862]/30 space-y-4 shadow-xl text-right">
                <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">بطاقة معلومات المطور والدعم الفني</h3>
                    <p className="text-[10px] text-gray-400 font-mono">SOND ACCOUNTING SYSTEM • DEVELOPER PORTAL</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#080d1a] border border-gray-800/80 flex justify-between items-center">
                    <span className="text-gray-400 font-bold">مهندس ومطور النظام:</span>
                    <span className="font-extrabold text-amber-400">م. عبدالمجيد المحواشي</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#080d1a] border border-gray-800/80 flex justify-between items-center">
                    <span className="text-gray-400 font-bold">رقم الهاتف / واتساب:</span>
                    <span className="font-mono font-black text-sky-400 text-sm select-all" dir="ltr">777140209</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#080d1a] border border-gray-800/80 flex justify-between items-center">
                    <span className="text-gray-400 font-bold">إصدار النظام:</span>
                    <span className="font-mono text-emerald-400 font-bold">v2.4 (SaaS Cloud Enabled)</span>
                  </div>
                </div>

                {/* Direct Action Contact Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      openWhatsApp('967777140209', 'مرحباً م. عبدالمجيد، أتواصل معك بخصوص نظام سند المحاسبي');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    💬 واتساب المطور
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      openPhoneCall('777140209');
                    }}
                    className="py-2.5 px-3 rounded-xl bg-sky-600/90 hover:bg-sky-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    📞 اتصال مباشر
                  </button>
                </div>
              </div>

              {/* Password Unlock Section (Shown only when hidden trigger point is clicked) */}
              {showLoginSection && (
                <div className="p-4 rounded-2xl bg-[#0b101d] border border-gray-800 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-300">
                    <LockKeyhole className="w-4 h-4 text-amber-500" />
                    <span>دخول لوحة تحكم المطور والربط (/admin)</span>
                  </div>
                  
                  <form onSubmit={handleUnlockDeveloperPortal} className="flex gap-2 text-xs">
                    <input
                      type="password"
                      required
                      placeholder="أدخل الرمز السري للمطور"
                      value={devPassword}
                      onChange={(e) => setDevPassword(e.target.value)}
                      className="flex-1 bg-[#04060b] border border-gray-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#C5A862] text-center font-mono tracking-widest text-xs"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-black rounded-xl cursor-pointer transition font-bold text-xs shrink-0"
                    >
                      تأكيد الهوية 🔐
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Dev Header Info */}
              <div className="flex justify-between items-center bg-gray-900/40 p-3 rounded-xl border border-[#C5A862]/20">
                <span className="font-bold text-green-400 flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 animate-bounce text-yellow-400" /> مرحباً بك مجدداً يا مهندس عبدالمجيد المحواشي!
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {isCloud ? '🟢 السيرفر السحابي نشط ومتصل' : '🟡 السيرفر السحابي غير متصل (وضع محلي)'}
                </span>
              </div>

              {/* Generator Section */}
              <div className="p-4 bg-[#0d121f] border border-gray-800 rounded-xl space-y-4">
                <h4 className="font-bold text-xs text-gray-300">توليد وإصدار رخصة جديدة لعميل:</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">اسم العميل / المحل التجاري:</label>
                    <input
                      type="text"
                      required
                      value={genCustomer}
                      onChange={(e) => setGenCustomer(e.target.value)}
                      placeholder="مثال: بقالة السعيد أو معرض الهواتف"
                      className="w-full bg-[#04060b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A862]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-cyan-400 block mb-1">رقم هاتف المستخدم / العميل 📱:</label>
                    <input
                      type="tel"
                      value={genPhone}
                      onChange={(e) => setGenPhone(e.target.value)}
                      placeholder="مثال: 777140209"
                      className="w-full bg-[#04060b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A862] font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-amber-400 block mb-1">بصمة جهاز العميل (HWID) - اختياري:</label>
                    <input
                      type="text"
                      value={genHwid}
                      onChange={(e) => setGenHwid(e.target.value)}
                      placeholder="أدخل بصمة الجهاز إذا توفرت"
                      className="w-full bg-[#04060b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A862] font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">نوع وفترة صلاحية الاشتراك:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={genType}
                        onChange={(e) => setGenType(e.target.value as any)}
                        className="w-full bg-[#04060b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A862]"
                      >
                        <option value="weekly">أسبوعي (7 أيام)</option>
                        <option value="trial">تجريبي (7 أيام)</option>
                        <option value="monthly">شهري (30 يوماً)</option>
                        <option value="yearly">سنوي (365 يوماً)</option>
                        <option value="lifetime">رخصة دائمة (مدى الحياة)</option>
                        <option value="custom">تحديد عدد أيام مخصص ⚙️</option>
                      </select>

                      {genType === 'custom' && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={36500}
                            value={genCustomDays}
                            onChange={(e) => setGenCustomDays(Number(e.target.value))}
                            placeholder="عدد الأيام"
                            className="w-full bg-[#04060b] border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none"
                          />
                          <span className="text-xs text-gray-400 whitespace-nowrap">يوم</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="text-[10px] text-gray-500">
                    * سيتم ترحيل الترخيص تلقائياً لقاعدة بيانات الـ Cloud لكي يتمكن العميل من تفعيل جهازة فوراً بالإنترنت.
                  </div>
                  <button
                    onClick={handleCreateLicenseKey}
                    className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg cursor-pointer transition flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Plus className="w-4 h-4" /> توليد المفتاح وترحيله السحابي ⚡
                  </button>
                </div>

                {generatedKey && lastGeneratedInfo && (
                  <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl space-y-4 text-center max-w-2xl mx-auto">
                    <div>
                      <span className="text-xs text-green-400 font-bold block mb-1">✓ تم توليد كود التفعيل السحابي الجديد بنجاح:</span>
                      <div className="font-mono text-lg font-extrabold text-yellow-400 select-all bg-black py-2.5 rounded-lg tracking-widest border border-[#C5A862]/30 my-2">
                        {generatedKey}
                      </div>
                      <div className="text-[11px] text-gray-300 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-slate-900/80 p-2.5 rounded-lg border border-gray-800">
                        <span>العميل: <strong className="text-white">{lastGeneratedInfo.customer}</strong></span>
                        <span>•</span>
                        <span>رقم الهاتف: <strong className="text-cyan-400 font-mono">{lastGeneratedInfo.phone || 'غير مدخل'}</strong></span>
                        <span>•</span>
                        <span>النوع: <strong className="text-amber-400">
                          {lastGeneratedInfo.type === 'trial' ? 'تجريبي (7 أيام)' : lastGeneratedInfo.type === 'monthly' ? 'شهري (30 يوماً)' : lastGeneratedInfo.type === 'yearly' ? 'سنوي (365 يوماً)' : 'دائم (مدى الحياة)'}
                        </strong></span>
                        <span>•</span>
                        <span>إنشاء: <strong className="text-gray-300">{new Date(lastGeneratedInfo.createdAt).toLocaleDateString('ar-YE')}</strong></span>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                      <button
                        onClick={() => {
                          soundManager.playSuccessChime();
                          navigator.clipboard.writeText(generatedKey);
                          alert('تم نسخ كود التفعيل فقط!');
                        }}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg text-xs cursor-pointer transition flex items-center gap-1.5 border border-gray-700"
                      >
                        <Copy className="w-3.5 h-3.5" /> نسخ الكود فقط
                      </button>

                      <button
                        onClick={() => {
                          soundManager.playSuccessChime();
                          const typeAr = lastGeneratedInfo.type === 'trial' ? 'تجريبي (7 أيام)' : lastGeneratedInfo.type === 'monthly' ? 'شهري (30 يوماً)' : lastGeneratedInfo.type === 'yearly' ? 'سنوي (365 يوماً)' : 'رخصة دائمة (مدى الحياة)';
                          const expiresAr = lastGeneratedInfo.type === 'lifetime' ? 'صلاحية دائمة' : new Date(lastGeneratedInfo.expiresAt).toLocaleDateString('ar-YE');
                          const message = 
                            `*نظام سند الذكي المحاسبي* 📱💼\n` +
                            `مرحباً بك يا غالي! لقد تم إصدار كود التفعيل الخاص بك بنجاح:\n\n` +
                            `👤 *العميل:* ${lastGeneratedInfo.customer}\n` +
                            `📱 *رقم الهاتف:* ${lastGeneratedInfo.phone || 'غير محدد'}\n` +
                            `🔑 *كود التفعيل (Serial):* \`${generatedKey}\`\n` +
                            `📅 *تاريخ الإنشاء:* ${new Date(lastGeneratedInfo.createdAt).toLocaleDateString('ar-YE')}\n` +
                            `⏳ *نوع الاشتراك وصلاحيته:* ${typeAr} (${expiresAr})\n\n` +
                            `*طريقة التفعيل السهلة:*\n` +
                            `1. افتح تطبيق نظام سند الذكي المحاسبي على جهازك.\n` +
                            `2. أدخل رقم هاتفك وكود التفعيل أعلاه في شاشة التفعيل.\n` +
                            `3. اضغط على زر "تفعيل البرنامج وفك القفل".\n\n` +
                            `شكراً لثقتكم بنا! 🌹\n` +
                            `م. عبدالمجيد المحواشي (هاتف: 777140209)\n`;
                          navigator.clipboard.writeText(message);
                          alert('تم نسخ رسالة التفعيل الجاهزة لمشاركتها بالواتساب!');
                        }}
                        className="px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-semibold rounded-lg text-xs cursor-pointer transition flex items-center gap-1.5 border border-[#25D366]/30"
                      >
                        <Copy className="w-3.5 h-3.5" /> نسخ رسالة الواتساب الجاهزة 💬
                      </button>

                      <button
                        onClick={() => {
                          soundManager.playSuccessChime();
                          const typeAr = lastGeneratedInfo.type === 'trial' ? 'تجريبي' : lastGeneratedInfo.type === 'monthly' ? 'شهري' : lastGeneratedInfo.type === 'yearly' ? 'سنوي' : 'مدى الحياة';
                          const expiresAr = lastGeneratedInfo.type === 'lifetime' ? 'صلاحية دائمة' : new Date(lastGeneratedInfo.expiresAt).toLocaleDateString('ar-YE');
                          const content = 
                            `نظام سند الذكي المحاسبي - ترخيص الاستخدام\n` +
                            `================================================\n` +
                            `اسم العميل/المحل: ${lastGeneratedInfo.customer}\n` +
                            `رقم هاتف المستخدم: ${lastGeneratedInfo.phone || 'غير مدخل'}\n` +
                            `كود التفعيل (Serial Key): ${generatedKey}\n` +
                            `تاريخ الإنشاء: ${new Date(lastGeneratedInfo.createdAt).toLocaleDateString('ar-YE')}\n` +
                            `نوع الاشتراك وصلاحيته: ${typeAr} (${expiresAr})\n\n` +
                            `طريقة التفعيل:\n` +
                            `1. افتح برنامج نظام سند الذكي المحاسبي على جهازك.\n` +
                            `2. قم بنسخ كود التفعيل أعلاه ولصقه في حقل (مفتاح التفعيل).\n` +
                            `3. أدخل رقم هاتفك واضغط على زر "تفعيل البرنامج وفك القفل".\n\n` +
                            `مع تحيات مبرمج النظام: م. عبدالمجيد المحواشي (هاتف: 777140209)\n`;
                          
                          const fileName = `ترخيص_${lastGeneratedInfo.customer.replace(/\s+/g, '_')}.txt`;
                          saveAndShareFile({
                            fileName,
                            data: content,
                            mimeType: 'text/plain',
                            title: `ترخيص سند - ${lastGeneratedInfo.customer}`,
                            text: `تفاصيل ترخيص نظام سند المحاسبي للعميل ${lastGeneratedInfo.customer}`
                          });
                        }}
                        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black font-extrabold rounded-lg text-xs cursor-pointer transition flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> تحميل ملف الترخيص (.txt) 📄
                      </button>
                    </div>
                    <div className="text-[10px] text-amber-500 font-medium">
                      * ملاحظة: الكود لا يرتبط بجهازك الشخصي. سيرتبط تلقائياً بجهاز المشترك عند استخدامه لأول مرة!
                    </div>
                  </div>
                )}
              </div>

              {/* Subscriber Try App Link Section */}
              <div className="p-4 bg-gradient-to-r from-amber-950/10 to-yellow-950/10 border border-[#C5A862]/20 rounded-xl space-y-3.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-amber-400">مشاركة رابط تجربة النظام للمشتركين والعملاء الجدد</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">انسخ الرابط ومفتاح التفعيل الموحد لإرسالهما لعملائك لكي يجربوا النظام مباشرة على أي متصفح أو جهاز</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-500 block">رابط تجربة التطبيق العام (للمشاركة):</span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value="https://ais-pre-z5yeta6zliodlnrwazwoat-575351245128.europe-west2.run.app"
                        className="flex-1 bg-[#04060b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          soundManager.playSuccessChime();
                          navigator.clipboard.writeText("https://ais-pre-z5yeta6zliodlnrwazwoat-575351245128.europe-west2.run.app");
                          alert('تم نسخ رابط تجربة النظام العام بنجاح!');
                        }}
                        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg cursor-pointer transition font-bold"
                        title="نسخ الرابط"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-500 block">مفتاح التفعيل التجريبي الموحد (صلاحية 7 أيام لكل جهاز):</span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value="MHTT-TRIAL-7DAY-FREE"
                        className="flex-1 bg-[#04060b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-yellow-400 font-mono font-bold tracking-wider text-center focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          soundManager.playSuccessChime();
                          navigator.clipboard.writeText('MHTT-TRIAL-7DAY-FREE');
                          alert('تم نسخ مفتاح التفعيل التجريبي الموحد!');
                        }}
                        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg cursor-pointer transition font-bold"
                        title="نسخ الكود"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2.5 justify-end">
                  <button
                    onClick={() => {
                      soundManager.playSuccessChime();
                      const message = 
                        `*نظام سند الذكي المحاسبي* 📱💼\n` +
                        `أهلاً بك يا غالي! يمكنك الآن تجربة النسخة الكاملة لنظام سند الذكي المحاسبي مباشرة من أي متصفح أو جهاز:\n\n` +
                        `🔗 *رابط التجربة المباشر العام:* https://ais-pre-z5yeta6zliodlnrwazwoat-575351245128.europe-west2.run.app\n\n` +
                        `🔑 *مفتاح التفعيل التجريبي المجاني (7 أيام):* \`MHTT-TRIAL-7DAY-FREE\`\n\n` +
                        `*خطوات التشغيل السريعة:*\n` +
                        `1. اضغط على الرابط المذكور أعلاه.\n` +
                        `2. قم بنسخ مفتاح التفعيل التجريبي المجاني وصقه في حقل الترخيص.\n` +
                        `3. اكتب اسم محلك واضغط زر "تفعيل البرنامج وفك القفل".\n\n` +
                        `شكراً لاهتمامكم وثقتكم بنا! 🌹\n` +
                        `م. عبدالمجيد المحواشي (هاتف: 777140209)\n`;
                      navigator.clipboard.writeText(message);
                      alert('تم نسخ رسالة الدعوة ورابط التجربة العام للواتساب بنجاح! جاهزة للإرسال.');
                    }}
                    className="px-4 py-2 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/30 font-bold rounded-lg text-xs cursor-pointer transition flex items-center gap-1.5"
                  >
                    <Share2 className="w-4 h-4" /> نسخ رسالة الدعوة للواتساب 💬
                  </button>

                  <a
                    href="https://ais-pre-z5yeta6zliodlnrwazwoat-575351245128.europe-west2.run.app"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 border border-yellow-500/30 font-bold rounded-lg text-xs cursor-pointer transition flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" /> فتح الرابط في متصفح جديد 🌐
                  </a>
                </div>
              </div>

              {/* Licenses Database Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-gray-300">سجل التراخيص الصادرة والأجهزة النشطة بسحابة البيانات:</h4>
                  <button
                    onClick={handleFetchCloudLicenses}
                    className="p-1.5 px-3 rounded-lg bg-slate-900 border border-gray-800 hover:border-gray-700 text-[10px] text-gray-400 hover:text-white transition flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> تحديث البيانات السحابية
                  </button>
                </div>
                
                <div className="border border-gray-800 rounded-xl overflow-hidden">
                  <div className="max-h-[280px] overflow-y-auto">
                    <table className="w-full text-right text-[11px] font-sans">
                      <thead className="bg-[#0e131f] text-gray-400 sticky top-0 border-b border-gray-800">
                        <tr>
                          <th className="p-3 text-right">المحل/العميل</th>
                          <th className="p-3 text-right">رقم الهاتف</th>
                          <th className="p-3 text-right">كود الترخيص</th>
                          <th className="p-3 text-right font-mono">معرف الجهاز (Device ID)</th>
                          <th className="p-3 text-right">نوع الاشتراك / الصلاحية</th>
                          <th className="p-3 text-center">خيارات الإدارة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60 bg-[#060a12]/80">
                        {Object.keys(allLicenseKeys).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-500 font-sans">
                              لا توجد تراخيص مسجلة في السجل حالياً. يرجى الضغط على "تحديث البيانات" أو توليد رخصة جديدة.
                            </td>
                          </tr>
                        ) : (
                          Object.values(allLicenseKeys).map((lk: any, idx: number) => {
                            const { hwid1, hwid2 } = getLicenseHwidSlots(lk);
                            return (
                              <tr key={lk.key ? `lic-${lk.key}-${idx}` : `lic-idx-${idx}`} className="hover:bg-slate-900/60 transition">
                                <td className="p-3 text-white font-bold">{lk.customerName}</td>
                                <td className="p-3">
                                  {lk.phone ? (
                                    <span className="text-cyan-300 font-mono text-[10.5px] inline-flex items-center gap-1 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
                                      <Phone className="w-3 h-3 text-cyan-400" /> {lk.phone}
                                    </span>
                                  ) : (
                                    <span className="text-gray-600 text-[10px] font-sans">غير مدخل</span>
                                  )}
                                </td>
                                <td className="p-3 text-yellow-400 font-bold font-mono select-all tracking-wider">{lk.key}</td>
                                <td className="p-3">
                                  <div className="space-y-1 font-mono text-[10px]">
                                    <div>
                                      <span className="text-gray-400 text-[9px] mr-1">HWID 1:</span>
                                      {hwid1 ? (
                                        <span className="text-green-400 bg-green-950/40 px-2 py-0.5 rounded border border-green-500/20 inline-flex items-center gap-1">
                                          <Laptop className="w-2.5 h-2.5 text-green-400" /> {hwid1}
                                        </span>
                                      ) : (
                                        <span className="text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/20">⏳ فارغ (متاح)</span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-gray-400 text-[9px] mr-1">HWID 2:</span>
                                      {hwid2 ? (
                                        <span className="text-green-400 bg-green-950/40 px-2 py-0.5 rounded border border-green-500/20 inline-flex items-center gap-1">
                                          <Laptop className="w-2.5 h-2.5 text-green-400" /> {hwid2}
                                        </span>
                                      ) : (
                                        <span className="text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/20">⏳ فارغ (متاح)</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-gray-300">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {lk.status === 'suspended' ? (
                                        <span className="font-extrabold text-[10px] bg-rose-950/80 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          🛑 موقوف
                                        </span>
                                      ) : lk.type !== 'lifetime' && lk.expiresAt && new Date(lk.expiresAt) < new Date() ? (
                                        <span className="font-extrabold text-[10px] bg-amber-950/80 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          ⏳ منتهي الصلاحية
                                        </span>
                                      ) : (
                                        <span className="font-extrabold text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          🟢 نشط ومفعل
                                        </span>
                                      )}

                                      <span className="font-bold text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                                        {lk.type === 'weekly' ? 'أسبوعي' : lk.type === 'trial' ? 'تجريبي' : lk.type === 'monthly' ? 'شهري' : lk.type === 'yearly' ? 'سنوي' : 'مدى الحياة'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-mono text-gray-400">
                                      {lk.type === 'lifetime' ? 'صلاحية دائمة' : `ينتهي: ${new Date(lk.expiresAt).toLocaleDateString('ar-YE')}`}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    {/* Toggle Suspend / Active Switch */}
                                    {lk.status === 'suspended' ? (
                                      <button
                                        onClick={() => handleToggleSuspend(lk.key, 'suspended')}
                                        className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                                        title="إعادة تفعيل وترخيص العميل فوراً"
                                      >
                                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                        <span>تفعيل 🟢</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleToggleSuspend(lk.key, 'active')}
                                        className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300 hover:text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                                        title="إيقاف وتعليق حساب العميل مؤقتاً بدون حذف الكود"
                                      >
                                        <Lock className="w-3 h-3 text-amber-400" />
                                        <span>إيقاف 🛑</span>
                                      </button>
                                    )}

                                    {/* Renew License Button */}
                                    <button
                                      onClick={() => {
                                        soundManager.playSuccessChime();
                                        setRenewingLicense(lk);
                                        setRenewType('monthly');
                                        setRenewCustomDays(30);
                                      }}
                                      className="px-2 py-1 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 hover:text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                                      title="تجديد وتمديد فترة صلاحية هذا الترخيص"
                                    >
                                      <CalendarClock className="w-3 h-3 text-purple-400" />
                                      <span>تجديد 🔄</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        soundManager.playSuccessChime();
                                        const slots = getLicenseHwidSlots(lk);
                                        setEditingHwidLicense(lk);
                                        setHwid1Input(slots.hwid1 || '');
                                        setHwid2Input(slots.hwid2 || '');
                                      }}
                                      className="px-2 py-1 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 text-blue-300 hover:text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                                      title="إدارة وتعديل معرف الجهاز الأول والثاني (HWID 1 & HWID 2)"
                                    >
                                      <Edit3 className="w-3 h-3 text-blue-400" />
                                      <span>تعديل HWID</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        soundManager.playWarningBeep();
                                        setClientToReset(lk);
                                        setClientResetConfirmText('');
                                      }}
                                      className="px-2 py-1 rounded bg-red-950/70 hover:bg-red-900 border border-red-500/40 text-red-300 hover:text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                                      title="تصفير حساب وسجل بيانات هذا العميل فقط"
                                    >
                                      <RotateCcw className="w-3 h-3 text-red-400" />
                                      <span>تصفير العميل</span>
                                    </button>

                                    <button
                                      onClick={() => handleDeleteLicenseKey(lk.key)}
                                      className="p-1 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 transition cursor-pointer"
                                      title="حذف وإلغاء ترخيص العميل فوراً"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Reset Cloud Data Danger Zone Section */}
              <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-red-950/60 text-red-400 border border-red-500/30">
                      <RotateCcw className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-red-400 flex items-center gap-1.5">
                        إدارة السحابة • تصفير البيانات السحابية (Reset Cloud Data)
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        إفراغ وتصفير وثائق المجموعات (products, sales, purchases, customers, suppliers) سحابياً مع الحفاظ التام والكامل على التراخيص والمستخدمين والإعدادات.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      soundManager.playWarningBeep();
                      setResetConfirmText('');
                      setShowResetModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-lg text-xs cursor-pointer transition shadow-lg shadow-red-950/50 border border-red-400/30 flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> تصفير البيانات السحابية (Reset Cloud Data) 🗑️
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer Credit */}
        <div className="p-4 border-t border-gray-800 text-center text-[10px] text-gray-500 bg-[#070b13] select-none">
          <span>بوابة الإدارة السحابية المركزية الذكية</span>{' '}
          <span
            onClick={() => setShowLoginSection(prev => !prev)}
            className="cursor-pointer font-black text-gray-400 hover:text-amber-400 transition-colors px-1 py-0.5 inline-block"
            title="تفعيل دخول لوحة تحكم المطور"
          >
            .
          </span>{' '}
          <span>مبرمج النظام عبدالمجيد المحواشي - 2026</span>
        </div>

        {/* Custom Confirmation Modal for Delete License */}
        {licenseToDelete && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-md bg-[#090d16] border border-red-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
              <div className="inline-flex p-3 rounded-full bg-red-950/40 text-red-400 border border-red-500/20">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white">تأكيد حذف الترخيص</h3>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                هل أنت متأكد تماماً من حذف ترخيص العميل صاحب المفتاح:
                <br />
                <span className="font-mono text-yellow-400 font-bold select-all tracking-wider text-xs block my-2 bg-slate-900 py-1.5 rounded-lg border border-gray-800">
                  {licenseToDelete}
                </span>
                سيتم إزالة الترخيص من قائمة العملاء والأجهزة النشطة.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <button
                  onClick={confirmDeleteLicense}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg cursor-pointer transition text-xs"
                >
                  نعم، حذف الترخيص 🗑️
                </button>
                <button
                  onClick={() => setLicenseToDelete(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg cursor-pointer transition text-xs"
                >
                  تراجع وإلغاء ❌
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Double Safety Confirmation Modal for Reset Cloud Data */}
        {showResetModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-md bg-[#0c0812] border border-red-500/50 rounded-2xl p-6 text-center space-y-4 shadow-2xl relative">
              <div className="inline-flex p-3 rounded-full bg-red-950/80 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-8 h-8 animate-bounce" />
              </div>

              <h3 className="text-sm font-bold text-white">⚠️ حماية مضاعفة: تأكيد تصفير البيانات السحابية</h3>

              <div className="text-[11px] text-gray-300 leading-relaxed space-y-2 bg-red-950/30 p-3 rounded-xl border border-red-500/20 text-right">
                <p className="text-red-300 font-bold">تنبيه أمني شديد الخطورة للمطور:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-300 text-[10.5px]">
                  <li>سيتم إفراغ وتصفير مجموعات: <span className="text-amber-400 font-mono font-bold">products, sales, purchases, customers, suppliers</span> نهائياً من السحابة.</li>
                  <li>سيتم <span className="text-green-400 font-bold">الحفاظ التام</span> ولن يتم مسح: التراخيص (<span className="text-green-400 font-mono">licenses</span>)، المستخدمين (<span className="text-green-400 font-mono">users</span>)، والإعدادات العامة (<span className="text-green-400 font-mono">settings</span>).</li>
                </ul>
              </div>

              <div className="space-y-2 text-right pt-1">
                <label className="text-[11px] text-amber-400 font-bold block">
                  لتأكيد تنفيذ عملية التصفير السحابي، يرجى كتابة كلمة <span className="text-white bg-red-950 px-2 py-0.5 rounded border border-red-500/40 font-mono font-bold">تصفير</span> في الحقل أدناه:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="أكتب كلمة (تصفير) هنا لتأكيد الحذف"
                  className="w-full bg-[#04060b] border border-red-500/40 rounded-xl px-3 py-2.5 text-xs text-white text-center font-bold focus:outline-none focus:border-red-400"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-center pt-2">
                <button
                  disabled={resetConfirmText.trim() !== 'تصفير' || isResetting}
                  onClick={handlePerformResetCloudData}
                  className={`px-5 py-2.5 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                    resetConfirmText.trim() === 'تصفير' && !isResetting
                      ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-lg shadow-red-900/50 border border-red-400/40'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  }`}
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> جاري التصفير السحابي...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> تأكيد وإجراء التصفير النهائي 🗑️
                    </>
                  )}
                </button>

                <button
                  disabled={isResetting}
                  onClick={() => {
                    setShowResetModal(false);
                    setResetConfirmText('');
                  }}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg cursor-pointer transition text-xs border border-gray-700"
                >
                  إلغاء وتراجع ❌
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Double Safety Confirmation Modal for Resetting Specific Client Cloud Data */}
        {clientToReset && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-md bg-[#0c0812] border border-red-500/50 rounded-2xl p-6 text-center space-y-4 shadow-2xl relative">
              <div className="inline-flex p-3 rounded-full bg-red-950/80 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-8 h-8 animate-bounce" />
              </div>

              <h3 className="text-sm font-bold text-white">⚠️ تأكيد تصفير بيانات العميل: <span className="text-yellow-400">{clientToReset.customerName || 'عميل'}</span></h3>

              <div className="text-[11px] text-gray-300 leading-relaxed space-y-2 bg-red-950/30 p-3 rounded-xl border border-red-500/20 text-right">
                <p className="text-red-300 font-bold">تنبيه هام للمطور:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-300 text-[10.5px]">
                  <li>اسم العميل/المحل: <span className="text-white font-bold">{clientToReset.customerName}</span></li>
                  <li>كود الترخيص: <span className="text-yellow-400 font-mono font-bold">{clientToReset.key}</span></li>
                  <li>سيتم إفراغ وتصفير (المنتجات، المبيعات، المشتريات، العملاء، والموردين) المربوطة بـ <span className="text-yellow-400 font-mono">{clientToReset.key}</span> فقط من السحابة.</li>
                  <li><span className="text-green-400 font-bold">لن يتم المساس</span> ببيانات أي عميل آخر على السحابة، ولن يتم حذف كود الترخيص.</li>
                </ul>
              </div>

              <div className="space-y-2 text-right pt-1">
                <label className="text-[11px] text-amber-400 font-bold block">
                  لتأكيد تصفير حساب العميل ({clientToReset.customerName})، أكتب كلمة <span className="text-white bg-red-950 px-2 py-0.5 rounded border border-red-500/40 font-mono font-bold">تصفير</span> في الحقل أدناه:
                </label>
                <input
                  type="text"
                  value={clientResetConfirmText}
                  onChange={(e) => setClientResetConfirmText(e.target.value)}
                  placeholder="أكتب كلمة (تصفير) هنا لتأكيد الحذف"
                  className="w-full bg-[#04060b] border border-red-500/40 rounded-xl px-3 py-2.5 text-xs text-white text-center font-bold focus:outline-none focus:border-red-400"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-center pt-2">
                <button
                  disabled={clientResetConfirmText.trim() !== 'تصفير' || isResettingClient}
                  onClick={handlePerformResetClientCloudData}
                  className={`px-5 py-2.5 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                    clientResetConfirmText.trim() === 'تصفير' && !isResettingClient
                      ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-lg shadow-red-900/50 border border-red-400/40'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  }`}
                >
                  {isResettingClient ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> جاري تصفير حساب العميل...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" /> تأكيد وتصفير بيانات العميل 🗑️
                    </>
                  )}
                </button>

                <button
                  disabled={isResettingClient}
                  onClick={() => {
                    setClientToReset(null);
                    setClientResetConfirmText('');
                  }}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg cursor-pointer transition text-xs border border-gray-700"
                >
                  إلغاء وتراجع ❌
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for Updating License Device IDs (HWID 1 & HWID 2) */}
        {editingHwidLicense && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-md bg-[#090d16] border border-blue-500/40 rounded-2xl p-6 text-right space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-blue-400" /> إدارة وتعديل معرفات الأجهزة (HWID 1 & HWID 2)
                </h3>
                <button
                  onClick={() => { setEditingHwidLicense(null); setHwid1Input(''); setHwid2Input(''); }}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="text-[11px] text-gray-300 space-y-1.5 bg-blue-950/30 p-3 rounded-xl border border-blue-500/20">
                <div>العميل: <span className="text-white font-bold">{editingHwidLicense.customerName}</span></div>
                <div>رقم الهاتف: <span className="text-cyan-400 font-mono font-bold">{editingHwidLicense.phone || 'غير مدخل'}</span></div>
                <div>كود الترخيص: <span className="text-yellow-400 font-mono font-bold">{editingHwidLicense.key}</span></div>
                <div className="text-amber-300 text-[10.5px] pt-1">
                  💡 عند ترك أحد الحقلين فارغاً، يتيح النظام للتطبيق التفعيل والتسجيل التلقائي بالجهاز الجديد وتعبئة الحقل الفارغ فوراً.
                </div>
              </div>

              {/* Field HWID 1 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-gray-300 font-bold block">
                    [ معرف الجهاز الأول HWID 1 ]:
                  </label>
                  <button
                    type="button"
                    onClick={() => setHwid1Input('')}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    🧹 مسح HWID 1
                  </button>
                </div>
                <input
                  type="text"
                  value={hwid1Input}
                  onChange={(e) => setHwid1Input(e.target.value)}
                  placeholder="أدخل بصمة الجهاز الأول أو اتركه فارغاً"
                  className="w-full bg-[#04060b] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-400"
                  autoFocus
                />
              </div>

              {/* Field HWID 2 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-gray-300 font-bold block">
                    [ معرف الجهاز الثاني HWID 2 ]:
                  </label>
                  <button
                    type="button"
                    onClick={() => setHwid2Input('')}
                    className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                  >
                    🧹 مسح HWID 2
                  </button>
                </div>
                <input
                  type="text"
                  value={hwid2Input}
                  onChange={(e) => setHwid2Input(e.target.value)}
                  placeholder="أدخل بصمة الجهاز الثاني أو اتركه فارغاً"
                  className="w-full bg-[#04060b] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1">
                <button
                  type="button"
                  onClick={() => { setHwid1Input(''); setHwid2Input(''); }}
                  className="text-red-400 hover:underline cursor-pointer font-bold"
                >
                  🧹 مسح المعرفين معاً (إتاحة الكود للربط مع أي جهازين جديدين)
                </button>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  disabled={isSavingHwid}
                  onClick={handleUpdateHwid}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg cursor-pointer transition text-xs flex items-center gap-1.5 shadow-lg shadow-blue-900/40"
                >
                  {isSavingHwid ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> حفظ التعديلات 💾
                    </>
                  )}
                </button>
                <button
                  disabled={isSavingHwid}
                  onClick={() => { setEditingHwidLicense(null); setHwid1Input(''); setHwid2Input(''); }}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg cursor-pointer transition text-xs"
                >
                  إلغاء ❌
                </button>
              </div>
            </div>
          </div>
        )}

      {/* 🔄 Renew / Extend License Modal */}
      {renewingLicense && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" dir="rtl">
          <div className="bg-[#0b101d] border border-purple-500/40 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="font-extrabold text-sm text-purple-300 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-purple-400" /> تجديد وتمديد صلاحية الترخيص
              </h3>
              <button
                onClick={() => setRenewingLicense(null)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-gray-300 space-y-1.5 bg-purple-950/30 p-3.5 rounded-xl border border-purple-500/20">
              <div>العميل: <span className="text-white font-bold">{renewingLicense.customerName}</span></div>
              <div>رقم الهاتف: <span className="text-cyan-400 font-mono font-bold">{renewingLicense.phone || 'غير مدخل'}</span></div>
              <div>كود الترخيص: <span className="text-yellow-400 font-mono font-bold">{renewingLicense.key}</span></div>
              <div>التاريخ الحالي للانتهاء: <span className="text-amber-300 font-mono font-bold">{renewingLicense.type === 'lifetime' ? 'دائم (مدى الحياة)' : new Date(renewingLicense.expiresAt).toLocaleDateString('ar-YE')}</span></div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-purple-200 font-bold block">اختر فترة التجديد والتمديد الجديدة:</label>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRenewType('weekly')}
                  className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${
                    renewType === 'weekly' 
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md' 
                      : 'bg-slate-900/80 text-gray-300 border-gray-800 hover:border-purple-500/50'
                  }`}
                >
                  ⚡ أسبوع (7 أيام)
                </button>

                <button
                  type="button"
                  onClick={() => setRenewType('monthly')}
                  className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${
                    renewType === 'monthly' 
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md' 
                      : 'bg-slate-900/80 text-gray-300 border-gray-800 hover:border-purple-500/50'
                  }`}
                >
                  ⚡ شهر (30 يوماً)
                </button>

                <button
                  type="button"
                  onClick={() => setRenewType('yearly')}
                  className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${
                    renewType === 'yearly' 
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md' 
                      : 'bg-slate-900/80 text-gray-300 border-gray-800 hover:border-purple-500/50'
                  }`}
                >
                  ⚡ سنة (365 يوماً)
                </button>

                <button
                  type="button"
                  onClick={() => setRenewType('lifetime')}
                  className={`p-2.5 rounded-xl border font-bold text-center transition cursor-pointer ${
                    renewType === 'lifetime' 
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md' 
                      : 'bg-slate-900/80 text-gray-300 border-gray-800 hover:border-purple-500/50'
                  }`}
                >
                  ⚡ رخصة دائمة (مدى الحياة)
                </button>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setRenewType('custom')}
                  className={`w-full p-2.5 rounded-xl border font-bold text-xs text-center transition cursor-pointer ${
                    renewType === 'custom' 
                      ? 'bg-amber-600 text-black border-amber-400 shadow-md' 
                      : 'bg-slate-900/80 text-amber-300 border-gray-800 hover:border-amber-500/50'
                  }`}
                >
                  ⚙️ تحديد عدد أيام مخصص للتجديد
                </button>

                {renewType === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min={1}
                      max={36500}
                      value={renewCustomDays}
                      onChange={(e) => setRenewCustomDays(Number(e.target.value))}
                      placeholder="أدخل عدد الأيام"
                      className="w-full bg-[#04060b] border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none"
                      autoFocus
                    />
                    <span className="text-xs text-gray-300 font-bold whitespace-nowrap">يوم</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-gray-800">
              <button
                disabled={isRenewing}
                onClick={handlePerformRenewLicense}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl cursor-pointer transition text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40"
              >
                {isRenewing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> جاري التجديد والحفظ...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" /> تأكيد التجديد وتمديد الترخيص 🚀
                  </>
                )}
              </button>
              <button
                onClick={() => setRenewingLicense(null)}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl cursor-pointer transition text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
