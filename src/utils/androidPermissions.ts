/**
 * Android & Web Runtime Permissions Manager for Sanad Accounting (نظام سند المحاسبي)
 * Handles Android APK / Webview / PWA runtime permissions without affecting Desktop/JVM builds.
 */

export interface AndroidPermissionStatus {
  notificationsGranted: boolean;
  cameraGranted: boolean;
  vibrateSupported: boolean;
  isAndroidDevice: boolean;
}

/**
 * Requests Android & Web permissions on application startup
 * (POST_NOTIFICATIONS, CAMERA, VIBRATE, STORAGE)
 */
export async function requestAndroidStartupPermissions(): Promise<AndroidPermissionStatus> {
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  let notificationsGranted = false;
  let cameraGranted = false;
  const vibrateSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  // 1. Android Native Webview / Bridge / Capacitor / Cordova call
  if (typeof window !== 'undefined' && (window as any).AndroidInterface?.requestPermissions === 'function') {
    try {
      (window as any).AndroidInterface.requestPermissions([
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.CAMERA',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.VIBRATE'
      ]);
    } catch (e) {
      console.warn('Android Native Bridge call warning:', e);
    }
  }

  // 2. Web Notifications Permission Request (for Android Chrome / PWA / Webview)
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        notificationsGranted = result === 'granted';
      } else {
        notificationsGranted = Notification.permission === 'granted';
      }
    } catch (e) {
      console.warn('Notification permission request error:', e);
    }
  }

  // 3. Camera permission check if query API is supported
  if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
    try {
      const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      cameraGranted = cameraStatus.state === 'granted';
    } catch (e) {
      // Permission API for camera may not be supported on all browsers
    }
  }

  return {
    notificationsGranted,
    cameraGranted,
    vibrateSupported,
    isAndroidDevice: isAndroid,
  };
}
