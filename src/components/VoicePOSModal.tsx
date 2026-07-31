/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Sparkles, Check, X, AlertCircle, ShoppingCart, User, Tag, ArrowRight } from 'lucide-react';
import { Product, Customer } from '../types';
import { soundManager } from '../utils/sound';

interface VoicePOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  customers: Customer[];
  onAddToCartByVoice: (product: Product, quantity: number) => void;
  onSetCustomerByVoice: (customer: Customer) => void;
  onSetDiscountByVoice: (discount: number) => void;
  onSetPaymentTypeByVoice: (type: 'cash' | 'debt') => void;
  onCompleteSaleByVoice: () => void;
  onClearCartByVoice: () => void;
}

export default function VoicePOSModal({
  isOpen,
  onClose,
  products,
  customers,
  onAddToCartByVoice,
  onSetCustomerByVoice,
  onSetDiscountByVoice,
  onSetPaymentTypeByVoice,
  onCompleteSaleByVoice,
  onClearCartByVoice
}: VoicePOSModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedFeedback, setParsedFeedback] = useState<string[]>([]);
  const [voiceError, setVoiceError] = useState('');
  const [simulatedInput, setSimulatedInput] = useState('');

  const recognitionRef = useRef<any>(null);
  const lastProcessedRef = useRef<string>('');

  useEffect(() => {
    if (!isOpen) {
      stopListening();
      return;
    }

    const handleBack = () => {
      onClose();
    };
    window.addEventListener('android-modal-close', handleBack);

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'ar-YE'; // دعم اللهجة اليمنية/العربية المباشرة
          recognition.continuous = false; // التوقف التلقائي بعد نهاية الجملة لمنع التكرار
          recognition.interimResults = false;

          recognition.onresult = (event: any) => {
            let currentTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              currentTranscript += event.results[i][0].transcript;
            }
            setTranscript(currentTranscript);
            if (currentTranscript !== lastProcessedRef.current) {
              lastProcessedRef.current = currentTranscript;
              processVoiceCommand(currentTranscript);
            }
          };

          recognition.onerror = (event: any) => {
            setIsListening(false);
            if (event.error === 'aborted' || event.error === 'no-speech') {
              // Ignore silent aborts or timeouts
              return;
            }
            console.warn('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
              setVoiceError('⚠️ تم رفض إذن المايكروفون. يرجى السماح بالوصول إلى المايكروفون من إعدادات المتصفح أو التطبيق، أو كتابة الأمر نصياً بالأسفل.');
            } else {
              setVoiceError('💡 المايكروفون غير متاح مباشر في هذه البيئة. يمكنك كتابة الأوامر أو الضغط على الأزرار بالأسفل.');
            }
          };

          recognition.onend = () => {
            setIsListening(false);
          };

          recognitionRef.current = recognition;
        } catch (err) {
          console.warn('Failed to setup speech recognition:', err);
          setVoiceError('💡 المايكروفون غير متاح. استخدم خيارات المحاكاة بالأزرار السريعة.');
        }
      } else {
        setVoiceError('💡 المايكروفون غير متاح بالمتصفح. استخدم الأوامر النصية بالأزرار السريعة بالأسفل.');
      }
    } catch (e) {
      console.warn('Speech Recognition init error:', e);
      setVoiceError('💡 يمكنك استخدام المحاكاة بالأوامر النصية بالأزرار بالأسفل.');
    }

    return () => {
      stopListening();
      window.removeEventListener('android-modal-close', handleBack);
    };
  }, [isOpen]);

  const startListening = async () => {
    soundManager.playScanBeep();
    setVoiceError('');
    setTranscript('');
    setParsedFeedback([]);
    lastProcessedRef.current = '';

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.warn('Microphone permission request failed:', err);
      }
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        setIsListening(false);
        setVoiceError('⚠️ متعذر البدء بالمايكروفون المباشر. استخدم خانة كتابة الأوامر بالأسفل.');
      }
    } else {
      setIsListening(false);
      setVoiceError('💡 المايكروفون غير متاح. يرجى اختيار الأمر من الأزرار السريعة بالأسفل.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const processVoiceCommand = (text: string) => {
    if (!text || text.trim().length === 0) return;
    const lowerText = text.trim().toLowerCase();
    const activeProducts = products.filter(p => !p.isDeleted);
    const activeCustomers = customers.filter(c => !c.isDeleted);

    const feedbackList: string[] = [];

    // 1. إتمام الفاتورة
    if (lowerText.includes('إتمام') || lowerText.includes('حفظ') || lowerText.includes('إنهاء')) {
      feedbackList.push('✅ أمر: إتمام الفاتورة وحفظ البيع');
      onCompleteSaleByVoice();
      soundManager.playSuccessChime();
      setParsedFeedback(feedbackList);
      stopListening();
      return;
    }

    // 2. تفريغ السلة
    if (lowerText.includes('مسح السلة') || lowerText.includes('إلغاء الفاتورة') || lowerText.includes('تفريغ')) {
      feedbackList.push('🗑️ أمر: تفريغ سلة المبيعات');
      onClearCartByVoice();
      setParsedFeedback(feedbackList);
      stopListening();
      return;
    }

    // 3. طريقة الدفع
    if (lowerText.includes('نقدا') || lowerText.includes('نقدي') || lowerText.includes('كاش')) {
      feedbackList.push('💵 تحديد طريقة الدفع: نقداً (كاش)');
      onSetPaymentTypeByVoice('cash');
    } else if (lowerText.includes('آجل') || lowerText.includes('اجل') || lowerText.includes('دين') || lowerText.includes('حساب')) {
      feedbackList.push('📑 تحديد طريقة الدفع: آجل (ذمم)');
      onSetPaymentTypeByVoice('debt');
    }

    // 4. الخصم
    const discountMatch = lowerText.match(/(?:خصم|تخفيض|خصمية)\s*(\d+)/);
    if (discountMatch && discountMatch[1]) {
      const discVal = parseInt(discountMatch[1], 10);
      if (!isNaN(discVal) && discVal >= 0) {
        feedbackList.push(`🏷️ تطبيق خصم بقيمة: ${discVal}`);
        onSetDiscountByVoice(discVal);
      }
    }

    // 5. العميل
    for (const cust of activeCustomers) {
      const nameParts = cust.name.toLowerCase().split(' ');
      const matchName = nameParts.some(part => part.length > 2 && lowerText.includes(part));
      if (matchName) {
        feedbackList.push(`👤 تم اختيار العميل: ${cust.name}`);
        onSetCustomerByVoice(cust);
        break;
      }
    }

    // 6. إضافة منتج
    for (const prod of activeProducts) {
      const prodName = prod.name.toLowerCase();
      const nameTokens = prodName.split(' ').filter(t => t.length > 2);
      const isMatch = nameTokens.length > 0 && nameTokens.some(token => lowerText.includes(token));

      if (isMatch) {
        let qty = 1;
        const qtyMatch = lowerText.match(/(?:كمية|عدد|حبات|حبة)?\s*(\d+)/);
        if (qtyMatch && qtyMatch[1]) {
          const parsedQty = parseInt(qtyMatch[1], 10);
          if (!isNaN(parsedQty) && parsedQty > 0) {
            qty = parsedQty;
          }
        }
        feedbackList.push(`🛒 إضافة السلعة: "${prod.name}" (الكمية: ${qty})`);
        onAddToCartByVoice(prod, qty);
        break;
      }
    }

    setParsedFeedback(feedbackList);
  };

  const handleSimulatedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedInput.trim()) return;
    soundManager.playScanBeep();
    setTranscript(simulatedInput);
    processVoiceCommand(simulatedInput);
    setSimulatedInput('');
  };

  const presetVoiceCommands = [
    { label: '🛒 إضافة آيفون 15 (كمية 2)', text: 'إضافة آيفون 15 كمية 2' },
    { label: '🛒 إضافة شاحن سريع', text: 'إضافة شاحن سريع' },
    { label: '👤 العميل: علي أحمد', text: 'اختيار العميل علي أحمد' },
    { label: '🏷️ خصم 500 ريال', text: 'خصم 500' },
    { label: '📑 الدفع آجل (ذمم)', text: 'الدفع آجل' },
    { label: '✅ إتمام حفظ الفاتورة', text: 'إتمام الفاتورة' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 relative overflow-hidden">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <span>المساعد الصوتي الذكي (Voice POS)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">ذكاء اصطناعي</span>
              </h3>
              <p className="text-xs text-slate-500">تحدث بنص الفاتورة لإضافة السلع، الخصم، والعميل أوتوماتيكياً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center space-y-4 py-2">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isListening
                ? 'bg-rose-600 text-white animate-bounce shadow-rose-200 ring-8 ring-rose-100'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95'
            }`}
          >
            {isListening ? (
              <MicOff className="w-10 h-10" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
          </button>

          <div>
            <p className="text-xs font-bold text-slate-700">
              {isListening ? '🎙️ يستمع الآن... تحدث بصوت واضح (مثل: أضف آيفون 15)' : 'اضغط على المايكروفون للبدء بالتحدث'}
            </p>
          </div>

          {transcript && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium text-right max-h-24 overflow-y-auto">
              <span className="font-bold text-slate-400 block text-[10px] mb-1">النص المسموع:</span>
              "{transcript}"
            </div>
          )}

          {parsedFeedback.length > 0 && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-right space-y-1">
              <span className="text-[10px] text-emerald-600 block">⚡ الأوامر المطبقة فورياً:</span>
              {parsedFeedback.map((fb, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{fb}</span>
                </div>
              ))}
            </div>
          )}

          {voiceError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-right flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{voiceError}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <label className="text-xs font-bold text-slate-700 block">اختبار سريع أو إدخال بالأوامر النصية:</label>
          
          <form onSubmit={handleSimulatedSubmit} className="flex gap-2">
            <input
              type="text"
              value={simulatedInput}
              onChange={(e) => setSimulatedInput(e.target.value)}
              placeholder='اكتب أمراً مثل "اضف ايفون 15 كمية 2" أو "خصم 500"...'
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95"
            >
              تنفيذ
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {presetVoiceCommands.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  soundManager.playScanBeep();
                  setTranscript(preset.text);
                  processVoiceCommand(preset.text);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-[11px] text-slate-700 font-medium transition cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-sm"
          >
            تم وإغلاق المساعد الصوتي
          </button>
        </div>

      </div>
    </div>
  );
}
