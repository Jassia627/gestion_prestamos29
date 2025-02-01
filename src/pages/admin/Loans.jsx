import { useState, useEffect, useContext } from 'react';
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
  Add, 
  Edit, 
  Delete, 
  AttachMoney,
  CalendarToday,
  CheckCircle,
  Close
} from '@mui/icons-material';
import toast from 'react-hot-toast';

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
    isIndefinite: false,
    startDate: '',
    description: ''
  });

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const calculateLoanDetails = (amount, interestRate, term) => {
    const principal = parseFloat(amount);
    const monthlyInterestRate = parseFloat(interestRate) / 100;
    const months = parseInt(term);
    
    const interestPerMonth = principal * monthlyInterestRate;
    const totalInterest = interestPerMonth * months;
    const totalPayment = principal + totalInterest;
    const monthlyPayment = totalPayment / months;

    return {
      monthlyPayment: monthlyPayment.toFixed(2),
      totalPayment: totalPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      monthlyInterest: interestPerMonth.toFixed(2)
    };
  };

  const calculateIndefiniteLoanDetails = (amount, interestRate, startDate) => {
    const principal = parseFloat(amount);
    const monthlyInterestRate = parseFloat(interestRate) / 100;
    
    const start = new Date(startDate);
    const today = new Date();
    
    let monthsDiff = (today.getFullYear() - start.getFullYear()) * 12 + 
                    (today.getMonth() - start.getMonth());
    
    if (today.getDate() < start.getDate()) {
        monthsDiff -= 1;
    }
    
    monthsDiff = Math.max(0, monthsDiff);
    
    const interestPerMonth = principal * monthlyInterestRate;
    const totalInterest = interestPerMonth * monthsDiff;
    const totalPayment = principal + totalInterest;

    return {
        monthlyInterest: interestPerMonth.toFixed(2),
        totalInterest: totalInterest.toFixed(2),
        totalPayment: totalPayment.toFixed(2),
        monthsElapsed: monthsDiff
    };
  };

  const finalizeLoan = async (loanId) => {
    try {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return;

      const finalCalculation = calculateIndefiniteLoanDetails(
        loan.amount,
        loan.interestRate,
        loan.startDate
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
  };

  const handleDelete = async (id) => {
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
  };

  const handleEdit = (loan) => {
    setSelectedLoan(loan);
    setFormData({
      debtorId: loan.debtorId,
      amount: loan.amount.toString(),
      interestRate: loan.interestRate.toString(),
      term: loan.term?.toString() || '',
      isIndefinite: loan.isIndefinite,
      startDate: loan.startDate?.split('T')[0] || '',
      description: loan.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setLoading(true);
      let loanDetails;

      if (formData.isIndefinite) {
        loanDetails = calculateIndefiniteLoanDetails(
          formData.amount,
          formData.interestRate,
          formData.startDate
        );
      } else {
        loanDetails = calculateLoanDetails(
          formData.amount,
          formData.interestRate,
          formData.term
        );
      }

      let endDate = null;
      if (!formData.isIndefinite && formData.term) {
        const startDateObj = new Date(formData.startDate);
        const endDateObj = new Date(startDateObj);
        endDateObj.setMonth(startDateObj.getMonth() + parseInt(formData.term));
        endDate = endDateObj.toISOString();
      }

      const loanData = {
        ...formData,
        adminId: currentUser.uid,
        amount: parseFloat(formData.amount),
        interestRate: parseFloat(formData.interestRate),
        term: formData.isIndefinite ? null : parseInt(formData.term),
        monthlyInterest: parseFloat(loanDetails.monthlyInterest),
        totalInterest: parseFloat(loanDetails.totalInterest),
        totalPayment: parseFloat(loanDetails.totalPayment),
        monthlyPayment: formData.isIndefinite ? null : parseFloat(loanDetails.monthlyPayment),
        status: 'active',
        remainingAmount: parseFloat(loanDetails.totalPayment),
        paidAmount: 0,
        createdAt: new Date().toISOString(),
        startDate: formData.startDate,
        endDate: endDate
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
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const debtorsQuery = query(
        collection(db, 'debtors'),
        where('adminId', '==', currentUser.uid)
      );
      const debtorsSnapshot = await getDocs(debtorsQuery);
      const debtorsData = {};
      debtorsSnapshot.docs.forEach(doc => {
        debtorsData[doc.id] = { id: doc.id, ...doc.data() };
      });
      setDebtors(Object.values(debtorsData));

      const loansQuery = query(
        collection(db, 'loans'),
        where('adminId', '==', currentUser.uid)
      );
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
  };

  const LoanCard = ({ loan, onFinalize, onEdit, onDelete }) => (
    <div className="bg-white rounded-xl shadow-lg p-5 mb-4 border border-gray-100 hover:shadow-xl transition-shadow">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{loan.debtorName}</h3>
          <p className="text-sm text-gray-500">
            <CalendarToday className="inline mr-1" fontSize="small" />
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
              <CheckCircle fontSize="medium" />
            </button>
          )}
          <button
            onClick={() => onEdit(loan)}
            className="text-blue-600 hover:text-blue-800 tooltip"
            data-tip="Editar préstamo"
          >
            <Edit fontSize="medium" />
          </button>
          <button
            onClick={() => onDelete(loan.id)}
            className="text-red-600 hover:text-red-800 tooltip"
            data-tip="Eliminar préstamo"
          >
            <Delete fontSize="medium" />
          </button>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">
            {loan.isIndefinite ? (
              <span>Interés mensual: {formatMoney(loan.monthlyInterest)}</span>
            ) : (
              <span>Cuota: {formatMoney(loan.monthlyPayment)}/mes</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );

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
        <h1 className="text-3xl font-bold text-gray-900">
          <AttachMoney className="inline mr-2 text-yellow-600" fontSize="large" />
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
              isIndefinite: false,
              startDate: '',
              description: ''
            });
            setIsModalOpen(true);
          }}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center shadow-md"
        >
          <Add className="mr-2" /> Nuevo Préstamo
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
                      {loan.interestRate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {loan.isIndefinite ? (
                      <span className="italic">Indefinido</span>
                    ) : (
                      `${loan.term} meses`
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                    {loan.isIndefinite 
                      ? formatMoney(loan.monthlyInterest) 
                      : formatMoney(loan.monthlyPayment)}
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
                        <CheckCircle fontSize="medium" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(loan)}
                      className="text-blue-600 hover:text-blue-800 tooltip"
                      data-tip="Editar préstamo"
                    >
                      <Edit fontSize="medium" />
                    </button>
                    <button
                      onClick={() => handleDelete(loan.id)}
                      className="text-red-600 hover:text-red-800 tooltip"
                      data-tip="Eliminar préstamo"
                    >
                      <Delete fontSize="medium" />
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
                               <Close fontSize="medium" />
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
               
                               {/* Campo: Tasa de Interés Mensual */}
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">
                                   Tasa de Interés Mensual (%)
                                 </label>
                                 <div className="relative">
                                   <span className="absolute right-3 top-3 text-gray-500">%</span>
                                   <input
                                     type="number"
                                     value={formData.interestRate}
                                     onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                                     className="w-full pr-8 pl-4 py-3 rounded-lg border border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
                                     placeholder="Ej: 5"
                                     required
                                     step="0.01"
                                   />
                                 </div>
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
                                     Plazo (meses)
                                   </label>
                                   <input
                                     type="number"
                                     value={formData.term}
                                     onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                                     className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
                                     required={!formData.isIndefinite}
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
                             {formData.amount && formData.interestRate && (formData.term || formData.isIndefinite) && (
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
                                     <span className="text-gray-600">Interés Mensual:</span>
                                     <span className="font-medium text-blue-600">
                                       {formatMoney(parseFloat(formData.amount) * (parseFloat(formData.interestRate) / 100))}
                                     </span>
                                   </div>
                                   {!formData.isIndefinite && (
                                     <>
                                       <div className="flex justify-between">
                                         <span className="text-gray-600">Total Intereses:</span>
                                         <span className="font-medium text-blue-600">
                                           {formatMoney(parseFloat(formData.amount) * (parseFloat(formData.interestRate) / 100) * parseInt(formData.term))}
                                         </span>
                                       </div>
                                       <div className="flex justify-between">
                                         <span className="text-gray-600">Total a Pagar:</span>
                                         <span className="font-medium text-green-600">
                                           {formatMoney(
                                             parseFloat(formData.amount) + 
                                             (parseFloat(formData.amount) * (parseFloat(formData.interestRate) / 100) * parseInt(formData.term))
                                           )}
                                         </span>
                                       </div>
                                       <div className="flex justify-between">
                                         <span className="text-gray-600">Cuota Mensual:</span>
                                         <span className="font-medium text-yellow-600">
                                           {formatMoney(
                                             (parseFloat(formData.amount) + 
                                             (parseFloat(formData.amount) * (parseFloat(formData.interestRate) / 100) * parseInt(formData.term)))
                                             / parseInt(formData.term)
                                           )}
                                         </span>
                                       </div>
                                     </>
                                   )}
                                   {formData.isIndefinite && (
                                     <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                                       Este es un préstamo indefinido. Se calculará un interés mensual fijo de {formatMoney(parseFloat(formData.amount) * (parseFloat(formData.interestRate) / 100))} hasta que se finalice el préstamo.
                                     </div>
                                   )}
                                 </div>
                               </div>
                             )}
               
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