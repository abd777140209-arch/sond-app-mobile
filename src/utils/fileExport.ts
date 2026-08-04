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
  return true;
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

export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  const jsonString = typeof options.data === 'string' ? options.data : JSON.stringify(options.data, null, 2);
  const fileName = options.fileName || `sanad_backup_${new Date().toISOString().slice(0, 10)}.json`;

  if (typeof (window as any).AndroidBridge !== 'undefined') {
    (window as any).AndroidBridge.saveBackupNative(jsonString, fileName);
    return true;
  }

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'JSON Backup', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      return true;
    } catch (e) {
      return false;
    }
  }

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

export async function importDataFromFile(): Promise<any> {
  if (typeof (window as any).AndroidBridge !== 'undefined') {
    (window as any).AndroidBridge.restoreBackupNative();
    return new Promise((resolve) => {
      (window as any).onNativeRestoreSuccess = (data: any) => {
        resolve(data);
      };
    });
  }

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
