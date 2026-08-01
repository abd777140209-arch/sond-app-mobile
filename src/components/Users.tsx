/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Users as UsersIcon, 
  Shield, 
  UserPlus, 
  Edit3, 
  Trash2, 
  Key, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  History, 
  Clock, 
  Filter, 
  Download, 
  RotateCcw, 
  UserCheck, 
  ChevronRight, 
  Briefcase, 
  Wrench, 
  ShoppingCart, 
  Calculator, 
  Crown,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { UserAccount, UserRole, AuditLog } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';

interface UsersProps {
  users: UserAccount[];
  currentUser: UserAccount;
  setCurrentUser: (user: UserAccount) => void;
  onAddUser: (user: Omit<UserAccount, 'id' | 'createdAt'>) => void;
  onUpdateUser: (id: string, user: Partial<UserAccount>) => void;
  onDeleteUser: (id: string) => void;
  auditLogs: AuditLog[];
  onClearAuditLogs?: () => void;
}

export const ROLE_CONFIGS: Record<UserRole, { label: string; description: string; icon: any; color: string; bg: string; border: string }> = {
  admin: {
    label: 'مدير النظام',
    description: 'صلاحيات كاملة للوصول إلى كافة القوائم، الإعدادات، والتقارير المالية',
    icon: Crown,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200'
  },
  cashier: {
    label: 'كاشير / مبيعات',
    description: 'صلاحية نقطة البيع (POS)، إضافة المبيعات، متابعة ديون العملاء، واستلام طلبات الصيانة',
    icon: ShoppingCart,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200'
  },
  technician: {
    label: 'فني صيانة',
    description: 'صلاحية قسم الورشة والصيانة، تحديث حالة الأجهزة، والاطلاع على المخزون',
    icon: Wrench,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200'
  },
  accountant: {
    label: 'محاسب مالي',
    description: 'صلاحية الاطلاع على التقارير الماليّة، المصروفات والسندات، جرد المنشأة وحسابات العملاء',
    icon: Calculator,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  }
};

export default function Users({
  users,
  currentUser,
  setCurrentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  auditLogs,
  onClearAuditLogs
}: UsersProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('cashier');
  const [formPhone, setFormPhone] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const closeModalAndReset = () => {
    setShowAddModal(false);
    setEditingUser(null);
    setFormName('');
    setFormUsername('');
    setFormPhone('');
    setFormPin('');
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormUsername('');
    setFormRole('cashier');
    setFormPhone('');
    setFormPin('');
    setFormIsActive(true);
    setShowAddModal(true);
  };

  const openEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormRole(user.role);
    setFormPhone(user.phone || '');
    setFormPin(user.pin || '');
    setFormIsActive(user.isActive);
    setShowAddModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim()) {
      soundManager.playWarningBeep();
      alert('يرجى كتابة الاسم واسم المستخدم بشكل صحيح');
      return;
    }

    if (editingUser) {
      onUpdateUser(editingUser.id, {
        name: formName.trim(),
        username: formUsername.trim(),
        role: formRole,
        phone: formPhone.trim(),
        pin: formPin.trim(),
        isActive: formIsActive
      });
      // Update current user if it's the active one
      if (currentUser.id === editingUser.id) {
        setCurrentUser({
          ...currentUser,
          name: formName.trim(),
          username: formUsername.trim(),
          role: formRole,
          phone: formPhone.trim(),
          pin: formPin.trim(),
          isActive: formIsActive
        });
      }
    } else {
      onAddUser({
        name: formName.trim(),
        username: formUsername.trim(),
        role: formRole,
        phone: formPhone.trim(),
        pin: formPin.trim(),
        isActive: formIsActive
      });
    }

    setShowAddModal(false);
    soundManager.playSuccessChime();
  };

  const handleDelete = (id: string, name: string) => {
    if (id === currentUser.id) {
      alert('لا يمكنك حذف المستخدم الحالي القائم بالعمل!');
      return;
    }
    if (window.confirm(`هل أنت تأكد من حذف مستخدم النظام (${name})؟`)) {
      onDeleteUser(id);
      soundManager.playScanBeep();
    }
  };

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.actionLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || log.userRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const exportAuditLogsJSON = async () => {
    soundManager.playSuccessChime();
    const dataStr = JSON.stringify(auditLogs, null, 2);
    const fileName = `sanad_audit_logs_${new Date().toISOString().split('T')[0]}.json`;
    try {
      await saveAndShareFile({
        fileName,
        data: dataStr,
        mimeType: 'application/json',
        title: 'سجل أنشطة نظام سند المحاسبي',
        text: 'ملف سجل التدقيق والأنشطة الإدارية'
      });
    } catch (err) {
      console.warn('Error exporting audit logs JSON:', err);
      alert('⚠️ تعذر تصدير سجل الأنشطة.');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto text-right dir-rtl">
      
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl border border-purple-100">
            <UsersIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">نظام الصلاحيات وسجل الأنشطة (Audit Log)</h1>
            <p className="text-xs text-slate-500 font-medium">إدارة أدوار المستخدمين والموظفين ومراقبة سجل العمليات الإدارية</p>
          </div>
        </div>

        {/* Current Active User Card */}
        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-xs w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-slate-900">{currentUser.name}</div>
              <div className="text-[10px] text-purple-700 font-bold">{ROLE_CONFIGS[currentUser.role]?.label || currentUser.role}</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px]">
            المستخدم الحالي
          </span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex bg-slate-200/60 p-1.5 rounded-2xl w-full sm:w-fit gap-1 text-xs font-bold">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className="w-4 h-4 text-purple-600" />
          <span>إدارة المستخدمين والأدوار ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4 text-blue-600" />
          <span>سجل الأنشطة والعمليات ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: USERS & ROLES */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          
          {/* Roles Legend / Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(ROLE_CONFIGS) as UserRole[]).map(roleKey => {
              const cfg = ROLE_CONFIGS[roleKey];
              const RoleIcon = cfg.icon;
              const count = users.filter(u => u.role === roleKey).length;
              return (
                <div key={roleKey} className={`p-4 rounded-2xl border ${cfg.border} ${cfg.bg} space-y-2`}>
                  <div className="flex justify-between items-center">
                    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${cfg.color} bg-white/80 border border-slate-200`}>
                      {count} مستخدم
                    </span>
                    <RoleIcon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div>
                    <h3 className={`font-black text-sm ${cfg.color}`}>{cfg.label}</h3>
                    <p className="text-[11px] text-slate-600 leading-tight mt-1">{cfg.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <h2 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-slate-600" />
              <span>قائمة حسابات مستخدمي النظام</span>
            </h2>
            <button
              onClick={openAddModal}
              className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة مستخدم جديد</span>
            </button>
          </div>

          {/* Users Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map(user => {
              const cfg = ROLE_CONFIGS[user.role] || ROLE_CONFIGS.cashier;
              const RoleIcon = cfg.icon;
              const isCurrent = user.id === currentUser.id;

              return (
                <div key={user.id} className={`bg-white rounded-3xl border p-5 space-y-4 relative transition hover:shadow-md ${isCurrent ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200'}`}>
                  
                  {/* Top Badge */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl ${cfg.bg} ${cfg.color} border ${cfg.border} font-black flex items-center justify-center text-lg shadow-2xs`}>
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-base">{user.name}</h3>
                        <p className="text-xs text-slate-400 font-mono">@{user.username}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        <RoleIcon className="w-3.5 h-3.5" />
                        <span>{cfg.label}</span>
                      </span>
                      {user.isActive ? (
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> حساب نشط
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> موقف
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details Info */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1.5 font-medium">
                    {user.phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">رقم الهاتف:</span>
                        <span className="font-mono text-slate-800">{user.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">رمز الدخول PIN:</span>
                      <span className="font-mono font-bold text-slate-800">{user.pin ? '••••' : 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">تاريخ الإنشاء:</span>
                      <span className="text-slate-500 font-mono">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : '-'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    {!isCurrent && (
                      <button
                        onClick={() => {
                          setCurrentUser(user);
                          soundManager.playSuccessChime();
                        }}
                        className="flex-1 py-2 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 font-bold text-xs rounded-xl border border-purple-200 transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>التبديل لهذا المستخدم</span>
                      </button>
                    )}

                    {isCurrent && (
                      <div className="flex-1 py-2 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 text-center">
                        ✓ المستخدم النشط حالياً
                      </div>
                    )}

                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="تعديل المستخدم"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      disabled={isCurrent}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="حذف المستخدم"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* TAB 2: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          
          {/* Audit Controls & Filters */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم المستخدم، أو نوع العملية..."
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Filter Role */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">كل الأدوار</option>
                <option value="admin">مدير النظام</option>
                <option value="cashier">كاشير / مبيعات</option>
                <option value="technician">فني صيانة</option>
                <option value="accountant">محاسب مالي</option>
              </select>
            </div>

            {/* Export & Clear */}
            <div className="flex items-center gap-2">
              <button
                onClick={exportAuditLogsJSON}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-slate-200"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>تصدير السجل</span>
              </button>

              {onClearAuditLogs && (
                <button
                  onClick={() => {
                    if (window.confirm('هل أنت تأكد من مسح كافة سجلات الأنشطة الحالية؟')) {
                      onClearAuditLogs();
                      soundManager.playScanBeep();
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح السجل</span>
                </button>
              )}
            </div>

          </div>

          {/* Audit Logs Table / Timeline */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <History className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-bold text-sm">لا توجد سجلات أنشطة مطابقة للبحث</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="py-3 px-4">التاريخ والوقت</th>
                      <th className="py-3 px-4">المستخدم</th>
                      <th className="py-3 px-4">الدور</th>
                      <th className="py-3 px-4">نوع العملية والإجراء</th>
                      <th className="py-3 px-4">تفاصيل إضافية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {filteredAuditLogs.map(log => {
                      const cfg = ROLE_CONFIGS[log.userRole] || ROLE_CONFIGS.cashier;
                      const RoleIcon = cfg.icon;

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {new Date(log.timestamp).toLocaleString('ar-EG')}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {log.userName}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 w-fit ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                              <RoleIcon className="w-3 h-3" />
                              <span>{cfg.label}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4 font-bold text-slate-900">
                            {log.actionLabel}
                          </td>

                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {log.details || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ADD / EDIT USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 text-right relative">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <span>{editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد للنظام'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs font-bold">
              
              <div>
                <label className="text-slate-700 block mb-1">الاسم الكامل للمستخدم / الموظف:</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="مثال: أحمد العلي"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-700 block mb-1">اسم المستخدم (Username):</label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    placeholder="ahmed123"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">رقم الهاتف (اختياري):</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="770000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">دور المستخدم والصلاحيات:</label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 text-slate-900"
                >
                  <option value="admin">مدير النظام (كامل الصلاحيات)</option>
                  <option value="cashier">كاشير / مبيعات (نقطة البيع والديون والعملاء)</option>
                  <option value="technician">فني صيانة (الورشة وجرد المستودع)</option>
                  <option value="accountant">محاسب مالي (التقارير والمصروفات والعملاء)</option>
                </select>
                <p className="text-[10px] text-slate-400 font-normal mt-1">
                  {ROLE_CONFIGS[formRole]?.description}
                </p>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">رمز الدخول PIN السريع (اختياري):</label>
                <input
                  type="password"
                  maxLength={6}
                  value={formPin}
                  onChange={e => setFormPin(e.target.value)}
                  placeholder="مثال: 1234"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={formIsActive}
                  onChange={e => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <label htmlFor="isActiveCheck" className="text-slate-800 cursor-pointer">
                  تفعيل الحساب للعمل في النظام
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer shadow-sm active:scale-95"
                >
                  حفظ البيانات
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
