/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  onSnapshot, 
  doc, 
  collection, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { getFirestoreDb, handleFirestoreError, OperationType, withTimeout } from './firebase';

// Helper to save a single document in a subcollection under a store
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
    await withTimeout(setDoc(docRef, data), 1500);
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
    await withTimeout(deleteDoc(docRef), 1500);
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
    await withTimeout(setDoc(docRef, settings), 1500);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Real-time synchronization helper for collections with auto-seeding on first creation only
export function syncStoreCollection<T extends { id: string }>(
  licenseKey: string,
  collectionName: string,
  onUpdate: (data: T[]) => void,
  defaultSeed: T[]
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

    // Set up real-time onSnapshot listener
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty) {
        const alreadySeeded = localStorage.getItem(seedFlagKey);
        if (!alreadySeeded && defaultSeed && defaultSeed.length > 0) {
          console.log(`Initial seed for collection '${cleanCol}' for store '${cleanKey}'...`);
          localStorage.setItem(seedFlagKey, 'true');
          defaultSeed.forEach((item) => {
            if (!item || !item.id) return;
            const itemId = String(item.id).trim();
            if (!itemId) return;
            try {
              const itemDocRef = doc(db, 'stores', cleanKey, cleanCol, itemId);
              setDoc(itemDocRef, item).catch((err) => {
                console.error(`Failed to upload seed item for ${cleanCol}:`, err);
              });
            } catch (err) {
              console.error(`Error creating seed doc ref for ${cleanCol}:`, err);
            }
          });
          onUpdate(defaultSeed);
        } else {
          // Reset or intentionally empty collection -> return empty list immediately!
          onUpdate([]);
        }
      } else {
        localStorage.setItem(seedFlagKey, 'true');
        const items: T[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ ...docSnap.data() } as T);
        });
        onUpdate(items);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  } catch (err) {
    console.warn(`Failed to set up listener for store collection ${cleanCol}:`, err);
    return () => {};
  }
}

// Real-time synchronization helper for the single settings document
export function syncStoreSettings(
  licenseKey: string,
  onUpdate: (settings: any) => void,
  defaultSettings: any
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
        console.log(`Seeding settings document for store '${cleanKey}'...`);
        setDoc(docRef, defaultSettings).catch((err) => {
          console.error(`Failed to upload seed settings:`, err);
        });
        onUpdate(defaultSettings);
      } else {
        onUpdate(docSnap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  } catch (err) {
    console.warn(`Failed to set up listener for store settings:`, err);
    return () => {};
  }
}
