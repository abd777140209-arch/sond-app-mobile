/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  category?: string; // e.g. "أجهزة", "إكسسوارات", "صيانة", "أخرى"
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalDebt: number;
  createdAt: string;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  sellingPrice: number;
  total: number;
}

export type InvoiceType = 'cash' | 'debt';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  items: InvoiceItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  type: InvoiceType;
  date: string;
  status?: 'active' | 'refunded'; // supports returns
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  note: string;
}

export interface MaintenanceOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deviceName: string;
  issueDescription: string;
  cost: number;
  status: 'received' | 'repairing' | 'completed' | 'delivered';
  dateReceived: string;
  dateDelivered?: string;
  notes: string;
}

export interface Transaction {
  id: string;
  type: 'sale' | 'payment' | 'expense' | 'refund' | 'maintenance_income';
  amount: number;
  date: string;
  description: string;
}

export interface SystemSettings {
  storeName: string;
  currency: string;
  address: string;
  phone: string;
  pinCode: string;
  isPinEnabled: boolean;
}
