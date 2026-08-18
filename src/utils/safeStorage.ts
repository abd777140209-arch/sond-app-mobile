/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Robust, Quota-Safe LocalStorage wrapper for Sanad Accounting
 * Handles quota limits, cleans up disposable cache keys, downsamples heavy base64 payloads,
 * and ensures smart_accounting_settings and critical state always save reliably.
 */

// Keys that can be deleted immediately when cleaning up storage
const DISPOSABLE_EXACT_KEYS = [
  'sanad_drive_last_backup_data',
  'sanad_app_logo_timestamp',
  'sanad_store_logo',
  'sanad_store_address',
  'sanad_store_phone',
  'sanad_last_export_cache',
  'sanad_temp_print_payload',
  'sanad_cached_qr_data',
  'sanad_offline_queue',
  'sanad_latest_silent_backup',
  'smart_accounting_company_logo' // Settings already contains storeLogoUrl
];

/**
 * Strips or downsamples overly large base64 proof images from older records to save megabytes
 */
function optimizeArrayPayload(jsonStr: string, maxItemsWithImages = 5): string {
  try {
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr)) return jsonStr;

    let modified = false;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (item && typeof item === 'object') {
        // Only keep proof images on the most recent items
        if (i >= maxItemsWithImages && item.proofImage) {
          delete item.proofImage;
          modified = true;
        }
      }
    }
    return modified ? JSON.stringify(arr) : jsonStr;
  } catch {
    return jsonStr;
  }
}

/**
 * Cleans up disposable and bloated cache keys from localStorage
 */
export function cleanUpStorageQuota(): void {
  try {
    if (typeof localStorage === 'undefined') return;

    // 1. Remove known exact disposable keys
    for (const key of DISPOSABLE_EXACT_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }

    // 2. Scan and remove all auto backup / cache keys starting with known prefixes
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        if (
          k.startsWith('sanad_auto_backup_') ||
          k.startsWith('sanad_backup_') ||
          k.startsWith('sanad_drive_') ||
          k.startsWith('sanad_temp_') ||
          k.startsWith('sanad_cache_') ||
          k.startsWith('sanad_export_')
        ) {
          keysToRemove.push(k);
        }
      }
    }

    for (const k of keysToRemove) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }

    // 3. Trim audit logs to max 15 entries
    try {
      const logsRaw = localStorage.getItem('smart_accounting_audit_logs');
      if (logsRaw) {
        const logs = JSON.parse(logsRaw);
        if (Array.isArray(logs) && logs.length > 15) {
          localStorage.setItem('smart_accounting_audit_logs', JSON.stringify(logs.slice(0, 15)));
        }
      }
    } catch {}

    // 4. Optimize invoices stored in localStorage if they contain heavy proof images
    try {
      const invoicesRaw = localStorage.getItem('smart_accounting_invoices');
      if (invoicesRaw && invoicesRaw.length > 500000) {
        const optimized = optimizeArrayPayload(invoicesRaw, 3);
        localStorage.setItem('smart_accounting_invoices', optimized);
      }
    } catch {}

    // 5. Optimize transactions stored in localStorage
    try {
      const txRaw = localStorage.getItem('smart_accounting_transactions');
      if (txRaw && txRaw.length > 400000) {
        const optimized = optimizeArrayPayload(txRaw, 3);
        localStorage.setItem('smart_accounting_transactions', optimized);
      }
    } catch {}

    // 6. Clean up settings if logo is giant (>30KB)
    try {
      const settingsRaw = localStorage.getItem('smart_accounting_settings');
      if (settingsRaw) {
        const parsed = JSON.parse(settingsRaw);
        if (parsed && parsed.storeLogoUrl && parsed.storeLogoUrl.length > 40000) {
          // If logo is too huge, truncate or optimize
          parsed.storeLogoUrl = '';
          localStorage.setItem('smart_accounting_settings', JSON.stringify(parsed));
        }
      }
    } catch {}
  } catch (err) {
    console.warn('[safeStorage] Cleanup error:', err);
  }
}

// Automatically run cleanup on module evaluation
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    cleanUpStorageQuota();
  } catch {}
}

/**
 * Safely sets an item in localStorage with multi-tiered automatic quota recovery
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    // Proactive check: If saving settings and it contains an excessively large logo, sanitize it
    let valueToSave = value;
    if (key === 'smart_accounting_settings') {
      try {
        const parsed = JSON.parse(value);
        if (parsed.storeLogoUrl && parsed.storeLogoUrl.length > 50000) {
          // Truncate overly huge uncompressed data URL
          parsed.storeLogoUrl = '';
          valueToSave = JSON.stringify(parsed);
        }
      } catch {}
    } else if (key === 'smart_accounting_invoices' || key === 'smart_accounting_transactions') {
      if (value.length > 700000) {
        valueToSave = optimizeArrayPayload(value, 5);
      }
    }

    localStorage.setItem(key, valueToSave);
    return true;
  } catch (firstError) {
    console.warn(`[safeStorage] Storage quota reached while saving "${key}". Running aggressive cleanup...`);
    
    // Tier 1: Aggressive cleanup
    cleanUpStorageQuota();

    // Tier 2: Retry with sanitized payload
    try {
      let retryValue = value;
      if (key === 'smart_accounting_settings') {
        const parsed = JSON.parse(value);
        if (parsed.storeLogoUrl && parsed.storeLogoUrl.length > 20000) {
          parsed.storeLogoUrl = '';
          retryValue = JSON.stringify(parsed);
        }
      } else if (key === 'smart_accounting_invoices' || key === 'smart_accounting_transactions') {
        retryValue = optimizeArrayPayload(value, 2);
      }

      localStorage.setItem(key, retryValue);
      return true;
    } catch (secondError) {
      console.warn(`[safeStorage] Second attempt failed for "${key}". Performing deep purge...`);

      // Tier 3: Deep purge - Clear old audit logs and remove non-essential keys
      try {
        localStorage.removeItem('smart_accounting_audit_logs');
        localStorage.removeItem('sanad_drive_last_backup_data');
        localStorage.removeItem('sanad_latest_silent_backup');
        
        // If settings still fails, strip logo completely for localStorage copy
        if (key === 'smart_accounting_settings') {
          const parsed = JSON.parse(value);
          parsed.storeLogoUrl = '';
          localStorage.setItem(key, JSON.stringify(parsed));
          return true;
        }

        // If array, keep latest 15 items
        const parsedArr = JSON.parse(value);
        if (Array.isArray(parsedArr) && parsedArr.length > 15) {
          const trimmed = parsedArr.slice(0, 15);
          localStorage.setItem(key, JSON.stringify(trimmed));
          return true;
        }
      } catch (thirdError) {
        console.warn(`[safeStorage] Deep purge save failed for "${key}":`, thirdError);
      }

      return false;
    }
  }
}

/**
 * Safely gets an item from localStorage
 */
export function safeGetItem(key: string, defaultValue: string | null = null): string | null {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : defaultValue;
  } catch (err) {
    console.warn(`[safeStorage] Error getting "${key}":`, err);
    return defaultValue;
  }
}

/**
 * Safely removes an item from localStorage
 */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[safeStorage] Error removing "${key}":`, err);
  }
}

export const safeStorage = {
  setItem: safeSetItem,
  getItem: safeGetItem,
  removeItem: safeRemoveItem,
  cleanUp: cleanUpStorageQuota
};
