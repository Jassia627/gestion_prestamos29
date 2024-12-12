import { useState, useEffect, useContext } from 'react';
import { db } from '../../config/firebase';
import { AuthContext } from '../../context/AuthContext';
import { collection, query, getDocs, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  FileDownload,
  TrendingUp,
  AccountBalance,
  AttachMoney,
  Assessment,
  PieChart as PieChartIcon,
  MonetizationOn
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import toast from 'react-hot-toast';

const Reports = () => {
  const { currentUser } = useContext(AuthContext);
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
    },
    graphData: []
  });
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(true);

  const COLORS = ['#FFD100', '#000000', '#FF0000', '#666666'];

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

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

      // Filtrar por fecha si es necesario
      const filteredPagos = pagos.filter(pago => {
        if (!dateRange.startDate || !dateRange.endDate) return true;
        const pagoDate = new Date(pago.paymentDate);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59);
        return pagoDate >= startDate && pagoDate <= endDate;
      });

      // Calcular estadísticas
      const montoTotal = prestamos.reduce((sum, loan) => sum + (loan.totalPayment || 0), 0);
      const montoPagado = prestamos.reduce((sum, loan) => sum + (loan.paidAmount || 0), 0);
      const montoPendiente = montoTotal - montoPagado;
      const prestamosActivos = prestamos.filter(loan => loan.status === 'active').length;
      const prestamosCompletados = prestamos.filter(loan => loan.status === 'completed').length;

      // Preparar datos para gráficos
      const monthlyData = {};
      filteredPagos.forEach(pago => {
        const date = new Date(pago.paymentDate);
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
        
        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = {
            name: monthYear,
            pagos: 0,
            montoTotal: 0
          };
        }
        
        monthlyData[monthYear].pagos += pago.amount || 0;
      });

      prestamos.forEach(prestamo => {
        const date = new Date(prestamo.createdAt);
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
        
        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = {
            name: monthYear,
            pagos: 0,
            montoTotal: 0
          };
        }
        
        monthlyData[monthYear].montoTotal += prestamo.totalPayment || 0;
      });

      setReportData({
        prestamos,
        pagos: filteredPagos,
        stats: {
          montoTotal,
          montoPagado,
          montoPendiente,
          prestamosActivos,
          prestamosCompletados
        },
        graphData: Object.values(monthlyData).sort((a, b) => {
          const [monthA, yearA] = a.name.split('/');
          const [monthB, yearB] = b.name.split('/');
          return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
        })
      });

    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [currentUser, dateRange]);

  const generateExcel = () => {
    try {
      // Preparar datos para el reporte
      const reportRows = reportData.pagos
        .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
        .map(pago => ({
          'Nombre del Deudor': pago.debtorName || 'N/A',
          'Fecha de Pago': new Date(pago.paymentDate).toLocaleDateString('es-CO'),
          'Monto Préstamo': formatMoney(pago.totalLoanAmount),
          'Valor Pagado': formatMoney(pago.amount),
          'Saldo Restante': formatMoney(pago.remainingAfterPayment),
          'Método de Pago': pago.paymentMethod === 'cash' ? 'Efectivo' : 
                          pago.paymentMethod === 'transfer' ? 'Transferencia' : 'Tarjeta',
          'Referencia': pago.reference || '-'
        }));

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      
      // Convertir datos a hoja de trabajo
      const ws = XLSX.utils.json_to_sheet(reportRows);

      // Configurar anchos de columna
      ws['!cols'] = [
        { wch: 30 }, // Deudor
        { wch: 15 }, // Fecha
        { wch: 15 }, // Monto Préstamo
        { wch: 15 }, // Valor Pagado
        { wch: 15 }, // Saldo Restante
        { wch: 15 }, // Método
        { wch: 20 }  // Referencia
      ];

      // Aplicar estilos
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellRef];
          if (!cell) continue;

          // Estilo para encabezados y totales
          if (R === 0 || R === range.e.r) {
            cell.s = {
              fill: { fgColor: { rgb: "FFD100" } },
              font: { bold: true, color: { rgb: "000000" } },
              alignment: { horizontal: "center" }
            };
          }
        }
      }

      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Pagos');

      // Generar el archivo
      const fileName = `reporte_pagos_${new Date().toLocaleDateString('es-CO').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Reporte exportado exitosamente');

    } catch (error) {
      console.error('Error al generar Excel:', error);
      toast.error('Error al generar el reporte');
    }
  };
  // Continuación del componente Reports...

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Encabezado y Controles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0 md:space-x-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Reportes y Estadísticas</h1>
        
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 w-full md:w-auto">
          <div className="flex space-x-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="block rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2 px-3"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="block rounded-lg border-2 border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-base py-2 px-3"
            />
          </div>
          
          <button
            onClick={generateExcel}
            className="bg-yellow-600 text-white px-6 py-2.5 rounded-lg flex items-center justify-center hover:bg-yellow-700 transition-colors"
          >
            <FileDownload className="mr-2" /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <MonetizationOn className="text-yellow-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500 text-sm">Total Préstamos</p>
              <p className="text-2xl font-bold">{formatMoney(reportData.stats.montoTotal)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AccountBalance className="text-green-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500 text-sm">Total Cobrado</p>
              <p className="text-2xl font-bold">{formatMoney(reportData.stats.montoPagado)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="text-red-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500 text-sm">Por Cobrar</p>
              <p className="text-2xl font-bold">{formatMoney(reportData.stats.montoPendiente)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Assessment className="text-blue-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500 text-sm">Préstamos Activos</p>
              <p className="text-2xl font-bold">{reportData.stats.prestamosActivos}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Gráfico de Tendencias */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Tendencia de Pagos</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportData.graphData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="montoTotal"
                  name="Préstamos"
                  stroke="#FFD100"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="pagos"
                  name="Pagos"
                  stroke="#000000"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Estado de Préstamos */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Estado de Préstamos</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Activos', value: reportData.stats.prestamosActivos },
                    { name: 'Completados', value: reportData.stats.prestamosCompletados }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {reportData.graphData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Vista Móvil de Pagos Recientes */}
      <div className="md:hidden space-y-4">
        <h3 className="text-lg font-semibold mb-2">Pagos Recientes</h3>
        {reportData.pagos.slice(0, 5).map((pago, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">{pago.debtorName}</span>
              <span className="text-sm text-gray-500">
                {new Date(pago.paymentDate).toLocaleDateString()}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Monto Pagado:</span>
                <span className="font-medium text-green-600">{formatMoney(pago.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Método:</span>
                <span className="capitalize">{pago.paymentMethod}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vista Desktop de Pagos Recientes */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Pagos Recientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deudor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto Pagado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.pagos.slice(0, 5).map((pago, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {pago.debtorName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {formatMoney(pago.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {pago.paymentMethod}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(pago.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {pago.reference || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;