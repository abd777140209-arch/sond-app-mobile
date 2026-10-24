/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  onSnapshot, 
  doc, 
  collection, 
  setDoc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { getFirestoreDb, handleFirestoreError, OperationType, withTimeout } from './firebase';
import { safeStorage } from './safeStorage';

// Helper to save a single document in a subcollection under a store (Multi-tenant Cloud Sync)
export async function saveStoreDocument(licenseKey: string, collectionName: string, docId: string, data: any): Promise<void> {
  const cleanKey = String(licenseKey || '').trim();
  const cleanCol = String(collectionName || '').trim();
  const cleanDocId = String(docId || '').trim();
  if (!cleanKey || !cleanCol || !cleanDocId) return;

  const db = getFirestoreDb();
  if (!db) return;
  const path = `stores/${cleanKey}/${cleanCol}/${cleanDocId}`;
  try {
    const docRef = doc(db, 'stores', cleanKey, cleanCol, cleanDocId);
    await withTimeout(setDoc(docRef, data), 2500);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Helper to delete a single document in a subcollection under a store
export async function deleteStoreDocument(licenseKey: string, collectionName: string, docId: string): Promise<void> {
  const cleanKey = String(licenseKey || '').trim();
  const cleanCol = String(collectionName || '').trim();
  const cleanDocId = String(docId || '').trim();
  if (!cleanKey || !cleanCol || !cleanDocId) return;

  const db = getFirestoreDb();
  if (!db) return;
  const path = `stores/${cleanKey}/${cleanCol}/${cleanDocId}`;
  try {
    const docRef = doc(db, 'stores', cleanKey, cleanCol, cleanDocId);
    await withTimeout(deleteDoc(docRef), 2500);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Helper to save store settings document
export async function saveStoreSettings(licenseKey: string, settings: any): Promise<void> {
  const cleanKey = String(licenseKey || '').trim();
  if (!cleanKey || !settings) return;

  const db = getFirestoreDb();
  if (!db) return;
  const path = `stores/${cleanKey}/config/settings`;
  try {
    const docRef = doc(db, 'stores', cleanKey, 'config', 'settings');
    await withTimeout(setDoc(docRef, settings), 2500);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Real-time synchronization helper for collections with anti-resurrection and ghost-record purging
export function syncStoreCollection<T extends { id: string }>(
  licenseKey: string,
  collectionName: string,
  onUpdate: (data: T[]) => void,
  _defaultSeed: T[]
): () => void {
  const cleanKey = String(licenseKey || '').trim();
  const cleanCol = String(collectionName || '').trim();
  if (!cleanKey || !cleanCol) {
    return () => {};
  }

  const db = getFirestoreDb();
  if (!db) {
    return () => {};
  }

  try {
    const colRef = collection(db, 'stores', cleanKey, cleanCol);
    const path = `stores/${cleanKey}/${cleanCol}`;
    const seedFlagKey = `store_seeded_${cleanKey}_${cleanCol}`;

    // Always mark seeded as true so empty collections NEVER re-upload demo seed data
    localStorage.setItem(seedFlagKey, 'true');

    // Set up real-time onSnapshot listener
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
      } else {
        localStorage.setItem(seedFlagKey, 'true');
        const items: T[] = [];
        snapshot.forEach((docSnap) => {
          const rawData = docSnap.data() as any;
          if (!rawData) return;

          // Automatically hard-delete soft-deleted ghost records from Firestore
          // so older desktop installations (1-month-old versions) never see deleted customers/debts/products
          if (rawData.isDeleted === true || (cleanCol === 'customers' && rawData.isActive === false)) {
            const ghostId = String(docSnap.id || rawData.id || '').trim();
            if (ghostId) {
              deleteDoc(doc(db, 'stores', cleanKey, cleanCol, ghostId)).catch(() => {});
            }
            return;
          }

          if (docSnap.id === '__reset_sentinel__' || rawData.isResetSentinel === true) {
            return;
          }

          items.push({ ...rawData, id: rawData.id || docSnap.id } as T);
        });
        onUpdate(items);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  } catch {
    return () => {};
  }
}

// Real-time synchronization helper for the single settings document
export function syncStoreSettings(
  licenseKey: string,
  onUpdate: (settings: any) => void,
  defaultSettings: any,
  onCloudResetDetected?: (resetTimestamp: string) => void
): () => void {
  const cleanKey = String(licenseKey || '').trim();
  if (!cleanKey) {
    return () => {};
  }

  const db = getFirestoreDb();
  if (!db) {
    return () => {};
  }

  try {
    const docRef = doc(db, 'stores', cleanKey, 'config', 'settings');
    const path = `stores/${cleanKey}/config/settings`;

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) {
        setDoc(docRef, defaultSettings).catch(() => {});
        onUpdate(defaultSettings);
      } else {
        const cloudSettings = docSnap.data();
        if (cloudSettings?.lastCloudResetAt) {
          const localLastReset = localStorage.getItem('sanad_last_cloud_reset_at') || '';
          if (cloudSettings.lastCloudResetAt > localLastReset) {
            localStorage.setItem('sanad_last_cloud_reset_at', cloudSettings.lastCloudResetAt);
            localStorage.setItem('sanad_cloud_reset_lock', 'true');
            if (onCloudResetDetected) {
              onCloudResetDetected(cloudSettings.lastCloudResetAt);
            }
          }
        }
        onUpdate(cloudSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  } catch {
    return () => {};
  }
}

// Comprehensive Cloud + Local Wipe for a Store (Preserves License & Store Settings)
export async function wipeStoreCloudAndLocalData(
  licenseKey: string,
  hwid?: string,
  knownIds?: {
    products?: string[];
    customers?: string[];
    invoices?: string[];
    payments?: string[];
    transactions?: string[];
    maintenanceOrders?: string[];
  },
  currentSettings?: any,
  onProgress?: (stepLabel: string, deletedCount: number) => void
): Promise<{ success: boolean; deletedCount: number; resetTimestamp: string }> {
  const resetTimestamp = new Date().toISOString();
  let deletedCount = 0;

  const collectionsToWipe = [
    'products',
    'customers',
    'invoices',
    'payments',
    'transactions',
    'maintenanceOrders',
    'sales',
    'purchases',
    'suppliers',
    'maintenance'
  ];

  // 1. Set anti-resurrection lock & seed flags in localStorage immediately
  localStorage.setItem('sanad_cloud_reset_lock', 'true');
  localStorage.setItem('sanad_last_cloud_reset_at', resetTimestamp);

  const storeIds = Array.from(
    new Set([licenseKey, hwid].map(s => String(s || '').trim()).filter(Boolean))
  );

  for (const sid of storeIds) {
    for (const col of collectionsToWipe) {
      localStorage.setItem(`store_seeded_${sid}_${col}`, 'true');
    }
  }

  // 2. Wipe localStorage data keys (Set to empty arrays '[]' so initializers never load SEED_* data)
  safeStorage.setItem('smart_accounting_products', '[]');
  safeStorage.setItem('smart_accounting_customers', '[]');
  safeStorage.setItem('smart_accounting_invoices', '[]');
  safeStorage.setItem('smart_accounting_payments', '[]');
  safeStorage.setItem('smart_accounting_transactions', '[]');
  safeStorage.setItem('smart_accounting_maintenance', '[]');

  const db = getFirestoreDb();
  if (db) {
    // Known IDs + Default Seed IDs to explicitly delete even if getDocs is cached
    const explicitIdsByCol: Record<string, Set<string>> = {
      products: new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', ...(knownIds?.products || [])]),
      customers: new Set(['c1', 'c2', 'c3', ...(knownIds?.customers || [])]),
      invoices: new Set(['inv-1001', 'inv-1002', ...(knownIds?.invoices || [])]),
      payments: new Set(['pay-1', ...(knownIds?.payments || [])]),
      transactions: new Set(['t1', 't2', 't3', 't4', 't5', ...(knownIds?.transactions || [])]),
      maintenanceOrders: new Set([...(knownIds?.maintenanceOrders || [])])
    };

    for (const storeId of storeIds) {
      for (const colName of collectionsToWipe) {
        if (onProgress) {
          onProgress(`جاري مسح سجل (${colName}) من السحابة...`, deletedCount);
        }

        const idsToDelete = new Set<string>(explicitIdsByCol[colName] || []);

        try {
          const subColRef = collection(db, 'stores', storeId, colName);
          const snap = await withTimeout(getDocs(subColRef), 4000);
          snap.docs.forEach(d => {
            if (d.id) idsToDelete.add(d.id);
          });
        } catch {
          // Proceed with explicit IDs even if getDocs timed out
        }

        const idArray = Array.from(idsToDelete).filter(Boolean);
        // Delete in parallel batches of 15 for high speed
        for (let i = 0; i < idArray.length; i += 15) {
          const batch = idArray.slice(i, i + 15);
          await Promise.allSettled(
            batch.map(docId =>
              withTimeout(deleteDoc(doc(db, 'stores', storeId, colName, docId)), 2500)
            )
          );
          deletedCount += batch.length;
          if (onProgress) {
            onProgress(`تم تطهير (${colName}) من السحابة...`, deletedCount);
          }
        }
      }
    }

    // Also save the reset timestamp into cloud store settings so other devices detect the reset
    if (licenseKey && currentSettings) {
      try {
        const updatedSettings = {
          ...currentSettings,
          lastCloudResetAt: resetTimestamp
        };
        safeStorage.setItem('smart_accounting_settings', JSON.stringify(updatedSettings));
        await withTimeout(
          setDoc(doc(db, 'stores', licenseKey.trim(), 'config', 'settings'), updatedSettings),
          2500
        );
      } catch {
        // Ignore offline setting write error
      }
    }
  }

  return { success: true, deletedCount, resetTimestamp };
}
