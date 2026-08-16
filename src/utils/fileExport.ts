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
 * Gets user's configured custom save folder (Defaults to 'SanadApp')
 */
export function getCustomSaveFolder(): string {
  try {
    const saved = localStorage.getItem('sanad_custom_save_folder');
    if (saved && saved.trim().length > 0) {
      return saved.trim().replace(/^\/+|\/+$/g, '');
    }
  } catch {
    // Silent fallback
  }
  return 'SanadApp';
}

/**
 * Sets user's configured custom save folder
 */
export function setCustomSaveFolder(folderName: string): void {
  try {
    const clean = (folderName || 'SanadApp').trim().replace(/^\/+|\/+$/g, '');
    localStorage.setItem('sanad_custom_save_folder', clean || 'SanadApp');
  } catch {
    // Silent fallback
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
  } catch {
    return '';
  }
}

/**
 * Sets user's configured Google Drive Account
 */
export function setGoogleDriveAccount(email: string): void {
  try {
    localStorage.setItem('sanad_google_drive_account', (email || '').trim());
  } catch {
    // Silent fallback
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
  } catch {
    try {
      const req = await Filesystem.requestPermissions();
      return req.publicStorage === 'granted';
    } catch {
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

let isExportLock = false;

/**
 * Saves a file and offers sharing / download options safely across Capacitor Native, WebViews, and Web Browsers.
 */
export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  if (isExportLock) {
    console.log('[saveAndShareFile] Prevented duplicate execution due to active export lock.');
    return false;
  }

  isExportLock = true;
  setTimeout(() => {
    isExportLock = false;
  }, 1200);

  const {
    fileName,
    data,
    mimeType = 'application/pdf',
    title = 'تصدير سند/تقرير - تطبيق سند',
    text = 'ملف مستند من نظام سند المحاسبي',
    folderName
  } = options;

  const isNative = Capacitor.isNativePlatform();
  
  // Auto-detect if data is Base64 (PDFs, Images, Data URIs, or explicitly specified)
  const isDataUri = typeof data === 'string' && data.startsWith('data:');
  const isBase64 = options.isBase64 === true || isDataUri || (
    typeof data === 'string' && (
      mimeType.includes('pdf') ||
      fileName.toLowerCase().endsWith('.pdf') ||
      mimeType.includes('image') ||
      fileName.toLowerCase().endsWith('.png') ||
      fileName.toLowerCase().endsWith('.jpg') ||
      fileName.toLowerCase().endsWith('.jpeg')
    ) && !data.startsWith('%PDF')
  );

  // Clean Base64 payload to remove headers or whitespace
  const cleanData = isBase64
    ? data.replace(/^data:.*?;base64,/, '').replace(/\s/g, '')
    : data;
    
  const targetFolder = folderName || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '') || 'SanadApp';
  const relativeFilePath = `${cleanFolder}/${fileName}`;

  // 1. CAPACITOR NATIVE (ANDROID / IOS APK) PATH
  if (isNative) {
    try {
      await ensureStoragePermissions();

      let shareUri = '';

      // A) Write to Cache Directory FIRST
      try {
        const cacheResult = await Filesystem.writeFile({
          path: fileName,
          data: cleanData,
          directory: Directory.Cache,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        shareUri = cacheResult.uri;
      } catch {
        // Fallback
      }

      // B) Write persistent copy in Directory.Documents/SanadApp/
      try {
        await ensureCustomFolder(cleanFolder);
        const docResult = await Filesystem.writeFile({
          path: relativeFilePath,
          data: cleanData,
          directory: Directory.Documents,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        if (!shareUri) shareUri = docResult.uri;
      } catch {
        // Fallback
      }

      // C) Retrieve URI via Filesystem.getUri if not captured
      if (!shareUri) {
        try {
          const uriRes = await Filesystem.getUri({
            path: fileName,
            directory: Directory.Cache
          });
          shareUri = uriRes.uri;
        } catch {
          // Fallback
        }
      }

      // D) Trigger Android Native Share Sheet
      if (shareUri) {
        try {
          await Share.share({
            title: title || fileName,
            text: `${text}\n📄 المستند: ${fileName}`,
            url: shareUri,
            dialogTitle: title || 'مشاركة وحفظ المستند'
          });
          return true;
        } catch (shareErr: any) {
          const errStr = String(shareErr?.message || shareErr || '').toLowerCase();
          if (errStr.includes('cancel') || errStr.includes('dismiss') || errStr.includes('abort')) {
            return true;
          }
          return true;
        }
      }

    } catch {
      // Fallback to web
    }
  }

  // 2. WEB SHARE API (MOBILE CHROME WITH FILE SHARING SUPPORT)
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
    } catch {
      // Fallback to blob download
    }
  }

  // 3. DESKTOP / WINDOWS / ELECTRON / BROWSER (SINGLE FILE DOWNLOAD LINK)
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

    return true;
  } catch {
    // Emergency clipboard
  }

  // 4. EMERGENCY CLIPBOARD / ALERT FALLBACK IF EVERYTHING BLOCKED
  if (!isBase64 && data) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(data);
        alert(`📄 تعذر إظهار تنزيل التلقائي بالمتصفح.\n✅ تم نسخ محتوى الملف (${fileName}) للحافظة بنجاح!`);
        return true;
      }
    } catch (clipErr) {
      console.warn('[fileExport] Clipboard write warning:', clipErr);
    }
  }

  alert('⚠️ تعذر إتمام حفظ الملف تلقائياً. يرجى مراجعة إعدادات الأندرويد وإعادة المحاولة.');
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
 * Converts a Base64 string to Blob for Web browser download and Web Share API
 */
export function base64ToBlob(base64Data: string, contentType: string = 'application/pdf'): Blob {
  try {
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const sanitized = cleanBase64.replace(/\s/g, '');
    const byteCharacters = atob(sanitized);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteNumbers], { type: contentType });
  } catch (e) {
    console.error('Error converting base64 to blob:', e);
    return new Blob([base64Data], { type: contentType });
  }
}

/**
 * تصدير البيانات إلى ملف CSV تفاعلي مع تضمين ترميز UTF-8 BOM (\uFEFF)
 * يضمن عرض النصوص العربية والرموز المالية دون أي تداخل في الصفوف بداخل Excel والهواتف المحمولة
 */
export async function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeField = (val: string | number) => {
    const str = String(val ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvHeader = headers.map(escapeField).join(',');
  const csvRows = rows.map(row => row.map(escapeField).join(','));
  const csvContent = '\uFEFF' + [csvHeader, ...csvRows].join('\r\n');

  await saveAndShareFile({
    fileName: filename.endsWith('.csv') ? filename : `${filename}.csv`,
    data: csvContent,
    isBase64: false,
    mimeType: 'text/csv;charset=utf-8',
    title: 'تصدير بيانات CSV',
    text: `تم تصدير ملف ${filename}`
  });
}
