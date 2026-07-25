import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, DollarSign, Wallet, Trash2, Calendar, FileText, Search, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Employee, PayrollRecord } from '../types';
import { soundManager } from '../utils/sound';

interface EmployeesProps {
  employees: Employee[];
  payrollRecords: PayrollRecord[];
  onAddEmployee: (employee: Omit<Employee, 'id' | 'totalAdvances' | 'hireDate'>) => void;
  onRecordAdvance: (employeeId: string, amount: number, note: string) => void;
  onPaySalary: (employeeId: string, amount: number, note: string) => void;
  onDeleteEmployee: (employeeId: string) => void;
  currency: string;
}

export default function Employees({
  employees,
  payrollRecords,
  onAddEmployee,
  onRecordAdvance,
  onPaySalary,
  onDeleteEmployee,
  currency
}: EmployeesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [modalType, setModalType] = useState<'advance' | 'salary' | null>(null);

  // Form states
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('كاشير');
  const [newSalary, setNewSalary] = useState('');

  // Advance/Salary Form
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

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
    if (!newName.trim() || !newSalary || Number(newSalary) <= 0) {
      soundManager.playWarningBeep();
      alert('يرجى ملء جميع الحقول بصورة صحيحة');
      return;
    }

    onAddEmployee({
      name: newName.trim(),
      phone: newPhone.trim() || 'غير محدد',
      jobTitle: newJobTitle,
      monthlySalary: Number(newSalary)
    });

    soundManager.playSuccessChime();
    setNewName('');
    setNewPhone('');
    setNewSalary('');
    setShowAddModal(false);
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !amount || Number(amount) <= 0) {
      soundManager.playWarningBeep();
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }

    const numAmount = Number(amount);

    if (modalType === 'advance') {
      onRecordAdvance(selectedEmployee.id, numAmount, note.trim() || 'سلفة مالية');
    } else if (modalType === 'salary') {
      onPaySalary(selectedEmployee.id, numAmount, note.trim() || 'صرف راتب شهري');
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>إدارة الموظفين والرواتب والسُلف</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل العمال، متابعة سلف العمال والمكافآت، وصرف الرواتب الشهرية وتثبيتها بالقيود.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer text-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">إجمالي الموظفين</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{activeEmployees.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">إجمالي الرواتب الشهرية</span>
            <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
              {totalMonthlySalaries.toLocaleString()} <span className="text-xs text-slate-400 font-normal">{currency}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">إجمالي السُلف المتبقية</span>
            <div className="text-2xl font-black text-amber-600 mt-1 font-mono">
              {totalOutstandingAdvances.toLocaleString()} <span className="text-xs text-slate-400 font-normal">{currency}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="بحث بالاسم، المسمى الوظيفي أو رقم الهاتف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-4 pr-10 py-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs"
        />
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

                <button
                  onClick={() => {
                    if (confirm(`هل أنت متأكد من حذف الموظف ${employee.name}؟`)) {
                      onDeleteEmployee(employee.id);
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition"
                  title="حذف الموظف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
              </div>
            </div>

            {/* Employee Actions */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setSelectedEmployee(employee);
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

      {/* Floating Action Button (FAB) for Mobile */}
      <motion.div 
        drag
        dragMomentum={false}
        whileDrag={{ scale: 1.1 }}
        className="fixed bottom-6 right-6 z-40 touch-none cursor-grab active:cursor-grabbing"
      >
        <button
          onClick={() => {
            soundManager.playScanBeep();
            setShowAddModal(true);
          }}
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-2xl flex items-center justify-center transition cursor-pointer border-2 border-white"
          title="إضافة موظف جديد (يمكنك سحبه وتحريكه)"
        >
          <UserPlus className="w-6 h-6" />
        </button>
      </motion.div>

      {/* Modal: Add Employee */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-900"
            >
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span>إضافة موظف جديد</span>
              </h3>

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
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition cursor-pointer shadow-xs"
                  >
                    حفظ الموظف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Advance or Salary Payment */}
      <AnimatePresence>
        {modalType && selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-900"
            >
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
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

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>الراتب المحدد:</span>
                  <span className="font-mono text-emerald-600 font-bold">{selectedEmployee.monthlySalary.toLocaleString()} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>إجمالي السُلف الحالية:</span>
                  <span className="font-mono text-amber-600 font-bold">{selectedEmployee.totalAdvances.toLocaleString()} {currency}</span>
                </div>
              </div>

              <form onSubmit={handleActionSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">المبلغ المطلوب ({currency}) *</label>
                  <input
                    type="number"
                    required
                    placeholder={modalType === 'salary' ? String(selectedEmployee.monthlySalary - selectedEmployee.totalAdvances) : '20000'}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600 block mb-1">ملاحظة / بيان القيد</label>
                  <input
                    type="text"
                    placeholder={modalType === 'advance' ? 'سلفة لحالة طارئة' : 'صرف راتب شهر يوليو'}
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
                    تأكيد وتسجيل القيد
                  </button>
                </div>
              </form>
            </motion.div>
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
