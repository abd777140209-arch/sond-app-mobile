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
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '') || 'SanadApp';
  
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
 * Saves a backup file silently in local storage without opening UI dialogs
 */
export async function saveSilentBackupFile(
  fileName: string,
  jsonString: string,
  folderPath?: string
): Promise<string | null> {
  const isNative = Capacitor.isNativePlatform();
  const targetFolder = folderPath || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '') || 'SanadApp';

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
      console.log(`[Silent Backup] Saved to Documents/${cleanFolder}/${fileName}`);
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

  // Clean Base64 payload to remove headers or whitespace
  const cleanData = isBase64
    ? data.replace(/^data:.*?;base64,/, '').replace(/\s/g, '')
    : data;
    
  const targetFolder = folderName || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '') || 'SanadAccounting';
  const relativeFilePath = `${cleanFolder}/${fileName}`;

  console.log(`[saveAndShareFile] File: ${fileName}, MIME: ${mimeType}, Folder: ${cleanFolder}`);

  let writtenUri: string | null = null;

  // 1. CAPACITOR NATIVE FILESYSTEM WRITE (DIRECT TO DOCUMENTS / SANADACCOUNTING)
  try {
    try {
      await ensureStoragePermissions();
    } catch (permErr) {
      console.warn('[fileExport] Permissions request warning:', permErr);
    }

    // A) Attempt writing to Directory.Documents (SanadAccounting/filename)
    try {
      const docResult = await Filesystem.writeFile({
        path: relativeFilePath,
        data: cleanData,
        directory: Directory.Documents,
        recursive: true,
        encoding: isBase64 ? undefined : Encoding.UTF8
      });
      writtenUri = docResult.uri;
      console.log('[fileExport] Successfully wrote to Directory.Documents:', writtenUri);
    } catch (docErr) {
      console.warn('[fileExport] Documents folder write warning:', docErr);
      // Fallback: direct write to Documents root
      try {
        const docDirectResult = await Filesystem.writeFile({
          path: fileName,
          data: cleanData,
          directory: Directory.Documents,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        writtenUri = docDirectResult.uri;
        console.log('[fileExport] Successfully wrote to Documents root:', writtenUri);
      } catch (docDirectErr) {
        console.warn('[fileExport] Documents root write warning:', docDirectErr);
      }
    }

    // B) If Documents write failed, write to Directory.Cache
    if (!writtenUri) {
      try {
        const cacheResult = await Filesystem.writeFile({
          path: fileName,
          data: cleanData,
          directory: Directory.Cache,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        writtenUri = cacheResult.uri;
        console.log('[fileExport] Wrote to Cache:', writtenUri);
      } catch (cacheErr) {
        console.warn('[fileExport] Cache write warning:', cacheErr);
      }
    }
  } catch (fsPluginErr) {
    console.warn('[fileExport] Filesystem plugin unavailable:', fsPluginErr);
  }

  // 2. TRIGGER NATIVE ANDROID SHARE SHEET WITH FILE URI
  if (writtenUri) {
    try {
      await Share.share({
        title: title || fileName,
        text: text ? `${text}\n📄 المستند: ${fileName}` : `📄 المستند: ${fileName}`,
        url: writtenUri,
        dialogTitle: title || 'مشاركة وحفظ المستند'
      });
      console.log('[fileExport] Native share sheet opened for URI:', writtenUri);
      return true;
    } catch (shareErr: any) {
      const errStr = String(shareErr?.message || shareErr || '').toLowerCase();
      if (errStr.includes('cancel') || errStr.includes('dismiss') || errStr.includes('abort')) {
        console.log('[fileExport] User dismissed share sheet');
        return true;
      }
      console.warn('[fileExport] Share plugin call error:', shareErr);
      return true;
    }
  }

  // 3. WEB SHARE API FALLBACK (MOBILE BROWSER / PWA)
  if (typeof navigator !== 'undefined' && (navigator as any).canShare && (navigator as any).share) {
    try {
      const blob = isBase64 
        ? base64ToBlob(cleanData, mimeType)
        : new Blob([data], { type: mimeType });
      
      const file = new File([blob], fileName, { type: mimeType });

      if ((navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({
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
      console.warn('[fileExport] Web Share API error:', webShareErr);
    }
  }

  // 4. STANDARD BROWSER DOWNLOAD LINK FALLBACK (NO POPUP ALERTS)
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

    // Data URI direct download fallback for strict WebViews
    try {
      const dataUri = isBase64 
        ? `data:${mimeType};base64,${cleanData}`
        : `data:${mimeType};charset=utf-8,${encodeURIComponent(data)}`;
        
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
      console.warn('[fileExport] Data URI download attempt:', dataUriErr);
    }

    return true;
  } catch (webLinkErr) {
    console.warn('[fileExport] Web blob download link attempt:', webLinkErr);
  }

  // 5. EMERGENCY CLIPBOARD FALLBACK
  if (!isBase64 && data) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(data);
        console.log('[fileExport] Copied content to clipboard fallback');
        return true;
      }
    } catch (clipErr) {
      console.warn('[fileExport] Clipboard write warning:', clipErr);
    }
  }

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
  const sanitized = cleanBase64.replace(/\s/g, '');
  const byteCharacters = atob(sanitized);
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
