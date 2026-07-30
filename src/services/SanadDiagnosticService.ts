/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 🛠️ Sanad Diagnostic & Inventory Service
 * خدمة التشخيص الميكانيكي وفحص القطع في المخزون الفعلي
 */

const getHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'Authorization': token ? `Bearer ${token}` : ''
});

export interface DiagnosticResult {
  success: boolean;
  problem?: string;
  response: string;
  parts_needed?: string[];
  recommended_actions?: string[];
}

export interface InventoryCheckResult {
  success: boolean;
  response: string;
  items?: Array<{
    id: string;
    name: string;
    stock: number;
    price: number;
    sku?: string;
  }>;
}

/**
 * 1. إرسال الأعراض للحصول على تشخيص ميكانيكي ذكي
 */
export const diagnoseVehicleProblem = async (
  apiBaseUrl: string, 
  token: string, 
  symptoms: string
): Promise<DiagnosticResult> => {
  if (!apiBaseUrl) {
    // Local fallback diagnosis engine if server API url is not provided
    return new Promise((resolve) => {
      setTimeout(() => {
        const lower = symptoms.toLowerCase();
        let problem = 'تشخيص عام للنظام والأجهزة';
        let parts: string[] = [];
        let actions: string[] = [];
        let response = '';

        if (lower.includes('فرامل') || lower.includes('صوت') || lower.includes('صرير') || lower.includes('بريك')) {
          problem = 'تآكل في فحمات / أقراص الفرامل (البريكات)';
          parts = ['فحمات فرامل', 'زيت فرامل', 'أقراص فرامل'];
          actions = ['فحص سمك الفحمات الأمامية والخلفية', 'التأكد من عدم وجود تسريب لزيت الفرامل', 'تنظيف الهوب'];
          response = `🔍 **النتيجة المبدئية**: يتبين وجود احتمالية تآكل في فحمات الفرامل أو اتساخ في الأقراص.\n\n📋 **خطوات الفحص المقترحة**:\n1. فحص سمك الفحمات الأمامية وخلفية السيارة.\n2. التأكد من سلامة هوبات الفرامل وخلوها من التعرجات.\n3. قياس مستوى وشكل زيت الفرامل.`;
        } else if (lower.includes('حرارة') || lower.includes('ماء') || lower.includes('رديتر') || lower.includes('سخونة')) {
          problem = 'ارتفاع درجة حرارة المحرك / خلل بدورة التبريد';
          parts = ['رديتر', 'ثرموستات حرارة', 'ماء رديتر أصلي', 'مروحة تبريد'];
          actions = ['فحص مستوى ماء التبريد والبحث عن تسريبات', 'اختبار عمل مروحة التبريد', 'فحص بلف الحرارة (الثرموستات)'];
          response = `🔍 **النتيجة المبدئية**: الخلل يرجح وجود تسريب في ماء التبريد أو انسداد في الرديتر أو عطل بلف الحرارة.\n\n📋 **خطوات الفحص المقترحة**:\n1. فحص طرمبة الماء والمروحة.\n2. التأكد من غطاء الرديتر وسوائل التبريد.\n3. تنظيف الدورة بماء رديتر مخصص.`;
        } else if (lower.includes('بطارية') || lower.includes('تشغيل') || lower.includes('مارش') || lower.includes('سلف')) {
          problem = 'ضعف في البطارية أو نظام الدينامو/السلف';
          parts = ['بطارية 60 أمبير', 'دينامو شحن', 'سلف تشغيل'];
          actions = ['قياس جهد البطارية بالفولتميتر', 'اختبار شحن الدينامو تحت الحمل', 'تنظيف أقطاب البطارية'];
          response = `🔍 **النتيجة المبدئية**: عطل في تيار التشغيل الكهربائي أو انخفاض شحن البطارية والدينامو.\n\n📋 **خطوات الفحص المقترحة**:\n1. قياس الجهد الكهربائي (أقل من 12.4V يدل على ضعف البطارية).\n2. اختبار الشحن أثناء عمل المحرك (يجب أن يكون بين 13.5V إلى 14.5V).`;
        } else if (lower.includes('زيت') || lower.includes('دخان') || lower.includes('تسريب')) {
          problem = 'انخفاض مستوى زيت المحرك أو وجود تسريب';
          parts = ['زيت محرك 10W-40', 'فلتر زيت (سيفون)', 'وجه وجهية'];
          actions = ['قياس مستوى الزيت عبر العيار', 'فحص مكان التسريب أسفل السيارة', 'تغيير فلتر الزيت والزيت'];
          response = `🔍 **النتيجة المبدئية**: ينصح بفحص مستوى لزوجة ونقاء زيت المحرك وتغيير الفلتر.\n\n📋 **خطوات الفحص المقترحة**:\n1. سحب عيار الزيت والتحقق من المستوي واللون.\n2. البحث عن بقع الزيت تحت غطاء المحرك أو الكارتير.`;
        } else {
          parts = ['قطع غيار عامة', 'خدمة فحص كمبيوتر'];
          actions = ['إجراء فحص كمبيوتر شامل للسيارة/الجهاز', 'قراءة كود الأعطال OBD-II'];
          response = `🔍 **النتيجة المبدئية**: يوصى ببدء فحص الكمبيوتر واستخراج رموز الأعطال المباشرة.\n\n📋 **الخطوات**:\n1. توصيل جهاز الفحص واستخراج كود العطل (DTC).\n2. مطابقة العطل مع دليل الصيانة وإتاحة القطع المطلوبة.`;
        }

        resolve({
          success: true,
          problem,
          parts_needed: parts,
          recommended_actions: actions,
          response
        });
      }, 600);
    });
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/ai/diagnose`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ symptoms })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل في الحصول على التشخيص');
    return data;
  } catch (error: any) {
    console.error('Diagnostic API Error:', error);
    throw error;
  }
};

/**
 * 2. البحث عن قطعة غيار في المخزون الحقيقي بالاسم أو الـ SKU
 */
export const checkPartInventory = async (
  apiBaseUrl: string, 
  token: string, 
  partNameOrSku: string
): Promise<InventoryCheckResult> => {
  if (!apiBaseUrl) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          response: `📦 نتيجة البحث في المستودع المحلي لـ "${partNameOrSku}":\nتم مطابقة الاستعلام بالقطع المتاحة في قاعدة البيانات ويمكن إضافة الصنف مباشرة لسلة البيع.`
        });
      }, 400);
    });
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/ai/check-part`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ part_identifier: partNameOrSku })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل البحث في المخزون');
    return data;
  } catch (error: any) {
    console.error('Inventory Check Error:', error);
    throw error;
  }
};

/**
 * 3. تحويل نتائج التشخيص إلى فاتورة مبيعات أو أمر صيانة فوراً
 */
export const createServiceFromDiagnosis = async (
  apiBaseUrl: string, 
  token: string, 
  serviceData: any
) => {
  if (!apiBaseUrl) {
    return { success: true, message: 'تم إنشاء أمر الصيانة المباشر محلياً بنجاح' };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/service/create-from-ai`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(serviceData)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل في إنشاء طلب الصيانة');
    return data;
  } catch (error: any) {
    console.error('Create Service Error:', error);
    throw error;
  }
};
