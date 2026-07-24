/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  History, 
  BarChart3,
  Settings as SettingsIcon, 
  Lock, 
  Unlock,
  Clock, 
  Smartphone, 
  AlertCircle,
  Wrench,
  LogOut,
  Eye,
  EyeOff,
  Download,
  Briefcase,
  ClipboardCheck,
  Boxes
} from 'lucide-react';

import { Product, Customer, Invoice, Payment, Transaction, SystemSettings, MaintenanceOrder, Employee, PayrollRecord } from './types';
import { soundManager } from './utils/sound';
import { 
  DEFAULT_SETTINGS, 
  SEED_PRODUCTS, 
  SEED_CUSTOMERS, 
  SEED_INVOICES, 
  SEED_PAYMENTS, 
  SEED_TRANSACTIONS 
} from './utils/seedData';

// Component imports
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Customers from './components/Customers';
import Inventory from './components/Inventory';
import StockAudit from './components/StockAudit';
import Transactions from './components/Transactions';
import Settings from './components/Settings';
import InvoiceModal from './components/InvoiceModal';
import Maintenance from './components/Maintenance';
import ProfitReports from './components/ProfitReports';
import Employees from './components/Employees';
import ApkDownloadModal from './components/ApkDownloadModal';
import SaaSActivator from './components/SaaSActivator';
import BiometricLockModal from './components/BiometricLockModal';
import FloatingCalculator from './components/FloatingCalculator';
import DeveloperPortalModal from './components/DeveloperPortalModal';
import PinCheckModal from './components/PinCheckModal';

import { LicenseInfo, loadLicenseLocally, saveLicenseLocally } from './utils/licensing';
import { findLicenseByHwid } from './utils/firebase';
import { requestAndroidStartupPermissions } from './utils/androidPermissions';
import { 
  saveStoreDocument, 
  deleteStoreDocument, 
  saveStoreSettings, 
  syncStoreCollection, 
  syncStoreSettings 
} from './utils/firebaseSync';

export default function App() {
  // Global States loaded from LocalStorage
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const data = localStorage.getItem('smart_accounting_settings');
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const data = localStorage.getItem('smart_accounting_products');
    return data ? JSON.parse(data) : SEED_PRODUCTS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const data = localStorage.getItem('smart_accounting_customers');
    return data ? JSON.parse(data) : SEED_CUSTOMERS;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const data = localStorage.getItem('smart_accounting_invoices');
    return data ? JSON.parse(data) : SEED_INVOICES;
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    const data = localStorage.getItem('smart_accounting_payments');
    return data ? JSON.parse(data) : SEED_PAYMENTS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const data = localStorage.getItem('smart_accounting_transactions');
    return data ? JSON.parse(data) : SEED_TRANSACTIONS;
  });

  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>(() => {
    const data = localStorage.getItem('smart_accounting_maintenance');
    return data ? JSON.parse(data) : [];
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const data = localStorage.getItem('smart_accounting_employees');
    return data ? JSON.parse(data) : [
      {
        id: 'emp-1',
        name: 'محمد علي العنسي',
        phone: '771234567',
        jobTitle: 'كاشير مبيعات',
        monthlySalary: 150000,
        totalAdvances: 20000,
        hireDate: '2026-01-15'
      },
      {
        id: 'emp-2',
        name: 'سليم حسن الريمي',
        phone: '733456789',
        jobTitle: 'فني صيانة وتصليح',
        monthlySalary: 200000,
        totalAdvances: 0,
        hireDate: '2026-02-01'
      }
    ];
  });

  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() => {
    const data = localStorage.getItem('smart_accounting_payroll');
    return data ? JSON.parse(data) : [];
  });

  // Global Privacy Mode (👁️ hides amounts & profits with ***)
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    return localStorage.getItem('smart_accounting_privacy_mode') === 'true';
  });
  const [showPrivacyPinModal, setShowPrivacyPinModal] = useState<boolean>(false);

  // Cashier Mode state (Locks Settings and Profit Reports with PIN)
  const [isCashierMode, setIsCashierMode] = useState<boolean>(() => {
    return localStorage.getItem('smart_accounting_cashier_mode') === 'true';
  });

  const [showPinCheckModal, setShowPinCheckModal] = useState<boolean>(false);
  const [pendingProtectedTab, setPendingProtectedTab] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('smart_accounting_cashier_mode', String(isCashierMode));
  }, [isCashierMode]);

  // APK Download Modal
  const [showApkModal, setShowApkModal] = useState<boolean>(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showDevPortal, setShowDevPortal] = useState<boolean>(false);
  
  // Mobile Touch Swipe Gesture States & Config
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [swipeHint, setSwipeHint] = useState<string | null>(null);

  const ALL_TABS = ['dashboard', 'pos', 'inventory', 'stock_audit', 'customers', 'employees', 'transactions', 'reports', 'maintenance', 'settings'];

  const TAB_LABELS: Record<string, string> = {
    dashboard: 'الرئيسية',
    pos: 'المبيعات',
    inventory: 'المخزن',
    stock_audit: 'جرد المنشأة',
    customers: 'العملاء',
    employees: 'العمال والرواتب',
    transactions: 'القيود',
    reports: 'التقارير والأرباح',
    maintenance: 'الصيانة',
    settings: 'الإعدادات'
  };

  const handleTabSelect = (tab: string) => {
    const isRestricted = (tab === 'settings' || tab === 'reports') && (isCashierMode || settings.isPinEnabled);
    if (isRestricted) {
      soundManager.playWarningBeep();
      setPendingProtectedTab(tab);
      setShowPinCheckModal(true);
    } else {
      soundManager.playScanBeep();
      setActiveTab(tab);
    }
  };


  const handleTouchStart = (e: React.TouchEvent) => {
    // Disable swipe when modal dialogs are active or touching controls/inputs
    if (activeInvoice || showDevPortal) return;

    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, button, canvas, .no-swipe, [role="dialog"], table, .overflow-x-auto')) {
      setTouchStart(null);
      return;
    }

    if (e.touches.length === 1) {
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touchEnd = e.changedTouches[0];
    const deltaX = touchEnd.clientX - touchStart.x;
    const deltaY = touchEnd.clientY - touchStart.y;
    const deltaTime = Date.now() - touchStart.time;

    setTouchStart(null);

    // Filter out vertical scroll & require clear horizontal swipe
    if (deltaTime < 600 && Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      const currentIndex = ALL_TABS.indexOf(activeTab);
      if (currentIndex === -1) return;

      if (deltaX < 0) {
        // Swipe Left -> Move to Next Tab
        if (currentIndex < ALL_TABS.length - 1) {
          const nextTab = ALL_TABS[currentIndex + 1];
          soundManager.playScanBeep();
          setSwipeDirection('left');
          setActiveTab(nextTab);
          setSwipeHint(`التبويب التالي: ${TAB_LABELS[nextTab]} 👈`);
          setTimeout(() => setSwipeHint(null), 1400);
        }
      } else {
        // Swipe Right -> Move to Previous Tab
        if (currentIndex > 0) {
          const prevTab = ALL_TABS[currentIndex - 1];
          soundManager.playScanBeep();
          setSwipeDirection('right');
          setActiveTab(prevTab);
          setSwipeHint(`👉 التبويب السابق: ${TAB_LABELS[prevTab]}`);
          setTimeout(() => setSwipeHint(null), 1400);
        }
      }
    }
  };
  
  // Simple client-side sub-route check for Developer Portal
  const [isDevRoute, setIsDevRoute] = useState(() => {
    const p = window.location.pathname;
    const h = window.location.hash;
    return p === '/admin' || p === '/dev-portal' || h === '#/admin' || h === '#/dev-portal';
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const p = window.location.pathname;
      const h = window.location.hash;
      setIsDevRoute(p === '/admin' || p === '/dev-portal' || h === '#/admin' || h === '#/dev-portal');
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    // Startup initialization (Permissions are now strictly requested on-demand when user clicks camera/action buttons)
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);
  
  // SaaS License state (Continuous cloud handshake & local sync)
  const [license, setLicense] = useState<LicenseInfo>(() => loadLicenseLocally());

  const isActivated = license.status === 'active' || license.status === 'trial';
  const [isBiometricLocked, setIsBiometricLocked] = useState<boolean>(() => {
    return localStorage.getItem('sond_biometrics_enabled') === 'true';
  });

  // Logout/Deactivate current license
  const handleLogout = () => {
    soundManager.playWarningBeep();
    // Set explicit logged-out flag to prevent silentCheck auto-login loop
    localStorage.setItem('smart_accounting_logged_out', 'true');
    const updated: LicenseInfo = {
      licenseKey: '',
      status: 'unlicensed',
      activatedAt: '',
      expiresAt: '',
      hwid: license.hwid,
      subscriptionType: 'trial',
      customerName: 'غير مرخص'
    };
    saveLicenseLocally(updated);
    setLicense(updated);
    localStorage.removeItem('smart_accounting_license_v1');
    localStorage.removeItem('smart_accounting_license');
    localStorage.removeItem('smart_accounting_user');
    localStorage.removeItem('smart_accounting_token');
    setActiveTab('dashboard');
  };

  // Real-time silent cloud license activation/blocking check based on HWID
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const silentCheck = async () => {
      // If user explicitly logged out, do NOT auto-login or auto-activate silently!
      if (localStorage.getItem('smart_accounting_logged_out') === 'true') {
        return;
      }
      if (!license.hwid) return;
      try {
        const cloudLic = await findLicenseByHwid(license.hwid);
        if (cloudLic) {
          const expiryDate = new Date(cloudLic.expiresAt);
          const isExpired = expiryDate < new Date();

          if (cloudLic.status === 'suspended') {
            const updated: LicenseInfo = {
              licenseKey: cloudLic.key,
              status: 'unlicensed',
              activatedAt: license.activatedAt || new Date().toISOString(),
              expiresAt: cloudLic.expiresAt,
              hwid: license.hwid,
              subscriptionType: cloudLic.type,
              customerName: cloudLic.customerName
            };
            saveLicenseLocally(updated);
            setLicense(updated);
            return;
          }

          if (isExpired) {
            const updated: LicenseInfo = {
              licenseKey: cloudLic.key,
              status: 'expired',
              activatedAt: license.activatedAt || new Date().toISOString(),
              expiresAt: cloudLic.expiresAt,
              hwid: license.hwid,
              subscriptionType: cloudLic.type,
              customerName: cloudLic.customerName
            };
            saveLicenseLocally(updated);
            setLicense(updated);
            return;
          }

          // Active cloud license found! Auto-activate or update local
          const updated: LicenseInfo = {
            licenseKey: cloudLic.key,
            status: cloudLic.type === 'trial' ? 'trial' : 'active',
            activatedAt: license.activatedAt || new Date().toISOString(),
            expiresAt: cloudLic.expiresAt,
            hwid: license.hwid,
            subscriptionType: cloudLic.type,
            customerName: cloudLic.customerName
          };

          // Only trigger chime if transitioned from inactive/unlicensed to active/trial
          if (license.status !== 'active' && license.status !== 'trial') {
            soundManager.playSuccessChime();
          }

          saveLicenseLocally(updated);
          setLicense(updated);
        } else {
          // If no license matching the HWID exists on cloud, check if we currently have an active/trial state and revoke it instantly!
          // This allows immediate blocking of devices when deleted from developer portal.
          if (license.status === 'active' || license.status === 'trial') {
            const updated: LicenseInfo = {
              licenseKey: '',
              status: 'unlicensed',
              activatedAt: '',
              expiresAt: '',
              hwid: license.hwid,
              subscriptionType: 'trial',
              customerName: 'غير مرخص'
            };
            saveLicenseLocally(updated);
            setLicense(updated);
          }
        }
      } catch (err) {
        console.warn('Global silent check failed:', err);
      }
    };

    // Run immediately
    silentCheck();

    // Check periodically every 5 seconds
    interval = setInterval(silentCheck, 5000);

    return () => clearInterval(interval);
  }, [license.hwid, license.status]);

  // Active printed invoice popup
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  // Dynamic date/time ticker
  const [currentTime, setCurrentTime] = useState<string>('');

  // Save states to local storage on changes (Only if not synced to cloud)
  useEffect(() => {
    if (!license.licenseKey) {
      localStorage.setItem('smart_accounting_settings', JSON.stringify(settings));
    }
  }, [settings, license.licenseKey]);

  useEffect(() => {
    if (!license.licenseKey) {
      localStorage.setItem('smart_accounting_products', JSON.stringify(products));
    }
  }, [products, license.licenseKey]);

  useEffect(() => {
    if (!license.licenseKey) {
      localStorage.setItem('smart_accounting_customers', JSON.stringify(customers));
    }
  }, [customers, license.licenseKey]);

  useEffect(() => {
    if (!license.licenseKey) {
      localStorage.setItem('smart_accounting_invoices', JSON.stringify(invoices));
    }
  }, [invoices, license.licenseKey]);

  useEffect(() => {
    if (!license.licenseKey) {
      localStorage.setItem('smart_accounting_payments', JSON.stringify(payments));
    }
  }, [payments, license.licenseKey]);

  useEffect(() => {
    if (!license.licenseKey) {
      localStorage.setItem('smart_accounting_transactions', JSON.stringify(transactions));
    }
  }, [transactions, license.licenseKey]);

  useEffect(() => {
    if (!license.licenseKey) {
      localStorage.setItem('smart_accounting_maintenance', JSON.stringify(maintenanceOrders));
    }
  }, [maintenanceOrders, license.licenseKey]);

  useEffect(() => {
    if (!license.licenseKey) {
      localStorage.setItem('smart_accounting_employees', JSON.stringify(employees));
    }
  }, [employees, license.licenseKey]);

  useEffect(() => {
    if (!license.licenseKey) {
      localStorage.setItem('smart_accounting_payroll', JSON.stringify(payrollRecords));
    }
  }, [payrollRecords, license.licenseKey]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_privacy_mode', String(isPrivacyMode));
  }, [isPrivacyMode]);

  // Real-time Firestore synchronization effect (with automatic offline persistence support)
  useEffect(() => {
    if (!license.licenseKey || !isActivated) {
      return;
    }

    console.log(`[Sync] Initializing real-time cloud sync for store license: ${license.licenseKey}...`);

    // Subscribe and synchronize all store database tables
    const unsubSettings = syncStoreSettings(license.licenseKey, setSettings, DEFAULT_SETTINGS);
    const unsubProducts = syncStoreCollection<Product>(license.licenseKey, 'products', setProducts, SEED_PRODUCTS);
    const unsubCustomers = syncStoreCollection<Customer>(license.licenseKey, 'customers', setCustomers, SEED_CUSTOMERS);
    const unsubInvoices = syncStoreCollection<Invoice>(license.licenseKey, 'invoices', setInvoices, SEED_INVOICES);
    const unsubPayments = syncStoreCollection<Payment>(license.licenseKey, 'payments', setPayments, SEED_PAYMENTS);
    const unsubTransactions = syncStoreCollection<Transaction>(license.licenseKey, 'transactions', setTransactions, SEED_TRANSACTIONS);
    const unsubMaintenance = syncStoreCollection<MaintenanceOrder>(license.licenseKey, 'maintenanceOrders', setMaintenanceOrders, []);
    const unsubEmployees = syncStoreCollection<Employee>(license.licenseKey, 'employees', setEmployees, []);
    const unsubPayroll = syncStoreCollection<PayrollRecord>(license.licenseKey, 'payrollRecords', setPayrollRecords, []);

    return () => {
      console.log(`[Sync] Terminating real-time cloud sync for store: ${license.licenseKey}`);
      unsubSettings();
      unsubProducts();
      unsubCustomers();
      unsubInvoices();
      unsubPayments();
      unsubTransactions();
      unsubMaintenance();
      unsubEmployees();
      unsubPayroll();
    };
  }, [license.licenseKey, isActivated]);


  // Clock ticker effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ar-YE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) + ' - ' + now.toLocaleDateString('ar-YE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);



  // Action: Save settings
  const handleSaveSettings = (newSettings: SystemSettings) => {
    if (license.licenseKey) {
      saveStoreSettings(license.licenseKey, newSettings);
    } else {
      setSettings(newSettings);
    }
  };

  // Action: Complete a POS Sale
  const handleCompleteSale = (saleData: Omit<Invoice, 'id' | 'invoiceNumber'>) => {
    const nextInvoiceNum = `INV-${invoices.length + 1001}`;
    const invoiceId = `inv-${Date.now()}`;

    const newInvoice: Invoice = {
      ...saleData,
      id: invoiceId,
      invoiceNumber: nextInvoiceNum
    };

    // Calculate updated products stock
    const updatedProducts = products.map(p => {
      const soldItem = saleData.items.find(item => item.productId === p.id);
      if (soldItem) {
        return {
          ...p,
          stock: Math.max(0, p.stock - soldItem.quantity)
        };
      }
      return p;
    });

    // Calculate updated customer debt
    let updatedCustomer: Customer | null = null;
    if (saleData.type === 'debt' && saleData.customerId) {
      const c = customers.find(cust => cust.id === saleData.customerId);
      if (c) {
        updatedCustomer = {
          ...c,
          totalDebt: c.totalDebt + saleData.finalAmount
        };
      }
    }

    // Register transaction قيد اليومية
    const newTransaction: Transaction = {
      id: `t-${Date.now()}`,
      type: 'sale',
      amount: saleData.finalAmount,
      date: saleData.date,
      description: `مبيعات فاتورة ${nextInvoiceNum} لـ ${saleData.customerName}`
    };

    if (license.licenseKey) {
      // Write directly to cloud Firestore (Latence Compensation automatically triggers onSnapshot)
      saveStoreDocument(license.licenseKey, 'invoices', invoiceId, newInvoice);
      saveStoreDocument(license.licenseKey, 'transactions', newTransaction.id, newTransaction);
      
      updatedProducts.forEach(p => {
        saveStoreDocument(license.licenseKey, 'products', p.id, p);
      });

      if (updatedCustomer) {
        saveStoreDocument(license.licenseKey, 'customers', updatedCustomer.id, updatedCustomer);
      }
    } else {
      // Fallback local updates
      setProducts(updatedProducts);
      if (updatedCustomer) {
        setCustomers(prev => prev.map(c => c.id === updatedCustomer!.id ? updatedCustomer! : c));
      }
      setInvoices(prev => [...prev, newInvoice]);
      setTransactions(prev => [...prev, newTransaction]);
    }

    // Open printed modal
    setActiveInvoice(newInvoice);
  };

  // Action: Add customer
  const handleAddCustomer = (custData: Omit<Customer, 'id' | 'totalDebt' | 'createdAt'>) => {
    const newCustomer: Customer = {
      id: `c-${Date.now()}`,
      name: custData.name,
      phone: custData.phone,
      debtDueDate: custData.debtDueDate,
      notes: custData.notes,
      loyaltyPoints: custData.loyaltyPoints || 0,
      totalDebt: 0,
      createdAt: new Date().toISOString()
    };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'customers', newCustomer.id, newCustomer);
    } else {
      setCustomers(prev => [...prev, newCustomer]);
    }
  };

  // Action: Update customer
  const handleUpdateCustomer = (updatedCustomer: Customer) => {
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'customers', updatedCustomer.id, updatedCustomer);
    } else {
      setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    }
  };

  // Action: Delete customer (Soft delete to protect financial history & reports)
  const handleDeleteCustomer = (customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;
    const softDeleted: Customer = {
      ...cust,
      isDeleted: true,
      isActive: false
    };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'customers', customerId, softDeleted);
    } else {
      setCustomers(prev => prev.map(c => c.id === customerId ? softDeleted : c));
    }
  };

  // Action: Settle/Pay debt
  const handlePayDebt = (customerId: string, amount: number, note: string) => {
    const payId = `pay-${Date.now()}`;
    const dateStr = new Date().toISOString();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const newPayment: Payment = {
      id: payId,
      customerId,
      customerName: customer.name,
      amount,
      date: dateStr,
      note
    };

    const newTransaction: Transaction = {
      id: `t-${Date.now()}`,
      type: 'payment',
      amount,
      date: dateStr,
      description: `سداد ديون مستلمة من العميل: ${customer.name}`
    };

    const updatedCustomer: Customer = {
      ...customer,
      totalDebt: Math.max(0, customer.totalDebt - amount)
    };

    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'payments', payId, newPayment);
      saveStoreDocument(license.licenseKey, 'transactions', newTransaction.id, newTransaction);
      saveStoreDocument(license.licenseKey, 'customers', customerId, updatedCustomer);
    } else {
      setCustomers(prev => prev.map(c => c.id === customerId ? updatedCustomer : c));
      setPayments(prev => [...prev, newPayment]);
      setTransactions(prev => [...prev, newTransaction]);
    }
  };

  // Action: Add product
  const handleAddProduct = (productData: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      id: `p-${Date.now()}`,
      ...productData
    };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'products', newProduct.id, newProduct);
    } else {
      setProducts(prev => [...prev, newProduct]);
    }
  };

  // Action: Update product details
  const handleUpdateProduct = (updatedProduct: Product) => {
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'products', updatedProduct.id, updatedProduct);
    } else {
      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    }
  };

  // Action: Delete product (Soft delete to protect sales/purchases history & invoices)
  const handleDeleteProduct = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const softDeleted: Product = {
      ...prod,
      isDeleted: true,
      stock: 0
    };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'products', productId, softDeleted);
    } else {
      setProducts(prev => prev.map(p => p.id === productId ? softDeleted : p));
    }
  };

  // Action: Direct product stock reconciliation (Stock Audit)
  const handleUpdateProductStock = (productId: string, newStock: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const updated: Product = {
      ...prod,
      stock: newStock
    };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'products', productId, updated);
    } else {
      setProducts(prev => prev.map(p => p.id === productId ? updated : p));
    }
  };

  // Action: Record external/daily operating expense
  const handleAddExpense = (amount: number, description: string) => {
    const newTransaction: Transaction = {
      id: `t-${Date.now()}`,
      type: 'expense',
      amount,
      date: new Date().toISOString(),
      description: `مصروفات تشغيلية: ${description}`
    };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'transactions', newTransaction.id, newTransaction);
    } else {
      setTransactions(prev => [...prev, newTransaction]);
    }
  };

  // Action: Delete Transaction قيد
  const handleDeleteTransaction = (id: string) => {
    if (license.licenseKey) {
      deleteStoreDocument(license.licenseKey, 'transactions', id);
    } else {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  // Action: Download Complete System Backup (JSON)
  const handleBackupData = () => {
    const backupObj = {
      settings,
      products,
      customers,
      invoices,
      payments,
      transactions,
      version: '1.2.0-desktop',
      exportedAt: new Date().toISOString(),
      developer: 'Abdulmajeed Al-Mahwashi'
    };

    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart_phone_accounting_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Action: Add maintenance order
  const handleAddMaintenanceOrder = (orderData: Omit<MaintenanceOrder, 'id' | 'orderNumber' | 'dateReceived'>) => {
    const nextOrderNum = `MNT-${maintenanceOrders.length + 1001}`;
    const newOrder: MaintenanceOrder = {
      ...orderData,
      id: `mnt-${Date.now()}`,
      orderNumber: nextOrderNum,
      dateReceived: new Date().toISOString()
    };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'maintenanceOrders', newOrder.id, newOrder);
    } else {
      setMaintenanceOrders(prev => [...prev, newOrder]);
    }
  };

  // Action: Update maintenance status
  const handleUpdateMaintenanceStatus = (id: string, status: MaintenanceOrder['status']) => {
    const order = maintenanceOrders.find(o => o.id === id);
    if (!order) return;

    const isDeliveredNow = status === 'delivered' && order.status !== 'delivered';
    const updatedOrder: MaintenanceOrder = {
      ...order,
      status,
      dateDelivered: status === 'delivered' ? new Date().toISOString() : order.dateDelivered
    };

    let newTransaction: Transaction | null = null;
    if (isDeliveredNow) {
      newTransaction = {
        id: `t-${Date.now()}`,
        type: 'maintenance_income',
        amount: order.cost,
        date: new Date().toISOString(),
        description: `إيراد صيانة: تسليم هاتف ${order.deviceName} للعميل ${order.customerName}`
      };
    }

    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'maintenanceOrders', id, updatedOrder);
      if (newTransaction) {
        saveStoreDocument(license.licenseKey, 'transactions', newTransaction.id, newTransaction);
      }
    } else {
      setMaintenanceOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
      if (newTransaction) {
        setTransactions(prev => [...prev, newTransaction!]);
      }
    }
  };

  // Action: Delete maintenance order
  const handleDeleteMaintenanceOrder = (id: string) => {
    if (license.licenseKey) {
      deleteStoreDocument(license.licenseKey, 'maintenanceOrders', id);
    } else {
      setMaintenanceOrders(prev => prev.filter(order => order.id !== id));
    }
  };

  // Action: Add Employee
  const handleAddEmployee = (empData: Omit<Employee, 'id' | 'totalAdvances' | 'hireDate'>) => {
    const newEmp: Employee = {
      ...empData,
      id: `emp-${Date.now()}`,
      totalAdvances: 0,
      hireDate: new Date().toISOString()
    };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'employees', newEmp.id, newEmp);
    } else {
      setEmployees(prev => [...prev, newEmp]);
    }
  };

  // Action: Record Advance for Employee
  const handleRecordAdvance = (employeeId: string, amount: number, note: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const updatedEmp: Employee = {
      ...emp,
      totalAdvances: emp.totalAdvances + amount
    };

    const recId = `payr-${Date.now()}`;
    const newRecord: PayrollRecord = {
      id: recId,
      employeeId,
      employeeName: emp.name,
      type: 'advance',
      amount,
      date: new Date().toISOString(),
      note
    };

    const newTx: Transaction = {
      id: `t-${Date.now()}`,
      type: 'expense',
      amount,
      date: new Date().toISOString(),
      description: `سلفة للموظف ${emp.name}: ${note}`
    };

    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'employees', employeeId, updatedEmp);
      saveStoreDocument(license.licenseKey, 'payrollRecords', recId, newRecord);
      saveStoreDocument(license.licenseKey, 'transactions', newTx.id, newTx);
    } else {
      setEmployees(prev => prev.map(e => e.id === employeeId ? updatedEmp : e));
      setPayrollRecords(prev => [...prev, newRecord]);
      setTransactions(prev => [...prev, newTx]);
    }
  };

  // Action: Pay Salary to Employee
  const handlePaySalary = (employeeId: string, amount: number, note: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const updatedEmp: Employee = {
      ...emp,
      totalAdvances: Math.max(0, emp.totalAdvances - amount)
    };

    const recId = `payr-${Date.now()}`;
    const newRecord: PayrollRecord = {
      id: recId,
      employeeId,
      employeeName: emp.name,
      type: 'salary_payment',
      amount,
      date: new Date().toISOString(),
      note
    };

    const newTx: Transaction = {
      id: `t-${Date.now()}`,
      type: 'expense',
      amount,
      date: new Date().toISOString(),
      description: `صرف راتب للموظف ${emp.name}: ${note}`
    };

    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'employees', employeeId, updatedEmp);
      saveStoreDocument(license.licenseKey, 'payrollRecords', recId, newRecord);
      saveStoreDocument(license.licenseKey, 'transactions', newTx.id, newTx);
    } else {
      setEmployees(prev => prev.map(e => e.id === employeeId ? updatedEmp : e));
      setPayrollRecords(prev => [...prev, newRecord]);
      setTransactions(prev => [...prev, newTx]);
    }
  };

  // Action: Delete Employee (soft delete)
  const handleDeleteEmployee = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const softDeleted: Employee = { ...emp, isDeleted: true };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'employees', employeeId, softDeleted);
    } else {
      setEmployees(prev => prev.map(e => e.id === employeeId ? softDeleted : e));
    }
  };


  // Action: Refund / Return POS Invoice
  const handleRefundInvoice = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice || invoice.status === 'refunded') return;

    const updatedInvoice: Invoice = { ...invoice, status: 'refunded' };

    const updatedProducts = products.map(p => {
      const returnedItem = invoice.items.find(item => item.productId === p.id);
      if (returnedItem) {
        return {
          ...p,
          stock: p.stock + returnedItem.quantity
        };
      }
      return p;
    });

    let updatedCustomer: Customer | null = null;
    if (invoice.type === 'debt' && invoice.customerId) {
      const c = customers.find(cust => cust.id === invoice.customerId);
      if (c) {
        updatedCustomer = {
          ...c,
          totalDebt: Math.max(0, c.totalDebt - invoice.finalAmount)
        };
      }
    }

    const refundTx: Transaction = {
      id: `t-${Date.now()}`,
      type: 'refund',
      amount: invoice.finalAmount,
      date: new Date().toISOString(),
      description: `مرتجع مبيعات: استرجاع سلع الفاتورة ${invoice.invoiceNumber} للعميل ${invoice.customerName}`
    };

    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'invoices', invoiceId, updatedInvoice);
      saveStoreDocument(license.licenseKey, 'transactions', refundTx.id, refundTx);
      
      updatedProducts.forEach(p => {
        saveStoreDocument(license.licenseKey, 'products', p.id, p);
      });

      if (updatedCustomer) {
        saveStoreDocument(license.licenseKey, 'customers', updatedCustomer.id, updatedCustomer);
      }
    } else {
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updatedInvoice : inv));
      setProducts(updatedProducts);
      if (updatedCustomer) {
        setCustomers(prev => prev.map(c => c.id === updatedCustomer!.id ? updatedCustomer! : c));
      }
      setTransactions(prev => [...prev, refundTx]);
    }
    
    soundManager.playWarningBeep();
  };

  // Action: Overwrite database with restored JSON backup
  const handleRestoreData = async (restored: any) => {
    if (!restored || typeof restored !== 'object') return false;
    if (!restored.settings || !restored.products || !restored.customers) return false;

    if (license.licenseKey) {
      // 1. Settings
      await saveStoreSettings(license.licenseKey, restored.settings);
      
      // 2. Products
      const productsList = restored.products || [];
      for (const p of productsList) {
        await saveStoreDocument(license.licenseKey, 'products', p.id, p);
      }

      // 3. Customers
      const customersList = restored.customers || [];
      for (const c of customersList) {
        await saveStoreDocument(license.licenseKey, 'customers', c.id, c);
      }

      // 4. Invoices
      const invoicesList = restored.invoices || [];
      for (const inv of invoicesList) {
        await saveStoreDocument(license.licenseKey, 'invoices', inv.id, inv);
      }

      // 5. Payments
      const paymentsList = restored.payments || [];
      for (const pay of paymentsList) {
        await saveStoreDocument(license.licenseKey, 'payments', pay.id, pay);
      }

      // 6. Transactions
      const transactionsList = restored.transactions || [];
      for (const t of transactionsList) {
        await saveStoreDocument(license.licenseKey, 'transactions', t.id, t);
      }

      // 7. Maintenance orders
      const maintenanceList = restored.maintenanceOrders || [];
      for (const order of maintenanceList) {
        await saveStoreDocument(license.licenseKey, 'maintenanceOrders', order.id, order);
      }
    } else {
      setSettings(restored.settings);
      setProducts(restored.products);
      setCustomers(restored.customers);
      setInvoices(restored.invoices || []);
      setPayments(restored.payments || []);
      setTransactions(restored.transactions || []);
      setMaintenanceOrders(restored.maintenanceOrders || []);
    }
    return true;
  };

  // Action: Reset Database to zero factory settings
  const handleResetDatabase = async () => {
    if (license.licenseKey) {
      await saveStoreSettings(license.licenseKey, DEFAULT_SETTINGS);
      
      for (const p of products) {
        await deleteStoreDocument(license.licenseKey, 'products', p.id);
      }
      for (const c of customers) {
        await deleteStoreDocument(license.licenseKey, 'customers', c.id);
      }
      for (const inv of invoices) {
        await deleteStoreDocument(license.licenseKey, 'invoices', inv.id);
      }
      for (const pay of payments) {
        await deleteStoreDocument(license.licenseKey, 'payments', pay.id);
      }
      for (const t of transactions) {
        await deleteStoreDocument(license.licenseKey, 'transactions', t.id);
      }
      for (const m of maintenanceOrders) {
        await deleteStoreDocument(license.licenseKey, 'maintenanceOrders', m.id);
      }
    } else {
      localStorage.clear();
      setSettings(DEFAULT_SETTINGS);
      setProducts(SEED_PRODUCTS);
      setCustomers(SEED_CUSTOMERS);
      setInvoices(SEED_INVOICES);
      setPayments(SEED_PAYMENTS);
      setTransactions(SEED_TRANSACTIONS);
      setMaintenanceOrders([]);
    }
    setActiveTab('dashboard');
  };

  // Standalone Developer Portal Route
  if (isDevRoute) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex items-center justify-center p-4 font-sans">
        <DeveloperPortalModal
          isOpen={true}
          onClose={() => {
            // Redirect back to root path safely without reload
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new Event('popstate'));
          }}
          currentHwid={license.hwid}
        />
      </div>
    );
  }

  // SaaS Activation Gate (Initial Route: Phone Number + Activation Code Screen)
  if (!isActivated) {
    return (
      <SaaSActivator 
        license={license}
        setLicense={setLicense}
        onActivationSuccess={(updatedLicense) => {
          setLicense(updatedLicense);
          if (updatedLicense.customerName) {
            setSettings(prev => {
              const updated = { ...prev, storeName: updatedLicense.customerName };
              localStorage.setItem('smart_accounting_settings', JSON.stringify(updated));
              return updated;
            });
          }
        }} 
      />
    );
  }

  // Quick Biometric / Fingerprint & PIN Lock Screen
  if (isBiometricLocked) {
    return (
      <BiometricLockModal
        storeName={license.customerName || settings.storeName || 'نظام سند المحاسبي'}
        phone={license.phone || settings.phone || ''}
        pinCode={settings.pinCode}
        onUnlock={() => setIsBiometricLocked(false)}
      />
    );
  }

  // Count low stocks for dynamic red badge on sidemenu
  const lowStockCount = products.filter(p => p.stock <= p.minStock && p.isDeleted !== true).length;

  const themeClass = `theme-${settings.appTheme || 'financial-blue'}`;
  const shapeClass = `shape-${settings.cardShape || 'soft'}`;
  const densityClass = `density-${settings.density || 'comfortable'}`;

  return (
    <div 
      id="application_root_container" 
      className={`min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans transition-colors duration-200 ${themeClass} ${shapeClass} ${densityClass}`}
    >
      
      {/* 1. TOP ACCESS BAR (Non-printed) */}
      <header id="desktop_topbar" className="no-print h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex justify-between items-center z-40 shadow-sm">
        
        {/* System Branding & Store / Customer Info */}
        <div className="flex items-center gap-3">
          {settings.storeLogoUrl ? (
            <img 
              src={settings.storeLogoUrl} 
              alt="شعار المتجر" 
              className="w-9 h-9 rounded-xl object-contain border border-slate-200 shadow-sm bg-white" 
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white shadow-sm flex items-center justify-center font-bold text-base shrink-0">
              🏪
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-1.5">
                <span>{settings.storeName || license.customerName || 'النشاط التجاري'}</span>
              </h1>
              {license.phone && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold flex items-center gap-1 shadow-xs">
                  <span>📱</span> {license.phone}
                </span>
              )}
            </div>
            <p className="hidden md:block text-[10px] text-slate-500 font-mono tracking-wider leading-none mt-0.5 select-none">
              نظام سند الذكي المحاسبي • موثق برقم الهاتف
            </p>
          </div>
        </div>

        {/* Cloud Sync Status Badge */}
        {license.licenseKey && isActivated && (
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs text-emerald-700 font-bold select-none shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>متصل سحابياً ⚡</span>
          </div>
        )}

        {/* Live Active Clock Widget */}
        <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs text-slate-600 font-medium">
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="font-mono mt-0.5">{currentTime}</span>
        </div>

        {/* Quick lock and diagnostic sound check buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          
          {/* APK Download Button */}
          <button
            onClick={() => setShowApkModal(true)}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition cursor-pointer text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
            title="تنزيل تطبيق أندرويد APK"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تنزيل التطبيق (APK)</span>
          </button>

          {/* Privacy mode toggle */}
          <button
            onClick={() => {
              if (isPrivacyMode) {
                // Currently hidden -> Require PIN if enabled to show prices/amounts
                if (settings.isPrivacyPinEnabled !== false) {
                  soundManager.playWarningBeep();
                  setShowPrivacyPinModal(true);
                } else {
                  soundManager.playScanBeep();
                  setIsPrivacyMode(false);
                }
              } else {
                // Currently visible -> Instantly hide for privacy
                soundManager.playScanBeep();
                setIsPrivacyMode(true);
              }
            }}
            className={`p-2 rounded-xl border transition cursor-pointer text-xs flex items-center gap-1.5 ${
              isPrivacyMode
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title={isPrivacyMode ? 'إظهار المبالغ والخصومات (يتطلب كلمة السر)' : 'إخفاء المبالغ المالية (وضع الخصوصية)'}
          >
            {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPrivacyMode ? 'مخفي 👁️‍🗨️' : 'خصوصية 👁️'}</span>
          </button>

          {/* Cashier Mode toggle */}
          <button
            onClick={() => {
              if (isCashierMode) {
                setPendingProtectedTab(null);
                setShowPinCheckModal(true);
              } else {
                soundManager.playSuccessChime();
                setIsCashierMode(true);
              }
            }}
            className={`p-2 rounded-xl border transition cursor-pointer text-xs flex items-center gap-1.5 font-bold ${
              isCashierMode
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
            title={isCashierMode ? 'فك قفل وضع الكاشير برمز PIN' : 'تفعيل وضع الكاشير لحماية الأرباح والإعدادات'}
          >
            {isCashierMode ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
            <span className="hidden sm:inline">{isCashierMode ? 'وضع الكاشير 🔐' : 'وضع المدير 🔓'}</span>
          </button>

          {/* Diagnostic beep test */}
          <button
            id="sound_test_btn"
            onClick={() => soundManager.playScanBeep()}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 transition cursor-pointer text-xs flex items-center gap-1"
            title="فحص صوت الباركود"
          >
            🔊 <span className="hidden sm:inline">صوت</span>
          </button>

          {/* Logout button */}
          <button
            id="topbar_logout_btn"
            onClick={() => {
              if (confirm('⚠️ هل أنت متأكد من رغبتك في تسجيل الخروج وإلغاء ترخيص الجهاز؟')) {
                handleLogout();
              }
            }}
            className="p-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition cursor-pointer text-xs flex items-center gap-1 font-bold"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </button>

        </div>

      </header>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div id="desktop_workspace" className="flex-1 flex flex-col md:flex-row">
        
        {/* SIDEMENU NAVIGATION RAIL (Desktop only) */}
        <aside id="desktop_navigation_rail" className="no-print hidden md:block w-64 bg-white border-l border-slate-200 p-4 space-y-2 shrink-0 shadow-sm">
          
          <div className="flex items-center justify-between px-2 mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">القائمة الرئيسية</p>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="النظام نشط" />
          </div>
          
          <nav className="flex flex-col gap-1.5">
            
            {/* Dashboard tab */}
            <button
              id="tab_trigger_dashboard"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('dashboard');
              }}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-50/90 text-indigo-950 font-bold border-r-4 border-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
              }`}>
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span>الرئيسية والملخص</span>
            </button>

            {/* POS terminal tab */}
            <button
              id="tab_trigger_pos"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('pos');
              }}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'pos'
                  ? 'bg-emerald-50/90 text-emerald-950 font-bold border-r-4 border-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'pos'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
              }`}>
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span>شاشة المبيعات (POS)</span>
            </button>

            {/* Inventory tab */}
            <button
              id="tab_trigger_inventory"
              onClick={() => handleTabSelect('inventory')}
              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'inventory'
                  ? 'bg-purple-50/90 text-purple-950 font-bold border-r-4 border-purple-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  activeTab === 'inventory'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white'
                }`}>
                  <Package className="w-4 h-4" />
                </div>
                <span>المستودع والمخزن</span>
              </div>
              {lowStockCount > 0 && (
                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-500 text-white rounded-full animate-bounce shadow-xs">
                  {lowStockCount}
                </span>
              )}
            </button>

            {/* Stock Audit & Facility Reconciliation tab */}
            <button
              id="tab_trigger_stock_audit"
              onClick={() => handleTabSelect('stock_audit')}
              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'stock_audit'
                  ? 'bg-amber-50/90 text-amber-950 font-bold border-r-4 border-amber-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  activeTab === 'stock_audit'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white'
                }`}>
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <span>جرد وحصر المنشأة</span>
              </div>
              <span className="px-1.5 py-0.5 text-[8.5px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 rounded-md">
                مستقل ✨
              </span>
            </button>

            {/* Customers tab */}
            <button
              id="tab_trigger_customers"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('customers');
              }}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'customers'
                  ? 'bg-sky-50/90 text-sky-950 font-bold border-r-4 border-sky-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'customers'
                  ? 'bg-sky-600 text-white'
                  : 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white'
              }`}>
                <Users className="w-4 h-4" />
              </div>
              <span>العملاء والديون (الذمم)</span>
            </button>

            {/* Employees tab */}
            <button
              id="tab_trigger_employees"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('employees');
              }}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'employees'
                  ? 'bg-teal-50/90 text-teal-950 font-bold border-r-4 border-teal-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'employees'
                  ? 'bg-teal-600 text-white'
                  : 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white'
              }`}>
                <Briefcase className="w-4 h-4" />
              </div>
              <span>قسم العمال والرواتب</span>
            </button>

            {/* Transactions history tab */}
            <button
              id="tab_trigger_transactions"
              onClick={() => handleTabSelect('transactions')}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'transactions'
                  ? 'bg-blue-50/90 text-blue-950 font-bold border-r-4 border-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                activeTab === 'transactions'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
              }`}>
                <History className="w-4 h-4" />
              </div>
              <span>القيود والتحصيلات</span>
            </button>

            {/* Graphical Profit Reports tab (Protected by PIN in Cashier mode) */}
            <button
              id="tab_trigger_reports"
              onClick={() => handleTabSelect('reports')}
              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'reports'
                  ? 'bg-rose-50/90 text-rose-950 font-bold border-r-4 border-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  activeTab === 'reports'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'
                }`}>
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span>الأرباح والتقارير البيانية</span>
              </div>
              {(isCashierMode || settings.isPinEnabled) && (
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              )}
            </button>

            {/* Maintenance & Programming tab */}
            <button
              id="tab_trigger_maintenance"
              onClick={() => handleTabSelect('maintenance')}
              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'maintenance'
                  ? 'bg-orange-50/90 text-orange-950 font-bold border-r-4 border-orange-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  activeTab === 'maintenance'
                    ? 'bg-orange-600 text-white'
                    : 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
                }`}>
                  <Wrench className="w-4 h-4" />
                </div>
                <span>قسم الصيانة والبرمجة</span>
              </div>
              {maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length > 0 && (
                <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded-full">
                  {maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length}
                </span>
              )}
            </button>

            {/* Settings config tab (Protected by PIN in Cashier mode) */}
            <button
              id="tab_trigger_settings"
              onClick={() => handleTabSelect('settings')}
              className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer w-full text-right ${
                activeTab === 'settings'
                  ? 'bg-slate-100 text-slate-900 font-bold border-r-4 border-slate-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  activeTab === 'settings'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-700 group-hover:bg-slate-700 group-hover:text-white'
                }`}>
                  <SettingsIcon className="w-4 h-4" />
                </div>
                <span>إعدادات النظام</span>
              </div>
              {(isCashierMode || settings.isPinEnabled) && (
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              )}
            </button>

          </nav>

          {/* Sidebar Logout button */}
          <div className="pt-2 border-t border-slate-200">
            <button
              id="sidebar_logout_btn"
              onClick={() => {
                if (confirm('⚠️ هل أنت متأكد من رغبتك في تسجيل الخروج وإلغاء ترخيص الجهاز؟')) {
                  handleLogout();
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer text-right"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>تسجيل الخروج</span>
            </button>
          </div>

          {/* Quick Help Section */}
          <div className="p-3.5 mt-6 rounded-2xl bg-slate-50 border border-slate-200 text-[10px] text-slate-500 space-y-1">
            <div className="font-bold text-slate-700 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-blue-600" /> معلومات النظام
            </div>
            <p>المخزن المحلي: نشط ومحفوظ 100%</p>
            <p>المهندس: عبدالمجيد المحواشي</p>
          </div>

        </aside>

        {/* 3. CORE SUB-VIEW HUB */}
        <main 
          id="desktop_sub_view_hub" 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 p-3 md:p-6 pb-20 md:pb-6 overflow-y-auto bg-[#F8FAFC] relative"
        >
          {/* Floating Mobile Swipe Toast Hint */}
          <AnimatePresence>
            {swipeHint && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                className="md:hidden fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#122234]/95 border border-[#C5A862] text-[#F3E7C4] text-xs font-bold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md pointer-events-none flex items-center gap-2"
              >
                <span>{swipeHint}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: swipeDirection === 'left' ? 25 : swipeDirection === 'right' ? -25 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: swipeDirection === 'left' ? -25 : swipeDirection === 'right' ? 25 : 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full h-full"
            >
              {activeTab === 'dashboard' && (
                <Dashboard
                  products={products}
                  customers={customers}
                  invoices={invoices}
                  payments={payments}
                  transactions={transactions}
                  settings={settings}
                  setActiveTab={setActiveTab}
                  isPrivacyMode={isPrivacyMode}
                />
              )}

              {activeTab === 'pos' && (
                <POS
                  products={products}
                  customers={customers}
                  onCompleteSale={handleCompleteSale}
                  currency={settings.currency}
                  storeName={settings.storeName}
                  settings={settings}
                />
              )}

              {activeTab === 'customers' && (
                <Customers
                  customers={customers}
                  payments={payments}
                  invoices={invoices}
                  onAddCustomer={handleAddCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onPayDebt={handlePayDebt}
                  onDeleteCustomer={handleDeleteCustomer}
                  currency={settings.currency}
                  storeName={settings.storeName}
                  isPrivacyMode={isPrivacyMode}
                  debtReminderTemplate={settings.debtReminderTemplate}
                  onSaveReminderTemplate={(tmpl) => {
                    const updated = { ...settings, debtReminderTemplate: tmpl };
                    setSettings(updated);
                    if (license.licenseKey) {
                      saveStoreSettings(license.licenseKey, updated);
                    }
                  }}
                />
              )}

              {activeTab === 'employees' && (
                <Employees
                  employees={employees}
                  payrollRecords={payrollRecords}
                  onAddEmployee={handleAddEmployee}
                  onRecordAdvance={handleRecordAdvance}
                  onPaySalary={handlePaySalary}
                  onDeleteEmployee={handleDeleteEmployee}
                  currency={settings.currency}
                />
              )}


              {activeTab === 'inventory' && (
                <Inventory
                  products={products}
                  onAddProduct={handleAddProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                  currency={settings.currency}
                  storeName={settings.storeName}
                  isPrivacyMode={isPrivacyMode}
                />
              )}

              {activeTab === 'stock_audit' && (
                <StockAudit
                  products={products}
                  invoices={invoices}
                  onUpdateProductStock={handleUpdateProductStock}
                  currency={settings.currency}
                  storeName={settings.storeName}
                  isPrivacyMode={isPrivacyMode}
                />
              )}

              {activeTab === 'transactions' && (
                <Transactions
                  transactions={transactions}
                  invoices={invoices}
                  onAddExpense={handleAddExpense}
                  onDeleteTransaction={handleDeleteTransaction}
                  onRefundInvoice={handleRefundInvoice}
                  onViewInvoice={setActiveInvoice}
                  currency={settings.currency}
                  isPrivacyMode={isPrivacyMode}
                />
              )}

              {activeTab === 'reports' && (
                <ProfitReports
                  invoices={invoices}
                  products={products}
                  transactions={transactions}
                  customers={customers}
                  currency={settings.currency}
                  isPrivacyMode={isPrivacyMode}
                />
              )}

              {activeTab === 'maintenance' && (
                <Maintenance
                  orders={maintenanceOrders}
                  onAddOrder={handleAddMaintenanceOrder}
                  onUpdateStatus={handleUpdateMaintenanceStatus}
                  onDeleteOrder={handleDeleteMaintenanceOrder}
                  currency={settings.currency}
                />
              )}

              {activeTab === 'settings' && (
                <Settings
                  settings={settings}
                  onSaveSettings={handleSaveSettings}
                  onBackupData={handleBackupData}
                  onRestoreData={handleRestoreData}
                  onResetDatabase={handleResetDatabase}
                />
              )}
            </motion.div>
          </AnimatePresence>

        </main>

      </div>

      {/* 4. THERMAL RECEIPT DIALOG MODAL Overlay */}
      {activeInvoice && (
        <InvoiceModal
          invoice={activeInvoice}
          onClose={() => setActiveInvoice(null)}
          settings={settings}
          customers={customers}
        />
      )}

      {/* APK Mobile App Download Modal */}
      <ApkDownloadModal
        isOpen={showApkModal}
        onClose={() => setShowApkModal(false)}
        storeName={settings.storeName}
      />

      {(showDevPortal || isDevRoute) && (
        <DeveloperPortalModal
          isOpen={showDevPortal || isDevRoute}
          onClose={() => {
            setShowDevPortal(false);
            if (isDevRoute) {
              window.history.pushState({}, '', '/');
              setIsDevRoute(false);
            }
          }}
          currentHwid={license.hwid}
          onResetCloudComplete={() => {
            setProducts([]);
            setCustomers([]);
            setInvoices([]);
            setPayments([]);
            setTransactions([]);
            setMaintenanceOrders([]);
          }}
        />
      )}

      {/* 4. MOBILE BOTTOM NAVIGATION BAR (Non-printed, Mobile view only) */}
      <nav id="mobile_bottom_nav" className="no-print md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 py-1.5 flex justify-around items-center shadow-lg select-none overflow-x-auto scrollbar-none">
        
        {/* Dashboard */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('dashboard');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'dashboard' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'dashboard' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span className="text-[8.5px]">الرئيسية</span>
        </button>

        {/* POS */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('pos');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'pos' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'pos' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <ShoppingCart className="w-4 h-4 mb-0.5" />
          <span className="text-[8.5px]">المبيعات</span>
        </button>

        {/* Inventory */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('inventory');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'inventory' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'inventory' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative">
            <Package className="w-4 h-4 mb-0.5" />
            {lowStockCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 text-[8px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center animate-pulse">
                {lowStockCount}
              </span>
            )}
          </div>
          <span className="text-[8.5px]">المخزن</span>
        </button>

        {/* Stock Audit */}
        <button
          onClick={() => handleTabSelect('stock_audit')}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'stock_audit' ? 'text-amber-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'stock_audit' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-amber-50 border border-amber-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <ClipboardCheck className="w-4 h-4 mb-0.5 text-[#C5A862]" />
          <span className="text-[8.5px]">جرد المنشأة</span>
        </button>

        {/* Customers */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('customers');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'customers' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'customers' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <Users className="w-4 h-4 mb-0.5" />
          <span className="text-[8.5px]">العملاء</span>
        </button>

        {/* Employees */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('employees');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'employees' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'employees' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <Briefcase className="w-4 h-4 mb-0.5" />
          <span className="text-[8.5px]">العمال</span>
        </button>

        {/* Transactions */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('transactions');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'transactions' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'transactions' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <History className="w-4 h-4 mb-0.5" />
          <span className="text-[8.5px]">القيود</span>
        </button>

        {/* Reports */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('reports');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'reports' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'reports' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <BarChart3 className="w-4 h-4 mb-0.5" />
          <span className="text-[8.5px]">الأرباح</span>
        </button>

        {/* Maintenance */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('maintenance');
          }}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'maintenance' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'maintenance' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <div className="relative">
            <Wrench className="w-4 h-4 mb-0.5" />
            {maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length > 0 && (
              <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 text-[8px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
                {maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length}
              </span>
            )}
          </div>
          <span className="text-[8.5px]">الصيانة</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => handleTabSelect('settings')}
          className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all min-w-[46px] shrink-0 ${
            activeTab === 'settings' ? 'text-blue-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'settings' && (
            <motion.div
              layoutId="mobileActiveTabBg"
              className="absolute inset-0 bg-blue-50 border border-blue-200 rounded-xl -z-10 shadow-xs"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <SettingsIcon className="w-4 h-4 mb-0.5" />
          <span className="text-[8.5px]">الإعدادات</span>
        </button>

      </nav>

      {/* 5. FOOTER (Non-printed, Desktop) */}
      <footer id="desktop_footer" className="no-print hidden md:flex h-8 bg-white border-t border-slate-200 px-6 justify-between items-center text-[10px] text-slate-500 font-medium">
        <span>نظام سند الذكي المحاسبي • نسخة الهواتف والكمبيوتر</span>
        <span>برمجة وتطوير: عبدالمجيد المحواشي (الجمهورية اليمنية) © 2026</span>
      </footer>

      {/* Floating Calculator Widget */}
      <FloatingCalculator />

      {/* PIN Verification Modal for Cashier / Manager Mode */}
      <PinCheckModal
        isOpen={showPinCheckModal}
        onClose={() => {
          setShowPinCheckModal(false);
          setPendingProtectedTab(null);
        }}
        onSuccess={() => {
          setShowPinCheckModal(false);
          if (pendingProtectedTab) {
            setActiveTab(pendingProtectedTab);
            setPendingProtectedTab(null);
          } else {
            setIsCashierMode(false);
          }
        }}
        pinCode={settings.pinCode || '1234'}
      />

      {/* PIN Verification Modal for Privacy Mode Unlocking */}
      <PinCheckModal
        isOpen={showPrivacyPinModal}
        onClose={() => setShowPrivacyPinModal(false)}
        onSuccess={() => {
          setShowPrivacyPinModal(false);
          setIsPrivacyMode(false);
        }}
        pinCode={settings.privacyPinCode || settings.pinCode || '1234'}
        title="كلمة سر وضع الخصوصية 👁️"
        subtitle="يرجى إدخال رمز PIN لإلغاء إخفاء المبالغ وإظهار القيم والأسعار المالية"
      />

    </div>
  );
}
