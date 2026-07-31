import React, { useState } from 'react';
import { 
  Home, 
  ShoppingCart, 
  Users, 
  Package, 
  BarChart3, 
  Plus, 
  Menu, 
  Bell 
} from 'lucide-react';

interface NativeLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onFabClick?: () => void;
}

export const NativeLayout: React.FC<NativeLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  onFabClick,
}) => {
  const navItems = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'pos', label: 'المبيعات', icon: ShoppingCart },
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'inventory', label: 'المخزن', icon: Package },
    { id: 'reports', label: 'التقارير', icon: BarChart3 },
  ];

  const getTitle = () => {
    switch (activeTab) {
      case 'pos': return 'نقطة البيع (POS)';
      case 'customers': return 'إدارة العملاء والديون';
      case 'inventory': return 'المخزن والبضائع';
      case 'reports': return 'التقارير والتحليلات';
      default: return 'نظام سند المحاسبي';
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 select-none overflow-hidden font-sans dir-rtl" dir="rtl">
      
      {/* 1. Android Native Top App Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 tracking-wide">
            {getTitle()}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </header>

      {/* 2. Main Screen Content Container */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {children}
      </main>

      {/* 3. Android Native Floating Action Button (FAB) */}
      <button
        onClick={onFabClick}
        className="fixed bottom-20 left-5 z-40 bg-blue-600 active:bg-blue-700 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center transition-transform active:scale-95 touch-none"
        aria-label="إضافة جديد"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* 4. Android Native Bottom Navigation Bar */}
      <nav className="h-16 bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 group"
            >
              <div
                className={`px-4 py-1 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'text-slate-500 group-active:scale-90'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span
                className={`text-[11px] mt-0.5 transition-colors ${
                  isActive ? 'text-blue-700 font-bold' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

    </div>
  );
};
