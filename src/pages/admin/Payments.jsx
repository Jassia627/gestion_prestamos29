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
  where,
  orderBy 
} from 'firebase/firestore';
import { Add, Receipt, AttachMoney } from '@mui/icons-material';
import toast from 'react-hot-toast';

const Payments = () => {
  const { currentUser } = useContext(AuthContext);
  const [payments, setPayments] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    loanId: '',
    amount: '',
    paymentDate: '',
    paymentMethod: 'cash',
    reference: ''
  });

  // Función para formatear números
  const formatNumber = (number) => {
    if (!number) return '0.00';
    return number.toLocaleString('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Cargar todos los préstamos primero
      const loansQuery = query(
        collection(db, 'loans'),
        where('adminId', '==', currentUser.uid)
      );
      const loansSnapshot = await getDocs(loansQuery);
      const loansData = {};
      loansSnapshot.docs.forEach(doc => {
        loansData[doc.id] = {
          id: doc.id,
          ...doc.data(),
          remainingAmount: doc.data().remainingAmount || doc.data().totalPayment
        };
      });
      setLoans(Object.values(loansData));

      // Cargar pagos
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('adminId', '==', currentUser.uid)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnapshot.docs.map(doc => {
        const payment = { id: doc.id, ...doc.data() };
        const loan = loansData[payment.loanId];
        return {
          ...payment,
          debtorName: loan?.debtorName || 'Préstamo no encontrado',
          totalLoanAmount: loan?.totalPayment || 0,
          remainingAfterPayment: payment.remainingAfterPayment || 0
        };
      });

      // Ordenar pagos por fecha, más recientes primero
      const sortedPayments = paymentsData.sort((a, b) => 
        new Date(b.paymentDate) - new Date(a.paymentDate)
      );

      setPayments(sortedPayments);

    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setLoading(true);
      const loan = loans.find(l => l.id === formData.loanId);
      
      if (!loan) {
        toast.error('Préstamo no encontrado');
        return;
      }

      const paymentAmount = parseFloat(formData.amount);
      const currentRemainingAmount = loan.remainingAmount || loan.totalPayment;
      
      if (paymentAmount > currentRemainingAmount) {
        toast.error('El monto del pago excede la deuda pendiente');
        return;
      }

      // Calcular nuevo saldo
      const newRemainingAmount = currentRemainingAmount - paymentAmount;
      const newPaidAmount = (loan.paidAmount || 0) + paymentAmount;

      // Crear el pago
      const paymentData = {
        ...formData,
        adminId: currentUser.uid,
        debtorId: loan.debtorId,
        amount: paymentAmount,
        totalLoanAmount: loan.totalPayment,
        remainingAfterPayment: newRemainingAmount,
        debtorName: loan?.debtorName || 'Sin nombre',
        createdAt: new Date().toISOString()
      };

      // Registrar el pago
      const paymentRef = await addDoc(collection(db, 'payments'), paymentData);

      // Actualizar el préstamo
      const newStatus = newRemainingAmount <= 0 ? 'completed' : 'active';
      await updateDoc(doc(db, 'loans', loan.id), {
        remainingAmount: newRemainingAmount,
        paidAmount: newPaidAmount,
        status: newStatus,
        lastPaymentDate: formData.paymentDate,
        lastPaymentId: paymentRef.id
      });

      toast.success('Pago registrado exitosamente');
      setIsModalOpen(false);
      setFormData({
        loanId: '',
        amount: '',
        paymentDate: '',
        paymentMethod: 'cash',
        reference: ''
      });
      
      // Recargar los datos inmediatamente
      await fetchData();

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-bold">Gestión de Pagos</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center"
          disabled={loans.length === 0}
        >
          <Add className="mr-2" /> Registrar Pago
        </button>
      </div>

      {/* Lista de Pagos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Deudor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Monto Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Monto Pagado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Saldo Restante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha de Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Método
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Referencia
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.debtorName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ${formatNumber(payment.totalLoanAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-green-600">
                    ${formatNumber(payment.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-red-600">
                    ${formatNumber(payment.remainingAfterPayment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap capitalize">
                    {payment.paymentMethod}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Registro de Pago */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Registrar Nuevo Pago</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Préstamo
                </label>
                <select
                  value={formData.loanId}
                  onChange={(e) => {
                    const selectedLoan = loans.find(l => l.id === e.target.value);
                    setFormData({
                      ...formData,
                      loanId: e.target.value
                    });
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                >
                  <option value="">Seleccione un préstamo</option>
                  {loans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.debtorName} - Pendiente: ${formatNumber(loan.remainingAmount)}
                    </option>
                  ))}
                </select>
              </div>

              {formData.loanId && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h3 className="font-semibold mb-2">Resumen del Préstamo</h3>
                  {loans.find(l => l.id === formData.loanId) && (
                    <>
                      <p className="text-sm text-gray-600">
                        Monto total: ${formatNumber(loans.find(l => l.id === formData.loanId).totalPayment)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Saldo pendiente: ${formatNumber(loans.find(l => l.id === formData.loanId).remainingAmount)}
                      </p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Monto del Pago
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
                    min="0"
                    max={loans.find(l => l.id === formData.loanId)?.remainingAmount}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha de Pago
                </label>
                <input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Método de Pago
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Referencia
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  placeholder="Número de transferencia, recibo, etc."
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  {loading ? 'Procesando...' : 'Registrar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;