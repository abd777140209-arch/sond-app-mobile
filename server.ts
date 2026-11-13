/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Server-side Gemini AI Client
function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Temporary in-memory file store for native Android/iOS HTTP attachment downloads
  const downloadStore = new Map<
    string,
    { buffer: Buffer; fileName: string; mimeType: string; expiresAt: number }
  >();

  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of downloadStore.entries()) {
      if (val.expiresAt < now) {
        downloadStore.delete(key);
      }
    }
  }, 60_000);

  // Register a generated file (PDF, PNG, JSON, CSV) for native OS DownloadManager retrieval
  app.post('/api/download-bridge', (req, res) => {
    try {
      const { fileName, data, isBase64, mimeType } = req.body || {};
      if (!fileName || typeof data !== 'string') {
        return res.status(400).json({ ok: false, error: 'Missing fileName or data' });
      }

      const cleanName = String(fileName).replace(/[/\\?%*:|"<>]/g, '_').trim() || 'sanad_file';
      let buffer: Buffer;
      if (isBase64) {
        const stripped = data.replace(/^data:.*?;base64,/, '').replace(/\s/g, '');
        buffer = Buffer.from(stripped, 'base64');
      } else {
        buffer = Buffer.from(data, 'utf-8');
      }

      const token = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      downloadStore.set(token, {
        buffer,
        fileName: cleanName,
        mimeType: mimeType || 'application/octet-stream',
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes TTL
      });

      const downloadUrl = `/api/download-file/${token}/${encodeURIComponent(cleanName)}`;
      return res.json({
        ok: true,
        token,
        downloadUrl,
        size: buffer.length,
      });
    } catch (err: any) {
      console.error('[API /api/download-bridge] Error:', err?.message || err);
      return res.status(500).json({ ok: false, error: 'Failed to prepare file download' });
    }
  });

  // Serve file with standard HTTP Content-Disposition header for Android/iOS DownloadManager
  app.get('/api/download-file/:token/:fileName?', (req, res) => {
    const { token } = req.params;
    const inline = req.query.inline === '1';
    const item = downloadStore.get(token);

    if (!item || item.expiresAt < Date.now()) {
      downloadStore.delete(token);
      return res.status(404).send('انتهت صلاحية رابط التنزيل، يرجى إعادة الضغط على زر الحفظ.');
    }

    const asciiFallback = item.fileName.replace(/[^\x20-\x7E]/g, '_') || 'sanad_document';
    const encodedUtf8Name = encodeURIComponent(item.fileName);
    const dispositionType = inline ? 'inline' : 'attachment';

    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8Name}`
    );
    res.setHeader('Content-Length', String(item.buffer.length));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.send(item.buffer);
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiReady: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Smart AI Assistant Chat (with live store financial & inventory context)
  app.post('/api/ai/chat', async (req, res) => {
    const { query, storeContext, history } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'يرجى إدخال نص السؤال أو الأمر.' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY_NOT_CONFIGURED',
        message: 'خدمة Gemini AI السحابية غير مفعلة حالياً في إعدادات البيئة.',
      });
    }

    try {
      const ctxJson = storeContext ? JSON.stringify(storeContext) : '{}';
      const recentHistory = Array.isArray(history)
        ? history
            .slice(-6)
            .map((m: any) => `${m.sender === 'user' ? 'المستخدم' : 'سند AI'}: ${m.text}`)
            .join('\n')
        : '';

      const systemInstruction = `
أنت "سند الذكي"، المساعد المحاسبي والفني الرسمي لنظام سند المحاسبي المتكامل لإدارة المبيعات والمخزون وورش صيانة وبرمجة الهواتف الذكية.
تحدث باللغة العربية الواضحة والاحترافية والمختصرة (3 إلى 6 أسطر منظمة بنقاط عند الحاجة).
لديك البيانات الحية الحالية للمنشأة بصيغة JSON:
${ctxJson}

استخدم هذه الأرقام الحقيقية بدقة عندما يسأل المستخدم عن المبيعات، الصندوق، الديون، الأصناف الناقصة، أو الصيانة. إذا سأل عن أعطال هواتف أو برمجة، أعطه تشخيصاً فنياً عملياً. لا تخترع أرقاماً غير موجودة في البيانات المرسلة.
      `.trim();

      const prompt = recentHistory
        ? `سياق المحادثة الأخير:\n${recentHistory}\n\nسؤال المستخدم الحالي: ${query}`
        : query;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const text = (response.text || '').trim();
      return res.json({ success: true, response: text });
    } catch (err: any) {
      console.error('[API /api/ai/chat] Error:', err?.message || err);
      return res.status(500).json({
        error: 'AI_CHAT_FAILED',
        message: err?.message || 'تعذر الاتصال بمحرك الذكاء الاصطناعي حالياً.',
      });
    }
  });

  // 2. Phone Hardware & Software Diagnostic Engine (Structured JSON)
  app.post('/api/ai/diagnose', async (req, res) => {
    const { symptoms } = req.body || {};
    if (!symptoms || typeof symptoms !== 'string') {
      return res.status(400).json({ error: 'يرجى كتابة أعراض العطل أولاً.' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY_NOT_CONFIGURED',
        message: 'خدمة Gemini AI غير مهيأة حالياً.',
      });
    }

    try {
      const prompt = `
أنت كبير مهندسي صيانة وبرمجة الهواتف الذكية (iPhone, Samsung, Xiaomi, Honor, Realme, Infinix, Tecno).
الأعراض المقدمة من الفني:
"${symptoms}"

حلل العطل بدقة عالية وأرجع تشخيصاً فنياً عملياً باللغة العربية يتضمن المشكلة الرئيسية، التصنيف، قطع الغيار المطلوبة، الأدوات/البوكسات الموصى بها، وخطوات الإصلاح المرتبة.
      `.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              problem: { type: Type.STRING, description: 'عنوان المشكلة الفنية المرجحة' },
              category: { type: Type.STRING, description: 'hardware or software or both' },
              parts_needed: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'قطع الغيار المحتملة بالاسم العربي/التجاري الشائع في المخزن',
              },
              tools_recommended: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'الأدوات أو البوكسات الموصى بها مثل UnlockTool, Pandora, Power Supply',
              },
              steps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'خطوات الفحص والإصلاح بالترتيب',
              },
              response: {
                type: Type.STRING,
                description: 'تقرير فني عربي مفصل ومنسق يشرح العطل وخطوات القياس والإصلاح',
              },
            },
            required: ['problem', 'category', 'parts_needed', 'tools_recommended', 'steps', 'response'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      const normalizedCategory =
        parsed.category === 'software' || parsed.category === 'both' ? parsed.category : 'hardware';

      return res.json({
        success: true,
        problem: parsed.problem || 'تشخيص فني ذكي',
        category: normalizedCategory,
        parts_needed: Array.isArray(parsed.parts_needed) ? parsed.parts_needed : [],
        tools_recommended: Array.isArray(parsed.tools_recommended) ? parsed.tools_recommended : [],
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        response: parsed.response || '',
      });
    } catch (err: any) {
      console.error('[API /api/ai/diagnose] Error:', err?.message || err);
      return res.status(500).json({
        error: 'AI_DIAGNOSE_FAILED',
        message: err?.message || 'حدث خطأ أثناء تحليل العطل.',
      });
    }
  });

  // 3. Multimodal Invoice OCR Extractor
  app.post('/api/ai/parse-invoice', async (req, res) => {
    const { base64Data, mimeType, existingCategories } = req.body || {};
    if (!base64Data || typeof base64Data !== 'string') {
      return res.status(400).json({ error: 'صورة الفاتورة مفقودة.' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY_NOT_CONFIGURED',
        message: 'خدمة Gemini Vision غير مهيأة حالياً.',
      });
    }

    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const categoriesList = Array.isArray(existingCategories) && existingCategories.length > 0
        ? existingCategories.join(', ')
        : 'أجهزة, إكسسوارات, قطع صيانة, برمجيات, أخرى';

      const prompt = `
أنت خبير قراءة وتحليل فواتير المشتريات التجارية والورقية لمتاجر الإلكترونيات وصيانة الهواتف الذكية.
استخرج جميع البيانات والأصناف من صورة الفاتورة بدقة عالية باللغة العربية.
التصنيفات المتاحة: ${categoriesList}.
- استخرج سعر التكلفة للقطعة الواحدة (costPrice).
- إن لم يكن سعر البيع مكتوباً، اقترح سعر بيع بهامش ربح 25% إلى 30% فوق التكلفة.
- إن لم يوجد باركود اتركه نصاً فارغاً "".
      `.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              supplierName: { type: Type.STRING },
              invoiceNumber: { type: Type.STRING },
              invoiceDate: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              notes: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    costPrice: { type: Type.NUMBER },
                    sellingPrice: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                    barcode: { type: Type.STRING },
                    total: { type: Type.NUMBER },
                  },
                  required: ['name', 'quantity', 'costPrice'],
                },
              },
            },
            required: ['items'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      return res.json({
        success: true,
        ...parsed,
        confidence: 'high',
      });
    } catch (err: any) {
      console.error('[API /api/ai/parse-invoice] Error:', err?.message || err);
      return res.status(500).json({
        error: 'AI_INVOICE_FAILED',
        message: err?.message || 'تعذر قراءة بيانات الفاتورة من الصورة.',
      });
    }
  });

  // 4. Smart Voice POS Command Parser
  app.post('/api/ai/voice-pos', async (req, res) => {
    const { transcript, products, customers } = req.body || {};
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'النص الصوتي مفقود.' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY_NOT_CONFIGURED' });
    }

    try {
      const compactProducts = Array.isArray(products)
        ? products.slice(0, 120).map((p: any) => ({ id: p.id, name: p.name }))
        : [];
      const compactCustomers = Array.isArray(customers)
        ? customers.slice(0, 80).map((c: any) => ({ id: c.id, name: c.name }))
        : [];

      const prompt = `
حول الجملة الصوتية التالية في نقطة البيع (الكاشير) إلى أوامر JSON دقيقة مطابقة للسلع والعملاء المتاحين:
الجملة: "${transcript}"

المنتجات المتاحة: ${JSON.stringify(compactProducts)}
العملاء المتاحين: ${JSON.stringify(compactCustomers)}
      `.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              addItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                  },
                  required: ['productId', 'quantity'],
                },
              },
              customerId: { type: Type.STRING },
              discount: { type: Type.NUMBER },
              paymentType: { type: Type.STRING, description: 'cash or debt or empty' },
              completeSale: { type: Type.BOOLEAN },
              clearCart: { type: Type.BOOLEAN },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      return res.json({ success: true, command: parsed });
    } catch (err: any) {
      console.error('[API /api/ai/voice-pos] Error:', err?.message || err);
      return res.status(500).json({ error: 'AI_VOICE_POS_FAILED' });
    }
  });

  // Mount Vite middleware in dev OR serve built assets in production
  if (!IS_PRODUCTION) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sanad ERP Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Sanad server:', err);
  process.exit(1);
});
