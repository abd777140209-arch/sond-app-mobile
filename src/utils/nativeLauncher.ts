/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { Share } from '@capacitor/share';

/**
 * Safely opens external URLs (http, https, tel, sms, whatsapp) across Web and Native Capacitor APK
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;

  console.log('[NativeLauncher] Attempting to launch URL:', url);

  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Primary attempt via Capacitor AppLauncher plugin
      const canOpen = await AppLauncher.canOpenUrl({ url }).catch(() => ({ value: true }));
      if (canOpen.value) {
        await AppLauncher.openUrl({ url });
        return true;
      }
    } catch (e) {
      console.warn('[NativeLauncher] AppLauncher error:', e);
    }

    // 2. Secondary attempt via window.location / system intent
    try {
      window.location.href = url;
      return true;
    } catch (e) {
      console.warn('[NativeLauncher] System open fallback warning:', e);
    }
  }

  // 3. Web Browser / WebView Fallback
  try {
    if (url.startsWith('tel:') || url.startsWith('sms:')) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer') || (window.location.href = url);
    }
    return true;
  } catch (err) {
    console.error('[NativeLauncher] All launch attempts failed:', err);
    alert(`⚠️ تعذر إطلاق التطبيق المطلوب تلقائياً.\nالرابط: ${url}`);
    return false;
  }
}

/**
 * Safely triggers Native Share dialog or falls back to navigator.share / clipboard
 */
export async function nativeShareText(title: string, text: string, url?: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title,
        text,
        url,
        dialogTitle: title
      });
      return true;
    } catch (err: any) {
      const errStr = String(err?.message || err || '').toLowerCase();
      if (errStr.includes('cancel') || errStr.includes('dismiss') || errStr.includes('user_canceled')) {
        return true;
      }
      console.warn('[NativeLauncher] Share error:', err);
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (e) {
      console.warn('[NativeLauncher] Navigator share error:', e);
    }
  }

  // Clipboard fallback
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${title}\n${text} ${url || ''}`);
      alert('📋 تم نسخ النص بنجاح إلى الحافظة!');
      return true;
    }
  } catch (e) {}

  return false;
}

/**
 * Safely triggers WhatsApp messaging intent
 */
export async function openWhatsApp(phone: string, text: string = ''): Promise<boolean> {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  let finalPhone = cleanPhone;
  if (cleanPhone.startsWith('77') || cleanPhone.startsWith('73') || cleanPhone.startsWith('71') || cleanPhone.startsWith('70')) {
    finalPhone = '967' + cleanPhone;
  }
  const encodedText = encodeURIComponent(text);

  // HTTPS Universal API Link
  const whatsappApiUrl = finalPhone 
    ? `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  // Direct App Scheme for Android Intent
  const whatsappSchemeUrl = finalPhone
    ? `whatsapp://send?phone=${finalPhone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;

  if (Capacitor.isNativePlatform()) {
    // A) Try Direct App Scheme
    try {
      const canOpenScheme = await AppLauncher.canOpenUrl({ url: whatsappSchemeUrl }).catch(() => ({ value: false }));
      if (canOpenScheme.value) {
        await AppLauncher.openUrl({ url: whatsappSchemeUrl });
        return true;
      }
    } catch (e) {
      console.warn('[WhatsApp] Scheme check warning:', e);
    }

    // B) Try API URL via AppLauncher
    try {
      await AppLauncher.openUrl({ url: whatsappApiUrl });
      return true;
    } catch (e) {
      console.warn('[WhatsApp] API launch warning:', e);
    }
  }

  return openExternalUrl(whatsappApiUrl);
}

/**
 * Safely triggers Phone Dialer intent
 */
export async function openPhoneCall(phone: string): Promise<boolean> {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  if (!cleanPhone) {
    alert('⚠️ يرجى إدخال رقم هاتف صحيح للاتصال.');
    return false;
  }
  const telUrl = `tel:${cleanPhone}`;
  return openExternalUrl(telUrl);
}

/**
 * Safely triggers SMS intent directly via native Android app launcher or system intent
 */
export async function openSms(phone: string, text: string = ''): Promise<boolean> {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const encodedText = encodeURIComponent(text);
  const smsUrl = cleanPhone 
    ? `sms:${cleanPhone}?body=${encodedText}`
    : `sms:?body=${encodedText}`;

  if (Capacitor.isNativePlatform()) {
    try {
      const canOpen = await AppLauncher.canOpenUrl({ url: smsUrl }).catch(() => ({ value: true }));
      if (canOpen.value) {
        await AppLauncher.openUrl({ url: smsUrl });
        return true;
      }
    } catch (e) {
      console.warn('[NativeLauncher] AppLauncher SMS launch error:', e);
    }
  }

  return openExternalUrl(smsUrl);
}

