/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Dashboard from './Dashboard';
import { Product, Customer, Invoice, Payment, Transaction, SystemSettings, Employee } from '../types';

interface DesktopDashboardViewProps {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  transactions: Transaction[];
  settings: SystemSettings;
  employees?: Employee[];
  setActiveTab: (tab: string) => void;
  isPrivacyMode?: boolean;
}

export default function DesktopDashboardView({
  products,
  customers,
  invoices,
  payments,
  transactions,
  settings,
  employees = [],
  setActiveTab,
  isPrivacyMode = false
}: DesktopDashboardViewProps) {
  return (
    <div id="desktop_dashboard_isolated_container" className="w-full h-full">
      <Dashboard
        products={products}
        customers={customers}
        invoices={invoices}
        payments={payments}
        transactions={transactions}
        settings={settings}
        employees={employees}
        setActiveTab={setActiveTab}
        isPrivacyMode={isPrivacyMode}
      />
    </div>
  );
}
