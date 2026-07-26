import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Layers, Plus, Pencil, Trash2, Check, AlertCircle } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onAddCategory: (categoryName: string) => void;
  onUpdateCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (categoryName: string) => void;
}

export default function ManageCategoriesModal({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}: ManageCategoriesModalProps) {
  const [newCatName, setNewCatName] = useState('');
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setErrorMsg('يرجى إدخال اسم التصنيف');
      soundManager.playWarningBeep();
      return;
    }
    if (categories.includes(trimmed)) {
      setErrorMsg('هذا التصنيف موجود بالفعل!');
      soundManager.playWarningBeep();
      return;
    }

    onAddCategory(trimmed);
    soundManager.playScanBeep();
    setNewCatName('');
  };

  const handleStartEdit = (cat: string) => {
    setEditingCatName(cat);
    setEditingValue(cat);
    setErrorMsg('');
  };

  const handleSaveEdit = (oldName: string) => {
    setErrorMsg('');
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setErrorMsg('اسم التصنيف لا يمكن أن يكون فارغاً');
      soundManager.playWarningBeep();
      return;
    }
    if (trimmed !== oldName && categories.includes(trimmed)) {
      setErrorMsg('توجد فئة بنفس هذا الاسم مسبقاً');
      soundManager.playWarningBeep();
      return;
    }

    onUpdateCategory(oldName, trimmed);
    soundManager.playScanBeep();
    setEditingCatName(null);
  };

  const handleDelete = (cat: string) => {
    if (categories.length <= 1) {
      setErrorMsg('يجب الإبقاء على تصنيف واحد على الأقل في النظام');
      soundManager.playWarningBeep();
      return;
    }
    soundManager.playScanBeep();
    onDeleteCategory(cat);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl z-10 border border-slate-200 text-right space-y-4 max-h-[85vh] flex flex-col text-slate-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 bg-slate-50 p-2 rounded-xl shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">إدارة تصنيفات المستودع</h3>
                  <p className="text-[11px] text-slate-400">إضافة، تعديل، وحذف أقسام المنتجات</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick Add Form */}
            <form onSubmit={handleAdd} className="flex gap-2 shrink-0">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="اسم تصنيف جديد..."
                className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة</span>
              </button>
            </form>

            {/* List of categories */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                التصنيفات الحالية ({categories.length}):
              </label>

              {categories.map((cat) => {
                const isEditing = editingCatName === cat;

                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/70 transition"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1 bg-white border border-purple-400 text-xs rounded-lg px-2.5 py-1.5 font-bold focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat)}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                          title="حفظ التعديل"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatName(null)}
                          className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                          title="إلغاء"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          {cat}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="تعديل اسم التصنيف"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="حذف التصنيف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
