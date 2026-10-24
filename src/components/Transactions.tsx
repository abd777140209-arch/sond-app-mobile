/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  DollarSign, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft,
  Plus, 
  Download, 
  Trash2, 
  Calendar, 
  FileText, 
  RefreshCw, 
  Printer, 
  Undo2,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  Image as ImageIcon,
  Eye,
  TrendingUp,
  ShoppingCart,
  Package,
  Share2,
  Sparkles,
  Receipt,
  Layers,
  Edit3,
  UserCheck,
  Building2,
  Hash,
  Barcode,
  PlusCircle,
  Save
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Transaction, Invoice, Product, Customer, PurchaseInvoiceItem } from '../types';
import { soundManager } from '../utils/sound';
import { saveAndShareFile } from '../utils/fileExport';
import { generateAndSharePDF } from '../services/pdfService';
import { PAYMENT_METHODS, formatPaymentMethodLabel, PaymentMethodKey } from '../utils/paymentMethods';

interface TransactionsProps {
  transactions: Transaction[];
  invoices: Invoice[];
  products?: Product[];
  customers?: Customer[];
  onAddExpense: (
    amount: number,
    description: string,
    paymentMethod?: string,
    referenceNumber?: string,
    extra?: { beneficiary?: string; voucherCategory?: string; date?: string; notes?: string }
  ) => void;
  onAddReceiptVoucher?: (voucherData: {
    amount: number;
    description: string;
    paymentMethod?: string;
    referenceNumber?: string;
    payerName?: string;
    customerId?: string;
    deductFromCustomerDebt?: boolean;
    voucherCategory?: string;
    date?: string;
    notes?: string;
  }) => void;
  onUpdateTransaction?: (updatedTx: Transaction) => void;
  onUpdatePurchaseInvoice?: (
    transactionId: string,
    updatedItems: PurchaseInvoiceItem[],
    deletedItems: { productId: string; quantityToRevert: number; deleteProductCompletely?: boolean }[],
    metadata: {
      supplierName?: string;
      invoiceNumber?: string;
      paymentMethod?: string;
      customTotalAmount?: number;
      notes?: string;
    }
  ) => void;
  onDeleteTransaction: (id: string, options?: { revertInventory?: boolean; revertCustomerDebt?: boolean }) => void;
  onRefundInvoice: (id: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
  currency: string;
  isPrivacyMode?: boolean;
  storeName?: string;
}

export default function Transactions({
  transactions,
  invoices,
  products = [],
  customers = [],
  onAddExpense,
  onAddReceiptVoucher,
  onUpdateTransaction,
  onUpdatePurchaseInvoice,
  onDeleteTransaction,
  onRefundInvoice,
  onViewInvoice,
  currency,
  isPrivacyMode = false,
  storeName
}: TransactionsProps) {
  // Main Sub-Tab: 'daily' (الحركة والتقفيل اليومي), 'ledger' (دفتر القيود والسندات المالية), 'invoices' (أرشيف الفواتير والمرتجعات)
  const [subTab, setSubTab] = useState<'daily' | 'ledger' | 'invoices'>('ledger');
  
  // Date filtering for Daily / Period view
  const [dailyFilterMode, setDailyFilterMode] = useState<'today' | 'yesterday' | '7days' | 'this_month' | 'custom'>('today');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // General search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'payment' | 'expense' | 'purchase' | 'refund' | 'maintenance_income'>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'active' | 'refunded'>('all');

  // Column Visibility States for Tables
  const [showInvoiceColPicker, setShowInvoiceColPicker] = useState(false);

  const [visibleLedgerCols, setVisibleLedgerCols] = useState({
    date: true,
    typeAndMethod: true,
    description: true,
    amount: true,
    actions: true,
  });
  const [showLedgerColPicker, setShowLedgerColPicker] = useState(false);

  // 1. Add Expense (سند صرف / مصروف) modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseBeneficiary, setExpenseBeneficiary] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('مصروف عام');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethodKey>('cash');
  const [expenseRefNumber, setExpenseRefNumber] = useState('');
  const [expenseError, setExpenseError] = useState('');

  // 2. Add Receipt Voucher (سند قبض جديد) modal states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptMode, setReceiptMode] = useState<'customer' | 'general'>('general');
  const [receiptCustomerId, setReceiptCustomerId] = useState<string>('');
  const [receiptPayerName, setReceiptPayerName] = useState<string>('');
  const [receiptCategory, setReceiptCategory] = useState<string>('سند قبض عام');
  const [receiptAmount, setReceiptAmount] = useState<number>(0);
  const [receiptDesc, setReceiptDesc] = useState<string>('');
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<PaymentMethodKey>('cash');
  const [receiptRefNumber, setReceiptRefNumber] = useState<string>('');
  const [receiptDeductDebt, setReceiptDeductDebt] = useState<boolean>(true);
  const [receiptError, setReceiptError] = useState<string>('');

  // 3. Purchase Invoice Items Viewer & Editor Modal (نافذة عرض وتعديل وحذف أصناف فاتورة المشتريات المقيدة في المصروف)
  const [editingPurchaseTx, setEditingPurchaseTx] = useState<Transaction | null>(null);
  const [purchaseItemsList, setPurchaseItemsList] = useState<PurchaseInvoiceItem[]>([]);
  const [deletedPurchaseItems, setDeletedPurchaseItems] = useState<{ item: PurchaseInvoiceItem; deleteProductCompletely: boolean }[]>([]);
  const [purchaseSupplierName, setPurchaseSupplierName] = useState('');
  const [purchaseInvoiceNum, setPurchaseInvoiceNum] = useState('');
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<string>('cash');
  const [purchaseItemSearch, setPurchaseItemSearch] = useState('');
  const [useCustomPurchaseTotal, setUseCustomPurchaseTotal] = useState(false);
  const [customPurchaseTotal, setCustomPurchaseTotal] = useState<number>(0);
  const [showLinkInventoryPicker, setShowLinkInventoryPicker] = useState(false);

  // 4. Universal Voucher Edit Modal (نافذة التحكم وتعديل أي سند مالي)
  const [editingVoucherTx, setEditingVoucherTx] = useState<Transaction | null>(null);
  const [editVoucherType, setEditVoucherType] = useState<Transaction['type']>('expense');
  const [editVoucherAmount, setEditVoucherAmount] = useState<number>(0);
  const [editVoucherDesc, setEditVoucherDesc] = useState<string>('');
  const [editVoucherParty, setEditVoucherParty] = useState<string>('');
  const [editVoucherMethod, setEditVoucherMethod] = useState<string>('cash');
  const [editVoucherRef, setEditVoucherRef] = useState<string>('');
  const [editVoucherDate, setEditVoucherDate] = useState<string>('');
  const [editVoucherNotes, setEditVoucherNotes] = useState<string>('');

  // 5. Formal Voucher Preview & Print Modal (نافذة معاينة وطباعة السند)
  const [viewingVoucherTx, setViewingVoucherTx] = useState<Transaction | null>(null);

  // 6. Smart Delete Voucher Confirmation Modal (نافذة تأكيد حذف السند مع الخيارات)
  const [deletingVoucherTx, setDeletingVoucherTx] = useState<Transaction | null>(null);
  const [deleteRevertInventory, setDeleteRevertInventory] = useState<boolean>(true);
  const [deleteRevertCustomerDebt, setDeleteRevertCustomerDebt] = useState<boolean>(true);

  const [proofModalImage, setProofModalImage] = useState<string | null>(null);

  // In-app Refund confirmation modal state
  const [refundConfirmInvoice, setRefundConfirmInvoice] = useState<Invoice | null>(null);
  const [refundSuccessToast, setRefundSuccessToast] = useState<string | null>(null);

  // Format helper respecting privacy mode
  const fmt = (num: number) => {
    if (isPrivacyMode) return '**** ' + currency;
    return (num || 0).toLocaleString() + ' ' + currency;
  };

  // Detect if a transaction is a Purchase Invoice recorded in expenses
  const isPurchaseInvoiceTx = (t: Transaction): boolean => {
    return Boolean(
      t.isPurchaseInvoice ||
      t.voucherCategory === 'purchase_invoice' ||
      (t.type === 'expense' && (
        (t.description || '').includes('مشتريات بضاعة') ||
        (t.description || '').includes('فاتورة مشتريات') ||
        ((t.description || '').includes('فاتورة') && (t.description || '').includes('صنف'))
      ))
    );
  };

  // Resolve Purchase Invoice Items for any purchase transaction (including previously saved ones!)
  const resolvePurchaseItemsForTx = (t: Transaction): PurchaseInvoiceItem[] => {
    const activeProducts = products.filter(p => !p.isDeleted);

    // 1. If purchaseItems are explicitly stored on the transaction
    if (Array.isArray(t.purchaseItems) && t.purchaseItems.length > 0) {
      return t.purchaseItems.map(it => {
        const liveProd = activeProducts.find(p => p.id === it.productId || (it.barcode && p.barcode === it.barcode));
        return {
          ...it,
          name: liveProd ? liveProd.name : it.name,
          barcode: liveProd ? liveProd.barcode : it.barcode,
          category: liveProd?.category || it.category || 'إكسسوارات',
          total: (Number(it.costPrice) || 0) * (Number(it.quantity) || 0)
        };
      });
    }

    // 2. Reconstruct from products created in the same batch timestamp (p-${timestamp}-${idx})
    const batchTs = t.id.startsWith('t-') ? t.id.slice(2) : '';
    const countMatch = (t.description || '').match(/عدد\s*(\d+)\s*صنف/);
    const expectedCount = countMatch ? parseInt(countMatch[1], 10) : 0;

    let matchedProducts: Product[] = [];
    if (batchTs && /^\d+$/.test(batchTs)) {
      matchedProducts = activeProducts.filter(p => p.id.startsWith(`p-${batchTs}-`));
      
      // Also check products created within 2 minutes of the transaction if some were added in same session
      if (matchedProducts.length < expectedCount) {
        const txTime = parseInt(batchTs, 10);
        const nearby = activeProducts.filter(p => {
          if (matchedProducts.some(m => m.id === p.id)) return false;
          const m = p.id.match(/^p-(\d+)/);
          if (!m) return false;
          const pTime = parseInt(m[1], 10);
          return Math.abs(pTime - txTime) <= 120000;
        });
        matchedProducts = [...matchedProducts, ...nearby];
      }
    }

    // 3. Fallback if some items in that purchase invoice updated existing products by barcode
    if (expectedCount > 0 && matchedProducts.length < expectedCount) {
      const remainingNeeded = expectedCount - matchedProducts.length;
      const otherProducts = activeProducts
        .filter(p => !matchedProducts.some(m => m.id === p.id))
        .slice(0, remainingNeeded);
      matchedProducts = [...matchedProducts, ...otherProducts];
    }

    return matchedProducts.map(p => ({
      productId: p.id,
      name: p.name,
      barcode: p.barcode,
      quantity: Math.max(1, Number(p.stock) || 1),
      costPrice: Number(p.costPrice) || 0,
      sellingPrice: Number(p.sellingPrice) || 0,
      category: p.category || 'إكسسوارات',
      minStock: p.minStock || 2,
      total: (Number(p.costPrice) || 0) * Math.max(1, Number(p.stock) || 1)
    }));
  };

  // Open Purchase Invoice Items Manager Modal
  const handleOpenPurchaseInvoiceModal = (t: Transaction) => {
    soundManager.playScanBeep();
    const resolvedItems = resolvePurchaseItemsForTx(t);
    setEditingPurchaseTx(t);
    setPurchaseItemsList(resolvedItems);
    setDeletedPurchaseItems([]);

    // Extract supplier name and invoice number if not explicitly stored
    let sup = t.supplierName || '';
    if (!sup && t.description) {
      const supMatch = t.description.match(/من مورد:\s*([^(|-]+)/);
      if (supMatch) sup = supMatch[1].trim();
    }
    let invNum = t.invoiceNumber || t.referenceNumber || '';
    if (!invNum && t.description) {
      const invMatch = t.description.match(/فاتورة\s*([0-9A-Za-z-]+)/);
      if (invMatch) invNum = invMatch[1].trim();
    }

    setPurchaseSupplierName(sup);
    setPurchaseInvoiceNum(invNum);
    setPurchasePaymentMethod(t.paymentMethod || 'cash');
    setPurchaseItemSearch('');
    setUseCustomPurchaseTotal(false);
    setCustomPurchaseTotal(t.amount);
    setShowLinkInventoryPicker(false);
  };

  // Update a single item row inside Purchase Invoice Modal
  const handleUpdatePurchaseItemRow = (index: number, field: keyof PurchaseInvoiceItem, value: any) => {
    setPurchaseItemsList(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'costPrice') {
        current.total = (Number(current.costPrice) || 0) * (Number(current.quantity) || 0);
      }
      updated[index] = current;
      return updated;
    });
  };

  // Delete an item from Purchase Invoice Modal
  const handleRemovePurchaseItemRow = (index: number, deleteCompletely: boolean = false) => {
    soundManager.playWarningBeep();
    const target = purchaseItemsList[index];
    if (!target) return;
    if (target.productId && !target.productId.startsWith('temp-')) {
      setDeletedPurchaseItems(prev => [...prev, { item: target, deleteProductCompletely: deleteCompletely }]);
    }
    setPurchaseItemsList(prev => prev.filter((_, i) => i !== index));
  };

  // Restore a deleted item before saving
  const handleUndoRemovePurchaseItem = (delIndex: number) => {
    soundManager.playScanBeep();
    const restored = deletedPurchaseItems[delIndex];
    if (!restored) return;
    setPurchaseItemsList(prev => [...prev, restored.item]);
    setDeletedPurchaseItems(prev => prev.filter((_, i) => i !== delIndex));
  };

  // Add a brand new item row to the Purchase Invoice
  const handleAddNewRowToPurchaseInvoice = () => {
    soundManager.playScanBeep();
    const newItem: PurchaseInvoiceItem = {
      productId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      quantity: 1,
      costPrice: 0,
      sellingPrice: 0,
      category: 'إكسسوارات',
      minStock: 2,
      total: 0
    };
    setPurchaseItemsList(prev => [newItem, ...prev]);
  };

  // Link an existing product from inventory to this purchase invoice
  const handleLinkProductToPurchaseInvoice = (prod: Product) => {
    soundManager.playScanBeep();
    if (purchaseItemsList.some(it => it.productId === prod.id)) return;
    const linked: PurchaseInvoiceItem = {
      productId: prod.id,
      name: prod.name,
      barcode: prod.barcode,
      quantity: Math.max(1, prod.stock || 1),
      costPrice: prod.costPrice || 0,
      sellingPrice: prod.sellingPrice || 0,
      category: prod.category || 'إكسسوارات',
      minStock: prod.minStock || 2,
      total: (prod.costPrice || 0) * Math.max(1, prod.stock || 1)
    };
    setPurchaseItemsList(prev => [...prev, linked]);
  };

  const calculatedPurchaseItemsSum = useMemo(() => {
    return purchaseItemsList.reduce((sum, it) => sum + ((Number(it.costPrice) || 0) * (Number(it.quantity) || 0)), 0);
  }, [purchaseItemsList]);

  // Save changes to Purchase Invoice & update Expense + Inventory
  const handleSavePurchaseInvoiceChanges = () => {
    if (!editingPurchaseTx) return;

    const validItems = purchaseItemsList.filter(it => it.name.trim().length > 0);
    const finalTotal = useCustomPurchaseTotal ? customPurchaseTotal : calculatedPurchaseItemsSum;

    if (onUpdatePurchaseInvoice) {
      onUpdatePurchaseInvoice(
        editingPurchaseTx.id,
        validItems,
        deletedPurchaseItems.map(d => ({
          productId: d.item.productId,
          quantityToRevert: Number(d.item.quantity) || 0,
          deleteProductCompletely: d.deleteProductCompletely
        })),
        {
          supplierName: purchaseSupplierName.trim(),
          invoiceNumber: purchaseInvoiceNum.trim(),
          paymentMethod: purchasePaymentMethod,
          customTotalAmount: finalTotal
        }
      );
    }

    setEditingPurchaseTx(null);
    setRefundSuccessToast(`✅ تم تحديث فاتورة المشتريات (#${purchaseInvoiceNum || editingPurchaseTx.id.slice(0, 6)}) وتعديل الأصناف والمصروف بنجاح.`);
    setTimeout(() => setRefundSuccessToast(null), 5000);
  };

  // Open Universal Voucher Edit Modal
  const handleOpenEditVoucher = (t: Transaction) => {
    soundManager.playScanBeep();
    setEditingVoucherTx(t);
    setEditVoucherType(t.type);
    setEditVoucherAmount(t.amount);
    setEditVoucherDesc(t.description || '');
    setEditVoucherParty(t.payerOrBeneficiary || t.customerName || t.supplierName || '');
    setEditVoucherMethod(t.paymentMethod || 'cash');
    setEditVoucherRef(t.referenceNumber || t.invoiceNumber || '');
    setEditVoucherDate(t.date ? t.date.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setEditVoucherNotes(t.notes || '');
  };

  // Save Universal Voucher Edit
  const handleSaveVoucherEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoucherTx || !onUpdateTransaction) return;

    const updated: Transaction = {
      ...editingVoucherTx,
      type: editVoucherType,
      amount: Math.max(0, Number(editVoucherAmount) || 0),
      description: editVoucherDesc.trim() || 'قيد مالي',
      payerOrBeneficiary: editVoucherParty.trim() || undefined,
      paymentMethod: editVoucherMethod,
      referenceNumber: editVoucherRef.trim() || undefined,
      date: editVoucherDate ? new Date(editVoucherDate).toISOString() : editingVoucherTx.date,
      notes: editVoucherNotes.trim() || undefined
    };

    onUpdateTransaction(updated);
    setEditingVoucherTx(null);
    setRefundSuccessToast(`✅ تم حفظ التعديلات على السند رقم #${updated.referenceNumber || updated.id.slice(0, 6)} بنجاح.`);
    setTimeout(() => setRefundSuccessToast(null), 4000);
  };

  // Print any Voucher (سند قبض / سند صرف / فاتورة مشتريات)
  const handlePrintVoucher = (t: Transaction) => {
    soundManager.playSuccessChime();
    const isPurchase = isPurchaseInvoiceTx(t);
    const items = isPurchase ? resolvePurchaseItemsForTx(t) : [];
    const isReceipt = t.type === 'payment' || t.type === 'sale' || t.type === 'maintenance_income';
    const voucherTitle = isPurchase
      ? 'فاتورة وسند مشتريات بضاعة'
      : t.type === 'payment'
      ? 'سند قبض مالي'
      : t.type === 'expense'
      ? 'سند صرف / مصروفات'
      : t.type === 'refund'
      ? 'سند مرتجع مبيعات'
      : t.type === 'maintenance_income'
      ? 'سند إيراد صيانة'
      : 'سند قيد مبيعات';

    const methodLabel = formatPaymentMethodLabel(t.paymentMethod);
    const partyLabel = isReceipt ? 'استلمنا من المكرم / الجهة:' : 'صرفنا إلى المكرم / البيان:';
    const partyValue = t.payerOrBeneficiary || t.customerName || t.supplierName || t.description || '—';

    const itemsTableHtml = isPurchase && items.length > 0 ? `
      <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:11px;">
        <thead>
          <tr style="background:#f1f5f9; border-bottom:2px solid #0f172a;">
            <th style="padding:6px; text-align:right;">#</th>
            <th style="padding:6px; text-align:right;">اسم الصنف</th>
            <th style="padding:6px; text-align:center;">الكمية</th>
            <th style="padding:6px; text-align:center;">سعر الشراء</th>
            <th style="padding:6px; text-align:center;">سعر البيع</th>
            <th style="padding:6px; text-align:left;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => `
            <tr style="border-bottom:1px dashed #cbd5e1;">
              <td style="padding:5px;">${idx + 1}</td>
              <td style="padding:5px; font-weight:bold;">${it.name}</td>
              <td style="padding:5px; text-align:center; font-family:monospace;">${it.quantity}</td>
              <td style="padding:5px; text-align:center; font-family:monospace;">${it.costPrice.toLocaleString()}</td>
              <td style="padding:5px; text-align:center; font-family:monospace;">${it.sellingPrice.toLocaleString()}</td>
              <td style="padding:5px; text-align:left; font-family:monospace; font-weight:bold;">${it.total.toLocaleString()} ${currency}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>${voucherTitle} - ${t.referenceNumber || t.id.slice(0, 8)}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          body {
            font-family: 'Cairo', sans-serif;
            margin: 0;
            padding: 16px;
            color: #0f172a;
            background: #fff;
            direction: rtl;
          }
          .voucher-card {
            max-width: 720px;
            margin: 0 auto;
            border: 2px solid #0f172a;
            border-radius: 14px;
            padding: 18px;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #94a3b8;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .store-name { font-size: 20px; font-weight: 900; }
          .badge {
            display: inline-block;
            margin-top: 6px;
            padding: 4px 16px;
            border-radius: 999px;
            font-weight: 900;
            font-size: 14px;
            background: ${isReceipt ? '#ecfdf5' : '#fef2f2'};
            color: ${isReceipt ? '#047857' : '#be123c'};
            border: 1px solid ${isReceipt ? '#6ee7b7' : '#fecdd3'};
          }
          .amount-box {
            margin: 12px auto;
            padding: 10px 18px;
            border: 2px solid #0f172a;
            border-radius: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 900;
            font-size: 16px;
            background: #f8fafc;
          }
          .row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px dotted #cbd5e1;
            font-size: 13px;
          }
          .sigs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 24px;
            text-align: center;
            font-size: 12px;
            font-weight: bold;
          }
          .sig-box {
            border: 1px dashed #94a3b8;
            border-radius: 8px;
            padding: 10px;
            height: 55px;
          }
        </style>
      </head>
      <body>
        <div class="voucher-card">
          <div class="header">
            <div class="store-name">${storeName || 'نظام سند المحاسبي'}</div>
            <div class="badge">${voucherTitle}</div>
          </div>
          <div class="amount-box">
            <span>المبلغ المعتمد:</span>
            <span style="font-family:monospace; font-size:20px;">${t.amount.toLocaleString()} ${currency}</span>
          </div>
          <div class="row"><span>رقم السند / المرجع:</span><strong style="font-family:monospace;">#${t.referenceNumber || t.id.slice(0, 8)}</strong></div>
          <div class="row"><span>التاريخ والوقت:</span><strong style="font-family:monospace;">${new Date(t.date).toLocaleString('ar-YE')}</strong></div>
          <div class="row"><span>طريقة الدفع:</span><strong>${methodLabel}</strong></div>
          <div class="row"><span>${partyLabel}</span><strong>${partyValue}</strong></div>
          <div class="row"><span>البيان والتفاصيل:</span><strong>${t.description}</strong></div>
          ${t.notes ? `<div class="row"><span>ملاحظات إضافية:</span><strong>${t.notes}</strong></div>` : ''}
          ${itemsTableHtml}
          <div class="sigs">
            <div class="sig-box">توقيع المستلم</div>
            <div class="sig-box">اعتماد المحاسب / الإدارة</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
        }, 1500);
      }, 300);
    }
  };

  // Helper date matchers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Filter transactions and invoices based on selected daily/period date filter
  const isDateInFilter = (dateString: string) => {
    if (!dateString) return false;
    const itemDate = dateString.split('T')[0];
    if (dailyFilterMode === 'today') return itemDate === todayStr;
    if (dailyFilterMode === 'yesterday') return itemDate === yesterdayStr;
    if (dailyFilterMode === 'custom') return itemDate === selectedCustomDate;
    if (dailyFilterMode === '7days') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      return new Date(dateString) >= past7;
    }
    if (dailyFilterMode === 'this_month') {
      const now = new Date();
      const itemD = new Date(dateString);
      return itemD.getFullYear() === now.getFullYear() && itemD.getMonth() === now.getMonth();
    }
    return true;
  };

  // Filtered dataset for Daily Movement
  const dailyTransactions = useMemo(() => {
    return transactions.filter(t => isDateInFilter(t.date));
  }, [transactions, dailyFilterMode, selectedCustomDate, todayStr, yesterdayStr]);

  const dailyInvoices = useMemo(() => {
    return invoices.filter(inv => isDateInFilter(inv.date));
  }, [invoices, dailyFilterMode, selectedCustomDate, todayStr, yesterdayStr]);

  // Daily Calculations
  const dailyActiveInvoices = useMemo(() => dailyInvoices.filter(i => i.status !== 'refunded'), [dailyInvoices]);
  const dailyRefundedInvoices = useMemo(() => dailyInvoices.filter(i => i.status === 'refunded'), [dailyInvoices]);

  const dailyCashSales = useMemo(() => {
    return dailyActiveInvoices.filter(i => i.type === 'cash').reduce((sum, i) => sum + i.finalAmount, 0);
  }, [dailyActiveInvoices]);

  const dailyDebtSales = useMemo(() => {
    return dailyActiveInvoices.filter(i => i.type === 'debt').reduce((sum, i) => sum + i.finalAmount, 0);
  }, [dailyActiveInvoices]);

  const dailyTotalSales = dailyCashSales + dailyDebtSales;

  const dailyDebtPayments = useMemo(() => {
    return dailyTransactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);

  const dailyMaintenanceIncome = useMemo(() => {
    return dailyTransactions.filter(t => t.type === 'maintenance_income').reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);

  const dailyExpenses = useMemo(() => {
    return dailyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);

  const dailyRefunds = useMemo(() => {
    return dailyTransactions.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);

  // Actual Cash Net for the selected day/period (Inflows minus Outflows)
  const dailyActualCashInflow = dailyCashSales + dailyDebtPayments + dailyMaintenanceIncome;
  const dailyActualCashOutflow = dailyExpenses + dailyRefunds;
  const dailyNetCashRegister = dailyActualCashInflow - dailyActualCashOutflow;

  // Breakdown of Sold Items during the selected day/period
  const dailySoldItems = useMemo(() => {
    const itemMap = new Map<string, { productId: string; name: string; quantity: number; total: number }>();
    
    dailyActiveInvoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          const key = item.productId || item.name;
          const current = itemMap.get(key) || { productId: item.productId, name: item.name, quantity: 0, total: 0 };
          current.quantity += item.quantity || 1;
          current.total += item.total || (item.sellingPrice * (item.quantity || 1));
          itemMap.set(key, current);
        });
      }
    });

    return Array.from(itemMap.values()).sort((a, b) => b.total - a.total);
  }, [dailyActiveInvoices]);

  const totalSoldPieces = useMemo(() => {
    return dailySoldItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [dailySoldItems]);

  // Payment methods breakdown for the daily period
  const getDailyMethodTotal = (methodKey: string) => {
    return dailyTransactions.filter(t => (t.paymentMethod || 'cash') === methodKey).reduce((sum, t) => {
      if (t.type === 'expense' || t.type === 'refund') return sum - t.amount;
      return sum + t.amount;
    }, 0);
  };

  // Overall (All-time) Calculations for Header & Ledger
  const totalSales = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
  const totalPayments = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalRefunds = transactions.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0);
  const totalMaintenance = transactions.filter(t => t.type === 'maintenance_income').reduce((sum, t) => sum + t.amount, 0);
  const netCashFlow = totalSales + totalPayments + totalMaintenance - totalExpenses - totalRefunds;

  // Filter transactions for Ledger tab
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (t.description || '').toLowerCase().includes(q) ||
        (t.referenceNumber || '').toLowerCase().includes(q) ||
        (t.payerOrBeneficiary || '').toLowerCase().includes(q) ||
        (t.supplierName || '').toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q);

      const matchesType =
        filterType === 'all' ? true :
        filterType === 'purchase' ? isPurchaseInvoiceTx(t) :
        t.type === filterType;

      const matchesMethod = filterPaymentMethod === 'all' || (t.paymentMethod || 'cash') === filterPaymentMethod;
      return matchesSearch && matchesType && matchesMethod;
    });
  }, [transactions, searchQuery, filterType, filterPaymentMethod]);

  // Filter invoices for Invoices Archive tab
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (inv.customerName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = invoiceStatusFilter === 'all' || 
                            (invoiceStatusFilter === 'active' && inv.status !== 'refunded') ||
                            (invoiceStatusFilter === 'refunded' && inv.status === 'refunded');
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, invoiceStatusFilter]);

  // Submit new Expense Voucher handler
  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');

    if (expenseAmount <= 0) {
      setExpenseError('⚠️ الرجاء إدخال قيمة سند الصرف / المصروف بشكل صحيح!');
      soundManager.playWarningBeep();
      return;
    }

    if (!expenseDesc.trim()) {
      setExpenseError('⚠️ الرجاء توضيح بيان أو سبب الصرف!');
      soundManager.playWarningBeep();
      return;
    }

    onAddExpense(
      expenseAmount,
      expenseDesc.trim(),
      expensePaymentMethod,
      expenseRefNumber.trim() || undefined,
      {
        beneficiary: expenseBeneficiary.trim() || undefined,
        voucherCategory: expenseCategory
      }
    );
    setExpenseAmount(0);
    setExpenseDesc('');
    setExpenseBeneficiary('');
    setExpensePaymentMethod('cash');
    setExpenseRefNumber('');
    setShowExpenseModal(false);
    soundManager.playSuccessChime();
    setRefundSuccessToast(`✅ تم إصدار سند الصرف / المصروف بمبلغ ${expenseAmount.toLocaleString()} ${currency} بنجاح.`);
    setTimeout(() => setRefundSuccessToast(null), 4000);
  };

  // Submit new Receipt Voucher (سند قبض) handler
  const handleReceiptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReceiptError('');

    if (receiptAmount <= 0) {
      setReceiptError('⚠️ الرجاء إدخال مبلغ سند القبض بشكل صحيح!');
      soundManager.playWarningBeep();
      return;
    }

    if (receiptMode === 'customer' && !receiptCustomerId) {
      setReceiptError('⚠️ الرجاء اختيار العميل لتسجيل سند القبض في حسابه!');
      soundManager.playWarningBeep();
      return;
    }

    if (receiptMode === 'general' && !receiptPayerName.trim() && !receiptDesc.trim()) {
      setReceiptError('⚠️ الرجاء إدخال اسم الجهة الدافعة أو بيان سند القبض!');
      soundManager.playWarningBeep();
      return;
    }

    if (onAddReceiptVoucher) {
      onAddReceiptVoucher({
        amount: receiptAmount,
        description: receiptDesc.trim() || receiptCategory,
        paymentMethod: receiptPaymentMethod,
        referenceNumber: receiptRefNumber.trim() || undefined,
        payerName: receiptMode === 'general' ? (receiptPayerName.trim() || 'مقبوضات عامة') : undefined,
        customerId: receiptMode === 'customer' ? receiptCustomerId : undefined,
        deductFromCustomerDebt: receiptMode === 'customer' ? receiptDeductDebt : false,
        voucherCategory: receiptCategory
      });
    }

    const savedAmt = receiptAmount;
    setReceiptAmount(0);
    setReceiptDesc('');
    setReceiptPayerName('');
    setReceiptCustomerId('');
    setReceiptRefNumber('');
    setReceiptPaymentMethod('cash');
    setShowReceiptModal(false);
    soundManager.playSuccessChime();
    setRefundSuccessToast(`✅ تم إصدار وترحيل سند القبض بمبلغ ${savedAmt.toLocaleString()} ${currency} بنجاح.`);
    setTimeout(() => setRefundSuccessToast(null), 4000);
  };

  // Execute Refund from in-app modal
  const handleConfirmRefund = () => {
    if (!refundConfirmInvoice) return;
    const invId = refundConfirmInvoice.id;
    const invNum = refundConfirmInvoice.invoiceNumber;
    setRefundConfirmInvoice(null);
    onRefundInvoice(invId);
    setRefundSuccessToast(`✅ تم استرجاع الفاتورة #${invNum} بالكامل وإعادة الأصناف للمستودع وتسوية الحساب.`);
    setTimeout(() => {
      setRefundSuccessToast(null);
    }, 5000);
  };

  // Confirm Delete Voucher
  const handleConfirmDeleteVoucher = () => {
    if (!deletingVoucherTx) return;
    const txId = deletingVoucherTx.id;
    const txRef = deletingVoucherTx.referenceNumber || txId.slice(0, 6);
    const isPurchase = isPurchaseInvoiceTx(deletingVoucherTx);
    const isCustPayment = deletingVoucherTx.type === 'payment' && Boolean(deletingVoucherTx.customerId);

    onDeleteTransaction(txId, {
      revertInventory: isPurchase ? deleteRevertInventory : false,
      revertCustomerDebt: isCustPayment ? deleteRevertCustomerDebt : false
    });

    setDeletingVoucherTx(null);
    soundManager.playSuccessChime();
    setRefundSuccessToast(`🗑️ تم حذف السند #${txRef} وتحديث الحسابات بنجاح.`);
    setTimeout(() => setRefundSuccessToast(null), 4000);
  };

  // Share WhatsApp Summary for Daily Movement
  const handleShareDailyWhatsApp = () => {
    soundManager.playSuccessChime();
    const periodName = 
      dailyFilterMode === 'today' ? `اليوم (${new Date().toLocaleDateString('ar-YE')})` :
      dailyFilterMode === 'yesterday' ? `يوم أمس` :
      dailyFilterMode === 'custom' ? `تاريخ ${selectedCustomDate}` :
      dailyFilterMode === '7days' ? 'آخر 7 أيام' : 'هذا الشهر';

    const text = `📊 *تقرير الحركة والمبيعات والتقفيل اليومي*
🏪 المنشأة: *${storeName || 'سند المحاسبي'}*
🗓️ الفترة: *${periodName}*
----------------------------------
🟢 إجمالي المبيعات: *${dailyTotalSales.toLocaleString()} ${currency}*
   • مبيعات نقدية (كاش): ${dailyCashSales.toLocaleString()} ${currency}
   • مبيعات آجلة (ديون): ${dailyDebtSales.toLocaleString()} ${currency}

🔵 سندات القبض وتحصيلات الديون: *${dailyDebtPayments.toLocaleString()} ${currency}*
🟡 إيرادات الصيانة والخدمات: *${dailyMaintenanceIncome.toLocaleString()} ${currency}*
🔴 إجمالي سندات الصرف والمصاريف: *${dailyExpenses.toLocaleString()} ${currency}*
🔄 مرتجعات المبيعات: *${dailyRefunds.toLocaleString()} ${currency}*

💎 *صافي الكاش والنقدية بالصندوق:*
👉 *${dailyNetCashRegister.toLocaleString()} ${currency}*

📦 عدد الفواتير المصدرة: ${dailyActiveInvoices.length} فاتورة
🛍️ إجمالي القطع المباعة: ${totalSoldPieces} قطعة
----------------------------------
✨ تم استخراج التقرير آلياً عبر نظام سند المحاسبي`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // Export Daily Closing Summary as PDF
  const handleExportDailyPDF = async () => {
    soundManager.playScanBeep();

    const periodName = 
      dailyFilterMode === 'today' ? `اليوم (${new Date().toLocaleDateString('ar-YE')})` :
      dailyFilterMode === 'yesterday' ? `يوم أمس` :
      dailyFilterMode === 'custom' ? `تاريخ ${selectedCustomDate}` :
      dailyFilterMode === '7days' ? 'آخر 7 أيام' : 'هذا الشهر';

    const customColumns = [
      { key: 'index', label: 'م', width: '35px', align: 'center' as const },
      { key: 'itemName', label: 'الصنف / السلعة المباعة', align: 'right' as const },
      { key: 'quantity', label: 'الكمية المباعة', width: '85px', align: 'center' as const },
      { key: 'total', label: 'إجمالي الإيراد', width: '110px', align: 'center' as const }
    ];

    const customRows = dailySoldItems.map((item, idx) => ({
      index: idx + 1,
      itemName: item.name,
      quantity: `${item.quantity} قطعة`,
      total: `${item.total.toLocaleString()} ${currency}`
    }));

    if (customRows.length === 0) {
      customRows.push({
        index: 1,
        itemName: 'لا توجد أصناف مباعة مسجلة خلال الفترة المحددة',
        quantity: '0',
        total: `0 ${currency}`
      });
    }

    const summaryBoxes = [
      { label: 'إجمالي مبيعات اليوم', value: `${dailyTotalSales.toLocaleString()} ${currency}`, color: '#059669', bg: '#ecfdf5' },
      { label: 'سندات القبض والتحصيل', value: `${dailyDebtPayments.toLocaleString()} ${currency}`, color: '#0284c7', bg: '#f0f9ff' },
      { label: 'المصاريف والمرتجعات', value: `${(dailyExpenses + dailyRefunds).toLocaleString()} ${currency}`, color: '#dc2626', bg: '#fef2f2' },
      { label: 'صافي كاش الخزينة / الصندوق', value: `${dailyNetCashRegister.toLocaleString()} ${currency}`, color: '#7c3aed', bg: '#f5f3ff' }
    ];

    try {
      await generateAndSharePDF({
        title: 'كشف التقفيل والحركة اليومية والمبيعات',
        storeName: storeName || 'سند المحاسبي',
        invoiceNumber: `يومية-${new Date().toISOString().slice(0, 10)}`,
        customerName: 'إدارة المبيعات والرقابة المالية',
        phone: '',
        date: new Date().toLocaleDateString('ar-YE') + ' ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: `تقرير تفصيلي لفترة: ${periodName}`,
        orientation: 'p',
        customColumns,
        customRows,
        summaryBoxes,
        subtotal: `المبيعات النقدية: ${dailyCashSales.toLocaleString()} ${currency} | الآجلة: ${dailyDebtSales.toLocaleString()} ${currency}`,
        discount: `المصروفات: ${dailyExpenses.toLocaleString()} ${currency}`,
        totalAmount: `صافي اليومية: ${dailyNetCashRegister.toLocaleString()} ${currency}`,
        notes: `كشف تقفيل حركة المبيعات والصندوق لـ ${periodName}. عدد الفواتير: ${dailyActiveInvoices.length} فاتورة، وإجمالي القطع المباعة: ${totalSoldPieces} قطعة.`,
        footerNote: '✨ نظام سند المحاسبي - تقرير تقفيل المبيعات والنشاط اليومي'
      });
    } catch (e) {
      console.error('Daily PDF export failed:', e);
    }
  };

  // Export Daily Movement as Excel
  const handleExportDailyExcel = async () => {
    soundManager.playSuccessChime();

    const data: Record<string, string | number>[] = dailySoldItems.map((item, idx) => ({
      'م': idx + 1,
      'الصنف': item.name,
      'الكمية المباعة': item.quantity,
      'إجمالي المبلغ': item.total,
      'العملة': currency
    }));

    data.push({
      'م': 'الإجمالي',
      'الصنف': `عدد الأصناف: ${dailySoldItems.length}`,
      'الكمية المباعة': totalSoldPieces,
      'إجمالي المبلغ': dailyTotalSales,
      'العملة': currency
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 16 }, { wch: 18 }, { wch: 10 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'مبيعات اليومية والأصناف');

    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const fileName = `تقفيل_المبيعات_اليومية_${new Date().toISOString().split('T')[0]}.xlsx`;

    await saveAndShareFile({
      fileName,
      data: excelBase64,
      isBase64: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'كشف المبيعات اليومية Excel',
      text: `تقرير المبيعات والحركة اليومية من نظام سند المحاسبي`
    });
  };

  // Export Ledger as Excel
  const handleExportLedgerExcel = async () => {
    soundManager.playSuccessChime();

    const data: Record<string, string | number>[] = filteredTransactions.map((t, index) => {
      const typeLabel = 
        isPurchaseInvoiceTx(t) ? 'فاتورة مشتريات' :
        t.type === 'sale' ? 'سند مبيعات' :
        t.type === 'payment' ? 'سند قبض / تحصيل' :
        t.type === 'expense' ? 'سند صرف / مصروف' :
        t.type === 'refund' ? 'سند مرتجع' : 'سند صيانة';

      const isExpenseOrRefund = t.type === 'expense' || t.type === 'refund';
      const inflow = !isExpenseOrRefund ? t.amount : 0;
      const outflow = isExpenseOrRefund ? t.amount : 0;
      const net = !isExpenseOrRefund ? t.amount : -t.amount;
      const methodLabel = formatPaymentMethodLabel(t.paymentMethod);

      return {
        'م': index + 1,
        'رقم السند / المرجع': t.referenceNumber || t.id.slice(0, 8),
        'التاريخ والوقت': new Date(t.date).toLocaleString('ar-YE'),
        'نوع السند': typeLabel,
        'البيان والتفاصيل': t.description || '',
        'طريقة الدفع': methodLabel,
        'المقبوضات (+)': inflow,
        'المدفوعات (-)': outflow,
        'التأثير المالي الصافي': net
      };
    });

    const totalInflow = filteredTransactions
      .filter(t => t.type !== 'expense' && t.type !== 'refund')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalOutflow = filteredTransactions
      .filter(t => t.type === 'expense' || t.type === 'refund')
      .reduce((sum, t) => sum + t.amount, 0);

    data.push({
      'م': 'الإجمالي',
      'رقم السند / المرجع': `عدد السندات: ${filteredTransactions.length}`,
      'التاريخ والوقت': '-',
      'نوع السند': '-',
      'البيان والتفاصيل': 'إجمالي السندات والقيود المحددة',
      'طريقة الدفع': '-',
      'المقبوضات (+)': totalInflow,
      'المدفوعات (-)': totalOutflow,
      'التأثير المالي الصافي': totalInflow - totalOutflow
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 34 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'دفتر السندات والقيود');

    const excelBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const fileName = `دفتر_السندات_والحركات_${new Date().toISOString().split('T')[0]}.xlsx`;

    await saveAndShareFile({
      fileName,
      data: excelBase64,
      isBase64: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      title: 'دفتر السندات المالية Excel',
      text: `دفتر السندات والقيود المالية من تطبيق سند المحاسبي`
    });
  };

  // Export Ledger as PDF
  const handleExportLedgerPDF = async () => {
    soundManager.playScanBeep();

    const inflowTotal = totalSales + totalPayments + totalMaintenance;
    const outflowTotal = totalExpenses + totalRefunds;

    const customColumns = [
      { key: 'index', label: 'م', width: '35px', align: 'center' as const },
      { key: 'ref', label: 'رقم السند', width: '85px', align: 'center' as const },
      { key: 'dateTime', label: 'التاريخ والوقت', width: '115px', align: 'center' as const },
      { key: 'type', label: 'نوع السند', width: '85px', align: 'center' as const },
      { key: 'description', label: 'البيان والتفاصيل', align: 'right' as const },
      { key: 'method', label: 'طريقة الدفع', width: '85px', align: 'center' as const },
      { key: 'inflow', label: 'مقبوضات (+)', width: '90px', align: 'center' as const },
      { key: 'outflow', label: 'مدفوعات (-)', width: '90px', align: 'center' as const }
    ];

    const customRows: Record<string, string | number>[] = filteredTransactions.map((t, idx) => {
      const typeLabel = 
        isPurchaseInvoiceTx(t) ? 'فاتورة مشتريات' :
        t.type === 'expense' ? 'سند صرف' :
        t.type === 'refund' ? 'سند مرتجع' :
        t.type === 'payment' ? 'سند قبض' :
        t.type === 'maintenance_income' ? 'سند صيانة' : 'سند مبيعات';

      const isOut = t.type === 'expense' || t.type === 'refund';
      const methodLabel = formatPaymentMethodLabel(t.paymentMethod);

      return {
        index: idx + 1,
        ref: t.referenceNumber || t.id.slice(0, 8),
        dateTime: new Date(t.date).toLocaleDateString('ar-YE') + ' ' + new Date(t.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        type: typeLabel,
        description: t.description || 'حركة مالية',
        method: methodLabel,
        inflow: !isOut ? `${t.amount.toLocaleString()} ${currency}` : '-',
        outflow: isOut ? `${t.amount.toLocaleString()} ${currency}` : '-'
      };
    });

    customRows.push({
      index: 'الإجمالي',
      ref: `السندات: ${filteredTransactions.length}`,
      dateTime: '—',
      type: '—',
      description: `صافي سيولة الخزينة: ${netCashFlow.toLocaleString()} ${currency}`,
      method: '—',
      inflow: `${inflowTotal.toLocaleString()} ${currency}`,
      outflow: `${outflowTotal.toLocaleString()} ${currency}`
    });

    const summaryBoxes = [
      { label: 'إجمالي المقبوضات (+)', value: `${inflowTotal.toLocaleString()} ${currency}`, color: '#059669', bg: '#ecfdf5' },
      { label: 'إجمالي المصاريف والمرتجع (-)', value: `${outflowTotal.toLocaleString()} ${currency}`, color: '#dc2626', bg: '#fef2f2' },
      { label: 'صافي سيولة الصندوق', value: `${netCashFlow.toLocaleString()} ${currency}`, color: '#0284c7', bg: '#f0f9ff' },
      { label: 'عدد السندات المقيدة', value: `${filteredTransactions.length} سند مالي`, color: '#6366f1', bg: '#eef2ff' }
    ];

    try {
      await generateAndSharePDF({
        title: 'كشف السندات وحركة الصندوق والخزينة العامة',
        storeName: storeName || 'سند المحاسبي',
        invoiceNumber: `صندوق-${new Date().toISOString().slice(0, 10)}`,
        customerName: 'إدارة الرقابة المالية والمراجعة الحسابية',
        phone: '',
        date: new Date().toLocaleDateString('ar-YE') + ' ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: `كشف تفصيلي لكافة السندات النقدية والإلكترونية`,
        orientation: 'p',
        customColumns,
        customRows,
        summaryBoxes,
        subtotal: `المقبوضات: ${inflowTotal.toLocaleString()} ${currency}`,
        discount: `المصاريف: ${outflowTotal.toLocaleString()} ${currency}`,
        totalAmount: `${netCashFlow.toLocaleString()} ${currency}`,
        notes: `كشف حركة الخزينة والسندات لكافة المقبوضات والمدفوعات المسجلة.`,
        footerNote: '✨ كشف السندات وحركة الصندوق اليومية - نظام سند المحاسبي'
      });
    } catch (e) {
      console.error('PDF export failed:', e);
    }
  };

  // Filtered purchase items inside Purchase Invoice Modal
  const filteredModalPurchaseItems = useMemo(() => {
    if (!purchaseItemSearch.trim()) return purchaseItemsList.map((item, idx) => ({ item, originalIndex: idx }));
    const q = purchaseItemSearch.toLowerCase();
    return purchaseItemsList
      .map((item, idx) => ({ item, originalIndex: idx }))
      .filter(({ item }) => item.name.toLowerCase().includes(q) || (item.barcode || '').toLowerCase().includes(q));
  }, [purchaseItemsList, purchaseItemSearch]);

  return (
    <div id="transactions_tab_view" className="space-y-5 pb-28">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {refundSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl flex items-center justify-between gap-3 border border-emerald-500"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />
              <span>{refundSuccessToast}</span>
            </div>
            <button onClick={() => setRefundSuccessToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. TOP STATS BAR & VOUCHER ACTION BUTTONS (سند قبض + سند مصروف) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <span>إدارة السندات والحركة المالية واليومية العامة</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400">
              التحكم الكامل في سندات القبض، سندات الصرف والمصروفات، فواتير المشتريات وأصنافها، وأرشيف الفواتير
            </p>
          </div>

          {/* Primary Action Buttons: Add Receipt Voucher BESIDE Add Expense Voucher */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2.5">
            <button
              id="btn_add_receipt_voucher_main"
              onClick={() => {
                soundManager.playScanBeep();
                setReceiptRefNumber(`RV-${Math.floor(1000 + Math.random() * 9000)}`);
                setShowReceiptModal(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4 shrink-0" />
              <span>+ إضافة سند قبض</span>
            </button>

            <button
              id="btn_add_expense_main"
              onClick={() => {
                soundManager.playScanBeep();
                setExpenseRefNumber(`PV-${Math.floor(1000 + Math.random() * 9000)}`);
                setShowExpenseModal(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-md shadow-rose-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 shrink-0" />
              <span>+ تسجيل سند مصروف</span>
            </button>
          </div>
        </div>
        
        {/* Quick KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 flex sm:block justify-between items-center">
            <div className="text-slate-600 text-[11px] font-bold">إجمالي سندات القبض والمبيعات (+)</div>
            <div className="font-black text-emerald-600 mt-0.5 sm:mt-1 font-mono text-sm sm:text-base">{fmt(totalSales + totalPayments + totalMaintenance)}</div>
          </div>
          <div className="p-3 sm:p-3.5 rounded-xl bg-rose-50 border border-rose-100 flex sm:block justify-between items-center">
            <div className="text-slate-600 text-[11px] font-bold">سندات الصرف والمشتريات والمرتجع (-)</div>
            <div className="font-black text-rose-600 mt-0.5 sm:mt-1 font-mono text-sm sm:text-base">{fmt(totalExpenses + totalRefunds)}</div>
          </div>
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900 text-white flex justify-between items-center shadow-inner">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">صافي السيولة الإجمالية بالصندوق:</span>
              <span className="text-sm sm:text-base font-black text-emerald-400 font-mono dir-ltr">{fmt(netCashFlow)}</span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-TABS NAVIGATION HEADER */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1.5 overflow-x-auto">
        <button
          id="subtab_ledger"
          onClick={() => {
            soundManager.playScanBeep();
            setSubTab('ledger');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
            subTab === 'ledger'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>📒 دفتر السندات والقيود المالية</span>
          <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-bold ${
            subTab === 'ledger' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {transactions.length}
          </span>
        </button>

        <button
          id="subtab_daily"
          onClick={() => {
            soundManager.playScanBeep();
            setSubTab('daily');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
            subTab === 'daily'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>📊 الحركة والتقفيل اليومي</span>
          <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-bold ${
            subTab === 'daily' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
          }`}>
            اليوم ⚡
          </span>
        </button>

        <button
          id="subtab_invoices"
          onClick={() => {
            soundManager.playScanBeep();
            setSubTab('invoices');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
            subTab === 'invoices'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>📑 أرشيف الفواتير والمرتجعات</span>
          <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-bold ${
            subTab === 'invoices' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {invoices.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 🌟 SUB-TAB 1: DAILY MOVEMENT & SALES (الحركة والتقفيل اليومي) */}
      {/* ========================================================================= */}
      {subTab === 'daily' && (
        <div className="space-y-4">
          
          {/* Smart Date Filter Bar */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>الفترة:</span>
              </span>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('today'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === 'today'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                اليوم
              </button>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('yesterday'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === 'yesterday'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                أمس
              </button>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('7days'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === '7days'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                آخر 7 أيام
              </button>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('this_month'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === 'this_month'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                هذا الشهر
              </button>

              <button
                onClick={() => { soundManager.playScanBeep(); setDailyFilterMode('custom'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                  dailyFilterMode === 'custom'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                تاريخ مخصص 📅
              </button>
            </div>

            {/* Custom Date Picker & Quick Actions */}
            <div className="flex items-center gap-2 justify-end flex-wrap">
              {dailyFilterMode === 'custom' && (
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                  <input
                    type="date"
                    value={selectedCustomDate}
                    onChange={(e) => setSelectedCustomDate(e.target.value)}
                    className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
                  />
                </div>
              )}

              <button
                onClick={handleExportDailyPDF}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="تصدير كشف التقفيل اليومي PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>تقفيل PDF</span>
              </button>

              <button
                onClick={handleExportDailyExcel}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="تصدير شيت إكسل للمبيعات اليومية"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>إكسل</span>
              </button>

              <button
                onClick={handleShareDailyWhatsApp}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm active:scale-95 transition flex items-center gap-1 cursor-pointer"
                title="مشاركة ملخص اليومية عبر واتساب"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>واتساب</span>
              </button>
            </div>
          </div>

          {/* Daily KPI Dashboard Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-emerald-800 block">إجمالي المبيعات</span>
              <span className="text-sm sm:text-base font-black text-emerald-700 font-mono block mt-1 dir-ltr">{fmt(dailyTotalSales)}</span>
              <div className="text-[9.5px] text-emerald-600 font-bold mt-1 flex justify-between">
                <span>كاش: {dailyCashSales.toLocaleString()}</span>
                <span>آجل: {dailyDebtSales.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-blue-800 block">سندات القبض (+)</span>
              <span className="text-sm sm:text-base font-black text-blue-700 font-mono block mt-1 dir-ltr">{fmt(dailyDebtPayments)}</span>
              <span className="text-[9.5px] text-blue-600 font-bold block mt-1">تحصيل ومقبوضات</span>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-indigo-800 block">إيراد الصيانة (+)</span>
              <span className="text-sm sm:text-base font-black text-indigo-700 font-mono block mt-1 dir-ltr">{fmt(dailyMaintenanceIncome)}</span>
              <span className="text-[9.5px] text-indigo-600 font-bold block mt-1">خدمات وأجهزة</span>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-rose-800 block">سندات الصرف (-)</span>
              <span className="text-sm sm:text-base font-black text-rose-700 font-mono block mt-1 dir-ltr">{fmt(dailyExpenses)}</span>
              <span className="text-[9.5px] text-rose-600 font-bold block mt-1">مصاريف ومشتريات</span>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-xs">
              <span className="text-[10.5px] font-bold text-amber-800 block">المرتجعات (-)</span>
              <span className="text-sm sm:text-base font-black text-amber-700 font-mono block mt-1 dir-ltr">{fmt(dailyRefunds)}</span>
              <span className="text-[9.5px] text-amber-600 font-bold block mt-1">{dailyRefundedInvoices.length} فاتورة مرتجعة</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900 text-white shadow-md flex flex-col justify-between">
              <span className="text-[10.5px] font-bold text-slate-300 block">صافي الصندوق:</span>
              <span className="text-sm sm:text-base font-black text-emerald-400 font-mono block mt-1 dir-ltr">{fmt(dailyNetCashRegister)}</span>
              <div className="text-[9.5px] text-slate-400 font-bold mt-1">
                {dailyActiveInvoices.length} فواتير | {totalSoldPieces} قطعة
              </div>
            </div>
          </div>

          {/* Payment Methods Breakdown for Selected Daily Period */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-blue-600" />
              <span>توزيع حركة اليوم حسب طرق الدفع والقنوات المالية:</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).map((key) => {
                const meta = PAYMENT_METHODS[key];
                const total = getDailyMethodTotal(key);
                return (
                  <div key={key} className={`p-2.5 rounded-xl border ${meta.bgLightClass} ${meta.borderClass} flex flex-col justify-between`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{meta.emoji}</span>
                      <span className="text-[10px] font-bold text-slate-600">{meta.shortLabel}</span>
                    </div>
                    <div className={`text-xs font-black font-mono mt-1 ${meta.colorClass}`}>
                      {fmt(total)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Two-Column Grid: 1. Sold Items Today / 2. Today's Invoices List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">الأصناف والسلع المباعة</h4>
                    <p className="text-[10px] text-slate-400">حصر الكميات المنصرفة من المستودع</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {dailySoldItems.length} صنف ({totalSoldPieces} قطعة)
                </span>
              </div>

              {dailySoldItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Package className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">لا توجد مبيعات أصناف مسجلة خلال الفترة المحددة</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-slate-400 text-[11px] border-b border-slate-100 bg-slate-50/70">
                        <th className="py-2 px-2 font-bold">الصنف</th>
                        <th className="py-2 px-2 font-bold text-center">الكمية</th>
                        <th className="py-2 px-2 font-bold text-left">الإيراد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailySoldItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-2 font-bold text-slate-800">
                            <span>{item.name}</span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-blue-600">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-2 text-left font-mono font-bold text-emerald-600">
                            {item.total.toLocaleString()} {currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">سجل فواتير المبيعات</h4>
                    <p className="text-[10px] text-slate-400">الفواتير المنفذة والمرتجعة بالفترة</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {dailyInvoices.length} فاتورة
                </span>
              </div>

              {dailyInvoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">لا توجد فواتير مبيعات مسجلة في هذه الفترة</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-slate-400 text-[11px] border-b border-slate-100 bg-slate-50/70">
                        <th className="py-2 px-2 font-bold">الفاتورة والعميل</th>
                        <th className="py-2 px-2 font-bold text-center">النوع</th>
                        <th className="py-2 px-2 font-bold text-center">المبلغ</th>
                        <th className="py-2 px-2 font-bold text-left">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-2">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <span>#{inv.invoiceNumber}</span>
                              {inv.status === 'refunded' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-extrabold">
                                  مرتجعة 🔄
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">{inv.customerName || 'عميل نقدي'}</div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              inv.type === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {inv.type === 'cash' ? 'كاش' : 'دين'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-blue-600">
                            {inv.finalAmount.toLocaleString()} {currency}
                          </td>
                          <td className="py-2 px-2 text-left">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onViewInvoice(inv)}
                                className="p-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                                title="عرض ومعاينة الفاتورة"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {inv.status !== 'refunded' && (
                                <button
                                  onClick={() => {
                                    soundManager.playWarningBeep();
                                    setRefundConfirmInvoice(inv);
                                  }}
                                  className="p-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                  title="استرجاع الفاتورة بالكامل وإعادة الأصناف للمخزن"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 📒 SUB-TAB 2: FINANCIAL LEDGER & VOUCHERS CONTROL (دفتر السندات والقيود) */}
      {/* ========================================================================= */}
      {subTab === 'ledger' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          
          {/* Quick Voucher Category Filter Pills (التحكم في جميع السندات بشتى أنواعها) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'جميع السندات والقيود', count: transactions.length, color: 'blue' },
              { id: 'payment', label: '📥 سندات القبض والتحصيل', count: transactions.filter(t => t.type === 'payment').length, color: 'emerald' },
              { id: 'expense', label: '📤 سندات الصرف والمصروفات', count: transactions.filter(t => t.type === 'expense').length, color: 'rose' },
              { id: 'purchase', label: '📦 فواتير المشتريات والأصناف', count: transactions.filter(t => isPurchaseInvoiceTx(t)).length, color: 'amber' },
              { id: 'sale', label: '🛒 سندات المبيعات', count: transactions.filter(t => t.type === 'sale').length, color: 'teal' },
              { id: 'maintenance_income', label: '🔧 سندات الصيانة', count: transactions.filter(t => t.type === 'maintenance_income').length, color: 'indigo' },
              { id: 'refund', label: '🔄 سندات المرتجع', count: transactions.filter(t => t.type === 'refund').length, color: 'orange' },
            ].map(tab => {
              const active = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    soundManager.playScanBeep();
                    setFilterType(tab.id as any);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm font-black'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    active ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث في البيان، رقم السند، اسم المورد/العميل، أو رقم الفاتورة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">جميع أنواع السندات</option>
                <option value="payment">سندات القبض والتحصيل</option>
                <option value="expense">سندات الصرف والمصروفات</option>
                <option value="purchase">فواتير المشتريات المقيدة</option>
                <option value="sale">سندات المبيعات</option>
                <option value="maintenance_income">سندات إيراد الصيانة</option>
                <option value="refund">سندات مرتجع المبيعات</option>
              </select>

              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">جميع طرق الدفع</option>
                {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).map(k => (
                  <option key={k} value={k}>{PAYMENT_METHODS[k].label}</option>
                ))}
              </select>

              <button
                onClick={() => setShowLedgerColPicker(!showLedgerColPicker)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                title="تخصيص أعمدة الجدول"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              <button
                onClick={handleExportLedgerPDF}
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                title="تصدير كشف PDF"
              >
                <FileText className="w-4 h-4 text-rose-600" />
              </button>

              <button
                onClick={handleExportLedgerExcel}
                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                title="تصدير إكسل Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              </button>
            </div>
          </div>

          {/* Column Visibility Picker Drawer */}
          {showLedgerColPicker && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-4 flex-wrap text-xs font-bold text-slate-700">
              <span className="text-slate-400">إظهار الأعمدة:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLedgerCols.date}
                  onChange={(e) => setVisibleLedgerCols({ ...visibleLedgerCols, date: e.target.checked })}
                />
                <span>التاريخ والوقت</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLedgerCols.typeAndMethod}
                  onChange={(e) => setVisibleLedgerCols({ ...visibleLedgerCols, typeAndMethod: e.target.checked })}
                />
                <span>النوع وطريقة الدفع</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLedgerCols.description}
                  onChange={(e) => setVisibleLedgerCols({ ...visibleLedgerCols, description: e.target.checked })}
                />
                <span>البيان والشرح</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLedgerCols.amount}
                  onChange={(e) => setVisibleLedgerCols({ ...visibleLedgerCols, amount: e.target.checked })}
                />
                <span>المبلغ والتأثير</span>
              </label>
            </div>
          )}

          {/* Transactions & Vouchers Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 text-[11px] border-b border-slate-100 bg-slate-50/70">
                  {visibleLedgerCols.date && <th className="py-2.5 px-3 font-bold">التاريخ والوقت</th>}
                  {visibleLedgerCols.typeAndMethod && <th className="py-2.5 px-3 font-bold text-center">نوع السند / السداد</th>}
                  {visibleLedgerCols.description && <th className="py-2.5 px-3 font-bold">البيان والتحكم السريع</th>}
                  {visibleLedgerCols.amount && <th className="py-2.5 px-3 font-bold text-left">المبلغ والتأثير</th>}
                  {visibleLedgerCols.actions && <th className="py-2.5 px-3 font-bold text-center">التحكم بالسند</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold">لا توجد سندات أو قيود تطابق معايير البحث</p>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => {
                    const isExpenseOrRefund = t.type === 'expense' || t.type === 'refund';
                    const methodLabel = formatPaymentMethodLabel(t.paymentMethod);
                    const isPurchase = isPurchaseInvoiceTx(t);
                    const purchaseItemsCount = isPurchase ? resolvePurchaseItemsForTx(t).length : 0;

                    return (
                      <tr key={t.id} className={`hover:bg-slate-50/90 transition ${isPurchase ? 'bg-amber-50/20' : ''}`}>
                        {visibleLedgerCols.date && (
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap align-top">
                            <div>{new Date(t.date).toLocaleDateString('ar-YE')}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(t.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                        )}
                        {visibleLedgerCols.typeAndMethod && (
                          <td className="py-3 px-3 text-center align-top">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap ${
                                isPurchase ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                t.type === 'sale' ? 'bg-emerald-100 text-emerald-700' :
                                t.type === 'payment' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                                t.type === 'maintenance_income' ? 'bg-indigo-100 text-indigo-700' :
                                t.type === 'refund' ? 'bg-orange-100 text-orange-800' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {isPurchase ? '📦 فاتورة مشتريات' :
                                 t.type === 'sale' ? '🛒 سند مبيعات' :
                                 t.type === 'payment' ? '📥 سند قبض' :
                                 t.type === 'maintenance_income' ? '🔧 سند صيانة' :
                                 t.type === 'refund' ? '🔄 سند مرتجع' : '📤 سند صرف / مصروف'}
                              </span>
                              <span className="text-[9.5px] text-slate-400 font-medium">{methodLabel}</span>
                            </div>
                          </td>
                        )}
                        {visibleLedgerCols.description && (
                          <td className="py-3 px-3 font-bold text-slate-800 align-top">
                            <div className="text-xs text-slate-900 leading-relaxed break-words max-w-md">
                              {t.description || 'حركة مالية'}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {t.referenceNumber && (
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                                  مرجع: #{t.referenceNumber}
                                </span>
                              )}
                              {t.payerOrBeneficiary && (
                                <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                  الجهة: {t.payerOrBeneficiary}
                                </span>
                              )}
                            </div>

                            {/* Inline Quick Control Bar (Always visible on mobile & desktop without horizontal scrolling!) */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {isPurchase && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPurchaseInvoiceModal(t)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-[10.5px] shadow-xs flex items-center gap-1 transition cursor-pointer active:scale-95"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  <span>عرض وتعديل الأصناف ({purchaseItemsCount} صنف)</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  soundManager.playScanBeep();
                                  setViewingVoucherTx(t);
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                                title="معاينة وطباعة السند"
                              >
                                <Eye className="w-3 h-3 text-blue-600" />
                                <span>معاينة / طباعة</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditVoucher(t)}
                                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                                title="تعديل السند"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>تعديل السند</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  soundManager.playWarningBeep();
                                  setDeletingVoucherTx(t);
                                  setDeleteRevertInventory(true);
                                  setDeleteRevertCustomerDebt(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                                title="حذف السند"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>حذف</span>
                              </button>
                            </div>
                          </td>
                        )}
                        {visibleLedgerCols.amount && (
                          <td className="py-3 px-3 text-left font-mono font-bold align-top whitespace-nowrap">
                            <span className={`text-xs sm:text-sm font-black ${isExpenseOrRefund ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {isExpenseOrRefund ? '-' : '+'}{t.amount.toLocaleString()} {currency}
                            </span>
                          </td>
                        )}
                        {visibleLedgerCols.actions && (
                          <td className="py-3 px-3 text-center align-top">
                            <div className="flex items-center justify-center gap-1">
                              {isPurchase && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPurchaseInvoiceModal(t)}
                                  className="p-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition cursor-pointer"
                                  title="استعراض وتعديل وحذف أصناف فاتورة المشتريات"
                                >
                                  <Package className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  soundManager.playScanBeep();
                                  setViewingVoucherTx(t);
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                                title="معاينة وطباعة السند"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditVoucher(t)}
                                className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                                title="تعديل السند"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  soundManager.playWarningBeep();
                                  setDeletingVoucherTx(t);
                                  setDeleteRevertInventory(true);
                                  setDeleteRevertCustomerDebt(true);
                                }}
                                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                title="حذف السند"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📑 SUB-TAB 3: INVOICES & RETURNS ARCHIVE (أرشيف الفواتير والمرتجعات) */}
      {/* ========================================================================= */}
      {subTab === 'invoices' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث برقم الفاتورة، اسم العميل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">جميع الفواتير</option>
                <option value="active">الفواتير النشطة فقط</option>
                <option value="refunded">الفواتير المرتجعة فقط</option>
              </select>

              <button
                onClick={() => setShowInvoiceColPicker(!showInvoiceColPicker)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                title="تخصيص أعمدة الجدول"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="text-slate-400 text-[11px] border-b border-slate-100 bg-slate-50/70">
                  <th className="py-2.5 px-3 font-bold">رقم الفاتورة</th>
                  <th className="py-2.5 px-3 font-bold">العميل والتاريخ</th>
                  <th className="py-2.5 px-3 font-bold text-center">طريقة الدفع</th>
                  <th className="py-2.5 px-3 font-bold text-center">المبلغ الإجمالي</th>
                  <th className="py-2.5 px-3 font-bold text-center">حالة الفاتورة</th>
                  <th className="py-2.5 px-3 font-bold text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold">لا توجد فواتير تطابق شروط البحث</p>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-bold font-mono text-blue-600">
                        #{inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{inv.customerName || 'عميل نقدي'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {new Date(inv.date).toLocaleDateString('ar-YE')} {new Date(inv.date).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.type === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {inv.type === 'cash' ? 'نقداً (كاش)' : 'آجل (دين)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                        {inv.finalAmount.toLocaleString()} {currency}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {inv.status === 'refunded' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                            مسترجعة 🔄
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            مكتملة نشطة ✅
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.proofImage && (
                            <button
                              type="button"
                              onClick={() => setProofModalImage(inv.proofImage!)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold border border-emerald-200 text-[10px] flex items-center gap-1 transition cursor-pointer"
                              title="عرض صورة السند"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                              <span>السند</span>
                            </button>
                          )}

                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 transition text-[10px] flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> عرض
                          </button>

                          {inv.status !== 'refunded' && (
                            <button
                              onClick={() => {
                                soundManager.playWarningBeep();
                                setRefundConfirmInvoice(inv);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 border border-rose-200 transition text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              <Undo2 className="w-3.5 h-3.5" /> استرجاع
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📦 MODAL 1: PURCHASE INVOICE ITEMS VIEWER & EDITOR (إدارة أصناف فاتورة المشتريات المقيدة في المصروف) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editingPurchaseTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-5xl max-h-[94vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-right text-slate-900 z-10"
            >
              {/* Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black shadow-md">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                      <span>أصناف فاتورة المشتريات المقيدة في المصروف</span>
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 font-mono">
                        #{purchaseInvoiceNum || editingPurchaseTx.id.slice(0, 8)}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      استعراض الأصناف المضافة في الفاتورة مع إمكانية تعديل أسعارها وكمياتها أو حذفها من حساب المصروف والمخزن
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingPurchaseTx(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Invoice Metadata & Quick Controls */}
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-1">رقم فاتورة المشتريات:</label>
                    <input
                      type="text"
                      value={purchaseInvoiceNum}
                      onChange={(e) => setPurchaseInvoiceNum(e.target.value)}
                      placeholder="مثال: 49755"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-1">اسم المورد / التاجر:</label>
                    <input
                      type="text"
                      value={purchaseSupplierName}
                      onChange={(e) => setPurchaseSupplierName(e.target.value)}
                      placeholder="اسم المورد أو الشركة..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-1">طريقة سداد الفاتورة:</label>
                    <select
                      value={purchasePaymentMethod}
                      onChange={(e) => setPurchasePaymentMethod(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).map(k => (
                        <option key={k} value={k}>{PAYMENT_METHODS[k].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 flex items-center justify-between mb-1">
                      <span>إجمالي المصروف المقيد:</span>
                      <label className="flex items-center gap-1 text-[10px] text-blue-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useCustomPurchaseTotal}
                          onChange={(e) => {
                            setUseCustomPurchaseTotal(e.target.checked);
                            if (!e.target.checked) setCustomPurchaseTotal(calculatedPurchaseItemsSum);
                          }}
                        />
                        <span>تعديل يدوي</span>
                      </label>
                    </label>
                    <input
                      type="number"
                      disabled={!useCustomPurchaseTotal}
                      value={useCustomPurchaseTotal ? customPurchaseTotal : calculatedPurchaseItemsSum}
                      onChange={(e) => setCustomPurchaseTotal(Math.max(0, parseFloat(e.target.value) || 0))}
                      className={`w-full border rounded-xl px-3 py-1.5 font-mono font-black text-rose-700 ${
                        useCustomPurchaseTotal ? 'bg-white border-rose-400' : 'bg-rose-50 border-rose-200'
                      }`}
                    />
                  </div>
                </div>

                {/* Search & Add Item Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={purchaseItemSearch}
                      onChange={(e) => setPurchaseItemSearch(e.target.value)}
                      placeholder="بحث في أصناف الفاتورة بالاسم أو الباركود..."
                      className="w-full bg-white border border-slate-300 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAddNewRowToPurchaseInvoice}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة صنف جديد للفاتورة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowLinkInventoryPicker(!showLinkInventoryPicker)}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5 text-slate-700" />
                      <span>ربط صنف من المخزن</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrintVoucher(editingPurchaseTx)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة الفاتورة</span>
                    </button>
                  </div>
                </div>

                {/* Optional Inventory Product Linker Drawer */}
                {showLinkInventoryPicker && (
                  <div className="p-2.5 rounded-xl bg-white border border-blue-200 max-h-40 overflow-y-auto space-y-1.5">
                    <div className="text-[11px] font-bold text-blue-800 mb-1">اختر صنفاً من المخزن لإضافته إلى هذه الفاتورة:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                      {products.filter(p => !p.isDeleted && !purchaseItemsList.some(it => it.productId === p.id)).map(prod => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleLinkProductToPurchaseInvoice(prod)}
                          className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-right flex items-center justify-between text-[11px] font-bold transition cursor-pointer"
                        >
                          <span className="truncate">{prod.name}</span>
                          <span className="text-[10px] font-mono text-blue-600 shrink-0">+{prod.stock}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Items Table Body */}
              <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3">
                {filteredModalPurchaseItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Package className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">لا توجد أصناف مطابقة في هذه الفاتورة</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 text-center w-9">#</th>
                          <th className="p-2.5 min-w-[180px]">اسم الصنف</th>
                          <th className="p-2.5 min-w-[125px]">الباركود</th>
                          <th className="p-2.5 min-w-[85px] text-center">الكمية</th>
                          <th className="p-2.5 min-w-[105px] text-center">سعر الشراء (التكلفة)</th>
                          <th className="p-2.5 min-w-[105px] text-center">سعر البيع</th>
                          <th className="p-2.5 min-w-[110px] text-left">إجمالي التكلفة</th>
                          <th className="p-2.5 text-center w-24">حذف من المصروف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredModalPurchaseItems.map(({ item, originalIndex }, idx) => (
                          <tr key={item.productId || originalIndex} className="hover:bg-amber-50/40 transition">
                            <td className="p-2 text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdatePurchaseItemRow(originalIndex, 'name', e.target.value)}
                                placeholder="اسم الصنف..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.barcode}
                                onChange={(e) => handleUpdatePurchaseItemRow(originalIndex, 'barcode', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-[11px] text-slate-700 focus:bg-white focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={item.quantity}
                                onChange={(e) => handleUpdatePurchaseItemRow(originalIndex, 'quantity', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-blue-50/60 border border-blue-200 rounded-lg px-2 py-1.5 font-mono font-black text-center text-blue-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.costPrice}
                                onChange={(e) => handleUpdatePurchaseItemRow(originalIndex, 'costPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-amber-50/70 border border-amber-200 rounded-lg px-2 py-1.5 font-mono font-black text-center text-amber-900 focus:bg-white focus:ring-1 focus:ring-amber-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.sellingPrice}
                                onChange={(e) => handleUpdatePurchaseItemRow(originalIndex, 'sellingPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-emerald-50/70 border border-emerald-200 rounded-lg px-2 py-1.5 font-mono font-black text-center text-emerald-800 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="p-2 text-left font-mono font-black text-rose-700 whitespace-nowrap">
                              {((Number(item.costPrice) || 0) * (Number(item.quantity) || 0)).toLocaleString()} {currency}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePurchaseItemRow(originalIndex, true)}
                                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white font-bold text-[10px] transition flex items-center gap-1 cursor-pointer"
                                  title="حذف الصنف من الفاتورة وحساب المصروف ومن المخزن"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>حذف</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Deleted Items Staging Area (with Undo & Stock option) */}
                {deletedPurchaseItems.length > 0 && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                    <div className="text-xs font-black text-rose-800 flex items-center justify-between">
                      <span>🗑️ أصناف تم تحديدها للحذف من الفاتورة وحساب المصروف ({deletedPurchaseItems.length}):</span>
                      <span className="text-[10px] text-rose-600">سيتم خصم قيمتها من المصروف وحذفها عند الضغط على حفظ</span>
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {deletedPurchaseItems.map((del, dIdx) => (
                        <div key={dIdx} className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 rounded-xl border border-rose-200 text-xs">
                          <div className="font-bold text-slate-800">
                            <span>{del.item.name}</span>
                            <span className="text-rose-600 font-mono mr-2">(-{del.item.total.toLocaleString()} {currency})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-[10.5px] font-bold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={del.deleteProductCompletely}
                                onChange={(e) => {
                                  setDeletedPurchaseItems(prev => prev.map((it, i) => i === dIdx ? { ...it, deleteProductCompletely: e.target.checked } : it));
                                }}
                              />
                              <span>حذف الصنف نهائياً من المخزن</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleUndoRemovePurchaseItem(dIdx)}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer"
                            >
                              تراجع ↩️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Summary & Save Button */}
              <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-t border-slate-800 shrink-0">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">عدد الأصناف الحالية: </span>
                    <strong className="text-amber-400 font-mono text-sm">{purchaseItemsList.length} صنف</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">المبلغ السابق بالمصروف: </span>
                    <strong className="text-slate-300 font-mono line-through">{editingPurchaseTx.amount.toLocaleString()} {currency}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">إجمالي المصروف الجديد: </span>
                    <strong className="text-emerald-400 font-mono text-base">
                      {(useCustomPurchaseTotal ? customPurchaseTotal : calculatedPurchaseItemsSum).toLocaleString()} {currency}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setEditingPurchaseTx(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePurchaseInvoiceChanges}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ التعديلات وتحديث المصروف والمخزن</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 📥 MODAL 2: ADD NEW RECEIPT VOUCHER (إضافة سند قبض جديد بجانب سند المصروفات) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showReceiptModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReceiptModal(false)}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[92vh] overflow-y-auto text-right text-slate-900"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

              <div className="flex items-center justify-between border-b border-emerald-100 pb-3 bg-emerald-50/70 p-3 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-sm">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">إصدار سند قبض مالي جديد</h3>
                    <p className="text-[11px] text-emerald-700 font-bold">توريد نقدية أو مقبوضات إلى الصندوق والخزينة (+)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowReceiptModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {receiptError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {receiptError}
                </div>
              )}

              <form onSubmit={handleReceiptSubmit} className="space-y-3.5">
                {/* Receipt Mode Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setReceiptMode('general')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      receiptMode === 'general'
                        ? 'bg-emerald-600 text-white shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📥 سند قبض عام / إيراد
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptMode('customer')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      receiptMode === 'customer'
                        ? 'bg-emerald-600 text-white shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    👤 سند قبض من حساب عميل
                  </button>
                </div>

                {receiptMode === 'customer' ? (
                  <div className="space-y-2 p-3 rounded-2xl bg-blue-50/60 border border-blue-200">
                    <label className="text-xs font-bold text-slate-700 block">اختر العميل المستلم منه:</label>
                    <select
                      value={receiptCustomerId}
                      onChange={(e) => setReceiptCustomerId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- اختر العميل --</option>
                      {customers.filter(c => !c.isDeleted).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} (الدين الحالي: {(c.totalDebt || 0).toLocaleString()} {currency})
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-[11px] font-bold text-blue-900 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={receiptDeductDebt}
                        onChange={(e) => setReceiptDeductDebt(e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span>خصم المبلغ تلقائياً من مديونية العميل المسجلة</span>
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">استلمنا من المكرم / الجهة:</label>
                      <input
                        type="text"
                        value={receiptPayerName}
                        onChange={(e) => setReceiptPayerName(e.target.value)}
                        placeholder="اسم الدافع أو الجهة..."
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">نوع / تصنيف سند القبض:</label>
                      <select
                        value={receiptCategory}
                        onChange={(e) => setReceiptCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="سند قبض عام">سند قبض عام</option>
                        <option value="تغذية الصندوق والخزينة">تغذية الصندوق والخزينة</option>
                        <option value="إيراد خدمات خارجية">إيراد خدمات خارجية</option>
                        <option value="استرداد نقدية من مورد">استرداد نقدية من مورد</option>
                        <option value="تحصيل مبيعات متفرقة">تحصيل مبيعات متفرقة</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">المبلغ المقبوض ({currency}):</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={receiptAmount || ''}
                      onChange={(e) => setReceiptAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="مثال: 15000"
                      className="w-full bg-emerald-50/60 border border-emerald-300 text-sm font-black font-mono rounded-xl px-3.5 py-2.5 text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">رقم سند القبض / المرجع:</label>
                    <input
                      type="text"
                      value={receiptRefNumber}
                      onChange={(e) => setReceiptRefNumber(e.target.value)}
                      placeholder="RV-1001"
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-mono font-bold rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">طريقة القبض / قناة الإيداع:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).filter(k => k !== 'debt').map((methodKey) => {
                      const method = PAYMENT_METHODS[methodKey];
                      const isSelected = receiptPaymentMethod === methodKey;
                      return (
                        <button
                          key={methodKey}
                          type="button"
                          onClick={() => {
                            soundManager.playScanBeep();
                            setReceiptPaymentMethod(methodKey);
                          }}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 justify-center cursor-pointer ${
                            isSelected
                              ? `${method.bgLightClass} ${method.colorClass} ${method.borderClass} ring-2 ring-emerald-500 shadow-sm font-black`
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-sm">{method.emoji}</span>
                          <span className="truncate">{method.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">البيان وذلك مقابل:</label>
                  <input
                    type="text"
                    value={receiptDesc}
                    onChange={(e) => setReceiptDesc(e.target.value)}
                    placeholder="مثال: دفعة نقدية تحت الحساب / إيراد..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وترحيل سند القبض (+)</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* ✏️ MODAL 3: UNIVERSAL VOUCHER EDIT MODAL (التحكم وتعديل أي سند بشتى أنواعه) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editingVoucherTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[92vh] overflow-y-auto text-right text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">تعديل بيانات السند المالي</h3>
                    <p className="text-[11px] text-slate-400">التحكم الكامل بنوع السند، المبلغ، البيان، وطريقة الدفع</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingVoucherTx(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isPurchaseInvoiceTx(editingVoucherTx) && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-amber-900">
                    📦 هذا السند مرتبط بفاتورة مشتريات بضاعة ومخزون
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const target = editingVoucherTx;
                      setEditingVoucherTx(null);
                      handleOpenPurchaseInvoiceModal(target);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shrink-0 cursor-pointer"
                  >
                    تعديل وحذف الأصناف 📦
                  </button>
                </div>
              )}

              <form onSubmit={handleSaveVoucherEdit} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">نوع السند المالي:</label>
                    <select
                      value={editVoucherType}
                      onChange={(e) => setEditVoucherType(e.target.value as Transaction['type'])}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="payment">📥 سند قبض / تحصيل (+)</option>
                      <option value="expense">📤 سند صرف / مصروف (-)</option>
                      <option value="sale">🛒 سند مبيعات (+)</option>
                      <option value="maintenance_income">🔧 سند إيراد صيانة (+)</option>
                      <option value="refund">🔄 سند مرتجع مبيعات (-)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">المبلغ ({currency}):</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={editVoucherAmount}
                      onChange={(e) => setEditVoucherAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-black text-sm text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">رقم السند / المرجع:</label>
                    <input
                      type="text"
                      value={editVoucherRef}
                      onChange={(e) => setEditVoucherRef(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">طريقة الدفع:</label>
                    <select
                      value={editVoucherMethod}
                      onChange={(e) => setEditVoucherMethod(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).map(k => (
                        <option key={k} value={k}>{PAYMENT_METHODS[k].label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">الجهة / المستفيد / الدافع:</label>
                    <input
                      type="text"
                      value={editVoucherParty}
                      onChange={(e) => setEditVoucherParty(e.target.value)}
                      placeholder="اسم العميل أو المورد أو الجهة..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">التاريخ والوقت:</label>
                    <input
                      type="datetime-local"
                      value={editVoucherDate}
                      onChange={(e) => setEditVoucherDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">البيان والشرح التفصيلي:</label>
                  <input
                    type="text"
                    required
                    value={editVoucherDesc}
                    onChange={(e) => setEditVoucherDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">ملاحظات إضافية:</label>
                  <input
                    type="text"
                    value={editVoucherNotes}
                    onChange={(e) => setEditVoucherNotes(e.target.value)}
                    placeholder="ملاحظات اختيارية..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingVoucherTx(null)}
                    className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ تعديلات السند</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 👁️ MODAL 4: VOUCHER PREVIEW & PRINT MODAL (معاينة وطباعة السند المالي) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {viewingVoucherTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[90vh] overflow-y-auto text-right text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-slate-900 text-white">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {isPurchaseInvoiceTx(viewingVoucherTx) ? 'تفاصيل فاتورة وسند المشتريات' :
                       viewingVoucherTx.type === 'payment' ? 'سند قبض مالي معتمد' :
                       viewingVoucherTx.type === 'expense' ? 'سند صرف / مصروف مالي' : 'تفاصيل السند المالي'}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      #{viewingVoucherTx.referenceNumber || viewingVoucherTx.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingVoucherTx(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-white border border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-500">المبلغ الإجمالي للسند:</span>
                  <span className={`font-mono text-lg font-black ${
                    viewingVoucherTx.type === 'expense' || viewingVoucherTx.type === 'refund' ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {viewingVoucherTx.amount.toLocaleString()} {currency}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500 font-bold">التاريخ والوقت:</span>
                  <span className="font-mono font-bold text-slate-800">{new Date(viewingVoucherTx.date).toLocaleString('ar-YE')}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500 font-bold">طريقة الدفع:</span>
                  <span className="font-bold text-slate-800">{formatPaymentMethodLabel(viewingVoucherTx.paymentMethod)}</span>
                </div>

                {(viewingVoucherTx.payerOrBeneficiary || viewingVoucherTx.customerName || viewingVoucherTx.supplierName) && (
                  <div className="flex justify-between py-1 border-b border-slate-200/70">
                    <span className="text-slate-500 font-bold">الجهة / المستفيد:</span>
                    <span className="font-bold text-blue-700">
                      {viewingVoucherTx.payerOrBeneficiary || viewingVoucherTx.customerName || viewingVoucherTx.supplierName}
                    </span>
                  </div>
                )}

                <div className="pt-1">
                  <span className="text-slate-500 font-bold block mb-1">البيان والتفاصيل:</span>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-800 leading-relaxed">
                    {viewingVoucherTx.description}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handlePrintVoucher(viewingVoucherTx)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة السند 🖨️</span>
                </button>

                {isPurchaseInvoiceTx(viewingVoucherTx) && (
                  <button
                    type="button"
                    onClick={() => {
                      const tx = viewingVoucherTx;
                      setViewingVoucherTx(null);
                      handleOpenPurchaseInvoiceModal(tx);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Package className="w-4 h-4" />
                    <span>الأصناف وتعديلها</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const tx = viewingVoucherTx;
                    setViewingVoucherTx(null);
                    handleOpenEditVoucher(tx);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>تعديل</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 🗑️ MODAL 5: SMART DELETE VOUCHER CONFIRMATION (نافذة تأكيد حذف السند المالي) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deletingVoucherTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl z-10 text-right text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">تأكيد حذف السند المالي</h3>
                    <p className="text-[11px] text-slate-400">إزالة السند من دفتر القيود والحسابات</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeletingVoucherTx(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="font-bold text-slate-800">{deletingVoucherTx.description}</div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200 font-bold">
                  <span className="text-slate-500">قيمة السند:</span>
                  <span className="font-mono text-sm font-black text-rose-600">
                    {deletingVoucherTx.amount.toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              {isPurchaseInvoiceTx(deletingVoucherTx) && (
                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteRevertInventory}
                    onChange={(e) => setDeleteRevertInventory(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-amber-600 rounded"
                  />
                  <span>خصم / إلغاء الأصناف المضافة في فاتورة المشتريات هذه من المخزن أيضاً</span>
                </label>
              )}

              {deletingVoucherTx.type === 'payment' && deletingVoucherTx.customerId && (
                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteRevertCustomerDebt}
                    onChange={(e) => setDeleteRevertCustomerDebt(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-blue-600 rounded"
                  />
                  <span>إعادة المبلغ المحذوف إلى رصيد مديونية حساب العميل</span>
                </label>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingVoucherTx(null)}
                  className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteVoucher}
                  className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تأكيد حذف السند</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 🔄 MODAL: IN-APP REFUND CONFIRMATION (نافذة تأكيد الاسترجاع التفاعلية) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {refundConfirmInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl z-10 text-right text-slate-900 border border-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
                    <Undo2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">تأكيد استرجاع الفاتورة</h3>
                    <p className="text-[11px] text-slate-400">إرجاع البضاعة وتسوية المبلغ</p>
                  </div>
                </div>
                <button 
                  onClick={() => setRefundConfirmInvoice(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-500">رقم الفاتورة:</span>
                  <span className="font-mono text-blue-600">#{refundConfirmInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-500">اسم العميل:</span>
                  <span className="text-slate-900">{refundConfirmInvoice.customerName || 'عميل نقدي'}</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-500">نوع الفاتورة:</span>
                  <span className={refundConfirmInvoice.type === 'cash' ? 'text-emerald-600' : 'text-rose-600'}>
                    {refundConfirmInvoice.type === 'cash' ? 'نقداً (كاش)' : 'آجل (دين)'}
                  </span>
                </div>
                <div className="flex justify-between items-center font-bold border-t border-slate-200 pt-1.5">
                  <span className="text-slate-700">المبلغ المسترجع:</span>
                  <span className="font-mono text-base font-black text-rose-600">
                    {refundConfirmInvoice.finalAmount.toLocaleString()} {currency}
                  </span>
                </div>
              </div>

              {Array.isArray(refundConfirmInvoice.items) && refundConfirmInvoice.items.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    الأصناف التي ستتم إعادتها إلى المستودع:
                  </span>
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 max-h-36 overflow-y-auto space-y-1">
                    {refundConfirmInvoice.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xs font-bold text-amber-950">
                        <span>• {item.name}</span>
                        <span className="font-mono text-amber-800">+{item.quantity} قطعة</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundConfirmInvoice(null)}
                  className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRefund}
                  className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>تأكيد الاسترجاع</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 📤 BOTTOM SHEET MODAL: RECORD NEW EXPENSE VOUCHER (سند صرف / مصروف جديد) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExpenseModal(false)}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[90vh] overflow-y-auto text-right text-slate-900"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

              <div className="flex items-center justify-between border-b border-rose-100 pb-3 bg-rose-50/70 p-3 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-600 text-white">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">إصدار سند صرف / مصروف جديد</h3>
                    <p className="text-[11px] text-rose-700 font-bold">قيد المصاريف والمدفوعات من الصندوق (-)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowExpenseModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {expenseError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {expenseError}
                </div>
              )}

              <form onSubmit={handleExpenseSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">مبلغ سند الصرف ({currency}):</label>
                    <input
                      id="expense_amount_input"
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={expenseAmount || ''}
                      onChange={(e) => setExpenseAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="مثال: 5000"
                      className="w-full bg-rose-50/50 border border-rose-200 text-sm font-black font-mono rounded-xl px-3.5 py-2.5 text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">رقم سند الصرف / المرجع:</label>
                    <input
                      type="text"
                      value={expenseRefNumber}
                      onChange={(e) => setExpenseRefNumber(e.target.value)}
                      placeholder="PV-1001"
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-mono font-bold rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">يصرف للمكرم / المستفيد (اختياري):</label>
                    <input
                      type="text"
                      value={expenseBeneficiary}
                      onChange={(e) => setExpenseBeneficiary(e.target.value)}
                      placeholder="اسم المستفيد أو المورد..."
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">تصنيف المصروف:</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="مصروف عام">مصروف تشغيلي عام</option>
                      <option value="مشتريات بضاعة">دفعة مشتريات بضاعة</option>
                      <option value="إيجار وفواتير">إيجار وكهرباء ومياه</option>
                      <option value="رواتب وأجور">رواتب وأجور</option>
                      <option value="نقل وشحن">نقل وشحن ومواصلات</option>
                      <option value="ضيافة ونثريات">ضيافة ونثريات</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">طريقة الدفع وقناة الخصم:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(Object.keys(PAYMENT_METHODS) as PaymentMethodKey[]).filter(k => k !== 'debt').map((methodKey) => {
                      const method = PAYMENT_METHODS[methodKey];
                      const isSelected = expensePaymentMethod === methodKey;
                      return (
                        <button
                          key={methodKey}
                          type="button"
                          onClick={() => {
                            soundManager.playScanBeep();
                            setExpensePaymentMethod(methodKey);
                          }}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 justify-center cursor-pointer ${
                            isSelected
                              ? `${method.bgLightClass} ${method.colorClass} ${method.borderClass} ring-2 ring-rose-500 shadow-sm font-black`
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-sm">{method.emoji}</span>
                          <span className="truncate">{method.shortLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">البيان والشرح التفصيلي:</label>
                  <input
                    id="expense_desc_input"
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="مثال: سداد فاتورة كهرباء المحل / شراء مستلزمات..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                  />
                </div>

                <button
                  id="submit_expense_btn"
                  type="submit"
                  className="w-full py-3 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وترحيل سند الصرف (-)</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Proof Image Fullscreen View Modal */}
      <AnimatePresence>
        {proofModalImage && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-3.5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold">صورة سند التحويل / إشعار الإيداع البنكي</span>
                </div>
                <button
                  type="button"
                  onClick={() => setProofModalImage(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 overflow-auto flex items-center justify-center bg-slate-950/60 max-h-[70vh]">
                <img
                  src={proofModalImage}
                  alt="صورة السند بدقة كاملة"
                  className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg border border-slate-800"
                />
              </div>

              <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  إشعار تسديد / تحويل مالي
                </span>
                <button
                  type="button"
                  onClick={() => setProofModalImage(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition"
                >
                  إغلاق المعاينة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
