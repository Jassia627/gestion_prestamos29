import { useState, useEffect, useContext } from 'react';
import { db } from '../../config/firebase';
import { AuthContext } from '../../context/AuthContext';
import { collection, query, getDocs, where } from 'firebase/firestore';
import {
  AttachMoney,
  PeopleAlt,
  Warning,
  CheckCircle,
  TrendingUp,
  AccountBalance
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const Dashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalPrestamos: 0,
    totalDeudores: 0,
    prestamosPendientes: 0,
    prestamosCompletados: 0,
    montoTotal: 0,
    montoPagado: 0,
    montoPendiente: 0
  });
  const [alertas, setAlertas] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);

        // Obtener deudores
        const debtorsQuery = query(
          collection(db, 'debtors'),
          where('adminId', '==', currentUser.uid)
        );
        const debtorsSnapshot = await getDocs(debtorsQuery);
        const debtorsData = debtorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Obtener préstamos
        const loansQuery = query(
          collection(db, 'loans'),
          where('adminId', '==', currentUser.uid)
        );
        const loansSnapshot = await getDocs(loansQuery);
        const loansData = loansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Obtener pagos
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('adminId', '==', currentUser.uid)
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const paymentsData = paymentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Calcular estadísticas
        const totalPrestamos = loansData.length;
        const totalDeudores = debtorsData.length;
        const prestamosPendientes = loansData.filter(loan => loan.status === 'active').length;
        const prestamosCompletados = loansData.filter(loan => loan.status === 'completed').length;
        const montoTotal = loansData.reduce((sum, loan) => sum + (loan.totalPayment || 0), 0);
        const montoPagado = loansData.reduce((sum, loan) => sum + (loan.paidAmount || 0), 0);
        const montoPendiente = montoTotal - montoPagado;

        setStats({
          totalPrestamos,
          totalDeudores,
          prestamosPendientes,
          prestamosCompletados,
          montoTotal,
          montoPagado,
          montoPendiente
        });

        // Generar alertas de préstamos próximos a vencer
        const alertasList = [];
        const today = new Date();
        loansData.forEach(loan => {
          if (loan.status === 'active' && loan.nextPaymentDate) {
            const nextPayment = new Date(loan.nextPaymentDate);
            const diffTime = nextPayment.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 3 && diffDays > 0) {
              alertasList.push({
                type: 'warning',
                message: `Préstamo próximo a vencer en ${diffDays} días`,
                loan
              });
            } else if (diffDays <= 0) {
              alertasList.push({
                type: 'danger',
                message: 'Préstamo vencido',
                loan
              });
            }
          }
        });
        setAlertas(alertasList);

        // Preparar datos para el gráfico
        const monthlyData = {};
        loansData.forEach(loan => {
          const date = new Date(loan.createdAt);
          const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
          
          if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = {
              name: monthYear,
              prestamos: 0,
              montoTotal: 0,
              pagos: 0
            };
          }
          
          monthlyData[monthYear].prestamos += 1;
          monthlyData[monthYear].montoTotal += loan.totalPayment || 0;
        });

        // Agregar datos de pagos al gráfico
        paymentsData.forEach(payment => {
          const date = new Date(payment.paymentDate);
          const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
          
          if (monthlyData[monthYear]) {
            monthlyData[monthYear].pagos += payment.amount || 0;
          }
        });

        setGraphData(Object.values(monthlyData));

      } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>
      
      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AttachMoney className="text-yellow-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Monto Total</p>
              <p className="text-2xl font-bold">{formatMoney(stats.montoTotal)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AccountBalance className="text-green-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Cobrado</p>
              <p className="text-2xl font-bold">{formatMoney(stats.montoPagado)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Warning className="text-red-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Por Cobrar</p>
              <p className="text-2xl font-bold">{formatMoney(stats.montoPendiente)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <PeopleAlt className="text-blue-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Total Deudores</p>
              <p className="text-2xl font-bold">{stats.totalDeudores}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico y Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Tendencia de Préstamos y Pagos</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={graphData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => formatMoney(value)}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="montoTotal" 
                  name="Préstamos" 
                  stroke="#FFD100" 
                  activeDot={{ r: 8 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="pagos" 
                  name="Pagos" 
                  stroke="#10B981" 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Warning className="mr-2 text-yellow-600" />
            Alertas y Vencimientos
          </h2>
          <div className="space-y-4">
            {alertas.length === 0 ? (
              <p className="text-gray-500">No hay alertas pendientes</p>
            ) : (
              alertas.map((alerta, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg ${
                    alerta.type === 'danger' 
                      ? 'bg-red-100 border-l-4 border-red-500' 
                      : 'bg-yellow-100 border-l-4 border-yellow-500'
                  }`}
                >
                  <p className="font-medium">
                    {alerta.message}
                  </p>
                  <p className="text-sm mt-1">
                    Deudor: {alerta.loan.debtorName}
                  </p>
                  <p className="text-sm">
                    Monto pendiente: {formatMoney(alerta.loan.remainingAmount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Estadísticas Adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="text-purple-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Total Préstamos</p>
              <p className="text-2xl font-bold">{stats.totalPrestamos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CheckCircle className="text-green-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Préstamos Activos</p>
              <p className="text-2xl font-bold">{stats.prestamosPendientes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Warning className="text-yellow-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Alertas Activas</p>
              <p className="text-2xl font-bold">{alertas.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CheckCircle className="text-blue-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Préstamos Completados</p>
              <p className="text-2xl font-bold">{stats.prestamosCompletados}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;