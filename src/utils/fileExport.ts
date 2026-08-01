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
 * Ensures a custom folder exists safely inside Directory.Data or Documents on Android/Native
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
      directory: Directory.Data,
      recursive: true,
    });
    return true;
  } catch (err) {
    try {
      await Filesystem.mkdir({
        path: cleanFolder,
        directory: Directory.Documents,
        recursive: true,
      });
      return true;
    } catch (fallbackErr) {
      console.log(`Directory ${cleanFolder} creation info:`, err, fallbackErr);
      return true;
    }
  }
}

export async function ensureSanadFolder(): Promise<boolean> {
  return ensureCustomFolder(getCustomSaveFolder());
}

/**
 * Saves a backup file silently in local storage or app data folder without opening UI dialogs
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
        directory: Directory.Data,
        recursive: true,
        encoding: Encoding.UTF8
      });
      return writeResult.uri;
    } catch (err) {
      try {
        const docResult = await Filesystem.writeFile({
          path: `${cleanFolder}/${fileName}`,
          data: jsonString,
          directory: Directory.Documents,
          recursive: true,
          encoding: Encoding.UTF8
        });
        return docResult.uri;
      } catch (extErr) {
        console.error('[Silent Backup] Internal write failed:', extErr);
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
 * Saves a file and safely triggers Native Share (Bluetooth, WhatsApp, Wi-Fi Direct) or Web Download.
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

  // 1. Native Capacitor Android / iOS Attempt (Using Directory.Data for 100% stability)
  if (isNative) {
    try {
      await ensureStoragePermissions();
      await ensureCustomFolder(cleanFolder);

      let writeResult;
      let usedDirectory = Directory.Data;

      try {
        writeResult = await Filesystem.writeFile({
          path: relativeFilePath,
          data: cleanData,
          directory: Directory.Data,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        usedDirectory = Directory.Data;
      } catch (dataErr) {
        console.warn('Filesystem write to Data failed, attempting Documents:', dataErr);
        writeResult = await Filesystem.writeFile({
          path: relativeFilePath,
          data: cleanData,
          directory: Directory.Documents,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        usedDirectory = Directory.Documents;
      }

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
        try {
          await Share.share({
            title: title,
            text: `${text}\n📄 الملف: ${fileName}`,
            url: fileUri,
            dialogTitle: title || 'حفظ ومشاركة المستند'
          });
          return true;
        } catch (shareErr: any) {
          const errStr = String(shareErr || '').toLowerCase();
          if (!errStr.includes('cancel') && !errStr.includes('dismiss') && !errStr.includes('abort')) {
            console.warn('Native Share dialog error:', shareErr);
          }
        }
      }
    } catch (nativeErr) {
      console.warn('Native file write/share failed, falling back to Blob download:', nativeErr);
    }
  }

  // 2. Web / WebView Fallback (Blob + Navigator Share / Direct Download Link)
  try {
    const blob = isBase64 
      ? base64ToBlob(cleanData, mimeType)
      : new Blob([data], { type: mimeType });

    const blobUrl = URL.createObjectURL(blob);

    if (typeof navigator !== 'undefined' && (navigator as any).canShare) {
      try {
        const fileToShare = new File([blob], fileName, { type: mimeType });
        if ((navigator as any).canShare({ files: [fileToShare] })) {
          await navigator.share({
            title: title,
            text: text,
            files: [fileToShare]
          });
          URL.revokeObjectURL(blobUrl);
          return true;
        }
      } catch (webShareErr: any) {
        const errStr = String(webShareErr || '').toLowerCase();
        if (errStr.includes('cancel') || errStr.includes('abort') || errStr.includes('dismiss')) {
          URL.revokeObjectURL(blobUrl);
          return true;
        }
      }
    }

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
    }, 2000);

    return true;

  } catch (webErr) {
    console.error('All file export and download attempts failed:', webErr);
    alert('⚠️ تعذر إكمال تصدير الملف. يرجى إعادة المحاولة.');
    return false;
  }
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

  await saveAndShareFile({
    fileName,
    data: jsonOrBase64Content,
    isBase64,
    mimeType,
    title: `رفع إلى Google Drive (${driveAccount || 'حساب الهاتف'})`,
    text: `نسخة احتياطية / مستند لنظام سند`
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
