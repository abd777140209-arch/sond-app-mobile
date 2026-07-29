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
  if (!Capacitor.isNativePlatform() && !(window as any).Capacitor) {
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
  if (!Capacitor.isNativePlatform() && !(window as any).Capacitor) {
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
    title = 'تصدير ملف',
    text = 'ملف من النظام المحاسبي'
  } = options;

  const isNative = Capacitor.isNativePlatform() || !!(window as any).Capacitor;

  if (isNative) {
    try {
      // 1. التحقق من صلاحيات التخزين وطلبها من المستخدم
      const hasPermission = await ensureStoragePermissions();
      if (!hasPermission) {
        alert('⚠️ يتطلب النظام صلاحيات الوصول للتخزين لحفظ الملفات والفواتير. يرجى الانتقال إلى (إعدادات الهاتف > التطبيقات > سند المحاسبي > الأذونات) وتفعيل إذن التخزين.');
      }

      const folderName = 'SanadAccounting'; // اسم المجلد بداخل Documents

      // 2. إنشاء المجلد تلقائياً بذاكرة الهاتف مع خاصية recursive: true
      try {
        await Filesystem.mkdir({
          path: folderName,
          directory: Directory.Documents,
          recursive: true
        });
      } catch (mkdirErr) {
        console.log('المجلد موجود مسبقاً أو تعذر إنشاؤه في Documents:', mkdirErr);
      }

      const cleanData = isBase64 && data.includes(',') ? data.split(',')[1] : data;
      const filePath = `${folderName}/${fileName}`;

      // 3. كتابة وحفظ الملف داخل المجلد الذي تم إنشاؤه
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
        console.warn('تعذر الحفظ في Documents/SanadAccounting، جاري المحاولة في المجلد المؤقت (Cache):', docErr);
        writeResult = await Filesystem.writeFile({
          path: fileName,
          data: cleanData,
          directory: Directory.Cache,
          recursive: true,
          encoding: isBase64 ? undefined : Encoding.UTF8
        });
      }

      // 4. فتح شاشة المشاركة الرسمية للهاتف فور التصدير
      if (writeResult && writeResult.uri) {
        await Share.share({
          title: title,
          text: text,
          url: writeResult.uri,
          dialogTitle: title || 'مشاركة أو حفظ الملف'
        });
        return true;
      } else {
        throw new Error('لم يتم إرجاع مسار الملف المحفوظ.');
      }

    } catch (error: any) {
      console.error('خطأ أثناء حفظ أو مشاركة الملف:', error);
      alert('⚠️ تعذر حفظ أو مشاركة الملف. يرجى التأكد من إعطاء صلاحيات التخزين للتطبيق من إعدادات الهاتف (الإعدادات > التطبيقات > سند المحاسبي > الأذونات > التخزين).');
      return false;
    }
  }

  // 5. التصدير المباشر للويب أو المتصفح العادي
  try {
    const cleanData = isBase64 && data.includes(',') ? data.split(',')[1] : data;
    const blob = isBase64 
      ? base64ToBlob(cleanData, mimeType)
      : new Blob([data], { type: mimeType });

    const blobUrl = URL.createObjectURL(blob);

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

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch (webErr) {
    console.error('خطأ في التنزيل عبر المتصفح:', webErr);
    alert('⚠️ حدث خطأ أثناء تنزيل الملف في المتصفح.');
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
