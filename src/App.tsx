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
  Upload,
  Calculator
} from 'lucide-react';

import { Product, Customer, Invoice, Payment, Transaction, SystemSettings, MaintenanceOrder, Employee, PayrollRecord, UserAccount, AuditLog } from './types';
import { soundManager } from './utils/sound';
import { openWhatsApp } from './utils/nativeLauncher';
import { 
  DEFAULT_SETTINGS, 
  SEED_PRODUCTS, 
  SEED_CUSTOMERS, 
  SEED_INVOICES, 
  SEED_PAYMENTS, 
  SEED_TRANSACTIONS 
} from './utils/seedData';

import MobileDashboardView from './components/MobileDashboardView';
import DesktopDashboardView from './components/DesktopDashboardView';
import Navigation from './components/Navigation';
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
import PrinterInvoiceStudio from './components/PrinterInvoiceStudio';

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
  syncStoreSettings,
  wipeStoreCloudAndLocalData
} from './utils/firebaseSync';
import { listenToLicenseOnCloud, checkLicenseOnCloud, CloudLicense } from './utils/firebase';
import { safeStorage, cleanUpStorageQuota } from './utils/safeStorage';

export default function App() {
  // 1. All Component State Initializations
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const data = localStorage.getItem('smart_accounting_settings');
    const parsed = data ? JSON.parse(data) : { ...DEFAULT_SETTINGS };

    const savedLogo = localStorage.getItem('smart_accounting_company_logo') || localStorage.getItem('sanad_store_logo');
    if (savedLogo && !parsed.storeLogoUrl) {
      parsed.storeLogoUrl = savedLogo;
    }

    const savedAddress = localStorage.getItem('smart_accounting_address') || localStorage.getItem('sanad_store_address');
    if (savedAddress && !parsed.address) {
      parsed.address = savedAddress;
    }

    const savedPhone = localStorage.getItem('smart_accounting_phone') || localStorage.getItem('sanad_store_phone');
    if (savedPhone && !parsed.phone) {
      parsed.phone = savedPhone;
    }

    const savedStoreName = localStorage.getItem('smart_accounting_store_name');
    if (savedStoreName && !parsed.storeName) {
      parsed.storeName = savedStoreName;
    }

    const savedLayout = (localStorage.getItem('app_layout_preference') as 'mobile' | 'desktop') ||
                        (localStorage.getItem('app_interface_mode') as 'mobile' | 'desktop');
    if (savedLayout === 'desktop' || savedLayout === 'mobile') {
      parsed.deviceMode = savedLayout;
    }

    return parsed;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const data = localStorage.getItem('smart_accounting_products');
    if (data !== null) {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed.filter((p: any) => p && p.isDeleted !== true) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const data = localStorage.getItem('smart_accounting_customers');
    if (data !== null) {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed.filter((c: any) => c && c.isDeleted !== true && c.isActive !== false) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const data = localStorage.getItem('smart_accounting_invoices');
    if (data !== null) {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    const data = localStorage.getItem('smart_accounting_payments');
    if (data !== null) {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const data = localStorage.getItem('smart_accounting_transactions');
    if (data !== null) {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
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

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const data = safeStorage.getItem('smart_accounting_audit_logs');
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

  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [license, setLicense] = useState<LicenseInfo>(() => loadLicenseLocally());
  const isActivated = license.status === 'active' || license.status === 'trial';
  const [showRevokedModal, setShowRevokedModal] = useState<boolean>(false);

  const [isBiometricLocked, setIsBiometricLocked] = useState<boolean>(() => {
    return localStorage.getItem('sond_biometrics_enabled') === 'true';
  });

  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  // 2. Helper Handlers
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

  const handleLogout = () => {
    soundManager.playWarningBeep();
    localStorage.setItem('smart_accounting_logged_out', 'true');
    setCurrentUser(null);
    setIsCashierMode(true);
    addAuditLog('user_logout', 'تسجيل خروج وقفل الجلسة', 'قام المستخدم بقفل الجلسة الحالية');
    setActiveTab('pos');
  };

  // 3. Side Effects
  // 🧹 Run storage cleanup on boot
  useEffect(() => {
    cleanUpStorageQuota();
  }, []);

  // 🖥️📱 Listener for System Interface Mode changes
  useEffect(() => {
    const applyInterfaceMode = () => {
      const mode = (localStorage.getItem('app_layout_preference') as 'mobile' | 'desktop') ||
                   (localStorage.getItem('app_interface_mode') as 'mobile' | 'desktop') ||
                   settings.deviceMode || 'mobile';

      setSettings(prev => prev.deviceMode === mode ? prev : { ...prev, deviceMode: mode });

      if (typeof document !== 'undefined') {
        if (mode === 'desktop') {
          document.documentElement.classList.add('mode-desktop');
          document.documentElement.classList.remove('mode-mobile');
        } else {
          document.documentElement.classList.add('mode-mobile');
          document.documentElement.classList.remove('mode-desktop');
        }
      }
    };

    if (typeof document !== 'undefined') {
      if (settings.deviceMode === 'desktop') {
        document.documentElement.classList.add('mode-desktop');
        document.documentElement.classList.remove('mode-mobile');
      } else {
        document.documentElement.classList.add('mode-mobile');
        document.documentElement.classList.remove('mode-desktop');
      }
    }

    window.addEventListener('app_layout_changed', applyInterfaceMode);
    window.addEventListener('app_interface_mode_changed', applyInterfaceMode);

    return () => {
      window.removeEventListener('app_layout_changed', applyInterfaceMode);
      window.removeEventListener('app_interface_mode_changed', applyInterfaceMode);
    };
  }, [settings.deviceMode]);

  // Local Storage Persistence Effects
  useEffect(() => {
    safeStorage.setItem('smart_accounting_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_payments', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_maintenance', JSON.stringify(maintenanceOrders));
  }, [maintenanceOrders]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_payroll', JSON.stringify(payrollRecords));
  }, [payrollRecords]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    safeStorage.setItem('smart_accounting_audit_logs', JSON.stringify(auditLogs.slice(0, 50)));
  }, [auditLogs]);

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

  // 🔒 Real-time Firestore License Enforcement
  useEffect(() => {
    if (!license.licenseKey || license.status === 'unlicensed' || isDevAdminRoute) {
      return;
    }

    const currentKey = license.licenseKey;
    const currentHwid = license.hwid || generateHWID();

    const handleLicenseRevoked = (reason: string, cloudData?: CloudLicense) => {
      // 🔒 Strictly protect active licenses: only revoke if cloud explicitly suspended or subscription expired
      const isExpired = reason === 'KEY_EXPIRED' || reason === 'expired';
      const isSuspended = reason === 'KEY_SUSPENDED' || reason === 'suspended';

      if (!isExpired && !isSuspended) {
        console.log(`[License Security] Ignoring non-revocation reason: ${reason}`);
        return;
      }

      console.warn(`[License Security] License key ${currentKey} was ${reason} on Cloud!`);
      soundManager.playWarningBeep();

      const revokedLicense: LicenseInfo = {
        licenseKey: currentKey,
        status: isExpired ? 'expired' : 'unlicensed',
        activatedAt: license.activatedAt,
        expiresAt: cloudData?.expiresAt || license.expiresAt,
        hwid: currentHwid,
        subscriptionType: cloudData?.type || license.subscriptionType || 'trial',
        customerName: cloudData?.customerName || license.customerName || (isSuspended ? 'حساب موقوف' : 'اشتراك منتهي'),
        phone: cloudData?.phone || license.phone || ''
      };

      saveLicenseLocally(revokedLicense);
      setLicense(revokedLicense);
      setShowRevokedModal(true);
    };

    const unsubRealtime = listenToLicenseOnCloud(currentKey, (status, cloudData) => {
      if (status === 'suspended' || status === 'expired') {
        handleLicenseRevoked(status, cloudData);
      } else if (status === 'active' && cloudData) {
        if (license.status === 'expired' || license.status === 'unlicensed') {
          const activeLic: LicenseInfo = {
            licenseKey: cloudData.key,
            status: 'active',
            activatedAt: cloudData.createdAt || new Date().toISOString(),
            expiresAt: cloudData.expiresAt,
            hwid: currentHwid,
            subscriptionType: cloudData.type,
            customerName: cloudData.customerName || license.customerName || 'عميل سند',
            phone: cloudData.phone || license.phone || ''
          };
          saveLicenseLocally(activeLic);
          setLicense(activeLic);
          setShowRevokedModal(false);
          soundManager.playSuccessChime();
        }
      }
    });

    const checkActiveCloudLicense = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const checkRes = await checkLicenseOnCloud(currentKey, currentHwid);
        if (checkRes.success && checkRes.data) {
          if (license.status === 'expired' || license.status === 'unlicensed') {
            const activeLic: LicenseInfo = {
              licenseKey: checkRes.data.key,
              status: 'active',
              activatedAt: checkRes.data.createdAt || new Date().toISOString(),
              expiresAt: checkRes.data.expiresAt,
              hwid: currentHwid,
              subscriptionType: checkRes.data.type,
              customerName: checkRes.data.customerName || license.customerName || 'عميل سند',
              phone: checkRes.data.phone || license.phone || ''
            };
            saveLicenseLocally(activeLic);
            setLicense(activeLic);
            setShowRevokedModal(false);
          }
        } else if (!checkRes.success) {
          // Only revoke on explicit server suspension or expiry, NEVER on not found
          if (checkRes.message === 'KEY_SUSPENDED' || checkRes.message === 'KEY_EXPIRED') {
            handleLicenseRevoked(checkRes.message, checkRes.data);
          }
        }
      } catch {
        // Safe check
      }
    };

    const initialTimer = setTimeout(() => {
      checkActiveCloudLicense();
    }, 1500);

    const intervalId = setInterval(checkActiveCloudLicense, 30000);

    let unsubAppResume: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      try {
        const handle = CapacitorApp.addListener('appStateChange', (state) => {
          if (state.isActive) {
            setTimeout(checkActiveCloudLicense, 2000);
          }
        });
        unsubAppResume = () => { handle.then(h => h.remove()); };
      } catch {
        // Fallback
      }
    }

    return () => {
      clearTimeout(initialTimer);
      unsubRealtime();
      clearInterval(intervalId);
      if (unsubAppResume) unsubAppResume();
    };
  }, [license.licenseKey, license.status, isDevAdminRoute]);

  // Firestore Sync Effect
  useEffect(() => {
    if (!license.licenseKey || !isActivated) return;

    const handleCloudResetDetected = () => {
      safeStorage.setItem('smart_accounting_products', '[]');
      safeStorage.setItem('smart_accounting_customers', '[]');
      safeStorage.setItem('smart_accounting_invoices', '[]');
      safeStorage.setItem('smart_accounting_payments', '[]');
      safeStorage.setItem('smart_accounting_transactions', '[]');
      safeStorage.setItem('smart_accounting_maintenance', '[]');
      setProducts([]);
      setCustomers([]);
      setInvoices([]);
      setPayments([]);
      setTransactions([]);
      setMaintenanceOrders([]);
    };

    const unsubSettings = syncStoreSettings(license.licenseKey, setSettings, DEFAULT_SETTINGS, handleCloudResetDetected);
    const unsubProducts = syncStoreCollection<Product>(license.licenseKey, 'products', setProducts, []);
    const unsubCustomers = syncStoreCollection<Customer>(license.licenseKey, 'customers', setCustomers, []);
    const unsubInvoices = syncStoreCollection<Invoice>(license.licenseKey, 'invoices', setInvoices, []);
    const unsubPayments = syncStoreCollection<Payment>(license.licenseKey, 'payments', setPayments, []);
    const unsubTransactions = syncStoreCollection<Transaction>(license.licenseKey, 'transactions', setTransactions, []);
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

      const localSched = settings.localBackupSchedule || 'daily';
      if (localSched !== 'off') {
        const lastLocalMs = settings.lastLocalBackupDate ? new Date(settings.lastLocalBackupDate).getTime() : 0;
        let intervalMs = 24 * 60 * 60 * 1000;
        if (localSched === 'weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;
        if (localSched === 'monthly') intervalMs = 30 * 24 * 60 * 60 * 1000;

        if (now - lastLocalMs >= intervalMs) {
          const backupObj = { settings, products, customers, invoices, payments, transactions, exportedAt: nowIso };
          const jsonStr = JSON.stringify(backupObj, null, 2);
          const fileName = `sanad_backup_auto_${getBackupTimestamp()}.json`;
          const folder = settings.backupFolderPath || 'Documents/SanadAccounting';

          await saveSilentBackupFile(fileName, jsonStr, folder);
          updatedSettings.lastLocalBackupDate = nowIso;
          updateNeeded = true;
        }
      }

      const driveSched = settings.driveBackupSchedule || 'weekly';
      if (driveSched !== 'off') {
        const lastDriveMs = settings.lastDriveBackupDate ? new Date(settings.lastDriveBackupDate).getTime() : 0;
        let intervalMs = 7 * 24 * 60 * 60 * 1000;
        if (driveSched === 'daily') intervalMs = 24 * 60 * 60 * 1000;
        if (driveSched === 'monthly') intervalMs = 30 * 24 * 60 * 60 * 1000;

        if (now - lastDriveMs >= intervalMs) {
          const backupObj = { settings, products, customers, invoices, payments, transactions, exportedAt: nowIso };
          const jsonStr = JSON.stringify(backupObj, null, 2);
          const fileName = `sanad_backup_drive_${getBackupTimestamp()}.json`;
          const folder = settings.backupFolderPath || 'Documents/SanadAccounting';

          await saveSilentBackupFile(fileName, jsonStr, folder);
          updatedSettings.lastDriveBackupDate = nowIso;
          updateNeeded = true;
        }
      }

      if (updateNeeded) {
        setSettings(updatedSettings);
        safeStorage.setItem('smart_accounting_settings', JSON.stringify(updatedSettings));
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
    safeStorage.setItem('smart_accounting_settings', JSON.stringify(newSettings));
    if (newSettings.storeLogoUrl && newSettings.storeLogoUrl.length < 60000) {
      safeStorage.setItem('smart_accounting_company_logo', newSettings.storeLogoUrl);
    }
    if (newSettings.address) {
      safeStorage.setItem('smart_accounting_address', newSettings.address);
    }
    if (newSettings.phone) {
      safeStorage.setItem('smart_accounting_phone', newSettings.phone);
    }
    if (newSettings.storeName) {
      safeStorage.setItem('smart_accounting_store_name', newSettings.storeName);
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
      paymentMethod: saleData.paymentMethod || (saleData.type === 'debt' ? 'debt' : 'cash'),
      referenceNumber: saleData.referenceNumber,
      proofImage: saleData.proofImage,
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
    setCustomers(prev => prev.filter(c => c.id !== customerId));
    if (license.licenseKey) {
      deleteStoreDocument(license.licenseKey, 'customers', customerId);
    }
    if (cust) {
      addAuditLog('customer_deleted', `حذف حساب العميل نهائياً: ${cust.name}`, `تم مسح العميل من النظام والسحابة`);
    }
  };

  const handlePayDebt = (customerId: string, amount: number, note: string, paymentMethod: string = 'cash', referenceNumber?: string) => {
    const payId = `pay-${Date.now()}`;
    const dateStr = new Date().toISOString();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const newPayment: Payment = { id: payId, customerId, customerName: customer.name, amount, date: dateStr, note, paymentMethod, referenceNumber };
    const newTransaction: Transaction = { id: `t-${Date.now()}`, type: 'payment', amount, date: dateStr, paymentMethod, referenceNumber, description: `سداد ديون: ${customer.name}` };
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

  const handleBulkAddProducts = (
    productsToAdd: Omit<Product, 'id'>[],
    purchaseMetadata?: {
      supplierName?: string;
      invoiceNumber?: string;
      totalAmount?: number;
      recordAsExpense?: boolean;
    }
  ) => {
    const timestamp = Date.now();
    const newItems: Product[] = [];
    const updatedProducts = [...products];
    const recordedPurchaseItems: import('./types').PurchaseInvoiceItem[] = [];

    productsToAdd.forEach((pData, idx) => {
      // Check if product with same barcode exists
      const existingIndex = updatedProducts.findIndex(
        p => p.isDeleted !== true && p.barcode.trim() === pData.barcode.trim()
      );

      if (existingIndex >= 0) {
        // Increment stock and update cost/sell price
        const existing = updatedProducts[existingIndex];
        const updated: Product = {
          ...existing,
          name: pData.name || existing.name,
          stock: (existing.stock || 0) + (pData.stock || 0),
          costPrice: pData.costPrice > 0 ? pData.costPrice : existing.costPrice,
          sellingPrice: pData.sellingPrice > 0 ? pData.sellingPrice : existing.sellingPrice,
          category: pData.category || existing.category
        };
        updatedProducts[existingIndex] = updated;
        recordedPurchaseItems.push({
          productId: updated.id,
          name: updated.name,
          barcode: updated.barcode,
          quantity: Number(pData.stock) || 1,
          costPrice: Number(pData.costPrice) || updated.costPrice || 0,
          sellingPrice: Number(pData.sellingPrice) || updated.sellingPrice || 0,
          category: updated.category || 'إكسسوارات',
          minStock: updated.minStock || 2,
          total: (Number(pData.costPrice) || updated.costPrice || 0) * (Number(pData.stock) || 1)
        });
        if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', updated.id, updated);
      } else {
        // Create new product
        const newProd: Product = {
          id: `p-${timestamp}-${idx}`,
          ...pData
        };
        newItems.push(newProd);
        updatedProducts.push(newProd);
        recordedPurchaseItems.push({
          productId: newProd.id,
          name: newProd.name,
          barcode: newProd.barcode,
          quantity: Number(newProd.stock) || 1,
          costPrice: Number(newProd.costPrice) || 0,
          sellingPrice: Number(newProd.sellingPrice) || 0,
          category: newProd.category || 'إكسسوارات',
          minStock: newProd.minStock || 2,
          total: (Number(newProd.costPrice) || 0) * (Number(newProd.stock) || 1)
        });
        if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', newProd.id, newProd);
      }
    });

    setProducts(updatedProducts);

    // Record purchase expense transaction if requested
    const computedTotal = purchaseMetadata?.totalAmount ?? recordedPurchaseItems.reduce((s, it) => s + it.total, 0);
    if (purchaseMetadata?.recordAsExpense) {
      const invNum = purchaseMetadata.invoiceNumber || `PUR-${Math.floor(10000 + Math.random() * 90000)}`;
      const expenseTx: Transaction = {
        id: `t-${timestamp}`,
        type: 'expense',
        amount: computedTotal,
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        referenceNumber: invNum,
        isPurchaseInvoice: true,
        supplierName: purchaseMetadata.supplierName || '',
        invoiceNumber: invNum,
        purchaseItems: recordedPurchaseItems,
        voucherCategory: 'purchase_invoice',
        description: `مشتريات بضاعة ومخزون${purchaseMetadata.supplierName ? ` من مورد: ${purchaseMetadata.supplierName}` : ''}${invNum ? ` (فاتورة ${invNum})` : ''} - عدد ${productsToAdd.length} صنف`
      };
      setTransactions(prev => [expenseTx, ...prev]);
      if (license.licenseKey) saveStoreDocument(license.licenseKey, 'transactions', expenseTx.id, expenseTx);
    }

    addAuditLog(
      'inventory_bulk_add',
      `إضافة مجمعة للمخزن (${productsToAdd.length} صنف)`,
      purchaseMetadata?.invoiceNumber ? `رقم الفاتورة: ${purchaseMetadata.invoiceNumber}` : undefined
    );
  };

  const handleUpdatePurchaseInvoice = (
    transactionId: string,
    updatedItems: import('./types').PurchaseInvoiceItem[],
    deletedItems: { productId: string; quantityToRevert: number; deleteProductCompletely?: boolean }[],
    metadata: {
      supplierName?: string;
      invoiceNumber?: string;
      paymentMethod?: string;
      customTotalAmount?: number;
      notes?: string;
    }
  ) => {
    const oldTx = transactions.find(t => t.id === transactionId);
    if (!oldTx) return;

    const timestamp = Date.now();
    let updatedProducts = [...products];

    // Map old quantities to compute stock delta accurately
    const oldQtyMap = new Map<string, number>();
    if (Array.isArray(oldTx.purchaseItems)) {
      oldTx.purchaseItems.forEach(it => {
        oldQtyMap.set(it.productId, Number(it.quantity) || 0);
      });
    }

    // 1. Handle deleted items from the purchase invoice
    deletedItems.forEach(del => {
      const idx = updatedProducts.findIndex(p => p.id === del.productId);
      if (idx >= 0) {
        const prod = updatedProducts[idx];
        if (del.deleteProductCompletely) {
          updatedProducts.splice(idx, 1);
          if (license.licenseKey) deleteStoreDocument(license.licenseKey, 'products', prod.id);
        } else {
          const newStock = Math.max(0, (prod.stock || 0) - (del.quantityToRevert || 0));
          const updatedProd: Product = { ...prod, stock: newStock };
          updatedProducts[idx] = updatedProd;
          if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', prod.id, updatedProd);
        }
      }
    });

    // 2. Handle updated & newly added items in the purchase invoice
    const finalPurchaseItems: import('./types').PurchaseInvoiceItem[] = updatedItems.map((item, idx) => {
      const existingIdx = updatedProducts.findIndex(
        p => p.id === item.productId || (item.barcode && p.isDeleted !== true && p.barcode.trim() === item.barcode.trim())
      );

      const itemQty = Math.max(0, Number(item.quantity) || 0);
      const itemCost = Math.max(0, Number(item.costPrice) || 0);
      const itemSell = Math.max(0, Number(item.sellingPrice) || 0);
      const itemTotal = itemCost * itemQty;

      if (existingIdx >= 0) {
        const existingProd = updatedProducts[existingIdx];
        const prevInvoiceQty = oldQtyMap.has(existingProd.id) ? oldQtyMap.get(existingProd.id)! : itemQty;
        const qtyDiff = itemQty - prevInvoiceQty;
        const newStock = Math.max(0, (existingProd.stock || 0) + qtyDiff);

        const updatedProd: Product = {
          ...existingProd,
          name: item.name.trim() || existingProd.name,
          barcode: item.barcode?.trim() || existingProd.barcode,
          costPrice: itemCost,
          sellingPrice: itemSell > 0 ? itemSell : existingProd.sellingPrice,
          category: item.category || existingProd.category,
          stock: newStock,
          isDeleted: false
        };
        updatedProducts[existingIdx] = updatedProd;
        if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', updatedProd.id, updatedProd);

        return {
          ...item,
          productId: updatedProd.id,
          name: updatedProd.name,
          barcode: updatedProd.barcode,
          quantity: itemQty,
          costPrice: itemCost,
          sellingPrice: updatedProd.sellingPrice,
          category: updatedProd.category,
          total: itemTotal
        };
      } else {
        // Brand new product added inside the purchase invoice editor
        const newProdId = `p-${timestamp}-${idx}`;
        const newProd: Product = {
          id: newProdId,
          name: item.name.trim() || 'صنف جديد',
          barcode: item.barcode?.trim() || Math.floor(100000000000 + Math.random() * 900000000000).toString(),
          costPrice: itemCost,
          sellingPrice: itemSell > 0 ? itemSell : Math.round(itemCost * 1.25),
          stock: itemQty,
          minStock: item.minStock || 2,
          category: item.category || 'إكسسوارات'
        };
        updatedProducts.push(newProd);
        if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', newProd.id, newProd);

        return {
          ...item,
          productId: newProd.id,
          name: newProd.name,
          barcode: newProd.barcode,
          quantity: itemQty,
          costPrice: itemCost,
          sellingPrice: newProd.sellingPrice,
          category: newProd.category,
          total: itemTotal
        };
      }
    });

    setProducts(updatedProducts);

    const calculatedSum = finalPurchaseItems.reduce((s, it) => s + it.total, 0);
    const finalExpenseAmount =
      metadata.customTotalAmount !== undefined && metadata.customTotalAmount >= 0
        ? metadata.customTotalAmount
        : calculatedSum;

    const invNum = metadata.invoiceNumber ?? oldTx.invoiceNumber ?? oldTx.referenceNumber ?? '';
    const supName = metadata.supplierName ?? oldTx.supplierName ?? '';

    const updatedTx: Transaction = {
      ...oldTx,
      amount: finalExpenseAmount,
      paymentMethod: metadata.paymentMethod || oldTx.paymentMethod || 'cash',
      referenceNumber: invNum,
      invoiceNumber: invNum,
      supplierName: supName,
      isPurchaseInvoice: true,
      purchaseItems: finalPurchaseItems,
      notes: metadata.notes ?? oldTx.notes,
      description: `مشتريات بضاعة ومخزون${supName ? ` من مورد: ${supName}` : ''}${invNum ? ` (فاتورة ${invNum})` : ''} - عدد ${finalPurchaseItems.length} صنف`
    };

    setTransactions(prev => prev.map(t => t.id === transactionId ? updatedTx : t));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'transactions', updatedTx.id, updatedTx);

    soundManager.playSuccessChime();
    addAuditLog(
      'purchase_invoice_updated',
      `تعديل فاتورة مشتريات #${invNum || transactionId.slice(0, 6)}`,
      `عدد الأصناف: ${finalPurchaseItems.length} - الإجمالي الجديد: ${finalExpenseAmount} ${settings.currency}`
    );
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', updatedProduct.id, updatedProduct);
  };

  const handleRestoreProducts = (newProductList: Product[]) => {
    setProducts(newProductList);
    safeStorage.setItem('smart_accounting_products', JSON.stringify(newProductList));
    if (license.licenseKey) {
      newProductList.forEach(prod => {
        saveStoreDocument(license.licenseKey, 'products', prod.id, prod);
      });
    }
    addAuditLog(
      'inventory_csv_restore',
      `استعادة / استيراد أصناف المخزن من ملف (${newProductList.length} صنف)`,
      `تم استعادة وتحديث قاعدة بيانات المستودع بنجاح`
    );
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
    if (license.licenseKey) {
      deleteStoreDocument(license.licenseKey, 'products', productId);
    }
    if (prod) {
      addAuditLog('product_deleted', `حذف الصنف نهائياً: ${prod.name}`, `تم مسح الصنف من المخزن والسحابة`);
    }
  };

  const handleUpdateProductStock = (productId: string, newStock: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const updated = { ...prod, stock: newStock };
    setProducts(prev => prev.map(p => p.id === productId ? updated : p));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', productId, updated);
  };

  const handleRefundInvoice = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    if (invoice.status === 'refunded') {
      soundManager.playWarningBeep();
      return;
    }

    const updatedInvoice: Invoice = {
      ...invoice,
      status: 'refunded'
    };

    // Restore products stock
    const updatedProducts = products.map(p => {
      const soldItem = invoice.items?.find(item => item.productId === p.id);
      return soldItem ? { ...p, stock: (p.stock || 0) + (soldItem.quantity || 1) } : p;
    });

    // Update customer debt if it was debt invoice
    let updatedCustomer: Customer | null = null;
    if (invoice.type === 'debt' && invoice.customerId) {
      const c = customers.find(cust => cust.id === invoice.customerId);
      if (c) {
        updatedCustomer = { ...c, totalDebt: Math.max(0, c.totalDebt - invoice.finalAmount) };
      }
    }

    // Register a refund transaction in transactions
    const refundTx: Transaction = {
      id: `t-${Date.now()}`,
      type: 'refund',
      amount: invoice.finalAmount,
      date: new Date().toISOString(),
      paymentMethod: invoice.paymentMethod || (invoice.type === 'debt' ? 'debt' : 'cash'),
      referenceNumber: invoice.invoiceNumber,
      description: `مرتجع مبيعات فاتورة #${invoice.invoiceNumber} - العميل: ${invoice.customerName}`
    };

    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updatedInvoice : inv));
    setProducts(updatedProducts);
    if (updatedCustomer) {
      setCustomers(prev => prev.map(c => c.id === updatedCustomer!.id ? updatedCustomer! : c));
    }
    setTransactions(prev => [refundTx, ...prev]);

    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'invoices', invoiceId, updatedInvoice);
      saveStoreDocument(license.licenseKey, 'transactions', refundTx.id, refundTx);
      updatedProducts.forEach(p => saveStoreDocument(license.licenseKey, 'products', p.id, p));
      if (updatedCustomer) saveStoreDocument(license.licenseKey, 'customers', updatedCustomer.id, updatedCustomer);
    }

    soundManager.playSuccessChime();
    addAuditLog(
      'invoice_refunded',
      `استرجاع فاتورة مبيعات #${invoice.invoiceNumber}`,
      `العميل: ${invoice.customerName} - المبلغ: ${invoice.finalAmount} ${settings.currency} (تمت إعادة الكميات للمخزن بنجاح)`
    );
  };

  const handleAddExpense = (
    amount: number,
    description: string,
    paymentMethod: string = 'cash',
    referenceNumber?: string,
    extra?: { beneficiary?: string; voucherCategory?: string; date?: string; notes?: string }
  ) => {
    const refNum = referenceNumber || `PV-${Math.floor(1000 + Math.random() * 9000)}`;
    const prefix = extra?.beneficiary ? `سند صرف (${extra.beneficiary}): ` : 'مصروفات: ';
    const cleanDesc = description.startsWith('مصروفات:') || description.startsWith('سند صرف') ? description : `${prefix}${description}`;
    const newTx: Transaction = {
      id: `t-${Date.now()}`,
      type: 'expense',
      amount,
      date: extra?.date || new Date().toISOString(),
      paymentMethod,
      referenceNumber: refNum,
      payerOrBeneficiary: extra?.beneficiary,
      voucherCategory: extra?.voucherCategory || 'expense_voucher',
      notes: extra?.notes,
      description: cleanDesc
    };
    setTransactions(prev => [newTx, ...prev]);
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'transactions', newTx.id, newTx);
    addAuditLog('expense_added', `إصدار سند صرف / مصروف #${refNum}`, `${cleanDesc} - المبلغ: ${amount} ${settings.currency}`);
  };

  const handleAddReceiptVoucher = (voucherData: {
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
  }) => {
    const timestamp = Date.now();
    const dateStr = voucherData.date || new Date().toISOString();
    const refNum = voucherData.referenceNumber?.trim() || `RV-${Math.floor(1000 + Math.random() * 9000)}`;
    const method = voucherData.paymentMethod || 'cash';

    let targetCustomer: Customer | undefined;
    if (voucherData.customerId) {
      targetCustomer = customers.find(c => c.id === voucherData.customerId);
    }

    const payerLabel = targetCustomer?.name || voucherData.payerName?.trim() || 'مقبوضات عامة';
    const descText = voucherData.description.trim()
      ? `سند قبض (${payerLabel}): ${voucherData.description.trim()}`
      : `سند قبض مالي من: ${payerLabel}`;

    const newTx: Transaction = {
      id: `t-${timestamp}`,
      type: 'payment',
      amount: voucherData.amount,
      date: dateStr,
      paymentMethod: method,
      referenceNumber: refNum,
      customerId: targetCustomer?.id,
      customerName: targetCustomer?.name,
      payerOrBeneficiary: payerLabel,
      voucherCategory: voucherData.voucherCategory || (targetCustomer ? 'debt_collection' : 'receipt_voucher'),
      notes: voucherData.notes,
      description: descText
    };

    setTransactions(prev => [newTx, ...prev]);
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'transactions', newTx.id, newTx);

    // If linked to a customer and deductFromCustomerDebt is enabled, update customer debt & payments
    if (targetCustomer && voucherData.deductFromCustomerDebt !== false) {
      const payId = `pay-${timestamp}`;
      const newPayment: Payment = {
        id: payId,
        customerId: targetCustomer.id,
        customerName: targetCustomer.name,
        amount: voucherData.amount,
        date: dateStr,
        note: voucherData.description || `سند قبض رقم ${refNum}`,
        paymentMethod: method,
        referenceNumber: refNum
      };
      const updatedCustomer: Customer = {
        ...targetCustomer,
        totalDebt: Math.max(0, (targetCustomer.totalDebt || 0) - voucherData.amount)
      };

      setCustomers(prev => prev.map(c => c.id === targetCustomer!.id ? updatedCustomer : c));
      setPayments(prev => [newPayment, ...prev]);

      if (license.licenseKey) {
        saveStoreDocument(license.licenseKey, 'payments', payId, newPayment);
        saveStoreDocument(license.licenseKey, 'customers', targetCustomer.id, updatedCustomer);
      }
    }

    addAuditLog('receipt_voucher_added', `إصدار سند قبض #${refNum}`, `${descText} - المبلغ: ${voucherData.amount} ${settings.currency}`);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    const oldTx = transactions.find(t => t.id === updatedTx.id);
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'transactions', updatedTx.id, updatedTx);

    // Sync customer debt & payment record if this transaction is linked to a customer
    if (oldTx && updatedTx.customerId && updatedTx.type === 'payment') {
      if (oldTx.amount !== updatedTx.amount) {
        const cust = customers.find(c => c.id === updatedTx.customerId);
        if (cust) {
          const diff = updatedTx.amount - oldTx.amount;
          const updatedCustomer: Customer = {
            ...cust,
            totalDebt: Math.max(0, (cust.totalDebt || 0) - diff)
          };
          setCustomers(prev => prev.map(c => c.id === cust.id ? updatedCustomer : c));
          if (license.licenseKey) saveStoreDocument(license.licenseKey, 'customers', cust.id, updatedCustomer);
        }
      }

      // Sync corresponding customer Payment entry for CustomerStatementModal
      const expectedPayId = updatedTx.id.startsWith('t-') ? `pay-${updatedTx.id.slice(2)}` : '';
      const matchedPay = payments.find(p =>
        (expectedPayId && p.id === expectedPayId) ||
        (oldTx.referenceNumber && p.referenceNumber === oldTx.referenceNumber && p.customerId === updatedTx.customerId)
      );
      if (matchedPay) {
        const updatedPay: Payment = {
          ...matchedPay,
          amount: updatedTx.amount,
          date: updatedTx.date,
          paymentMethod: updatedTx.paymentMethod,
          referenceNumber: updatedTx.referenceNumber,
          note: updatedTx.description
        };
        setPayments(prev => prev.map(p => p.id === matchedPay.id ? updatedPay : p));
        if (license.licenseKey) saveStoreDocument(license.licenseKey, 'payments', matchedPay.id, updatedPay);
      }
    }

    soundManager.playSuccessChime();
    addAuditLog('voucher_updated', `تعديل سند مالي #${updatedTx.referenceNumber || updatedTx.id.slice(0, 6)}`, `${updatedTx.description} - المبلغ: ${updatedTx.amount} ${settings.currency}`);
  };

  const handleDeleteTransaction = (id: string, options?: { revertInventory?: boolean; revertCustomerDebt?: boolean }) => {
    const targetTx = transactions.find(t => t.id === id);
    if (!targetTx) return;

    // Optional: Revert inventory if deleting a purchase invoice and user chose to revert
    if (options?.revertInventory && (targetTx.isPurchaseInvoice || targetTx.description?.includes('مشتريات بضاعة'))) {
      let updatedProducts = [...products];
      if (Array.isArray(targetTx.purchaseItems) && targetTx.purchaseItems.length > 0) {
        targetTx.purchaseItems.forEach(item => {
          const idx = updatedProducts.findIndex(p => p.id === item.productId);
          if (idx >= 0) {
            const p = updatedProducts[idx];
            const newStock = Math.max(0, (p.stock || 0) - (item.quantity || 0));
            const updatedP = { ...p, stock: newStock };
            updatedProducts[idx] = updatedP;
            if (license.licenseKey) saveStoreDocument(license.licenseKey, 'products', p.id, updatedP);
          }
        });
      } else if (targetTx.id.startsWith('t-')) {
        const batchTs = targetTx.id.slice(2);
        updatedProducts = updatedProducts.filter(p => {
          if (p.id.startsWith(`p-${batchTs}-`)) {
            if (license.licenseKey) deleteStoreDocument(license.licenseKey, 'products', p.id);
            return false;
          }
          return true;
        });
      }
      setProducts(updatedProducts);
    }

    // Optional: Revert customer debt & remove linked Payment record if deleting a customer payment voucher
    if (options?.revertCustomerDebt && targetTx.type === 'payment' && targetTx.customerId) {
      const cust = customers.find(c => c.id === targetTx.customerId);
      if (cust) {
        const updatedCustomer: Customer = {
          ...cust,
          totalDebt: (cust.totalDebt || 0) + targetTx.amount
        };
        setCustomers(prev => prev.map(c => c.id === cust.id ? updatedCustomer : c));
        if (license.licenseKey) saveStoreDocument(license.licenseKey, 'customers', cust.id, updatedCustomer);
      }

      const expectedPayId = targetTx.id.startsWith('t-') ? `pay-${targetTx.id.slice(2)}` : '';
      const matchedPay = payments.find(p =>
        (expectedPayId && p.id === expectedPayId) ||
        (targetTx.referenceNumber && p.referenceNumber === targetTx.referenceNumber && p.customerId === targetTx.customerId)
      );
      if (matchedPay) {
        setPayments(prev => prev.filter(p => p.id !== matchedPay.id));
        if (license.licenseKey) deleteStoreDocument(license.licenseKey, 'payments', matchedPay.id);
      }
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
    if (license.licenseKey) deleteStoreDocument(license.licenseKey, 'transactions', id);
    addAuditLog('voucher_deleted', `حذف سند / قيد مالي #${targetTx.referenceNumber || id.slice(0, 6)}`, targetTx.description);
  };

  // Sync Maintenance Order with Cashbox Transactions when completed/delivered
  const syncMaintenanceTransaction = (order: MaintenanceOrder) => {
    const txId = `t-maint-${order.id}`;
    const partsTxId = `t-maint-parts-${order.id}`;
    const isRevenueActive = (order.status === 'delivered' || order.status === 'completed') && (order.cost || 0) > 0;

    if (isRevenueActive) {
      const maintTx: Transaction = {
        id: txId,
        type: 'maintenance',
        amount: order.cost || 0,
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        referenceNumber: `MNT-${order.orderNumber}`,
        payerOrBeneficiary: order.customerName,
        voucherCategory: 'maintenance_revenue',
        description: `إيراد صيانة كرت #${order.orderNumber} - الجهاز: ${order.deviceName} (${order.customerName})`
      };

      setTransactions(prev => {
        const exists = prev.some(t => t.id === txId);
        return exists ? prev.map(t => t.id === txId ? maintTx : t) : [maintTx, ...prev];
      });
      if (license.licenseKey) saveStoreDocument(license.licenseKey, 'transactions', txId, maintTx);

      if ((order.sparePartsCost || 0) > 0) {
        const partsTx: Transaction = {
          id: partsTxId,
          type: 'expense',
          amount: order.sparePartsCost || 0,
          date: new Date().toISOString(),
          paymentMethod: 'cash',
          referenceNumber: `PRT-${order.orderNumber}`,
          payerOrBeneficiary: order.technicianName || 'ورشة الصيانة',
          voucherCategory: 'spare_parts_expense',
          description: `مصروف قطع غيار صيانة كرت #${order.orderNumber} - الجهاز: ${order.deviceName}`
        };
        setTransactions(prev => {
          const exists = prev.some(t => t.id === partsTxId);
          return exists ? prev.map(t => t.id === partsTxId ? partsTx : t) : [partsTx, ...prev];
        });
        if (license.licenseKey) saveStoreDocument(license.licenseKey, 'transactions', partsTxId, partsTx);
      } else {
        setTransactions(prev => prev.filter(t => t.id !== partsTxId));
        if (license.licenseKey) deleteStoreDocument(license.licenseKey, 'transactions', partsTxId);
      }
    } else {
      setTransactions(prev => prev.filter(t => t.id !== txId && t.id !== partsTxId));
      if (license.licenseKey) {
        deleteStoreDocument(license.licenseKey, 'transactions', txId);
        deleteStoreDocument(license.licenseKey, 'transactions', partsTxId);
      }
    }
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
    syncMaintenanceTransaction(newOrder);

    addAuditLog('maintenance_created', `استلام جهاز صيانة جديد #${orderNum}`, `العميل: ${newOrder.customerName} - الجهاز: ${newOrder.deviceName}`);
  };

  const handleUpdateMaintenanceOrder = (updatedOrder: MaintenanceOrder) => {
    setMaintenanceOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'maintenanceOrders', updatedOrder.id, updatedOrder);
    }
    syncMaintenanceTransaction(updatedOrder);
    addAuditLog('maintenance_updated', `تعديل بيانات كرت الصيانة #${updatedOrder.orderNumber}`, `العميل: ${updatedOrder.customerName} - التكلفة: ${updatedOrder.cost} ${settings.currency}`);
  };

  const handleUpdateMaintenanceStatus = (id: string, status: MaintenanceOrder['status']) => {
    const order = maintenanceOrders.find(o => o.id === id);
    if (!order) return;
    const updated = { ...order, status };

    setMaintenanceOrders(prev => prev.map(o => o.id === id ? updated : o));
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'maintenanceOrders', id, updated);
    }
    syncMaintenanceTransaction(updated);

    const statusMap = { received: 'مستلم', repairing: 'جاري الصيانة', completed: 'جاهز للاستلام', delivered: 'تم التسليم' };
    addAuditLog('maintenance_status_changed', `تغيير حالة كرت الصيانة #${order.orderNumber}`, `الحالة الجديدة: ${statusMap[status] || status}`);
  };

  const handleDeleteMaintenanceOrder = (id: string) => {
    const order = maintenanceOrders.find(o => o.id === id);
    setMaintenanceOrders(prev => prev.filter(o => o.id !== id));
    const txId = `t-maint-${id}`;
    const partsTxId = `t-maint-parts-${id}`;
    setTransactions(prev => prev.filter(t => t.id !== txId && t.id !== partsTxId));

    if (license.licenseKey) {
      deleteStoreDocument(license.licenseKey, 'maintenanceOrders', id);
      deleteStoreDocument(license.licenseKey, 'transactions', txId);
      deleteStoreDocument(license.licenseKey, 'transactions', partsTxId);
    }

    if (order) {
      addAuditLog('maintenance_deleted', `حذف كرت صيانة #${order.orderNumber}`, `العميل: ${order.customerName} - الجهاز: ${order.deviceName}`);
    }
  };

  // Employees & Payroll Handlers
  const handleAddEmployee = (empData: Omit<Employee, 'id' | 'totalAdvances' | 'hireDate'>) => {
    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: empData.name,
      phone: empData.phone,
      jobTitle: empData.jobTitle,
      monthlySalary: empData.monthlySalary,
      totalAdvances: 0,
      hireDate: new Date().toISOString()
    };
    setEmployees(prev => [...prev, newEmp]);
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'employees', newEmp.id, newEmp);
    addAuditLog('employee_added', `إضافة موظف جديد: ${newEmp.name}`, `الوظيفة: ${newEmp.jobTitle} - الراتب: ${newEmp.monthlySalary} ${settings.currency}`);
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
    if (license.licenseKey) saveStoreDocument(license.licenseKey, 'employees', updatedEmp.id, updatedEmp);
    addAuditLog('employee_updated', `تعديل بيانات الموظف: ${updatedEmp.name}`, `الراتب الشهري: ${updatedEmp.monthlySalary} ${settings.currency}`);
  };

  const handleRecordAdvance = (employeeId: string, amount: number, note: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const timestamp = Date.now();
    const updatedEmp: Employee = {
      ...emp,
      totalAdvances: (emp.totalAdvances || 0) + amount
    };
    const newRecord: PayrollRecord = {
      id: `pr-${timestamp}`,
      employeeId: emp.id,
      employeeName: emp.name,
      type: 'advance',
      amount,
      date: new Date().toISOString(),
      note
    };
    const refNum = `ADV-${Math.floor(1000 + Math.random() * 9000)}`;
    const advanceTx: Transaction = {
      id: `t-adv-${timestamp}`,
      type: 'expense',
      amount,
      date: new Date().toISOString(),
      paymentMethod: 'cash',
      referenceNumber: refNum,
      payerOrBeneficiary: emp.name,
      voucherCategory: 'salaries_wages',
      description: `سند صرف سلفة راتب (${emp.name}): ${note}`
    };

    setEmployees(prev => prev.map(e => e.id === emp.id ? updatedEmp : e));
    setPayrollRecords(prev => [...prev, newRecord]);
    setTransactions(prev => [advanceTx, ...prev]);

    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'employees', emp.id, updatedEmp);
      saveStoreDocument(license.licenseKey, 'payrollRecords', newRecord.id, newRecord);
      saveStoreDocument(license.licenseKey, 'transactions', advanceTx.id, advanceTx);
    }

    addAuditLog('employee_advance', `صرف سلفة للموظف: ${emp.name}`, `المبلغ: ${amount} ${settings.currency} - ${note}`);
  };

  const handlePaySalary = (employeeId: string, amount: number, note: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const timestamp = Date.now();
    const updatedEmp: Employee = {
      ...emp,
      totalAdvances: 0
    };
    const newRecord: PayrollRecord = {
      id: `pr-${timestamp}`,
      employeeId: emp.id,
      employeeName: emp.name,
      type: 'salary',
      amount,
      date: new Date().toISOString(),
      note: emp.totalAdvances > 0 ? `${note} (بعد تصفية سلف بمبلغ ${emp.totalAdvances.toLocaleString()} ${settings.currency})` : note
    };
    const refNum = `SAL-${Math.floor(1000 + Math.random() * 9000)}`;
    const salaryTx: Transaction = {
      id: `t-sal-${timestamp}`,
      type: 'expense',
      amount,
      date: new Date().toISOString(),
      paymentMethod: 'cash',
      referenceNumber: refNum,
      payerOrBeneficiary: emp.name,
      voucherCategory: 'salaries_wages',
      description: `سند صرف راتب شهري (${emp.name}): ${note}`
    };

    setEmployees(prev => prev.map(e => e.id === emp.id ? updatedEmp : e));
    setPayrollRecords(prev => [...prev, newRecord]);
    setTransactions(prev => [salaryTx, ...prev]);

    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'employees', emp.id, updatedEmp);
      saveStoreDocument(license.licenseKey, 'payrollRecords', newRecord.id, newRecord);
      saveStoreDocument(license.licenseKey, 'transactions', salaryTx.id, salaryTx);
    }

    addAuditLog('employee_salary_paid', `صرف راتب للموظف: ${emp.name}`, `المبلغ المصروف: ${amount} ${settings.currency} - ${note}`);
  };

  const handleDeleteEmployee = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    setEmployees(prev => prev.filter(e => e.id !== employeeId));
    if (license.licenseKey) deleteStoreDocument(license.licenseKey, 'employees', employeeId);
    if (emp) {
      addAuditLog('employee_deleted', `حذف الموظف: ${emp.name}`, `الوظيفة: ${emp.jobTitle}`);
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

  const handleRestoreData = async (restoredInput: any): Promise<boolean> => {
    if (!restoredInput || typeof restoredInput !== 'object') return false;

    // Support nested JSON wrappers like { data: { ... } } or { backup: { ... } }
    const restored = restoredInput.data || restoredInput.backup || restoredInput;
    let hasRestoredAny = false;

    if (restored.settings && typeof restored.settings === 'object') {
      setSettings(restored.settings);
      safeStorage.setItem('smart_accounting_settings', JSON.stringify(restored.settings));
      if (license.licenseKey) {
        saveStoreSettings(license.licenseKey, restored.settings);
      }
      hasRestoredAny = true;
    }
    if (Array.isArray(restored.products)) {
      setProducts(restored.products);
      safeStorage.setItem('smart_accounting_products', JSON.stringify(restored.products));
      if (license.licenseKey) {
        restored.products.forEach((p: any) => p && p.id && saveStoreDocument(license.licenseKey, 'products', p.id, p));
      }
      hasRestoredAny = true;
    }
    if (Array.isArray(restored.customers)) {
      setCustomers(restored.customers);
      safeStorage.setItem('smart_accounting_customers', JSON.stringify(restored.customers));
      if (license.licenseKey) {
        restored.customers.forEach((c: any) => c && c.id && saveStoreDocument(license.licenseKey, 'customers', c.id, c));
      }
      hasRestoredAny = true;
    }
    if (Array.isArray(restored.invoices)) {
      setInvoices(restored.invoices);
      safeStorage.setItem('smart_accounting_invoices', JSON.stringify(restored.invoices));
      if (license.licenseKey) {
        restored.invoices.forEach((inv: any) => inv && inv.id && saveStoreDocument(license.licenseKey, 'invoices', inv.id, inv));
      }
      hasRestoredAny = true;
    }
    if (Array.isArray(restored.payments)) {
      setPayments(restored.payments);
      safeStorage.setItem('smart_accounting_payments', JSON.stringify(restored.payments));
      if (license.licenseKey) {
        restored.payments.forEach((pay: any) => pay && pay.id && saveStoreDocument(license.licenseKey, 'payments', pay.id, pay));
      }
      hasRestoredAny = true;
    }
    if (Array.isArray(restored.transactions)) {
      setTransactions(restored.transactions);
      safeStorage.setItem('smart_accounting_transactions', JSON.stringify(restored.transactions));
      if (license.licenseKey) {
        restored.transactions.forEach((tx: any) => tx && tx.id && saveStoreDocument(license.licenseKey, 'transactions', tx.id, tx));
      }
      hasRestoredAny = true;
    }
    if (Array.isArray(restored.maintenanceOrders)) {
      setMaintenanceOrders(restored.maintenanceOrders);
      safeStorage.setItem('smart_accounting_maintenance', JSON.stringify(restored.maintenanceOrders));
      if (license.licenseKey) {
        restored.maintenanceOrders.forEach((m: any) => m && m.id && saveStoreDocument(license.licenseKey, 'maintenanceOrders', m.id, m));
      }
      hasRestoredAny = true;
    }
    if (Array.isArray(restored.employees)) {
      setEmployees(restored.employees);
      safeStorage.setItem('smart_accounting_employees', JSON.stringify(restored.employees));
      if (license.licenseKey) {
        restored.employees.forEach((emp: any) => emp && emp.id && saveStoreDocument(license.licenseKey, 'employees', emp.id, emp));
      }
      hasRestoredAny = true;
    }
    if (Array.isArray(restored.payrollRecords)) {
      setPayrollRecords(restored.payrollRecords);
      safeStorage.setItem('smart_accounting_payroll', JSON.stringify(restored.payrollRecords));
      if (license.licenseKey) {
        restored.payrollRecords.forEach((pr: any) => pr && pr.id && saveStoreDocument(license.licenseKey, 'payrollRecords', pr.id, pr));
      }
      hasRestoredAny = true;
    }
    if (Array.isArray(restored.users)) {
      setUsers(restored.users);
      safeStorage.setItem('smart_accounting_users', JSON.stringify(restored.users));
      hasRestoredAny = true;
    }
    return hasRestoredAny;
  };

  const handleResetDatabase = async (onProgress?: (stepLabel: string, deletedCount: number) => void) => {
    const knownIds = {
      products: products.map(p => p.id),
      customers: customers.map(c => c.id),
      invoices: invoices.map(i => i.id),
      payments: payments.map(p => p.id),
      transactions: transactions.map(t => t.id),
      maintenanceOrders: maintenanceOrders.map(m => m.id)
    };

    const res = await wipeStoreCloudAndLocalData(
      license.licenseKey || '',
      license.hwid || generateHWID(),
      knownIds,
      settings,
      onProgress
    );

    setProducts([]);
    setCustomers([]);
    setInvoices([]);
    setPayments([]);
    setTransactions([]);
    setMaintenanceOrders([]);
    setSettings(prev => ({ ...prev, lastCloudResetAt: res.resetTimestamp }));

    addAuditLog(
      'cloud_full_reset',
      'تصفير شامل للنظام والسحابة (الأصناف، العملاء، المبيعات، المشتريات، والديون)',
      `تم تطهير ${res.deletedCount} سجل سحابي ومحلي مع تثبيت قفل منع الاسترجاع`
    );
    soundManager.playSuccessChime();
    return res;
  };

  if (!isActivated) {
    return (
      <>
        <SaaSActivator 
          license={license}
          setLicense={setLicense}
          onActivationSuccess={(updatedLicense) => setLicense(updatedLicense)} 
          onOpenDevPortal={() => {
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
      case 'printer_settings': return 'مركز ضبط الطابعة وتخصيص الفواتير';
      case 'settings': return 'إعدادات النظام والترخيص';
      default: return settings.storeName || license.customerName || 'نظام سند المحاسبي';
    }
  };

  const isDesktopMode = (settings.deviceMode || 'mobile') === 'desktop';
  const themeClass = `theme-${settings.appTheme || 'financial-blue'}`;
  const shapeClass = `shape-${settings.cardShape || 'rounded'}`;
  const densityClass = `density-${settings.density || 'comfortable'}`;

  return (
    <div className={`flex flex-col h-screen w-full bg-slate-100 text-slate-900 select-none overflow-hidden font-sans dir-rtl ${isDesktopMode ? 'mode-desktop' : 'mode-mobile'} ${themeClass} ${shapeClass} ${densityClass}`} dir="rtl">
      
      {/* 1. TOP BAR */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-xs shrink-0">
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
          {/* Calculator Button replacing download button in header */}
          <button
            onClick={() => {
              soundManager.playScanBeep();
              setShowCalculator(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95"
            title="فتح الآلة الحاسبة السريعة"
          >
            <Calculator className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden xs:inline font-bold">الحاسبة</span>
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

      {/* 2. MAIN WORKSPACE WRAPPER */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar Navigation Rail */}
        {isDesktopMode && (
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
            currentUser={currentUser}
            users={users}
            setCurrentUser={setCurrentUser}
          />
        )}

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 pb-16 bg-slate-50 relative screen-content-wrapper">
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
                isDesktopMode ? (
                  <DesktopDashboardView
                    products={products}
                    customers={customers}
                    invoices={invoices}
                    payments={payments}
                    transactions={transactions}
                    settings={settings}
                    employees={employees}
                    setActiveTab={handleTabSelect}
                    isPrivacyMode={isPrivacyMode}
                  />
                ) : (
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
                )
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
                onBulkAddProducts={handleBulkAddProducts}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onRestoreProducts={handleRestoreProducts}
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
                products={products}
                customers={customers}
                onAddExpense={handleAddExpense}
                onAddReceiptVoucher={handleAddReceiptVoucher}
                onUpdateTransaction={handleUpdateTransaction}
                onUpdatePurchaseInvoice={handleUpdatePurchaseInvoice}
                onDeleteTransaction={handleDeleteTransaction}
                onRefundInvoice={handleRefundInvoice}
                onViewInvoice={setActiveInvoice}
                currency={settings.currency}
                isPrivacyMode={isPrivacyMode}
                storeName={settings.storeName}
              />
            )}

            {activeTab === 'maintenance' && (
              <Maintenance
                orders={maintenanceOrders}
                onAddOrder={handleAddMaintenanceOrder}
                onUpdateOrder={handleUpdateMaintenanceOrder}
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
                onAddEmployee={handleAddEmployee}
                onUpdateEmployee={handleUpdateEmployee}
                onRecordAdvance={handleRecordAdvance}
                onPaySalary={handlePaySalary}
                onDeleteEmployee={handleDeleteEmployee}
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

            {activeTab === 'printer_settings' && (
              <PrinterInvoiceStudio
                settings={settings}
                onSaveSettings={handleSaveSettings}
                isStandaloneTab={true}
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
    </div>

      {/* 3. COMPACT BOTTOM NAVBAR (For Mobile/Responsive Mode) */}
      {!isDesktopMode && (
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
      )}

      {/* Modals & Tools */}
      {activeInvoice && (
        <InvoiceModal
          invoice={activeInvoice}
          onClose={() => setActiveInvoice(null)}
          settings={settings}
          customers={customers}
          onOpenPrinterSettings={() => {
            setActiveInvoice(null);
            handleTabSelect('printer_settings');
          }}
          onSaveSettings={handleSaveSettings}
        />
      )}

      <FloatingCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />

      {/* 🎙️ Sanad AI Voice Assistant Floating Button */}
      {!activeInvoice && (
        <div className="fixed bottom-24 left-6 z-40 no-print">
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
      )}

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
              <button
                type="button"
                onClick={() => openWhatsApp('967777140209', 'تنبيه: تم تعليق/إلغاء الترخيص، أود التواصل للتسديد واستئناف الخدمة')}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                💬 التواصل المباشر عبر واتساب للتسديد (777140209)
              </button>
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
