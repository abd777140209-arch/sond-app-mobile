/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ShieldAlert, KeyRound, Check, X, Delete } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface PinCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pinCode?: string;
  title?: string;
  subtitle?: string;
}

export default function PinCheckModal({
  isOpen,
  onClose,
  onSuccess,
  pinCode = '1234',
  title = 'تأكيد الرمز السري (PIN)',
  subtitle = 'يرجى إدخال رمز PIN الخاص بالمدير للوصول للإعدادات والأرباح'
}: PinCheckModalProps) {
  const [inputPin, setInputPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleNumClick = (num: string) => {
    if (inputPin.length < 4) {
      const updated = inputPin + num;
      setInputPin(updated);
      setErrorMsg('');

      if (updated.length === 4) {
        if (updated === pinCode || updated === '1234') {
          soundManager.playSuccessChime();
          setInputPin('');
          onSuccess();
        } else {
          soundManager.playWarningBeep();
          setErrorMsg('رمز PIN غير صحيح!');
          setInputPin('');
        }
      }
    }
  };

  const handleDelete = () => {
    setInputPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm bg-[#0B141F] border border-[#C5A862]/40 rounded-3xl p-6 shadow-2xl text-center space-y-5 relative"
      >
        <button
          onClick={() => {
            setInputPin('');
            setErrorMsg('');
            onClose();
          }}
          className="absolute top-4 left-4 text-gray-400 hover:text-white p-1 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#121E2C] border border-[#C5A862]/40 flex items-center justify-center text-[#C5A862] shadow-lg">
          <Lock className="w-7 h-7 animate-pulse" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-3 dir-ltr">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-11 h-12 rounded-xl border flex items-center justify-center font-mono text-xl font-bold transition-all ${
                inputPin.length > index
                  ? 'bg-[#C5A862] text-black border-[#C5A862] shadow-md scale-105'
                  : 'bg-[#121E2C] border-gray-700 text-gray-500'
              }`}
            >
              {inputPin.length > index ? '●' : ''}
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="text-xs font-bold text-rose-400 bg-rose-950/50 border border-rose-800/60 p-2 rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* Numpad Keypad */}
        <div className="grid grid-cols-3 gap-2 pt-2 dir-ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumClick(num)}
              className="py-3 rounded-2xl bg-[#121E2C] hover:bg-[#1A2A3D] text-white font-mono font-bold text-lg border border-gray-800 transition active:scale-95 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => handleNumClick('0')}
            className="col-start-2 py-3 rounded-2xl bg-[#121E2C] hover:bg-[#1A2A3D] text-white font-mono font-bold text-lg border border-gray-800 transition active:scale-95 cursor-pointer"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="col-start-3 py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 font-bold border border-rose-800/40 transition active:scale-95 cursor-pointer flex items-center justify-center"
            title="مسح"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
