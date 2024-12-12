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
import { Add, Edit, Delete, AttachMoney, CalendarToday } from '@mui/icons-material';
import toast from 'react-hot-toast';

const Loans = () => {
  const { currentUser } = useContext(AuthContext);
  const [loans, setLoans] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    debtorId: '',
    amount: '',
    interestRate: '',
    term: '',
    paymentFrequency: 'monthly',
    startDate: '',
    description: ''
  });
  const [editingId, setEditingId] = useState(null);

  // Cargar préstamos y deudores
  const fetchData = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      // Cargar deudores del usuario actual
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

      // Cargar préstamos del usuario actual
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

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

 // Calcular pagos mensuales y totales
const calculateLoanDetails = (amount, interestRate, term) => {
  const principal = parseFloat(amount); // monto del préstamo
  const monthlyInterestRate = parseFloat(interestRate) / 100; // 20% = 0.20
  const months = parseInt(term);
  
  // Interés mensual fijo sobre el capital
  const interestPerMonth = principal * monthlyInterestRate; // Ej: 1000 * 0.20 = 200
  
  // Interés total (interés mensual × número de meses)
  // Ejemplo: 200 × 3 meses = 600 de interés total
  const totalInterest = interestPerMonth * months;
  
  // Monto total a pagar (capital + interés total)
  // Ejemplo: 1000 + 600 = 1600
  const totalPayment = principal + totalInterest;
  
  // Pago mensual (monto total dividido entre los meses)
  // Ejemplo: 1600 ÷ 3 = 533.33 por mes
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
        status: 'active',
        remainingAmount: parseFloat(loanDetails.totalPayment),
        paidAmount: 0,
        createdAt: new Date().toISOString(),
        nextPaymentDate: new Date(formData.startDate).toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'loans', editingId), loanData);
        toast.success('Préstamo actualizado exitosamente');
      } else {
        await addDoc(collection(db, 'loans'), loanData);
        toast.success('Préstamo creado exitosamente');
      }

      setIsModalOpen(false);
      setFormData({
        debtorId: '',
        amount: '',
        interestRate: '',
        term: '',
        paymentFrequency: 'monthly',
        startDate: '',
        description: ''
      });
      setEditingId(null);
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
  // Agregar función para formatear números
  const formatNumber = (number) => {
    if (number === undefined || number === null) return '0';
    return number.toLocaleString();
  };
  // Modificar la parte del renderizado de la tabla
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Préstamos</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Add className="mr-2" /> Nuevo Préstamo
        </button>
      </div>

{/* Lista de Préstamos */}
<div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deudor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interés Mensual</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plazo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuota Mensual</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total a Pagar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{loan.debtorName || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${formatNumber(loan.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${formatNumber(loan.monthlyInterest)} ({loan.interestRate || 0}%)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{loan.term || 0} meses</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${formatNumber(loan.monthlyPayment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${formatNumber(loan.totalPayment)}
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
                    <button
                      onClick={() => {
                        setFormData({
                          ...loan,
                          startDate: loan.startDate?.split('T')[0] || ''
                        });
                        setEditingId(loan.id);
                        setIsModalOpen(true);
                      }}
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

      {/* Modal de Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Editar Préstamo' : 'Nuevo Préstamo'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Deudor
                </label>
                <select
                  value={formData.debtorId}
                  onChange={(e) => setFormData({ ...formData, debtorId: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
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
                  Tasa de Interés (%)
                </label>
                <input
                  type="number"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Plazo (meses)
                </label>
                <input
                  type="number"
                  value={formData.term}
                  onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Frecuencia de Pago
                </label>
                <select
                  value={formData.paymentFrequency}
                  onChange={(e) => setFormData({ ...formData, paymentFrequency: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                >
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

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

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({
                      debtorId: '',
                      amount: '',
                      interestRate: '',
                      term: '',
                      paymentFrequency: 'monthly',
                      startDate: '',
                      description: ''
                    });
                    setEditingId(null);
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
                  {loading ? 'Procesando...' : editingId ? 'Actualizar' : 'Crear'}
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