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
  Boxes,
  ArrowRight,
  Home
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
import Navigation from './components/Navigation';
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
import { findLicenseByHwid, checkLicenseOnCloud } from './utils/firebase';
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

    // Complete purge of legacy licenses, user tokens, Google account linkages & sessions
    const keysToRemove = [
      'smart_accounting_license_v1',
      'smart_accounting_license',
      'smart_accounting_user',
      'smart_accounting_token',
      'google_account_token',
      'google_user_account',
      'google_auth_token',
      'google_oauth_token',
      'google_id_token',
      'google_access_token',
      'sond_google_account',
      'sond_user_session',
      'firebase:authUser',
      'gdrive_backup_token'
    ];

    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Remove any additional Google or OAuth keys from localStorage
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.toLowerCase().includes('google') || key.toLowerCase().includes('firebase:auth') || key.toLowerCase().includes('oauth')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('LocalStorage purge error:', e);
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }

    setActiveTab('dashboard');
  };

  // Real-time silent cloud license activation/blocking check
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const silentCheck = async () => {
      // If user explicitly logged out, do NOT auto-login or auto-activate silently!
      if (localStorage.getItem('smart_accounting_logged_out') === 'true') {
        return;
      }
      if (!license.hwid) return;

      try {
        if (license.licenseKey) {
          const res = await checkLicenseOnCloud(license.licenseKey, license.hwid);
          if (res.success && res.data) {
            const expiryDate = new Date(res.data.expiresAt);
            const isExpired = expiryDate < new Date();

            if (res.data.status === 'suspended') {
              const updated: LicenseInfo = {
                licenseKey: res.data.key,
                status: 'unlicensed',
                activatedAt: license.activatedAt || new Date().toISOString(),
                expiresAt: res.data.expiresAt,
                hwid: license.hwid,
                subscriptionType: res.data.type,
                customerName: res.data.customerName
              };
              saveLicenseLocally(updated);
              setLicense(updated);
              return;
            }

            if (isExpired) {
              const updated: LicenseInfo = {
                licenseKey: res.data.key,
                status: 'expired',
                activatedAt: license.activatedAt || new Date().toISOString(),
                expiresAt: res.data.expiresAt,
                hwid: license.hwid,
                subscriptionType: res.data.type,
                customerName: res.data.customerName
              };
              saveLicenseLocally(updated);
              setLicense(updated);
              return;
            }

            // Update license details safely
            const updated: LicenseInfo = {
              licenseKey: res.data.key,
              status: res.data.type === 'trial' ? 'trial' : 'active',
              activatedAt: license.activatedAt || new Date().toISOString(),
              expiresAt: res.data.expiresAt,
              hwid: license.hwid,
              subscriptionType: res.data.type,
              customerName: res.data.customerName || license.customerName,
              phone: res.data.phone || license.phone
            };

            if (license.status !== 'active' && license.status !== 'trial') {
              soundManager.playSuccessChime();
            }

            saveLicenseLocally(updated);
            setLicense(updated);
          } else if (res.message === 'KEY_SUSPENDED') {
            const updated: LicenseInfo = {
              ...license,
              status: 'unlicensed',
              licenseKey: ''
            };
            saveLicenseLocally(updated);
            setLicense(updated);
          } else if (res.message === 'KEY_EXPIRED') {
            const updated: LicenseInfo = {
              ...license,
              status: 'expired'
            };
            saveLicenseLocally(updated);
            setLicense(updated);
          } else if (res.message === 'KEY_NOT_FOUND') {
            // Key was deleted remotely from Cloud Admin
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
          // Note: If SERVER_ERROR or offline, we preserve current local active license state!
        } else {
          // No license key locally: check if this HWID is registered on Cloud for auto-activation
          const cloudLic = await findLicenseByHwid(license.hwid);
          if (cloudLic && cloudLic.status === 'active') {
            const expiryDate = new Date(cloudLic.expiresAt);
            if (expiryDate >= new Date()) {
              const updated: LicenseInfo = {
                licenseKey: cloudLic.key,
                status: cloudLic.type === 'trial' ? 'trial' : 'active',
                activatedAt: new Date().toISOString(),
                expiresAt: cloudLic.expiresAt,
                hwid: license.hwid,
                subscriptionType: cloudLic.type,
                customerName: cloudLic.customerName,
                phone: cloudLic.phone
              };
              soundManager.playSuccessChime();
              saveLicenseLocally(updated);
              setLicense(updated);
            }
          }
        }
      } catch (err) {
        console.warn('Global silent check error (retaining offline state):', err);
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



  // Immediate Reactive Theme & Layout DOM class synchronization
  useEffect(() => {
    const theme = settings.appTheme || 'financial-blue';
    const shape = settings.cardShape || 'soft';
    const density = settings.density || 'comfortable';

    const themeClass = `theme-${theme}`;
    const shapeClass = `shape-${shape}`;
    const densityClass = `density-${density}`;
    const fullClass = `${themeClass} ${shapeClass} ${densityClass}`;

    document.documentElement.className = fullClass;
    if (theme === 'dark-luxury') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.appTheme, settings.cardShape, settings.density]);

  // Action: Save settings
  const handleSaveSettings = (newSettings: SystemSettings) => {
    localStorage.setItem('smart_accounting_settings', JSON.stringify(newSettings));
    setSettings(newSettings);

    const theme = newSettings.appTheme || 'financial-blue';
    const shape = newSettings.cardShape || 'soft';
    const density = newSettings.density || 'comfortable';
    document.documentElement.className = `theme-${theme} shape-${shape} density-${density}`;
    if (theme === 'dark-luxury') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (license.licenseKey) {
      saveStoreSettings(license.licenseKey, newSettings);
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
        
        {/* NAVIGATION SYSTEM (Dual-Layout Engine based on deviceMode) */}
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleTabSelect={handleTabSelect}
          settings={settings}
          products={products}
          maintenanceOrders={maintenanceOrders}
          isCashierMode={isCashierMode}
          setIsCashierMode={setIsCashierMode}
          isPrivacyMode={isPrivacyMode}
          setIsPrivacyMode={setIsPrivacyMode}
          setShowPinCheckModal={setShowPinCheckModal}
          setShowPrivacyPinModal={setShowPrivacyPinModal}
          handleLogout={handleLogout}
        />

        {/* 3. CORE SUB-VIEW HUB */}
        <main 
          id="desktop_sub_view_hub" 
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex-1 p-2 sm:p-3 md:p-6 pb-20 md:pb-6 overflow-y-auto bg-[#F8FAFC] relative"
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
              {/* TOP APP BAR FOR SUB-VIEWS WITH BACK BUTTON */}
              {activeTab !== 'dashboard' && (
                <div className="mb-2.5 sm:mb-4 bg-white dark:bg-[#0F1824] p-2 sm:p-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-sky-900/40 shadow-sm flex items-center justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        soundManager.playScanBeep();
                        setActiveTab('dashboard');
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-extrabold text-xs transition shadow-md active:scale-95 cursor-pointer"
                      title="العودة فوراً للشاشة الرئيسية"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>العودة للرئيسية 🏠</span>
                    </button>

                    <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {activeTab === 'pos' && <ShoppingCart className="w-4 h-4 text-emerald-600" />}
                        {activeTab === 'inventory' && <Package className="w-4 h-4 text-purple-600" />}
                        {activeTab === 'customers' && <Users className="w-4 h-4 text-sky-600" />}
                        {activeTab === 'maintenance' && <Wrench className="w-4 h-4 text-amber-600" />}
                        {activeTab === 'employees' && <Briefcase className="w-4 h-4 text-indigo-600" />}
                        {activeTab === 'reports' && <BarChart3 className="w-4 h-4 text-emerald-600" />}
                        {activeTab === 'stock_audit' && <ClipboardCheck className="w-4 h-4 text-blue-600" />}
                        {activeTab === 'transactions' && <History className="w-4 h-4 text-slate-600" />}
                        {activeTab === 'settings' && <SettingsIcon className="w-4 h-4 text-slate-600" />}
                      </span>
                      <h2 className="text-sm font-black text-slate-800 dark:text-white">
                        {activeTab === 'pos' && 'نقطة البيع السريعة (POS)'}
                        {activeTab === 'inventory' && 'إدارة المستودع والمخزون'}
                        {activeTab === 'customers' && 'حسابات العملاء والديون والتحصيل'}
                        {activeTab === 'maintenance' && 'قسم الصيانة والورشة واستلام الأجهزة'}
                        {activeTab === 'employees' && 'قسم الموظفين والرواتب والسلف'}
                        {activeTab === 'reports' && 'الأرباح والتقارير المالية البيانية'}
                        {activeTab === 'stock_audit' && 'حصر وجرد المنشأة الميداني'}
                        {activeTab === 'transactions' && 'دفتر القيود والأرشيف والمصاريف'}
                        {activeTab === 'settings' && 'إعدادات النظام والترخيص'}
                      </h2>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full hidden sm:inline-block">
                    تطبيق سند المحاسبي • شاشة خاصة
                  </span>
                </div>
              )}
              {activeTab === 'dashboard' && (
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
