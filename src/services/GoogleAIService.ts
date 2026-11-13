/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 🤖 Google Gemini AI Client Proxy Service for Sanad ERP
 * يتواصل بشكل آمن مع خادم النظام (/api/ai/*) لتشخيص الأعطال، المساعد الذكي مع بيانات المنشأة الحية، وقراءة الفواتير بالصور
 */

export interface PhoneDiagnosticResult {
  success: boolean;
  problem: string;
  category: 'hardware' | 'software' | 'both';
  parts_needed: string[];
  tools_recommended: string[];
  steps: string[];
  response: string;
  source?: 'gemini-cloud' | 'local-engine';
}

export interface ParsedInvoiceItem {
  name: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  category: string;
  barcode?: string;
  total?: number;
}

export interface ParsedInvoiceResult {
  success: boolean;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: number;
  items: ParsedInvoiceItem[];
  rawText?: string;
  notes?: string;
  confidence?: 'high' | 'medium' | 'simulated';
}

export interface StoreAIContext {
  storeName?: string;
  currency?: string;
  cashboxBalance?: number;
  totalSales?: number;
  todaySales?: number;
  totalDebts?: number;
  lowStockProducts?: Array<{ name: string; stock: number; minStock: number }>;
  topDebtors?: Array<{ name: string; totalDebt: number; phone?: string }>;
  activeMaintenanceOrders?: Array<{ orderNumber: string; deviceName: string; customerName: string; status: string }>;
  productsCount?: number;
  customersCount?: number;
}

/**
 * 1. تشخيص أعطال الهواتف الذكية (هاردوير وسوفتوير وتفليش)
 */
export async function diagnosePhoneIssue(symptoms: string): Promise<PhoneDiagnosticResult> {
  try {
    const res = await fetch('/api/ai/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.response) {
        return {
          success: true,
          problem: data.problem || 'تشخيص فني ذكي',
          category: data.category || 'hardware',
          parts_needed: Array.isArray(data.parts_needed) ? data.parts_needed : [],
          tools_recommended: Array.isArray(data.tools_recommended) ? data.tools_recommended : [],
          steps: Array.isArray(data.steps) ? data.steps : [],
          response: data.response,
          source: 'gemini-cloud',
        };
      }
    }
  } catch (err) {
    console.warn('Server AI diagnose unavailable, using local diagnostic engine:', err);
  }

  // Local Offline Fallback Phone Diagnostic Engine
  const lower = symptoms.toLowerCase();
  if (lower.includes('شحن') || lower.includes('تسريب') || lower.includes('سحب') || lower.includes('باور')) {
    return {
      success: true,
      problem: 'عطل في دائرة الشحن والباور (آيسي الشحن / تسريب بالباور سبلاي)',
      category: 'hardware',
      parts_needed: ['آيسي شحن', 'فلاتة شحن', 'بطارية'],
      tools_recommended: ['Power Supply', 'USB Tester', 'Multimeter', 'Hot Air Station'],
      steps: [
        'توصيل الهاتف بالباور سبلاي وقياس السحب قبل وبعد الضغط على زر التشغيل.',
        'فحص جهد VBUS على كونكتر الشحن (يجب أن يكون 5V مستقرة).',
        'قياس المكثفات حول آيسي الشحن للتحقق من عدم وجود شورت صريح.'
      ],
      response: `النتيجة الفنية: يرجح وجود تسريب تيار أو عطل في آيسي الشحن/مسار VBUS.\n\nالأدوات الموصى بها: Power Supply + Multimeter + USB Tester.\n\nخطوات الفحص:\n1. قياس السحب على الباور سبلاي (إذا تجاوز 0.05A بدون تشغيل يوجد تسريب).\n2. فحص الممانعات على مسارات الشحن وكونكتر البطارية.\n3. تنظيف أو استبدال فلاتة الشحن ثم فحص آيسي الشحن.`,
      source: 'local-engine',
    };
  }

  if (lower.includes('frp') || lower.includes('حساب') || lower.includes('رمز') || lower.includes('نمط') || lower.includes('تفليش') || lower.includes('معلق') || lower.includes('سوفت')) {
    return {
      success: true,
      problem: 'عطل نظام / تخطي حماية FRP أو إعادة تفليش الروم الرسمي',
      category: 'software',
      parts_needed: ['كابل بيانات أصلي'],
      tools_recommended: ['UnlockTool', 'Pandora Box', 'Chimera Tool', 'Z3X Box'],
      steps: [
        'تحديد نوع المعالج (MediaTek / Qualcomm / Exynos / Unisoc).',
        'إدخال الهاتف وضع EDL أو BROM/Preloader عبر TestPoint.',
        'تخطي الحماية أو تفليش الفلاشة الرسمية المطابقة للإصدار.'
      ],
      response: `النتيجة الفنية: عطل برمجي (سوفتوير / تخطي حماية FRP أو تعليق على الشعار).\n\nالأدوات الموصى بها: UnlockTool / Pandora Box / Chimera Tool.\n\nخطوات الإصلاح:\n1. التأكد من تعريفات المعالج على الكمبيوتر.\n2. أخذ نسخة احتياطية لملفات الشبكة (NVRAM/EFS) قبل التفليش.\n3. تنفيذ فك الحماية أو تمرير الفلاشة الرسمية.`,
      source: 'local-engine',
    };
  }

  if (lower.includes('شاشة') || lower.includes('سوداء') || lower.includes('لمس') || lower.includes('كسر') || lower.includes('إضاءة')) {
    return {
      success: true,
      problem: 'عطل مجمع الشاشة واللمس أو دائرة الإضاءة (Backlight)',
      category: 'hardware',
      parts_needed: ['شاشة', 'فلاتة شاشة', 'ديود إضاءة'],
      tools_recommended: ['سخان شاشات (Separator)', 'Multimeter', 'لاصق B7000 / T7000'],
      steps: [
        'فصل البطارية وتجربة شاشة موثوقة للتأكد من سلامة البوردة.',
        'قياس ممانعات خطوط MIPI والإضاءة على كونكتر الشاشة.',
        'تنظيف الكونكتر وتثبيت الشاشة الجديدة باحترافية.'
      ],
      response: `النتيجة الفنية: تلف في الشاشة أو انقطاع في مسار الإضاءة/البيانات.\n\nالأدوات الموصى بها: جهاز تسخين الشاشات + Multimeter.\n\nخطوات الصيانة:\n1. تجربة شاشة جديدة قبل إزالة اللاصق.\n2. فحص ممانعات كونكتر الشاشة على البوردة.\n3. التثبيت النظيف واختبار اللمس والسطوع.`,
      source: 'local-engine',
    };
  }

  return {
    success: true,
    problem: 'فحص شامل لمكونات الهاتف الذكي',
    category: 'both',
    parts_needed: ['بطارية', 'فلاتة شحن', 'شاشة'],
    tools_recommended: ['Multimeter', 'Power Supply', 'UnlockTool'],
    steps: [
      'قياس السحب الكهربائي على الباور سبلاي.',
      'فحص البوردة تحت الميكروسكوب للتأكد من عدم وجود أكسدة أو تلف مكونات.',
      'قراءة حالة النظام والذاكرة عبر الكمبيوتر.'
    ],
    response: `النتيجة الفنية: يوصى ببدء الفحص الكهربائي على الباور سبلاي وقياس الممانعات الأساسية (VBAT / VPH_PWR) مع فحص تعرف الجهاز على الكمبيوتر.`,
    source: 'local-engine',
  };
}

/**
 * 2. المساعد الصوتي والنصي الذكي الخاص بمركز سند (متصل ببيانات المتجر الحية)
 */
export async function processVoiceAssistantQuery(
  query: string,
  storeContext?: StoreAIContext,
  history?: Array<{ sender: 'user' | 'bot'; text: string }>
): Promise<string> {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, storeContext, history }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data.response) {
        return data.response;
      }
    }
  } catch (err) {
    console.warn('Server AI chat unavailable, engaging smart local context fallback:', err);
  }

  // Smart Live-Context Offline Fallback
  const qLower = query.toLowerCase();
  const curr = storeContext?.currency || 'ر.ي';

  if (qLower.includes('صندوق') || qLower.includes('رصيد') || qLower.includes('كاش') || qLower.includes('مبيعات')) {
    const cash = (storeContext?.cashboxBalance ?? 0).toLocaleString();
    const sales = (storeContext?.totalSales ?? 0).toLocaleString();
    const today = (storeContext?.todaySales ?? 0).toLocaleString();
    return `ملخص الموقف المالي المباشر:\n• الرصيد المتوفر في الصندوق: ${cash} ${curr}\n• مبيعات اليوم: ${today} ${curr}\n• إجمالي المبيعات المعتمدة: ${sales} ${curr}`;
  }

  if (qLower.includes('دين') || qLower.includes('ديون') || qLower.includes('مديونية') || qLower.includes('عملاء')) {
    const debts = (storeContext?.totalDebts ?? 0).toLocaleString();
    const top = storeContext?.topDebtors?.slice(0, 3) || [];
    const topText = top.length > 0
      ? '\nأبرز العملاء مديونية:\n' + top.map((d, i) => `${i + 1}. ${d.name}: ${d.totalDebt.toLocaleString()} ${curr}`).join('\n')
      : '\nلا توجد ديون مسجلة حالياً.';
    return `إجمالي ديون العملاء المتبقية: ${debts} ${curr}.${topText}`;
  }

  if (qLower.includes('ناقص') || qLower.includes('نقص') || qLower.includes('مخزون') || qLower.includes('جرد')) {
    const low = storeContext?.lowStockProducts || [];
    if (low.length === 0) {
      return `المخزون بحالة ممتازة! إجمالي الأصناف المسجلة (${storeContext?.productsCount ?? 0}) ولا توجد نواقص حرجة حالياً.`;
    }
    return `توجد (${low.length}) أصناف وصلت للحد الأدنى في المخزن:\n` +
      low.slice(0, 5).map(p => `• ${p.name} (المتوفر: ${p.stock})`).join('\n');
  }

  if (qLower.includes('صيانة') || qLower.includes('أجهزة') || qLower.includes('ورشة')) {
    const active = storeContext?.activeMaintenanceOrders || [];
    if (active.length === 0) {
      return 'لا توجد أجهزة قيد الانتظار أو الصيانة في الورشة حالياً.';
    }
    return `الأجهزة قيد العمل في الورشة (${active.length}):\n` +
      active.slice(0, 4).map(o => `• كرت #${o.orderNumber}: ${o.deviceName} (${o.customerName})`).join('\n');
  }

  if (qLower.includes('تفليش') || qLower.includes('frp') || qLower.includes('بوكس')) {
    return 'لأعطال السوفتوير وتخطي حسابات FRP يوصى باستخدام أدوات UnlockTool أو Pandora Box أو Chimera، ويمكنك فتح قسم "التشخيص الذكي" لإجراء فحص تفصيلي.';
  }

  return `أهلاً بك! استلمت استفسارك: "${query}". يمكنك سؤالي مباشرة عن (رصيد الصندوق، مبيعات اليوم، ديون العملاء، نواقص المخزن، أو أجهزة الصيانة) وسأزودك بالإجابة الفورية من بيانات المنشأة.`;
}

/**
 * 3. قراءة فاتورة المشتريات بالذكاء الاصطناعي من صورة (OCR & Table Extractor)
 */
export async function parseInvoiceImageWithGemini(
  base64Data: string,
  mimeType: string = 'image/jpeg',
  existingCategories: string[] = ['أجهزة', 'إكسسوارات', 'قطع صيانة', 'برمجيات', 'أخرى']
): Promise<ParsedInvoiceResult> {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  try {
    const res = await fetch('/api/ai/parse-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Data: cleanBase64,
        mimeType,
        existingCategories,
      }),
    });

    if (res.ok) {
      const parsed = await res.json();
      const items: ParsedInvoiceItem[] = (parsed.items || [])
        .map((item: any) => {
          const cost = Number(item.costPrice) || 0;
          const qty = Number(item.quantity) || 1;
          const sell = Number(item.sellingPrice) || Math.round(cost * 1.3);
          return {
            name: String(item.name || '').trim(),
            quantity: qty,
            costPrice: cost,
            sellingPrice: sell,
            category: item.category || existingCategories[0] || 'إكسسوارات',
            barcode: item.barcode ? String(item.barcode).trim() : '',
            total: Number(item.total) || cost * qty,
          };
        })
        .filter((it: ParsedInvoiceItem) => it.name.length > 0);

      if (items.length > 0) {
        return {
          success: true,
          supplierName: parsed.supplierName || '',
          invoiceNumber: parsed.invoiceNumber || '',
          invoiceDate: parsed.invoiceDate || new Date().toISOString().split('T')[0],
          totalAmount:
            Number(parsed.totalAmount) ||
            items.reduce((sum, it) => sum + it.costPrice * it.quantity, 0),
          items,
          notes: parsed.notes || 'تم تحليل الفاتورة بنجاح عبر ذكاء Gemini Vision.',
          confidence: 'high',
        };
      }
    }
  } catch (err) {
    console.warn('Server Invoice Vision API fallback:', err);
  }

  return {
    success: false,
    supplierName: '',
    invoiceNumber: `INV-${Math.floor(10000 + Math.random() * 90000)}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    totalAmount: 0,
    items: [
      {
        name: '',
        quantity: 1,
        costPrice: 0,
        sellingPrice: 0,
        category: existingCategories[0] || 'إكسسوارات',
        barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
        total: 0,
      },
    ],
    notes: 'تعذر قراءة الصورة سحابياً أو لا يوجد اتصال؛ تم تجهيز صف فارغ لتعبئة أصناف الفاتورة يدوياً بسهولة.',
    confidence: 'simulated',
  };
}

/**
 * 4. تحليل أوامر الكاشير الصوتية الذكية عبر Gemini
 */
export async function parseVoicePOSWithGemini(
  transcript: string,
  products: Array<{ id: string; name: string }>,
  customers: Array<{ id: string; name: string }>
): Promise<{
  addItems?: Array<{ productId: string; quantity: number }>;
  customerId?: string;
  discount?: number;
  paymentType?: 'cash' | 'debt' | '';
  completeSale?: boolean;
  clearCart?: boolean;
} | null> {
  try {
    const res = await fetch('/api/ai/voice-pos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, products, customers }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.success ? data.command : null;
  } catch {
    return null;
  }
}
