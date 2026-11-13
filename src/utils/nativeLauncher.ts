/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { Share } from '@capacitor/share';
import { showToast } from './toast';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Operation timed out')), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function triggerAnchorLink(url: string, openInNewTab: boolean): boolean {
  try {
    const link = document.createElement('a');
    link.href = url;
    if (openInNewTab) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 300);
    return true;
  } catch {
    return false;
  }
}

export function normalizePhoneForWhatsApp(phone: string): string {
  let clean = (phone || '').replace(/[^\d]/g, '');
  if (clean.startsWith('00')) {
    clean = clean.slice(2);
  }
  // Local Yemeni mobile numbers (9 digits starting with 77, 73, 71, 70, 78)
  if (
    clean.length === 9 &&
    (clean.startsWith('77') ||
      clean.startsWith('73') ||
      clean.startsWith('71') ||
      clean.startsWith('70') ||
      clean.startsWith('78'))
  ) {
    clean = '967' + clean;
  }
  return clean;
}

/**
 * Safely opens external URLs (http, https, tel, sms, whatsapp) across Web, Mobile PWA, and Capacitor APK
 * Guaranteed never to hang on unresponsive native bridges or popup-blocked WebViews.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;

  const isNative = Capacitor.isNativePlatform();
  const isLocalScheme = url.startsWith('tel:') || url.startsWith('sms:') || url.startsWith('mailto:');

  if (isNative) {
    try {
      await withTimeout(AppLauncher.openUrl({ url }), 2200);
      return true;
    } catch {
      // Fall through to WebView anchor fallback below
    }
  }

  // On Mobile PWA / WebView / Desktop:
  // Use hidden <a> click instead of window.open (window.open is blocked in standalone PWAs & iframes)
  if (isLocalScheme) {
    return triggerAnchorLink(url, false);
  }

  return triggerAnchorLink(url, true);
}

/**
 * Safely triggers WhatsApp messaging without hanging on APK or Mobile PWA
 */
export async function openWhatsApp(phone: string, text: string = ''): Promise<boolean> {
  const finalPhone = normalizePhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(text || '');

  const whatsappApiUrl = finalPhone
    ? `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  const whatsappSchemeUrl = finalPhone
    ? `whatsapp://send?phone=${finalPhone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;

  if (Capacitor.isNativePlatform()) {
    // 1. Try direct whatsapp:// intent (with strict 1.8s timeout so Android 11+ never hangs)
    try {
      const canOpen = await withTimeout(
        AppLauncher.canOpenUrl({ url: whatsappSchemeUrl }).catch(() => ({ value: true })),
        900
      );
      if (canOpen?.value) {
        await withTimeout(AppLauncher.openUrl({ url: whatsappSchemeUrl }), 1800);
        return true;
      }
    } catch {
      // Fall through to universal HTTPS API link
    }

    // 2. Try universal api.whatsapp.com via AppLauncher
    try {
      await withTimeout(AppLauncher.openUrl({ url: whatsappApiUrl }), 2000);
      return true;
    } catch {
      // Fall through to Native Share Sheet
    }

    // 3. Fallback to Android Share Sheet with the text so user can pick WhatsApp directly
    if (text) {
      try {
        await withTimeout(
          Share.share({
            title: 'إرسال عبر واتساب',
            text,
            dialogTitle: 'اختر واتساب للإرسال',
          }),
          8000
        );
        return true;
      } catch {
        // Ignore cancel/timeout
      }
    }
  }

  // 4. Web / Mobile PWA / Standalone WebView:
  // Always use HTTPS Universal Link in a safe <a target="_blank" rel="noopener noreferrer">
  // so Android/iOS opens the WhatsApp app smoothly without closing or freezing the PWA.
  const opened = triggerAnchorLink(whatsappApiUrl, true);
  if (!opened && text && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('تم نسخ نص الرسالة للحافظة — يمكنك لصقه في واتساب مباشرة', 'info');
      return true;
    } catch {
      // Ignore
    }
  }
  return opened;
}

/**
 * Safely triggers Phone Dialer intent
 */
export async function openPhoneCall(phone: string): Promise<boolean> {
  const cleanPhone = phone ? phone.replace(/[^\d+]/g, '') : '';
  if (!cleanPhone) {
    showToast('يرجى إدخال رقم هاتف صحيح للاتصال', 'warning');
    return false;
  }
  return openExternalUrl(`tel:${cleanPhone}`);
}

/**
 * Safely triggers SMS intent across Android, iOS PWA, and Native Capacitor APK
 */
export async function openSms(phone: string, text: string = ''): Promise<boolean> {
  const cleanPhone = phone ? phone.replace(/[^\d+]/g, '') : '';
  const encodedText = encodeURIComponent(text || '');
  const isIOS =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent || '');

  // iOS uses '&body=' whereas Android uses '?body='
  const separator = isIOS ? '&' : '?';
  const smsUrl = `sms:${cleanPhone}${encodedText ? `${separator}body=${encodedText}` : ''}`;

  if (Capacitor.isNativePlatform()) {
    try {
      await withTimeout(AppLauncher.openUrl({ url: smsUrl }), 2000);
      return true;
    } catch {
      // Try smsto: scheme on Android if sms: failed
      if (!isIOS) {
        try {
          await withTimeout(
            AppLauncher.openUrl({ url: `smsto:${cleanPhone}?body=${encodedText}` }),
            2000
          );
          return true;
        } catch {
          // Fall through
        }
      }
    }
  }

  // Copy text quietly as emergency fallback if device has no SMS app (e.g. desktop/tablet)
  const opened = triggerAnchorLink(smsUrl, false);
  const isMobile =
    typeof navigator !== 'undefined' &&
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');

  if (!isMobile && text && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('تم تجهيز تطبيق الرسائل ونسخ النص احتياطياً في الحافظة', 'info');
    } catch {
      // Ignore
    }
  } else if (!opened && text && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('تعذر فتح تطبيق الرسائل مباشرة — تم نسخ النص إلى الحافظة', 'warning');
    } catch {
      showToast('تعذر فتح تطبيق الرسائل على هذا الجهاز', 'warning');
    }
  }

  return opened;
}
