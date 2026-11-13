import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Send, Bot, User, Volume2, VolumeX, Loader2, X, Sparkles, Trash2
} from 'lucide-react';
import { processVoiceAssistantQuery, StoreAIContext } from '../services/GoogleAIService';
import { showToast } from '../utils/toast';

export interface SanadVoiceAssistantProps {
  apiBaseUrl?: string;
  token?: string;
  isOpen?: boolean;
  onClose?: () => void;
  storeContext?: StoreAIContext;
}

export interface MessageItem {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  confidence?: number;
  sources?: string[];
  isError?: boolean;
}

const QUICK_PROMPTS = [
  'كم رصيد الصندوق ومبيعات اليوم؟',
  'ما هي الأصناف الناقصة في المخزن؟',
  'أعرض لي أكبر الديون على العملاء',
  'ما هي أجهزة الصيانة النشطة بالورشة؟'
];

/**
 * 🎙️ Sanad Voice Assistant Component
 * مكون المساعد الذكي المتصل ببيانات المنشأة الحية
 */
export const SanadVoiceAssistant: React.FC<SanadVoiceAssistantProps> = ({
  onClose,
  storeContext
}) => {
  const initialWelcome = (): MessageItem => ({
    id: 1,
    sender: 'bot',
    text: `أهلاً بك في ${storeContext?.storeName || 'نظام سند المحاسبي'}! أنا مساعدك الذكي المتصل ببيانات المحل الحية. يمكنك سؤالي عن رصيد الصندوق، مبيعات اليوم، نواقص المخزن، ديون العملاء، أو تشخيص أعطال الهواتف.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  const [messages, setMessages] = useState<MessageItem[]>([initialWelcome()]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const stopSpeech = () => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    setSpeakingMsgId(null);
  };

  useEffect(() => {
    return () => {
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore
      }
    };
  }, []);

  const speakText = (text: string, msgId?: number) => {
    try {
      if (msgId !== undefined && speakingMsgId === msgId) {
        stopSpeech();
        return;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`_~]/g, ''));
        utterance.lang = 'ar-SA';
        utterance.rate = 1.0;
        utterance.onend = () => setSpeakingMsgId(null);
        utterance.onerror = () => setSpeakingMsgId(null);
        if (msgId !== undefined) setSpeakingMsgId(msgId);
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn('Text-to-speech error:', e);
      setSpeakingMsgId(null);
    }
  };

  const handleVoiceInput = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast('الإدخال الصوتي غير مدعوم في هذا المتصفح، يمكنك استخدام الكتابة أو الأزرار السريعة.', 'info');
      return;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.warn('Microphone permission request failed:', err);
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-YE';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
        sendMessage(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        const errorText = event.error === 'not-allowed'
          ? '⚠️ تعذر استخدام المايكروفون بسبب رفض الإذن. يمكنك تفعيل الإذن أو كتابة سؤالك نصياً.'
          : `⚠️ تعذر التقاط الصوت (${event.error}). يمكنك الكتابة النصية بالأسفل.`;

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            sender: 'bot',
            text: errorText,
            isError: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      };

      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const query = textToSend !== undefined ? textToSend : inputText;
    if (!query.trim() || loading) return;

    const userMsg: MessageItem = {
      id: Date.now(),
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const historySnapshot = messages
      .filter(m => !m.isError)
      .slice(-6)
      .map(m => ({ sender: m.sender, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const botResponseText = await processVoiceAssistantQuery(query.trim(), storeContext, historySnapshot);

      const botMsg: MessageItem = {
        id: Date.now() + 1,
        sender: 'bot',
        text: botResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
      if (autoSpeak) {
        speakText(botResponseText, botMsg.id);
      }
    } catch (error: any) {
      const errorMsg: MessageItem = {
        id: Date.now() + 1,
        sender: 'bot',
        text: `⚠️ عذراً: ${error?.message || 'حدث خطأ أثناء المعالجة'}. يرجى المحاولة مجدداً.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[500px] max-h-[85vh] bg-slate-50 dark:bg-slate-900 text-right font-sans rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700" style={{ direction: 'rtl' }}>
      {/* 🔹 Header */}
      <div className="bg-slate-900 text-white p-4 shadow-md flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-slate-950 p-2 rounded-xl shadow font-bold">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-base flex items-center gap-1.5">
              <span>مساعد سند الذكي</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h1>
            <p className="text-[11px] text-slate-400">
              {storeContext
                ? `متصل ببيانات (${storeContext.storeName || 'المحل'}) • ${storeContext.productsCount ?? 0} صنف • ${storeContext.customersCount ?? 0} عميل`
                : 'متصل ومتأهب لتنفيذ الأوامر الصوتية والنصية'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !autoSpeak;
              setAutoSpeak(next);
              if (!next) stopSpeech();
              showToast(next ? 'تم تفعيل النطق الصوتي التلقائي للردود' : 'تم إيقاف النطق الصوتي التلقائي للردود', 'info');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              autoSpeak
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
            title={autoSpeak ? 'إيقاف النطق التلقائي' : 'تفعيل النطق التلقائي'}
          >
            {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{autoSpeak ? 'نطق تلقائي' : 'صامت'}</span>
          </button>
          <button
            onClick={() => {
              stopSpeech();
              setMessages([initialWelcome()]);
              showToast('تم بدء محادثة جديدة مع المساعد الذكي', 'info');
            }}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            title="مسح المحادثة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <span className="bg-emerald-500 w-2.5 h-2.5 rounded-full animate-pulse" />
          {onClose && (
            <button
              onClick={() => {
                stopSpeech();
                onClose();
              }}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 🔹 Quick Prompts Bar */}
      <div className="px-3 py-2 bg-white dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1.5 overflow-x-auto">
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            disabled={loading}
            onClick={() => sendMessage(prompt)}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* 🔹 Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-950/60">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-start' : 'items-end'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : msg.isError
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 rounded-bl-none'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 text-xs opacity-75 gap-3">
                <span className="flex items-center gap-1 font-bold">
                  {msg.sender === 'user' ? (
                    <>
                      <User className="w-3.5 h-3.5" /> أنت
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 text-emerald-500" /> سند الذكي
                    </>
                  )}
                </span>
                <span className="font-mono text-[10px]">{msg.timestamp}</span>
              </div>

              <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>

              {msg.sender === 'bot' && !msg.isError && (
                <button
                  onClick={() => speakText(msg.text, msg.id)}
                  className="mt-2 text-[11px] font-bold flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline transition cursor-pointer"
                >
                  {speakingMsgId === msg.id ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-rose-500" /> إيقاف القراءة
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" /> استمع للرد
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-xs p-2">
            <Loader2 className="animate-spin text-blue-600 w-4 h-4" />
            <span>سند يحلل بيانات المحل ويجهز الإجابة...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 🔹 Input Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <button
          onClick={handleVoiceInput}
          className={`p-3 rounded-full transition-all shadow cursor-pointer ${
            isListening
              ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title="تحدث صوتاً"
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="اسأل عن الصندوق، المبيعات، النواقص، أو الديون..."
          className="flex-1 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-blue-500 rounded-full px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none"
        />

        <button
          onClick={() => sendMessage()}
          disabled={!inputText.trim() || loading}
          className="p-3 bg-blue-600 text-white rounded-full disabled:opacity-50 hover:bg-blue-700 transition-colors shadow cursor-pointer"
          title="إرسال"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SanadVoiceAssistant;
