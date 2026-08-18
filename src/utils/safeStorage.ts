/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Robust, Quota-Safe LocalStorage wrapper for Sanad Accounting
 * Handles quota limits, cleans up disposable cache keys, and prevents unhandled crashes.
 */

// Keys that are safe to delete or trim when storage quota is exceeded
const DISPOSABLE_OR_CACHE_KEYS = [
  'sanad_drive_last_backup_data',
  'sanad_app_logo_timestamp',
  'sanad_store_logo', // Redundant duplicate of smart_accounting_company_logo
  'sanad_store_address', // Redundant duplicate of smart_accounting_address
  'sanad_store_phone', // Redundant duplicate of smart_accounting_phone
  'sanad_last_export_cache',
  'sanad_temp_print_payload',
  'sanad_cached_qr_data',
  'sanad_offline_queue'
];

/**
 * Cleans up disposable and bloated cache keys from localStorage
 */
export function cleanUpStorageQuota(): void {
  try {
    // 1. Remove known disposable / redundant keys
    for (const key of DISPOSABLE_OR_CACHE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }

    // 2. Trim audit logs to max 50 entries
    try {
      const logsRaw = localStorage.getItem('smart_accounting_audit_logs');
      if (logsRaw) {
        const logs = JSON.parse(logsRaw);
        if (Array.isArray(logs) && logs.length > 50) {
          localStorage.setItem('smart_accounting_audit_logs', JSON.stringify(logs.slice(0, 50)));
        }
      }
    } catch {}

    // 3. Check for any unusually large keys (>1MB) that aren't critical
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !k.startsWith('smart_accounting_') && !k.startsWith('sanad_license')) {
        try {
          const val = localStorage.getItem(k);
          if (val && val.length > 200000) {
            localStorage.removeItem(k);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[safeStorage] Cleanup error:', err);
  }
}

/**
 * Safely sets an item in localStorage with automatic quota recovery
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (firstError) {
    console.warn(`[safeStorage] Storage quota exceeded while saving "${key}". Running cleanup...`);
    
    // 1. Run aggressive cleanup
    cleanUpStorageQuota();

    // 2. If trying to save settings and it contains a huge logo, trim or optimize
    let valueToSave = value;
    if (key === 'smart_accounting_settings') {
      try {
        const parsed = JSON.parse(value);
        if (parsed.storeLogoUrl && parsed.storeLogoUrl.length > 100000) {
          // Truncate overly huge uncompressed data URL
          parsed.storeLogoUrl = '';
          valueToSave = JSON.stringify(parsed);
        }
      } catch {}
    }

    // 3. Retry setting item
    try {
      localStorage.setItem(key, valueToSave);
      return true;
    } catch (secondError) {
      console.error(`[safeStorage] Critical: Failed to save "${key}" even after cleanup:`, secondError);

      // 4. Last resort: Trim oldest invoices / transactions from local storage copy if needed
      try {
        if (key !== 'smart_accounting_settings' && key !== 'sanad_license') {
          // If saving invoices/transactions, slice oldest entries
          const parsedArr = JSON.parse(value);
          if (Array.isArray(parsedArr) && parsedArr.length > 20) {
            const trimmed = parsedArr.slice(0, 20);
            localStorage.setItem(key, JSON.stringify(trimmed));
            return true;
          }
        }
      } catch {}

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
