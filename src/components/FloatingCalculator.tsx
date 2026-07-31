/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calculator, X, Copy, Check, Delete, Move } from 'lucide-react';
import { motion } from 'motion/react';

interface FloatingCalculatorProps {
  onCopyResult?: (val: string) => void;
}

export default function FloatingCalculator({ onCopyResult }: FloatingCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [copied, setCopied] = useState(false);

  const handleNumClick = (val: string) => {
    if (display === '0' || display === 'خطأ') {
      setDisplay(val);
    } else {
      setDisplay(prev => prev + val);
    }
  };

  const handleOpClick = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
  };

  const handleDelete = () => {
    if (display.length > 1) {
      setDisplay(prev => prev.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleCalculate = () => {
    try {
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
    navigator.clipboard.writeText(display);
    setCopied(true);
    if (onCopyResult) {
      onCopyResult(display);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Draggable Floating Toggle Button (Bottom-Right) */}
      <motion.div 
        drag
        dragMomentum={false}
        whileDrag={{ scale: 1.1 }}
        className="fixed bottom-24 right-6 z-50 no-print touch-none cursor-grab active:cursor-grabbing"
      >
        <button
          id="floating_calculator_trigger"
          onClick={() => setIsOpen(!isOpen)}
          className={`p-3.5 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center cursor-pointer ${
            isOpen
              ? 'bg-rose-600 hover:bg-rose-700 text-white rotate-90 scale-110'
              : 'bg-gradient-to-r from-[#0284C7] to-[#0369A1] hover:from-[#0369A1] hover:to-[#075985] text-white shadow-sky-500/30 hover:scale-105 border-2 border-white dark:border-slate-800'
          }`}
          title="آلة حاسبة سريعة (يمكنك سحبها وتحريكها بحرية)"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Calculator className="w-6 h-6" />}
        </button>
      </motion.div>

      {/* Draggable Floating Calculator Window */}
      {isOpen && (
        <motion.div 
          drag
          dragMomentum={false}
          className="fixed bottom-28 right-4 md:right-6 z-50 w-72 md:w-80 bg-white dark:bg-[#0B141F] border border-slate-200 dark:border-sky-800/40 rounded-3xl shadow-2xl p-4 text-slate-900 dark:text-white transition-all animate-in fade-in slide-in-from-bottom-5 no-print touch-none"
        >
          {/* Header & Drag Handle */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800 cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2">
              <Move className="w-3.5 h-3.5 text-slate-400" />
              <div className="p-1.5 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
                <Calculator className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">آلة حاسبة (اسحب للتحريك)</span>
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Display Area */}
          <div className="bg-slate-50 dark:bg-[#060B10] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-3 text-left font-mono">
            <div className="text-[10px] text-slate-400 dark:text-slate-500 min-h-[16px] overflow-hidden text-ellipsis whitespace-nowrap">
              {equation}
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-800 dark:text-sky-300 overflow-x-auto whitespace-nowrap scrollbar-none dir-ltr">
              {display}
            </div>
          </div>

          {/* Copy Result Button */}
          <button
            onClick={handleCopy}
            className="w-full mb-3 py-2 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/80 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800/50 text-sky-700 dark:text-sky-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم نسخ الناتج بنجاح' : 'نسخ الناتج للحافظة'}</span>
          </button>

          {/* Button Keypad */}
          <div className="grid grid-cols-4 gap-1.5 text-sm font-bold">
            <button onClick={handleClear} className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition">C</button>
            <button onClick={handleDelete} className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition"><Delete className="w-4 h-4 mx-auto" /></button>
            <button onClick={() => handleOpClick('%')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition">%</button>
            <button onClick={() => handleOpClick('÷')} className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 hover:bg-sky-200 transition">÷</button>

            <button onClick={() => handleNumClick('7')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">7</button>
            <button onClick={() => handleNumClick('8')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">8</button>
            <button onClick={() => handleNumClick('9')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">9</button>
            <button onClick={() => handleOpClick('×')} className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 hover:bg-sky-200 transition">×</button>

            <button onClick={() => handleNumClick('4')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">4</button>
            <button onClick={() => handleNumClick('5')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">5</button>
            <button onClick={() => handleNumClick('6')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">6</button>
            <button onClick={() => handleOpClick('-')} className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 hover:bg-sky-200 transition">-</button>

            <button onClick={() => handleNumClick('1')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">1</button>
            <button onClick={() => handleNumClick('2')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">2</button>
            <button onClick={() => handleNumClick('3')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">3</button>
            <button onClick={() => handleOpClick('+')} className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 hover:bg-sky-200 transition">+</button>

            <button onClick={() => handleNumClick('0')} className="col-span-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">0</button>
            <button onClick={() => handleNumClick('.')} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-800 dark:text-white transition">.</button>
            <button onClick={handleCalculate} className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition">=</button>
          </div>

        </motion.div>
      )}
    </>
  );
}
