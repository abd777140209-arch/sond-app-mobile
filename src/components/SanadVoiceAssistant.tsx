import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Send, Bot, User, Volume2, Loader2, CheckCircle2, AlertTriangle, X, Sparkles
} from 'lucide-react';
import { processVoiceAssistantQuery } from '../services/GoogleAIService';

export interface SanadVoiceAssistantProps {
  apiBaseUrl?: string;
  token?: string;
  isOpen?: boolean;
  onClose?: () => void;
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

/**
 * 🎙️ Sanad Voice Assistant Component
 * مكون المساعد الصوتي الذكي لتطبيق سند المحاسبي
 */
export const SanadVoiceAssistant: React.FC<SanadVoiceAssistantProps> = ({ 
  apiBaseUrl = '', 
  token = '',
  isOpen = true,
  onClose
}) => {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 1,
      sender: 'bot',
      text: 'أهلاً بك في تطبيق سند المحاسبي! 🌸 أنا مساعدك الذكي، كيف يمكنني خدمتك اليوم؟ (يمكنك التحدث معي بالصوت أو الكتابة)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // التمرير التلقائي لآخر رسالة
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // 🎤 إعداد الاستماع الصوتي (Web Speech API / Capacitor Speech Recognition)
  const handleVoiceInput = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('الاستماع الصوتي غير مدعوم مباشرة في هذا المتصفح. يمكنك كتابة الأوامر نصياً.');
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
      recognition.lang = 'ar-YE'; // دعم اللهجة العربية/اليمنية
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
        // إرسال الرسالة الملتقطة تلقائياً
        sendMessage(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'aborted' || event.error === 'no-speech') {
          // Normal expected cancellation or silent timeout, ignore gracefully
          return;
        }
        console.warn('Voice recognition error:', event.error);
        const errorText = event.error === 'not-allowed'
          ? '⚠️ تعذر استخدام المايكروفون بسبب رفض الإذن أو قيود الأمان في المتصفح. يمكنك السماح بالمايكروفون من إعدادات المتصفح أو استخدام الكتابة النصية.'
          : `⚠️ تعذر استلام الصوت (${event.error}). يمكنك إعادة المحاولة أو الكتابة النصية.`;

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

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
    }
  };

  // 🔊 نطق الإجابة صوتاً (Text-to-Speech)
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      // إزالة التنسيقات والرموز للحديث السلس
      const cleanText = text.replace(/[*_#`~]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ar-SA';
      window.speechSynthesis.speak(utterance);
    }
  };

  // 🚀 إرسال الطلب إلى السيرفر
  const sendMessage = async (textToSend?: string) => {
    const query = textToSend !== undefined ? textToSend : inputText;
    if (!query.trim()) return;

    // 1. إضافة رسالة المستخدم للشاشة
    const userMsg: MessageItem = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      let botResponseText = '';

      if (apiBaseUrl) {
        try {
          // 2. طلب API السيرفر (AI Chat Endpoint)
          const response = await fetch(`${apiBaseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              query: query,
              session_id: 'sanad_mobile_session'
            })
          });

          const data = await response.json();

          if (response.ok && data.response) {
            botResponseText = data.response;
          } else {
            botResponseText = await processVoiceAssistantQuery(query);
          }
        } catch (err) {
          botResponseText = await processVoiceAssistantQuery(query);
        }
      } else {
        botResponseText = await processVoiceAssistantQuery(query);
      }

      const botMsg: MessageItem = {
        id: Date.now() + 1,
        sender: 'bot',
        text: botResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
      // نطق رد المساعد تلقائياً
      speakText(botResponseText);
    } catch (error: any) {
      const errorMsg: MessageItem = {
        id: Date.now() + 1,
        sender: 'bot',
        text: `⚠️ عذراً: ${error.message || 'خطأ في الاتصال'}. يرجى التأكد من الاتصال بالشبكة.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[500px] max-h-[85vh] bg-slate-50 text-right font-sans rounded-2xl overflow-hidden shadow-xl border border-slate-200" style={{ direction: 'rtl' }}>
      {/* 🔹 الشريط العلوي (Header) */}
      <div className="bg-slate-900 text-white p-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 text-slate-950 p-2 rounded-xl shadow font-bold">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-base flex items-center gap-1.5">
              <span>مساعد سند الذكي</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h1>
            <p className="text-xs text-slate-400">متصل ومتأهب لتنفيذ الأوامر الصوتية والنصية</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-emerald-500 w-2.5 h-2.5 rounded-full animate-ping"></span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 🔹 منطقة الرسائل (Chat Messages Area) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100">
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
                  ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-bl-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
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
                      <Bot className="w-3.5 h-3.5 text-emerald-600" /> سند الذكي
                    </>
                  )}
                </span>
                <span className="font-mono text-[10px]">{msg.timestamp}</span>
              </div>

              {/* نص الرسالة */}
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>

              {/* زر إعادة نطق الصوت للمساعد */}
              {msg.sender === 'bot' && !msg.isError && (
                <button
                  onClick={() => speakText(msg.text)}
                  className="mt-2 text-[11px] font-bold flex items-center gap-1 text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" /> استمع للرد
                </button>
              )}
            </div>
          </div>
        ))}

        {/* مؤشر التحميل أثناء التفكير */}
        {loading && (
          <div className="flex items-center gap-2 text-slate-600 text-xs p-2">
            <Loader2 className="animate-spin text-blue-600 w-4 h-4" />
            <span>سند يفكر ويستعلم لك...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 🔹 شريط إدخال النص والصوت (Input Bar) */}
      <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
        <button
          onClick={handleVoiceInput}
          className={`p-3 rounded-full transition-all shadow cursor-pointer ${
            isListening
              ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-100'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title="تحدث صوتاً"
        >
          <Mic className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="اكتب أمرك هنا أو اضغط الميكروفون (مثال: أضف عميل جديد، كم مبيعات اليوم...)"
          className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
