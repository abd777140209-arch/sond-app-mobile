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
  const db = getFirestoreDb();
  if (!db) return;
  const path = `stores/${licenseKey}/${collectionName}/${docId}`;
  try {
    await withTimeout(setDoc(doc(db, 'stores', licenseKey, collectionName, docId), data), 1500);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Helper to delete a single document in a subcollection under a store
export async function deleteStoreDocument(licenseKey: string, collectionName: string, docId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  const path = `stores/${licenseKey}/${collectionName}/${docId}`;
  try {
    await withTimeout(deleteDoc(doc(db, 'stores', licenseKey, collectionName, docId)), 1500);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Helper to save store settings document
export async function saveStoreSettings(licenseKey: string, settings: any): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  const path = `stores/${licenseKey}/config/settings`;
  try {
    await withTimeout(setDoc(doc(db, 'stores', licenseKey, 'config', 'settings'), settings), 1500);
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
  const db = getFirestoreDb();
  if (!db) {
    return () => {};
  }

  const colRef = collection(db, 'stores', licenseKey, collectionName);
  const path = `stores/${licenseKey}/${collectionName}`;
  const seedFlagKey = `store_seeded_${licenseKey}_${collectionName}`;

  // Set up real-time onSnapshot listener
  const unsubscribe = onSnapshot(colRef, (snapshot) => {
    if (snapshot.empty) {
      const alreadySeeded = localStorage.getItem(seedFlagKey);
      if (!alreadySeeded && defaultSeed.length > 0) {
        console.log(`Initial seed for collection '${collectionName}' for store '${licenseKey}'...`);
        localStorage.setItem(seedFlagKey, 'true');
        defaultSeed.forEach((item) => {
          setDoc(doc(colRef, item.id), item).catch((err) => {
            console.error(`Failed to upload seed item for ${collectionName}:`, err);
          });
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
}

// Real-time synchronization helper for the single settings document
export function syncStoreSettings(
  licenseKey: string,
  onUpdate: (settings: any) => void,
  defaultSettings: any
): () => void {
  const db = getFirestoreDb();
  if (!db) {
    return () => {};
  }

  const docRef = doc(db, 'stores', licenseKey, 'config', 'settings');
  const path = `stores/${licenseKey}/config/settings`;

  const unsubscribe = onSnapshot(docRef, (docSnap) => {
    if (!docSnap.exists()) {
      console.log(`Seeding settings document for store '${licenseKey}'...`);
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
}
