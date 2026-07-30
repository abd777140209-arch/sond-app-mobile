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
export async function ensureCustomFolder(folderPath: string = 'SanadAccounting'): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  await ensureStoragePermissions();
  const cleanFolder = (folderPath || 'SanadAccounting').trim().replace(/^\/+|\/+$/g, '');
  try {
    await Filesystem.mkdir({
      path: cleanFolder,
      directory: Directory.Documents,
      recursive: true,
    });
    return true;
  } catch (err) {
    // Folder might already exist or permission needed
    console.log(`Directory ${cleanFolder} check/creation:`, err);
    return true;
  }
}

/**
 * Ensures the 'SanadAccounting' folder exists inside Directory.Documents on Android/Native
 */
export async function ensureSanadFolder(): Promise<boolean> {
  return ensureCustomFolder('SanadAccounting');
}

/**
 * Saves a backup file silently in local storage without opening UI dialogs
 */
export async function saveSilentBackupFile(
  fileName: string,
  jsonString: string,
  folderPath: string = 'SanadAccounting'
): Promise<string | null> {
  const isNative = Capacitor.isNativePlatform();
  const cleanFolder = (folderPath || 'SanadAccounting').trim().replace(/^\/+|\/+$/g, '');

  if (isNative) {
    try {
      await ensureCustomFolder(cleanFolder);
      const writeResult = await Filesystem.writeFile({
        path: `${cleanFolder}/${fileName}`,
        data: jsonString,
        directory: Directory.Documents,
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
    mimeType = 'application/octet-stream',
    title = 'تصدير ملف',
    text = 'ملف من النظام المحاسبي'
  } = options;

  const isNative = Capacitor.isNativePlatform();
  const cleanData = isBase64 && data.includes(',') ? data.split(',')[1] : data;

  // 1. Native Capacitor Attempt
  if (isNative) {
    try {
      await ensureStoragePermissions();
      const folderName = 'SanadAccounting';

      try {
        await Filesystem.mkdir({
          path: folderName,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (mkdirErr) {
        // Folder exists or cannot be created in Documents
      }

      const filePath = `${folderName}/${fileName}`;
      let writeResult;

      try {
        writeResult = await Filesystem.writeFile({
          path: filePath,
          data: cleanData,
          directory: Directory.Documents,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
      } catch (docErr) {
        console.warn('Filesystem write to Documents failed, attempting Directory.Cache:', docErr);
        writeResult = await Filesystem.writeFile({
          path: fileName,
          data: cleanData,
          directory: Directory.Cache,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
      }

      if (writeResult && writeResult.uri) {
        try {
          await Share.share({
            title: title,
            text: text,
            url: writeResult.uri,
            dialogTitle: title || 'مشاركة أو حفظ الملف'
          });
          return true;
        } catch (shareErr: any) {
          const errStr = String(shareErr || '').toLowerCase();
          if (errStr.includes('cancel') || errStr.includes('dismiss') || errStr.includes('abort') || errStr.includes('closed')) {
            // User intentionally canceled share dialog - consider it handled without error
            return true;
          }
          console.warn('Native Share dialog failed or was closed:', shareErr);
          // Fall through to web download if share failed
        }
      }
    } catch (nativeErr) {
      console.warn('Native Capacitor file write/share failed, falling back to Web Blob download:', nativeErr);
    }
  }

  // 2. Web / Webview Fallback (Blob + Navigator Share / Download Link)
  try {
    const blob = isBase64 
      ? base64ToBlob(cleanData, mimeType)
      : new Blob([data], { type: mimeType });

    const blobUrl = URL.createObjectURL(blob);

    // Try Web Share API if supported
    if (typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const fileToShare = new File([blob], fileName, { type: mimeType });
        if (navigator.canShare({ files: [fileToShare] })) {
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
          // User canceled share
          URL.revokeObjectURL(blobUrl);
          return true;
        }
        console.warn('Web share failed, proceeding to direct download link:', webShareErr);
      }
    }

    // Direct Browser Download via <a> tag
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
    alert('⚠️ تعذر إكمال تنزيل الملف بشكل تلقائي. يرجى إعادة المحاولة.');
    return false;
  }
}

// دالة تحويل Base64 إلى Blob للمتصفح
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
