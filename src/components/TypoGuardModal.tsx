/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, AlertTriangle, Check, X, HelpCircle, ArrowLeft } from 'lucide-react';
import { soundManager } from '../utils/sound';

export interface TypoGuardDetails {
  title: string;
  itemName?: string;
  expectedValue: string | number;
  enteredValue: string | number;
  reason: string;
  currency?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface TypoGuardModalProps {
  isOpen: boolean;
  details: TypoGuardDetails | null;
  onClose: () => void;
}

export default function TypoGuardModal({
  isOpen,
  details,
  onClose
}: TypoGuardModalProps) {
  if (!isOpen || !details) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-rose-200 shadow-2xl max-w-md w-full p-6 space-y-5 relative overflow-hidden">
        
        {/* Top Warning Banner */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rose-100 text-rose-600 border border-rose-200 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-black text-slate-900">{details.title || 'درع حماية الأخطاء المالية (Typo Guard)'}</h3>
            </div>
            <p className="text-xs text-rose-600 font-bold">تنبيه حماية: تم اكتشاف تفاوات غير معتاد في المبالغ المدخلة!</p>
          </div>
        </div>

        {/* Warning Content Details Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs text-slate-800">
          
          {details.itemName && (
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <span className="text-slate-500">اسم السلعة / البيان:</span>
              <span className="font-bold text-slate-900">{details.itemName}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-slate-500">المبلغ المتوقع (الافتراضي):</span>
            <span className="font-mono font-bold text-slate-900">{details.expectedValue} {details.currency || ''}</span>
          </div>

          <div className="flex justify-between items-center text-rose-600">
            <span className="font-bold">المبلغ المدخل حالياً:</span>
            <span className="font-mono font-black text-base underline decoration-rose-400 decoration-2">{details.enteredValue} {details.currency || ''}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-medium text-[11px] leading-relaxed">
            ⚠️ <strong>السبب:</strong> {details.reason}
          </div>

        </div>

        {/* Action Choice Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              soundManager.playScanBeep();
              details.onCancel();
              onClose();
            }}
            className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer transition border border-slate-200"
          >
            تعديل المبالغ (إلغاء)
          </button>

          <button
            onClick={() => {
              soundManager.playSuccessChime();
              details.onConfirm();
              onClose();
            }}
            className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-md transition active:scale-95"
          >
            تأكيد واستمرار رغم ذلك
          </button>
        </div>

      </div>
    </div>
  );
}
