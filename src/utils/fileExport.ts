/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * File Export & Storage Engine - Sond Accounting System
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export interface SaveAndShareOptions {
  fileName: string;
  data: string | any;
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
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage !== 'granted') {
      const req = await Filesystem.requestPermissions();
      return req.publicStorage === 'granted';
    }
    return true;
  } catch {
    return true;
  }
}

export async function ensureCustomFolder(folderPath?: string): Promise<boolean> {
  return true;
}

export async function ensureSanadFolder(): Promise<boolean> {
  return true;
}

export async function saveSilentBackupFile(
  fileName: string,
  jsonString: string,
  folderPath?: string
): Promise<string | null> {
  try {
    localStorage.setItem(`sanad_auto_backup_${fileName}`, jsonString);
    return `localStorage:sanad_auto_backup_${fileName}`;
  } catch (e) {
    return null;
  }
}

/**
 * 🎯 دالة الحفظ والمشاركة الموحدة المعتمدة على Capacitor Native
 */
export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  const jsonString = typeof options.data === 'string' ? options.data : JSON.stringify(options.data, null, 2);
  const fileName = options.fileName || `sanad_backup_${new Date().toISOString().slice(0, 10)}.json`;
  const isNative = Capacitor.isNativePlatform();

  // 1. التنفيذ الناتيف على أجهزة الأندرويد
  if (isNative) {
    try {
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: jsonString,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      if (writeResult.uri) {
        await Share.share({
          title: options.title || 'حفظ نسخة احتياطية - نظام سند',
          text: options.text || 'ملف بيانات نظام سند المحاسبي',
          url: writeResult.uri,
          dialogTitle: 'اختر مكان حفظ الملف أو مشاركته'
        });
        return true;
      }
    } catch (e) {
      console.warn('Native export fallback:', e);
    }
  }

  // 2. التنفيذ على الكمبيوتر أو المتصفح
  try {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 🎯 دالة استعادة وقراءة الملفات
 */
export async function importDataFromFile(): Promise<any> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json, application/json';

    input.onchange = (event: any) => {
      const file = event.target.files?.[0];
      if (!file) {
        reject('لم يتم اختيار ملف');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsedData = JSON.parse(e.target?.result as string);
          resolve(parsedData);
        } catch (err) {
          reject('ملف النسخة الاحتياطية غير صالح أو تالف');
        }
      };
      reader.onerror = () => reject('حدث خطأ أثناء قراءة الملف');
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
  return saveAndShareFile({ fileName, data: jsonOrBase64Content });
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
