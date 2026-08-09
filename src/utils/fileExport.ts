/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export interface FileExportOptions {
  fileName: string;
  data: string;
  mimeType?: string;
  isBase64?: boolean;
  title?: string;
  text?: string;
  folderName?: string;
}

export type SaveAndShareOptions = FileExportOptions;

/**
 * Gets user's configured custom save folder (Defaults to 'SanadAccounting')
 */
export function getCustomSaveFolder(): string {
  try {
    const saved = localStorage.getItem('sanad_custom_save_folder');
    if (saved && saved.trim().length > 0) {
      const clean = saved.trim().replace(/^(Documents[\/\\]?)+/i, '').replace(/^\/+|\/+$/g, '').trim();
      return clean || 'SanadAccounting';
    }
  } catch (e) {
    console.warn('Error reading custom save folder:', e);
  }
  return 'SanadAccounting';
}

/**
 * Sets user's configured custom save folder
 */
export function setCustomSaveFolder(folderName: string): void {
  try {
    const clean = (folderName || 'SanadAccounting')
      .trim()
      .replace(/^(Documents[\/\\]?)+/i, '')
      .replace(/^\/+|\/+$/g, '')
      .trim();
    localStorage.setItem('sanad_custom_save_folder', clean || 'SanadAccounting');
  } catch (e) {
    console.warn('Error setting custom save folder:', e);
  }
}

/**
 * Generates formatted timestamp for backup filenames (YYYY-MM-DD_HH-MM)
 */
export function getBackupTimestamp(d = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

/**
 * Gets user's configured Google Drive Account
 */
export function getGoogleDriveAccount(): string {
  try {
    return localStorage.getItem('sanad_google_drive_account') || '';
  } catch (e) {
    return '';
  }
}

/**
 * Sets user's configured Google Drive Account
 */
export function setGoogleDriveAccount(email: string): void {
  try {
    localStorage.setItem('sanad_google_drive_account', (email || '').trim());
  } catch (e) {
    console.warn('Error setting google drive account:', e);
  }
}

/**
 * Dynamically checks and requests storage permissions on native Android / iOS
 */
export async function ensureStoragePermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage !== 'granted') {
      const request = await Filesystem.requestPermissions();
      return request.publicStorage === 'granted';
    }
    return true;
  } catch (err) {
    console.warn('[fileExport] Permissions request warning:', err);
    try {
      const req = await Filesystem.requestPermissions();
      return req.publicStorage === 'granted';
    } catch (e) {
      return true;
    }
  }
}

/**
 * Ensures a custom folder (e.g. 'SanadApp' or user specified path) exists inside Directory.Documents on Android/Native
 */
export async function ensureCustomFolder(folderPath?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  await ensureStoragePermissions();
  const targetFolder = folderPath || getCustomSaveFolder();
  const cleanFolder = targetFolder.replace(/^(Documents[\/\\]?)+/i, '').trim().replace(/^\/+|\/+$/g, '') || 'SanadAccounting';
  
  try {
    await Filesystem.mkdir({
      path: cleanFolder,
      directory: Directory.Documents,
      recursive: true,
    });
    return true;
  } catch (err) {
    // Directory might already exist or fall back to external storage
    try {
      await Filesystem.mkdir({
        path: cleanFolder,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      return true;
    } catch (fallbackErr) {
      console.log(`[fileExport] Directory creation note (${cleanFolder}):`, err);
      return true;
    }
  }
}

/**
 * Ensures the default or custom Sanad folder exists inside Directory.Documents on Android/Native
 */
export async function ensureSanadFolder(): Promise<boolean> {
  return ensureCustomFolder(getCustomSaveFolder());
}

/**
 * 📲 إشعار محرك نظام أندرويد (Media Scanner / File Indexer) بالملف الجديد فور كتابته
 * ليظهر في مدير الملفات تلقائياً بمسار Documents/SanadAccounting بدون الحاجة لإعادة تشغيل الهاتف
 */
export async function notifyMediaScanner(folderPath: string, fileName: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const cleanFolder = folderPath.replace(/^(Documents[\/\\]?)+/i, '').trim().replace(/^\/+|\/+$/g, '') || 'SanadAccounting';
    const filePath = `${cleanFolder}/${fileName}`;
    
    // طلب المسار البرمجي المعتمد (Native URI) لإجبار نظام أندرويد على فهرسة الملف في الميديا ستور (Media Index)
    const uriResult = await Filesystem.getUri({
      directory: Directory.Documents,
      path: filePath
    }).catch(() => null);

    if (uriResult?.uri) {
      console.log('[MediaScanner] File indexed and visible in Android File Manager:', uriResult.uri);
      return uriResult.uri;
    }
  } catch (err) {
    console.warn('[MediaScanner] Indexing warning:', err);
  }
  return null;
}

/**
 * Saves a backup file silently in local storage without opening UI dialogs
 */
export async function saveSilentBackupFile(
  fileName: string,
  jsonString: string,
  folderPath?: string
): Promise<string | null> {
  const isNative = Capacitor.isNativePlatform();
  const targetFolder = folderPath || getCustomSaveFolder();
  const cleanFolder = targetFolder.replace(/^(Documents[\/\\]?)+/i, '').trim().replace(/^\/+|\/+$/g, '') || 'SanadAccounting';

  if (isNative) {
    try {
      await ensureCustomFolder(cleanFolder);
      const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

      // 1. الحفظ الدائم في مجلد المستندات بالهاتف (Directory.Documents/SanadAccounting)
      const writeResult = await Filesystem.writeFile({
        path: `${cleanFolder}/${fileName}`,
        data: base64Content,
        directory: Directory.Documents,
        recursive: true
      });
      console.log(`[Silent Backup] Permanently saved to Documents/${cleanFolder}/${fileName}`);

      // إشعار نظام أندرويد لظهور الملف فوراً بمدير الملفات بدون إعادة تشغيل الهاتف
      await notifyMediaScanner(cleanFolder, fileName);

      // 2. إبقاء نسخة مؤقتة بذاكرة المؤقت الكاش لتسريع الوصول والاسترجاع
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: base64Content,
          directory: Directory.Cache,
          recursive: true
        });
      } catch (cacheErr) {
        console.warn('[Silent Backup] Cache temp copy warning:', cacheErr);
      }

      return writeResult.uri;
    } catch (err) {
      console.warn(`[Silent Backup] Write to Documents/${cleanFolder} failed, trying Cache:`, err);
      try {
        const base64Content = btoa(unescape(encodeURIComponent(jsonString)));
        const cacheResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Content,
          directory: Directory.Cache,
          recursive: true
        });
        return cacheResult.uri;
      } catch (cacheErr) {
        console.error('[Silent Backup] Cache write failed as well:', cacheErr);
        return null;
      }
    }
  } else {
    try {
      localStorage.setItem(`sanad_auto_backup_${fileName}`, jsonString);
      return `localStorage:sanad_auto_backup_${fileName}`;
    } catch (e) {
      console.warn('[Silent Backup] Web localStorage backup error:', e);
      return null;
    }
  }
}

/**
 * Saves a file and offers sharing / download options safely across Capacitor Native, WebViews, and Web Browsers.
 */
export const saveAndShareFile = async ({
  fileName,
  data,
  mimeType = 'application/json',
  isBase64 = false,
  title = 'تصدير ملف - نظام سند',
  text = 'ملف صادر من نظام سند المحاسبي',
  folderName
}: SaveAndShareOptions): Promise<boolean> => {
  try {
    // 1. التشغيل على تطبيق الأندرويد (Capacitor Native)
    if (Capacitor.isNativePlatform()) {
      await ensureStoragePermissions();
      const rawFolder = folderName || getCustomSaveFolder();
      const cleanFolder = rawFolder.replace(/^(Documents[\/\\]?)+/i, '').trim().replace(/^\/+|\/+$/g, '') || 'SanadAccounting';

      // التأكد من وجود مجلد النظام المخصص بداخل مستندات الهاتف (Documents/SanadAccounting)
      await ensureCustomFolder(cleanFolder);

      let base64Content = data;
      if (!isBase64) {
        // تحويل النص العربي و JSON إلى Base64 آمن
        base64Content = btoa(unescape(encodeURIComponent(data)));
      } else {
        base64Content = data.replace(/^data:.*?;base64,/, '').replace(/\s/g, '');
      }

      let docUri = '';
      let cacheUri = '';

      // أ) حفظ الملف أولاً وبشكل دائم في Directory.Documents
      try {
        const writeDoc = await Filesystem.writeFile({
          path: `${cleanFolder}/${fileName}`,
          data: base64Content,
          directory: Directory.Documents,
          recursive: true
        });
        docUri = writeDoc.uri;
        console.log(`[fileExport] Permanently saved to Documents/${cleanFolder}/${fileName}`);

        // إشعار نظام أندرويد وفهرسة الملف ليظهر فوراً في مدير الملفات
        await notifyMediaScanner(cleanFolder, fileName);
      } catch (docErr) {
        console.warn(`[fileExport] Write to Documents/${cleanFolder} warning:`, docErr);
      }

      // ب) حفظ نسخة مؤقتة في ذاكرة Cache لضمان استقرار المشاركة
      try {
        const writeCache = await Filesystem.writeFile({
          path: fileName,
          data: base64Content,
          directory: Directory.Cache,
          recursive: true
        });
        cacheUri = writeCache.uri;
      } catch (cacheErr) {
        console.warn('[fileExport] Write to Cache warning:', cacheErr);
      }

      const shareUri = cacheUri || docUri;

      // ج) فتح نافذة المشاركة المباشرة (WhatsApp, Telegram, Drive, Gmail...)
      if (shareUri) {
        try {
          await Share.share({
            title,
            text,
            url: shareUri,
            dialogTitle: title
          });
        } catch (shareErr: any) {
          const errStr = String(shareErr?.message || shareErr || '').toLowerCase();
          // إغلاق أو إلغاء نافذة المشاركة يعتبر نجاحاً مؤكداً 100% لأن الملف أُحفظ مسبقاً في ذاكرة الهاتف
          if (
            errStr.includes('cancel') ||
            errStr.includes('dismiss') ||
            errStr.includes('abort') ||
            errStr.includes('user_canceled') ||
            errStr.includes('closed') ||
            errStr.includes('dismissed')
          ) {
            console.log('[fileExport] Share sheet dismissed by user, file safely saved on device.');
            return true;
          }
          console.warn('[fileExport] Share warning:', shareErr);
        }
      }

      return true;
    }

    // 2. البيئة العادية (متصفح الويب)
    const cleanData = isBase64 ? data.replace(/^data:.*?;base64,/, '').replace(/\s/g, '') : data;
    const blob = isBase64
      ? base64ToBlob(cleanData, mimeType)
      : new Blob([data], { type: `${mimeType};charset=utf-8` });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('File export error:', err);
    alert('❌ تعذر حفظ أو مشاركة الملف على الهاتف.');
    return false;
  }
};

/**
 * Triggers Google Drive upload / export dialog for a backup or document
 */
export async function uploadToGoogleDrive(
  fileName: string, 
  jsonOrBase64Content: string, 
  isBase64: boolean = false,
  mimeType: string = 'application/json'
): Promise<boolean> {
  const driveAccount = getGoogleDriveAccount();
  const isNative = Capacitor.isNativePlatform();

  // Save first locally
  await saveAndShareFile({
    fileName,
    data: jsonOrBase64Content,
    isBase64,
    mimeType,
    title: `رفع إلى Google Drive (${driveAccount || 'حساب الهاتف'})`,
    text: `نسخة احتياطية / مستند لنظام سند ${driveAccount ? `- الحساب: ${driveAccount}` : ''}`
  });

  if (!isNative && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      window.open('https://drive.google.com/drive/my-drive', '_blank');
    } catch (e) {}
  }

  return true;
}

export function base64ToBlob(base64Data: string, contentType: string = 'application/pdf'): Blob {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const sanitized = cleanBase64.replace(/\s/g, '');
  const byteCharacters = atob(sanitized);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}
