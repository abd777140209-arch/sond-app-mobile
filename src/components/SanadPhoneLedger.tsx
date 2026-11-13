/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Wallet,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Search,
  FileText,
  Coins,
  Download,
  ArrowUpRight
} from 'lucide-react';
import { Customer, Transaction, SystemSettings, CurrencyRate } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';
import { DEFAULT_CURRENCIES } from '../utils/seedData';
import { showToast } from '../utils/toast';

export interface SanadPhoneLedgerProps {
  apiBaseUrl?: string;
  token?: string;
  customers?: Customer[];
  transactions?: Transaction[];
  settings?: SystemSettings;
  onSelectCustomerStatement?: (customer: Customer) => void;
}

export const SanadPhoneLedger: React.FC<SanadPhoneLedgerProps> = ({
  customers = [],
  transactions = [],
  settings,
  onSelectCustomerStatement
}) => {
  const currenciesList: CurrencyRate[] = useMemo(() => {
    return settings?.currencies && settings.currencies.length > 0
      ? settings.currencies
      : DEFAULT_CURRENCIES;
  }, [settings?.currencies]);

  const baseCurrency = useMemo(
    () => currenciesList.find(c => c.isBase) || currenciesList[0],
    [currenciesList]
  );

  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string>(
    baseCurrency?.code || 'YER'
  );
  const [customerSearch, setCustomerSearch] = useState('');

  const activeCurrency = useMemo(
    () => currenciesList.find(c => c.code === selectedCurrencyCode) || baseCurrency,
    [currenciesList, selectedCurrencyCode, baseCurrency]
  );

  // Convert from base store currency -> target display currency accurately
  // In settings, exchangeRate represents how many base units equal 1 unit of foreign currency (e.g., 1 USD = 530 YER)
  const convertAmount = (baseAmount: number): number => {
    if (!activeCurrency || activeCurrency.isBase || !activeCurrency.exchangeRate) {
      return baseAmount;
    }
    return baseAmount / activeCurrency.exchangeRate;
  };

  const currentSymbol = activeCurrency?.symbol || settings?.currency || 'ر.ي';

  const isRevenueTx = (type: Transaction['type']) =>
    type === 'sale' || type === 'payment' || type === 'maintenance_income' || type === 'maintenance';

  const isExpenseTx = (type: Transaction['type']) =>
    type === 'expense' || type === 'refund';

  const totalSalesBase = transactions
    .filter(t => isRevenueTx(t.type))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpensesBase = transactions
    .filter(t => isExpenseTx(t.type))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const netProfitBase = totalSalesBase - totalExpensesBase;

  const totalSalesConverted = convertAmount(totalSalesBase);
  const totalExpensesConverted = convertAmount(totalExpensesBase);
  const netProfitConverted = convertAmount(netProfitBase);

  const activeCustomers = customers.filter(c => !c.isDeleted && c.isActive !== false);
  const totalDebtsConverted = convertAmount(
    activeCustomers.reduce((sum, c) => sum + (c.totalDebt || 0), 0)
  );

  // If search is empty, show top debtors automatically so the screen is immediately useful!
  const displayedCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) {
      return [...activeCustomers]
        .filter(c => (c.totalDebt || 0) > 0)
        .sort((a, b) => (b.totalDebt || 0) - (a.totalDebt || 0))
        .slice(0, 12);
    }
    return activeCustomers.filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }, [activeCustomers, customerSearch]);

  const handleCurrencyChange = (code: string) => {
    soundManager.playScanBeep();
    setSelectedCurrencyCode(code);
  };

  const handleExportCSV = async () => {
    soundManager.playSuccessChime();
    let csv = `\uFEFFالتاريخ,النوع,الوصف,المبلغ بالعملة الأساسية (${baseCurrency.code}),المبلغ المحول (${activeCurrency.code})\n`;
    transactions.forEach(t => {
      const converted = convertAmount(t.amount || 0);
      const typeAr = isRevenueTx(t.type) ? 'إيراد / مبيعات' : 'مصروف / مشتريات';
      csv += `"${t.date}","${typeAr}","${(t.description || '').replace(/"/g, '""')}","${t.amount}","${converted.toFixed(2)}"\n`;
    });

    const fileName = `حركة_الصندوق_${activeCurrency.code}_${new Date().toISOString().slice(0, 10)}.csv`;
    const ok = await saveAndShareFile({
      fileName,
      data: csv,
      mimeType: 'text/csv;charset=utf-8',
      title: 'تصدير حركة الصندوق - سند',
      text: `تقرير حركة الصندوق بالعملة المختارة (${activeCurrency.name})`
    });
    if (ok) {
      showToast(`تم تصدير دفتر الحسابات بعملة (${activeCurrency.name}) بنجاح`, 'success');
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen font-sans text-slate-800 dark:text-slate-100 space-y-6" style={{ direction: 'rtl' }}>
      
      {/* 🔹 Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 backdrop-blur-md rounded-2xl border border-indigo-400/30 text-indigo-300">
            <Coins className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
              <span>دفتر العملات وكشوف الحسابات السريعة</span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              تحويل لحظي وفق أسعار الصرف المعتمدة في إعدادات النظام لمتابعة الإيرادات والديون
            </p>
          </div>
        </div>

        {/* Currency Switcher & CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير CSV</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-700">
            {currenciesList.map((curr) => (
              <button
                key={curr.id || curr.code}
                onClick={() => handleCurrencyChange(curr.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  activeCurrency?.code === curr.code
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {curr.name} ({curr.symbol})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Exchange Rate Info Strip */}
      {!activeCurrency?.isBase && (
        <div className="px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/70 text-xs font-bold text-indigo-800 dark:text-indigo-200 flex items-center justify-between">
          <span>سعر الصرف المطبق حالياً: 1 {activeCurrency.name} ({activeCurrency.symbol}) = <span className="font-mono tabular-nums">{activeCurrency.exchangeRate}</span> {baseCurrency.symbol}</span>
          <span className="text-[11px] opacity-80">يتم تعديل الأسعار من الإعدادات</span>
        </div>
      )}

      {/* 🔹 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Sales */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 border-r-4 border-r-emerald-500">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>إجمالي المبيعات والإيرادات</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {totalSalesConverted.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{currentSymbol}</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">مبيعات الكاشير + التحصيلات + الصيانة</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 border-r-4 border-r-rose-500">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>المصاريف والمشتريات</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {totalExpensesConverted.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{currentSymbol}</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">فواتير الشراء والمصاريف والمرتجعات</p>
        </div>

        {/* Net Cashflow */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 border-r-4 border-r-indigo-600">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>صافي السيولة بالعملة المختارة</span>
            <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
            {netProfitConverted.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-bold">{currentSymbol}</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">صافي التدفق النقدي المحول لحظياً</p>
        </div>

        {/* Total Debts */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 border-r-4 border-r-amber-500">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold mb-2">
            <span>إجمالي ديون العملاء</span>
            <ArrowUpRight className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {totalDebtsConverted.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-bold">{currentSymbol}</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">إجمالي الذمم المدينة بالعملة المختارة</p>
        </div>

      </div>

      {/* 🔹 Customer Debt & Statement Lookup */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-extrabold text-base">
            <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2>كشف حساب العملاء والديون بالعملة المختارة</h2>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {activeCustomers.length} عميل نشط
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="ابحث باسم الزبون أو رقم الهاتف للكشف عن حسابه..."
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Customers List */}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {displayedCustomers.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              {customerSearch.trim() ? 'لم يتم العثور على عميل مطابق لبحثك' : 'لا توجد ديون مسجلة على العملاء حالياً'}
            </p>
          ) : (
            displayedCustomers.map((cust) => {
              const debtBase = cust.totalDebt ?? cust.balance ?? 0;
              const balanceConverted = convertAmount(debtBase);
              return (
                <div
                  key={cust.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 hover:border-indigo-400 transition"
                >
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">{cust.name}</h4>
                    <p className="text-[11px] text-slate-400 font-mono">{cust.phone}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-slate-400 block">المديونية الحالية</span>
                      <span className={`text-xs font-extrabold font-mono tabular-nums ${balanceConverted > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
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
                        <span>فتح كشف الحساب</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
};

export default SanadPhoneLedger;
