/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { X, Printer, Share2, Send, Download, FileText, Calendar, Award, User, Phone, Wallet, CheckCircle2, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Customer, Invoice, Payment } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';
import { getSafeHtml2CanvasOptions } from '../utils/pdfHelper';

interface CustomerStatementModalProps {
  isOpen: boolean;
  customer: Customer | null;
  invoices: Invoice[];
  payments: Payment[];
  onClose: () => void;
  currency: string;
  storeName?: string;
  storeLogoUrl?: string;
  isPrivacyMode?: boolean;
}

export default function CustomerStatementModal({
  isOpen,
  customer,
  invoices,
  payments,
  onClose,
  currency,
  storeName = 'سند المحاسبي',
  storeLogoUrl,
  isPrivacyMode = false
}: CustomerStatementModalProps) {
  const statementRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !customer) return null;

  const fmtAmount = (num: number) => {
    if (isPrivacyMode) return '**** ' + currency;
    return num.toLocaleString() + ' ' + currency;
  };

  // Filter invoices and payments for this specific customer
  const customerInvoices = invoices.filter(inv => inv.customerId === customer.id && inv.status !== 'refunded');
  const customerPayments = payments.filter(p => p.customerId === customer.id);

  // Combine into single chronological ledger list
  const ledgerEntries = [
    ...customerInvoices.map(inv => ({
      id: inv.id,
      date: inv.date,
      type: 'invoice' as const,
      description: `فاتورة مبيعات آجل رقم #${inv.invoiceNumber}`,
      debit: inv.finalAmount, // عليه (دين يزيد)
      credit: 0, // له
      itemsCount: inv.items.reduce((s, i) => s + i.quantity, 0)
    })),
    ...customerPayments.map(pay => ({
      id: pay.id,
      date: pay.date,
      type: 'payment' as const,
      description: `سند قبض نقدية: ${pay.note || 'تسديد دفعة'}`,
      debit: 0,
      credit: pay.amount, // له (دين ينقص)
      itemsCount: 0
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balances
  let runningBalance = 0;
  const ledgerWithBalance = ledgerEntries.map(entry => {
    runningBalance += (entry.debit - entry.credit);
    return {
      ...entry,
      balance: runningBalance
    };
  });

  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);

  const generatePDFAndShare = async () => {
    if (isGeneratingPDF || !statementRef.current) return;
    soundManager.playSuccessChime();
    setIsGeneratingPDF(true);

    try {
      const element = statementRef.current;
      const canvas = await html2canvas(element, getSafeHtml2CanvasOptions());

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      const fileName = `كشف_حساب_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      const base64Data = pdf.output('datauristring').split(',')[1];

      await saveAndShareFile({
        fileName,
        data: base64Data,
        isBase64: true,
        mimeType: 'application/pdf',
        title: `كشف حساب - ${customer.name}`,
        text: `كشف حساب العميل ${customer.name} - إجمالي المديونية: ${customer.totalDebt.toLocaleString()} ${currency}`
      });
    } catch (err) {
      console.error('Customer statement PDF generation error:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = async () => {
    soundManager.playScanBeep();
    await generatePDFAndShare();
  };

  // Phone clean formatting
  const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
  const finalWhatsAppPhone = cleanPhone.startsWith('77') || cleanPhone.startsWith('73') || cleanPhone.startsWith('71') || cleanPhone.startsWith('70') 
    ? '967' + cleanPhone
    : cleanPhone;

  const formattedDueDate = customer.debtDueDate && !isNaN(new Date(customer.debtDueDate).getTime())
    ? new Date(customer.debtDueDate).toLocaleDateString('ar-YE')
    : 'غير محدد';

  const summaryText = `*كشف حساب عميل - ${storeName}*\nالعميل: *${customer.name}*\nرصيد المديونية النهائي: *${customer.totalDebt.toLocaleString()} ${currency}*\nتاريخ استحقاق الدين: *${formattedDueDate}*\nنقاط الولاء: *${customer.loyaltyPoints || 0} نقطة*`;

  const whatsappUrl = `https://api.whatsapp.com/send?phone=${finalWhatsAppPhone}&text=${encodeURIComponent(summaryText)}`;

  const handleNativeShare = async () => {
    soundManager.playScanBeep();
    await generatePDFAndShare();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        
        {/* Header (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/30 rounded-xl text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">كشف حساب عميل مفصل</h3>
              <p className="text-[11px] text-slate-400">{customer.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Statement Content */}
        <div ref={statementRef} className="p-6 space-y-5 overflow-y-auto print:overflow-visible print:p-8">
          
          {/* Statement Header Branding */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              {storeLogoUrl && (
                <img 
                  src={storeLogoUrl} 
                  alt={storeName} 
                  className="w-12 h-12 rounded-xl object-contain border border-slate-200 bg-white p-0.5" 
                />
              )}
              <div>
                <h2 className="text-xl font-black text-slate-900">{storeName}</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">نظام إدارة المبيعات والحسابات الشامل</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">تاريخ التقرير: {new Date().toLocaleDateString('ar-YE')}</p>
              </div>
            </div>
            <div className="text-left font-mono">
              <div className="inline-block px-3 py-1 bg-slate-100 text-slate-900 border border-slate-300 rounded-lg text-xs font-bold">
                كشف حساب عميل #CUST-{customer.id.slice(-4)}
              </div>
            </div>
          </div>

          {/* Customer Metadata Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">اسم العميل:</span>
              <span className="font-black text-slate-900">{customer.name}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">رقم الهاتف:</span>
              <span className="font-mono font-bold text-slate-800">{customer.phone}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">تاريخ استحقاق الدين:</span>
              <span className="font-mono font-bold text-amber-700">
                {customer.debtDueDate ? new Date(customer.debtDueDate).toLocaleDateString('ar-YE') : 'غير محدد'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">نقاط الولاء:</span>
              <span className="font-bold text-purple-700">🎖️ {customer.loyaltyPoints || 0} نقطة</span>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800">حركة الفواتير والسندات المالية المفصلة:</h4>
            
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">البيان / تفاصيل العملية</th>
                    <th className="p-2.5 text-center text-rose-700">مدين (عليه)</th>
                    <th className="p-2.5 text-center text-emerald-700">دائن (له)</th>
                    <th className="p-2.5 text-center">الرصيد المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {ledgerWithBalance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        لا توجد أي حركات مالية أو فواتير مسجلة لهذا العميل حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    ledgerWithBalance.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 text-slate-500 whitespace-nowrap text-[11px]">
                          {new Date(item.date).toLocaleDateString('ar-YE')}
                        </td>
                        <td className="p-2.5 font-sans font-bold text-slate-900">
                          {item.description}
                        </td>
                        <td className="p-2.5 text-center font-bold text-rose-600">
                          {item.debit > 0 ? item.debit.toLocaleString() : '-'}
                        </td>
                        <td className="p-2.5 text-center font-bold text-emerald-600">
                          {item.credit > 0 ? item.credit.toLocaleString() : '-'}
                        </td>
                        <td className="p-2.5 text-center font-black text-slate-900 dir-ltr">
                          {item.balance.toLocaleString()} {currency}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statement Summary Footer */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white flex justify-between items-center shadow-md">
            <div>
              <span className="text-xs text-slate-400 block">إجمالي صافي المديونية المستحقة المطلوبة:</span>
              <span className="text-[11px] text-slate-400">حساب آجل نشط</span>
            </div>
            <div className="text-left font-mono">
              <span className="text-lg font-black text-emerald-400 dir-ltr">{fmtAmount(customer.totalDebt)}</span>
            </div>
          </div>

          {/* Stamp / Signature placeholder for printed docs */}
          <div className="hidden print:flex justify-between items-center pt-8 border-t border-slate-300 text-xs font-bold text-slate-700">
            <div>توقيع وتختيم المتجر: ....................</div>
            <div>توقيع وإقرار العميل بالسداد: ....................</div>
          </div>

        </div>

        {/* Action Controls Footer (Hidden in Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
          
          <div className="flex items-center gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => soundManager.playScanBeep()}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Send className="w-4 h-4" />
              <span>إرسال عبر واتساب</span>
            </a>

            <button
              onClick={handleNativeShare}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة الجوال</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة كشف الحساب / PDF</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
