import { useState, useEffect, useContext, useMemo, useCallback, memo } from 'react';
import { db } from '../../config/firebase';
import { AuthContext } from '../../context/AuthContext';
import { 
  collection, 
  addDoc, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  where 
} from 'firebase/firestore';
import { 
  Plus, 
  Edit, 
  Trash2, 
  DollarSign,
  Calendar,
  CheckCircle2,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatMoney } from '../../utils/formatters';

const Loans = () => {
  const { currentUser } = useContext(AuthContext);
  const [loans, setLoans] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [formData, setFormData] = useState({
    debtorId: '',
    amount: '',
    interestRate: '',
    term: '',
    paymentFrequency: 'monthly', // daily, weekly, monthly
    isIndefinite: false,
    startDate: '',
    description: ''
  });

  // Memoizar queries
  const debtorsQuery = useMemo(() => {
    if (!currentUser) return null;
    return query(
      collection(db, 'debtors'),
      where('adminId', '==', currentUser.uid)
    );
  }, [currentUser]);

  const loansQuery = useMemo(() => {
    if (!currentUser) return null;
    return query(
      collection(db, 'loans'),
      where('adminId', '==', currentUser.uid)
    );
  }, [currentUser]);

  const calculateLoanDetails = useCallback((amount, interestRate, term, paymentFrequency = 'monthly') => {
    const principal = parseFloat(amount);
    // La tasa de interés viene directamente en el porcentaje según la frecuencia
    const periodInterestRate = parseFloat(interestRate) / 100;
    const periods = parseInt(term);
    
    // Calcular interés según frecuencia usando la tasa directamente
    const interestPerPeriod = principal * periodInterestRate;
    const totalInterest = interestPerPeriod * periods;
    const totalPayment = principal + totalInterest;
    const periodPayment = totalPayment / periods;

    return {
      periodPayment: periodPayment.toFixed(2),
      totalPayment: totalPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      interestPerPeriod: interestPerPeriod.toFixed(2),
      periods: periods,
      // Mantener compatibilidad con código existente
      monthlyPayment: paymentFrequency === 'monthly' ? periodPayment.toFixed(2) : null,
      monthlyInterest: paymentFrequency === 'monthly' ? interestPerPeriod.toFixed(2) : null
    };
  }, []);

  const calculateIndefiniteLoanDetails = useCallback((amount, interestRate, startDate, paymentFrequency = 'monthly') => {
    const principal = parseFloat(amount);
    // La tasa de interés viene directamente en el porcentaje según la frecuencia
    const periodInterestRate = parseFloat(interestRate) / 100;
    
    const start = new Date(startDate);
    const today = new Date();
    
    let interestPerPeriod, periodsElapsed, totalInterest;
    
    if (paymentFrequency === 'daily') {
      const daysDiff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.max(0, daysDiff);
      interestPerPeriod = principal * periodInterestRate;
      periodsElapsed = daysElapsed;
      totalInterest = interestPerPeriod * daysElapsed;
    } else if (paymentFrequency === 'weekly') {
      const daysDiff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
      const weeksElapsed = Math.max(0, Math.floor(daysDiff / 7));
      interestPerPeriod = principal * periodInterestRate;
      periodsElapsed = weeksElapsed;
      totalInterest = interestPerPeriod * weeksElapsed;
    } else {
      // Mensual
      let monthsDiff = (today.getFullYear() - start.getFullYear()) * 12 + 
                      (today.getMonth() - start.getMonth());
      if (today.getDate() < start.getDate()) {
        monthsDiff -= 1;
      }
      monthsDiff = Math.max(0, monthsDiff);
      interestPerPeriod = principal * periodInterestRate;
      periodsElapsed = monthsDiff;
      totalInterest = interestPerPeriod * monthsDiff;
    }
    
    const totalPayment = principal + totalInterest;

    return {
        interestPerPeriod: interestPerPeriod.toFixed(2),
        totalInterest: totalInterest.toFixed(2),
        totalPayment: totalPayment.toFixed(2),
        periodsElapsed: periodsElapsed,
        // Mantener compatibilidad
        monthlyInterest: paymentFrequency === 'monthly' ? interestPerPeriod.toFixed(2) : null,
        monthsElapsed: paymentFrequency === 'monthly' ? periodsElapsed : null
    };
  }, []);

  const finalizeLoan = useCallback(async (loanId) => {
    try {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return;

      const finalCalculation = calculateIndefiniteLoanDetails(
        loan.amount,
        loan.interestRate,
        loan.startDate,
        loan.paymentFrequency || 'monthly'
      );

      await updateDoc(doc(db, 'loans', loanId), {
        status: 'completed',
        endDate: new Date().toISOString(),
        finalTotalPayment: parseFloat(finalCalculation.totalPayment),
        finalTotalInterest: parseFloat(finalCalculation.totalInterest),
        monthsElapsed: finalCalculation.monthsElapsed
      });

      toast.success('Préstamo finalizado exitosamente');
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al finalizar el préstamo');
    }
  }, [loans, calculateIndefiniteLoanDetails]);

  const handleDelete = useCallback(async (id) => {
    if (!currentUser) return;
    
    if (window.confirm('¿Está seguro de eliminar este préstamo?')) {
      try {
        await deleteDoc(doc(db, 'loans', id));
        toast.success('Préstamo eliminado exitosamente');
        fetchData();
      } catch (error) {
        toast.error('Error al eliminar el préstamo');
      }
    }
  }, []);

  const handleEdit = useCallback((loan) => {
    setSelectedLoan(loan);
    setFormData({
      debtorId: loan.debtorId,
      amount: loan.amount.toString(),
      interestRate: loan.interestRate.toString(),
      term: loan.term?.toString() || '',
      paymentFrequency: loan.paymentFrequency || 'monthly',
      isIndefinite: loan.isIndefinite,
      startDate: loan.startDate?.split('T')[0] || '',
      description: loan.description || ''
    });
    setIsModalOpen(true);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setLoading(true);
      let loanDetails;

      if (formData.isIndefinite) {
        loanDetails = calculateIndefiniteLoanDetails(
          formData.amount,
          formData.interestRate,
          formData.startDate,
          formData.paymentFrequency
        );
      } else {
        loanDetails = calculateLoanDetails(
          formData.amount,
          formData.interestRate,
          formData.term,
          formData.paymentFrequency
        );
      }

      let endDate = null;
      if (!formData.isIndefinite && formData.term) {
        const startDateObj = new Date(formData.startDate);
        const endDateObj = new Date(startDateObj);
        endDateObj.setMonth(startDateObj.getMonth() + parseInt(formData.term));
        endDate = endDateObj.toISOString();
      }

      // Calcular fecha de fin según frecuencia
      let calculatedEndDate = endDate;
      if (!formData.isIndefinite && formData.term && formData.startDate) {
        const startDateObj = new Date(formData.startDate);
        const endDateObj = new Date(startDateObj);
        const term = parseInt(formData.term);
        
        if (formData.paymentFrequency === 'daily') {
          // Si el plazo está en días
          endDateObj.setDate(startDateObj.getDate() + term);
        } else if (formData.paymentFrequency === 'weekly') {
          // Si el plazo está en semanas
          endDateObj.setDate(startDateObj.getDate() + (term * 7));
        } else {
          // Mensual - el plazo está en meses
          endDateObj.setMonth(startDateObj.getMonth() + term);
        }
        calculatedEndDate = endDateObj.toISOString();
      }

      const loanData = {
        ...formData,
        adminId: currentUser.uid,
        amount: parseFloat(formData.amount),
        interestRate: parseFloat(formData.interestRate),
        term: formData.isIndefinite ? null : parseInt(formData.term),
        paymentFrequency: formData.paymentFrequency,
        interestPerPeriod: parseFloat(loanDetails.interestPerPeriod),
        periodPayment: formData.isIndefinite ? null : parseFloat(loanDetails.periodPayment),
        totalInterest: parseFloat(loanDetails.totalInterest),
        totalPayment: parseFloat(loanDetails.totalPayment),
        // Mantener compatibilidad con código existente
        monthlyInterest: loanDetails.monthlyInterest ? parseFloat(loanDetails.monthlyInterest) : parseFloat(loanDetails.interestPerPeriod),
        monthlyPayment: loanDetails.monthlyPayment ? parseFloat(loanDetails.monthlyPayment) : (formData.paymentFrequency === 'monthly' ? parseFloat(loanDetails.periodPayment) : null),
        status: 'active',
        remainingAmount: parseFloat(loanDetails.totalPayment),
        paidAmount: 0,
        paidInterest: 0,
        paidCapital: 0,
        createdAt: new Date().toISOString(),
        startDate: formData.startDate,
        endDate: calculatedEndDate
      };

      if (selectedLoan) {
        await updateDoc(doc(db, 'loans', selectedLoan.id), loanData);
        toast.success('Préstamo actualizado exitosamente');
      } else {
        await addDoc(collection(db, 'loans'), loanData);
        toast.success('Préstamo creado exitosamente');
      }

      setIsModalOpen(false);
      setSelectedLoan(null);
      setFormData({
        debtorId: '',
        amount: '',
        interestRate: '',
        term: '',
        paymentFrequency: 'monthly',
        isIndefinite: false,
        startDate: '',
        description: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar el préstamo');
    } finally {
      setLoading(false);
    }
  }, [currentUser, formData, selectedLoan, calculateLoanDetails, calculateIndefiniteLoanDetails]);

  const fetchData = useCallback(async () => {
    if (!currentUser || !debtorsQuery || !loansQuery) return;

    try {
      setLoading(true);
      const debtorsSnapshot = await getDocs(debtorsQuery);
      const debtorsData = {};
      debtorsSnapshot.docs.forEach(doc => {
        debtorsData[doc.id] = { id: doc.id, ...doc.data() };
      });
      setDebtors(Object.values(debtorsData));
      const loansSnapshot = await getDocs(loansQuery);
      const loansData = loansSnapshot.docs.map(doc => {
        const loan = { id: doc.id, ...doc.data() };
        const debtor = debtorsData[loan.debtorId];
        return {
          ...loan,
          debtorName: debtor ? debtor.name : 'Deudor no encontrado'
        };
      });
      setLoans(loansData);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [currentUser, debtorsQuery, loansQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const LoanCard = memo(({ loan, onFinalize, onEdit, onDelete }) => (
    <div className="bg-white rounded-xl shadow-lg p-5 mb-4 border border-gray-100 hover:shadow-xl transition-shadow">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{loan.debtorName}</h3>
          <p className="text-sm text-gray-500 flex items-center">
            <Calendar className="inline mr-1 w-4 h-4" />
            {new Date(loan.startDate).toLocaleDateString()}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold
          ${loan.status === 'active' ? 'bg-green-100 text-green-700' : 
          loan.status === 'completed' ? 'bg-blue-100 text-blue-700' : 
          'bg-red-100 text-red-700'}`}>
          {loan.status === 'active' ? 'Activo' : 
           loan.status === 'completed' ? 'Completado' : 'Vencido'}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Monto</p>
          <p className="font-semibold text-gray-800">{formatMoney(loan.amount)}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">Total a pagar</p>
          <p className="font-semibold text-yellow-600">{formatMoney(loan.totalPayment)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div className="space-x-2">
          {loan.isIndefinite && loan.status === 'active' && (
            <button
              onClick={() => onFinalize(loan.id)}
              className="text-green-600 hover:text-green-800 tooltip"
              data-tip="Finalizar préstamo"
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => onEdit(loan)}
            className="text-blue-600 hover:text-blue-800 tooltip"
            data-tip="Editar préstamo"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(loan.id)}
            className="text-red-600 hover:text-red-800 tooltip"
            data-tip="Eliminar préstamo"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">
            {loan.isIndefinite ? (
              <span>
                Interés {loan.paymentFrequency === 'daily' ? 'diario' : loan.paymentFrequency === 'weekly' ? 'semanal' : 'mensual'}: {formatMoney(loan.interestPerPeriod || loan.monthlyInterest)}
              </span>
            ) : (
              <span>
                Cuota {loan.paymentFrequency === 'daily' ? 'diaria' : loan.paymentFrequency === 'weekly' ? 'semanal' : 'mensual'}: {formatMoney(loan.periodPayment || loan.monthlyPayment)}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  ));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <DollarSign className="inline mr-2 text-yellow-600 w-8 h-8" />
          Gestión de Préstamos
        </h1>
        <button
          onClick={() => {
            setSelectedLoan(null);
            setFormData({
              debtorId: '',
              amount: '',
              interestRate: '',
              term: '',
              paymentFrequency: 'monthly',
              isIndefinite: false,
              startDate: '',
              description: ''
            });
            setIsModalOpen(true);
          }}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center shadow-md"
        >
          <Plus className="mr-2 w-5 h-5" /> Nuevo Préstamo
        </button>
      </div>

      {/* Vista móvil */}
      <div className="md:hidden space-y-4">
        {loans.map((loan) => (
          <LoanCard 
            key={loan.id} 
            loan={loan}
            onFinalize={finalizeLoan}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Vista desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-yellow-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-yellow-700 uppercase">Deudor</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-yellow-700 uppercase">Monto</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-yellow-700 uppercase">Interés</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-yellow-700 uppercase">Plazo</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-yellow-700 uppercase">Cuota</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-yellow-700 uppercase">Total</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-yellow-700 uppercase">Estado</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-yellow-700 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="font-medium text-gray-900">{loan.debtorName}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(loan.startDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                    {formatMoney(loan.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                      {loan.interestRate}% {loan.paymentFrequency === 'daily' ? 'diario' : loan.paymentFrequency === 'weekly' ? 'semanal' : 'mensual'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {loan.isIndefinite ? (
                      <span className="italic">Indefinido</span>
                    ) : (
                      `${loan.term} ${loan.paymentFrequency === 'daily' ? 'días' : loan.paymentFrequency === 'weekly' ? 'semanas' : 'meses'}`
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                    {loan.isIndefinite 
                      ? formatMoney(loan.interestPerPeriod || loan.monthlyInterest)
                      : formatMoney(loan.periodPayment || loan.monthlyPayment)}
                    <span className="text-xs text-gray-500 ml-1">
                      /{loan.paymentFrequency === 'daily' ? 'día' : loan.paymentFrequency === 'weekly' ? 'sem' : 'mes'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-semibold text-yellow-600">
                    {formatMoney(loan.totalPayment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold
                      ${loan.status === 'active' ? 'bg-green-100 text-green-700' : 
                      loan.status === 'completed' ? 'bg-blue-100 text-blue-700' : 
                      'bg-red-100 text-red-700'}`}>
                      {loan.status === 'active' ? 'Activo' : 
                       loan.status === 'completed' ? 'Completado' : 'Vencido'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
                    {loan.isIndefinite && loan.status === 'active' && (
                      <button
                        onClick={() => finalizeLoan(loan.id)}
                        className="text-green-600 hover:text-green-800 tooltip"
                        data-tip="Finalizar préstamo"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(loan)}
                      className="text-blue-600 hover:text-blue-800 tooltip"
                      data-tip="Editar préstamo"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(loan.id)}
                      className="text-red-600 hover:text-red-800 tooltip"
                      data-tip="Eliminar préstamo"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
                           ))}
                           </tbody>
                         </table>
                       </div>
                     </div>
               
                   {/* Modal de Préstamo */}
                     {isModalOpen && (
                       <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
                         <div className="bg-white rounded-2xl p-4 sm:p-8 max-w-2xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
                           <div className="flex justify-between items-center mb-4 sm:mb-6 sticky top-0 bg-white pt-2 pb-4 border-b">
                             <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                               {selectedLoan ? 'Editar Préstamo' : 'Nuevo Préstamo'}
                             </h2>
                             <button
                               onClick={() => setIsModalOpen(false)}
                               className="text-gray-400 hover:text-gray-600"
                             >
                               <X className="w-5 h-5" />
                             </button>
                           </div>
                           
                           <form onSubmit={handleSubmit} className="space-y-6">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               {/* Campo: Deudor */}
                               <div className="col-span-2">
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Deudor</label>
                                 <select
                                   value={formData.debtorId}
                                   onChange={(e) => setFormData({ ...formData, debtorId: e.target.value })}
                                   className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
                                   required
                                 >
                                   <option value="">Seleccione un deudor</option>
                                   {debtors.map((debtor) => (
                                     <option key={debtor.id} value={debtor.id}>{debtor.name}</option>
                                   ))}
                                 </select>
                               </div>
               
                               {/* Campo: Monto del Préstamo */}
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">
                                   Monto del Préstamo
                                 </label>
                                 <div className="relative">
                                   <span className="absolute left-3 top-3 text-gray-500">$</span>
                                   <input
                                     type="number"
                                     value={formData.amount}
                                     onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                     className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
                                     placeholder="Ej: 1,000,000"
                                     required
                                   />
                                 </div>
                               </div>
               
                               {/* Campo: Frecuencia de Pago */}
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">
                                   Frecuencia de Pago
                                 </label>
                                 <select
                                   value={formData.paymentFrequency}
                                   onChange={(e) => setFormData({ ...formData, paymentFrequency: e.target.value })}
                                   className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
                                   required
                                 >
                                   <option value="daily">Diaria</option>
                                   <option value="weekly">Semanal</option>
                                   <option value="monthly">Mensual</option>
                                 </select>
                               </div>

                               {/* Campo: Tasa de Interés según Frecuencia */}
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">
                                   Tasa de Interés {formData.paymentFrequency === 'daily' ? 'Diaria' : formData.paymentFrequency === 'weekly' ? 'Semanal' : 'Mensual'} (%)
                                 </label>
                                 <div className="relative">
                                   <span className="absolute right-3 top-3 text-gray-500">%</span>
                                   <input
                                     type="number"
                                     value={formData.interestRate}
                                     onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                                     className="w-full pr-8 pl-4 py-3 rounded-lg border border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
                                     placeholder={formData.paymentFrequency === 'daily' ? 'Ej: 0.5' : formData.paymentFrequency === 'weekly' ? 'Ej: 3' : 'Ej: 10'}
                                     required
                                     step="0.01"
                                   />
                                 </div>
                                 <p className="mt-1 text-xs text-gray-500">
                                   {formData.paymentFrequency === 'daily' 
                                     ? 'Ejemplo: 0.5% diario = 15% mensual aproximadamente'
                                     : formData.paymentFrequency === 'weekly'
                                     ? 'Ejemplo: 3% semanal = 12% mensual aproximadamente'
                                     : 'Tasa de interés mensual'}
                                 </p>
                               </div>
               
                               {/* Campo: Préstamo Indefinido */}
                               <div className="col-span-2">
                                 <label className="flex items-center space-x-2">
                                   <input
                                     type="checkbox"
                                     checked={formData.isIndefinite}
                                     onChange={(e) => setFormData({ ...formData, isIndefinite: e.target.checked })}
                                     className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                                   />
                                   <span className="text-sm font-medium text-gray-700">Préstamo Indefinido</span>
                                 </label>
                               </div>
               
                               {/* Campo: Plazo (si no es indefinido) */}
                               {!formData.isIndefinite && (
                                 <div>
                                   <label className="block text-sm font-medium text-gray-700 mb-2">
                                     Plazo ({formData.paymentFrequency === 'daily' ? 'días' : formData.paymentFrequency === 'weekly' ? 'semanas' : 'meses'})
                                   </label>
                                   <input
                                     type="number"
                                     value={formData.term}
                                     onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                                     className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
                                     required={!formData.isIndefinite}
                                     placeholder={formData.paymentFrequency === 'daily' ? 'Ej: 30' : formData.paymentFrequency === 'weekly' ? 'Ej: 4' : 'Ej: 12'}
                                   />
                                 </div>
                               )}
               
                               {/* Campo: Fecha de Inicio */}
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">
                                   Fecha de Inicio
                                 </label>
                                 <input
                                   type="date"
                                   value={formData.startDate}
                                   onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                   className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
                                   required
                                 />
                               </div>
               
                               {/* Campo: Descripción */}
                               <div className="col-span-2">
                                 <label className="block text-sm font-medium text-gray-700 mb-2">
                                   Descripción
                                 </label>
                                 <textarea
                                   value={formData.description}
                                   onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                   className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
                                   rows="3"
                                   placeholder="Ej: Préstamo para negocio de alimentos"
                                 />
                               </div>
                             </div>
               
                             {/* Resumen del Préstamo */}
                             {formData.amount && formData.interestRate && (formData.term || formData.isIndefinite) && (() => {
                               const frequencyLabels = {
                                 daily: 'Diaria',
                                 weekly: 'Semanal',
                                 monthly: 'Mensual'
                               };
                               const frequencyLabel = frequencyLabels[formData.paymentFrequency] || 'Mensual';
                               
                               let loanDetails;
                               if (formData.isIndefinite) {
                                 loanDetails = calculateIndefiniteLoanDetails(
                                   formData.amount,
                                   formData.interestRate,
                                   formData.startDate,
                                   formData.paymentFrequency
                                 );
                               } else {
                                 loanDetails = calculateLoanDetails(
                                   formData.amount,
                                   formData.interestRate,
                                   formData.term,
                                   formData.paymentFrequency
                                 );
                               }
                               
                               return (
                                 <div className="bg-gray-50 p-4 rounded-lg">
                                   <h3 className="text-sm font-semibold mb-3">Resumen del Préstamo</h3>
                                   <div className="space-y-2 text-sm">
                                     <div className="flex justify-between">
                                       <span className="text-gray-600">Capital:</span>
                                       <span className="font-medium">
                                         {formatMoney(parseFloat(formData.amount))}
                                       </span>
                                     </div>
                                     <div className="flex justify-between">
                                       <span className="text-gray-600">Interés por {frequencyLabel.toLowerCase()}:</span>
                                       <span className="font-medium text-blue-600">
                                         {formatMoney(parseFloat(loanDetails.interestPerPeriod))}
                                       </span>
                                     </div>
                                     {!formData.isIndefinite && (
                                       <>
                                         <div className="flex justify-between">
                                           <span className="text-gray-600">Total Intereses:</span>
                                           <span className="font-medium text-blue-600">
                                             {formatMoney(parseFloat(loanDetails.totalInterest))}
                                           </span>
                                         </div>
                                         <div className="flex justify-between">
                                           <span className="text-gray-600">Total a Pagar:</span>
                                           <span className="font-medium text-green-600">
                                             {formatMoney(parseFloat(loanDetails.totalPayment))}
                                           </span>
                                         </div>
                                         <div className="flex justify-between">
                                           <span className="text-gray-600">Cuota {frequencyLabel}:</span>
                                           <span className="font-medium text-yellow-600">
                                             {formatMoney(parseFloat(loanDetails.periodPayment))}
                                           </span>
                                         </div>
                                       </>
                                     )}
                                     {formData.isIndefinite && (
                                       <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                                         Este es un préstamo indefinido. Se calculará un interés {frequencyLabel.toLowerCase()} fijo de {formatMoney(parseFloat(loanDetails.interestPerPeriod))} hasta que se finalice el préstamo.
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               );
                             })()}
               
                             {/* Botones del Modal */}
                             <div className="flex justify-end space-x-4 mt-6">
                               <button
                                 type="button"
                                 onClick={() => setIsModalOpen(false)}
                                 className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                               >
                                 Cancelar
                               </button>
                               <button
                                 type="submit"
                                 disabled={loading}
                                 className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                               >
                                 {loading ? (
                                   <div className="flex items-center">
                                     <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                     Procesando...
                                   </div>
                                 ) : selectedLoan ? 'Actualizar Préstamo' : 'Crear Préstamo'}
                               </button>
                             </div>
                           </form>
                         </div>
                       </div>
                     )}
                   </div>
                 );
               };
               
               export default Loans;