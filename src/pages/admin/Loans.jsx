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
  CheckCircle 
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
    
    // Calcular meses transcurridos desde el inicio hasta hoy
    const start = new Date(startDate);
    const today = new Date();
    
    let monthsDiff = (today.getFullYear() - start.getFullYear()) * 12 + 
                    (today.getMonth() - start.getMonth());
    
    // Verificar si el día actual es menor al día del inicio del préstamo
    if (today.getDate() < start.getDate()) {
        monthsDiff -= 1; // No contar el mes actual
    }
    
    // Evitar valores negativos si la fecha de inicio es en el futuro
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
  // Componente para la vista móvil de préstamos
  const LoanCard = ({ loan, onFinalize, onEdit, onDelete }) => (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">{loan.debtorName}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold
          ${loan.status === 'active' ? 'bg-green-100 text-green-800' : 
          loan.status === 'completed' ? 'bg-blue-100 text-blue-800' : 
          'bg-red-100 text-red-800'}`}>
          {loan.status === 'active' ? 'Activo' : 
           loan.status === 'completed' ? 'Completado' : 'Vencido'}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Monto:</span>
          <span className="font-medium">{formatMoney(loan.amount)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Interés:</span>
          <span className="font-medium">{loan.interestRate}% mensual</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Plazo:</span>
          <span className="font-medium">
            {loan.isIndefinite ? 'Indefinido' : `${loan.term} meses`}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Cuota Mensual:</span>
          <span className="font-medium">
            {loan.isIndefinite 
              ? formatMoney(loan.monthlyInterest)
              : formatMoney(loan.monthlyPayment)}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Total:</span>
          <span className="font-medium">{formatMoney(loan.totalPayment)}</span>
        </div>
      </div>

      <div className="mt-4 flex justify-end space-x-2">
        {loan.isIndefinite && loan.status === 'active' && (
          <button
            onClick={() => onFinalize(loan.id)}
            className="p-2 text-green-600 hover:text-green-900"
          >
            <CheckCircle />
          </button>
        )}
        <button
          onClick={() => onEdit(loan)}
          className="p-2 text-blue-600 hover:text-blue-900"
        >
          <Edit />
        </button>
        <button
          onClick={() => onDelete(loan.id)}
          className="p-2 text-red-600 hover:text-red-900"
        >
          <Delete />
        </button>
      </div>
    </div>
  );

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
        endDate: formData.isIndefinite ? null : new Date(formData.startDate).setMonth(
          new Date(formData.startDate).getMonth() + (formData.term ? parseInt(formData.term) : 0)
        ).toISOString()
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
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Préstamos</h1>
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
          className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center"
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
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deudor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interés</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plazo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuota Mensual</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {loan.debtorName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatMoney(loan.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {loan.interestRate}% mensual
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {loan.isIndefinite ? 'Indefinido' : `${loan.term} meses`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {loan.isIndefinite 
                      ? formatMoney(loan.monthlyInterest) 
                      : formatMoney(loan.monthlyPayment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatMoney(loan.totalPayment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${loan.status === 'active' ? 'bg-green-100 text-green-800' : 
                      loan.status === 'completed' ? 'bg-blue-100 text-blue-800' : 
                      'bg-red-100 text-red-800'}`}>
                      {loan.status === 'active' ? 'Activo' : 
                       loan.status === 'completed' ? 'Completado' : 'Vencido'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {loan.isIndefinite && loan.status === 'active' && (
                      <button
                        onClick={() => finalizeLoan(loan.id)}
                        className="text-green-600 hover:text-green-900 mr-4"
                      >
                        <CheckCircle />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(loan)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <Edit />
                    </button>
                    <button
                      onClick={() => handleDelete(loan.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Delete />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {selectedLoan ? 'Editar Préstamo' : 'Nuevo Préstamo'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Deudor</label>
                <select
                  value={formData.debtorId}
                  onChange={(e) => setFormData({ ...formData, debtorId: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                >
                  <option value="">Seleccione un deudor</option>
                  {debtors.map((debtor) => (
                    <option key={debtor.id} value={debtor.id}>{debtor.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Monto del Préstamo
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tasa de Interés Mensual (%)
                </label>
                <input
                  type="number"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                  step="0.01"
                />
              </div>

              <div>
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

              {!formData.isIndefinite && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Plazo (meses)
                  </label>
                  <input
                    type="number"
                    value={formData.term}
                    onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                    required={!formData.isIndefinite}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  rows="3"
                />
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

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
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
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  {loading ? 'Guardando...' : (selectedLoan ? 'Actualizar' : 'Crear')}
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