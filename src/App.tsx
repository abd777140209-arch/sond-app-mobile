/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  ShoppingCart, 
  Users, 
  Package, 
  BarChart3, 
  Menu, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  LogOut, 
  ArrowRight,
  Shield,
  ShieldAlert,
  Database,
  Download,
  Upload
} from 'lucide-react';

import { Product, Customer, Invoice, Payment, Transaction, SystemSettings, MaintenanceOrder, Employee, PayrollRecord, UserAccount, AuditLog } from './types';
import { soundManager } from './utils/sound';
import { 
  DEFAULT_SETTINGS, 
  SEED_PRODUCTS, 
  SEED_CUSTOMERS, 
  SEED_INVOICES, 
  SEED_PAYMENTS, 
  SEED_TRANSACTIONS 
} from './utils/seedData';

import MobileDashboardView from './components/MobileDashboardView';
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
import UsersComponent from './components/Users';
import SaaSActivator from './components/SaaSActivator';
import BiometricLockModal from './components/BiometricLockModal';
import FloatingCalculator from './components/FloatingCalculator';
import SanadVoiceAssistant from './components/SanadVoiceAssistant';
import SanadDiagnosticScreen from './components/SanadDiagnosticScreen';
import SanadPhoneLedger from './components/SanadPhoneLedger';
import SanadDeviceReceipt from './components/SanadDeviceReceipt';
import SanadEnterpriseDashboard from './components/SanadEnterpriseDashboard';
import PinCheckModal from './components/PinCheckModal';
import DeveloperPortalModal from './components/DeveloperPortalModal';

import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { saveAndShareFile, saveSilentBackupFile, getBackupTimestamp, getCustomSaveFolder } from './utils/fileExport';
import { LicenseInfo, loadLicenseLocally, saveLicenseLocally, generateHWID } from './utils/licensing';
import { 
  saveStoreDocument, 
  deleteStoreDocument, 
  saveStoreSettings, 
  syncStoreCollection, 
  syncStoreSettings 
} from './utils/firebaseSync';
import { listenToLicenseOnCloud, checkLicenseOnCloud } from './utils/firebase';

export default function App() {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const data = localStorage.getItem('smart_accounting_settings');
    const parsed = data ? JSON.parse(data) : { ...DEFAULT_SETTINGS };

    const savedLogo = localStorage.getItem('smart_accounting_company_logo') || localStorage.getItem('sanad_store_logo');
    if (savedLogo && !parsed.storeLogoUrl) {
      parsed.storeLogoUrl = savedLogo;
    }
    return parsed;
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
    return data ? JSON.parse(data) : [];
  });

  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(() => {
    const data = localStorage.getItem('smart_accounting_payroll');
    return data ? JSON.parse(data) : [];
  });

  const DEFAULT_USERS: UserAccount[] = [
    {
      id: 'usr-1',
      username: 'admin',
      name: 'المدير العام',
      role: 'admin',
      phone: '770000000',
      pin: '1234',
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-2',
      username: 'cashier',
      name: 'أحمد الكاشير',
      role: 'cashier',
      phone: '771111111',
      pin: '0000',
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-3',
      username: 'tech',
      name: 'مهندس الورشة والصيانة',
      role: 'technician',
      phone: '772222222',
      pin: '1111',
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-4',
      username: 'accountant',
      name: 'المحاسب المالي',
      role: 'accountant',
      phone: '773333333',
      pin: '2222',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ];

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const data = localStorage.getItem('smart_accounting_users');
    return data ? JSON.parse(data) : DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    const data = localStorage.getItem('smart_accounting_current_user');
    if (data) {
      try { return JSON.parse(data); } catch (e) {}
    }
    return DEFAULT_USERS[0];
  });

  useEffect(() => {
    localStorage.setItem('smart_accounting_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_payments', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_maintenance', JSON.stringify(maintenanceOrders));
  }, [maintenanceOrders]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_payroll', JSON.stringify(payrollRecords));
  }, [payrollRecords]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('smart_accounting_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const data = localStorage.getItem('smart_accounting_audit_logs');
    return data ? JSON.parse(data) : [
      {
        id: 'log-1',
        timestamp: new Date().toISOString(),
        userName: 'المدير العام',
        userRole: 'admin',
        actionType: 'system_start',
        actionLabel: 'تشغيل النظام وإعداد جدول الصلاحيات والتدقيق',
        details: 'تم تجهيز الأدوار الأربعة (مدير، كاشير، فني صيانة، محاسب)'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('smart_accounting_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const addAuditLog = (actionType: string, actionLabel: string, details?: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      userName: currentUser?.name || 'مستخدم النظام',
      userRole: currentUser?.role || 'admin',
      actionType,
      actionLabel,
      details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleAddUser = (user: Omit<UserAccount, 'id' | 'createdAt'>) => {
    const newUser: UserAccount = {
      ...user,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setUsers(prev => [...prev, newUser]);
    addAuditLog('user_created', `إضافة مستخدم جديد: ${newUser.name}`, `الدور: ${newUser.role}`);
  };

  const handleUpdateUser = (id: string, updated: Partial<UserAccount>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u));
    addAuditLog('user_updated', `تحديث بيانات المستخدم ID: ${id}`, JSON.stringify(updated));
  };

  const handleDeleteUser = (id: string) => {
    const target = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    if (target) {
      addAuditLog('user_deleted', `حذف حساب المستخدم: ${target.name}`, `اسم المستخدم: ${target.username}`);
    }
  };

  const handleClearAuditLogs = () => {
    setAuditLogs([]);
    addAuditLog('audit_cleared', 'مسح سجل الأنشطة والتدقيق', 'قام المدير بمسح السجل القديم');
  };

  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    return localStorage.getItem('smart_accounting_privacy_mode') === 'true';
  });
  const [showPrivacyPinModal, setShowPrivacyPinModal] = useState<boolean>(false);
  const [showSanadAssistant, setShowSanadAssistant] = useState<boolean>(false);

  const [isCashierMode, setIsCashierMode] = useState<boolean>(() => {
    return localStorage.getItem('smart_accounting_cashier_mode') === 'true';
  });

  const [showPinCheckModal, setShowPinCheckModal] = useState<boolean>(false);
  const [pendingProtectedTab, setPendingProtectedTab] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const handleTabSelect = (tab: string) => {
    const protectedList = settings.protectedSections || ['settings', 'reports'];
    const isTabProtected = protectedList.includes(tab);
    const isRestricted = isTabProtected && (isCashierMode || settings.isPinEnabled);

    if (isRestricted) {
      soundManager.playWarningBeep();
      setPendingProtectedTab(tab);
      setShowPinCheckModal(true);
    } else {
      soundManager.playScanBeep();
      setActiveTab(tab);
    }
  };

  const [isDevAdminRoute, setIsDevAdminRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return path === '/admin' || path.endsWith('/admin') || search.includes('admin') || hash.includes('admin');
  });

  const [showDeveloperModal, setShowDeveloperModal] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return path === '/admin' || path.endsWith('/admin') || search.includes('admin') || hash.includes('admin');
  });

  useEffect(() => {
    const checkAdminRoute = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        if (path === '/admin' || path.endsWith('/admin') || search.includes('admin') || hash.includes('admin')) {
          setIsDevAdminRoute(true);
          setShowDeveloperModal(true);
        }
      }
    };
    checkAdminRoute();
    window.addEventListener('popstate', checkAdminRoute);
    return () => window.removeEventListener('popstate', checkAdminRoute);
  }, []);

  const [license, setLicense] = useState<LicenseInfo>(() => loadLicenseLocally());
  const isActivated = license.status === 'active' || license.status === 'trial' || isDevAdminRoute;
  const [showRevokedModal, setShowRevokedModal] = useState<boolean>(false);

  // 🔒 Real-time Firestore License Enforcement (Auto-Locks immediately if Developer deletes or suspends license)
  useEffect(() => {
    if (!license.licenseKey || license.status === 'unlicensed' || isDevAdminRoute) {
      return;
    }

    const currentKey = license.licenseKey;
    const currentHwid = license.hwid || generateHWID();

    const handleLicenseRevoked = (reason: string) => {
      console.warn(`[License Security] License key ${currentKey} was ${reason} on Cloud! Revoking access...`);
      soundManager.playWarningBeep();

      const revokedLicense: LicenseInfo = {
        licenseKey: '',
        status: 'unlicensed',
        activatedAt: '',
        expiresAt: '',
        hwid: currentHwid,
        subscriptionType: 'trial',
        customerName: 'حساب موقوف / ترخيص ملغى'
      };

      saveLicenseLocally(revokedLicense);
      setLicense(revokedLicense);
      setShowRevokedModal(true);
    };

    // 1. Attach Real-Time Firestore Snapshot Listener
    const unsubRealtime = listenToLicenseOnCloud(currentKey, (status) => {
      if (status === 'deleted' || status === 'suspended' || status === 'expired' || status === 'not_found') {
        handleLicenseRevoked(status);
      }
    });

    // 2. Periodic Active Verification Check (every 20 seconds when online)
    const checkActiveCloudLicense = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const checkRes = await checkLicenseOnCloud(currentKey, currentHwid);
        if (!checkRes.success) {
          if (checkRes.message === 'KEY_NOT_FOUND' || checkRes.message === 'KEY_SUSPENDED' || checkRes.message === 'KEY_EXPIRED') {
            handleLicenseRevoked(checkRes.message);
          }
        }
      } catch (err) {
        console.warn('Periodic license check warning:', err);
      }
    };

    // Initial check on mount
    checkActiveCloudLicense();

    const intervalId = setInterval(checkActiveCloudLicense, 20000);

    return () => {
      unsubRealtime();
      clearInterval(intervalId);
    };
  }, [license.licenseKey, license.status, isDevAdminRoute]);
  const [isBiometricLocked, setIsBiometricLocked] = useState<boolean>(() => {
    return localStorage.getItem('sond_biometrics_enabled') === 'true';
  });

  const handleLogout = () => {
    soundManager.playWarningBeep();
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
    setActiveTab('dashboard');
  };

  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!license.licenseKey || !isActivated) return;

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

  // 🔄 WhatsApp-Style Automatic Backup Scheduler & Exit Backup
  useEffect(() => {
    if (!settings) return;

    const runScheduledBackupCheck = async () => {
      const now = Date.now();
      const nowIso = new Date().toISOString();
      let updateNeeded = false;
      const updatedSettings = { ...settings };

      // 1. Local Backup Schedule Check
      const localSched = settings.localBackupSchedule || 'daily';
      if (localSched !== 'off') {
        const lastLocalMs = settings.lastLocalBackupDate ? new Date(settings.lastLocalBackupDate).getTime() : 0;
        let intervalMs = 24 * 60 * 60 * 1000; // daily
        if (localSched === 'weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;
        if (localSched === 'monthly') intervalMs = 30 * 24 * 60 * 60 * 1000;

        if (now - lastLocalMs >= intervalMs) {
          console.log(`[Scheduled Local Backup] Due for frequency (${localSched}). Creating silent local backup...`);
          const backupObj = { settings, products, customers, invoices, payments, transactions, exportedAt: nowIso };
          const jsonStr = JSON.stringify(backupObj, null, 2);
          const fileName = `sanad_backup_auto_${getBackupTimestamp()}.json`;
          const folder = settings.backupFolderPath || 'Documents/SanadAccounting';

          await saveSilentBackupFile(fileName, jsonStr, folder);
          updatedSettings.lastLocalBackupDate = nowIso;
          updateNeeded = true;
        }
      }

      // 2. Drive Backup Schedule Check
      const driveSched = settings.driveBackupSchedule || 'weekly';
      if (driveSched !== 'off') {
        const lastDriveMs = settings.lastDriveBackupDate ? new Date(settings.lastDriveBackupDate).getTime() : 0;
        let intervalMs = 7 * 24 * 60 * 60 * 1000; // weekly
        if (driveSched === 'daily') intervalMs = 24 * 60 * 60 * 1000;
        if (driveSched === 'monthly') intervalMs = 30 * 24 * 60 * 60 * 1000;

        if (now - lastDriveMs >= intervalMs) {
          console.log(`[Scheduled Drive Backup] Due for frequency (${driveSched}). Syncing cloud drive backup...`);
          const backupObj = { settings, products, customers, invoices, payments, transactions, exportedAt: nowIso };
          const jsonStr = JSON.stringify(backupObj, null, 2);
          localStorage.setItem('sanad_drive_last_backup_data', jsonStr);

          updatedSettings.lastDriveBackupDate = nowIso;
          updateNeeded = true;
        }
      }

      if (updateNeeded) {
        setSettings(updatedSettings);
        localStorage.setItem('smart_accounting_settings', JSON.stringify(updatedSettings));
      }
    };

    const timer = setTimeout(() => {
      runScheduledBackupCheck();
    }, 4000);

    return () => clearTimeout(timer);
  }, [settings?.localBackupSchedule, settings?.driveBackupSchedule, settings?.lastLocalBackupDate, settings?.lastDriveBackupDate]);

  // 🚪 Auto-backup on app exit / pagehide
  useEffect(() => {
    if (!settings || settings.autoBackupOnExit === false) return;

    const handleExitBackup = () => {
      const nowIso = new Date().toISOString();
      const backupObj = { settings, products, customers, invoices, payments, transactions, exportedAt: nowIso };
      const jsonStr = JSON.stringify(backupObj, null, 2);
      const fileName = `sanad_backup_exit_${getBackupTimestamp()}.json`;
      const folder = settings.backupFolderPath || 'Documents/SanadAccounting';

      saveSilentBackupFile(fileName, jsonStr, folder);
    };

    window.addEventListener('pagehide', handleExitBackup);
    return () => {
      window.removeEventListener('pagehide', handleExitBackup);
    };
  }, [settings?.autoBackupOnExit, settings, products, customers, invoices, payments, transactions]);

  // 📱 التعامل مع زر الرجوع لإنهاء/إغلاق القوائم أو العودة للرئيسية في أندرويد
  useEffect(() => {
    const handleAndroidBack = async () => {
      // إرسال حدث مخصص لإغلاق النوافذ الفرعية المفتوحة (مثل المساعد الصوتي، نافذة زارا، أو الجرد)
      window.dispatchEvent(new CustomEvent('android-modal-close'));

      if (showDeveloperModal) {
        setShowDeveloperModal(false);
        return;
      }
      if (activeInvoice) {
        setActiveInvoice(null);
        return;
      }
      if (showPinCheckModal) {
        setShowPinCheckModal(false);
        return;
      }
      if (showPrivacyPinModal) {
        setShowPrivacyPinModal(false);
        return;
      }

      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        return;
      }

      // إذا كان المستخدم في الشاشة الرئيسية ولا توجد نوافذ مفتوحة، يصغّر التطبيق
      try {
        await CapacitorApp.minimizeApp();
      } catch (e) {
        // متصفح عادي
      }
    };

    let listenerHandler: any = null;
    if (Capacitor.isNativePlatform()) {
      try {
        CapacitorApp.addListener('backButton', handleAndroidBack).then(h => {
          listenerHandler = h;
        }).catch(() => {});
      } catch (err) {
        // Fallback
      }
    }

    const handlePopState = () => {
      window.dispatchEvent(new CustomEvent('android-modal-close'));
      if (showDeveloperModal) {
        setShowDeveloperModal(false);
        return;
      }
      if (activeInvoice) {
        setActiveInvoice(null);
        return;
      }
      if (showPinCheckModal) {
        setShowPinCheckModal(false);
        return;
      }
      if (showPrivacyPinModal) {
        setShowPrivacyPinModal(false);
        return;
      }
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      if (listenerHandler && typeof listenerHandler.remove === 'function') {
        listenerHandler.remove();
      }
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab, activeInvoice, showPinCheckModal, showPrivacyPinModal, showDeveloperModal]);

  const handleSaveSettings = (newSettings: SystemSettings) => {
    localStorage.setItem('smart_accounting_settings', JSON.stringify(newSettings));
    if (newSettings.storeLogoUrl) {
      localStorage.setItem('smart_accounting_company_logo', newSettings.storeLogoUrl);
    }
    setSettings(newSettings);
    if (license.licenseKey) saveStoreSettings(license.licenseKey, newSettings);
    addAuditLog('settings_updated', 'تحديث إعدادات النظام واسم النشاط التجارية');
  };

  const handleCompleteSale = (saleData: Omit<Invoice, 'id' | 'invoiceNumber'>) => {
    const nextInvoiceNum = `INV-${invoices.length + 1001}`;
    const invoiceId = `inv-${Date.now()}`;

    const newInvoice: Invoice = {
      ...saleData,
      id: invoiceId,
      invoiceNumber: nextInvoiceNum
    };

    const updatedProducts = products.map(p => {
      const soldItem = saleData.items.find(item => item.productId === p.id);
      return soldItem ? { ...p, stock: Math.max(0, p.stock - soldItem.quantity) } : p;
    });

    let updatedCustomer: Customer | null = null;
    if (saleData.type === 'debt' && saleData.customerId) {
      const c = customers.find(cust => cust.id === saleData.customerId);
      if (c) updatedCustomer = { ...c, totalDebt: c.totalDebt + saleData.finalAmount };
    }

    const newTransaction: Transaction = {
      id: `t-${Date.now()}`,
      type: 'sale',
      amount: saleData.finalAmount,
      date: saleData.date,
      description: `مبيعات فاتورة ${nextInvoiceNum} لـ ${saleData.customerName}`
    };

    // Always update local React state synchronously
    setProducts(updatedProducts);
    if (updatedCustomer) setCustomers(prev => prev.map(c => c.id === updatedCustomer!.id ? updatedCustomer! : c));
    setInvoices(prev => [newInvoice, ...prev]);
    setTransactions(prev => [newTransaction, ...prev]);

    // Also sync to Cloud Firestore if SaaS license key is present
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'invoices', invoiceId, newInvoice);
      saveStoreDocument(license.licenseKey, 'transactions', newTransaction.id, newTransaction);
      updatedProducts.forEach(p => saveStoreDocument(license.licenseKey, 'products', p.id, p));
      if (updatedCustomer) saveStoreDocument(license.licenseKey, 'customers', updatedCustomer.id, updatedCustomer);
    }

    addAuditLog('sale_completed', `إصدار فاتورة مبيعات #${nextInvoiceNum}`, `العميل: ${saleData.customerName} - المبلغ: ${saleData.finalAmount} ${settings.currency}`);
    setActiveInvoice(newInvoice);
  };

  const handleAddCustomer = (custData: Omit<Customer, 'id' | 'createdAt'> & { totalDebt?: number }) => {
    const debtAmount = custData.totalDebt ?? custData.initialDebt ?? custData.balance ?? 0;
    const newCustomer: Customer = {
      id: `c-${Date.now()}`,
      ...custData,
      totalDebt: debtAmount,
      balance: debtAmount,
      initialDebt: debtAmount,
      createdAt: new Date().toISOString()
    };
    setCustomers(prev => [...prev, newCustomer]);
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'customers', newCustomer.id, newCustomer);
  };

  const handleUpdateCustomer = (updatedCustomer: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'customers', updatedCustomer.id, updatedCustomer);
  };

  const handleDeleteCustomer = (customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;
    const softDeleted = { ...cust, isDeleted: true, isActive: false };
    setCustomers(prev => prev.map(c => c.id === customerId ? softDeleted : c));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'customers', customerId, softDeleted);
  };

  const handlePayDebt = (customerId: string, amount: number, note: string) => {
    const payId = `pay-${Date.now()}`;
    const dateStr = new Date().toISOString();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const newPayment: Payment = { id: payId, customerId, customerName: customer.name, amount, date: dateStr, note };
    const newTransaction: Transaction = { id: `t-${Date.now()}`, type: 'payment', amount, date: dateStr, description: `سداد ديون: ${customer.name}` };
    const updatedCustomer: Customer = { ...customer, totalDebt: Math.max(0, customer.totalDebt - amount) };

    setCustomers(prev => prev.map(c => c.id === customerId ? updatedCustomer : c));
    setPayments(prev => [...prev, newPayment]);
    setTransactions(prev => [...prev, newTransaction]);

    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'payments', payId, newPayment);
      saveStoreDocument(license.licenseKey, 'transactions', newTransaction.id, newTransaction);
      saveStoreDocument(license.licenseKey, 'customers', customerId, updatedCustomer);
    }
  };

  const handleAddProduct = (productData: Omit<Product, 'id'>) => {
    const newProduct: Product = { id: `p-${Date.now()}`, ...productData };
    setProducts(prev => [...prev, newProduct]);
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', newProduct.id, newProduct);
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', updatedProduct.id, updatedProduct);
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const softDeleted = { ...prod, isDeleted: true, stock: 0 };
    setProducts(prev => prev.map(p => p.id === productId ? softDeleted : p));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', productId, softDeleted);
  };

  const handleUpdateProductStock = (productId: string, newStock: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const updated = { ...prod, stock: newStock };
    setProducts(prev => prev.map(p => p.id === productId ? updated : p));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', productId, updated);
  };

  const handleAddExpense = (amount: number, description: string) => {
    const newTx: Transaction = { id: `t-${Date.now()}`, type: 'expense', amount, date: new Date().toISOString(), description: `مصروفات: ${description}` };
    setTransactions(prev => [...prev, newTx]);
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'transactions', newTx.id, newTx);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (license.licenseKey) deleteStoreDocument(license.licenseKey, 'transactions', id);
  };

  const handleAddMaintenanceOrder = (orderData: Omit<MaintenanceOrder, 'id' | 'orderNumber' | 'dateReceived'>) => {
    const orderNum = `${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: MaintenanceOrder = {
      id: `m-${Date.now()}`,
      orderNumber: orderNum,
      dateReceived: new Date().toISOString(),
      ...orderData
    };

    setMaintenanceOrders(prev => [...prev, newOrder]);
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'maintenanceOrders', newOrder.id, newOrder);
    }

    addAuditLog('maintenance_created', `استلام جهاز صيانة جديد #${orderNum}`, `العميل: ${newOrder.customerName} - الجهاز: ${newOrder.deviceName}`);
  };

  const handleUpdateMaintenanceStatus = (id: string, status: MaintenanceOrder['status']) => {
    const order = maintenanceOrders.find(o => o.id === id);
    if (!order) return;
    const updated = { ...order, status };

    setMaintenanceOrders(prev => prev.map(o => o.id === id ? updated : o));
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'maintenanceOrders', id, updated);
    }

    const statusMap = { received: 'مستلم', repairing: 'جاري الصيانة', completed: 'جاهز للاستلام', delivered: 'تم التسليم' };
    addAuditLog('maintenance_status_changed', `تغيير حالة كرت الصيانة #${order.orderNumber}`, `الحالة الجديدة: ${statusMap[status] || status}`);
  };

  const handleDeleteMaintenanceOrder = (id: string) => {
    const order = maintenanceOrders.find(o => o.id === id);
    setMaintenanceOrders(prev => prev.filter(o => o.id !== id));
    if (license.licenseKey) {
      deleteStoreDocument(license.licenseKey, 'maintenanceOrders', id);
    }

    if (order) {
      addAuditLog('maintenance_deleted', `حذف كرت صيانة #${order.orderNumber}`, `العميل: ${order.customerName} - الجهاز: ${order.deviceName}`);
    }
  };

  const handleBackupData = async (): Promise<boolean> => {
    soundManager.playSuccessChime();
    const backupObj = {
      settings,
      products,
      customers,
      invoices,
      payments,
      transactions,
      maintenanceOrders,
      employees,
      payrollRecords,
      users,
      exportedAt: new Date().toISOString()
    };
    const fileName = `Sanad_Backup_${getBackupTimestamp()}.json`;
    const jsonStr = JSON.stringify(backupObj, null, 2);

    const success = await saveAndShareFile({
      fileName,
      data: jsonStr,
      mimeType: 'application/json',
      title: 'نسخة احتياطية - نظام سند المحاسبي',
      text: `ملف النسخة الاحتياطية لقاعدة البيانات بتاريخ ${new Date().toLocaleDateString('ar-YE')}`,
      folderName: getCustomSaveFolder()
    });

    if (success) {
      addAuditLog('backup_created', 'أخذ نسخة احتياطية كاملة لقاعدة البيانات', `ملف: ${fileName}`);
    }
    return success;
  };

  const handleRestoreData = async (restored: any): Promise<boolean> => {
    if (!restored || typeof restored !== 'object') return false;

    if (restored.settings) {
      setSettings(restored.settings);
      localStorage.setItem('smart_accounting_settings', JSON.stringify(restored.settings));
      if (license.licenseKey) {
        saveStoreSettings(license.licenseKey, restored.settings);
      }
    }
    if (Array.isArray(restored.products)) {
      setProducts(restored.products);
      localStorage.setItem('smart_accounting_products', JSON.stringify(restored.products));
      if (license.licenseKey) {
        restored.products.forEach((p: any) => p && p.id && saveStoreDocument(license.licenseKey, 'products', p.id, p));
      }
    }
    if (Array.isArray(restored.customers)) {
      setCustomers(restored.customers);
      localStorage.setItem('smart_accounting_customers', JSON.stringify(restored.customers));
      if (license.licenseKey) {
        restored.customers.forEach((c: any) => c && c.id && saveStoreDocument(license.licenseKey, 'customers', c.id, c));
      }
    }
    if (Array.isArray(restored.invoices)) {
      setInvoices(restored.invoices);
      localStorage.setItem('smart_accounting_invoices', JSON.stringify(restored.invoices));
      if (license.licenseKey) {
        restored.invoices.forEach((inv: any) => inv && inv.id && saveStoreDocument(license.licenseKey, 'invoices', inv.id, inv));
      }
    }
    if (Array.isArray(restored.payments)) {
      setPayments(restored.payments);
      localStorage.setItem('smart_accounting_payments', JSON.stringify(restored.payments));
      if (license.licenseKey) {
        restored.payments.forEach((pay: any) => pay && pay.id && saveStoreDocument(license.licenseKey, 'payments', pay.id, pay));
      }
    }
    if (Array.isArray(restored.transactions)) {
      setTransactions(restored.transactions);
      localStorage.setItem('smart_accounting_transactions', JSON.stringify(restored.transactions));
      if (license.licenseKey) {
        restored.transactions.forEach((tx: any) => tx && tx.id && saveStoreDocument(license.licenseKey, 'transactions', tx.id, tx));
      }
    }
    if (Array.isArray(restored.maintenanceOrders)) {
      setMaintenanceOrders(restored.maintenanceOrders);
      localStorage.setItem('smart_accounting_maintenance', JSON.stringify(restored.maintenanceOrders));
      if (license.licenseKey) {
        restored.maintenanceOrders.forEach((m: any) => m && m.id && saveStoreDocument(license.licenseKey, 'maintenanceOrders', m.id, m));
      }
    }
    if (Array.isArray(restored.employees)) {
      setEmployees(restored.employees);
      localStorage.setItem('smart_accounting_employees', JSON.stringify(restored.employees));
      if (license.licenseKey) {
        restored.employees.forEach((emp: any) => emp && emp.id && saveStoreDocument(license.licenseKey, 'employees', emp.id, emp));
      }
    }
    if (Array.isArray(restored.payrollRecords)) {
      setPayrollRecords(restored.payrollRecords);
      localStorage.setItem('smart_accounting_payroll', JSON.stringify(restored.payrollRecords));
      if (license.licenseKey) {
        restored.payrollRecords.forEach((pr: any) => pr && pr.id && saveStoreDocument(license.licenseKey, 'payrollRecords', pr.id, pr));
      }
    }
    if (Array.isArray(restored.users)) {
      setUsers(restored.users);
      localStorage.setItem('smart_accounting_users', JSON.stringify(restored.users));
    }
    return true;
  };

  const handleResetDatabase = async () => {
    localStorage.clear();
    setSettings(DEFAULT_SETTINGS);
    setProducts([]);
    setCustomers([]);
    setInvoices([]);
    setPayments([]);
    setTransactions([]);
    setActiveTab('dashboard');
  };

  if (!isActivated) {
    return (
      <>
        <SaaSActivator 
          license={license}
          setLicense={setLicense}
          onActivationSuccess={(updatedLicense) => setLicense(updatedLicense)} 
          onOpenDevPortal={() => {
            setIsDevAdminRoute(true);
            setShowDeveloperModal(true);
          }}
        />
        <DeveloperPortalModal
          isOpen={showDeveloperModal}
          onClose={() => setShowDeveloperModal(false)}
          currentHwid={license.hwid || generateHWID()}
        />
      </>
    );
  }

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

  // 🎯 القائمة الوحيدة المتبقية (الرئيسية | المبيعات | العملاء | المخزن | التقارير)
  const androidNavItems = [
    { id: 'dashboard', label: 'الرئيسية', icon: Home },
    { id: 'pos', label: 'المبيعات', icon: ShoppingCart },
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'inventory', label: 'المخزن', icon: Package },
    { id: 'reports', label: 'التقارير', icon: BarChart3 },
  ];

  const getScreenTitle = () => {
    switch (activeTab) {
      case 'pos': return 'نقطة البيع (POS)';
      case 'customers': return 'حسابات العملاء والديون';
      case 'inventory': return 'إدارة المخزن والمستودع';
      case 'reports': return 'الأرباح والتقارير المالية';
      case 'stock_audit': return 'جرد وحصر المنشأة';
      case 'transactions': return 'سجل القيود والمصاريف';
      case 'maintenance': return 'قسم الصيانة والورشة';
      case 'employees': return 'إدارة العمال والرواتب';
      case 'users': return 'نظام الصلاحيات وسجل الأنشطة (Audit)';
      case 'settings': return 'إعدادات النظام والترخيص';
      default: return settings.storeName || license.customerName || 'نظام سند المحاسبي';
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 text-slate-900 select-none overflow-hidden font-sans dir-rtl" dir="rtl">
      
      {/* 1. TOP BAR */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {activeTab !== 'dashboard' ? (
            <button 
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('dashboard');
              }}
              className="p-2 text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={() => handleTabSelect('settings')}
              className="p-2 text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <h1 className="text-base font-bold text-slate-800 tracking-wide truncate max-w-[200px] sm:max-w-none">
            {getScreenTitle()}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Backup Button */}
          <button
            onClick={handleBackupData}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition cursor-pointer shadow-2xs"
            title="أخذ نسخة احتياطية وحفظها في ذاكرة الهاتف / الويب"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden xs:inline font-bold">نسخ احتياطي</span>
          </button>

          {/* Developer Modal Button */}
          <button
            onClick={() => setShowDeveloperModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition cursor-pointer shadow-2xs"
            title="معلومات المطور ولوحة التحكم والترخيص (/admin)"
          >
            <span>👨‍💻</span>
            <span className="hidden sm:inline font-bold">المطور</span>
          </button>

          {/* Active User Badge & Switcher Trigger */}
          <button
            onClick={() => handleTabSelect('users')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-900 border border-purple-200 text-xs font-bold hover:bg-purple-100 transition cursor-pointer shadow-2xs"
            title="انقر لإدارة المستخدمين أو التبديل بين الحسابات"
          >
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline font-bold">{currentUser?.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-200 text-purple-950 rounded-md font-mono">
              {currentUser?.role === 'admin' ? 'مدير' :
               currentUser?.role === 'cashier' ? 'كاشير' :
               currentUser?.role === 'technician' ? 'فني' : 'محاسب'}
            </span>
          </button>

          <button
            onClick={() => {
              if (isPrivacyMode) {
                if (settings.isPrivacyPinEnabled !== false) setShowPrivacyPinModal(true);
                else setIsPrivacyMode(false);
              } else setIsPrivacyMode(true);
            }}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            {isPrivacyMode ? <EyeOff className="w-5 h-5 text-amber-600" /> : <Eye className="w-5 h-5" />}
          </button>

          <button
            onClick={() => {
              if (isCashierMode) setShowPinCheckModal(true);
              else setIsCashierMode(true);
            }}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            {isCashierMode ? <Lock className="w-5 h-5 text-amber-600" /> : <Unlock className="w-5 h-5 text-emerald-600" />}
          </button>

          <button
            onClick={() => {
              if (confirm('⚠️ هل أنت متأكد من تسجيل الخروج؟')) handleLogout();
            }}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 pb-16 bg-slate-50 relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full"
          >
            {activeTab === 'dashboard' && (
              <MobileDashboardView
                products={products}
                customers={customers}
                invoices={invoices}
                payments={payments}
                transactions={transactions}
                settings={settings}
                employees={employees}
                activeTab={activeTab}
                setActiveTab={handleTabSelect}
                isPrivacyMode={isPrivacyMode}
                setIsPrivacyMode={setIsPrivacyMode}
                isCashierMode={isCashierMode}
                setIsCashierMode={setIsCashierMode}
                setShowPinCheckModal={setShowPinCheckModal}
                setShowPrivacyPinModal={setShowPrivacyPinModal}
                onBackupData={handleBackupData}
                onRestoreData={handleRestoreData}
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
                storeLogoUrl={settings.storeLogoUrl}
                isPrivacyMode={isPrivacyMode}
                debtReminderTemplate={settings.debtReminderTemplate}
                onSaveReminderTemplate={(tmpl) => {
                  const updated = { ...settings, debtReminderTemplate: tmpl };
                  setSettings(updated);
                  if (license.licenseKey) saveStoreSettings(license.licenseKey, updated);
                }}
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
                storeLogoUrl={settings.storeLogoUrl}
                isPrivacyMode={isPrivacyMode}
              />
            )}

            {activeTab === 'reports' && (
              <ProfitReports
                invoices={invoices}
                products={products}
                transactions={transactions}
                customers={customers}
                maintenanceOrders={maintenanceOrders}
                currency={settings.currency}
                settings={settings}
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
                onRefundInvoice={() => {}}
                onViewInvoice={setActiveInvoice}
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
                storeName={settings.storeName}
              />
            )}

            {activeTab === 'diagnostic' && (
              <SanadDiagnosticScreen
                products={products}
                currency={settings.currency}
                onNavigateToPOSWithItems={(items) => {
                  setActiveTab('pos');
                  soundManager.playSuccessChime();
                }}
                onNavigateToMaintenanceWithProblem={(problem, notes) => {
                  setActiveTab('maintenance');
                  soundManager.playSuccessChime();
                }}
              />
            )}

            {activeTab === 'phone_ledger' && (
              <SanadPhoneLedger
                customers={customers}
                transactions={transactions}
                settings={settings}
                onSelectCustomerStatement={(customer) => {
                  setActiveTab('customers');
                  soundManager.playSuccessChime();
                }}
              />
            )}

            {activeTab === 'device_receipt' && (
              <SanadDeviceReceipt
                userRole={currentUser?.role || 'admin'}
                currentUser={currentUser}
                settings={settings}
                onAddMaintenanceOrder={handleAddMaintenanceOrder}
              />
            )}

            {activeTab === 'employees' && (
              <Employees
                employees={employees}
                payrollRecords={payrollRecords}
                onAddEmployee={() => {}}
                onRecordAdvance={() => {}}
                onPaySalary={() => {}}
                onDeleteEmployee={() => {}}
                currency={settings.currency}
              />
            )}

            {activeTab === 'users' && (
              <UsersComponent
                users={users}
                currentUser={currentUser}
                setCurrentUser={(usr) => {
                  setCurrentUser(usr);
                  addAuditLog('user_switch', `تم التبديل إلى المستخدم: ${usr.name}`, `الدور: ${usr.role}`);
                }}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
                auditLogs={auditLogs}
                onClearAuditLogs={handleClearAuditLogs}
              />
            )}

            {(activeTab === 'enterprise_dashboard' || activeTab === 'alerts') && (
              <SanadEnterpriseDashboard
                inventoryItems={products}
              />
            )}

            {activeTab === 'settings' && (
              <Settings
                settings={settings}
                onSaveSettings={handleSaveSettings}
                onBackupData={handleBackupData}
                onRestoreData={handleRestoreData}
                onResetDatabase={handleResetDatabase}
                onOpenDevPortal={() => setShowDeveloperModal(true)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 3. COMPACT BOTTOM NAVBAR (تم تصغير ارتفاعها إلى 12 / 48px لتصبح أصغر وأنيقة) */}
      <nav className="h-12 bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-1 shadow-sm">
        {androidNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabSelect(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full py-0.5 group cursor-pointer"
            >
              <div
                className={`px-3 py-0.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 font-bold'
                    : 'text-slate-500 group-active:scale-90'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span
                className={`text-[10px] mt-0.5 transition-colors ${
                  isActive ? 'text-blue-700 font-bold' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Modals & Tools */}
      {activeInvoice && (
        <InvoiceModal
          invoice={activeInvoice}
          onClose={() => setActiveInvoice(null)}
          settings={settings}
          customers={customers}
        />
      )}

      <FloatingCalculator />

      {/* 🎙️ Sanad AI Voice Assistant Floating Button */}
      <div className="fixed bottom-24 left-6 z-50 no-print">
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setShowSanadAssistant(!showSanadAssistant);
          }}
          className={`p-3.5 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 border-white dark:border-slate-800 ${
            showSanadAssistant
              ? 'bg-rose-600 hover:bg-rose-700 text-white scale-110'
              : 'bg-gradient-to-r from-emerald-500 to-teal-700 hover:from-emerald-600 hover:to-teal-800 text-slate-950 shadow-emerald-500/30 hover:scale-105 font-black'
          }`}
          title="مساعد سند الذكي (صوتي ونصي)"
        >
          <span className="relative flex items-center justify-center">
            <span className="text-sm font-black flex items-center gap-1 text-white">
              🎙️ <span className="hidden sm:inline text-xs font-bold">سند الذكي</span>
            </span>
          </span>
        </button>
      </div>

      {/* 🎙️ Sanad AI Voice Assistant Modal */}
      {showSanadAssistant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-6 animate-fadeIn no-print">
          <div className="w-full max-w-lg h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden relative border border-slate-200">
            <SanadVoiceAssistant 
              onClose={() => setShowSanadAssistant(false)}
            />
          </div>
        </div>
      )}

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
          } else setIsCashierMode(false);
        }}
        pinCode={settings.pinCode || '1234'}
      />

      <PinCheckModal
        isOpen={showPrivacyPinModal}
        onClose={() => setShowPrivacyPinModal(false)}
        onSuccess={() => {
          setShowPrivacyPinModal(false);
          setIsPrivacyMode(false);
        }}
        pinCode={settings.privacyPinCode || settings.pinCode || '1234'}
        title="كلمة سر وضع الخصوصية 👁️"
        subtitle="يرجى إدخال رمز PIN لإلغاء إخفاء المبالغ"
      />

      <DeveloperPortalModal
        isOpen={showDeveloperModal}
        onClose={() => setShowDeveloperModal(false)}
        currentHwid={license.hwid || generateHWID()}
      />

      {/* ⛔ License Revoked / Account Suspended Alert Modal */}
      {showRevokedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn" dir="rtl">
          <div className="w-full max-w-md bg-white dark:bg-[#0F172A] border border-rose-500/50 rounded-3xl p-6 text-center space-y-5 shadow-2xl relative overflow-hidden">
            
            {/* Warning Icon Header */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-inner animate-bounce">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                ⛔ تم إيقاف وإلغاء ترخيص الحساب!
              </h3>
              <div className="text-xs text-slate-700 dark:text-slate-200 font-bold leading-relaxed p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-right space-y-2">
                <p className="text-sm text-rose-700 dark:text-rose-300 font-extrabold">
                  ⚠️ تنبيه هام: لقد تم حذف أو تعليق كود التفعيل المنسوب لنشاطك التجاري من قبل المطور وإدارة النظام.
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold pt-1 border-t border-rose-200/40 dark:border-rose-900/20">
                  لإعادة فتح النظام واستئناف أعمالك، يرجى التواصل المباشر مع المطور والدعم الفني لاستكمال التسديد والتفعيل:
                </p>
                <div className="text-center pt-1 font-mono font-black text-sky-600 dark:text-sky-400 text-sm select-all">
                  📞 777140209
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <a
                href="https://wa.me/967777140209"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                💬 التواصل المباشر عبر واتساب للتسديد (777140209)
              </a>
              <button
                type="button"
                onClick={() => setShowRevokedModal(false)}
                className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                إغلاق والعودة لشاشة التفعيل ❌
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
