/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { soundManager } from './sound';
import { normalizeHWID, isUnboundHwid } from './firebase';
import { safeStorage } from './safeStorage';

export interface LicenseInfo {
  licenseKey: string;
  status: 'trial' | 'active' | 'expired' | 'unlicensed';
  activatedAt: string;
  expiresAt: string;
  hwid: string;
  subscriptionType: 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'trial';
  customerName?: string;
  phone?: string;
}

// Simple XOR / Base64 obfuscation helper for securing local licenses (UTF-8 safe)
const obfuscate = (text: string): string => {
  try {
    const utf8Text = encodeURIComponent(text);
    const xorText = utf8Text.split('').map((char, index) => {
      return String.fromCharCode(char.charCodeAt(0) ^ (13 + index % 5));
    }).join('');
    return btoa(xorText);
  } catch (e) {
    console.error('Obfuscation failed:', e);
    return '';
  }
};

const deobfuscate = (obfuscated: string): string => {
  try {
    const raw = atob(obfuscated);
    const utf8Text = raw.split('').map((char, index) => {
      return String.fromCharCode(char.charCodeAt(0) ^ (13 + index % 5));
    }).join('');
    return decodeURIComponent(utf8Text);
  } catch {
    return '';
  }
};

// Canvas fingerprint generator for web devices
const getCanvasFingerprint = (): string => {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial", "Segoe UI", sans-serif';
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(100, 5, 80, 30);
    
    ctx.fillStyle = '#0F172A';
    ctx.fillText('MHT-ACCOUNTING-SYSTEM-2026', 2, 15);
    
    ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
    ctx.font = '16px "Times New Roman", serif';
    ctx.fillText('SAND-SAAS-LICENSE-VERIFIED', 4, 32);

    ctx.beginPath();
    ctx.arc(50, 50, 10, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL();
  } catch {
    return '';
  }
};

// Generate deterministic Hardware ID (HWID) with multi-device binding support and resilient multi-storage persistence
export const generateHWID = (): string => {
  try {
    // 0. Check multi-storage persistent cache first
    const fromLocal = localStorage.getItem('smart_accounting_hwid');
    if (fromLocal && fromLocal.trim() !== '' && fromLocal !== 'null' && fromLocal !== 'undefined') {
      return fromLocal.trim();
    }
    const fromSafe = safeStorage.getItem('smart_accounting_hwid');
    if (fromSafe && fromSafe.trim() !== '' && fromSafe !== 'null' && fromSafe !== 'undefined') {
      try { localStorage.setItem('smart_accounting_hwid', fromSafe.trim()); } catch {}
      return fromSafe.trim();
    }
    const fromBackup = localStorage.getItem('sanad_permanent_device_id');
    if (fromBackup && fromBackup.trim() !== '' && fromBackup !== 'null' && fromBackup !== 'undefined') {
      try {
        localStorage.setItem('smart_accounting_hwid', fromBackup.trim());
        safeStorage.setItem('smart_accounting_hwid', fromBackup.trim());
      } catch {}
      return fromBackup.trim();
    }

    // 1. Android Native ID (WebView)
    if (typeof window !== 'undefined') {
      const androidObj = (window as any).AndroidInterface || (window as any).Android;
      if (androidObj) {
        const getNativeId = androidObj.getDeviceId || androidObj.getAndroidId;
        if (typeof getNativeId === 'function') {
          try {
            const nativeId = getNativeId.call(androidObj);
            if (nativeId && typeof nativeId === 'string' && nativeId.trim().length > 0 && nativeId !== 'null' && nativeId !== 'undefined') {
              // 🎯 تقليم وتنظيف معرف الجوال الطويل ليتوافق تماماً مع قواعد الفايربيس والويب
              const cleanNative = nativeId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
              const shortNative = cleanNative.length > 12 ? cleanNative.substring(0, 12) : cleanNative;
              
              const hwid = `MHT-HWID-${shortNative}`;
              try {
                localStorage.setItem('smart_accounting_hwid', hwid);
                safeStorage.setItem('smart_accounting_hwid', hwid);
                localStorage.setItem('sanad_permanent_device_id', hwid);
              } catch {}
              return hwid;
            }
          } catch (e) {
            console.warn('Native Android device ID retrieval failed:', e);
          }
        }
      }
    }

    // 2. Deterministic Browser Specs (Stable, excludes dynamic canvas variations across sessions)
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const screenWidth = typeof window !== 'undefined' && window.screen ? window.screen.width || 1080 : 1080;
    const screenHeight = typeof window !== 'undefined' && window.screen ? window.screen.height || 1920 : 1920;
    const colorDepth = typeof window !== 'undefined' && window.screen ? window.screen.colorDepth || 24 : 24;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const language = typeof navigator !== 'undefined' ? (navigator.language || 'ar').split('-')[0] : 'ar';
    const timeZone = typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '';

    const signature = `UA:${userAgent}|SCR:${screenWidth}x${screenHeight}x${colorDepth}|CPU:${cores}|LANG:${language}|TZ:${timeZone}`;

    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
      const char = signature.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }

    const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    const hwid = `MHT-HWID-${hexHash}`;
    try {
      localStorage.setItem('smart_accounting_hwid', hwid);
      safeStorage.setItem('smart_accounting_hwid', hwid);
      localStorage.setItem('sanad_permanent_device_id', hwid);
    } catch {}
    return hwid;
  } catch (err) {
    console.error('HWID generation exception:', err);
    const fallback = 'MHT-HWID-DEV-WEB-2026';
    try {
      localStorage.setItem('smart_accounting_hwid', fallback);
      safeStorage.setItem('smart_accounting_hwid', fallback);
    } catch {}
    return fallback;
  }
};

export const getHWID = generateHWID;
export const getDeviceId = generateHWID;

// Generate cryptographically looking license key
export const generateLicenseKey = (type: 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'trial'): string => {
  const prefix = type === 'weekly' ? 'MHTW' : type === 'monthly' ? 'MHTM' : type === 'yearly' ? 'MHTY' : type === 'lifetime' ? 'MHTL' : 'MHTT';
  const segment1 = Math.floor(1000 + Math.random() * 9000).toString();
  const segment2 = Math.floor(1000 + Math.random() * 9000).toString();
  const segment3 = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}-${segment1}-${segment2}-${segment3}`;
};

// Calculate expiry date based on type
export const getExpiryDate = (type: 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'trial' | 'custom', customDays?: number): string => {
  const now = new Date();
  if (type === 'custom' && customDays && customDays > 0) {
    now.setDate(now.getDate() + customDays);
  } else if (type === 'weekly' || type === 'trial') {
    now.setDate(now.getDate() + 7);
  } else if (type === 'monthly' || type === 'custom') {
    now.setDate(now.getDate() + 30);
  } else if (type === 'yearly') {
    now.setDate(now.getDate() + 365);
  } else if (type === 'lifetime') {
    now.setFullYear(now.getFullYear() + 100);
  } else {
    now.setDate(now.getDate() + 30);
  }
  return now.toISOString();
};

const STORAGE_KEY = 'smart_accounting_license_v1';
const BACKUP_STORAGE_KEY = 'sanad_backup_license_record';

// Save license info securely with redundancy
export const saveLicenseLocally = (info: LicenseInfo) => {
  try {
    const jsonStr = JSON.stringify(info);
    const secureStr = obfuscate(jsonStr);
    safeStorage.setItem(STORAGE_KEY, secureStr);
    try {
      localStorage.setItem(STORAGE_KEY, secureStr);
      localStorage.setItem(BACKUP_STORAGE_KEY, secureStr);
    } catch {}
  } catch (e) {
    console.error('Error saving license locally:', e);
  }
};

// Load license info safely with multi-layer fallback
export const loadLicenseLocally = (): LicenseInfo => {
  let secureStr = safeStorage.getItem(STORAGE_KEY);
  if (!secureStr && typeof localStorage !== 'undefined') {
    secureStr = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(BACKUP_STORAGE_KEY);
  }

  const hwid = generateHWID();

  if (!secureStr) {
    const unlicensedLicense: LicenseInfo = {
      licenseKey: '',
      status: 'unlicensed',
      activatedAt: '',
      expiresAt: '',
      hwid,
      subscriptionType: 'trial',
      customerName: 'غير مرخص'
    };
    saveLicenseLocally(unlicensedLicense);
    return unlicensedLicense;
  }

  let rawJson = deobfuscate(secureStr);
  if (!rawJson && typeof localStorage !== 'undefined') {
    const backupStr = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (backupStr) rawJson = deobfuscate(backupStr);
  }

  if (!rawJson) {
    return {
      licenseKey: '',
      status: 'unlicensed',
      activatedAt: '',
      expiresAt: '',
      hwid,
      subscriptionType: 'trial'
    };
  }

  try {
    const info: LicenseInfo = JSON.parse(rawJson);
    
    // Check expiry first
    if (info.expiresAt && info.subscriptionType !== 'lifetime') {
      const expDate = new Date(info.expiresAt);
      if (expDate < new Date()) {
        info.status = 'expired';
      }
    }

    // Once a license is saved and active locally, don't arbitrarily invalidate it
    // because this local storage copy belongs to THIS device.
    if (info.status === 'active' && info.licenseKey && !info.hwid) {
      info.hwid = hwid;
      saveLicenseLocally(info);
    }

    return info;
  } catch {
    return {
      licenseKey: '',
      status: 'unlicensed',
      activatedAt: '',
      expiresAt: '',
      hwid,
      subscriptionType: 'trial'
    };
  }
};
