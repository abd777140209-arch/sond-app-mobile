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

// Generate deterministic Hardware ID (HWID) based on browser features to bind software
export const generateHWID = (): string => {
  let existing = localStorage.getItem('smart_accounting_hwid');
  if (existing) return existing;

  const userAgent = navigator.userAgent;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const cores = navigator.hardwareConcurrency || 4;
  const language = navigator.language || 'en';
  
  // Create a combined string
  const combined = `${userAgent}-${screenWidth}x${screenHeight}-${cores}-${language}`;
  
  // Calculate a simple hash
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  const rawHwid = `MHT-HWID-${Math.abs(hash).toString(16).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  localStorage.setItem('smart_accounting_hwid', rawHwid);
  return rawHwid;
};

// Generate cryptographically looking license key (useful for Abdulmajeed's admin panel)
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
    now.setFullYear(now.getFullYear() + 100); // 100 years
  } else {
    // 7 days trial
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

// Load license info
export const loadLicenseLocally = (): LicenseInfo => {
  const secureStr = localStorage.getItem(STORAGE_KEY);
  const hwid = generateHWID();

  if (!secureStr) {
    // First time setup - NO auto trial! Must request a license or trial key from m. abdulmajeed
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
    // If corrupted or unreadable, do not self-heal with free license, stay unlicensed
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
    
    // Safety check: verify if the license belongs to this device HWID
    // (Anti-copying security!)
    if (!isUnboundHwid(info.hwid) && normalizeHWID(info.hwid) !== normalizeHWID(hwid) && info.licenseKey !== 'TRIAL-VERSION-FREE') {
      // Device ID mismatch! Lock the application.
      return {
        ...info,
        status: 'unlicensed',
        licenseKey: 'ERR-DEVICE-MISMATCH'
      };
    }

    // Check expiry
    const expDate = new Date(info.expiresAt);
    if (expDate < new Date()) {
      info.status = 'expired';
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
