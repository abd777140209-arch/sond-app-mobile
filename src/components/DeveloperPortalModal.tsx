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
import { LicenseInfo, generateLicenseKey, getExpiryDate } from '../utils/licensing';
import { isFirebaseConfigured, checkLicenseOnCloud, activateLicenseOnCloud, createLicenseOnCloud, CloudLicense, getAllLicensesFromCloud, deleteLicenseFromCloud, updateLicenseHwidOnCloud, resetCloudData, resetClientCloudData } from '../utils/firebase';

interface DeveloperPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHwid: string;
  onResetCloudComplete?: () => void;
}

export default function DeveloperPortalModal({ isOpen, onClose, currentHwid, onResetCloudComplete }: DeveloperPortalModalProps) {
  const [devPassword, setDevPassword] = useState('');
  const [isDevUnlocked, setIsDevUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCloud, setIsCloud] = useState(false);
  
  // Developer key generator states
  const [genType, setGenType] = useState<'monthly' | 'yearly' | 'lifetime' | 'trial'>('monthly');
  const [genCustomer, setGenCustomer] = useState('');
  const [genPhone, setGenPhone] = useState('');
  const [genHwid, setGenHwid] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [lastGeneratedInfo, setLastGeneratedInfo] = useState<{
    key: string;
    customer: string;
    phone: string;
    type: 'monthly' | 'yearly' | 'lifetime' | 'trial';
    createdAt: string;
    expiresAt: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | null }>({ text: '', type: null });

  // Update Device ID (HWID) modal state
  const [editingHwidLicense, setEditingHwidLicense] = useState<CloudLicense | null>(null);
  const [newHwidInput, setNewHwidInput] = useState('');
  const [isSavingHwid, setIsSavingHwid] = useState(false);

  // Developer keys history list
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

  if (!isOpen) return null;

  // Developer portal unlocking handler
  const handleUnlockDeveloperPortal = (e: React.FormEvent) => {
    e.preventDefault();
    if (devPassword === '1997615' || devPassword === '771234' || devPassword.toLowerCase() === 'admin') {
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

    const newKey = generateLicenseKey(genType);
    const expiresAt = getExpiryDate(genType);
    const createdAt = new Date().toISOString();

    const newLicense: CloudLicense = {
      key: newKey,
      hwid: genHwid.trim(),
      customerName: genCustomer.trim(),
      phone: genPhone.trim(),
      createdAt,
      expiresAt,
      type: genType,
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

  // Developer action: Update License Device ID (HWID)
  const handleUpdateHwid = async () => {
    if (!editingHwidLicense) return;
    setIsSavingHwid(true);
    try {
      const success = await updateLicenseHwidOnCloud(editingHwidLicense.key, newHwidInput.trim());
      if (success) {
        soundManager.playSuccessChime();
        setStatusMessage({
          text: `✓ تم تحديث معرف الجهاز (Device ID) بنجاح للعميل (${editingHwidLicense.customerName})!`,
          type: 'success'
        });
        await handleFetchCloudLicenses();
      } else {
        soundManager.playWarningBeep();
        setStatusMessage({ text: `❌ فشل تحديث معرف الجهاز.`, type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setStatusMessage({ text: `❌ حدث خطأ أثناء تحديث معرف الجهاز.`, type: 'error' });
    } finally {
      setIsSavingHwid(false);
      setEditingHwidLicense(null);
      setNewHwidInput('');
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

  // Developer action: Reset Cloud Data
  const handlePerformResetCloudData = async () => {
    if (resetConfirmText.trim() !== 'تصفير') return;

    setIsResetting(true);
    soundManager.playWarningBeep();

    try {
      const result = await resetCloudData();
      if (result.success) {
        soundManager.playSuccessChime();
        setStatusMessage({
          text: `✓ تم تصفير البيانات السحابية بنجاح!`,
          type: 'success'
        });
        if (onResetCloudComplete) onResetCloudComplete();
      } else {
        setStatusMessage({ text: `❌ حدث خطأ: ${result.message}`, type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage({ text: `❌ حدث خطأ غير متوقع أثناء التصفير.`, type: 'error' });
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
          text: `✓ تم تصفير بيانات العميل (${clientToReset.customerName || clientToReset.key}) بنجاح!`,
          type: 'success'
        });
        if (onResetCloudComplete) onResetCloudComplete();
      } else {
        setStatusMessage({ text: `❌ حدث خطأ أثناء التصفير: ${result.message}`, type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage({ text: `❌ حدث خطأ غير متوقع أثناء تصفير البيانات.`, type: 'error' });
    } finally {
      setIsResettingClient(false);
      setClientToReset(null);
      setClientResetConfirmText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all" dir="rtl">
      <div className="w-full max-w-4xl bg-[#090d16] border border-[#C5A862]/30 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        
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
            <div className="max-w-md mx-auto py-10 space-y-4 text-center">
              <div className="inline-flex p-4 rounded-full bg-slate-900 border border-gray-800">
                <LockKeyhole className="w-10 h-10 text-amber-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-200">التحقق من هوية مطور البرنامج</h3>
              <p className="text-[11px] text-gray-400 leading-relaxed max-w-sm mx-auto">
                هذه البوابة مخصصة حصرياً للمبرمج عبدالمجيد المحواشي لتوليد أكواد التراخيص السحابية وإدارة الأجهزة.
              </p>
              
              <form onSubmit={handleUnlockDeveloperPortal} className="flex gap-2 text-xs pt-2">
                <input
                  type="password"
                  required
                  placeholder="أدخل الرمز السري للمطور"
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  className="flex-1 bg-[#04060b] border border-gray-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#C5A862] text-center font-mono tracking-widest"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-black rounded-lg cursor-pointer transition font-bold text-xs"
                >
                  تأكيد الهوية 🔐
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              
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
                    <select
                      value={genType}
                      onChange={(e) => setGenType(e.target.value as any)}
                      className="w-full bg-[#04060b] border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C5A862]"
                    >
                      <option value="trial">تجريبي (7 أيام)</option>
                      <option value="monthly">شهري (30 يوماً)</option>
                      <option value="yearly">سنوي (365 يوماً)</option>
                      <option value="lifetime">رخصة دائمة (مدى الحياة)</option>
                    </select>
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
                    </div>
                  </div>
                )}
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
                              لا توجد تراخيص مسجلة في السجل حالياً.
                            </td>
                          </tr>
                        ) : (
                          Object.values(allLicenseKeys).map((lk: any) => {
                            return (
                              <tr key={lk.key} className="hover:bg-slate-900/60 transition">
                                <td className="p-3 text-white font-bold">{lk.customerName}</td>
                                <td className="p-3 text-cyan-300 font-mono">{lk.phone || 'غير مدخل'}</td>
                                <td className="p-3 text-yellow-400 font-bold font-mono select-all">{lk.key}</td>
                                <td className="p-3 text-green-400 font-mono">{lk.hwid || '⏳ غير مربوط'}</td>
                                <td className="p-3 text-gray-300">
                                  {lk.type === 'lifetime' ? 'صلاحية دائمة' : new Date(lk.expiresAt).toLocaleDateString('ar-YE')}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    <button
                                      onClick={() => {
                                        soundManager.playSuccessChime();
                                        setEditingHwidLicense(lk);
                                        setNewHwidInput(lk.hwid || '');
                                      }}
                                      className="px-2 py-1 rounded bg-blue-950/80 hover:bg-blue-900 text-blue-300 text-[10px] font-bold"
                                    >
                                      تعديل Device ID
                                    </button>

                                    <button
                                      onClick={() => handleDeleteLicenseKey(lk.key)}
                                      className="p-1 rounded-lg text-red-400 hover:bg-red-950/40"
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

            </div>
          )}

        </div>

        {/* Footer Credit */}
        <div className="p-4 border-t border-gray-800 text-center text-[10px] text-gray-500 bg-[#070b13]">
          بوابة الإدارة السحابية المركزية الذكية • مبرمج النظام عبدالمجيد المحواشي © 2026
        </div>

      </div>
    </div>
  );
}
