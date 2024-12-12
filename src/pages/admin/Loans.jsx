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
  Person,
  AccountBalance
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

  // Componente de Tarjeta para vista móvil
  const LoanCard = ({ loan, onEdit, onDelete }) => (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{loan.debtorName}</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium
          ${loan.status === 'active' ? 'bg-green-100 text-green-800' : 
          loan.status === 'completed' ? 'bg-blue-100 text-blue-800' : 
          'bg-red-100 text-red-800'}`}>
          {loan.status === 'active' ? 'Activo' : 
           loan.status === 'completed' ? 'Completado' : 'Vencido'}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Monto:</span>
          <span className="font-medium">{formatMoney(loan.amount)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Interés:</span>
          <span className="font-medium">{loan.interestRate}%</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Plazo:</span>
          <span className="font-medium">{loan.term} meses</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total a Pagar:</span>
          <span className="font-medium text-blue-600">{formatMoney(loan.totalPayment)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Saldo Pendiente:</span>
          <span className="font-medium text-red-600">{formatMoney(loan.remainingAmount)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Inicio:</span>
          <span className="font-medium">
            {new Date(loan.startDate).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-4">
        <button
          onClick={() => onEdit(loan)}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
        >
          <Edit />
        </button>
        <button
          onClick={() => onDelete(loan.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-full"
        >
          <Delete />
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Cargar deudores
      const debtorsQuery = query(
        collection(db, 'debtors'),
        where('adminId', '==', currentUser.uid)
      );
      const debtorsSnapshot = await getDocs(debtorsQuery);
      const debtorsData = debtorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDebtors(debtorsData);

      // Cargar préstamos
      const loansQuery = query(
        collection(db, 'loans'),
        where('adminId', '==', currentUser.uid)
      );
      const loansSnapshot = await getDocs(loansQuery);
      const loansData = loansSnapshot.docs.map(doc => {
        const loan = { id: doc.id, ...doc.data() };
        const debtor = debtorsData.find(d => d.id === loan.debtorId);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setLoading(true);
      const loanDetails = calculateLoanDetails(
        formData.amount,
        formData.interestRate,
        formData.term
      );

      const loanData = {
        ...formData,
        adminId: currentUser.uid,
        amount: parseFloat(formData.amount),
        interestRate: parseFloat(formData.interestRate),
        term: parseInt(formData.term),
        monthlyPayment: parseFloat(loanDetails.monthlyPayment),
        totalPayment: parseFloat(loanDetails.totalPayment),
        totalInterest: parseFloat(loanDetails.totalInterest),
        monthlyInterest: parseFloat(loanDetails.monthlyInterest),
        status: 'active',
        remainingAmount: parseFloat(loanDetails.totalPayment),
        paidAmount: 0,
        createdAt: new Date().toISOString()
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
      term: loan.term.toString(),
      startDate: loan.startDate.split('T')[0],
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
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Gestión de Préstamos</h1>
        <button
          onClick={() => {
            setSelectedLoan(null);
            setFormData({
              debtorId: '',
              amount: '',
              interestRate: '',
              term: '',
              startDate: '',
              description: ''
            });
            setIsModalOpen(true);
          }}
          className="w-full md:w-auto bg-yellow-600 text-white px-6 py-3 rounded-lg flex items-center justify-center text-base font-medium hover:bg-yellow-700 transition-colors"
        >
          <Add className="mr-2" /> Nuevo Préstamo
        </button>
      </div>

      {/* Vista móvil */}
      <div className="md:hidden space-y-4">
        {loans.map(loan => (
          <LoanCard 
            key={loan.id} 
            loan={loan} 
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
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Deudor</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Interés</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Cuota Mensual</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Pendiente</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">{loan.debtorName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">{formatMoney(loan.amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">{loan.interestRate}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-gray-900">{formatMoney(loan.monthlyPayment)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-blue-600">{formatMoney(loan.totalPayment)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-red-600">{formatMoney(loan.remainingAmount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-sm leading-5 font-medium rounded-full
                      ${loan.status === 'active' ? 'bg-green-100 text-green-800' : 
                      loan.status === 'completed' ? 'bg-blue-100 text-blue-800' : 
                      'bg-red-100 text-red-800'}`}>
                      {loan.status === 'active' ? 'Activo' : 
                       loan.status === 'completed' ? 'Completado' : 'Vencido'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">
              {selectedLoan ? 'Editar Préstamo' : 'Nuevo Préstamo'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-base font-semibold text-gray-700">
                  Deudor
                </label>
                <select
                  value={formData.debtorId}
                  onChange={(e) => setFormData({ ...formData, debtorId: e.target.value })}
                  className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
                  required
                >
                  <option value="">Seleccione un deudor</option>
                  {debtors.map((debtor) => (
                    <option key={debtor.id} value={debtor.id}>
                      {debtor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-base font-semibold text-gray-700">
                  Monto del Préstamo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-base text-gray-500">$</span>
                  </div>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="block w-full pl-7 rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-base font-semibold text-gray-700">
                  Tasa de Interés (% Mensual)
                </label>
                <input
                  type="number"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                  className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-base font-semibold text-gray-700">
                  Plazo (meses)
                </label>
                <input
                  type="number"
                  value={formData.term}
                  onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                  className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-base font-semibold text-gray-700">
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-base font-semibold text-gray-700">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
                  rows="3"
                  placeholder="Detalles adicionales del préstamo..."
                />
              </div>

              {/* Resumen del Préstamo */}
              {formData.amount && formData.interestRate && formData.term && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-base mb-3">Resumen del Préstamo</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monto del préstamo:</span>
                      <span className="font-medium">
                        {formatMoney(parseFloat(formData.amount))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Interés mensual:</span>
                      <span className="font-medium text-blue-600">
                        {formatMoney(parseFloat(formData.amount) * (parseFloat(formData.interestRate) / 100))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total intereses:</span>
                      <span className="font-medium text-blue-600">
                        {formatMoney(parseFloat(formData.amount) * (parseFloat(formData.interestRate) / 100) * parseInt(formData.term))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total a pagar:</span>
                      <span className="font-medium text-green-600">
                        {formatMoney(parseFloat(formData.amount) + (parseFloat(formData.amount) * (parseFloat(formData.interestRate) / 100) * parseInt(formData.term)))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cuota mensual:</span>
                      <span className="font-medium text-yellow-600">
                        {formatMoney((parseFloat(formData.amount) + (parseFloat(formData.amount) * (parseFloat(formData.interestRate) / 100) * parseInt(formData.term))) / parseInt(formData.term))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col space-y-3 mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
                >
                  {loading ? 'Procesando...' : (selectedLoan ? 'Actualizar Préstamo' : 'Crear Préstamo')}
                </button>
                
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
                      startDate: '',
                      description: ''
                    });
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
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