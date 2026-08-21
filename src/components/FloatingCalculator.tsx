/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calculator, X, Copy, Check, Delete } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { soundManager } from '../utils/sound';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyResult?: (val: string) => void;
}

export default function FloatingCalculator({ isOpen, onClose, onCopyResult }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [copied, setCopied] = useState(false);

  const handleNumClick = (val: string) => {
    soundManager.playScanBeep();
    if (display === '0' || display === 'خطأ') {
      setDisplay(val);
    } else {
      setDisplay(prev => prev + val);
    }
  };

  const handleOpClick = (op: string) => {
    soundManager.playScanBeep();
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handleClear = () => {
    soundManager.playScanBeep();
    setDisplay('0');
    setEquation('');
  };

  const handleDelete = () => {
    soundManager.playScanBeep();
    if (display.length > 1) {
      setDisplay(prev => prev.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleCalculate = () => {
    try {
      soundManager.playSuccessChime();
      const fullEq = (equation + display)
        .replace(/×/g, '*')
        .replace(/÷/g, '/');
      
      const sanitized = fullEq.replace(/[^0-9\+\-\*\/\%\.\(\)\s]/g, '');
      if (!sanitized.trim()) {
        setDisplay('خطأ');
        return;
      }
      
      // Safe evaluation without eval()
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${sanitized})`)();
      if (isNaN(result) || !isFinite(result)) {
        setDisplay('خطأ');
      } else {
        const formatted = String(Math.round(result * 100) / 100);
        setDisplay(formatted);
        setEquation('');
      }
    } catch (e) {
      setDisplay('خطأ');
    }
  };

  const handleCopy = () => {
    soundManager.playSuccessChime();
    navigator.clipboard.writeText(display);
    setCopied(true);
    if (onCopyResult) {
      onCopyResult(display);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-xs sm:max-w-sm bg-white dark:bg-[#0B141F] border border-slate-200 dark:border-sky-800/40 rounded-3xl shadow-2xl p-4 text-slate-900 dark:text-white"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">الآلة الحاسبة السريعة</h3>
                <p className="text-[10px] text-slate-400">حساب فوري مع إمكانية نسخ الناتج</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Display Area */}
          <div className="bg-slate-50 dark:bg-[#060B10] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-3 text-left font-mono">
            <div className="text-[11px] text-slate-400 dark:text-slate-500 min-h-[16px] overflow-hidden text-ellipsis whitespace-nowrap">
              {equation || '\u00A0'}
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-sky-300 overflow-x-auto whitespace-nowrap scrollbar-none dir-ltr">
              {display}
            </div>
          </div>

          {/* Copy Result Button */}
          <button
            onClick={handleCopy}
            className="w-full mb-3 py-2 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/80 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800/50 text-sky-700 dark:text-sky-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم نسخ الناتج بنجاح' : 'نسخ الناتج للحافظة'}</span>
          </button>

          {/* Button Keypad */}
          <div className="grid grid-cols-4 gap-1.5 text-sm font-bold">
            <button onClick={handleClear} className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 active:scale-95 transition cursor-pointer font-black">C</button>
            <button onClick={handleDelete} className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 hover:bg-amber-100 active:scale-95 transition cursor-pointer flex items-center justify-center"><Delete className="w-4 h-4" /></button>
            <button onClick={() => handleOpClick('%')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 active:scale-95 transition cursor-pointer font-black">%</button>
            <button onClick={() => handleOpClick('÷')} className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 hover:bg-sky-200 active:scale-95 transition cursor-pointer font-black">÷</button>

            <button onClick={() => handleNumClick('7')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">7</button>
            <button onClick={() => handleNumClick('8')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">8</button>
            <button onClick={() => handleNumClick('9')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">9</button>
            <button onClick={() => handleOpClick('×')} className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 hover:bg-sky-200 active:scale-95 transition cursor-pointer font-black">×</button>

            <button onClick={() => handleNumClick('4')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">4</button>
            <button onClick={() => handleNumClick('5')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">5</button>
            <button onClick={() => handleNumClick('6')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">6</button>
            <button onClick={() => handleOpClick('-')} className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 hover:bg-sky-200 active:scale-95 transition cursor-pointer font-black">-</button>

            <button onClick={() => handleNumClick('1')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">1</button>
            <button onClick={() => handleNumClick('2')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">2</button>
            <button onClick={() => handleNumClick('3')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">3</button>
            <button onClick={() => handleOpClick('+')} className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 hover:bg-sky-200 active:scale-95 transition cursor-pointer font-black">+</button>

            <button onClick={() => handleNumClick('0')} className="col-span-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-bold">0</button>
            <button onClick={() => handleNumClick('.')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white active:scale-95 transition cursor-pointer font-black">.</button>
            <button onClick={handleCalculate} className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white transition cursor-pointer font-black text-base shadow-sm">=</button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
