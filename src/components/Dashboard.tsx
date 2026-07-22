/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrendingUp, Users, Package, Wallet, ArrowDownLeft, AlertCircle, Award, Phone } from 'lucide-react';
import { Product, Customer, Invoice, Payment, Transaction, SystemSettings } from '../types';

interface DashboardProps {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  transactions: Transaction[];
  settings: SystemSettings;
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({
  products,
  customers,
  invoices,
  payments,
  transactions,
  settings,
  setActiveTab
}: DashboardProps) {

  // Calculations
  const totalSales = invoices.reduce((sum, inv) => sum + inv.finalAmount, 0);
  const totalDebts = customers.reduce((sum, cust) => sum + cust.totalDebt, 0);
  
  // Total Inventory Value (Cost vs Selling)
  const inventoryCostValue = products.reduce((sum, p) => sum + (p.costPrice * p.stock), 0);
  const inventoryRetailValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.stock), 0);
  const expectedProfit = inventoryRetailValue - inventoryCostValue;

  const lowStockProducts = products.filter(p => p.stock <= p.minStock);

  // Top debtor customers
  const topDebtors = [...customers]
    .filter(c => c.totalDebt > 0)
    .sort((a, b) => b.totalDebt - a.totalDebt)
    .slice(0, 4);

  // Format currency
  const fmt = (num: number) => {
    return num.toLocaleString() + ' ' + settings.currency;
  };

  // Calculate some chart values
  const maxDebtorVal = topDebtors[0]?.totalDebt || 1;

  return (
    <div id="dashboard_tab_view" className="space-y-6">
      
      {/* Welcome & Top Notification */}
      <div className="p-6 rounded-2xl border border-[#C5A862]/30 bg-gradient-to-r from-[#121F2E] via-[#0B1521] to-[#060B10] shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        {/* Decorative ambient light */}
        <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-[#C5A862]/10 blur-3xl"></div>
        
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-[#F3E7C4] to-[#C5A862]">
            أهلاً بك في نظام سند المحاسبي الذكي
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            نسخة الكمبيوتر المستقلة (Desktop Edition) • إدارة المبيعات، المخازن، وحسابات الذمم والديون
          </p>
        </div>

        {/* Developer Credit Tag */}
        <div className="flex items-center gap-3 bg-[#1A2838]/80 border border-[#C5A862]/20 px-4 py-2 rounded-xl text-xs">
          <Award className="w-5 h-5 text-[#C5A862]" />
          <div>
            <div className="text-gray-300 font-semibold">تطوير: م. عبدالمجيد المحواشي</div>
            <div className="text-gray-400 text-[10px]">Compose for Desktop Framework</div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
        
        {/* Total Sales */}
        <div className="p-3.5 md:p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 hover:border-[#C5A862]/40 hover:-translate-y-1 transition-all duration-300 shadow-md relative group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] md:text-xs text-gray-400 font-medium">إجمالي المبيعات</span>
              <h3 className="text-sm sm:text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF] to-[#C5A862] mt-0.5 md:mt-1">
                {fmt(totalSales)}
              </h3>
            </div>
            <div className="p-2 md:p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-gray-400 mt-2 md:mt-4 flex justify-between">
            <span className="hidden sm:inline">مجموع الفواتير:</span>
            <span className="font-semibold text-white">{invoices.length} فواتير</span>
          </div>
        </div>

        {/* Total Debts */}
        <div className="p-3.5 md:p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 hover:border-[#C5A862]/40 hover:-translate-y-1 transition-all duration-300 shadow-md relative group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] md:text-xs text-gray-400 font-medium">الديون المستحقة</span>
              <h3 className="text-sm sm:text-lg md:text-xl font-bold text-red-400 mt-0.5 md:mt-1">
                {fmt(totalDebts)}
              </h3>
            </div>
            <div className="p-2 md:p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Wallet className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-gray-400 mt-2 md:mt-4 flex justify-between">
            <span className="hidden sm:inline">العملاء الدائنون:</span>
            <span className="font-semibold text-red-400">
              {customers.filter(c => c.totalDebt > 0).length} عملاء
            </span>
          </div>
        </div>

        {/* Inventory Value */}
        <div className="p-3.5 md:p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 hover:border-[#C5A862]/40 hover:-translate-y-1 transition-all duration-300 shadow-md relative group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] md:text-xs text-gray-400 font-medium">رأس مال المخزون</span>
              <h3 className="text-sm sm:text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF] to-[#C5A862] mt-0.5 md:mt-1">
                {fmt(inventoryCostValue)}
              </h3>
            </div>
            <div className="p-2 md:p-2.5 rounded-xl bg-[#C5A862]/10 text-[#C5A862] border border-[#C5A862]/20">
              <Package className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-gray-400 mt-2 md:mt-4 flex justify-between">
            <span className="hidden sm:inline">قيمة البيع:</span>
            <span className="font-semibold text-[#C5A862]">{fmt(inventoryRetailValue)}</span>
          </div>
        </div>

        {/* Expected profit */}
        <div className="p-3.5 md:p-5 rounded-2xl bg-[#0F1824] border border-[#C5A862]/10 hover:border-[#C5A862]/40 hover:-translate-y-1 transition-all duration-300 shadow-md relative group">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] md:text-xs text-gray-400 font-medium">أرباح مقدرة</span>
              <h3 className="text-sm sm:text-lg md:text-xl font-bold text-green-400 mt-0.5 md:mt-1">
                {fmt(expectedProfit)}
              </h3>
            </div>
            <div className="p-2 md:p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ArrowDownLeft className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
          <div className="text-[10px] md:text-[11px] text-gray-400 mt-2 md:mt-4 flex justify-between">
            <span className="hidden sm:inline">هامش الربح:</span>
            <span className="font-semibold text-green-400">
              {inventoryCostValue ? Math.round((expectedProfit / inventoryCostValue) * 100) : 0}%
            </span>
          </div>
        </div>

      </div>

      {/* Bento Section: Debt graph & Stock alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Debtors Analytics (Custom Gold Bar Chart) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-[#F3E7C4] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C5A862]" />
                أكبر مديونيات العملاء المستحقة
              </h2>
              <button 
                onClick={() => setActiveTab('customers')} 
                className="text-xs text-[#C5A862] hover:underline cursor-pointer"
              >
                دفتر العملاء الكامل ←
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-6">
              رسم بياني توضيحي لمبالغ الذمم والديون المترتبة على العملاء الأعلى طلباً لتسهيل عمليات المتابعة والتحصيل الفوري.
            </p>

            {/* Bars container */}
            <div className="space-y-4">
              {topDebtors.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  لا توجد مديونيات مستحقة في الوقت الحالي. ممتاز!
                </div>
              ) : (
                topDebtors.map(debtor => {
                  const pct = Math.max(8, (debtor.totalDebt / maxDebtorVal) * 100);
                  return (
                    <div key={debtor.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-gray-200">{debtor.name}</span>
                        <span className="font-semibold font-mono text-red-400">{fmt(debtor.totalDebt)}</span>
                      </div>
                      <div className="w-full bg-[#182535] h-3 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${pct}%` }}
                          className="bg-gradient-to-r from-[#9F8342] via-[#C5A862] to-[#F3E7C4] rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(197,168,98,0.4)]"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-800 text-xs text-gray-400 flex justify-between items-center">
            <span>مجموع ديون العملاء الإجمالي في الذمم:</span>
            <span className="font-bold text-red-400 text-sm font-mono">{fmt(totalDebts)}</span>
          </div>
        </div>

        {/* Low Stock Notifications / Alerts */}
        <div className="p-6 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#F3E7C4] flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
              تنبيهات نقص مخزون السلع
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              المنتجات التالية وصلت إلى حد الطلب الأدنى الموصى به من قبل المشرف:
            </p>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {lowStockProducts.length === 0 ? (
                <div className="py-8 text-center text-green-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-400">✓</div>
                  جميع مستويات المخزون كافية ومستقرة!
                </div>
              ) : (
                lowStockProducts.map(p => (
                  <div key={p.id} className="p-3 rounded-xl bg-red-950/20 border border-red-500/20 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-gray-200">{p.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">باركود: {p.barcode}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-red-400 font-bold font-mono">الكمية: {p.stock}</div>
                      <div className="text-[10px] text-gray-400">الحد الأدنى: {p.minStock}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('inventory')}
            className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-br from-[#1A2E44] to-[#121E2E] text-xs font-semibold text-[#C5A862] hover:text-white border border-[#C5A862]/30 hover:border-[#C5A862] transition-all cursor-pointer text-center"
          >
            إضافة كميات للمستودع
          </button>
        </div>

      </div>

      {/* Transactions History Feed */}
      <div className="p-6 rounded-2xl bg-[#0F1824] border border-[#C5A862]/20 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base font-bold text-[#F3E7C4] flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-green-400" />
            دفتر القيود والعمليات الحسابية الأخيرة
          </h2>
          <button 
            onClick={() => setActiveTab('transactions')} 
            className="text-xs text-[#C5A862] hover:underline cursor-pointer"
          >
            جميع قيود اليومية ←
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="pb-3 pr-2">تفاصيل العملية</th>
                <th className="pb-3 text-center">التاريخ والوقت</th>
                <th className="pb-3 text-center">النوع</th>
                <th className="pb-3 pl-2 text-left">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    لا توجد أي قيود مسجلة بعد. ابدأ بعمل فاتورة مبيعات جديدة!
                  </td>
                </tr>
              ) : (
                [...transactions].reverse().slice(0, 5).map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/20">
                    <td className="py-3 pr-2 font-medium text-gray-200">
                      {t.description}
                    </td>
                    <td className="py-3 text-center text-gray-400 font-mono">
                      {new Date(t.date).toLocaleString('ar-YE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.type === 'sale' 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                          : t.type === 'payment'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      }`}>
                        {t.type === 'sale' ? 'مبيعات' : t.type === 'payment' ? 'سداد ديون' : 'مصروف'}
                      </span>
                    </td>
                    <td className={`py-3 pl-2 text-left font-bold font-mono ${
                      t.type === 'sale' ? 'text-green-400' : 'text-blue-400'
                    }`}>
                      {t.type === 'sale' ? '+' : ''}{fmt(t.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
