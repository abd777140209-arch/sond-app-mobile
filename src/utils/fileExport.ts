/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * File Export & Storage Manager - Sond Accounting (Smart Native Fallback)
 * برمجة وتطوير: م. عبدالمجيد المحواشي
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
  folderName?: string;
}

/**
 * جلب مجلد الحفظ المخصص
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
 * تحديد مجلد الحفظ المخصص
 */
export function setCustomSaveFolder(folderName: string): void {
  try {
    const clean = (folderName || 'SanadAccounting').trim().replace(/^\/+|\/+$/g, '');
    localStorage.setItem('sanad_custom_save_folder', clean || 'SanadAccounting');
  } catch (e) {
    console.warn('Error setting custom save folder:', e);
  }
}

export function getGoogleDriveAccount(): string {
  try {
    return localStorage.getItem('sanad_google_drive_account') || '';
  } catch (e) {
    return '';
  }
}

export function setGoogleDriveAccount(email: string): void {
  try {
    localStorage.setItem('sanad_google_drive_account', (email || '').trim());
  } catch (e) {
    console.warn('Error setting google drive account:', e);
  }
}

/**
 * 🎯 التحقق المباشر من الأذونات بأسلوب Android Phone الذكي
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
    try {
      await Filesystem.mkdir({
        path: cleanFolder,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      return true;
    } catch (fallbackErr) {
      return true;
    }
  }
}

export async function ensureSanadFolder(): Promise<boolean> {
  return ensureCustomFolder(getCustomSaveFolder());
}

/**
 * حفظ صامت للنسخة الاحتياطية تلقائياً
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
      return writeResult.uri;
    } catch (err) {
      try {
        const extResult = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        return extResult.uri;
      } catch (extErr) {
        return null;
      }
    }
  } else {
    try {
      localStorage.setItem(`sanad_auto_backup_${fileName}`, jsonString);
      return `localStorage:sanad_auto_backup_${fileName}`;
    } catch (e) {
      return null;
    }
  }
}

/**
 * 🎯 دالة الحفظ والمشاركة المحدثة بالكامل - تعمل على الهاتف والكمبيوتر بنفس خفة الأندرويد فون
 */
export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  const {
    fileName,
    data,
    isBase64 = false,
    mimeType = 'application/json',
    title = 'تصدير سند/تقرير - تطبيق سند',
    text = 'ملف مستند من نظام سند المحاسبي',
    folderName
  } = options;

  const isNative = Capacitor.isNativePlatform();
  const cleanData = isBase64 && data.includes(',') ? data.split(',')[1] : data;
  const targetFolder = folderName || getCustomSaveFolder();
  const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, '');
  const relativeFilePath = `${cleanFolder}/${fileName}`;

  // 1. معالجة الهاتف (Native Platform)
  if (isNative) {
    try {
      await ensureStoragePermissions();
      
      let fileUri = '';

      // المحاولة الأولى: الحفظ في Cache لضمان استدعاء الـ Intent وسرعة فتح قائمة المشاركة
      try {
        const cacheWrite = await Filesystem.writeFile({
          path: fileName,
          data: cleanData,
          directory: Directory.Cache,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        fileUri = cacheWrite.uri;
      } catch (e) {
        // المحاولة الثانية: الحفظ المباشر في Documents
        await ensureCustomFolder(cleanFolder);
        const docWrite = await Filesystem.writeFile({
          path: relativeFilePath,
          data: cleanData,
          directory: Directory.Documents,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
        fileUri = docWrite.uri;
      }

      if (fileUri) {
        await Share.share({
          title: title,
          text: text,
          url: fileUri,
          dialogTitle: title || 'حفظ وتصدير الملف'
        });
        return true;
      }

    } catch (nativeErr) {
      console.warn('Native Capacitor export failed, trying Web fallback:', nativeErr);
    }
  }

  // 2. معالجة الكمبيوتر والمتصفح (Web Download Fallback)
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
    }, 2000);

    return true;

  } catch (webErr) {
    console.error('All file export attempts failed:', webErr);
    alert('⚠️ تعذر إكمال التنزيل بشكل تلقائي.');
    return false;
  }
}

/**
 * 🎯 دالة استيراد وقراءة ملفات النسخ الاحتياطية (قراءة مباشرة)
 */
export async function importDataFromFile(): Promise<any> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json, application/json';

    input.onchange = (event: any) => {
      const file = event.target.files?.[0];
      if (!file) {
        reject('لم يتم اختيار أي ملف');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsedData = JSON.parse(e.target?.result as string);
          resolve(parsedData);
        } catch (err) {
          reject('الملف المختار غير صالح أو تالف');
        }
      };
      reader.onerror = () => reject('حدث خطأ أثناء قراءة الملف من ذاكرة الجهاز');
      reader.readAsText(file);
    };

    input.click();
  });
}

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
    text: `نسخة احتياطية لنظام سند`
  });

  if (!isNative) {
    window.open('https://drive.google.com/drive/my-drive', '_blank');
  }

  return true;
}

export function base64ToBlob(base64Data: string, contentType: string = 'application/json'): Blob {
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
