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
  customerName: string;
  phone?: string;
  createdAt?: string;
  expiresAt: string;
  type: 'monthly' | 'yearly' | 'lifetime' | 'trial';
  status: 'active' | 'suspended';
}

// Check if Firebase configuration is provided with a valid API key
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

// Helper to race Firestore operations with a short timeout (1500ms) for instant offline fallback
export async function withTimeout<T>(promise: Promise<T>, timeoutMs = 1500): Promise<T> {
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
    // If Firebase isn't configured with a valid API key, return null so app uses robust local state
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
      } catch (e) {
        // ignore log level error if already set
      }

      try {
        // Initialize Firestore with robust local offline persistence (Multi-Tab) & Force Long Polling for sandboxed iFrames
        firestoreDb = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          }),
          experimentalForceLongPolling: true
        });
        console.log("Firestore offline persistence and long-polling enabled successfully.");
      } catch (persistenceError) {
        console.warn("Firestore offline persistence failed to initialize (usually happens in strict iframe environments). Falling back to memory cache:", persistenceError);
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
    } catch {
      // fallback
    }
  }

  // Pre-seeded licenses for testing out of the box
  const initialDb: { [key: string]: CloudLicense } = {
    'MHTM-7771-4020-9111': {
      key: 'MHTM-7771-4020-9111',
      hwid: '',
      customerName: 'تجربة - سوبر ماركت الهدى',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      type: 'monthly',
      status: 'active'
    },
    'MHTY-2026-HAPPY-YEAR': {
      key: 'MHTY-2026-HAPPY-YEAR',
      hwid: '',
      customerName: 'مركز الاتصالات اليمني الموحد',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 365 days
      type: 'yearly',
      status: 'active'
    },
    'MHTL-ADMIN-LIFETIME-GOLD': {
      key: 'MHTL-ADMIN-LIFETIME-GOLD',
      hwid: '',
      customerName: 'مؤسسة المحواشي للبرمجيات',
      expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 100 years
      type: 'lifetime',
      status: 'active'
    },
    'MHTT-TRIAL-7DAY-FREE': {
      key: 'MHTT-TRIAL-7DAY-FREE',
      hwid: '',
      customerName: 'نسخة تجريبية مؤقتة (7 أيام)',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
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

// Check license key on Cloud / Local Mock Database
export async function checkLicenseOnCloud(key: string, hwid: string): Promise<{ success: boolean; message: string; data?: CloudLicense }> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        const docRef = doc(db, 'licenses', key);
        const docSnap = await withTimeout(getDoc(docRef), 2000);
        if (docSnap.exists()) {
          const license = docSnap.data() as CloudLicense;
          if (license.status === 'suspended') {
            return { success: false, message: 'KEY_SUSPENDED', data: license };
          }
          const expiry = new Date(license.expiresAt);
          if (expiry < new Date()) {
            return { success: false, message: 'KEY_EXPIRED', data: license };
          }
          // Allow auto-registration/re-binding for new device HWID upon valid code entry
          return { success: true, message: 'VALID', data: license };
        }
      } catch (cloudErr) {
        console.warn('Firestore cloud check offline or unreachable, falling back to local database:', cloudErr);
      }
    }

    // Fallback to local storage mock database
    const localDb = getMockDb();
    const license = localDb[key];
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
  } catch (error) {
    console.warn('SaaS Verification fallback check:', error);
    return { success: false, message: 'SERVER_ERROR' };
  }
}

// Activate/Bind license to device HWID on Cloud / Local Mock Database
export async function activateLicenseOnCloud(key: string, hwid: string, customerName?: string, phone?: string): Promise<{ success: boolean; message: string; data?: CloudLicense }> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        const docRef = doc(db, 'licenses', key);
        const docSnap = await withTimeout(getDoc(docRef), 2500);
        
        if (docSnap.exists()) {
          const license = docSnap.data() as CloudLicense;
          if (license.status === 'suspended') {
            return { success: false, message: 'KEY_SUSPENDED' };
          }
          const expiry = new Date(license.expiresAt);
          if (expiry < new Date()) {
            return { success: false, message: 'KEY_EXPIRED' };
          }

          // Automatically bind/register the new device HWID to this valid license key
          const updatedLicense: CloudLicense = {
            ...license,
            hwid: hwid,
            customerName: customerName || license.customerName || 'عميل سند',
            phone: phone || license.phone || '',
            status: 'active'
          };

          await withTimeout(setDoc(docRef, updatedLicense), 2500);
          return { success: true, message: 'ACTIVATED_SUCCESSFULLY', data: updatedLicense };
        } else {
          // If key does not exist on cloud, check if it's a valid activation key format (e.g., MHTM-XXXX...)
          // and auto-register it as a new CloudLicense for this device!
          if (key.length >= 8) {
            const upperKey = key.toUpperCase();
            let subType: 'monthly' | 'yearly' | 'lifetime' | 'trial' = 'monthly';
            let expDate = new Date();

            if (upperKey.startsWith('MHTM')) {
              subType = 'monthly';
              expDate.setMonth(expDate.getMonth() + 1);
            } else if (upperKey.startsWith('MHTY')) {
              subType = 'yearly';
              expDate.setFullYear(expDate.getFullYear() + 1);
            } else if (upperKey.startsWith('MHTL')) {
              subType = 'lifetime';
              expDate.setFullYear(expDate.getFullYear() + 100);
            } else if (upperKey.startsWith('MHTT')) {
              subType = 'trial';
              expDate.setDate(expDate.getDate() + 7);
            } else {
              subType = 'monthly';
              expDate.setMonth(expDate.getMonth() + 1);
            }

            const newLicense: CloudLicense = {
              key: key,
              hwid: hwid,
              customerName: customerName || 'محل سند للخدمات المحاسبية',
              phone: phone || '',
              createdAt: new Date().toISOString(),
              expiresAt: expDate.toISOString(),
              type: subType,
              status: 'active'
            };

            await withTimeout(setDoc(docRef, newLicense), 2500);
            return { success: true, message: 'ACTIVATED_SUCCESSFULLY', data: newLicense };
          }
          return { success: false, message: 'KEY_NOT_FOUND' };
        }
      } catch (cloudErr) {
        console.warn('Firestore activation offline or unreachable, falling back to local database:', cloudErr);
      }
    }

    // Local DB fallback for offline mode
    const localDb = getMockDb();
    let license = localDb[key];

    if (license) {
      if (license.status === 'suspended') {
        return { success: false, message: 'KEY_SUSPENDED' };
      }
      const expiry = new Date(license.expiresAt);
      if (expiry < new Date()) {
        return { success: false, message: 'KEY_EXPIRED' };
      }

      license.hwid = hwid;
      if (customerName) license.customerName = customerName;
      if (phone) license.phone = phone;
      license.status = 'active';
      localDb[key] = license;
      saveMockDb(localDb);

      return { success: true, message: 'ACTIVATED_SUCCESSFULLY', data: license };
    } else if (key.length >= 8) {
      // Auto-register local mock key
      const upperKey = key.toUpperCase();
      let subType: 'monthly' | 'yearly' | 'lifetime' | 'trial' = 'monthly';
      let expDate = new Date();

      if (upperKey.startsWith('MHTM')) {
        subType = 'monthly';
        expDate.setMonth(expDate.getMonth() + 1);
      } else if (upperKey.startsWith('MHTY')) {
        subType = 'yearly';
        expDate.setFullYear(expDate.getFullYear() + 1);
      } else if (upperKey.startsWith('MHTL')) {
        subType = 'lifetime';
        expDate.setFullYear(expDate.getFullYear() + 100);
      } else if (upperKey.startsWith('MHTT')) {
        subType = 'trial';
        expDate.setDate(expDate.getDate() + 7);
      } else {
        subType = 'monthly';
        expDate.setMonth(expDate.getMonth() + 1);
      }

      const newLic: CloudLicense = {
        key: key,
        hwid: hwid,
        customerName: customerName || 'محل سند للخدمات المحاسبية',
        phone: phone || '',
        createdAt: new Date().toISOString(),
        expiresAt: expDate.toISOString(),
        type: subType,
        status: 'active'
      };

      localDb[key] = newLic;
      saveMockDb(localDb);
      return { success: true, message: 'ACTIVATED_SUCCESSFULLY', data: newLic };
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

// Developer Action: Delete central license (SaaS Admin)
export async function deleteLicenseFromCloud(key: string): Promise<boolean> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        await withTimeout(deleteDoc(doc(db, 'licenses', key)), 1500);
        return true;
      } catch (cloudErr) {
        console.warn('Firestore deleteDoc offline or error, deleting from local DB:', cloudErr);
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

// Developer Action: Update license Device ID (HWID) for license transfer
export async function updateLicenseHwidOnCloud(key: string, newHwid: string): Promise<boolean> {
  try {
    const db = getFirestoreDb();
    if (db) {
      try {
        const docRef = doc(db, 'licenses', key);
        const docSnap = await withTimeout(getDoc(docRef), 1500);
        if (docSnap.exists()) {
          const current = docSnap.data() as CloudLicense;
          await withTimeout(setDoc(docRef, { ...current, hwid: newHwid.trim() }), 1500);
          return true;
        }
      } catch (cloudErr) {
        console.warn('Firestore update HWID error, trying local DB:', cloudErr);
      }
    }

    const localDb = getMockDb();
    if (localDb[key]) {
      localDb[key].hwid = newHwid.trim();
      saveMockDb(localDb);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('SaaS HWID update fallback:', error);
    return false;
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

// Developer Action: Reset Cloud Data (Clear products, sales, purchases, customers, suppliers)
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
      // 1. Reset root collections
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

      // 2. Reset subcollections under stores/{storeId}/
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

    // 3. Clear local storage accounting data
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

// Developer Action: Reset Specific Client Cloud Data (Clear products, sales, purchases, customers, suppliers for a single license/client)
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
      // 1. Reset subcollections under stores/${licenseKey}/ or stores/${hwid}/
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
          } catch (e) {
            console.warn(`Subcollection ${colName} reset error for store ${storeId}:`, e);
          }
        }
      }

      // 2. Query root collections for documents matching this licenseKey or hwid
      for (const colName of collectionsToReset) {
        try {
          const colRef = collection(db, colName);
          const snap = await getDocs(colRef);
          for (const docSnap of snap.docs) {
            const data = docSnap.data();
            if (
              data.licenseKey === licenseKey ||
              data.storeId === licenseKey ||
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

    // 3. Clear local storage accounting data if currently active locally
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

