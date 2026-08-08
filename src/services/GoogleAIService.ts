/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

/**
 * 🤖 Google Gemini AI Service for Sanad Mobile Maintenance
 * خدمة الذكاء الاصطناعي من جوجل لتشخيص أعطال الهواتف والمساعد الصوتي مع دعم الاستجابة أوفلاين
 */

// Initialize Gemini Client safely across Vite/Capacitor Native environments
const getGeminiClient = () => {
  try {
    // دعم آمن لمفاتيح البيئة بداخل Vite و Capacitor
    const apiKey = 
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) ||
      (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || 
      '';

    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn('GoogleGenAI initialization warning:', err);
    return null;
  }
};

export interface PhoneDiagnosticResult {
  success: boolean;
  problem: string;
  category: 'hardware' | 'software' | 'both';
  parts_needed: string[];
  tools_recommended: string[];
  steps: string[];
  response: string;
}

/**
 * 1. تشخيص أعطال الهواتف الذكية (هاردوير وسوفتوير وتفليش)
 */
export async function diagnosePhoneIssue(symptoms: string): Promise<PhoneDiagnosticResult> {
  const ai = getGeminiClient();

  if (ai) {
    try {
      const prompt = `
أنت مهندس خبير ومحترف في صيانة وتفليش الهواتف الذكية (iPhone, Samsung, Xiaomi, Honor, Realme, Infinix, Tecno).
قام الفني بتقديم الأعراض التالية للجهاز:
"${symptoms}"

قم بإرجاع رد باللغة العربية بأسلوب فني منظم ودقيق يتضمن:
1. المشكلة الرئيسية بالتفصيل.
2. الأدوات الاحترافية الموصى بها.
3. القطع المطلوب استبدالها (إن وجدت).
4. خطوات الصيانة والإصلاح الفنية بالترتيب.
      `.trim();

      // إضافة مهلة أمان (Timeout) 4 ثواني، إن لم يستجب السيرفر يتم الانتقال فوراً للوضع الأوفلاين
      const apiPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network Timeout')), 4000)
      );

      const response: any = await Promise.race([apiPromise, timeoutPromise]);
      const text = response?.text || '';

      if (text) {
        return {
          success: true,
          problem: 'تشخيص فني بواسطة ذكاء جوجل (Gemini)',
          category: symptoms.includes('تفليش') || symptoms.includes('رمز') || symptoms.includes('FRP') ? 'software' : 'hardware',
          parts_needed: ['قطع غيار مخصصة للموديل'],
          tools_recommended: ['Pandora', 'UnlockTool', 'Power Supply', 'Multimeter'],
          steps: ['فحص خطوط VBUS و VBAT', 'قياس المكونات الكبيرة', 'تنفيذ خطوات التفليش أو الاستبدال'],
          response: text
        };
      }
    } catch (err) {
      console.warn('Gemini API diagnosis fallback engaged:', err);
    }
  }

  // 🔴 Local Offline Fallback Phone Diagnostic Engine
  return new Promise((resolve) => {
    setTimeout(() => {
      const lower = symptoms.toLowerCase();
      let problem = 'تشخيص عام للهاتف الذكي';
      let category: 'hardware' | 'software' | 'both' = 'hardware';
      let parts: string[] = [];
      let tools: string[] = [];
      let steps: string[] = [];
      let response = '';

      if (lower.includes('شحن') || lower.includes('تسريب') || lower.includes('سحب') || lower.includes('باور')) {
        problem = 'عطل في دائرة الشحن والباور (آيسي الشحن / تسريب بالباور سبلاي)';
        category = 'hardware';
        parts = ['آيسي الشحن (Hydra/OVP)', 'فلاتة الشحن السفلية', 'بطارية أصلية'];
        tools = ['Power Supply', 'USB Tester', 'Multimeter', 'Hot Air Station (كاوية هيتر)'];
        steps = [
          'توصيل الهاتف بالباور سبلاي وقياس السحب قبل وبعد الضغط على زر الباور.',
          'فحص جهد VBUS على كونكتر الشحن (يجب أن يكون 5V).',
          'قياس المكثفات حول آيسي الشحن للتحقق من عدم وجود شورت صريح.'
        ];
        response = `🔍 **النتيجة الفنية**: يرجح وجود تسريب تيار أو شورت بدائرة الباور/الشحن.\n\n🛠️ **الأدوات المطلوب استخدامها**:\n• Power Supply + Multimeter + USB Tester.\n\n📋 **خطوات الفحص المقترحة**:\n1. قياس السحب بالباور سبلاي عند التوصيل (إذا تجاوز 0.05A بدون ضغط زر التشغيل يوجد تسريب).\n2. فحص المكثفات حول آيسي الباور والشحن.\n3. استبدال آيسي الشحن أو فلاتة الشحن السفلى.`;
      } else if (lower.includes('frp') || lower.includes('حساب') || lower.includes('رمز') || lower.includes('نمط') || lower.includes('تفليش') || lower.includes('معلق')) {
        problem = 'عطل في النظام / تخطي حماية FRP وإعادة تفليش الروم الرسمي';
        category = 'software';
        parts = ['لا يحتاج قطع غيار'];
        tools = ['UnlockTool', 'Pandora Box', 'Chimera Tool', 'Z3X Box', 'كابل EDL / Testpoint'];
        steps = [
          'تحديد المعالج (MediaTek / Qualcomm / Exynos).',
          'إدخال الهاتف وضع TestPoint أو BROM/EDL mode.',
          'استخدام أداة UnlockTool أو Pandora لتخطي FRP وتفليش السوفتوير الرسمي.'
        ];
        response = `🔍 **النتيجة الفنية**: تشخيص عطل سوفتوير وتخطي حماية FRP أو تعليق على الشعار.\n\n🛠️ **الأدوات والمقادير الموصى بها**:\n• UnlockTool / Pandora Box / Chimera Tool.\n\n📋 **خطوات الإصلاح**:\n1. إطفاء الهاتف وإدخاله وضع TestPoint لرفع الحماية.\n2. إزالة حساب Google / Knox / Mi Account بنقرة واحدة عبر البوكس المخصص.\n3. تفليش الفلاشة الرسمية المسحوبة أصلية.`;
      } else if (lower.includes('شاشة') || lower.includes('سوداء') || lower.includes('لمس') || lower.includes('كسر')) {
        problem = 'عطل في مجمع الشاشة واللمس أو مسارات الإضاءة (Backlight)';
        category = 'hardware';
        parts = ['شاشة أصلية (OLED / Original Display)', 'فلاتة لمس', 'ديود الإضاءة'];
        tools = ['جهاز تسخين الشاشات (Separator)', 'لاصق B7000 / T7000', 'كاوية لحام'];
        steps = [
          'فحص كونكتر الشاشة على البوردة وتجربة شاشة جديدة.',
          'قياس مسارات الإضاءة والبيانات MIPI على الكونكتر.',
          'تنظيف الكونكتر بـ IPA وإعادة التركيب.'
        ];
        response = `🔍 **النتيجة الفنية**: عطل شاشة مكسورة أو توقف مسار الإضاءة LED.\n\n🛠️ **الأدوات الموصى بها**:\n• جهاز تسخين الشاشات + شاشة جديدة للاختبار.\n\n📋 **خطوات الصيانة**:\n1. فصل البطارية وتجربة شاشة موثوقة.\n2. قياس الممانعات على كونكتر الشاشة.\n3. تثبيت الشاشة الجديدة بفرن الحرارة واللاصق المخصص.`;
      } else {
        problem = 'فحص وشامل لمكونات الهاتف الذكي';
        category = 'both';
        parts = ['قطع غيار حسب الفحص المعملي'];
        tools = ['Multimeter', 'Power Supply', 'UnlockTool'];
        steps = [
          'إجراء قياس الممانعة على المكونات الكبيرة.',
          'فحص السوفتوير وقراءة السيريال والروم.'
        ];
        response = `🔍 **النتيجة الفنية**: يوصى ببدء فحص الممانعات بالملتيميتر وقراءة كود الجهاز عبر الكمبيوتر.\n\n📋 **الخطوات**:\n1. توصيل الكابل بالكمبيوتر وفحص كشف المعالج بالتعريفات (Com Port).\n2. قياس خطوط VPH_PWR و VBAT.`;
      }

      resolve({
        success: true,
        problem,
        category,
        parts_needed: parts,
        tools_recommended: tools,
        steps,
        response
      });
    }, 200);
  });
}

/**
 * 2. المساعد الصوتي والنصي الذكي الخاص بمركز سند
 */
export async function processVoiceAssistantQuery(query: string): Promise<string> {
  const ai = getGeminiClient();

  if (ai) {
    try {
      const apiPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `
أنت المساعد الصوتي والذكي لتطبيق "سند" لإدارة ورش صيانة وتفليش الهواتف والمحاسبة.
أجب عن سؤال الفني/المستخدم التالي بأسلوب عربي مختصر، لطيف، ودقيق جداً (لا يتجاوز 3-4 أسطر):
"${query}"
        `.trim()
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network Timeout')), 3000)
      );

      const response: any = await Promise.race([apiPromise, timeoutPromise]);

      if (response?.text) {
        return response.text;
      }
    } catch (err) {
      console.warn('Gemini Voice Assistant fallback:', err);
    }
  }

  // Local Smart Response Fallback
  const qLower = query.toLowerCase();
  if (qLower.includes('مبيعات') || qLower.includes('صندوق') || qLower.includes('تقرير')) {
    return '📊 يمكن إظهار تقرير الصندوق والمبيعات والأرباح مباشرة من قسم الحسابات والتقارير المالية.';
  } else if (qLower.includes('استلام') || qLower.includes('جهاز') || qLower.includes('صيانة')) {
    return '📱 يمكنك فتح شاشة "استلام جهاز" لتعبئة بيانات الزبون وطباعة السند الحراري أو إرساله بالواتساب فوراً.';
  } else if (qLower.includes('تفليش') || qLower.includes('frp') || qLower.includes('بوكس')) {
    return '💻 قسم التشخيص يوصي باستخدام UnlockTool أو Pandora أو Chimera لعلاجات السوفتوير وتخطي الحسابات.';
  }

  return `تم استلام طلبك: "${query}". المساعد سند جاهز للربط مع جميع الخوادم وقواعد البيانات لتأدية المهام بنجاح.`;
}
