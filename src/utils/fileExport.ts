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
      console.warn(`[Silent Backup] Write to Documents/${cleanFolder} failed, trying ExternalStorage:`, err);
      try {
        const extResult = await Filesystem.writeFile({
          path: `${cleanFolder}/${fileName}`,
          data: jsonString,
          directory: Directory.ExternalStorage,
          recursive: true,
          encoding: Encoding.UTF8
        });
        return extResult.uri;
      } catch (extErr) {
        console.error('[Silent Backup] External write failed as well:', extErr);
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
    text = 'ملف مستند من نظام سند لصيانة الهواتف',
    folderName
  } = options;

  const isNative = Capacitor.isNativePlatform();
  const cleanData = isBase64 && data.includes(',') ? data.split(',')[1] : data;
  const targetFolder = folderName || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '');
  const relativeFilePath = `${cleanFolder}/${fileName}`;

  // ALWAYS create and click a web download link (Blob / Data URI) first to ensure browser / WebView downloads the file directly
  let webDownloadSuccess = false;
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
    }, 3000);
    webDownloadSuccess = true;
  } catch (webLinkErr) {
    console.warn('Web blob download link attempt:', webLinkErr);
  }

  // 1. Native Capacitor Android / iOS Attempt (Save to Filesystem + Share)
  if (isNative) {
    try {
      await ensureStoragePermissions();
      await ensureCustomFolder(cleanFolder);

      let writeResult;
      let usedDirectory = Directory.Documents;

      try {
        writeResult = await Filesystem.writeFile({
          path: relativeFilePath,
          data: cleanData,
          directory: Directory.Documents,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        usedDirectory = Directory.Documents;
      } catch (docErr) {
        console.warn('Filesystem write to Documents failed, attempting Directory.ExternalStorage:', docErr);
        try {
          writeResult = await Filesystem.writeFile({
            path: relativeFilePath,
            data: cleanData,
            directory: Directory.ExternalStorage,
            recursive: true,
            encoding: isBase64 ? undefined : Encoding.UTF8
          });
          usedDirectory = Directory.ExternalStorage;
        } catch (extErr) {
          console.warn('Filesystem write to ExternalStorage failed, attempting Directory.Data:', extErr);
          writeResult = await Filesystem.writeFile({
            path: relativeFilePath,
            data: cleanData,
            directory: Directory.Data,
            recursive: true,
            encoding: isBase64 ? undefined : Encoding.UTF8
          });
          usedDirectory = Directory.Data;
        }
      }

      // Try fetching file URI for native sharing
      let fileUri = writeResult?.uri;
      if (!fileUri) {
        try {
          const uriRes = await Filesystem.getUri({
            path: relativeFilePath,
            directory: usedDirectory
          });
          fileUri = uriRes.uri;
        } catch (uriErr) {
          console.warn('Could not retrieve URI directly:', uriErr);
        }
      }

      if (fileUri) {
        // Trigger Native Share
        try {
          await Share.share({
            title: title,
            text: `${text}\n📄 الملف محفوظ في: Documents/${relativeFilePath}`,
            url: fileUri,
            dialogTitle: title || 'حفظ وتصدير الملف'
          });
        } catch (shareErr: any) {
          const errStr = String(shareErr || '').toLowerCase();
          if (!errStr.includes('cancel') && !errStr.includes('dismiss') && !errStr.includes('abort')) {
            console.warn('Native Share dialog error:', shareErr);
          }
        }
      }

      alert(`✅ تم حفظ النسخة الاحتياطية وتنزيلها بنجاح!\n📁 اسم الملف: ${fileName}\n📄 المجلد: Documents/${cleanFolder}`);
      return true;

    } catch (nativeErr) {
      console.warn('Native Capacitor file write failed:', nativeErr);
    }
  }

  if (webDownloadSuccess) {
    alert(`✅ تم تنزيل النسخة الاحتياطية بنجاح!\n📄 اسم الملف: ${fileName}`);
    return true;
  }

  alert('⚠️ تعذر تنزيل الملف بشكل تلقائي. يرجى إعادة المحاولة.');
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
