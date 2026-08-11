import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface PDFData {
  title: string;
  customerName: string;
  phone?: string;
  date: string;
  totalAmount: string;
  items: Array<{ description: string; amount: string }>;
}

export const generateAndSharePDF = async (data: PDFData) => {
  try {
    // 1. إنشاء مستند PDF نصي خفيف وسريع بدون استهلاك ذاكرة
    const doc = new jsPDF();
    
    // إعداد النصوص والعناوين
    doc.setFontSize(18);
    doc.text(data.title, 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Customer: ${data.customerName}`, 15, 35);
    if (data.phone) doc.text(`Phone: ${data.phone}`, 15, 42);
    doc.text(`Date: ${data.date}`, 15, 49);
    
    doc.line(15, 55, 195, 55);
    
    let yPosition = 65;
    doc.text('Description', 15, yPosition);
    doc.text('Amount', 160, yPosition);
    doc.line(15, yPosition + 3, 195, yPosition + 3);
    
    yPosition += 12;
    data.items.forEach((item) => {
      doc.text(item.description, 15, yPosition);
      doc.text(item.amount, 160, yPosition);
      yPosition += 8;
    });
    
    doc.line(15, yPosition, 195, yPosition);
    yPosition += 10;
    doc.setFontSize(14);
    doc.text(`Total: ${data.totalAmount}`, 15, yPosition);

    // 2. إذا كان النظام أندرويد (APK)
    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `Sanad_${Date.now()}.pdf`;

      // حفظ الملف في الذاكرة
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache // استخدام Cache لسرعة المعالجة
      });

      // فتح نافذة المشاركة فوراً (واتساب / خيارات الجوال)
      await Share.share({
        title: data.title,
        url: savedFile.uri,
      });

    } else {
      // 3. إذا كان النظام ديسكتوب / ويندوز
      doc.save(`${data.title}_${Date.now()}.pdf`);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};
