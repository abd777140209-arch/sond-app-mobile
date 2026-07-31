/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowRightLeft, 
  UserCheck, 
  Smartphone, 
  History, 
  Loader2, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Receipt, 
  FileText,
  Building2,
  Coins
} from 'lucide-react';
import { Customer, Transaction, SystemSettings } from '../types';
import { soundManager } from '../utils/sound';

export interface SanadPhoneLedgerProps {
  apiBaseUrl?: string;
  token?: string;
  customers?: Customer[];
  transactions?: Transaction[];
  settings?: SystemSettings;
  onSelectCustomerStatement?: (customer: Customer) => void;
}

export const SanadPhoneLedger: React.FC<SanadPhoneLedgerProps> = ({
  apiBaseUrl = '',
  token = '',
  customers = [],
  transactions = [],
  settings,
  onSelectCustomerStatement
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<'ILS' | 'USD' | 'JOD' | 'YER'>('ILS');
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Exchange rates relative to ILS base with safe dynamic rate conversion
  const rates: Record<string, { rate: number; symbol: string; name: string }> = {
    ILS: { rate: 1, symbol: '₪', name: 'شيقل' },
    USD: { rate: 0.27, symbol: '$', name: 'دولار أمريكي' },
    JOD: { rate: 0.19, symbol: 'JD', name: 'دينار أردني' },
    YER: { rate: 68.0, symbol: '﷼', name: 'ريال يمني' }
  };

  const currentRate = rates[selectedCurrency].rate;
  const currentSymbol = rates[selectedCurrency].symbol;

  // Calculate stats from local transactions if server URL isn't configured
  const totalSalesBase = transactions
    .filter(t => t.type === 'income' || t.type === 'sale')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpensesBase = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfitBase = totalSalesBase - totalExpensesBase;

  const totalSalesConverted = totalSalesBase * currentRate;
  const totalExpensesConverted = totalExpensesBase * currentRate;
  const netProfitConverted = netProfitBase * currentRate;

  // Search matched customers
  const matchedCustomers = customers.filter(c => 
    !c.isDeleted && (
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
    )
  );

  const handleCurrencyChange = (curr: 'ILS' | 'USD' | 'JOD' | 'YER') => {
    soundManager.playScanBeep();
    setSelectedCurrency(curr);
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen font-sans text-slate-800 dark:text-slate-100 space-y-6" style={{ direction: 'rtl' }}>
      
      {/* 🔹 Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 backdrop-blur-md rounded-2xl border border-indigo-400/30 text-indigo-300">
            <Coins className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
              <span>كشوف الحسابات وتعدد العملات (Sanad Fast Ledger)</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              متابعة ديون العملاء، حركة قطع الغيار، وأجور صيانة وبرمجة الهواتف بتحويل العملات اللحظي
            </p>
          </div>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-700">
          {(['ILS', 'USD', 'JOD', 'YER'] as const).map((curr) => (
            <button
              key={curr}
              onClick={() => handleCurrencyChange(curr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                selectedCurrency === curr
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {rates[curr].name} ({rates[curr].symbol})
            </button>
          ))}
        </div>
      </div>

      {/* 🔹 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Sales */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 border-r-4 border-r-emerald-500">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>مبيعات وصيانة الهواتف</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {totalSalesConverted.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-bold text-emerald-600">{currentSymbol}</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">تشمل إيرادات الصيانة، السوفتوير وقطع الغيار</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 border-r-4 border-r-rose-500">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>المصاريف وقطع الغيار</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {totalExpensesConverted.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-bold text-rose-600">{currentSymbol}</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">تضم مشتريات الشاشات والآيسيات والبوكسات</p>
        </div>

        {/* Net Profit */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 border-r-4 border-r-indigo-600">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>صافي أرباح المحل</span>
            <Wallet className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {netProfitConverted.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-bold">{currentSymbol}</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">الأرباح الفعلية المحسوبة بالعملة المختارة</p>
        </div>

      </div>

      {/* 🔹 Customer Debt & Statement Lookup */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-extrabold text-base">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <h2>كشف حساب زبون / ديون الصيانة والبرمجة</h2>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {customers.length} عميل مسجل
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="ابحث باسم الزبون، أو رقم الهاتف للكشف عن حسابه..."
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Customers List / Selected Details */}
        {customerSearch.trim() !== '' && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {matchedCustomers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">لم يتم العثور على زبون مطابق</p>
            ) : (
              matchedCustomers.map((cust) => {
                const balanceConverted = cust.balance * currentRate;
                return (
                  <div 
                    key={cust.id} 
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 hover:border-indigo-400 transition"
                  >
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">{cust.name}</h4>
                      <p className="text-[11px] text-slate-400">{cust.phone}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-slate-400 block">الرصيد المتبقي</span>
                        <span className={`text-xs font-extrabold ${balanceConverted > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {balanceConverted.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currentSymbol}
                        </span>
                      </div>

                      {onSelectCustomerStatement && (
                        <button
                          onClick={() => {
                            soundManager.playScanBeep();
                            onSelectCustomerStatement(cust);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow cursor-pointer transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>كشف الحساب</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>

    </div>
  );
};

export default SanadPhoneLedger;
