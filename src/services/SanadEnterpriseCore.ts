/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 🛡️ Sanad Enterprise Core Services
 * نظام التنبيهات الذكية + النسخ الاحتياطي التلقائي وسجل تدقيق المالك (Audit Trail)
 */

export interface EnterpriseAlert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  category: 'delayed_device' | 'low_stock' | 'system';
  title: string;
  message: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actionType: string;
  details: string;
  performedBy: string;
}

const STORAGE_BACKUP_KEY = 'sanad_auto_backups';
const STORAGE_AUDIT_KEY = 'sanad_audit_logs';

/**
 * 1. محرك التنبيهات الذكية للأجهزة المتأخرة ونقص قطع الغيار
 */
export const checkEnterpriseAlerts = (
  pendingDevices: any[] = [], 
  inventoryParts: any[] = []
): EnterpriseAlert[] => {
  const alerts: EnterpriseAlert[] = [];
  const now = new Date();

  // أ) فحص الأجهزة المتأخرة بداخل الورشة (أكثر من 3 أيام)
  pendingDevices.forEach((device) => {
    const createdDate = new Date(device.created_at || device.createdAt || Date.now());
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 3 && device.status !== 'completed' && device.status !== 'delivered') {
      alerts.push({
        id: `alert-dev-${device.local_id || device.id || Math.random()}`,
        type: 'warning',
        category: 'delayed_device',
        title: '⚠️ جهاز متأخر في الورشة',
        message: `الجهاز (${device.deviceModel || 'هاتف'}) للزبون (${device.customerName || 'عميل'}) مضى عليه ${diffDays} أيام دون إنهاء!`
      });
    }
  });

  // ب) فحص نقص قطع الغيار بداخل المخزون (أقل من أو يساوي 2 شاشة/قطعة)
  inventoryParts.forEach((part) => {
    const qty = Number(part.quantity ?? part.stock ?? 0);
    if (qty <= 2) {
      alerts.push({
        id: `alert-part-${part.id || Math.random()}`,
        type: 'danger',
        category: 'low_stock',
        title: '🚨 نقص في قطع الغيار',
        message: `القطعة (${part.name || 'شاشة/قطع غيار'}) وصل مخزونها إلى (${qty}) فقط!`
      });
    }
  });

  return alerts;
};

/**
 * 2. محرك النسخ الاحتياطي التلقائي المشفر محلياً (Auto-Backup Manager)
 */
export const createAutoBackup = () => {
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '5.0-Enterprise',
      pendingDevices: JSON.parse(localStorage.getItem('sanad_pending_devices_offline') || '[]'),
      auditLogs: JSON.parse(localStorage.getItem(STORAGE_AUDIT_KEY) || '[]')
    };

    const backupsHistory = JSON.parse(localStorage.getItem(STORAGE_BACKUP_KEY) || '[]');
    // الاحتفاظ بآخر 5 نسخ احتياطية تلقائية
    backupsHistory.unshift(backupData);
    if (backupsHistory.length > 5) backupsHistory.pop();

    localStorage.setItem(STORAGE_BACKUP_KEY, JSON.stringify(backupsHistory));

    return { success: true, count: backupsHistory.length, lastBackup: backupData.timestamp };
  } catch (error: any) {
    console.error('Auto Backup Error:', error);
    return { success: false, error: error?.message || 'خطأ أثناء النسخ' };
  }
};

/**
 * 3. دالة تصدير النسخة الاحتياطية كملف JSON للتنزيل أو المشاركة
 */
export const downloadBackupFile = () => {
  const backups = localStorage.getItem(STORAGE_BACKUP_KEY);
  if (!backups) {
    alert('لا توجد نسخ احتياطية صادرة بعد.');
    return;
  }

  const blob = new Blob([backups], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sanad_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * 4. سجل تدقيق العمليات لحماية المالك (Audit Log System)
 */
export const logOwnerAuditAction = (
  actionType: string, 
  details: string, 
  performedBy: string = 'System/User'
) => {
  const logs: AuditLogItem[] = JSON.parse(localStorage.getItem(STORAGE_AUDIT_KEY) || '[]');
  const newLog: AuditLogItem = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actionType,
    details,
    performedBy
  };

  logs.unshift(newLog);
  // الاحتفاظ بآخر 100 حركة تدقيق
  if (logs.length > 100) logs.pop();

  localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify(logs));
};
