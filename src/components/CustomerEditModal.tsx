/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Save, User, Phone, Calendar, Award, FileText, AlertCircle, Check } from 'lucide-react';
import { Customer } from '../types';
import { soundManager } from '../utils/sound';

interface CustomerEditModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSave: (updatedCustomer: Customer) => void;
  currency: string;
}

export default function CustomerEditModal({
  isOpen,
  customer,
  onClose,
  onSave,
  currency
}: CustomerEditModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setDebtDueDate(customer.debtDueDate || '');
      setLoyaltyPoints(customer.loyaltyPoints || 0);
      setNotes(customer.notes || '');
      setError('');
    }
  }, [customer, isOpen]);

  if (!isOpen || !customer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('⚠️ اسم العميل مطلوب!');
      soundManager.playWarningBeep();
      return;
    }

    const updated: Customer = {
      ...customer,
      name: name.trim(),
      phone: phone.trim() || 'بدون هاتف',
      debtDueDate: debtDueDate || undefined,
      loyaltyPoints: Math.max(0, loyaltyPoints),
      notes: notes.trim()
    };

    soundManager.playSuccessChime();
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/30 rounded-xl text-blue-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">تعديل بيانات العميل</h3>
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

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Customer Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>اسم العميل:</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              placeholder="اسم العميل الثلاثي..."
            />
          </div>

          {/* Customer Phone */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-600" />
              <span>رقم الهاتف (للاتصال والواتساب):</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs font-mono rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              placeholder="77XXXXXXX"
            />
          </div>

          {/* Debt Due Date (تاريخ استحقاق الدين) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>تاريخ استحقاق الدين (Maturity Date):</span>
            </label>
            <input
              type="date"
              value={debtDueDate}
              onChange={(e) => setDebtDueDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs font-mono font-bold rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            <p className="text-[10px] text-slate-400">حدد التاريخ النهائي المتفق عليه لتسديد المديونية</p>
          </div>

          {/* Loyalty Points (نقاط الولاء) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-purple-600" />
                <span>رصيد نقاط الولاء (Loyalty Points):</span>
              </span>
              <span className="text-[10px] text-purple-600 font-bold">🎖️ {loyaltyPoints} نقطة</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={loyaltyPoints}
                onChange={(e) => setLoyaltyPoints(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-bold font-mono rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setLoyaltyPoints(prev => prev + 10)}
                className="px-3 py-2.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold shrink-0 hover:bg-purple-100 transition"
              >
                +10 هدية
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>ملاحظات خاصة بالعميل:</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أدخل أي ملاحظات حول العميل، الضمانات، أو العنوان..."
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
