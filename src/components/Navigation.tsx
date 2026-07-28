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
  AlertCircle,
  Shield
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
  users,
  setCurrentUser
}: NavigationProps) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const deviceMode = settings.deviceMode || 'mobile';
  const isMobileView = deviceMode === 'mobile';

  // Badges
  const lowStockCount = products.filter(p => p.stock <= p.minStock && p.isDeleted !== true).length;
  const activeMaintenanceCount = maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length;

  const isTabAllowed = (tabId: string) => {
    if (!currentUser) return true;
    const role = currentUser.role;
    if (role === 'admin') return true;
    if (role === 'cashier') return ['pos', 'customers', 'maintenance'].includes(tabId);
    if (role === 'technician') return ['maintenance', 'inventory'].includes(tabId);
    if (role === 'accountant') return ['dashboard', 'customers', 'inventory', 'transactions', 'reports', 'stock_audit'].includes(tabId);
    return true;
  };

  // Secondary options in "More" Drawer for Mobile Mode
  const secondaryTabs = [
    {
      id: 'users',
      label: 'المستخدمين والصلاحيات (Audit)',
      sublabel: 'إدارة أدوار المستخدمين وسجل الأنشطة',
      icon: Shield,
      color: 'purple',
      protected: true
    },
    {
      id: 'employees',
      label: 'قسم العمال والرواتب',
      sublabel: 'إدارة السلف، الرواتب والعمال',
      icon: Briefcase,
      color: 'teal'
    },
    {
      id: 'stock_audit',
      label: 'جرد وحصر المنشأة',
      sublabel: 'مطابقة وتسوية جرد المستودع',
      icon: ClipboardCheck,
      color: 'amber',
      badge: 'مستقل ✨'
    },
    {
      id: 'transactions',
      label: 'القيود والتحصيلات',
      sublabel: 'دفتر المصروفات وأرشيف الحركات',
      icon: History,
      color: 'blue'
    },
    {
      id: 'reports',
      label: 'الأرباح والتقارير البيانية',
      sublabel: 'تحليل الأرباح بالرسم البياني',
      icon: BarChart3,
      color: 'rose',
      protected: true
    },
    {
      id: 'maintenance',
      label: 'قسم الصيانة والبرمجة',
      sublabel: 'كروت الصيانة واستلام الأجهزة',
      icon: Wrench,
      color: 'orange',
      badgeCount: activeMaintenanceCount
    },
    {
      id: 'settings',
      label: 'إعدادات النظام',
      sublabel: 'بيانات النشاط، النسخ والقفل',
      icon: SettingsIcon,
      color: 'slate',
      protected: true
    }
  ].filter(t => isTabAllowed(t.id));

  const onNavigateAndCloseDrawer = (tabId: string) => {
    setIsMoreMenuOpen(false);
    handleTabSelect(tabId);
  };

  // Render Desktop Sidebar Navigation
  if (!isMobileView) {
    return (
      <aside 
        id="desktop_navigation_rail" 
        className="no-print hidden md:block w-64 bg-white border-l border-slate-200 p-4 space-y-2 shrink-0 shadow-sm"
      >
        <div className="flex items-center justify-between px-2 mb-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            القائمة الرئيسية (وضع الكمبيوتر)
          </p>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="النظام نشط" />
        </div>

        <nav className="flex flex-col gap-1.5">
          {/* Dashboard */}
          <button
            id="tab_trigger_dashboard"
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('dashboard');
            }}
            className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
              activeTab === 'dashboard'
                ? 'bg-indigo-50/90 text-indigo-950 font-bold border-r-4 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
            }`}>
              <LayoutDashboard className="w-4 h-4" />
            </div>
            <span>الرئيسية والملخص</span>
          </button>

          {/* POS */}
          <button
            id="tab_trigger_pos"
            onClick={() => {
              soundManager.playScanBeep();
              setActiveTab('pos');
            }}
            className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
              activeTab === 'pos'
                ? 'bg-emerald-50/90 text-emerald-950 font-bold border-r-4 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              activeTab === 'pos'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
            }`}>
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span>شاشة المبيعات (POS)</span>
          </button>

          {/* Inventory */}
          <button
            id="tab_trigger_inventory"
            onClick={() => handleTabSelect('inventory')}
            className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
              activeTab === 'inventory'
                ? 'bg-purple-50/90 text-purple-950 font-bold border-r-4 border-purple-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'inventory'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white'
              }`}>
                <Package className="w-4 h-4" />
              </div>
              <span>المستودع والمخزن</span>
            </div>
            {lowStockCount > 0 && (
              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-500 text-white rounded-full animate-bounce shadow-xs">
                {lowStockCount}
              </span>
            )}
          </button>

          {/* Stock Audit */}
          <button
            id="tab_trigger_stock_audit"
            onClick={() => handleTabSelect('stock_audit')}
            className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
              activeTab === 'stock_audit'
                ? 'bg-amber-50/90 text-amber-950 font-bold border-r-4 border-amber-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'stock_audit'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white'
              }`}>
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <span>جرد وحصر المنشأة</span>
            </div>
            <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 rounded-md">
              مستقل ✨
            </span>
          </button>

          {/* Customers */}
          <button
            id="tab_trigger_customers"
            onClick={() => handleTabSelect('customers')}
            className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
              activeTab === 'customers'
                ? 'bg-sky-50/90 text-sky-950 font-bold border-r-4 border-sky-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              activeTab === 'customers'
                ? 'bg-sky-600 text-white'
                : 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white'
            }`}>
              <Users className="w-4 h-4" />
            </div>
            <span>العملاء والديون (الذمم)</span>
          </button>

          {/* Employees */}
          <button
            id="tab_trigger_employees"
            onClick={() => handleTabSelect('employees')}
            className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
              activeTab === 'employees'
                ? 'bg-teal-50/90 text-teal-950 font-bold border-r-4 border-teal-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              activeTab === 'employees'
                ? 'bg-teal-600 text-white'
                : 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white'
            }`}>
              <Briefcase className="w-4 h-4" />
            </div>
            <span>قسم العمال والرواتب</span>
          </button>

          {/* Transactions */}
          <button
            id="tab_trigger_transactions"
            onClick={() => handleTabSelect('transactions')}
            className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
              activeTab === 'transactions'
                ? 'bg-blue-50/90 text-blue-950 font-bold border-r-4 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              activeTab === 'transactions'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
            }`}>
              <History className="w-4 h-4" />
            </div>
            <span>القيود والتحصيلات</span>
          </button>

          {/* Profit Reports */}
          <button
            id="tab_trigger_reports"
            onClick={() => handleTabSelect('reports')}
            className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
              activeTab === 'reports'
                ? 'bg-rose-50/90 text-rose-950 font-bold border-r-4 border-rose-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'reports'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'
              }`}>
                <BarChart3 className="w-4 h-4" />
              </div>
              <span>الأرباح والتقارير البيانية</span>
            </div>
            {(isCashierMode || settings.isPinEnabled) && (
              <Lock className="w-3.5 h-3.5 text-amber-500" />
            )}
          </button>

          {/* Maintenance */}
          <button
            id="tab_trigger_maintenance"
            onClick={() => handleTabSelect('maintenance')}
            className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
              activeTab === 'maintenance'
                ? 'bg-orange-50/90 text-orange-950 font-bold border-r-4 border-orange-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'maintenance'
                  ? 'bg-orange-600 text-white'
                  : 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
              }`}>
                <Wrench className="w-4 h-4" />
              </div>
              <span>قسم الصيانة والبرمجة</span>
            </div>
            {activeMaintenanceCount > 0 && (
              <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded-full">
                {activeMaintenanceCount}
              </span>
            )}
          </button>

          {/* Users & Roles (Audit Log) */}
          {isTabAllowed('users') && (
            <button
              id="tab_trigger_users"
              onClick={() => handleTabSelect('users')}
              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'users'
                  ? 'bg-purple-50/90 text-purple-950 font-bold border-r-4 border-purple-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  activeTab === 'users'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white'
                }`}>
                  <Shield className="w-4 h-4" />
                </div>
                <span>المستخدمين والصلاحيات (Audit)</span>
              </div>
            </button>
          )}

          {/* Settings */}
          {isTabAllowed('settings') && (
            <button
              id="tab_trigger_settings"
              onClick={() => handleTabSelect('settings')}
              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'settings'
                  ? 'bg-slate-100 text-slate-900 font-bold border-r-4 border-slate-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  activeTab === 'settings'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-700 group-hover:bg-slate-700 group-hover:text-white'
                }`}>
                  <SettingsIcon className="w-4 h-4" />
                </div>
                <span>إعدادات النظام</span>
              </div>
              {(isCashierMode || settings.isPinEnabled) && (
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              )}
            </button>
          )}
        </nav>

        {/* Sidebar Logout button */}
        <div className="pt-2 border-t border-slate-200">
          <button
            id="sidebar_logout_btn"
            onClick={() => {
              if (confirm('⚠️ هل أنت متأكد من رغبتك في تسجيل الخروج وإلغاء ترخيص الجهاز؟')) {
                handleLogout();
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer text-right"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {/* Quick System Info */}
        <div className="p-3.5 mt-6 rounded-2xl bg-slate-50 border border-slate-200 text-[10px] text-slate-500 space-y-1">
          <div className="font-bold text-slate-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-blue-600" /> معلومات النظام
          </div>
          <p>وضع الواجهة: كمبيوتر / تابلت 💻</p>
          <p>المهندس: عبدالمجيد المحواشي</p>
        </div>
      </aside>
    );
  }

  // Render Mobile Bottom Navigation Bar (5 Primary Items + Drawer for More)
  const isSecondaryActive = secondaryTabs.some(t => t.id === activeTab);

  return (
    <>
      {/* 5-Item Bottom Bar */}
      <nav 
        id="mobile_bottom_nav" 
        className="no-print fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex justify-around items-center shadow-2xl select-none"
      >
        {/* 1. الرئيسية */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('dashboard');
          }}
          className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all flex-1 ${
            activeTab === 'dashboard' ? 'text-blue-600 font-extrabold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'dashboard' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200/80 rounded-2xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">الرئيسية</span>
        </button>

        {/* 2. المبيعات */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('pos');
          }}
          className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all flex-1 ${
            activeTab === 'pos' ? 'text-emerald-600 font-extrabold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'pos' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-emerald-50 border border-emerald-200/80 rounded-2xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">المبيعات</span>
        </button>

        {/* 3. الحسابات / العملاء */}
        <button
          onClick={() => handleTabSelect('customers')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all flex-1 ${
            activeTab === 'customers' ? 'text-sky-600 font-extrabold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'customers' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-sky-50 border border-sky-200/80 rounded-2xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">الحسابات</span>
        </button>

        {/* 4. المخزن */}
        <button
          onClick={() => handleTabSelect('inventory')}
          className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all flex-1 ${
            activeTab === 'inventory' ? 'text-purple-600 font-extrabold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'inventory' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-purple-50 border border-purple-200/80 rounded-2xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative">
            <Package className="w-5 h-5 mb-0.5" />
            {lowStockCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 text-[8px] font-black bg-amber-500 text-white rounded-full animate-bounce">
                {lowStockCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">المخزن</span>
        </button>

        {/* 5. المزيد ☰ */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setIsMoreMenuOpen(true);
          }}
          className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all flex-1 ${
            isSecondaryActive || isMoreMenuOpen
              ? 'text-amber-600 font-extrabold bg-amber-50 border border-amber-200/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Menu className="w-5 h-5 mb-0.5" />
            {activeMaintenanceCount > 0 && (
              <span className="absolute -top-1 -right-2 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[10px] flex items-center gap-0.5">
            <span>المزيد</span>
            <span className="text-[8px]">☰</span>
          </span>
        </button>
      </nav>

      {/* Drawer Bottom Sheet Modal for "المزيد ☰" */}
      <AnimatePresence>
        {isMoreMenuOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
            {/* Backdrop Dismiss */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreMenuOpen(false)}
              className="absolute inset-0"
            />

            {/* Sheet Container */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[85vh] overflow-y-auto text-right"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-2" />

              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <Menu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">قائمة الأقسام والخدمات الإضافية</h3>
                    <p className="text-[10px] text-slate-500">اختر القسم للتحويل المباشر إليه</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Secondary Tabs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {secondaryTabs.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigateAndCloseDrawer(item.id)}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-bold'
                          : 'bg-slate-50/80 border-slate-200 text-slate-800 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          isActive ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 shadow-xs'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="text-[8px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 font-extrabold">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] text-slate-500 mt-0.5">{item.sublabel}</div>
                        </div>
                      </div>

                      {item.badgeCount !== undefined && item.badgeCount > 0 && (
                        <span className="px-2 py-0.5 text-[9px] font-black bg-rose-500 text-white rounded-full">
                          {item.badgeCount}
                        </span>
                      )}

                      {item.protected && (isCashierMode || settings.isPinEnabled) && (
                        <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Mobile Tools Bar */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                {/* Cashier Mode */}
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
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                    isCashierMode
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  }`}
                >
                  {isCashierMode ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{isCashierMode ? 'وضع الكاشير 🔐' : 'وضع المدير 🔓'}</span>
                </button>

                {/* Privacy Mode */}
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
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                    isPrivacyMode
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{isPrivacyMode ? 'المبالغ مخفية 👁️‍🗨️' : 'وضع الخصوصية 👁️'}</span>
                </button>
              </div>

              {/* Logout Button */}
              <div className="pt-1">
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    if (confirm('⚠️ هل أنت متأكد من رغبتك في تسجيل الخروج وإلغاء ترخيص الجهاز؟')) {
                      handleLogout();
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج وإلغاء الترخيص</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
