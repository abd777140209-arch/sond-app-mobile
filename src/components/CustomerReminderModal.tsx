/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare, Share2, Copy, Check, Sparkles, AlertCircle, Phone, Calendar } from 'lucide-react';
import { Customer } from '../types';
import { soundManager } from '../utils/sound';
import { openWhatsApp, openSms } from '../utils/nativeLauncher';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

interface CustomerReminderModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
  currency: string;
  storeName?: string;
  initialTemplate?: string;
  onSaveTemplate?: (template: string) => void;
}

export default function CustomerReminderModal({
  isOpen,
  customer,
  onClose,
  currency,
  storeName = 'سند المحاسبي',
  initialTemplate,
  onSaveTemplate
}: CustomerReminderModalProps) {
  const defaultTemplate = initialTemplate || 
    "السلام عليكم ورحمة الله وبركاته أخانا العزيز {name}.\nنود تذكيركم بلطف بأن إجمالي المديونية المتبقية عليكم لصالح {storeName} هي: {balance} {currency}.\nتاريخ الاستحقاق المتفق عليه: {dueDate}.\nشاكرين ومقدرين كريم تعاونكم معنا.";

  const [template, setTemplate] = useState(defaultTemplate);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialTemplate) {
      setTemplate(initialTemplate);
    }
  }, [initialTemplate, isOpen]);

  if (!isOpen || !customer) return null;

  // Compile template tags dynamically
  const compiledMessage = template
    .replace(/\{name\}/g, customer.name)
    .replace(/\{balance\}/g, customer.totalDebt.toLocaleString())
    .replace(/\{currency\}/g, currency)
    .replace(/\{dueDate\}/g, customer.debtDueDate && !isNaN(new Date(customer.debtDueDate).getTime()) ? new Date(customer.debtDueDate).toLocaleDateString('ar-YE') : 'غير محدد')
    .replace(/\{storeName\}/g, storeName);

  // Phone clean formatting
  const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
  const finalWhatsAppPhone = cleanPhone.startsWith('77') || cleanPhone.startsWith('73') || cleanPhone.startsWith('71') || cleanPhone.startsWith('70') 
    ? '967' + cleanPhone
    : cleanPhone;

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(compiledMessage);
    setCopied(true);
    soundManager.playSuccessChime();
    setTimeout(() => setCopied(false), 2500);
  };

  // Device native share sheet (الهاتف المحمول)
  const handleNativeShare = async () => {
    soundManager.playScanBeep();
    if (Capacitor.isNativePlatform() || (window as any).Capacitor) {
      try {
        await Share.share({
          title: `تذكير مديونية - ${customer.name}`,
          text: compiledMessage,
          dialogTitle: 'تذكير مديونية عبر التطبيقات'
        });
        return;
      } catch (err) {
        console.log('Native share error or cancelled', err);
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `تذكير مديونية - ${customer.name}`,
          text: compiledMessage
        });
      } catch (err) {
        console.log('User cancelled share or not supported', err);
      }
    } else {
      handleCopy();
    }
  };

  // Save template as default
  const handleSaveAsDefault = () => {
    if (onSaveTemplate) {
      onSaveTemplate(template);
      soundManager.playSuccessChime();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 text-right text-slate-900"
          >
            {/* Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2 mb-1 shrink-0" />

            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">أداة تذكير الدين والمشاركة المباشرة</h3>
                  <p className="text-[11px] text-slate-400">{customer.name} - (مدين بـ {customer.totalDebt.toLocaleString()} {currency})</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              
              {/* Due Date Notice Badge */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>تاريخ استحقاق الدين:</span>
                </span>
                <span className="font-mono bg-amber-100 px-2 py-0.5 rounded-lg text-amber-900">
                  {customer.debtDueDate ? new Date(customer.debtDueDate).toLocaleDateString('ar-YE') : 'غير محدد بعد'}
                </span>
              </div>

              {/* Template Variables Helper */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>قالب الرسالة الديناميكي (المتغيرات المدعومة):</span>
                  </label>
                  {onSaveTemplate && (
                    <button
                      type="button"
                      onClick={handleSaveAsDefault}
                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      حفظ كقالب افتراضي 💾
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200" title="اسم العميل">{'{name}'}</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200" title="مبلغ الدين">{'{balance}'}</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200" title="العملة">{'{currency}'}</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200" title="تاريخ الاستحقاق">{'{dueDate}'}</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200" title="اسم المتجر">{'{storeName}'}</span>
                </div>

                <textarea
                  rows={3}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Live Preview Box */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">معاينة نص الرسالة النهائية المرسلة:</label>
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs leading-relaxed whitespace-pre-wrap font-sans shadow-inner">
                  {compiledMessage}
                </div>
              </div>

              {/* Mobile Direct Share Tools (WhatsApp / SMS / Phone Share / Copy) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 block">أدوات الإرسال والمشاركة المباشرة عبر الهاتف:</label>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  
                  {/* 1. WhatsApp Button */}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      openWhatsApp(finalWhatsAppPhone, compiledMessage);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>واتساب</span>
                  </button>

                  {/* 2. SMS Button */}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playScanBeep();
                      openSms(cleanPhone, compiledMessage);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>رسالة SMS</span>
                  </button>

                  {/* 3. Native Phone Share */}
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>مشاركة الهاتف</span>
                  </button>

                  {/* 4. Copy Text */}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                    <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
                  </button>

                </div>
              </div>

            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
