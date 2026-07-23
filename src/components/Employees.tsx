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
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0B141F] p-5 rounded-2xl border border-[#C5A862]/30 shadow-lg">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-[#C5A862]" />
            <span>إدارة الموظفين والرواتب والسُلف</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            تسجيل العمال، متابعة سلف العمال والمكافآت، وصرف الرواتب الشهرية وتثبيتها بالقيود.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-[#C5A862] to-[#A38641] hover:from-[#d4b771] hover:to-[#b3954f] text-black font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer text-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0E1825] p-4 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">إجمالي الموظفين</span>
            <div className="text-2xl font-black text-white mt-1">{activeEmployees.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-800/40 text-blue-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#0E1825] p-4 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">إجمالي الرواتب الشهرية</span>
            <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
              {totalMonthlySalaries.toLocaleString()} <span className="text-xs">{currency}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#0E1825] p-4 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400">إجمالي السُلف المتبقية</span>
            <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
              {totalOutstandingAdvances.toLocaleString()} <span className="text-xs">{currency}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/40 text-amber-400">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="بحث بالاسم، المسمى الوظيفي أو رقم الهاتف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-4 pr-10 py-3 rounded-xl bg-[#0B141F] border border-gray-800 text-sm text-white focus:outline-none focus:border-[#C5A862]"
        />
      </div>

      {/* Employees Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map((employee) => (
          <div
            key={employee.id}
            className="bg-[#0E1825] p-5 rounded-2xl border border-gray-800 hover:border-[#C5A862]/40 transition space-y-4 shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E2E44] to-[#121E2E] border border-[#C5A862]/30 flex items-center justify-center font-bold text-[#C5A862] text-sm">
                    {employee.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{employee.name}</h3>
                    <p className="text-xs text-[#C5A862] font-medium">{employee.jobTitle}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`هل أنت متأكد من حذف الموظف ${employee.name}؟`)) {
                      onDeleteEmployee(employee.id);
                    }
                  }}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition"
                  title="حذف الموظف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-800/80 space-y-2 text-xs text-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">الهاتف:</span>
                  <span className="font-mono">{employee.phone}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">الراتب الشهري:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {employee.monthlySalary.toLocaleString()} {currency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">رصيد السُلف:</span>
                  <span className={`font-mono font-bold ${employee.totalAdvances > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                    {employee.totalAdvances.toLocaleString()} {currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Employee Actions */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-800/80">
              <button
                onClick={() => {
                  setSelectedEmployee(employee);
                  setModalType('advance');
                }}
                className="py-2 px-3 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-300 hover:bg-amber-900/40 text-xs font-bold transition flex items-center justify-center gap-1"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>تسجيل سلفة</span>
              </button>

              <button
                onClick={() => {
                  setSelectedEmployee(employee);
                  setModalType('salary');
                }}
                className="py-2 px-3 rounded-xl bg-emerald-950/40 border border-emerald-600/30 text-emerald-300 hover:bg-emerald-900/40 text-xs font-bold transition flex items-center justify-center gap-1"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>صرف راتب</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Add Employee */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0B141F] border border-[#C5A862]/40 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#C5A862]" />
                <span>إضافة موظف جديد</span>
              </h3>

              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-300 block mb-1">اسم الموظف الكامل *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: محمد أحمد العبسي"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#121E2C] border border-gray-700 text-sm text-white focus:outline-none focus:border-[#C5A862]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-300 block mb-1">المسمى الوظيفي</label>
                    <select
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#121E2C] border border-gray-700 text-sm text-white focus:outline-none focus:border-[#C5A862]"
                    >
                      <option value="كاشير">كاشير مبيعات</option>
                      <option value="فني صيانة">فني صيانة وتصليح</option>
                      <option value="مدير معرض">مدير معرض</option>
                      <option value="محاسب">محاسب</option>
                      <option value="عامل نظافة وتنظيم">عامل تنظيم ونظافة</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 block mb-1">رقم الهاتف</label>
                    <input
                      type="text"
                      placeholder="770000000"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#121E2C] border border-gray-700 text-sm text-white focus:outline-none focus:border-[#C5A862]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">الراتب الشهري المتفق عليه ({currency}) *</label>
                  <input
                    type="number"
                    required
                    placeholder="150000"
                    value={newSalary}
                    onChange={(e) => setNewSalary(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#121E2C] border border-gray-700 text-sm text-white font-mono focus:outline-none focus:border-[#C5A862]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#C5A862] text-black font-bold text-xs hover:bg-[#d4b771] transition"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0B141F] border border-[#C5A862]/40 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {modalType === 'advance' ? (
                  <>
                    <Wallet className="w-5 h-5 text-amber-400" />
                    <span>تسجيل سلفة للموظف: {selectedEmployee.name}</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <span>صرف راتب للموظف: {selectedEmployee.name}</span>
                  </>
                )}
              </h3>

              <div className="p-3 bg-[#121E2C] rounded-xl border border-gray-800 text-xs space-y-1 text-gray-300">
                <div className="flex justify-between">
                  <span>الراتب المحدد:</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedEmployee.monthlySalary.toLocaleString()} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>إجمالي السُلف الحالية:</span>
                  <span className="font-mono text-amber-400 font-bold">{selectedEmployee.totalAdvances.toLocaleString()} {currency}</span>
                </div>
              </div>

              <form onSubmit={handleActionSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-300 block mb-1">المبلغ المطلوب ({currency}) *</label>
                  <input
                    type="number"
                    required
                    placeholder={modalType === 'salary' ? String(selectedEmployee.monthlySalary - selectedEmployee.totalAdvances) : '20000'}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#121E2C] border border-gray-700 text-sm text-white font-mono focus:outline-none focus:border-[#C5A862]"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 block mb-1">ملاحظة / بيان القيد</label>
                  <input
                    type="text"
                    placeholder={modalType === 'advance' ? 'سلفة لحالة طارئة' : 'صرف راتب شهر يوليو'}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#121E2C] border border-gray-700 text-sm text-white focus:outline-none focus:border-[#C5A862]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setModalType(null);
                      setSelectedEmployee(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-gray-800 text-gray-300 text-xs hover:bg-gray-700 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-xl text-black font-bold text-xs transition ${
                      modalType === 'advance'
                        ? 'bg-amber-400 hover:bg-amber-300'
                        : 'bg-emerald-400 hover:bg-emerald-300'
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
      <div className="bg-[#0B141F] p-5 rounded-2xl border border-gray-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#C5A862]" />
          <span>سجل حركات السلف والرواتب الأخير</span>
        </h3>

        {payrollRecords.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">لا توجد حركات سلف أو رواتب مسجلة بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right text-gray-300">
              <thead className="bg-[#121E2C] text-[#C5A862] border-b border-gray-800">
                <tr>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">اسم الموظف</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">الملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {payrollRecords.slice().reverse().map((record) => (
                  <tr key={record.id} className="hover:bg-[#121E2C]/50">
                    <td className="p-3 font-mono text-gray-400">{new Date(record.date).toLocaleDateString('ar-YE')}</td>
                    <td className="p-3 font-bold text-white">{record.employeeName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        record.type === 'advance'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                      }`}>
                        {record.type === 'advance' ? 'سلفة' : 'صرف راتب'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-white">
                      {record.amount.toLocaleString()} {currency}
                    </td>
                    <td className="p-3 text-gray-400">{record.note || '-'}</td>
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
