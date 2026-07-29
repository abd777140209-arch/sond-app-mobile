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
 * Ensures a custom folder (e.g. 'SanadAccounting' or user specified path) exists inside Directory.Documents on Android/Native
 */
export async function ensureCustomFolder(folderPath: string = 'SanadAccounting'): Promise<boolean> {
  if (!Capacitor.isNativePlatform() && !(window as any).Capacitor) {
    return false;
  }
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
  const isNative = Capacitor.isNativePlatform() || !!(window as any).Capacitor;
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
 * Saves a file to Documents/SanadAccounting and opens the Android Native Share Sheet
 */
export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  const {
    fileName,
    data,
    isBase64 = false,
    mimeType = 'application/octet-stream',
    title = 'مشاركة ملف من سند المحاسبي',
    text = 'تقرير من تطبيق سند المحاسبي'
  } = options;

  const isNative = Capacitor.isNativePlatform() || !!(window as any).Capacitor;

  if (isNative) {
    try {
      await ensureSanadFolder();
      const filePath = `SanadAccounting/${fileName}`;
      
      let writeResult;
      try {
        writeResult = await Filesystem.writeFile({
          path: filePath,
          data: data,
          directory: Directory.Documents,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
      } catch (docErr) {
        console.warn('Failed to write in Documents/SanadAccounting, trying root Cache:', docErr);
        writeResult = await Filesystem.writeFile({
          path: fileName,
          data: data,
          directory: Directory.Cache,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
      }

      const fileUri = writeResult.uri;

      // Share using Capacitor Native Share Sheet
      await Share.share({
        title: title,
        text: text,
        url: fileUri,
        dialogTitle: title,
      });

      return true;
    } catch (err: any) {
      console.warn('Native file save/share fallback:', err);
    }
  }

  // Web Browser Fallback
  try {
    let blob: Blob;
    if (isBase64) {
      const byteCharacters = atob(data.includes(',') ? data.split(',')[1] : data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: mimeType });
    } else {
      blob = new Blob([data], { type: mimeType });
    }

    const blobUrl = URL.createObjectURL(blob);

    // Try Web Share API if available
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: mimeType })] })) {
      const fileToShare = new File([blob], fileName, { type: mimeType });
      await navigator.share({
        title: title,
        text: text,
        files: [fileToShare]
      });
      URL.revokeObjectURL(blobUrl);
      return true;
    }

    // Standard download link for Desktop Web
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch (webErr) {
    console.error('Web download error:', webErr);
    return false;
  }
}
