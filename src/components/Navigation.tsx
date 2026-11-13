/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  History, 
  BarChart3, 
  Settings as SettingsIcon, 
  Wrench, 
  Briefcase, 
  ClipboardCheck, 
  Menu, 
  X, 
  LogOut, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Shield,
  Sparkles,
  Coins,
  Smartphone,
  Bot,
  Printer,
  Monitor,
  Bell
} from 'lucide-react';
import { SystemSettings, MaintenanceOrder, Product, UserAccount } from '../types';
import { soundManager } from '../utils/sound';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  handleTabSelect: (tab: string) => void;
  settings: SystemSettings;
  products: Product[];
  maintenanceOrders: MaintenanceOrder[];
  isCashierMode: boolean;
  setIsCashierMode: React.Dispatch<React.SetStateAction<boolean>>;
  isPrivacyMode: boolean;
  setIsPrivacyMode: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPinCheckModal: (show: boolean) => void;
  setShowPrivacyPinModal: (show: boolean) => void;
  handleLogout: () => void;
  currentUser?: UserAccount;
  users?: UserAccount[];
  setCurrentUser?: (user: UserAccount) => void;
  onToggleDeviceMode?: () => void;
  externalMenuOpen?: boolean;
  setExternalMenuOpen?: (open: boolean) => void;
}

interface NavItemConfig {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'blue' | 'emerald' | 'sky' | 'purple' | 'amber' | 'orange' | 'teal' | 'rose' | 'indigo' | 'slate';
  badgeCount?: number;
  protected?: boolean;
}

interface NavGroupConfig {
  title: string;
  items: NavItemConfig[];
}

export default function Navigation({
  activeTab,
  setActiveTab,
  handleTabSelect,
  settings,
  products,
  maintenanceOrders,
  isCashierMode,
  setIsCashierMode,
  isPrivacyMode,
  setIsPrivacyMode,
  setShowPinCheckModal,
  setShowPrivacyPinModal,
  handleLogout,
  currentUser,
  onToggleDeviceMode,
  externalMenuOpen,
  setExternalMenuOpen
}: NavigationProps) {
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const isMoreMenuOpen = externalMenuOpen !== undefined ? externalMenuOpen : internalMenuOpen;
  const setIsMoreMenuOpen = setExternalMenuOpen || setInternalMenuOpen;

  const deviceMode = settings.deviceMode || 'mobile';
  const isMobileView = deviceMode === 'mobile';

  // Counts for real operational badges
  const lowStockCount = products.filter(p => p.stock <= p.minStock && p.isDeleted !== true).length;
  const activeMaintenanceCount = maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length;

  const isTabAllowed = (tabId: string) => {
    if (!currentUser) return true;
    const role = currentUser.role;
    if (role === 'admin') return true;
    if (role === 'cashier') return ['dashboard', 'pos', 'customers', 'transactions', 'maintenance', 'device_receipt'].includes(tabId);
    if (role === 'technician') return ['dashboard', 'maintenance', 'device_receipt', 'diagnostic', 'inventory'].includes(tabId);
    if (role === 'accountant') return ['dashboard', 'customers', 'inventory', 'transactions', 'reports', 'stock_audit', 'phone_ledger', 'employees', 'enterprise_dashboard'].includes(tabId);
    return true;
  };

  const navGroups: NavGroupConfig[] = [
    {
      title: 'العمليات اليومية والبيع',
      items: [
        {
          id: 'dashboard',
          label: 'الرئيسية والملخص',
          sublabel: 'المؤشرات المالية المباشرة والوصول السريع',
          icon: LayoutDashboard,
          accent: 'blue'
        },
        {
          id: 'pos',
          label: 'نقطة البيع (POS)',
          sublabel: 'إصدار فواتير المبيعات النقدية والآجلة',
          icon: ShoppingCart,
          accent: 'emerald'
        },
        {
          id: 'transactions',
          label: 'اليومية والسندات',
          sublabel: 'سندات القبض والصرف والمشتريات والصندوق',
          icon: History,
          accent: 'blue'
        },
        {
          id: 'customers',
          label: 'العملاء والديون',
          sublabel: 'حسابات العملاء، الذمم، وكشوف المطالبة',
          icon: Users,
          accent: 'sky'
        }
      ]
    },
    {
      title: 'المخزون والمستودع',
      items: [
        {
          id: 'inventory',
          label: 'المخزن والأصناف',
          sublabel: 'إدارة البضائع، الأسعار، والكميات',
          icon: Package,
          accent: 'purple',
          badgeCount: lowStockCount
        },
        {
          id: 'stock_audit',
          label: 'جرد وحصر المنشأة',
          sublabel: 'مطابقة وتسوية المخزون الفعلي',
          icon: ClipboardCheck,
          accent: 'amber'
        },
        {
          id: 'diagnostic',
          label: 'التشخيص والمخزون الذكي',
          sublabel: 'فحص الأعطال وربط قطع الغيار بالمخزن',
          icon: Sparkles,
          accent: 'indigo'
        }
      ]
    },
    {
      title: 'الصيانة والورشة',
      items: [
        {
          id: 'maintenance',
          label: 'قسم الصيانة والبرمجة',
          sublabel: 'متابعة أوامر الصيانة وحالة الأجهزة',
          icon: Wrench,
          accent: 'orange',
          badgeCount: activeMaintenanceCount
        },
        {
          id: 'device_receipt',
          label: 'استلام جهاز صيانة',
          sublabel: 'توثيق وطباعة كارت استلام جهاز للعميل',
          icon: Smartphone,
          accent: 'blue'
        }
      ]
    },
    {
      title: 'الحسابات والإدارة والإعدادات',
      items: [
        {
          id: 'reports',
          label: 'الأرباح والتقارير المالية',
          sublabel: 'صافي الربح وتقارير المبيعات والمصاريف',
          icon: BarChart3,
          accent: 'rose',
          protected: true
        },
        {
          id: 'phone_ledger',
          label: 'دفتر العملات والحسابات',
          sublabel: 'تعدد العملات وكشوف الحسابات السريعة',
          icon: Coins,
          accent: 'emerald'
        },
        {
          id: 'employees',
          label: 'العمال والرواتب',
          sublabel: 'إدارة الموظفين، السلف، وصرف الرواتب',
          icon: Briefcase,
          accent: 'teal'
        },
        {
          id: 'printer_settings',
          label: 'ضبط الطابعة والفواتير',
          sublabel: 'تخصيص تصميم الفاتورة وإعداد الطابعة',
          icon: Printer,
          accent: 'blue'
        },
        {
          id: 'users',
          label: 'المستخدمين والصلاحيات',
          sublabel: 'إدارة الحسابات وسجل الرقابة (Audit)',
          icon: Shield,
          accent: 'purple',
          protected: true
        },
        {
          id: 'assistant',
          label: 'المساعد الذكي (سند AI)',
          sublabel: 'الأوامر الصوتية والاستعلام المحاسبي',
          icon: Bot,
          accent: 'blue'
        },
        {
          id: 'enterprise_dashboard',
          label: 'مركز التنبيهات والنسخ',
          sublabel: 'مراقبة الورشة والنواقص والنسخ التلقائي لـ Drive',
          icon: Bell,
          accent: 'amber'
        },
        {
          id: 'settings',
          label: 'إعدادات النظام والنسخ',
          sublabel: 'بيانات المتجر، المظهر، والنسخ الاحتياطي',
          icon: SettingsIcon,
          accent: 'slate',
          protected: true
        }
      ]
    }
  ];

  const filteredGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => isTabAllowed(item.id))
    }))
    .filter(group => group.items.length > 0);

  const onNavigateAndCloseDrawer = (tabId: string) => {
    setIsMoreMenuOpen(false);
    setConfirmingLogout(false);
    if (tabId === 'dashboard' || tabId === 'pos') {
      soundManager.playScanBeep();
      setActiveTab(tabId);
    } else {
      handleTabSelect(tabId);
    }
  };

  const accentStyles: Record<NavItemConfig['accent'], { activeRow: string; activeIcon: string; idleIcon: string }> = {
    blue: {
      activeRow: 'bg-blue-50 text-blue-950 font-bold border-r-4 border-blue-600',
      activeIcon: 'bg-blue-600 text-white',
      idleIcon: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
    },
    emerald: {
      activeRow: 'bg-emerald-50 text-emerald-950 font-bold border-r-4 border-emerald-600',
      activeIcon: 'bg-emerald-600 text-white',
      idleIcon: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
    },
    sky: {
      activeRow: 'bg-sky-50 text-sky-950 font-bold border-r-4 border-sky-600',
      activeIcon: 'bg-sky-600 text-white',
      idleIcon: 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white'
    },
    purple: {
      activeRow: 'bg-purple-50 text-purple-950 font-bold border-r-4 border-purple-600',
      activeIcon: 'bg-purple-600 text-white',
      idleIcon: 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white'
    },
    amber: {
      activeRow: 'bg-amber-50 text-amber-950 font-bold border-r-4 border-amber-600',
      activeIcon: 'bg-amber-600 text-white',
      idleIcon: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white'
    },
    orange: {
      activeRow: 'bg-orange-50 text-orange-950 font-bold border-r-4 border-orange-600',
      activeIcon: 'bg-orange-600 text-white',
      idleIcon: 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
    },
    teal: {
      activeRow: 'bg-teal-50 text-teal-950 font-bold border-r-4 border-teal-600',
      activeIcon: 'bg-teal-600 text-white',
      idleIcon: 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white'
    },
    rose: {
      activeRow: 'bg-rose-50 text-rose-950 font-bold border-r-4 border-rose-600',
      activeIcon: 'bg-rose-600 text-white',
      idleIcon: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'
    },
    indigo: {
      activeRow: 'bg-indigo-50 text-indigo-950 font-bold border-r-4 border-indigo-600',
      activeIcon: 'bg-indigo-600 text-white',
      idleIcon: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
    },
    slate: {
      activeRow: 'bg-slate-100 text-slate-900 font-bold border-r-4 border-slate-700',
      activeIcon: 'bg-slate-700 text-white',
      idleIcon: 'bg-slate-100 text-slate-700 group-hover:bg-slate-700 group-hover:text-white'
    }
  };

  // ============================================================================
  // 1. DESKTOP SIDEBAR NAVIGATION
  // ============================================================================
  if (!isMobileView) {
    return (
      <aside 
        id="desktop_navigation_rail" 
        className="no-print w-64 bg-white border-l border-slate-200 px-3 py-4 flex flex-col justify-between shrink-0 overflow-y-auto"
      >
        <div className="space-y-4">
          {/* Quick Mode Switcher Banner */}
          {onToggleDeviceMode && (
            <div className="px-1">
              <button
                type="button"
                onClick={onToggleDeviceMode}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
                title="التبديل السريع إلى واجهة الجوال"
              >
                <span className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-600" />
                  <span>وضع الكمبيوتر نشط</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-blue-600 font-bold">
                  تبديل للجوال 📱
                </span>
              </button>
            </div>
          )}

          {/* Categorized Navigation Groups */}
          {filteredGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-2.5 pb-1">
                <span className="text-[11px] font-extrabold text-slate-400 tracking-wide">
                  {group.title}
                </span>
              </div>
              <nav className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const st = accentStyles[item.accent];
                  return (
                    <button
                      key={item.id}
                      id={`tab_trigger_${item.id}`}
                      onClick={() => onNavigateAndCloseDrawer(item.id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                        isActive
                          ? st.activeRow
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                          isActive ? st.activeIcon : st.idleIcon
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="truncate">{item.label}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badgeCount !== undefined && item.badgeCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-black font-mono tabular-nums bg-amber-500 text-white rounded-md">
                            {item.badgeCount}
                          </span>
                        )}
                        {item.protected && (isCashierMode || settings.isPinEnabled) && (
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Bottom Actions & Inline Logout Confirmation */}
        <div className="pt-4 mt-4 border-t border-slate-200 space-y-2">
          {!confirmingLogout ? (
            <button
              id="sidebar_logout_btn"
              onClick={() => setConfirmingLogout(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer text-right"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>تسجيل الخروج وقفل الجلسة</span>
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <p className="text-[11px] font-bold text-rose-800 text-center">تأكيد تسجيل الخروج من النظام؟</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setConfirmingLogout(false);
                    handleLogout();
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  نعم، خروج
                </button>
                <button
                  onClick={() => setConfirmingLogout(false)}
                  className="flex-1 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // ============================================================================
  // 2. MOBILE BOTTOM BAR (5 Primary Tabs + Categorized Full Drawer)
  // ============================================================================
  const primaryMobileIds = ['dashboard', 'pos', 'transactions', 'customers'];
  const isSecondaryActive = !primaryMobileIds.includes(activeTab);

  return (
    <>
      <nav 
        id="mobile_bottom_nav" 
        className="no-print fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 flex justify-around items-center shadow-lg select-none touch-manipulation"
      >
        {/* 1. الرئيسية */}
        <button
          onClick={() => onNavigateAndCloseDrawer('dashboard')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all flex-1 cursor-pointer ${
            activeTab === 'dashboard' ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          {activeTab === 'dashboard' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-x-1.5 inset-y-1 bg-blue-50 border border-blue-200/80 rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">الرئيسية</span>
        </button>

        {/* 2. نقطة البيع */}
        <button
          onClick={() => onNavigateAndCloseDrawer('pos')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all flex-1 cursor-pointer ${
            activeTab === 'pos' ? 'text-emerald-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          {activeTab === 'pos' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-x-1.5 inset-y-1 bg-emerald-50 border border-emerald-200/80 rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">نقطة البيع</span>
        </button>

        {/* 3. اليومية والسندات */}
        <button
          onClick={() => onNavigateAndCloseDrawer('transactions')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all flex-1 cursor-pointer ${
            activeTab === 'transactions' ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          {activeTab === 'transactions' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-x-1.5 inset-y-1 bg-blue-50 border border-blue-200/80 rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <History className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">السندات</span>
        </button>

        {/* 4. العملاء والديون */}
        <button
          onClick={() => onNavigateAndCloseDrawer('customers')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all flex-1 cursor-pointer ${
            activeTab === 'customers' ? 'text-sky-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          {activeTab === 'customers' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-x-1.5 inset-y-1 bg-sky-50 border border-sky-200/80 rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">العملاء</span>
        </button>

        {/* 5. جميع الأقسام ☰ */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setIsMoreMenuOpen(true);
          }}
          className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all flex-1 cursor-pointer ${
            isSecondaryActive || isMoreMenuOpen
              ? 'text-indigo-700 font-extrabold bg-indigo-50 border border-indigo-200/80'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className="relative">
            <Menu className="w-5 h-5 mb-0.5" />
            {(lowStockCount > 0 || activeMaintenanceCount > 0) && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </div>
          <span className="text-[10px]">الأقسام</span>
        </button>
      </nav>

      {/* Categorized Sections Drawer ("جميع الأقسام") */}
      <AnimatePresence>
        {isMoreMenuOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreMenuOpen(false)}
              className="absolute inset-0"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[85vh] overflow-y-auto text-right"
            >
              {/* Drag Handle */}
              <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                    <Menu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">دليل أقسام النظام الكامل</h3>
                    <p className="text-[11px] text-slate-500">مرتبة حسب طبيعة العمل للوصول السريع</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Device Layout Mode Switcher */}
              {onToggleDeviceMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onToggleDeviceMode();
                  }}
                  className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-blue-600" />
                    <span>التبديل إلى واجهة الكمبيوتر (القائمة الجانبية)</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-bold">
                    وضع الكمبيوتر 💻
                  </span>
                </button>
              )}

              {/* Grouped Sections */}
              <div className="space-y-4">
                {filteredGroups.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-500 px-1">
                      {group.title}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => onNavigateAndCloseDrawer(item.id)}
                            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                              isActive
                                ? 'bg-blue-50/90 border-blue-500 text-blue-950 font-bold'
                                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`p-2 rounded-xl shrink-0 ${
                                isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                              }`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {item.label}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {item.sublabel}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {item.badgeCount !== undefined && item.badgeCount > 0 && (
                                <span className="px-2 py-0.5 text-[10px] font-black font-mono tabular-nums bg-amber-500 text-white rounded-full">
                                  {item.badgeCount}
                                </span>
                              )}
                              {item.protected && (isCashierMode || settings.isPinEnabled) && (
                                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Mobile Controls */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    if (isCashierMode) {
                      setShowPinCheckModal(true);
                    } else {
                      soundManager.playSuccessChime();
                      setIsCashierMode(true);
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    isCashierMode
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  }`}
                >
                  {isCashierMode ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{isCashierMode ? 'وضع الكاشير مقفل' : 'وضع المدير مفتوح'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    if (isPrivacyMode) {
                      if (settings.isPrivacyPinEnabled !== false) {
                        soundManager.playWarningBeep();
                        setShowPrivacyPinModal(true);
                      } else {
                        soundManager.playScanBeep();
                        setIsPrivacyMode(false);
                      }
                    } else {
                      soundManager.playScanBeep();
                      setIsPrivacyMode(true);
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    isPrivacyMode
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{isPrivacyMode ? 'الأرقام مخفية' : 'إخفاء الأرقام'}</span>
                </button>
              </div>

              {/* Inline Logout Confirmation */}
              <div className="pt-1">
                {!confirmingLogout ? (
                  <button
                    onClick={() => setConfirmingLogout(true)}
                    className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج وقفل الجلسة</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                    <p className="text-xs font-bold text-rose-800 text-center">هل تريد بالتأكيد تسجيل الخروج وقفل الجلسة؟</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setConfirmingLogout(false);
                          setIsMoreMenuOpen(false);
                          handleLogout();
                        }}
                        className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                      >
                        تأكيد الخروج
                      </button>
                      <button
                        onClick={() => setConfirmingLogout(false)}
                        className="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        تراجع
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
