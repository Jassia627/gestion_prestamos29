import { useState, useEffect, useContext } from 'react';
import { db } from '../../config/firebase';
import { AuthContext } from '../../context/AuthContext';
import { collection, query, getDocs, where } from 'firebase/firestore';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  FileDownload,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Assessment,
  CalendarToday
} from '@mui/icons-material';

const Reports = () => {
  const { currentUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    prestamos: [],
    pagos: [],
    deudores: [],
    stats: {
      montoTotal: 0,
      montoPagado: 0,
      montoPendiente: 0,
      prestamosActivos: 0,
      prestamosCompletados: 0
    }
  });

  const COLORS = ['#FFD100', '#000000', '#FF0000', '#666666'];
  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  useEffect(() => {
    const fetchReportData = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);

        // Obtener préstamos
        const loansQuery = query(
          collection(db, 'loans'),
          where('adminId', '==', currentUser.uid)
        );
        const loansSnapshot = await getDocs(loansQuery);
        const prestamos = loansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Obtener pagos
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('adminId', '==', currentUser.uid)
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const pagos = paymentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Obtener deudores
        const debtorsQuery = query(
          collection(db, 'debtors'),
          where('adminId', '==', currentUser.uid)
        );
        const debtorsSnapshot = await getDocs(debtorsQuery);
        const deudores = debtorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Calcular estadísticas
        const montoTotal = prestamos.reduce((sum, loan) => sum + (loan.totalPayment || 0), 0);
        const montoPagado = prestamos.reduce((sum, loan) => sum + (loan.paidAmount || 0), 0);
        const montoPendiente = montoTotal - montoPagado;
        const prestamosActivos = prestamos.filter(loan => loan.status === 'active').length;
        const prestamosCompletados = prestamos.filter(loan => loan.status === 'completed').length;

        setReportData({
          prestamos,
          pagos,
          deudores,
          stats: {
            montoTotal,
            montoPagado,
            montoPendiente,
            prestamosActivos,
            prestamosCompletados
          }
        });

      } catch (error) {
        console.error('Error al cargar datos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [currentUser]);

  // Preparar datos para los gráficos
  const prepareChartData = () => {
    // Datos para el gráfico de estado de préstamos
    const statusData = [
      { name: 'Activos', value: reportData.stats.prestamosActivos },
      { name: 'Completados', value: reportData.stats.prestamosCompletados }
    ];

    // Datos para el gráfico de pagos mensuales
    const monthlyData = Array(12).fill(0).map((_, index) => ({
      month: MONTHS[index],
      pagos: 0,
      prestamos: 0
    }));

    reportData.pagos.forEach(pago => {
      const date = new Date(pago.paymentDate);
      monthlyData[date.getMonth()].pagos += pago.amount || 0;
    });

    reportData.prestamos.forEach(prestamo => {
      const date = new Date(prestamo.createdAt);
      monthlyData[date.getMonth()].prestamos += prestamo.totalPayment || 0;
    });

    return {
      statusData,
      monthlyData
    };
  };

  const generateCSV = (data, filename) => {
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => 
          JSON.stringify(row[header] || '')
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  const { statusData, monthlyData } = prepareChartData();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Reportes y Estadísticas</h1>
        <div className="space-x-2">
          <button
            onClick={() => generateCSV(reportData.prestamos, 'prestamos')}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <FileDownload className="mr-2" /> Exportar Préstamos
          </button>
          <button
            onClick={() => generateCSV(reportData.pagos, 'pagos')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <FileDownload className="mr-2" /> Exportar Pagos
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Resumen Financiero</h3>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500">Monto Total Prestado</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatMoney(reportData.stats.montoTotal)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Monto Cobrado</p>
              <p className="text-2xl font-bold text-green-600">
                {formatMoney(reportData.stats.montoPagado)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Monto Pendiente</p>
              <p className="text-2xl font-bold text-red-600">
                {formatMoney(reportData.stats.montoPendiente)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Estado de Préstamos</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Estadísticas Generales</h3>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500">Total de Préstamos</p>
              <p className="text-2xl font-bold">
                {reportData.prestamos.length}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Préstamos Activos</p>
              <p className="text-2xl font-bold text-green-600">
                {reportData.stats.prestamosActivos}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Préstamos Completados</p>
              <p className="text-2xl font-bold text-blue-600">
                {reportData.stats.prestamosCompletados}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Total de Deudores</p>
              <p className="text-2xl font-bold">
                {reportData.deudores.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Tendencias */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Tendencias Mensuales</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatMoney(value)} />
              <Legend />
              <Bar dataKey="prestamos" name="Préstamos" fill="#FFD100" />
              <Bar dataKey="pagos" name="Pagos" fill="#000000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tablas de Detalle */}
      <div className="grid grid-cols-1 gap-8">
        {/* Tabla de Últimos Préstamos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Últimos Préstamos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Deudor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Monto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.prestamos.slice(0, 5).map((prestamo) => (
                  <tr key={prestamo.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {prestamo.debtorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatMoney(prestamo.totalPayment)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(prestamo.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${prestamo.status === 'active' ? 'bg-green-100 text-green-800' : 
                        prestamo.status === 'completed' ? 'bg-blue-100 text-blue-800' : 
                        'bg-red-100 text-red-800'}`}>
                        {prestamo.status === 'active' ? 'Activo' : 
                         prestamo.status === 'completed' ? 'Completado' : 'Vencido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla de Últimos Pagos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Últimos Pagos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Deudor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Monto Pagado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
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
                {reportData.pagos.slice(0, 5).map((pago) => (
                  <tr key={pago.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pago.debtorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatMoney(pago.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(pago.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap capitalize">
                      {pago.paymentMethod}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pago.reference || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;