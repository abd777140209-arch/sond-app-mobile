/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 💾 Sanad Offline & Sync Engine
 * محرك التخزين المحلي (LocalStorage / IndexedDB) والمزامنة التلقائية عند عودة الاتصال
 */

export interface OfflineDeviceRecord {
  local_id: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  imei?: string;
  serviceType: 'hardware' | 'software' | 'both';
  problemDescription: string;
  estimatedCost: number | string;
  advancePayment: number | string;
  created_at: string;
  synced: boolean;
}

const STORAGE_KEY_PENDING_DEVICES = 'sanad_pending_devices_offline';

/**
 * 0. التحقق السريع من توفر الاتصال بالإنترنت
 */
export const isOnline = (): boolean => {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
};

/**
 * 0.1 حظر كافة الطلبات المباشرة لـ Firestore أوفلاين لمنع ظهور أخطاء GET firestore.googleapis.com
 */
export const isFirestoreNetworkAllowed = (): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.log('[OfflineEngine] Firestore network request blocked because device is offline (navigator.onLine === false)');
    return false;
  }
  return true;
};

/**
 * 0.2 الاستماع لتغيرات حالة شبكة الاتصال وتنبيه المكونات
 */
export const onNetworkStatusChange = (callback: (online: boolean) => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/**
 * 0.2 تغليف آمن لطلبات الشبكة يمنع أخطاء net::ERR_INTERNET_DISCONNECTED
 */
export const safeOfflineFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data?: any; isOffline: boolean; error?: string }> => {
  if (!isOnline()) {
    console.warn('[OfflineEngine] تم إلغاء طلب الشبكة لأن الجهاز في وضع الأوفلاين (navigator.onLine = false)');
    return {
      ok: false,
      status: 0,
      isOffline: true,
      error: 'الجهاز أوفلاين (غير متصل بالإنترنت)'
    };
  }

  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type');
    let data = null;
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      isOffline: false
    };
  } catch (err: any) {
    console.warn('[OfflineEngine] تعذر الاتصال بالشبكة:', err?.message || err);
    return {
      ok: false,
      status: 0,
      isOffline: true,
      error: err?.message || 'فشل الاتصال بالشبكة'
    };
  }
};

/**
 * 1. حفظ كارت استلام جهاز محلياً عند عدم توفر اتصال بالشبكة
 */
export const saveDeviceReceiptOffline = (deviceData: Omit<OfflineDeviceRecord, 'local_id' | 'created_at' | 'synced'>) => {
  try {
    const existingStr = localStorage.getItem(STORAGE_KEY_PENDING_DEVICES);
    let existing: OfflineDeviceRecord[] = [];
    
    if (existingStr) {
      try {
        existing = JSON.parse(existingStr);
      } catch (e) {
        existing = [];
      }
    }

    const offlineRecord: OfflineDeviceRecord = {
      ...deviceData,
      local_id: `OFFLINE-${Date.now()}`,
      created_at: new Date().toISOString(),
      synced: false
    };

    existing.push(offlineRecord);
    localStorage.setItem(STORAGE_KEY_PENDING_DEVICES, JSON.stringify(existing));

    return {
      success: true,
      ticket_id: offlineRecord.local_id,
      isOffline: true,
      record: offlineRecord,
      message: 'تم الحفظ محلياً (أوفلاين) وسيتم المزامنة تلقائياً عند عودة الإنترنت'
    };
  } catch (error) {
    console.error('Error saving offline:', error);
    return { 
      success: false, 
      ticket_id: `OFFLINE-${Date.now()}`,
      message: 'فشل الحفظ المحلي في ذاكرة الهاتف' 
    };
  }
};

/**
 * 2. جلب كافة الكروت والأوامر المعلقة غير المزامنة
 */
export const getPendingOfflineRecords = (): OfflineDeviceRecord[] => {
  try {
    const existingStr = localStorage.getItem(STORAGE_KEY_PENDING_DEVICES);
    return existingStr ? JSON.parse(existingStr) : [];
  } catch (err) {
    console.error('Error getting pending records:', err);
    return [];
  }
};

/**
 * 3. مزامنة البيانات المخزنة أوفلاين مع السيرفر تلقائياً عند عودة الإنترنت بدون تعليق الواجهة
 */
export const syncOfflineDataWithServer = async (
  apiBaseUrl: string, 
  token: string
): Promise<{ syncedCount: number; remainingCount: number }> => {
  const pendingRecords = getPendingOfflineRecords();

  if (!pendingRecords || pendingRecords.length === 0) {
    return { syncedCount: 0, remainingCount: 0 };
  }

  // إذا كان الجهاز يعمل أوفلاين، عدم إجراء أي طلبات شبكة لمنع أخطاء ERR_INTERNET_DISCONNECTED
  if (!isOnline()) {
    console.log('📱 الوضع الحالي أوفلاين (بدون إنترنت) - تم تأجيل المزامنة والحفاظ على البيانات محلياً.');
    return { syncedCount: 0, remainingCount: pendingRecords.length };
  }

  if (!apiBaseUrl) {
    console.log('ملاحظة: السيرفر غير معرف، البيانات محفوظة محلياً بنجاح.');
    return { syncedCount: 0, remainingCount: pendingRecords.length };
  }

  console.log(`🔄 جاري مزامنة ${pendingRecords.length} كارت صيانة مخزن أوفلاين مع السيرفر...`);

  let syncedCount = 0;
  const remainingRecords: OfflineDeviceRecord[] = [];

  for (const record of pendingRecords) {
    if (!isOnline()) {
      remainingRecords.push(record);
      continue;
    }

    try {
      // إدخال مهلة زمنية (Timeout 3 ثوانٍ) لمنع تجمد التطبيق عند بطء الشبكة
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${apiBaseUrl}/api/service/create-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(record),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        syncedCount++;
      } else {
        remainingRecords.push(record);
      }
    } catch (error) {
      console.warn('فشلت المزامنة للكارت، وسيستمر التخزين المحلي:', record.local_id);
      remainingRecords.push(record);
    }
  }

  // تحديث السجل بالأوامر المتبقية
  localStorage.setItem(STORAGE_KEY_PENDING_DEVICES, JSON.stringify(remainingRecords));

  return { syncedCount, remainingCount: remainingRecords.length };
};

/**
 * 4. مسح السجلات المعلقة يدوياً
 */
export const clearPendingRecords = (): void => {
  localStorage.removeItem(STORAGE_KEY_PENDING_DEVICES);
};
