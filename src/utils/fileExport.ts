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
  mimeType?: string;
  title?: string;
  text?: string;
  folderName?: string;
}

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
 * 🎯 دالة الحفظ والمشاركة المحدثة - تضمن نجاح العمليات على كافة إصدارات الأندرويد
 */
export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  const {
    fileName,
    data,
    isBase64 = false,
    mimeType = 'application/json',
    title = 'تصدير سند/تقرير - تطبيق سند',
    text = 'ملف مستند من نظام سند المحاسبي'
  } = options;

  const isNative = Capacitor.isNativePlatform();
  const cleanData = isBase64 && data.includes(',') ? data.split(',')[1] : data;

  // 1. التنفيذ المباشر على أجهزة الأندرويد والجوال (Native App)
  if (isNative) {
    try {
      await ensureStoragePermissions();

      // نكتب الملف في ذاكرة Cache لضمان وصول FileProvider والمشاركة بدون رفض من الأندرويد
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: cleanData,
        directory: Directory.Cache,
        encoding: isBase64 ? undefined : Encoding.UTF8
      });

      let fileUri = writeResult?.uri;

      if (!fileUri) {
        const uriRes = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache
        });
        fileUri = uriRes.uri;
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
      console.warn('Native Capacitor file write failed, falling back to Blob download:', nativeErr);
    }
  }

  // 2. التنفيذ على المتصفح / الويب (Web Download Fallback)
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
    console.error('All file export and download attempts failed:', webErr);
    alert('⚠️ تعذر إكمال تنزيل الملف بشكل تلقائي. يرجى إعادة المحاولة.');
    return false;
  }
}

/**
 * 🎯 دالة استيراد وقراءة الملفات المباشرة من ذاكرة الجوال والكمبيوتر
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
