/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export interface SaveAndShareOptions {
  fileName: string;
  data: string; // Base64 or plain string
  isBase64?: boolean;
  mimeType?: string; // e.g. 'application/pdf', 'text/csv', 'application/json'
  title?: string;
  text?: string;
  folderName?: string; // If omitted, uses getCustomSaveFolder()
}

/**
 * Gets user's configured custom save folder (Defaults to 'SanadAccounting')
 */
export function getCustomSaveFolder(): string {
  try {
    const saved = localStorage.getItem('sanad_custom_save_folder');
    if (saved && saved.trim().length > 0) {
      return saved.trim().replace(/^\/+|\/+$/g, '');
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
    const clean = (folderName || 'SanadAccounting').trim().replace(/^\/+|\/+$/g, '');
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
    console.warn('Filesystem permissions check/request warning:', err);
    return true;
  }
}

/**
 * Ensures a custom folder (e.g. 'SanadAccounting' or user specified path) exists inside Directory.Documents on Android/Native
 */
export async function ensureCustomFolder(folderPath?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  await ensureStoragePermissions();
  const targetFolder = folderPath || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '');
  
  try {
    await Filesystem.mkdir({
      path: cleanFolder,
      directory: Directory.Documents,
      recursive: true,
    });
    return true;
  } catch (err) {
    // Attempt fallback in Directory.ExternalStorage or Directory.Data safely for Capacitor Filesystem
    try {
      await Filesystem.mkdir({
        path: cleanFolder,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      return true;
    } catch (fallbackErr) {
      console.log(`Directory ${cleanFolder} creation info:`, err, fallbackErr);
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
 * Saves a backup file silently in local storage without opening UI dialogs
 */
export async function saveSilentBackupFile(
  fileName: string,
  jsonString: string,
  folderPath?: string
): Promise<string | null> {
  const isNative = Capacitor.isNativePlatform();
  const targetFolder = folderPath || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '');

  if (isNative) {
    try {
      await ensureCustomFolder(cleanFolder);
      const writeResult = await Filesystem.writeFile({
        path: `${cleanFolder}/${fileName}`,
        data: jsonString,
        directory: Directory.Documents,
        recursive: true,
        encoding: Encoding.UTF8
      });
      console.log(`[Silent Backup] Successfully saved to Documents/${cleanFolder}/${fileName}`);
      return writeResult.uri;
    } catch (err) {
      console.warn(`[Silent Backup] Write to Documents/${cleanFolder} failed, trying Cache:`, err);
      try {
        const cacheResult = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          recursive: true,
          encoding: Encoding.UTF8
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
export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  const {
    fileName,
    data,
    isBase64 = false,
    mimeType = 'application/pdf',
    title = 'تصدير سند/تقرير - تطبيق سند',
    text = 'ملف مستند من نظام سند المحاسبي',
    folderName
  } = options;

  const isNative = Capacitor.isNativePlatform();
  const cleanData = isBase64 && data.includes(',') ? data.split(',')[1] : data;
  const targetFolder = folderName || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '');
  const relativeFilePath = `${cleanFolder}/${fileName}`;

  // 1. NATIVE CAPACITOR (ANDROID / IOS APK) PATH
  if (isNative) {
    try {
      await ensureStoragePermissions();

      let writeUri = '';

      // A) Write to Cache Directory FIRST (ALWAYS succeeds on Android 8 to 15 without scoped storage blocks)
      try {
        const cacheResult = await Filesystem.writeFile({
          path: fileName,
          data: cleanData,
          directory: Directory.Cache,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        writeUri = cacheResult.uri;
      } catch (cacheErr) {
        console.warn('Cache write warning:', cacheErr);
      }

      // B) Also attempt writing to Directory.Documents for persistent local folder access
      try {
        await ensureCustomFolder(cleanFolder);
        const docResult = await Filesystem.writeFile({
          path: relativeFilePath,
          data: cleanData,
          directory: Directory.Documents,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        if (!writeUri) writeUri = docResult.uri;
      } catch (docErr) {
        console.warn('Documents write attempt info:', docErr);
      }

      // C) Retrieve URI if not yet captured
      if (!writeUri) {
        try {
          const uriRes = await Filesystem.getUri({
            path: fileName,
            directory: Directory.Cache
          });
          writeUri = uriRes.uri;
        } catch (e) {
          console.warn('Get URI fallback error:', e);
        }
      }

      // D) Trigger System Share / File Save dialog on Android / iOS
      if (writeUri) {
        try {
          await Share.share({
            title: title || fileName,
            text: `${text}\n📄 الملف: ${fileName}`,
            url: writeUri,
            dialogTitle: title || 'حفظ وتصدير الملف (اختر التطبيق أو حفظ بالهاتف)'
          });
          return true;
        } catch (shareErr: any) {
          const errStr = String(shareErr || '').toLowerCase();
          if (errStr.includes('cancel') || errStr.includes('dismiss') || errStr.includes('abort')) {
            console.log('User dismissed share sheet');
            return true;
          }
          console.warn('Capacitor Share failed:', shareErr);
        }
      }

    } catch (nativeErr) {
      console.warn('Native Capacitor file operation failed, dropping to Web fallback:', nativeErr);
    }
  }

  // 2. WEB SHARE API (ANDROID MOBILE CHROME / WEBVIEW FALLBACK)
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
    try {
      const blob = isBase64 
        ? base64ToBlob(cleanData, mimeType)
        : new Blob([data], { type: mimeType });
      
      const file = new File([blob], fileName, { type: mimeType });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: title || fileName,
          text: text || '',
          files: [file]
        });
        return true;
      }
    } catch (webShareErr: any) {
      const errStr = String(webShareErr || '').toLowerCase();
      if (errStr.includes('cancel') || errStr.includes('abort') || errStr.includes('dismiss')) {
        return true;
      }
      console.warn('Web Share API error:', webShareErr);
    }
  }

  // 3. STANDARD BROWSER DOWNLOAD LINK (BLOB + DATA URI)
  try {
    const blob = isBase64 
      ? base64ToBlob(cleanData, mimeType)
      : new Blob([data], { type: mimeType });

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(blobUrl);
    }, 4000);

    // Also attempt Data URI direct download for strict Android WebViews
    if (!isBase64 && (mimeType.includes('json') || mimeType.includes('text') || mimeType.includes('csv'))) {
      try {
        const dataUri = `data:${mimeType};charset=utf-8,${encodeURIComponent(data)}`;
        const altLink = document.createElement('a');
        altLink.href = dataUri;
        altLink.download = fileName;
        altLink.style.display = 'none';
        document.body.appendChild(altLink);
        altLink.click();
        setTimeout(() => {
          if (document.body.contains(altLink)) document.body.removeChild(altLink);
        }, 1000);
      } catch (dataUriErr) {
        console.warn('Data URI download attempt:', dataUriErr);
      }
    }

    return true;
  } catch (webLinkErr) {
    console.warn('Web blob download link attempt:', webLinkErr);
  }

  // 4. EMERGENCY CLIPBOARD / ALERT FALLBACK IF EVERYTHING BLOCKED
  if (!isBase64 && data) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(data);
        alert(`📄 تعذر تنزيل الملف بشكل تلقائي بالمتصفح.\n✅ تم نسخ محتوى الملف (${fileName}) للحافظة بنجاح! يمكنك لصقه وحفظه.`);
        return true;
      }
    } catch (clipErr) {
      console.warn('Clipboard write warning:', clipErr);
    }
  }

  alert('⚠️ تعذر إتمام حفظ الملف تلقائياً. يرجى التأكد من صلاحيات التخزين وإعادة المحاولة.');
  return false;
}

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

  if (!isNative) {
    window.open('https://drive.google.com/drive/my-drive', '_blank');
  }

  return true;
}

/**
 * Converts a Base64 string to Blob for Web browser download
 */
export function base64ToBlob(base64Data: string, contentType: string = 'application/pdf'): Blob {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const byteCharacters = atob(cleanBase64);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: contentType });
}
