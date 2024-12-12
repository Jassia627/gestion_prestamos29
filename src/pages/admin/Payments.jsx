import { useState, useEffect, useContext } from 'react';
import { db } from '../../config/firebase';
import { AuthContext } from '../../context/AuthContext';
import { 
  collection, 
  addDoc, 
  query, 
  getDocs,
  getDoc, 
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

  const formatMoney = (number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number || 0);
  };

  // Cargar préstamos y pagos
  const fetchData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Primero cargar todos los deudores
      const debtorsQuery = query(
        collection(db, 'debtors'),
        where('adminId', '==', currentUser.uid)
      );
      const debtorsSnapshot = await getDocs(debtorsQuery);
      const debtorsData = {};
      debtorsSnapshot.docs.forEach(doc => {
        debtorsData[doc.id] = { id: doc.id, ...doc.data() };
      });
      
      // Cargar préstamos activos
      const loansQuery = query(
        collection(db, 'loans'),
        where('adminId', '==', currentUser.uid),
        where('status', '==', 'active')
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

      // Cargar pagos
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('adminId', '==', currentUser.uid)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnapshot.docs.map(doc => {
        const payment = { id: doc.id, ...doc.data() };
        const loan = loansData.find(l => l.id === payment.loanId);
        return {
          ...payment,
          debtorName: payment.debtorName || loan?.debtorName || 'Préstamo no encontrado',
          totalLoanAmount: loan?.totalPayment || 0
        };
      }).sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      
      setPayments(paymentsData);

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
      
      if (paymentAmount > loan.remainingAmount) {
        toast.error('El monto del pago excede la deuda pendiente');
        return;
      }

      // Calcular nuevo saldo
      const newRemainingAmount = loan.remainingAmount - paymentAmount;
      const newPaidAmount = (loan.paidAmount || 0) + paymentAmount;

      // Crear el pago
      const paymentData = {
        ...formData,
        adminId: currentUser.uid,
        debtorId: loan.debtorId,
        debtorName: loan.debtorName, // Guardamos el nombre del deudor
        amount: paymentAmount,
        totalLoanAmount: loan.totalPayment,
        remainingAfterPayment: newRemainingAmount,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'payments'), paymentData);

      // Actualizar el préstamo
      const newStatus = newRemainingAmount <= 0 ? 'completed' : 'active';
      await updateDoc(doc(db, 'loans', loan.id), {
        remainingAmount: newRemainingAmount,
        paidAmount: newPaidAmount,
        status: newStatus,
        lastPaymentDate: formData.paymentDate
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
      fetchData();

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

  // Componente para la vista móvil de pagos
  const PaymentCard = ({ payment }) => (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">{payment.debtorName}</h3>
        <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
          {payment.paymentMethod}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Monto Total:</span>
          <span className="font-medium">{formatMoney(payment.totalLoanAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Monto Pagado:</span>
          <span className="font-medium text-green-600">{formatMoney(payment.amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Saldo Restante:</span>
          <span className="font-medium text-red-600">{formatMoney(payment.remainingAfterPayment)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Fecha:</span>
          <span className="font-medium">{new Date(payment.paymentDate).toLocaleDateString()}</span>
        </div>
        {payment.reference && (
          <div className="flex justify-between">
            <span className="text-gray-600">Referencia:</span>
            <span className="font-medium">{payment.reference}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
        <h1 className="text-2xl md:text-3xl font-bold">Gestión de Pagos</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto bg-yellow-600 text-white px-6 py-3 rounded-lg flex items-center justify-center text-lg"
          disabled={loans.length === 0}
        >
          <Add className="mr-2" /> Registrar Pago
        </button>
      </div>

      {/* Vista móvil */}
      <div className="md:hidden">
        {payments.map((payment) => (
          <PaymentCard key={payment.id} payment={payment} />
        ))}
      </div>

      {/* Vista desktop */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">Deudor</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">Monto Total</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">Monto Pagado</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">Saldo Restante</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">Fecha de Pago</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">Método</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase">Referencia</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-base">{payment.debtorName}</td>
                  <td className="px-6 py-4 text-base">{formatMoney(payment.totalLoanAmount)}</td>
                  <td className="px-6 py-4 text-base text-green-600">
                    {formatMoney(payment.amount)}
                  </td>
                  <td className="px-6 py-4 text-base text-red-600">
                    {formatMoney(payment.remainingAfterPayment)}
                  </td>
                  <td className="px-6 py-4 text-base">
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-base capitalize">
                    {payment.paymentMethod}
                  </td>
                  <td className="px-6 py-4 text-base">
                    {payment.reference || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

{/* Modal de Registro de Pago */}
{isModalOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800">
        Registrar Nuevo Pago
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-base font-semibold text-gray-700">
            Préstamo
          </label>
          <select
            value={formData.loanId}
            onChange={(e) => setFormData({ ...formData, loanId: e.target.value })}
            className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
            required
          >
            <option value="">Seleccione un préstamo</option>
            {loans.map((loan) => (
              <option key={loan.id} value={loan.id}>
                {loan.debtorName} - Pendiente: {formatMoney(loan.remainingAmount)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-base font-semibold text-gray-700">
            Monto del Pago
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
            Fecha de Pago
          </label>
          <input
            type="date"
            value={formData.paymentDate}
            onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
            className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-base font-semibold text-gray-700">
            Método de Pago
          </label>
          <select
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
            className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
            required
          >
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-base font-semibold text-gray-700">
            Referencia
          </label>
          <input
            type="text"
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            className="block w-full rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2.5 px-3"
            placeholder="Número de transferencia, recibo, etc."
          />
        </div>

        <div className="flex flex-col space-y-3 mt-6">
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            {loading ? 'Procesando...' : 'Registrar Pago'}
          </button>
          
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
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

export default Payments;