/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { soundManager } from './sound';
import { normalizeHWID, isUnboundHwid } from './firebase';

export interface LicenseInfo {
  licenseKey: string;
  status: 'trial' | 'active' | 'expired' | 'unlicensed';
  activatedAt: string;
  expiresAt: string;
  hwid: string;
  subscriptionType: 'monthly' | 'yearly' | 'lifetime' | 'trial';
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

// Generate deterministic Hardware ID (HWID)
export const generateHWID = (): string => {
  try {
    const existing = localStorage.getItem('smart_accounting_hwid');
    if (existing && existing.trim() !== '' && existing !== 'null' && existing !== 'undefined') {
      return existing.trim();
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
              localStorage.setItem('smart_accounting_hwid', hwid);
              return hwid;
            }
          } catch (e) {
            console.warn('Native Android device ID retrieval failed:', e);
          }
        }
      }
    }

    // 2. Deterministic Web Canvas Fingerprint + Screen & Browser Specs
    const canvasFp = getCanvasFingerprint();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const screenWidth = typeof window !== 'undefined' && window.screen ? window.screen.width || 1080 : 1080;
    const screenHeight = typeof window !== 'undefined' && window.screen ? window.screen.height || 1920 : 1920;
    const colorDepth = typeof window !== 'undefined' && window.screen ? window.screen.colorDepth || 24 : 24;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const language = typeof navigator !== 'undefined' ? navigator.language || 'ar' : 'ar';
    const timeZone = typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '';

    const signature = `CANVAS:${canvasFp}|UA:${userAgent}|SCR:${screenWidth}x${screenHeight}x${colorDepth}|CPU:${cores}|LANG:${language}|TZ:${timeZone}`;

    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
      const char = signature.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }

    const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    const hwid = `MHT-HWID-${hexHash}`;
    localStorage.setItem('smart_accounting_hwid', hwid);
    return hwid;
  } catch (err) {
    console.error('HWID generation exception:', err);
    const fallback = 'MHT-HWID-DEV-WEB-2026';
    try {
      localStorage.setItem('smart_accounting_hwid', fallback);
    } catch {}
    return fallback;
  }
};

export const getHWID = generateHWID;
export const getDeviceId = generateHWID;

// Generate cryptographically looking license key
export const generateLicenseKey = (type: 'monthly' | 'yearly' | 'lifetime' | 'trial'): string => {
  const prefix = type === 'monthly' ? 'MHTM' : type === 'yearly' ? 'MHTY' : type === 'lifetime' ? 'MHTL' : 'MHTT';
  const segment1 = Math.floor(1000 + Math.random() * 9000).toString();
  const segment2 = Math.floor(1000 + Math.random() * 9000).toString();
  const segment3 = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}-${segment1}-${segment2}-${segment3}`;
};

// Calculate expiry date based on type
export const getExpiryDate = (type: 'monthly' | 'yearly' | 'lifetime' | 'trial'): string => {
  const now = new Date();
  if (type === 'monthly') {
    now.setMonth(now.getMonth() + 1);
  } else if (type === 'yearly') {
    now.setFullYear(now.getFullYear() + 1);
  } else if (type === 'lifetime') {
    now.setFullYear(now.getFullYear() + 100);
  } else {
    now.setDate(now.getDate() + 7);
  }
  return now.toISOString();
};

const STORAGE_KEY = 'smart_accounting_license_v1';

// Save license info securely
export const saveLicenseLocally = (info: LicenseInfo) => {
  const jsonStr = JSON.stringify(info);
  const secureStr = obfuscate(jsonStr);
  localStorage.setItem(STORAGE_KEY, secureStr);
};

// Load license info safely
export const loadLicenseLocally = (): LicenseInfo => {
  const secureStr = localStorage.getItem(STORAGE_KEY);
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

  const rawJson = deobfuscate(secureStr);
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
    
    // Allow activation and avoid strict lock when key is newly entered or trial
    const isUnboundOrTrial = isUnboundHwid(info.hwid) || 
      info.subscriptionType === 'trial' || 
      !info.hwid || 
      info.licenseKey === '' ||
      info.licenseKey === 'MHTT-TRIAL-7DAY-FREE';

    const isMatchedDevice = isUnboundOrTrial || 
      info.hwid.split(',').some(h => normalizeHWID(h) === normalizeHWID(hwid));

    if (!isMatchedDevice && info.status === 'active') {
      return {
        ...info,
        status: 'unlicensed',
        licenseKey: 'ERR-DEVICE-MISMATCH'
      };
    }

    // Check expiry
    if (info.expiresAt) {
      const expDate = new Date(info.expiresAt);
      if (expDate < new Date()) {
        info.status = 'expired';
      }
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
