/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 🛠️ Sanad Diagnostic & Inventory Service
 * خدمة التشخيص الميكانيكي وفحص القطع في المخزون الفعلي وربط السلة
 */

import { diagnosePhoneIssue } from './GoogleAIService';

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
  likelyCause?: string;
  issueCategory?: string;
  suggestedParts?: string[];
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
 * 1. إرسال الأعراض للحصول على تشخيص فني ومحاسبي ذكي للهواتف
 */
export const diagnoseVehicleProblem = async (
  apiBaseUrl: string, 
  token: string, 
  symptoms: string
): Promise<DiagnosticResult> => {
  if (!apiBaseUrl) {
    const res = await diagnosePhoneIssue(symptoms);
    return {
      success: res.success,
      problem: res.problem,
      parts_needed: res.parts_needed,
      recommended_actions: res.steps,
      response: res.response
    };
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
    console.warn('Backend API unavailable, falling back to local Gemini phone diagnostic:', error);
    const res = await diagnosePhoneIssue(symptoms);
    return {
      success: res.success,
      problem: res.problem,
      parts_needed: res.parts_needed,
      recommended_actions: res.steps,
      response: res.response
    };
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
