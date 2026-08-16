/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

/**
 * Safely opens external URLs (http, https, tel, sms, whatsapp) across Web and Native Capacitor APK
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;

  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Primary attempt via Capacitor AppLauncher plugin
      const canOpen = await AppLauncher.canOpenUrl({ url }).catch(() => ({ value: true }));
      if (canOpen.value) {
        await AppLauncher.openUrl({ url });
        return true;
      }
    } catch {
      // Fallback
    }

    // 2. Secondary attempt via window.open / system intent
    try {
      window.open(url, '_system') || (window.location.href = url);
      return true;
    } catch {
      // Fallback
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
  } catch {
    return false;
  }
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
    } catch {
      // Fallback
    }

    // B) Try API URL via AppLauncher
    try {
      await AppLauncher.openUrl({ url: whatsappApiUrl });
      return true;
    } catch {
      // Fallback
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
 * Safely triggers SMS intent
 */
export async function openSms(phone: string, text: string = ''): Promise<boolean> {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const encodedText = encodeURIComponent(text);
  const smsUrl = `sms:${cleanPhone}?body=${encodedText}`;
  return openExternalUrl(smsUrl);
}

