import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, DollarSign, Wallet, Trash2, Calendar, FileText, Search, AlertTriangle, CheckCircle2, ShieldAlert, X, Edit3 } from 'lucide-react';
import { Employee, PayrollRecord } from '../types';
import { soundManager } from '../utils/sound';

interface EmployeesProps {
  employees: Employee[];
  payrollRecords: PayrollRecord[];
  onAddEmployee: (employee: Omit<Employee, 'id' | 'totalAdvances' | 'hireDate'>) => void;
  onUpdateEmployee?: (employee: Employee) => void;
  onRecordAdvance: (employeeId: string, amount: number, note: string) => void;
  onPaySalary: (employeeId: string, amount: number, note: string) => void;
  onDeleteEmployee: (employeeId: string) => void;
  currency: string;
}

export default function Employees({
  employees,
  payrollRecords,
  onAddEmployee,
  onUpdateEmployee,
  onRecordAdvance,
  onPaySalary,
  onDeleteEmployee,
  currency
}: EmployeesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTargetEmployee, setDeleteTargetEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [modalType, setModalType] = useState<'advance' | 'salary' | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  // Form states
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('كاشير');
  const [newSalary, setNewSalary] = useState('');

  // Advance/Salary Form
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const activeEmployees = employees.filter(e => !e.isDeleted);
  const filteredEmployees = activeEmployees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.phone.includes(searchTerm) ||
    e.jobTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMonthlySalaries = activeEmployees.reduce((acc, e) => acc + (e.monthlySalary || 0), 0);
  const totalOutstandingAdvances = activeEmployees.reduce((acc, e) => acc + (e.totalAdvances || 0), 0);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!newName.trim() || !newSalary || Number(newSalary) <= 0) {
      soundManager.playWarningBeep();
      setFormError('يرجى إدخال اسم الموظف والراتب الشهري بشكل صحيح.');
      return;
    }

    if (editingEmployee && onUpdateEmployee) {
      onUpdateEmployee({
        ...editingEmployee,
        name: newName.trim(),
        phone: newPhone.trim() || 'غير محدد',
        jobTitle: newJobTitle,
        monthlySalary: Number(newSalary)
      });
      showToast(`تم تحديث بيانات الموظف (${newName.trim()}) بنجاح`);
    } else {
      onAddEmployee({
        name: newName.trim(),
        phone: newPhone.trim() || 'غير محدد',
        jobTitle: newJobTitle,
        monthlySalary: Number(newSalary)
      });
      showToast(`تم إضافة الموظف (${newName.trim()}) وحفظه بالنظام`);
    }

    soundManager.playSuccessChime();
    setNewName('');
    setNewPhone('');
    setNewSalary('');
    setEditingEmployee(null);
    setShowAddModal(false);
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedEmployee || !amount || Number(amount) <= 0) {
      soundManager.playWarningBeep();
      setFormError('يرجى إدخال مبلغ مالي صحيح أكبر من صفر.');
      return;
    }

    const numAmount = Number(amount);

    if (modalType === 'advance') {
      onRecordAdvance(selectedEmployee.id, numAmount, note.trim() || 'سلفة مالية');
      showToast(`تم تسجيل سلفة بمبلغ ${numAmount.toLocaleString()} ${currency} وقيدها في الصندوق`);
    } else if (modalType === 'salary') {
      onPaySalary(selectedEmployee.id, numAmount, note.trim() || 'صرف راتب شهري');
      showToast(`تم صرف راتب بمبلغ ${numAmount.toLocaleString()} ${currency} وتصفية السلف وقيده في الصندوق`);
    }

    soundManager.playSuccessChime();
    setAmount('');
    setNote('');
    setSelectedEmployee(null);
    setModalType(null);
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>إدارة الموظفين والرواتب والسُلف</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            تسجيل العمال، متابعة سلف العمال والمكافآت، وصرف الرواتب الشهرية وتثبيتها بالقيود.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingEmployee(null);
            setNewName('');
            setNewPhone('');
            setNewJobTitle('كاشير');
            setNewSalary('');
            setFormError('');
            setShowAddModal(true);
          }}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-xs"
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">إجمالي الموظفين</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 sm:mt-1">{activeEmployees.length}</div>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">إجمالي الرواتب الشهرية</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 sm:mt-1 font-mono">
              {totalMonthlySalaries.toLocaleString()} <span className="text-xs text-slate-400 font-normal">{currency}</span>
            </div>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">إجمالي السُلف المتبقية</span>
            <div className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5 sm:mt-1 font-mono">
              {totalOutstandingAdvances.toLocaleString()} <span className="text-xs text-slate-400 font-normal">{currency}</span>
            </div>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* Search Input with quick clear */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="بحث بالاسم، المسمى الوظيفي أو رقم الهاتف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-10 py-2.5 sm:py-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-xs"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
            title="مسح البحث"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Employees Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map((employee) => (
          <div
            key={employee.id}
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition space-y-4 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm">
                    {employee.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{employee.name}</h3>
                    <p className="text-xs text-blue-600 font-bold">{employee.jobTitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingEmployee(employee);
                      setNewName(employee.name);
                      setNewPhone(employee.phone === 'غير محدد' ? '' : employee.phone);
                      setNewJobTitle(employee.jobTitle);
                      setNewSalary(String(employee.monthlySalary));
                      setFormError('');
                      setShowAddModal(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                    title="تعديل بيانات الموظف"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTargetEmployee(employee)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="حذف الموظف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">الهاتف:</span>
                  <span className="font-mono">{employee.phone}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">الراتب الشهري:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {employee.monthlySalary.toLocaleString()} {currency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">رصيد السُلف:</span>
                  <span className={`font-mono font-bold ${employee.totalAdvances > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {employee.totalAdvances.toLocaleString()} {currency}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                  <span className="text-slate-500 font-bold">صافي الراتب المستحق:</span>
                  <span className="font-mono font-black text-blue-600">
                    {Math.max(0, employee.monthlySalary - employee.totalAdvances).toLocaleString()} {currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Employee Actions */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setSelectedEmployee(employee);
                  setAmount('');
                  setNote('');
                  setFormError('');
                  setModalType('advance');
                }}
                className="py-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>تسجيل سلفة</span>
              </button>

              <button
                onClick={() => {
                  setSelectedEmployee(employee);
                  setAmount(String(Math.max(0, employee.monthlySalary - employee.totalAdvances)));
                  setNote(`صرف راتب شهر ${new Date().toLocaleDateString('ar-YE', { month: 'long', year: 'numeric' })}`);
                  setFormError('');
                  setModalType('salary');
                }}
                className="py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>صرف راتب</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Add / Edit Employee (Bottom Sheet) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowAddModal(false);
                setEditingEmployee(null);
              }}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[90vh] overflow-y-auto text-right text-slate-900"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <span>{editingEmployee ? `تعديل بيانات الموظف: ${editingEmployee.name}` : 'إضافة موظف جديد'}</span>
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingEmployee(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">اسم الموظف الكامل *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: محمد أحمد العبسي"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">المسمى الوظيفي</label>
                    <select
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      <option value="كاشير">كاشير مبيعات</option>
                      <option value="فني صيانة">فني صيانة وتصليح</option>
                      <option value="مدير معرض">مدير معرض</option>
                      <option value="محاسب">محاسب</option>
                      <option value="عامل نظافة وتنظيم">عامل تنظيم ونظافة</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 block mb-1">رقم الهاتف</label>
                    <input
                      type="text"
                      placeholder="770000000"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 block mb-1">الراتب الشهري المتفق عليه ({currency}) *</label>
                  <input
                    type="number"
                    required
                    placeholder="150000"
                    value={newSalary}
                    onChange={(e) => setNewSalary(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingEmployee(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition cursor-pointer shadow-xs"
                  >
                    {editingEmployee ? 'حفظ التعديلات' : 'حفظ الموظف'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Advance or Salary Payment (Bottom Sheet) */}
      <AnimatePresence>
        {modalType && selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setModalType(null);
                setSelectedEmployee(null);
              }}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl z-10 max-h-[90vh] overflow-y-auto text-right text-slate-900"
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  {modalType === 'advance' ? (
                    <>
                      <Wallet className="w-5 h-5 text-amber-600" />
                      <span>تسجيل سلفة للموظف: {selectedEmployee.name}</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      <span>صرف راتب للموظف: {selectedEmployee.name}</span>
                    </>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setModalType(null);
                    setSelectedEmployee(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {formError}
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>الراتب المحدد:</span>
                  <span className="font-mono text-emerald-600 font-bold">{selectedEmployee.monthlySalary.toLocaleString()} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>إجمالي السُلف الحالية:</span>
                  <span className="font-mono text-amber-600 font-bold">{selectedEmployee.totalAdvances.toLocaleString()} {currency}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-bold">الصافي المتبقي بعد السلف:</span>
                  <span className="font-mono text-blue-600 font-black">{Math.max(0, selectedEmployee.monthlySalary - selectedEmployee.totalAdvances).toLocaleString()} {currency}</span>
                </div>
              </div>

              <form onSubmit={handleActionSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">المبلغ المصروف من الصندوق ({currency}) *</label>
                  <input
                    type="number"
                    required
                    placeholder={modalType === 'salary' ? String(Math.max(0, selectedEmployee.monthlySalary - selectedEmployee.totalAdvances)) : '20000'}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600 block mb-1">ملاحظة / بيان سند الصرف</label>
                  <input
                    type="text"
                    placeholder={modalType === 'advance' ? 'سلفة لحالة طارئة' : 'صرف راتب شهري'}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setModalType(null);
                      setSelectedEmployee(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer shadow-xs ${
                      modalType === 'advance'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    تأكيد الصرف وقيد السند بالصندوق
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTargetEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 text-right">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-100">
                  <Trash2 className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">تأكيد حذف الموظف</h3>
                  <p className="text-xs text-slate-500">{deleteTargetEmployee.name}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                هل أنت متأكد من حذف الموظف <span className="font-bold text-slate-900">({deleteTargetEmployee.name})</span> من سجل الموظفين النشطين؟
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    onDeleteEmployee(deleteTargetEmployee.id);
                    showToast(`تم حذف الموظف (${deleteTargetEmployee.name})`);
                    setDeleteTargetEmployee(null);
                    soundManager.playScanBeep();
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  تأكيد الحذف
                </button>
                <button
                  onClick={() => setDeleteTargetEmployee(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Payroll Records History */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <span>سجل حركات السلف والرواتب الأخير</span>
        </h3>

        {payrollRecords.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">لا توجد حركات سلف أو رواتب مسجلة بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right text-slate-700">
              <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">اسم الموظف</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">الملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollRecords.slice().reverse().map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono text-slate-500">{new Date(record.date).toLocaleDateString('ar-YE')}</td>
                    <td className="p-3 font-bold text-slate-900">{record.employeeName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        record.type === 'advance'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {record.type === 'advance' ? 'سلفة' : 'صرف راتب'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {record.amount.toLocaleString()} {currency}
                    </td>
                    <td className="p-3 text-slate-500">{record.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
