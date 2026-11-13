/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Mic, MicOff, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { Product, Customer } from '../types';
import { soundManager } from '../utils/sound';
import { parseVoicePOSWithGemini } from '../services/GoogleAIService';

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
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedFeedback, setParsedFeedback] = useState<string[]>([]);
  const [voiceError, setVoiceError] = useState('');
  const [simulatedInput, setSimulatedInput] = useState('');

  const recognitionRef = useRef<any>(null);
  const lastProcessedRef = useRef<string>('');

  const activeProducts = useMemo(() => products.filter(p => !p.isDeleted && p.stock > 0), [products]);
  const activeCustomers = useMemo(() => customers.filter(c => !c.isDeleted && c.isActive !== false), [customers]);

  useEffect(() => {
    if (!isOpen) {
      stopListening();
      return;
    }

    const handleBack = () => onClose();
    window.addEventListener('android-modal-close', handleBack);

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'ar-YE';
          recognition.continuous = false;
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
            if (event.error === 'aborted' || event.error === 'no-speech') return;
            if (event.error === 'not-allowed') {
              setVoiceError('⚠️ تم رفض إذن المايكروفون. يمكنك تفعيله من إعدادات المتصفح أو كتابة الأمر نصياً بالأسفل.');
            } else {
              setVoiceError('💡 المايكروفون غير متاح حالياً. يمكنك كتابة الأوامر أو الضغط على الأزرار السريعة بالأسفل.');
            }
          };

          recognition.onend = () => setIsListening(false);
          recognitionRef.current = recognition;
        } catch {
          setVoiceError('💡 المايكروفون غير متاح. استخدم كتابة الأوامر أو الأزرار السريعة.');
        }
      } else {
        setVoiceError('💡 المايكروفون غير مدعوم بهذا المتصفح. استخدم الأوامر النصية بالأسفل.');
      }
    } catch {
      setVoiceError('💡 يمكنك استخدام الأوامر النصية والأزرار السريعة بالأسفل.');
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
      } catch {
        // Ignore if denied; SpeechRecognition handles fallback message
      }
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
        setVoiceError('⚠️ تعذر بدء المايكروفون المباشر. استخدم خانة كتابة الأوامر بالأسفل.');
      }
    } else {
      setIsListening(false);
      setVoiceError('💡 المايكروفون غير متاح. يرجى كتابة الأمر أو استخدام الأزرار السريعة بالأسفل.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  };

  const processVoiceCommand = async (text: string) => {
    if (!text || text.trim().length === 0) return;
    const lowerText = text.trim().toLowerCase();
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
        const qtyMatch = lowerText.match(/(?:كمية|عدد|حبات|حبة)\s*(\d+)/);
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

    // 7. Smart Gemini AI fallback if local matching didn't capture anything
    if (feedbackList.length === 0) {
      setIsParsingAI(true);
      try {
        const aiCmd = await parseVoicePOSWithGemini(
          text,
          activeProducts.slice(0, 60).map(p => ({ id: p.id, name: p.name })),
          activeCustomers.slice(0, 40).map(c => ({ id: c.id, name: c.name }))
        );
        if (aiCmd) {
          if (aiCmd.clearCart) {
            onClearCartByVoice();
            feedbackList.push('🗑️ تفريغ سلة المبيعات (Gemini AI)');
          }
          if (Array.isArray(aiCmd.addItems)) {
            aiCmd.addItems.forEach(item => {
              const matchedProd = activeProducts.find(p => p.id === item.productId);
              if (matchedProd) {
                const q = Math.max(1, Number(item.quantity) || 1);
                onAddToCartByVoice(matchedProd, q);
                feedbackList.push(`🛒 إضافة: "${matchedProd.name}" (الكمية: ${q})`);
              }
            });
          }
          if (aiCmd.customerId) {
            const matchedCust = activeCustomers.find(c => c.id === aiCmd.customerId);
            if (matchedCust) {
              onSetCustomerByVoice(matchedCust);
              feedbackList.push(`👤 اختيار العميل: ${matchedCust.name}`);
            }
          }
          if (typeof aiCmd.discount === 'number' && aiCmd.discount > 0) {
            onSetDiscountByVoice(aiCmd.discount);
            feedbackList.push(`🏷️ تطبيق خصم: ${aiCmd.discount}`);
          }
          if (aiCmd.paymentType === 'cash' || aiCmd.paymentType === 'debt') {
            onSetPaymentTypeByVoice(aiCmd.paymentType);
            feedbackList.push(aiCmd.paymentType === 'debt' ? '📑 الدفع آجل (ذمم)' : '💵 الدفع نقداً (كاش)');
          }
          if (aiCmd.completeSale) {
            onCompleteSaleByVoice();
            feedbackList.push('✅ إتمام حفظ الفاتورة');
          }
        }
      } finally {
        setIsParsingAI(false);
      }
    }

    if (feedbackList.length === 0) {
      feedbackList.push('⚠️ لم يتم التعرف على صنف أو أمر مطابق. جرّب ذكر اسم الصنف أو اختيار أحد الأزرار السريعة.');
    } else {
      soundManager.playSuccessChime();
    }

    setParsedFeedback(feedbackList);
  };

  const handleSimulatedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedInput.trim()) return;
    soundManager.playScanBeep();
    const val = simulatedInput;
    setTranscript(val);
    setSimulatedInput('');
    processVoiceCommand(val);
  };

  // Dynamic presets based on actual store products & customers!
  const presetVoiceCommands = useMemo(() => {
    const presets: Array<{ label: string; text: string }> = [];
    if (activeProducts[0]) {
      presets.push({
        label: `🛒 إضافة ${activeProducts[0].name.slice(0, 22)} (2)`,
        text: `إضافة ${activeProducts[0].name} كمية 2`
      });
    }
    if (activeProducts[1]) {
      presets.push({
        label: `🛒 إضافة ${activeProducts[1].name.slice(0, 22)}`,
        text: `إضافة ${activeProducts[1].name}`
      });
    }
    if (activeCustomers[0]) {
      presets.push({
        label: `👤 العميل: ${activeCustomers[0].name}`,
        text: `اختيار العميل ${activeCustomers[0].name}`
      });
    }
    presets.push(
      { label: '🏷️ خصم 500', text: 'خصم 500' },
      { label: '📑 الدفع آجل (ذمم)', text: 'الدفع آجل' },
      { label: '✅ إتمام حفظ الفاتورة', text: 'إتمام الفاتورة' }
    );
    return presets;
  }, [activeProducts, activeCustomers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-lg w-full p-6 space-y-5 relative overflow-hidden">
        
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>الكاشير الصوتي الذكي (Voice POS)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">Gemini AI</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">تحدث بالصوت أو النص لإضافة الأصناف والعميل والخصم تلقائياً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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
            {isListening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
          </button>

          <div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isListening
                ? '🎙️ يستمع الآن... تحدث بصوت واضح'
                : isParsingAI
                ? '🤖 جاري تحليل الأمر عبر الذكاء الاصطناعي...'
                : 'اضغط على المايكروفون للبدء بالتحدث'}
            </p>
          </div>

          {isParsingAI && (
            <div className="flex items-center justify-center gap-2 text-xs text-blue-600 font-bold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>مطابقة الأصناف والعملاء بالذكاء الاصطناعي...</span>
            </div>
          )}

          {transcript && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium text-right max-h-24 overflow-y-auto">
              <span className="font-bold text-slate-400 block text-[10px] mb-1">الأمر المستلم:</span>
              "{transcript}"
            </div>
          )}

          {parsedFeedback.length > 0 && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold text-right space-y-1">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">⚡ نتيجة التنفيذ الفوري:</span>
              {parsedFeedback.map((fb, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{fb}</span>
                </div>
              ))}
            </div>
          )}

          {voiceError && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs text-right flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{voiceError}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">اختبار سريع أو إدخال بالأوامر النصية:</label>
          
          <form onSubmit={handleSimulatedSubmit} className="flex gap-2">
            <input
              type="text"
              value={simulatedInput}
              onChange={(e) => setSimulatedInput(e.target.value)}
              placeholder='مثال: "أضف شاحن كمية 2 آجل وخصم 500"...'
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isParsingAI}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95"
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
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs cursor-pointer shadow-sm"
          >
            تم وإغلاق المساعد الصوتي
          </button>
        </div>

      </div>
    </div>
  );
}
