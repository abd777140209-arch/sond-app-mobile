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
  blob?: Blob; // Optional pre-built Blob
  isBase64?: boolean;
  mimeType?: string; // e.g. 'application/pdf', 'text/csv', 'application/json', 'image/png'
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
 * Converts a Blob to raw Base64 string asynchronously via native FileReader (non-blocking)
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Registers the file with the backend HTTP Download Bridge so Android/iOS native DownloadManager
 * can download a real HTTPS attachment URL into the phone's Download folder.
 */
async function registerServerDownloadBridge(
  fileName: string,
  data: string,
  isBase64: boolean,
  mimeType: string
): Promise<string | null> {
  try {
    const response = await withTimeout(
      fetch('/api/download-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          data,
          isBase64,
          mimeType,
        }),
      }),
      8000,
      'download-bridge'
    );
    if (!response.ok) return null;
    const json = await response.json();
    if (json && json.ok && typeof json.downloadUrl === 'string') {
      return json.downloadUrl;
    }
    return null;
  } catch (err) {
    console.warn('[fileExport] Server download bridge unavailable, using local blob:', err);
    return null;
  }
}

/**
 * Triggers a real HTTP attachment download using an invisible iframe + anchor click
 * so Android OS DownloadManager saves directly to Internal Storage -> Download.
 */
function triggerHttpAttachmentDownload(downloadUrl: string, fileName: string): boolean {
  try {
    // Method A: Anchor with download attribute
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (document.body.contains(link)) document.body.removeChild(link);
      } catch {
        // Ignore
      }
    }, 5000);
    return true;
  } catch {
    try {
      // Method B: Hidden iframe attachment stream
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = downloadUrl;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        } catch {
          // Ignore
        }
      }, 30000);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Displays an interactive Mobile Save & Share Bottom Sheet so the user has a 100% fresh touch gesture
 * to either save directly to the phone's Download folder or open Android's native Share / Files ("ملفاتي") sheet.
 */
function showMobileFileActionSheet(params: {
  fileName: string;
  blob: Blob;
  mimeType: string;
  title: string;
  text: string;
  serverDownloadUrl: string | null;
}) {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('sanad-mobile-file-sheet');
  if (existing) {
    existing.remove();
  }

  const sizeKb = Math.max(1, Math.round(params.blob.size / 1024));
  const blobUrl = URL.createObjectURL(params.blob);
  const finalDownloadUrl = params.serverDownloadUrl || blobUrl;

  const overlay = document.createElement('div');
  overlay.id = 'sanad-mobile-file-sheet';
  overlay.dir = 'rtl';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,0.72);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;padding:12px;font-family:Cairo,Tajawal,sans-serif;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;max-width:460px;background:#0f172a;border:1px solid rgba(197,168,98,0.45);border-radius:20px;padding:18px;color:#f8fafc;box-shadow:0 20px 50px rgba(0,0,0,0.6);';

  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(148,163,184,0.18);padding-bottom:12px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:12px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">
          📥
        </div>
        <div>
          <div style="font-weight:900;font-size:14px;color:#ffffff;">الملف جاهز للحفظ والمشاركة في الهاتف</div>
          <div style="font-size:11px;color:#94a3b8;">اختر طريقة الحفظ في ذاكرة الهاتف أو الإرسال الفوري</div>
        </div>
      </div>
      <button id="sanad-sheet-close" type="button" style="background:rgba(255,255,255,0.08);border:none;color:#cbd5e1;width:32px;height:32px;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;">✕</button>
    </div>

    <div style="background:rgba(30,41,59,0.85);border:1px solid rgba(148,163,184,0.2);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="color:#94a3b8;">اسم الملف:</span>
        <strong style="color:#38bdf8;font-family:monospace;direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;">${params.fileName}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#94a3b8;">مكان الحفظ في الهاتف:</span>
        <strong style="color:#34d399;font-size:11px;">التخزين الداخلي ← Download (التنزيلات)</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
        <span style="color:#94a3b8;">حجم الملف:</span>
        <span style="color:#e2e8f0;font-family:monospace;">${sizeKb} KB</span>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      <a id="sanad-sheet-direct-dl" href="${finalDownloadUrl}" download="${params.fileName}" style="text-decoration:none;width:100%;padding:12px 14px;border-radius:12px;background:#059669;color:#ffffff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;border:1px solid #10b981;cursor:pointer;">
        <span>📥</span>
        <span>حفظ مباشر في الهاتف (مجلد التنزيلات Download)</span>
      </a>

      <button id="sanad-sheet-native-share" type="button" style="width:100%;padding:12px 14px;border-radius:12px;background:#2563eb;color:#ffffff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #3b82f6;cursor:pointer;font-family:inherit;">
        <span>📤</span>
        <span>مشاركة أو حفظ في (ملفاتي / واتساب / Drive)</span>
      </button>

      ${
        params.serverDownloadUrl
          ? `<a id="sanad-sheet-open-inline" href="${params.serverDownloadUrl}?inline=1" target="_blank" rel="noopener" style="text-decoration:none;width:100%;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,0.07);color:#e2e8f0;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;border:1px solid rgba(148,163,184,0.25);">
              <span>👁️</span>
              <span>فتح ومعاينة المستند في عارض الهاتف</span>
            </a>`
          : ''
      }
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const cleanup = () => {
    try {
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
    } catch {
      // Ignore
    }
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // Ignore
      }
    }, 60000);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  const closeBtn = card.querySelector('#sanad-sheet-close');
  closeBtn?.addEventListener('click', cleanup);

  const dlLink = card.querySelector('#sanad-sheet-direct-dl');
  dlLink?.addEventListener('click', () => {
    showToast(`جاري تنزيل (${params.fileName}) إلى مجلد Download في الهاتف...`, 'success');
    setTimeout(cleanup, 1200);
  });

  const shareBtn = card.querySelector('#sanad-sheet-native-share');
  shareBtn?.addEventListener('click', async () => {
    try {
      const cleanMime = params.mimeType.split(';')[0].trim() || 'application/octet-stream';
      const file = new File([params.blob], params.fileName, { type: cleanMime });
      if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
        const canShareFiles =
          typeof (navigator as any).canShare === 'function' &&
          (navigator as any).canShare({ files: [file] });
        if (canShareFiles) {
          await (navigator as any).share({
            title: params.title || params.fileName,
            text: params.text || '',
            files: [file],
          });
          cleanup();
          return;
        }
      }
      // If navigator.share with files is not supported on this browser/webview, trigger direct HTTP download
      triggerHttpAttachmentDownload(finalDownloadUrl, params.fileName);
      showToast(`تم بدء تنزيل (${params.fileName}) إلى مجلد التنزيلات (Download)`, 'success');
      cleanup();
    } catch (err: any) {
      const msg = String(err?.message || err?.name || '').toLowerCase();
      if (msg.includes('abort') || msg.includes('cancel')) {
        return;
      }
      triggerHttpAttachmentDownload(finalDownloadUrl, params.fileName);
      showToast(`تم تحويل الحفظ إلى مجلد التنزيلات (Download)`, 'info');
      cleanup();
    }
  });
}

/**
 * Gets user's configured custom save folder (Defaults to 'Sanad Accounting')
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
  return 'Sanad Accounting';
}

/**
 * Sets user's configured custom save folder
 */
export function setCustomSaveFolder(folderName: string): void {
  try {
    const clean = (folderName || 'Sanad Accounting').trim().replace(/^\/+|\/+$/g, '');
    localStorage.setItem('sanad_custom_save_folder', clean || 'Sanad Accounting');
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
 * Dynamically checks and requests Android / iOS storage permissions (Scoped Storage + Legacy) with strict timeout.
 */
export async function ensureStoragePermissions(): Promise<boolean> {
  if (
    typeof window !== 'undefined' &&
    typeof (window as any).AndroidInterface?.requestPermissions === 'function'
  ) {
    try {
      (window as any).AndroidInterface.requestPermissions([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
      ]);
    } catch {
      // Ignore bridge error
    }
  }

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
    // Android 10+ Scoped Storage permits Documents & Download writes without publicStorage permission
    return true;
  }
}

/**
 * Ensures public external folders exist under Download/<folder> and Documents/<folder> on Android
 */
export async function ensureCustomFolder(folderPath?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  await ensureStoragePermissions();
  const targetFolder = folderPath || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '') || 'Sanad Accounting';

  let createdAny = false;
  try {
    await withTimeout(
      Filesystem.mkdir({
        path: `Download/${cleanFolder}`,
        directory: Directory.ExternalStorage,
        recursive: true,
      }),
      2500,
      'mkdir-public-download'
    );
    createdAny = true;
  } catch {
    // Continue to Documents
  }

  try {
    await withTimeout(
      Filesystem.mkdir({
        path: cleanFolder,
        directory: Directory.Documents,
        recursive: true,
      }),
      2500,
      'mkdir-public-documents'
    );
    createdAny = true;
  } catch {
    // Ignore if blocked by OEM policy
  }

  return createdAny;
}

/**
 * Ensures the default or custom Sanad folder exists inside public Android storage
 */
export async function ensureSanadFolder(): Promise<boolean> {
  return ensureCustomFolder(getCustomSaveFolder());
}

/**
 * Saves a backup file silently in public local storage (Documents / Download) before falling back
 */
export async function saveSilentBackupFile(
  fileName: string,
  jsonString: string,
  folderPath?: string
): Promise<string | null> {
  const isNative = Capacitor.isNativePlatform();
  const targetFolder = folderPath || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '') || 'Sanad Accounting';

  if (isNative) {
    await ensureCustomFolder(cleanFolder);
    // 1. Public Download/<cleanFolder>/<fileName>
    try {
      const dlResult = await withTimeout(
        Filesystem.writeFile({
          path: `Download/${cleanFolder}/${fileName}`,
          data: jsonString,
          directory: Directory.ExternalStorage,
          recursive: true,
          encoding: Encoding.UTF8,
        }),
        4000,
        'silent-backup-external-download'
      );
      return dlResult.uri;
    } catch {
      // Fall through to Public Documents
    }

    // 2. Public Documents/<cleanFolder>/<fileName>
    try {
      const docResult = await withTimeout(
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
      return docResult.uri;
    } catch {
      // Final fallback to app cache if all public locations are denied
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
 * Triggers a clean browser / Desktop file download without revoking the Blob URL too early.
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
 * Saves a file and offers sharing / download options safely across Capacitor Native, Mobile PWAs ("سُند"), and Web Browsers.
 */
export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  if (isExportLock) {
    console.log('[saveAndShareFile] Export already in progress, skipping duplicate tap.');
    return false;
  }

  isExportLock = true;
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
      Boolean(providedBlob) ||
      (typeof data === 'string' &&
        (mimeType.includes('pdf') ||
          fileName.toLowerCase().endsWith('.pdf') ||
          mimeType.includes('image') ||
          fileName.toLowerCase().endsWith('.png') ||
          fileName.toLowerCase().endsWith('.jpg') ||
          fileName.toLowerCase().endsWith('.jpeg')) &&
        !data.startsWith('%PDF'));

    let cleanData = isBase64 && data
      ? data.replace(/^data:.*?;base64,/, '').replace(/\s/g, '')
      : data || '';

    // If caller passed a Blob (e.g. pdfService / ReceiptPrinter) with empty data string, extract Base64 cleanly
    if (providedBlob && !cleanData) {
      try {
        cleanData = await blobToBase64(providedBlob);
      } catch (e) {
        console.warn('[fileExport] Failed to read blob as base64:', e);
      }
    }

    const blob =
      providedBlob ||
      (isBase64 ? base64ToBlob(cleanData, mimeType) : new Blob([cleanData], { type: mimeType }));

    const targetFolder = folderName || getCustomSaveFolder();
    const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '') || 'Sanad Accounting';
    const relativeFilePath = `${cleanFolder}/${fileName}`;

    // 1. CAPACITOR NATIVE (ANDROID / IOS APK) PATH
    if (isNative) {
      let shareUri = '';
      let savedLocationLabel = '';

      await ensureStoragePermissions();
      await ensureCustomFolder(cleanFolder);

      // A) Write to PUBLIC External Download/<cleanFolder>/<fileName> FIRST (visible in Phone Files / Downloads)
      try {
        const dlRes = await withTimeout(
          Filesystem.writeFile({
            path: `Download/${cleanFolder}/${fileName}`,
            data: cleanData,
            directory: Directory.ExternalStorage,
            recursive: true,
            encoding: isBase64 ? undefined : Encoding.UTF8,
          }),
          4000,
          'write-external-download'
        );
        if (dlRes?.uri) shareUri = dlRes.uri;
        savedLocationLabel = `Download/${cleanFolder}/${fileName}`;
      } catch {
        // Fallback to Public Documents
      }

      // B) Write to PUBLIC Directory.Documents (<cleanFolder>/<fileName>)
      try {
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
        if (!savedLocationLabel) {
          savedLocationLabel = `Documents/${cleanFolder}/${fileName}`;
        }
      } catch {
        // Ignore if Scoped Storage restricts Documents subfolder
      }

      // C) Prepare FileProvider-safe Cache URI for Share.share if public URI unavailable
      if (!shareUri) {
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
      }

      // D) Trigger Native Android/iOS Share Sheet
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
          if (savedLocationLabel) {
            showToast(`تم حفظ الملف في الذاكرة العامة: ${savedLocationLabel}`, 'success');
          }
          return true;
        } catch (shareErr: any) {
          const errStr = String(shareErr?.message || shareErr || '').toLowerCase();
          if (errStr.includes('cancel') || errStr.includes('dismiss') || errStr.includes('abort')) {
            if (savedLocationLabel) {
              showToast(`تم حفظ نسخة في الذاكرة العامة: ${savedLocationLabel}`, 'info');
            }
            return true;
          }
          if (savedLocationLabel) {
            showToast(`تم حفظ الملف في الذاكرة العامة: ${savedLocationLabel}`, 'success');
            return true;
          }
        }
      }
    }

    // 1.5 CUSTOM ANDROID APK WEBVIEW NATIVE BRIDGE (MediaStore.Downloads -> Download/Sanad Accounting)
    if (
      typeof window !== 'undefined' &&
      typeof (window as any).AndroidInterface?.saveBase64File === 'function'
    ) {
      try {
        const b64Payload = isBase64 ? cleanData : await blobToBase64(blob);
        const savedOk = (window as any).AndroidInterface.saveBase64File(
          fileName,
          b64Payload,
          mimeType
        );
        if (savedOk) {
          showToast(`تم حفظ الملف في الهاتف: Download/Sanad Accounting/${fileName}`, 'success');
          return true;
        }
      } catch (nativeBridgeErr) {
        console.warn('[fileExport] AndroidInterface.saveBase64File warning:', nativeBridgeErr);
      }
    }

    const isMobileBrowser =
      typeof navigator !== 'undefined' &&
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');

    // 2. REGISTER REAL HTTP ATTACHMENT STREAM ON BACKEND SERVER
    // Works in Android WebAPK ("سُند"), Mobile Chrome, Android WebView, and iframes!
    const serverDownloadUrl = await registerServerDownloadBridge(
      fileName,
      cleanData,
      isBase64,
      mimeType
    );

    // 3. IF ON MOBILE (WebAPK "سُند" / Android Chrome / iOS / WebView):
    if (isMobileBrowser) {
      // Trigger immediate HTTP attachment download if bridge succeeded (saves straight into Phone's Download folder!)
      if (serverDownloadUrl) {
        triggerHttpAttachmentDownload(serverDownloadUrl, fileName);
      }

      // Also present the interactive Mobile Save & Share Sheet so the user has a 1-tap fresh gesture
      // for both Direct Download (Download folder) and Native Android Share ("ملفاتي" / WhatsApp / Drive)
      showMobileFileActionSheet({
        fileName,
        blob,
        mimeType,
        title,
        text,
        serverDownloadUrl,
      });

      showToast(`تم تجهيز (${fileName}) — يُحفظ في مجلد التنزيلات (Download) بالهاتف`, 'success');
      return true;
    }

    // 4. DESKTOP / LAPTOP BROWSER PATH
    if (serverDownloadUrl) {
      const ok = triggerHttpAttachmentDownload(serverDownloadUrl, fileName);
      if (ok) {
        showToast(`تم حفظ الملف (${fileName}) في مجلد التنزيلات (Downloads) بنجاح`, 'success');
        return true;
      }
    }

    const downloaded = triggerBlobDownload(blob, fileName);
    if (downloaded) {
      showToast(`تم حفظ الملف (${fileName}) في التنزيلات بنجاح`, 'success');
      return true;
    }

    // 5. EMERGENCY CLIPBOARD FALLBACK FOR TEXT FILES
    if (!isBase64 && cleanData && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(cleanData);
        showToast(`تم نسخ محتوى الملف (${fileName}) إلى الحافظة بنجاح`, 'success');
        return true;
      } catch {
        // Ignore
      }
    }

    showToast('تعذر حفظ الملف تلقائياً، يرجى التحقق من أذونات المتصفح', 'error');
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
