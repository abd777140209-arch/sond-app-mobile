/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { showToast } from './toast';

export interface SaveAndShareOptions {
  fileName: string;
  data: string; // Base64 or plain string
  blob?: Blob; // Optional pre-built Blob (avoids mobile Base64->atob freeze)
  isBase64?: boolean;
  mimeType?: string; // e.g. 'application/pdf', 'text/csv', 'application/json'
  title?: string;
  text?: string;
  folderName?: string; // If omitted, uses getCustomSaveFolder()
}

function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
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
 * Dynamically checks and requests storage permissions on native Android / iOS with strict timeout.
 * Never blocks indefinitely on Android 13-16 Scoped Storage.
 */
export async function ensureStoragePermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }
  try {
    const status = await withTimeout(Filesystem.checkPermissions(), 2000, 'checkPermissions');
    if (status.publicStorage !== 'granted') {
      const request = await withTimeout(Filesystem.requestPermissions(), 3500, 'requestPermissions');
      return request.publicStorage === 'granted';
    }
    return true;
  } catch {
    return true; // Modern Android Documents/Cache work under Scoped Storage even if publicStorage returns denied/timeout
  }
}

/**
 * Ensures a custom folder exists inside Directory.Documents on Android/Native
 */
export async function ensureCustomFolder(folderPath?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  await ensureStoragePermissions();
  const targetFolder = folderPath || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '') || 'SanadApp';

  try {
    await withTimeout(
      Filesystem.mkdir({
        path: cleanFolder,
        directory: Directory.Documents,
        recursive: true,
      }),
      2500,
      'mkdir-documents'
    );
    return true;
  } catch {
    try {
      await withTimeout(
        Filesystem.mkdir({
          path: cleanFolder,
          directory: Directory.ExternalStorage,
          recursive: true,
        }),
        2500,
        'mkdir-external'
      );
      return true;
    } catch {
      return false;
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
      const writeResult = await withTimeout(
        Filesystem.writeFile({
          path: `${cleanFolder}/${fileName}`,
          data: jsonString,
          directory: Directory.Documents,
          recursive: true,
          encoding: Encoding.UTF8,
        }),
        4000,
        'silent-backup-documents'
      );
      return writeResult.uri;
    } catch {
      try {
        const cacheResult = await withTimeout(
          Filesystem.writeFile({
            path: fileName,
            data: jsonString,
            directory: Directory.Cache,
            recursive: true,
            encoding: Encoding.UTF8,
          }),
          3000,
          'silent-backup-cache'
        );
        return cacheResult.uri;
      } catch {
        return null;
      }
    }
  } else {
    return 'web:in-memory';
  }
}

let isExportLock = false;
let exportLockTimer: ReturnType<typeof setTimeout> | null = null;

function releaseExportLock() {
  isExportLock = false;
  if (exportLockTimer) {
    clearTimeout(exportLockTimer);
    exportLockTimer = null;
  }
}

/**
 * Triggers a clean browser / Mobile PWA file download without revoking the Blob URL too early.
 */
function triggerBlobDownload(blob: Blob, fileName: string): boolean {
  try {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Wait 60 seconds before cleanup so slow mobile browser download managers finish reading the blob
    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
      } catch {
        // Ignore cleanup errors
      }
    }, 60000);

    return true;
  } catch (err) {
    console.warn('[fileExport] Blob download error:', err);
    return false;
  }
}

/**
 * Saves a file and offers sharing / download options safely across Capacitor Native, Mobile PWAs, and Web Browsers.
 * Protected with strict timeouts and guaranteed lock cleanup so phones never hang.
 */
export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  if (isExportLock) {
    console.log('[saveAndShareFile] Export already in progress, skipping duplicate tap.');
    return false;
  }

  isExportLock = true;
  // Emergency watchdog unlock after 15 seconds max
  exportLockTimer = setTimeout(() => {
    isExportLock = false;
    exportLockTimer = null;
  }, 15000);

  try {
    const {
      fileName,
      data,
      blob: providedBlob,
      mimeType = 'application/pdf',
      title = 'تصدير سند/تقرير - تطبيق سند',
      text = 'ملف مستند من نظام سند المحاسبي',
      folderName,
    } = options;

    const isNative = Capacitor.isNativePlatform();

    // Auto-detect Base64 payload
    const isDataUri = typeof data === 'string' && data.startsWith('data:');
    const isBase64 =
      options.isBase64 === true ||
      isDataUri ||
      (typeof data === 'string' &&
        (mimeType.includes('pdf') ||
          fileName.toLowerCase().endsWith('.pdf') ||
          mimeType.includes('image') ||
          fileName.toLowerCase().endsWith('.png') ||
          fileName.toLowerCase().endsWith('.jpg') ||
          fileName.toLowerCase().endsWith('.jpeg')) &&
        !data.startsWith('%PDF'));

    const cleanData = isBase64
      ? data.replace(/^data:.*?;base64,/, '').replace(/\s/g, '')
      : data;

    const targetFolder = folderName || getCustomSaveFolder();
    const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '') || 'SanadApp';
    const relativeFilePath = `${cleanFolder}/${fileName}`;

    // 1. CAPACITOR NATIVE (ANDROID / IOS APK) PATH
    if (isNative) {
      let shareUri = '';

      // A) Write to Cache FIRST (requires ZERO permissions on Android 6-16 and never blocks!)
      try {
        const cacheResult = await withTimeout(
          Filesystem.writeFile({
            path: fileName,
            data: cleanData,
            directory: Directory.Cache,
            recursive: true,
            encoding: isBase64 ? undefined : Encoding.UTF8,
          }),
          4500,
          'write-cache'
        );
        shareUri = cacheResult.uri;
      } catch (cacheErr) {
        console.warn('[fileExport] Cache write warning:', cacheErr);
      }

      // B) Retrieve URI if needed
      if (!shareUri) {
        try {
          const uriRes = await withTimeout(
            Filesystem.getUri({
              path: fileName,
              directory: Directory.Cache,
            }),
            2000,
            'getUri-cache'
          );
          shareUri = uriRes.uri;
        } catch {
          // Ignore
        }
      }

      // C) Persist an archive copy in Documents/SanadApp in background/safely (bounded timeout)
      let savedInDocuments = false;
      try {
        await ensureCustomFolder(cleanFolder);
        const docResult = await withTimeout(
          Filesystem.writeFile({
            path: relativeFilePath,
            data: cleanData,
            directory: Directory.Documents,
            recursive: true,
            encoding: isBase64 ? undefined : Encoding.UTF8,
          }),
          4000,
          'write-documents'
        );
        if (!shareUri && docResult?.uri) {
          shareUri = docResult.uri;
        }
        savedInDocuments = true;
      } catch {
        // Do not fail export if Documents permission is restricted
      }

      // D) Trigger Native Android/iOS Share Sheet (bounded timeout so UI spinner never locks forever)
      if (shareUri) {
        try {
          await withTimeout(
            Share.share({
              title: title || fileName,
              text: `${text}\n📄 المستند: ${fileName}`,
              url: shareUri,
              dialogTitle: title || 'مشاركة وحفظ المستند',
            }),
            12000,
            'native-share'
          );
          if (savedInDocuments) {
            showToast(`تم الحفظ في المستندات/${cleanFolder} بنجاح`, 'success');
          }
          return true;
        } catch (shareErr: any) {
          const errStr = String(shareErr?.message || shareErr || '').toLowerCase();
          if (errStr.includes('cancel') || errStr.includes('dismiss') || errStr.includes('abort')) {
            if (savedInDocuments) {
              showToast(`تم حفظ الملف في المستندات/${cleanFolder}`, 'info');
            }
            return true;
          }
          if (errStr.includes('timed out')) {
            // Native share chooser is already open or took too long; release UI cleanly
            return true;
          }
          if (savedInDocuments) {
            showToast(`تم حفظ الملف في المستندات/${cleanFolder}`, 'success');
            return true;
          }
        }
      }
    }

    // Build Blob once for PWA/Web Share & Download
    const blob =
      providedBlob ||
      (isBase64 ? base64ToBlob(cleanData, mimeType) : new Blob([data], { type: mimeType }));

    const isMobileBrowser =
      typeof navigator !== 'undefined' &&
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

    // 2. MOBILE PWA / MOBILE WEB BROWSER SHARE API
    if (
      !isInIframe &&
      isMobileBrowser &&
      typeof navigator !== 'undefined' &&
      typeof (navigator as any).share === 'function'
    ) {
      try {
        const cleanMime = mimeType.split(';')[0].trim();
        const file = new File([blob], fileName, { type: cleanMime });
        const canShareFiles =
          typeof (navigator as any).canShare === 'function' &&
          (navigator as any).canShare({ files: [file] });

        if (canShareFiles) {
          await withTimeout(
            (navigator as any).share({
              title: title || fileName,
              text: text || '',
              files: [file],
            }),
            12000,
            'web-share-files'
          );
          return true;
        }
      } catch (shareErr: any) {
        const errName = String(shareErr?.name || '').toLowerCase();
        const errMsg = String(shareErr?.message || '').toLowerCase();
        // If the user actively cancelled the share sheet, do not force a second download
        if (errName === 'aborterror' || errMsg.includes('abort') || errMsg.includes('cancel')) {
          return true;
        }
        // If share sheet timed out (already shown or stalled WebView), don't leave app frozen
        if (errMsg.includes('timed out')) {
          showToast('تم فتح نافذة المشاركة أو انتهت مهلتها، جاري حفظ نسخة مباشرة...', 'info');
        }
        // Otherwise (e.g. NotAllowedError due to async delay or unsupported MIME like .json), fall back cleanly to Blob Download!
      }
    }

    // 3. DIRECT BLOB DOWNLOAD (Works on Mobile Chrome PWA, iOS Safari, Desktop, Electron)
    const downloaded = triggerBlobDownload(blob, fileName);
    if (downloaded) {
      showToast(`تم حفظ الملف (${fileName}) في التنزيلات بنجاح`, 'success');
      return true;
    }

    // 4. EMERGENCY CLIPBOARD FALLBACK FOR TEXT FILES
    if (!isBase64 && data && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(data);
        showToast(`تم نسخ محتوى الملف (${fileName}) إلى الحافظة بنجاح`, 'success');
        return true;
      } catch {
        // Ignore
      }
    }

    showToast('تعذر حفظ الملف تلقائياً، يرجى التحقق من أذونات التخزين أو المتصفح', 'error');
    return false;
  } finally {
    releaseExportLock();
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
    text: `نسخة احتياطية / مستند لنظام سند ${driveAccount ? `- الحساب: ${driveAccount}` : ''}`,
  });

  if (!isNative) {
    const a = document.createElement('a');
    a.href = 'https://drive.google.com/drive/my-drive';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 300);
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
    const len = byteCharacters.length;
    const byteNumbers = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
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
  const csvRows = rows.map((row) => row.map(escapeField).join(','));
  const csvContent = '\uFEFF' + [csvHeader, ...csvRows].join('\r\n');

  await saveAndShareFile({
    fileName: filename.endsWith('.csv') ? filename : `${filename}.csv`,
    data: csvContent,
    isBase64: false,
    mimeType: 'text/csv;charset=utf-8',
    title: 'تصدير بيانات CSV',
    text: `تم تصدير ملف ${filename}`,
  });
}
