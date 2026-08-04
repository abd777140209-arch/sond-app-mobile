/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * File Export & Native SAF Storage Engine - Sond Accounting System
 * برمجة وتطوير: م. عبدالمجيد المحواشي
 */

export interface SaveAndShareOptions {
  fileName: string;
  data: string | any;
  title?: string;
  text?: string;
}

/**
 * 🎯 1. دالة حفظ وتصدير النسخة الاحتياطية (تتعرف تلقائياً على الأندرويد والكمبيوتر)
 */
export async function saveAndShareFile(options: SaveAndShareOptions): Promise<boolean> {
  const jsonString = typeof options.data === 'string' ? options.data : JSON.stringify(options.data, null, 2);
  const fileName = options.fileName || `sanad_backup_${new Date().toISOString().slice(0, 10)}.json`;

  // أ) إذا كان التطبيق يعمل داخل أندرويد APK (يستدعي الناتيف المباشر)
  if (typeof (window as any).AndroidBridge !== 'undefined') {
    (window as any).AndroidBridge.saveBackupNative(jsonString, fileName);
    return true;
  }

  // ب) إذا كان التطبيق يعمل على الكمبيوتر ومتصفحات Chrome الحديثة
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

  // ج) طريقة التنزيل المباشر القياسية (Fallback)
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
    console.error('Export failed:', err);
    return false;
  }
}

/**
 * 🎯 2. دالة قراءة واسترجاع النسخة الاحتياطية المباشرة
 */
export async function importDataFromFile(): Promise<any> {
  // أ) إذا كان التطبيق على الأندرويد
  if (typeof (window as any).AndroidBridge !== 'undefined') {
    (window as any).AndroidBridge.restoreBackupNative();
    return new Promise((resolve) => {
      (window as any).onNativeRestoreSuccess = (data: any) => {
        resolve(data);
      };
    });
  }

  // ب) إذا كان التطبيق على الكمبيوتر
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

// دوال جانبية للتوافق مع شاشات البرنامج
export function getCustomSaveFolder(): string { return 'SanadAccounting'; }
export function setCustomSaveFolder(folderName: string): void {}
export function getGoogleDriveAccount(): string { return ''; }
export function setGoogleDriveAccount(email: string): void {}
export async function ensureStoragePermissions(): Promise<boolean> { return true; }
