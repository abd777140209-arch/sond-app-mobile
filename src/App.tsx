/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  History, 
  Settings as SettingsIcon, 
  Lock, 
  Clock, 
  Smartphone, 
  AlertCircle,
  Wrench,
  LogOut
} from 'lucide-react';

import { Product, Customer, Invoice, Payment, Transaction, SystemSettings, MaintenanceOrder } from './types';
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
import Transactions from './components/Transactions';
import Settings from './components/Settings';
import InvoiceModal from './components/InvoiceModal';
import Maintenance from './components/Maintenance';
import SaaSActivator from './components/SaaSActivator';
import DeveloperPortalModal from './components/DeveloperPortalModal';
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

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showDevPortal, setShowDevPortal] = useState<boolean>(false);
  
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

    // Request Android & Web startup permissions (Notifications, Camera, Storage, Vibration)
    requestAndroidStartupPermissions().catch((err) => {
      console.warn('Android startup permissions check handled:', err);
    });

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);
  
  // SaaS License state (Continuous cloud handshake & local sync)
  const [license, setLicense] = useState<LicenseInfo>(() => loadLicenseLocally());

  const isActivated = license.status === 'active' || license.status === 'trial';

  // Logout/Deactivate current license
  const handleLogout = () => {
    soundManager.playWarningBeep();
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
    window.location.reload();
  };

  // Real-time silent cloud license activation/blocking check based on HWID
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const silentCheck = async () => {
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

    return () => {
      console.log(`[Sync] Terminating real-time cloud sync for store: ${license.licenseKey}`);
      unsubSettings();
      unsubProducts();
      unsubCustomers();
      unsubInvoices();
      unsubPayments();
      unsubTransactions();
      unsubMaintenance();
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
      totalDebt: 0,
      createdAt: new Date().toISOString()
    };
    if (license.licenseKey) {
      saveStoreDocument(license.licenseKey, 'customers', newCustomer.id, newCustomer);
    } else {
      setCustomers(prev => [...prev, newCustomer]);
    }
  };

  // Action: Delete customer
  const handleDeleteCustomer = (customerId: string) => {
    if (license.licenseKey) {
      deleteStoreDocument(license.licenseKey, 'customers', customerId);
    } else {
      setCustomers(prev => prev.filter(c => c.id !== customerId));
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

  // Action: Delete product
  const handleDeleteProduct = (productId: string) => {
    if (license.licenseKey) {
      deleteStoreDocument(license.licenseKey, 'products', productId);
    } else {
      setProducts(prev => prev.filter(p => p.id !== productId));
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
      <div className="min-h-screen bg-[#070C12] text-slate-100 flex items-center justify-center p-4">
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

  // SaaS Activation Gate
  if (!isActivated) {
    return (
      <SaaSActivator 
        license={license}
        setLicense={setLicense}
        onActivationSuccess={(updatedLicense) => {
          setLicense(updatedLicense);
        }} 
      />
    );
  }

  // Count low stocks for dynamic red badge on sidemenu
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  return (
    <div id="application_root_container" className="min-h-screen bg-[#070C12] text-slate-100 flex flex-col">
      
      {/* 1. TOP ACCESS BAR (Non-printed) */}
      <header id="desktop_topbar" className="no-print h-14 md:h-16 bg-[#0B141F] border-b border-[#C5A862]/30 px-3 md:px-6 flex justify-between items-center z-40 shadow-md">
        
        {/* System Branding & Icon */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 md:p-2 rounded-xl bg-gradient-to-br from-[#1E2E44] to-[#121E2E] border border-[#C5A862]/40 shadow-inner">
            <Smartphone className="w-4 h-4 md:w-5 md:h-5 text-[#C5A862]" />
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-[#F3E7C4] to-[#C5A862]">
              {settings.storeName}
            </h1>
            <p className="hidden md:block text-[10px] text-gray-500 font-mono tracking-widest leading-none mt-0.5 select-none">
              DESKTOP SYSTEM v
              <span 
                id="secret_dev_trigger"
                onClick={() => {
                  soundManager.playScanBeep();
                  setShowDevPortal(true);
                }}
                className="cursor-default hover:text-[#C5A862]/80 transition-colors duration-150 font-bold px-0.5"
                title="v2.4"
              >
                2
              </span>
              .4
            </p>
          </div>
        </div>

        {/* Cloud Sync Status Badge */}
        {license.licenseKey && isActivated && (
          <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 md:px-4 md:py-1.5 rounded-xl text-[10px] md:text-xs text-emerald-400 font-medium select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>سحابي</span>
          </div>
        )}

        {/* Live Active Clock Widget */}
        <div className="hidden md:flex items-center gap-2 bg-[#101A27] border border-gray-800 px-4 py-1.5 rounded-xl text-xs text-gray-400 font-medium">
          <Clock className="w-4 h-4 text-[#C5A862]" />
          <span className="font-mono mt-0.5">{currentTime}</span>
        </div>

        {/* Quick lock and diagnostic sound check buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          
          {/* Diagnostic beep test */}
          <button
            id="sound_test_btn"
            onClick={() => soundManager.playScanBeep()}
            className="p-1.5 md:p-2 rounded-xl bg-slate-800/40 border border-gray-800 hover:border-[#C5A862]/40 text-gray-400 hover:text-[#C5A862] transition cursor-pointer text-[11px] md:text-xs flex items-center gap-1"
            title="فحص صوت الباركود"
          >
            🔊 <span className="hidden sm:inline">فحص الصوت</span>
          </button>

          {/* Logout button */}
          <button
            id="topbar_logout_btn"
            onClick={() => {
              if (confirm('⚠️ هل أنت متأكد من رغبتك في تسجيل الخروج وإلغاء ترخيص الجهاز؟')) {
                handleLogout();
              }
            }}
            className="p-1.5 px-2.5 md:p-2 md:px-3 rounded-xl bg-red-950/30 hover:bg-red-900/30 border border-red-500/20 hover:border-red-500/50 text-red-400 hover:text-red-300 transition cursor-pointer text-[11px] md:text-xs flex items-center gap-1"
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
        <aside id="desktop_navigation_rail" className="no-print hidden md:block w-64 bg-[#0A121D] border-l border-[#C5A862]/10 p-4 space-y-2 shrink-0">
          
          <p className="text-[10px] text-gray-500 uppercase tracking-wider px-3.5 mb-3">لوحات التحكم والتنفيذ</p>
          
          <nav className="flex flex-col gap-1">
            
            {/* Dashboard tab */}
            <button
              id="tab_trigger_dashboard"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('dashboard');
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-right ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-l from-[#1B2C3F] to-[#0F1924] text-[#C5A862] border-r-2 border-[#C5A862]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#121E2C]/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>الرئيسية والملخص</span>
            </button>

            {/* POS terminal tab */}
            <button
              id="tab_trigger_pos"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('pos');
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-right ${
                activeTab === 'pos'
                  ? 'bg-gradient-to-l from-[#1B2C3F] to-[#0F1924] text-[#C5A862] border-r-2 border-[#C5A862]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#121E2C]/40'
              }`}
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span>شاشة المبيعات (POS)</span>
            </button>

            {/* Customers tab */}
            <button
              id="tab_trigger_customers"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('customers');
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-right ${
                activeTab === 'customers'
                  ? 'bg-gradient-to-l from-[#1B2C3F] to-[#0F1924] text-[#C5A862] border-r-2 border-[#C5A862]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#121E2C]/40'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>العملاء والديون (الذمم)</span>
            </button>

            {/* Inventory tab */}
            <button
              id="tab_trigger_inventory"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('inventory');
              }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-right ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-l from-[#1B2C3F] to-[#0F1924] text-[#C5A862] border-r-2 border-[#C5A862]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#121E2C]/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4 shrink-0" />
                <span>المستودع والمخزن</span>
              </div>
              {lowStockCount > 0 && (
                <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500 text-black rounded-full animate-bounce">
                  {lowStockCount}
                </span>
              )}
            </button>

            {/* Transactions history tab */}
            <button
              id="tab_trigger_transactions"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('transactions');
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-right ${
                activeTab === 'transactions'
                  ? 'bg-gradient-to-l from-[#1B2C3F] to-[#0F1924] text-[#C5A862] border-r-2 border-[#C5A862]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#121E2C]/40'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>القيود والتحصيلات</span>
            </button>

            {/* Maintenance & Programming tab */}
            <button
              id="tab_trigger_maintenance"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('maintenance');
              }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-right ${
                activeTab === 'maintenance'
                  ? 'bg-gradient-to-l from-[#1B2C3F] to-[#0F1924] text-[#C5A862] border-r-2 border-[#C5A862]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#121E2C]/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <Wrench className="w-4 h-4 shrink-0" />
                <span>قسم الصيانة والبرمجة</span>
              </div>
              {maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length > 0 && (
                <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500 text-black rounded-full">
                  {maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length}
                </span>
              )}
            </button>

            {/* Settings config tab */}
            <button
              id="tab_trigger_settings"
              onClick={() => {
                soundManager.playScanBeep();
                setActiveTab('settings');
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-right ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-l from-[#1B2C3F] to-[#0F1924] text-[#C5A862] border-r-2 border-[#C5A862]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#121E2C]/40'
              }`}
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
              <span>إعدادات النظام</span>
            </button>

          </nav>

          {/* Sidebar Logout button */}
          <div className="pt-2 border-t border-[#C5A862]/10">
            <button
              id="sidebar_logout_btn"
              onClick={() => {
                if (confirm('⚠️ هل أنت متأكد من رغبتك في تسجيل الخروج وإلغاء ترخيص الجهاز؟')) {
                  handleLogout();
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-all cursor-pointer text-right"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>تسجيل الخروج</span>
            </button>
          </div>

          {/* Quick Help Section (PC Specs) */}
          <div className="p-4 mt-8 rounded-xl bg-slate-900/40 border border-slate-800/60 text-[10px] text-gray-500 space-y-1.5">
            <div className="font-semibold text-gray-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-[#C5A862]" /> معلومات النظام
            </div>
            <p>المخزن المحلي: نشط ومحفوظ</p>
            <p>لوحة المفاتيح: مدعومة ومسجلة</p>
            <p>المهندس: عبدالمجيد المحواشي</p>
          </div>

        </aside>

        {/* 3. CORE SUB-VIEW HUB */}
        <main id="desktop_sub_view_hub" className="flex-1 p-3 md:p-6 pb-20 md:pb-6 overflow-y-auto bg-[#070C12] relative">
          
          {activeTab === 'dashboard' && (
            <Dashboard
              products={products}
              customers={customers}
              invoices={invoices}
              payments={payments}
              transactions={transactions}
              settings={settings}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'pos' && (
            <POS
              products={products}
              customers={customers}
              onCompleteSale={handleCompleteSale}
              currency={settings.currency}
            />
          )}

          {activeTab === 'customers' && (
            <Customers
              customers={customers}
              payments={payments}
              onAddCustomer={handleAddCustomer}
              onPayDebt={handlePayDebt}
              onDeleteCustomer={handleDeleteCustomer}
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
      <nav id="mobile_bottom_nav" className="no-print md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0B141F]/95 backdrop-blur-md border-t border-[#C5A862]/30 px-1 py-1.5 flex justify-around items-center shadow-[0_-5px_20px_rgba(0,0,0,0.6)] select-none">
        
        {/* Dashboard */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('dashboard');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all ${
            activeTab === 'dashboard'
              ? 'text-[#C5A862] bg-[#1B2C3F]/80 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span className="text-[9px]">الرئيسية</span>
        </button>

        {/* POS */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('pos');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all ${
            activeTab === 'pos'
              ? 'text-[#C5A862] bg-[#1B2C3F]/80 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4 mb-0.5" />
          <span className="text-[9px]">المبيعات</span>
        </button>

        {/* Inventory */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('inventory');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl relative transition-all ${
            activeTab === 'inventory'
              ? 'text-[#C5A862] bg-[#1B2C3F]/80 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className="relative">
            <Package className="w-4 h-4 mb-0.5" />
            {lowStockCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 text-[8px] font-bold bg-amber-500 text-black rounded-full flex items-center justify-center animate-pulse">
                {lowStockCount}
              </span>
            )}
          </div>
          <span className="text-[9px]">المخزن</span>
        </button>

        {/* Customers */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('customers');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all ${
            activeTab === 'customers'
              ? 'text-[#C5A862] bg-[#1B2C3F]/80 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span className="text-[9px]">العملاء</span>
        </button>

        {/* Maintenance */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('maintenance');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl relative transition-all ${
            activeTab === 'maintenance'
              ? 'text-[#C5A862] bg-[#1B2C3F]/80 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <div className="relative">
            <Wrench className="w-4 h-4 mb-0.5" />
            {maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length > 0 && (
              <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 text-[8px] font-bold bg-amber-500 text-black rounded-full flex items-center justify-center">
                {maintenanceOrders.filter(o => o.status === 'received' || o.status === 'repairing').length}
              </span>
            )}
          </div>
          <span className="text-[9px]">الصيانة</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setActiveTab('settings');
          }}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all ${
            activeTab === 'settings'
              ? 'text-[#C5A862] bg-[#1B2C3F]/80 font-bold scale-105'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <SettingsIcon className="w-4 h-4 mb-0.5" />
          <span className="text-[9px]">الإعدادات</span>
        </button>

      </nav>

      {/* 5. FOOTER (Non-printed, Desktop) */}
      <footer id="desktop_footer" className="no-print hidden md:flex h-8 bg-[#090E14] border-t border-gray-800 px-6 justify-between items-center text-[10px] text-gray-500">
        <span>نظام سند الذكي المحاسبي • نسخة الهواتف والكمبيوتر</span>
        <span>برمجة وتطوير: عبدالمجيد المحواشي (الجمهورية اليمنية) © 2026</span>
      </footer>

    </div>
  );
}
