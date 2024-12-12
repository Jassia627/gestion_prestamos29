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
  PieChart as PieChartIcon
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
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState({
    startDate: '',
    endDate: ''
  });

  const COLORS = ['#FFD100', '#000000', '#FF0000', '#666666'];

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  useEffect(() => {
    fetchReportData();
  }, [currentUser, filterDate]);

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
        if (!filterDate.startDate || !filterDate.endDate) return true;
        const pagoDate = new Date(pago.paymentDate);
        const startDate = new Date(filterDate.startDate);
        const endDate = new Date(filterDate.endDate);
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
        graphData: Object.values(monthlyData)
      });

    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const generateExcel = () => {
    try {
      // Preparar datos para el reporte
      const reportRows = reportData.pagos
        .filter(pago => pago.paymentDate)
        .map(pago => {
          const prestamo = reportData.prestamos.find(p => p.id === pago.loanId);
          return {
            'Nombre del Deudor': pago.debtorName || 'N/A',
            'Fecha de Pago': new Date(pago.paymentDate).toLocaleDateString('es-CO'),
            'Total Préstamo': prestamo?.totalPayment || pago.totalLoanAmount || 0,
            'Saldo Restante': pago.remainingAfterPayment || 0,
            'Valor Pagado': pago.amount || 0,
            'Método de Pago': pago.paymentMethod || 'N/A',
            'Referencia': pago.reference || 'N/A'
          };
        });

      // Agregar fila de totales
      reportRows.push({
        'Nombre del Deudor': 'TOTALES',
        'Fecha de Pago': '',
        'Total Préstamo': reportData.stats.montoTotal,
        'Saldo Restante': reportData.stats.montePendiente,
        'Valor Pagado': reportData.stats.montoPagado,
        'Método de Pago': '',
        'Referencia': ''
      });

      // Crear libro de trabajo
      const wb = XLSX.utils.book_new();
      
      // Convertir datos a hoja de trabajo
      const ws = XLSX.utils.json_to_sheet(reportRows);

      // Configurar anchos de columna
      ws['!cols'] = [
        { wch: 30 }, // Nombre
        { wch: 15 }, // Fecha
        { wch: 15 }, // Total
        { wch: 15 }, // Saldo
        { wch: 15 }, // Valor Pagado
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

          // Formato de moneda para columnas numéricas
          if (C >= 2 && C <= 4) {
            cell.z = '"$"#,##0';
          }

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

      // Generar y descargar el archivo
      const fileName = `reporte_pagos_${new Date().toLocaleDateString('es-CO').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Reporte exportado exitosamente');

    } catch (error) {
      console.error('Error al generar Excel:', error);
      toast.error('Error al generar el reporte');
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
      {/* Encabezado y Controles */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold">Reportes y Estadísticas</h1>
        
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
          <div className="flex space-x-2">
            <input
              type="date"
              value={filterDate.startDate}
              onChange={(e) => setFilterDate(prev => ({ ...prev, startDate: e.target.value }))}
              className="border rounded px-2 py-1"
            />
            <input
              type="date"
              value={filterDate.endDate}
              onChange={(e) => setFilterDate(prev => ({ ...prev, endDate: e.target.value }))}
              className="border rounded px-2 py-1"
            />
          </div>
          
          <button
            onClick={generateExcel}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center justify-center"
          >
            <FileDownload className="mr-2" /> Exportar a Excel
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AttachMoney className="text-yellow-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Monto Total</p>
              <p className="text-2xl font-bold">{formatMoney(reportData.stats.montoTotal)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AccountBalance className="text-green-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Total Cobrado</p>
              <p className="text-2xl font-bold">{formatMoney(reportData.stats.montoPagado)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="text-red-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Por Cobrar</p>
              <p className="text-2xl font-bold">{formatMoney(reportData.stats.montoPendiente)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <PieChartIcon className="text-blue-600 mr-4" style={{ fontSize: 40 }} />
            <div>
              <p className="text-gray-500">Préstamos Activos</p>
              <p className="text-2xl font-bold">{reportData.stats.prestamosActivos}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

      {/* Tabla de Pagos */}
      <div className="bg-gray-50 p-6 min-h-screen">
  <h3 className="text-2xl font-bold mb-6 text-gray-800">Historial de Pagos</h3>
  <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
    {reportData.pagos
      .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
      .map((pago) => (
        <div
          key={pago.id}
          className="bg-white rounded-xl shadow-lg border border-gray-200 transition-transform transform hover:scale-105 hover:shadow-xl"
        >
          <div className="p-5">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-bold text-gray-900">
                {pago.debtorName}
              </h4>
              <span className="bg-yellow-100 text-yellow-600 text-xs font-medium px-3 py-1 rounded-full capitalize">
                {pago.paymentMethod}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10 20a2 2 0 002-2H8a2 2 0 002 2zM5.03 7H4a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1.03a8 8 0 10-11.94 0z" />
                </svg>
                <span>
                  <strong>Monto Total:</strong> {formatMoney(pago.totalLoanAmount)}
                </span>
              </p>
              <p className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-400 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M5 13a1 1 0 011-1h8a1 1 0 011 1v3h3v-3a1 1 0 00-1-1h-2.585A2 2 0 0013 9.414l-2-2V6a2 2 0 10-4 0v1.414l-2 2A2 2 0 003.585 12H2a1 1 0 00-1 1v3h3v-3z" />
                </svg>
                <span>
                  <strong>Monto Pagado:</strong> {formatMoney(pago.amount)}
                </span>
              </p>
              <p className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-red-400 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M13 7H7v6h6V7z" />
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-14a6 6 0 110 12 6 6 0 010-12z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  <strong>Saldo Restante:</strong>{" "}
                  {formatMoney(pago.remainingAfterPayment)}
                </span>
              </p>
              <p className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-blue-400 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M6 2a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 110 2h-1v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8H2a1 1 0 110-2h3V2zm2 0v4h4V2H8z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  <strong>Fecha:</strong>{" "}
                  {new Date(pago.paymentDate).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>
        </div>
      ))}
  </div>
</div>

    </div>
  );
};

export default Reports;