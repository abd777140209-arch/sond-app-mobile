/**
 * Android & Web Runtime Permissions Manager for Sanad Accounting (نظام سند المحاسبي)
 * Handles Android APK / Webview / PWA runtime permissions without affecting Desktop/JVM builds.
 */

import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export interface AndroidPermissionStatus {
  notificationsGranted: boolean;
  cameraGranted: boolean;
  vibrateSupported: boolean;
  isAndroidDevice: boolean;
}

/**
 * Requests Android & Web permissions ONLY on user action (e.g. clicking camera / barcode scanner button)
 * Prevents intrusive permission popups on initial application launch.
 */
export async function requestCameraPermissionOnDemand(): Promise<boolean> {
  let granted = false;

  // 1. Native Android WebView / Bridge call
  if (typeof window !== 'undefined' && (window as any).AndroidInterface?.requestPermissions === 'function') {
    try {
      (window as any).AndroidInterface.requestPermissions(['android.permission.CAMERA']);
    } catch {
      // Safe fallback
    }
  }

  // 2. Browser MediaDevices request
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      granted = true;
    } catch {
      granted = false;
    }
  }

  return granted;
}

/**
 * Requests Android Storage/Media permissions ONLY on user action (e.g. exporting PDF, printing, uploading attachment)
 * Prevents app crashes during logo upload or report export.
 */
export async function requestStoragePermissionOnDemand(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const req = await Filesystem.requestPermissions();
      return req.publicStorage === 'granted';
    } catch {
      // Safe fallback
    }
  }

  if (typeof window !== 'undefined' && (window as any).AndroidInterface?.requestPermissions === 'function') {
    try {
      (window as any).AndroidInterface.requestPermissions([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES'
      ]);
      return true;
    } catch {
      // Safe fallback
    }
  }
  return true;
}

/**
 * Passive startup check - does NOT pop up permission dialogs automatically on boot.
 */
export async function requestAndroidStartupPermissions(): Promise<AndroidPermissionStatus> {
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const vibrateSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  return {
    notificationsGranted: typeof Notification !== 'undefined' && Notification.permission === 'granted',
    cameraGranted: false,
    vibrateSupported,
    isAndroidDevice: isAndroid,
  };
}
