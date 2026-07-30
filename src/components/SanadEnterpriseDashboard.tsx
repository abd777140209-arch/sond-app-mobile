/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, Database, Download, ShieldCheck, 
  AlertTriangle, CheckCircle, History, RefreshCw, Cpu
} from 'lucide-react';
import { 
  checkEnterpriseAlerts, 
  createAutoBackup, 
  downloadBackupFile, 
  logOwnerAuditAction,
  EnterpriseAlert,
  AuditLogItem
} from '../services/SanadEnterpriseCore';
import { getPendingOfflineRecords } from '../services/SanadOfflineEngine';

export interface SanadEnterpriseDashboardProps {
  inventoryItems?: any[];
}

export const SanadEnterpriseDashboard: React.FC<SanadEnterpriseDashboardProps> = ({
  inventoryItems = []
}) => {
  const [alerts, setAlerts] = useState<EnterpriseAlert[]>([]);
  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  useEffect(() => {
    // 1. فحص التنبيهات فور فتح الشاشة
    const pendingDevices = getPendingOfflineRecords();
    const generatedAlerts = checkEnterpriseAlerts(pendingDevices, inventoryItems);
    setAlerts(generatedAlerts);

    // 2. عمل نسخة احتياطية تلقائية عند فتح الشاشة
    const backupRes = createAutoBackup();
    if (backupRes.success) {
      setBackupStatus(backupRes);
      logOwnerAuditAction('AUTO_BACKUP_CREATED', 'تم إنشاء نسخة احتياطية تلقائية لبيانات ورشة الصيانة');
    }

    // 3. جلب سجل التدقيق
    const logs = JSON.parse(localStorage.getItem('sanad_audit_logs') || '[]');
    setAuditLogs(logs);
  }, [inventoryItems]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-right font-sans space-y-5" style={{ direction: 'rtl' }}>
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-5 rounded-3xl shadow-lg flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>لوحة التحكم والمراقبة والنسخ الاحتياطي - تطبيق سند</span>
          </h1>
          <p className="text-xs text-blue-200">
            تنبيهات حية للأجهزة المتأخرة بالمحل، حماية السجلات، والنسخ الاحتياطي المحلي والتلقائي
          </p>
        </div>
        <div className="hidden sm:flex bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/20 text-xs font-mono font-bold items-center gap-1.5">
          <Cpu className="w-4 h-4 text-amber-300 animate-spin" />
          <span>v5.0 Enterprise</span>
        </div>
      </div>

      {/* 🔹 كارت 1: لوحة التنبيهات الحية */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-base">
            <Bell className="w-5 h-5 animate-bounce" />
            <h2>تنبيهات النظام والمخزون الذكية ({alerts.length})</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            تحديث تلقائي
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>ممتاز! لا توجد أجهزة متأخرة بالورشة أو نقص حاد في قطع الغيار حالياً.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl text-xs border flex items-start gap-3 transition-all ${
                  alert.type === 'danger'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                }`}
              >
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold text-sm">{alert.title}</p>
                  <p className="text-xs leading-relaxed opacity-90">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* 🔹 كارت 2: إدارة النسخ الاحتياطي التلقائي (Auto-Backup) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-base">
              <Database className="w-5 h-5" />
              <h2>النسخ الاحتياطي والنسخ المحلي</h2>
            </div>
            <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
              محمي ومؤمن أوفلاين
            </span>
          </div>

          {backupStatus && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              آخر نسخة احتياطية محلية: <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(backupStatus.lastBackup).toLocaleString('ar-YE')}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => {
                const res = createAutoBackup();
                if (res.success) alert('✅ تم إنشاء النسخة الاحتياطية بذاكرة الهاتف بنجاح!');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-98"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إنشاء نسخة الآن</span>
            </button>

            <button
              onClick={downloadBackupFile}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>تنزيل ملف JSON</span>
            </button>
          </div>
        </div>

        {/* 🔹 كارت 3: سجل تدقيق المالك (Audit Log) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-base">
              <History className="w-5 h-5 text-indigo-500" />
              <h2>سجل تدقيق المالك (Audit Trail)</h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              آخر 100 حركة
            </span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">لا توجد حركات تدقيق مسجلة بالسجل بعد.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
                    <span className="text-indigo-600 dark:text-indigo-400">{log.actionType}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('ar-YE')}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px]">{log.details}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default SanadEnterpriseDashboard;
