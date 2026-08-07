/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';

/**
 * Safely opens external URLs (http, https, tel, sms, whatsapp) across Web and Native Capacitor APK without freezing or crashing
 */
export function openExternalUrl(url: string): void {
  if (!url) return;
  try {
    if (Capacitor.isNativePlatform()) {
      // In Capacitor Native, window.open(url, '_system') opens via Android System Intent
      window.open(url, '_system') || (window.location.href = url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (e) {
    console.warn('Error launching URL via native handler:', e);
    try {
      window.location.href = url;
    } catch (err) {
      console.error('Fallback location setting failed:', err);
    }
  }
}

/**
 * Safely triggers WhatsApp messaging intent
 */
export function openWhatsApp(phone: string, text: string = ''): void {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  let finalPhone = cleanPhone;
  if (cleanPhone.startsWith('77') || cleanPhone.startsWith('73') || cleanPhone.startsWith('71') || cleanPhone.startsWith('70')) {
    finalPhone = '967' + cleanPhone;
  }
  const encodedText = encodeURIComponent(text);
  const whatsappUrl = finalPhone 
    ? `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
    
  openExternalUrl(whatsappUrl);
}

/**
 * Safely triggers Phone Dialer intent
 */
export function openPhoneCall(phone: string): void {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  if (!cleanPhone) return;
  openExternalUrl(`tel:${cleanPhone}`);
}

/**
 * Safely triggers SMS intent
 */
export function openSms(phone: string, text: string = ''): void {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const encodedText = encodeURIComponent(text);
  openExternalUrl(`sms:${cleanPhone}?body=${encodedText}`);
}
