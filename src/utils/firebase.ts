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
  deleteDoc,
  onSnapshot
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
  type: 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'trial';
  status: 'active' | 'suspended';
}

// Check if Firebase configuration is provided with a valid API key (Multi-tenant stores & SaaS Cloud Sync)
export function isFirebaseConfigured(): boolean {
  const env = (import.meta as any).env || {};
  // 🎯 تضمين المفتاح المباشر لضمان عدم وجود قيمة فارغة عند تجميع تطبيق الـ APK
  const apiKey = env.VITE_FIREBASE_API_KEY || "AIzaSyDLx5jrNwfnsiC972tXEUULMMsDg4TQ6s4";
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

// Helper to race Firestore operations with a short timeout (2500ms) for instant offline fallback
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

// Lazy initialization of Firestore with multi-tab offline persistence
let firestoreDb: any = null;

export function getFirestoreDb() {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!firestoreDb) {
    try {
      const env = (import.meta as any).env || {};
      
      const firebaseConfig = {
        apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDLx5jrNwfnsiC972tXEUULMMsDg4TQ6s4",
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "abdh-518ab.firebaseapp.com",
        databaseURL: "https://abdh-518ab-default-rtdb.europe-west1.firebasedatabase.app",
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
        console.log("Firestore offline persistence and long-polling enabled successfully.");
      } catch (persistenceError) {
        console.warn("Firestore offline persistence fallback to memory cache:", persistenceError);
        firestoreDb = getFirestore(app);
      }
    } catch (e) {
      console.warn("Failed to initialize Firebase:", e);
      return null;
    }
  }
  return firestoreDb;
}

// Fallback Mock database managed locally to provide immediate plug-and-play SaaS experience
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
  } else if (!h2 && license.boundHwids && license.boundHwids.length > 1) {
    h2 = (license.boundHwids[1] || '').trim();
  } else if (!h2 && license.hwid && license.hwid.includes(',')) {
    const parts = license.hwid.split(',').map(s => s.trim());
    if (parts[1]) h2 = parts[1];
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

// Check license key on Cloud / Local Database
export async function checkLicenseOnCloud(key: string, hwid: string): Promise<{ success: boolean; message: string; data?: CloudLicense }> {
  const cleanKey = key ? key.trim().toUpperCase() : '';
  if (!cleanKey) return { success: false, message: 'KEY_EMPTY' };

  try {
    const db = getFirestoreDb();
    const normCurrent = normalizeHWID(hwid);

    if (db) {
      try {
        let docSnap: any = await withTimeout(getDoc(doc(db, 'licenses', cleanKey)), 3500);
        
        if (!docSnap.exists()) {
          try {
            const allDocs = await withTimeout(getDocs(collection(db, 'licenses')), 3500);
            const matchedDoc = allDocs.docs.find(d => d.id.trim().toUpperCase() === cleanKey);
            if (matchedDoc) docSnap = matchedDoc as any;
          } catch (colErr) {
            console.warn('Collection search fallback error:', colErr);
          }
        }

        if (docSnap.exists()) {
          const license = docSnap.data() as CloudLicense;
          if (license.status === 'suspended') {
            return { success: false, message: 'KEY_SUSPENDED', data: license };
          }
          if (license.expiresAt && license.type !== 'lifetime') {
            const expiry = new Date(license.expiresAt);
            if (expiry < new Date()) {
              return { success: false, message: 'KEY_EXPIRED', data: license };
            }
          }

          const { hwid1, hwid2 } = getLicenseHwidSlots(license);
          const norm1 = normalizeHWID(hwid1);
          const norm2 = normalizeHWID(hwid2);

          const isBoundToCurrent = (normCurrent && (
            normCurrent === norm1 || 
            normCurrent === norm2 ||
            (norm1 && (norm1.includes(normCurrent) || normCurrent.includes(norm1))) ||
            (norm2 && (norm2.includes(normCurrent) || normCurrent.includes(norm2)))
          ));
          const hasEmptySlot = isUnboundHwid(hwid1) || isUnboundHwid(hwid2);

          if (normCurrent && !isBoundToCurrent && !hasEmptySlot) {
            return { 
              success: false, 
              message: 'تم استهلاك الحد المسموح للأجهزة المربوطة بهذا الكود (2/2). يمكنك تحرير الأجهزة من بوابة المطور أو التواصل مع الدعم', 
              data: license 
            };
          }

          return { success: true, message: 'VALID', data: license };
        } else {
          // Document explicitly deleted or does not exist on Firestore Cloud!
          // Only trust this if confirmed directly from server (!fromCache).
          const isFromCache = Boolean(docSnap?.metadata?.fromCache);
          if (isFromCache) {
            console.warn(`[checkLicenseOnCloud] Document ${cleanKey} not found in local cache (offline/resume). Trusting local active status.`);
            return { success: true, message: 'OFFLINE_CACHE_VALID' };
          }
          return { success: false, message: 'KEY_NOT_FOUND' };
        }
      } catch (cloudErr) {
        console.warn('Firestore cloud check fallback to local database:', cloudErr);
        if (typeof localStorage !== 'undefined') {
          const rawLocal = localStorage.getItem('smart_accounting_license_v1');
          if (rawLocal && rawLocal.includes(cleanKey) && !rawLocal.includes('"status":"unlicensed"')) {
            return { success: true, message: 'OFFLINE_CACHE_VALID' };
          }
        }
      }
    }

    if (typeof localStorage !== 'undefined') {
      const rawLocal = localStorage.getItem('smart_accounting_license_v1');
      if (rawLocal && rawLocal.includes(cleanKey) && !rawLocal.includes('"status":"unlicensed"')) {
        return { success: true, message: 'OFFLINE_CACHE_VALID' };
      }
    }

    const localDb = getMockDb();
    const license = localDb[cleanKey] || localDb[key];
    if (license) {
      if (license.status === 'suspended') {
        return { success: false, message: 'KEY_SUSPENDED', data: license };
      }
      const expiry = new Date(license.expiresAt);
      if (expiry < new Date()) {
        return { success: false, message: 'KEY_EXPIRED', data: license };
      }

      return { success: true, message: 'VALID', data: license };
    }

    return { success: false, message: 'KEY_NOT_FOUND' };
  } catch {
    if (typeof localStorage !== 'undefined') {
      const rawLocal = localStorage.getItem('smart_accounting_license_v1');
      if (rawLocal && rawLocal.includes(cleanKey) && !rawLocal.includes('"status":"unlicensed"')) {
        return { success: true, message: 'OFFLINE_CACHE_VALID' };
      }
    }
    return { success: false, message: 'SERVER_ERROR' };
  }
}

// Listen to Real-Time License changes on Firestore Cloud (Auto-Lock when DELETED or SUSPENDED on Server)
export function listenToLicenseOnCloud(
  key: string,
  onStatusChange: (status: 'active' | 'suspended' | 'deleted' | 'expired' | 'not_found', data?: CloudLicense) => void
): () => void {
  const cleanKey = key.trim().toUpperCase();
  if (!cleanKey) return () => {};

  const db = getFirestoreDb();
  if (!db) return () => {};

  try {
    const docRef = doc(db, 'licenses', cleanKey);
    const unsubscribe = onSnapshot(docRef, { includeMetadataChanges: true }, (docSnap) => {
      const isFromCache = docSnap.metadata.fromCache;

      if (!docSnap.exists()) {
        // 🔒 CRITICAL: Only trigger 'deleted' if the server explicitly confirms document deletion (!isFromCache).
        // If snapshot is from local cache before server sync, DO NOT revoke license.
        if (!isFromCache) {
          onStatusChange('deleted');
        }
      } else {
        const data = docSnap.data() as CloudLicense;
        if (data.status === 'suspended') {
          onStatusChange('suspended', data);
        } else if (data.expiresAt && data.type !== 'lifetime' && new Date(data.expiresAt) < new Date()) {
          onStatusChange('expired', data);
        } else {
          onStatusChange('active', data);
        }
      }
    }, () => {
      // Listener fallback
    });

    return unsubscribe;
  } catch {
    return () => {};
  }
}

// Activate/Bind license to device HWID on Cloud / Local Mock Database
export async function activateLicenseOnCloud(key: string, hwid: string, customerName?: string, phone?: string): Promise<{ success: boolean; message: string; data?: CloudLicense }> {
  try {
    const cleanKey = key.trim().toUpperCase();
    if (!cleanKey) return { success: false, message: 'KEY_EMPTY' };

    const db = getFirestoreDb();
    const normCurrent = normalizeHWID(hwid);

    if (db) {
      try {
        const docRef = doc(db, 'licenses', cleanKey);
        let docSnap = await withTimeout(getDoc(docRef), 2500);
        
        if (!docSnap.exists()) {
          const allDocs = await withTimeout(getDocs(collection(db, 'licenses')), 2500);
          const matchedDoc = allDocs.docs.find(d => d.id.trim().toUpperCase() === cleanKey);
          if (matchedDoc) docSnap = matchedDoc as any;
        }

        if (docSnap.exists()) {
          const license = docSnap.data() as CloudLicense;
          if (license.status === 'suspended') {
            return { success: false, message: 'KEY_SUSPENDED' };
          }
          const expiry = new Date(license.expiresAt);
          if (expiry < new Date()) {
            return { success: false, message: 'KEY_EXPIRED' };
          }

          let { hwid1, hwid2 } = getLicenseHwidSlots(license);
          const norm1 = normalizeHWID(hwid1);
          const norm2 = normalizeHWID(hwid2);

          const isMatch1 = normCurrent && (normCurrent === norm1 || (norm1 && (norm1.includes(normCurrent) || normCurrent.includes(norm1))));
          const isMatch2 = normCurrent && (normCurrent === norm2 || (norm2 && (norm2.includes(normCurrent) || normCurrent.includes(norm2))));
          const isBoundToCurrent = isMatch1 || isMatch2;

          if (!isBoundToCurrent) {
            if (isUnboundHwid(hwid1)) {
              hwid1 = hwid;
            } else if (isUnboundHwid(hwid2)) {
              hwid2 = hwid;
            } else {
              return { 
                success: false, 
                message: 'تم استهلاك الحد المسموح للأجهزة المربوطة بهذا الكود (2/2). يرجى مسح أحد الأجهزة من بوابة المطور أو التواصل مع الدعم' 
              };
            }
          } else {
            // Already registered device - maintain or update existing slot to current full HWID
            if (isMatch1) hwid1 = hwid;
            else if (isMatch2) hwid2 = hwid;
          }

          const boundList = [hwid1, hwid2].filter(h => h && !isUnboundHwid(h));
          const updatedLicense: CloudLicense = {
            ...license,
            hwid1,
            hwid2,
            hwid: boundList.join(','),
            boundHwids: boundList,
            maxDevices: 2,
            customerName: customerName || license.customerName || 'عميل سند',
            phone: phone || license.phone || '',
            status: 'active'
          };

          await withTimeout(setDoc(docRef, updatedLicense), 2500);
          return { success: true, message: 'ACTIVATED_SUCCESSFULLY', data: updatedLicense };
        }
      } catch (cloudErr) {
        console.warn('Firestore activation fallback:', cloudErr);
      }
    }

    const localDb = getMockDb();
    let license = localDb[cleanKey] || localDb[key];

    if (license) {
      if (license.status === 'suspended') {
        return { success: false, message: 'KEY_SUSPENDED' };
      }
      
      let { hwid1, hwid2 } = getLicenseHwidSlots(license);
      const norm1 = normalizeHWID(hwid1);
      const norm2 = normalizeHWID(hwid2);

      const isMatch1 = normCurrent && (normCurrent === norm1 || (norm1 && (norm1.includes(normCurrent) || normCurrent.includes(norm1))));
      const isMatch2 = normCurrent && (normCurrent === norm2 || (norm2 && (norm2.includes(normCurrent) || normCurrent.includes(norm2))));
      const isBoundToCurrent = isMatch1 || isMatch2;

      if (!isBoundToCurrent) {
        if (isUnboundHwid(hwid1)) {
          hwid1 = hwid;
        } else if (isUnboundHwid(hwid2)) {
          hwid2 = hwid;
        } else {
          return { 
            success: false, 
            message: 'تم استهلاك الحد المسموح للأجهزة المربوطة بهذا الكود (2/2). يرجى مسح أحد الأجهزة من بوابة المطور أو التواصل مع الدعم' 
          };
        }
      } else {
        if (isMatch1) hwid1 = hwid;
        else if (isMatch2) hwid2 = hwid;
      }

      const boundList = [hwid1, hwid2].filter(h => h && !isUnboundHwid(h));
      license.hwid1 = hwid1;
      license.hwid2 = hwid2;
      license.hwid = boundList.join(',');
      license.boundHwids = boundList;
      license.maxDevices = 2;
      if (customerName) license.customerName = customerName;
      if (phone) license.phone = phone;
      license.status = 'active';
      localDb[cleanKey] = license;
      saveMockDb(localDb);

      return { success: true, message: 'ACTIVATED_SUCCESSFULLY', data: license };
    }

    return { success: false, message: 'KEY_NOT_FOUND' };
  } catch (error) {
    console.warn('SaaS Activation fallback handling error:', error);
    return { success: false, message: 'SERVER_ERROR' };
  }
}

// Developer Action: Create central license (SaaS Admin)
export async function createLicenseOnCloud(key: string, license: CloudLicense): Promise<boolean> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        await withTimeout(setDoc(doc(db, 'licenses', key), license), 1500);
        return true;
      } catch (cloudErr) {
        console.warn('Firestore setDoc offline or error, saving to local DB:', cloudErr);
      }
    }

    const localDb = getMockDb();
    localDb[key] = license;
    saveMockDb(localDb);
    return true;
  } catch (error) {
    console.warn('SaaS creation fallback:', error);
    return false;
  }
}

// Developer Action: Retrieve all central licenses (SaaS Admin)
export async function getAllLicensesFromCloud(): Promise<CloudLicense[]> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        const querySnapshot = await withTimeout(getDocs(collection(db, 'licenses')), 1500);
        const licenses: CloudLicense[] = [];
        querySnapshot.forEach((doc) => {
          licenses.push(doc.data() as CloudLicense);
        });
        if (licenses.length > 0) {
          return licenses;
        }
      } catch (cloudErr) {
        console.warn('Firestore getDocs offline or error, returning local licenses:', cloudErr);
      }
    }

    const localDb = getMockDb();
    return Object.values(localDb);
  } catch (error) {
    console.warn('SaaS list retrieval fallback:', error);
    const localDb = getMockDb();
    return Object.values(localDb);
  }
}

// Developer Action: Real Firestore Delete central license (SaaS Admin)
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
      } catch (cloudErr) {
        console.warn('Firestore deleteDoc timeout or error, attempting direct deleteDoc:', cloudErr);
        try {
          await deleteDoc(doc(db, 'licenses', key));
          await deleteDoc(doc(db, 'stores', key));
        } catch (err) {
          console.error('Direct deleteDoc failed:', err);
        }
      }
    }

    const localDb = getMockDb();
    delete localDb[key];
    saveMockDb(localDb);
    return true;
  } catch (error) {
    console.warn('SaaS deletion fallback:', error);
    return false;
  }
}

// Developer Action: Update license Device IDs (HWID 1 & HWID 2) for license management
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
        const docSnap = await withTimeout(getDoc(docRef), 1500);
        if (docSnap.exists()) {
          const current = docSnap.data() as CloudLicense;
          await withTimeout(setDoc(docRef, { 
            ...current, 
            hwid1: h1, 
            hwid2: h2, 
            hwid: combinedHwid, 
            boundHwids: boundList,
            maxDevices: 2
          }), 1500);
          return true;
        }
      } catch (cloudErr) {
        console.warn('Firestore update HWIDs error, trying local DB:', cloudErr);
      }
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
    console.warn('SaaS HWIDs update fallback:', error);
    return false;
  }
}

export async function updateLicenseHwidOnCloud(key: string, newHwid: string): Promise<boolean> {
  const parts = newHwid.split(',').map(s => s.trim());
  return updateLicenseHwidsOnCloud(key, parts[0] || '', parts[1] || '');
}

// Developer Action: Toggle License Status (Active <-> Suspended)
export async function toggleLicenseSuspendOnCloud(key: string, newStatus: 'active' | 'suspended'): Promise<boolean> {
  try {
    const cleanKey = key.trim().toUpperCase();
    const db = getFirestoreDb();
    if (db) {
      try {
        const docRef = doc(db, 'licenses', cleanKey);
        const docSnap = await withTimeout(getDoc(docRef), 2000);
        if (docSnap.exists()) {
          const current = docSnap.data() as CloudLicense;
          await withTimeout(setDoc(docRef, { 
            ...current, 
            status: newStatus 
          }), 2000);
          return true;
        }
      } catch (cloudErr) {
        console.warn('Firestore toggle suspend error, updating local DB:', cloudErr);
      }
    }

    const localDb = getMockDb();
    if (localDb[cleanKey]) {
      localDb[cleanKey].status = newStatus;
      saveMockDb(localDb);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('SaaS suspend toggle fallback error:', error);
    return false;
  }
}

// Developer Action: Renew / Extend License Expiry Date
export async function renewLicenseOnCloud(
  key: string, 
  extensionType: 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'trial' | 'custom', 
  customDays?: number
): Promise<{ success: boolean; newExpiry?: string; message: string }> {
  try {
    const cleanKey = key.trim().toUpperCase();
    const db = getFirestoreDb();
    
    let currentLicense: CloudLicense | null = null;
    let docRef: any = null;

    if (db) {
      try {
        docRef = doc(db, 'licenses', cleanKey);
        const docSnap = await withTimeout(getDoc(docRef), 2000);
        if (docSnap.exists()) {
          currentLicense = docSnap.data() as CloudLicense;
        }
      } catch (e) {
        console.warn('Firestore fetch current license error on renew:', e);
      }
    }

    if (!currentLicense) {
      const localDb = getMockDb();
      currentLicense = localDb[cleanKey] || null;
    }

    if (!currentLicense) {
      return { success: false, message: 'الترخيص غير موجود في قاعدة البيانات' };
    }

    // Calculate base date: if current expiration is in the future, extend from that future date!
    // Otherwise extend from today (now).
    const now = new Date();
    let baseDate = now;
    if (currentLicense.expiresAt && currentLicense.type !== 'lifetime') {
      const currentExp = new Date(currentLicense.expiresAt);
      if (currentExp > now) {
        baseDate = currentExp;
      }
    }

    const newExpDate = new Date(baseDate);
    let resolvedType: 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'trial' = currentLicense.type || 'monthly';

    if (extensionType === 'weekly' || extensionType === 'trial') {
      newExpDate.setDate(newExpDate.getDate() + 7);
      resolvedType = extensionType === 'trial' ? 'trial' : 'weekly';
    } else if (extensionType === 'monthly') {
      newExpDate.setDate(newExpDate.getDate() + 30);
      resolvedType = 'monthly';
    } else if (extensionType === 'yearly') {
      newExpDate.setDate(newExpDate.getDate() + 365);
      resolvedType = 'yearly';
    } else if (extensionType === 'lifetime') {
      newExpDate.setFullYear(newExpDate.getFullYear() + 100);
      resolvedType = 'lifetime';
    } else if (extensionType === 'custom' && customDays && customDays > 0) {
      newExpDate.setDate(newExpDate.getDate() + customDays);
    }

    const newExpiryIso = newExpDate.toISOString();

    const updated: CloudLicense = {
      ...currentLicense,
      status: 'active',
      expiresAt: newExpiryIso,
      type: resolvedType
    };

    if (db && docRef) {
      try {
        await withTimeout(setDoc(docRef, updated), 2000);
      } catch (cloudErr) {
        console.warn('Firestore setDoc error on renew:', cloudErr);
      }
    }

    const localDb = getMockDb();
    localDb[cleanKey] = updated;
    saveMockDb(localDb);

    return { 
      success: true, 
      newExpiry: newExpiryIso, 
      message: `تم تجديد الترخيص بنجاح حتى تاريخ ${newExpDate.toLocaleDateString('ar-YE')}` 
    };
  } catch (error: any) {
    console.error('SaaS license renew error:', error);
    return { success: false, message: error.message || 'حدث خطأ أثناء تجديد الترخيص' };
  }
}

// Find license by hardware fingerprint (HWID)
export async function findLicenseByHwid(hwid: string): Promise<CloudLicense | null> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        const querySnapshot = await withTimeout(getDocs(collection(db, 'licenses')), 1500);
        let matched: CloudLicense | null = null;
        querySnapshot.forEach((doc) => {
          const data = doc.data() as CloudLicense;
          if (normalizeHWID(data.hwid) === normalizeHWID(hwid)) {
            matched = data;
          }
        });
        if (matched) return matched;
      } catch (cloudErr) {
        console.warn('Firestore HWID query offline or error, checking local DB:', cloudErr);
      }
    }

    const localDb = getMockDb();
    const licenses = Object.values(localDb);
    const matched = licenses.find(l => normalizeHWID(l.hwid) === normalizeHWID(hwid));
    return matched || null;
  } catch (error) {
    console.warn('SaaS HWID query fallback:', error);
    return null;
  }
}

// Developer Action: Reset Cloud Data
export async function resetCloudData(): Promise<{ success: boolean; deletedCount: number; message?: string }> {
  try {
    const db = getFirestoreDb();
    let count = 0;

    const collectionsToReset = [
      'products',
      'sales',
      'purchases',
      'customers',
      'suppliers',
      'invoices',
      'payments',
      'transactions',
      'maintenanceOrders',
      'maintenance'
    ];

    if (db) {
      for (const colName of collectionsToReset) {
        try {
          const colRef = collection(db, colName);
          const snap = await withTimeout(getDocs(colRef), 1500);
          for (const docSnap of snap.docs) {
            await withTimeout(deleteDoc(doc(db, colName, docSnap.id)), 1500);
            count++;
          }
        } catch (e) {
          console.warn(`Collection ${colName} reset error:`, e);
        }
      }

      try {
        const storesSnap = await withTimeout(getDocs(collection(db, 'stores')), 1500);
        for (const storeDoc of storesSnap.docs) {
          const storeId = storeDoc.id;
          for (const colName of collectionsToReset) {
            try {
              const subColRef = collection(db, 'stores', storeId, colName);
              const subSnap = await withTimeout(getDocs(subColRef), 1500);
              for (const docSnap of subSnap.docs) {
                await withTimeout(deleteDoc(doc(db, 'stores', storeId, colName, docSnap.id)), 1500);
                count++;
              }
            } catch (e) {
              console.warn(`Store ${storeId} subcollection ${colName} reset error:`, e);
            }
          }
        }
      } catch (e) {
        console.warn('Stores collection fetch error during reset:', e);
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
    console.error('Reset Cloud Data error:', error);
    return { success: false, deletedCount: 0, message: error?.message || 'فشل التصفير السحابي' };
  }
}

// Developer Action: Reset Specific Client Cloud Data
export async function resetClientCloudData(licenseKey: string, hwid?: string): Promise<{ success: boolean; deletedCount: number; message?: string }> {
  try {
    const db = getFirestoreDb();
    let count = 0;

    const collectionsToReset = [
      'products',
      'sales',
      'purchases',
      'customers',
      'suppliers',
      'invoices',
      'payments',
      'transactions',
      'maintenanceOrders',
      'maintenance'
    ];

    if (db) {
      const storeIdsToReset = [licenseKey, hwid].map(s => String(s || '').trim()).filter(Boolean);

      for (const storeId of storeIdsToReset) {
        if (!storeId) continue;
        for (const colName of collectionsToReset) {
          try {
            const subColRef = collection(db, 'stores', storeId, colName);
            const subSnap = await getDocs(subColRef);
            for (const docSnap of subSnap.docs) {
              if (!docSnap.id) continue;
              await deleteDoc(doc(db, 'stores', storeId, colName, docSnap.id));
              count++;
            }
          } catch (e) {
            console.warn(`Subcollection ${colName} reset error for store ${storeId}:`, e);
          }
        }
      }

      for (const colName of collectionsToReset) {
        try {
          const colRef = collection(db, colName);
          const snap = await getDocs(colRef);
          for (const docSnap of snap.docs) {
            if (!docSnap.id) continue;
            const data = docSnap.data();
            if (
              (licenseKey && (data.licenseKey === licenseKey || data.storeId === licenseKey)) ||
              (hwid && (data.hwid === hwid || data.storeId === hwid))
            ) {
              await deleteDoc(doc(db, colName, docSnap.id));
              count++;
            }
          }
        } catch (e) {
          console.warn(`Root collection ${colName} query error during client reset:`, e);
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
    console.error('Reset Client Cloud Data error:', error);
    return { success: false, deletedCount: 0, message: error?.message || 'فشل تصفير بيانات العميل' };
  }
}
