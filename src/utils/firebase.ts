/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  setLogLevel,
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  collection, 
  deleteDoc 
} from 'firebase/firestore';

export interface CloudLicense {
  key: string;
  hwid: string;
  hwid1?: string;
  hwid2?: string;
  boundHwids?: string[];
  maxDevices?: number;
  customerName: string;
  phone?: string;
  createdAt?: string;
  expiresAt: string;
  type: 'monthly' | 'yearly' | 'lifetime' | 'trial';
  status: 'active' | 'suspended';
}

export function isFirebaseConfigured(): boolean {
  const env = (import.meta as any).env || {};
  const apiKey = env.VITE_FIREBASE_API_KEY || "";
  return Boolean(apiKey && !apiKey.includes("...") && apiKey.trim().length > 10);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Warning: ', JSON.stringify(errInfo));
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('FIRESTORE_TIMEOUT'));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

let firestoreDb: any = null;

export function getFirestoreDb() {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!firestoreDb) {
    try {
      const env = (import.meta as any).env || {};
      
      const firebaseConfig = {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "abdh-518ab.firebaseapp.com",
        projectId: env.VITE_FIREBASE_PROJECT_ID || "abdh-518ab",
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "abdh-518ab.firebasestorage.app",
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "40431201753",
        appId: env.VITE_FIREBASE_APP_ID || "1:40431201753:web:a742664467cd92cdfbdc8"
      };

      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      
      try {
        setLogLevel('silent');
      } catch (e) {}

      try {
        firestoreDb = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          }),
          experimentalForceLongPolling: true
        });
      } catch (persistenceError) {
        firestoreDb = getFirestore(app);
      }
    } catch (e) {
      return null;
    }
  }
  return firestoreDb;
}

const MOCK_DB_KEY = 'smart_accounting_central_license_db';

const getMockDb = (): { [key: string]: CloudLicense } => {
  const localDb = localStorage.getItem(MOCK_DB_KEY);
  if (localDb) {
    try {
      return JSON.parse(localDb);
    } catch {}
  }

  const initialDb: { [key: string]: CloudLicense } = {
    'MHTM-7771-4020-9111': {
      key: 'MHTM-7771-4020-9111',
      hwid: '',
      customerName: 'تجربة - سوبر ماركت الهدى',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'monthly',
      status: 'active'
    },
    'MHTY-2026-HAPPY-YEAR': {
      key: 'MHTY-2026-HAPPY-YEAR',
      hwid: '',
      customerName: 'مركز الاتصالات اليمني الموحد',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'yearly',
      status: 'active'
    },
    'MHTL-ADMIN-LIFETIME-GOLD': {
      key: 'MHTL-ADMIN-LIFETIME-GOLD',
      hwid: '',
      customerName: 'مؤسسة المحواشي للبرمجيات',
      expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'lifetime',
      status: 'active'
    },
    'MHTT-TRIAL-7DAY-FREE': {
      key: 'MHTT-TRIAL-7DAY-FREE',
      hwid: '',
      customerName: 'نسخة تجريبية مؤقتة (7 أيام)',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'trial',
      status: 'active'
    }
  };
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(initialDb));
  return initialDb;
};

const saveMockDb = (db: { [key: string]: CloudLicense }) => {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
};

export function normalizeHWID(hwid: string | undefined | null): string {
  if (!hwid) return '';
  return hwid.toString().replace(/^MHT-HWID-/i, '').replace(/\s+/g, '').toUpperCase().trim();
}

export function isUnboundHwid(hwid: string | undefined | null): boolean {
  const norm = normalizeHWID(hwid);
  return norm === '' || norm === 'TRIAL' || norm === 'FREE' || norm === 'UNBOUND';
}

export function getLicenseHwidSlots(license: CloudLicense): { hwid1: string; hwid2: string } {
  let h1 = (license.hwid1 || '').trim();
  let h2 = (license.hwid2 || '').trim();

  if (!h1 && !h2) {
    if (license.boundHwids && license.boundHwids.length > 0) {
      h1 = (license.boundHwids[0] || '').trim();
      h2 = (license.boundHwids[1] || '').trim();
    } else if (license.hwid) {
      const parts = license.hwid.split(',').map(s => s.trim());
      h1 = parts[0] || '';
      h2 = parts[1] || '';
    }
  }

  return { hwid1: h1, hwid2: h2 };
}

export function getBoundHwids(license: CloudLicense): string[] {
  const set = new Set<string>();
  const { hwid1, hwid2 } = getLicenseHwidSlots(license);
  
  if (hwid1 && !isUnboundHwid(hwid1)) set.add(normalizeHWID(hwid1));
  if (hwid2 && !isUnboundHwid(hwid2)) set.add(normalizeHWID(hwid2));

  return Array.from(set);
}

// 🎯 1. دالة الفحص المباشر من الفايربيس السحابي
export async function checkLicenseOnCloud(key: string, hwid: string): Promise<{ success: boolean; message: string; data?: CloudLicense }> {
  try {
    const cleanKey = key.trim();
    if (!cleanKey) return { success: false, message: 'KEY_EMPTY' };

    // 1. الكود المجاني المباشر
    if (cleanKey === 'MHTT-TRIAL-7DAY-FREE') {
      return { 
        success: true, 
        message: 'VALID', 
        data: {
          key: 'MHTT-TRIAL-7DAY-FREE',
          customerName: 'نسخة تجريبية مؤقتة (7 أيام)',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'trial',
          status: 'active',
          hwid: hwid
        } 
      };
    }

    // 2. البحث المباشر في Firestore السحابية
    const db = getFirestoreDb();
    if (db) {
      try {
        const docRef = doc(db, 'licenses', cleanKey);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const license = docSnap.data() as CloudLicense;
          if (license.status === 'suspended') {
            return { success: false, message: 'KEY_SUSPENDED', data: license };
          }
          const expiry = new Date(license.expiresAt);
          if (expiry < new Date()) {
            return { success: false, message: 'KEY_EXPIRED', data: license };
          }

          return { success: true, message: 'VALID', data: license };
        }
      } catch (cloudErr) {
        console.warn('Firestore cloud check error:', cloudErr);
      }
    }

    // 3. التراجع للذاكرة المحلية فقط عند انقطاع الشبكة
    const localDb = getMockDb();
    const license = localDb[cleanKey];
    if (license) {
      return { success: true, message: 'VALID', data: license };
    }

    return { success: false, message: 'KEY_NOT_FOUND' };
  } catch (error) {
    console.error('SaaS Verification error:', error);
    return { success: false, message: 'SERVER_ERROR' };
  }
}

// 🎯 2. دالة التفعيل المباشر وتحديث حقول HWID سحابياً فوراً
export async function activateLicenseOnCloud(key: string, hwid: string, customerName?: string, phone?: string): Promise<{ success: boolean; message: string; data?: CloudLicense }> {
  try {
    const cleanKey = key.trim();
    if (!cleanKey) return { success: false, message: 'KEY_EMPTY' };

    const db = getFirestoreDb();

    if (cleanKey === 'MHTT-TRIAL-7DAY-FREE') {
      const trialData: CloudLicense = {
        key: 'MHTT-TRIAL-7DAY-FREE',
        customerName: 'نسخة تجريبية مؤقتة (7 أيام)',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'trial',
        status: 'active',
        hwid: hwid
      };
      return { success: true, message: 'ACTIVATED_SUCCESSFULLY', data: trialData };
    }

    if (db) {
      const docRef = doc(db, 'licenses', cleanKey);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const license = docSnap.data() as CloudLicense;
        if (license.status === 'suspended') {
          return { success: false, message: 'KEY_SUSPENDED' };
        }

        let { hwid1, hwid2 } = getLicenseHwidSlots(license);
        const normCurrent = normalizeHWID(hwid);
        const norm1 = normalizeHWID(hwid1);
        const norm2 = normalizeHWID(hwid2);

        if (normCurrent !== norm1 && normCurrent !== norm2) {
          if (isUnboundHwid(hwid1)) {
            hwid1 = hwid;
          } else if (isUnboundHwid(hwid2)) {
            hwid2 = hwid;
          } else {
            return { 
              success: false, 
              message: 'تم استهلاك الحد المسموح للأجهزة المربوطة بهذا الكود (2/2)' 
            };
          }
        }

        const boundList = [hwid1, hwid2].filter(h => h && !isUnboundHwid(h));
        
        // ربط معرف الجهاز سحابياً وتعديل كافة الحقول
        const updatedLicense: CloudLicense = {
          ...license,
          hwid: boundList.join(','),
          hwid1: hwid1 || hwid,
          hwid2: hwid2 || '',
          boundHwids: boundList.length > 0 ? boundList : [hwid],
          maxDevices: 2,
          customerName: customerName || license.customerName || 'عميل سند',
          phone: phone || license.phone || '',
          status: 'active'
        };

        // تحديث المستند في الفايربيس سحابياً
        await setDoc(docRef, updatedLicense, { merge: true });

        // حفظ نسخة محلية للتسريع المستقبلي
        const localDb = getMockDb();
        localDb[cleanKey] = updatedLicense;
        saveMockDb(localDb);

        return { success: true, message: 'ACTIVATED_SUCCESSFULLY', data: updatedLicense };
      }
    }

    return { success: false, message: 'KEY_NOT_FOUND' };
  } catch (error) {
    console.error('SaaS Activation error:', error);
    return { success: false, message: 'SERVER_ERROR' };
  }
}

export async function createLicenseOnCloud(key: string, license: CloudLicense): Promise<boolean> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        await withTimeout(setDoc(doc(db, 'licenses', key), license), 2000);
        return true;
      } catch (cloudErr) {}
    }

    const localDb = getMockDb();
    localDb[key] = license;
    saveMockDb(localDb);
    return true;
  } catch (error) {
    return false;
  }
}

export async function getAllLicensesFromCloud(): Promise<CloudLicense[]> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        const querySnapshot = await withTimeout(getDocs(collection(db, 'licenses')), 2000);
        const licenses: CloudLicense[] = [];
        querySnapshot.forEach((doc) => {
          licenses.push(doc.data() as CloudLicense);
        });
        if (licenses.length > 0) return licenses;
      } catch (cloudErr) {}
    }

    const localDb = getMockDb();
    return Object.values(localDb);
  } catch (error) {
    const localDb = getMockDb();
    return Object.values(localDb);
  }
}

export async function deleteLicenseFromCloud(key: string): Promise<boolean> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        await Promise.allSettled([
          withTimeout(deleteDoc(doc(db, 'licenses', key)), 2500),
          withTimeout(deleteDoc(doc(db, 'stores', key)), 2500)
        ]);
        const localDb = getMockDb();
        delete localDb[key];
        saveMockDb(localDb);
        return true;
      } catch (cloudErr) {}
    }

    const localDb = getMockDb();
    delete localDb[key];
    saveMockDb(localDb);
    return true;
  } catch (error) {
    return false;
  }
}

export async function updateLicenseHwidsOnCloud(key: string, newHwid1: string, newHwid2: string): Promise<boolean> {
  try {
    const h1 = newHwid1.trim();
    const h2 = newHwid2.trim();
    const boundList = [h1, h2].filter(h => h && !isUnboundHwid(h));
    const combinedHwid = boundList.join(',');

    const db = getFirestoreDb();
    if (db) {
      try {
        const docRef = doc(db, 'licenses', key);
        const docSnap = await withTimeout(getDoc(docRef), 2000);
        if (docSnap.exists()) {
          const current = docSnap.data() as CloudLicense;
          await withTimeout(setDoc(docRef, { 
            ...current, 
            hwid1: h1, 
            hwid2: h2, 
            hwid: combinedHwid, 
            boundHwids: boundList,
            maxDevices: 2
          }), 2000);
          return true;
        }
      } catch (cloudErr) {}
    }

    const localDb = getMockDb();
    if (localDb[key]) {
      localDb[key].hwid1 = h1;
      localDb[key].hwid2 = h2;
      localDb[key].hwid = combinedHwid;
      localDb[key].boundHwids = boundList;
      localDb[key].maxDevices = 2;
      saveMockDb(localDb);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

export async function updateLicenseHwidOnCloud(key: string, newHwid: string): Promise<boolean> {
  const parts = newHwid.split(',').map(s => s.trim());
  return updateLicenseHwidsOnCloud(key, parts[0] || '', parts[1] || '');
}

export async function findLicenseByHwid(hwid: string): Promise<CloudLicense | null> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        const querySnapshot = await withTimeout(getDocs(collection(db, 'licenses')), 2000);
        let matched: CloudLicense | null = null;
        querySnapshot.forEach((doc) => {
          const data = doc.data() as CloudLicense;
          if (normalizeHWID(data.hwid) === normalizeHWID(hwid)) {
            matched = data;
          }
        });
        if (matched) return matched;
      } catch (cloudErr) {}
    }

    const localDb = getMockDb();
    const licenses = Object.values(localDb);
    const matched = licenses.find(l => normalizeHWID(l.hwid) === normalizeHWID(hwid));
    return matched || null;
  } catch (error) {
    return null;
  }
}

export async function resetCloudData(): Promise<{ success: boolean; deletedCount: number; message?: string }> {
  try {
    const db = getFirestoreDb();
    let count = 0;

    const collectionsToReset = [
      'products', 'sales', 'purchases', 'customers', 'suppliers',
      'invoices', 'payments', 'transactions', 'maintenanceOrders', 'maintenance'
    ];

    if (db) {
      for (const colName of collectionsToReset) {
        try {
          const colRef = collection(db, colName);
          const snap = await withTimeout(getDocs(colRef), 2000);
          for (const docSnap of snap.docs) {
            await withTimeout(deleteDoc(doc(db, colName, docSnap.id)), 2000);
            count++;
          }
        } catch (e) {}
      }
    }

    localStorage.removeItem('smart_accounting_products');
    localStorage.removeItem('smart_accounting_customers');
    localStorage.removeItem('smart_accounting_invoices');
    localStorage.removeItem('smart_accounting_payments');
    localStorage.removeItem('smart_accounting_transactions');
    localStorage.removeItem('smart_accounting_maintenance');

    return { success: true, deletedCount: count };
  } catch (error: any) {
    return { success: false, deletedCount: 0, message: error?.message || 'فشل التصفير السحابي' };
  }
}

export async function resetClientCloudData(licenseKey: string, hwid?: string): Promise<{ success: boolean; deletedCount: number; message?: string }> {
  try {
    const db = getFirestoreDb();
    let count = 0;

    const collectionsToReset = [
      'products', 'sales', 'purchases', 'customers', 'suppliers',
      'invoices', 'payments', 'transactions', 'maintenanceOrders', 'maintenance'
    ];

    if (db) {
      const storeIdsToReset = [licenseKey];
      if (hwid && hwid !== licenseKey) {
        storeIdsToReset.push(hwid);
      }

      for (const storeId of storeIdsToReset) {
        for (const colName of collectionsToReset) {
          try {
            const subColRef = collection(db, 'stores', storeId, colName);
            const subSnap = await getDocs(subColRef);
            for (const docSnap of subSnap.docs) {
              await deleteDoc(doc(db, 'stores', storeId, colName, docSnap.id));
              count++;
            }
          } catch (e) {}
        }
      }
    }

    localStorage.removeItem('smart_accounting_products');
    localStorage.removeItem('smart_accounting_customers');
    localStorage.removeItem('smart_accounting_invoices');
    localStorage.removeItem('smart_accounting_payments');
    localStorage.removeItem('smart_accounting_transactions');
    localStorage.removeItem('smart_accounting_maintenance');

    return { success: true, deletedCount: count };
  } catch (error: any) {
    return { success: false, deletedCount: 0, message: error?.message || 'فشل تصفير بيانات العميل' };
  }
}
