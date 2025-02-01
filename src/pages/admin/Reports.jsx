import { useState, useEffect, useContext } from "react"
import { db } from "../../config/firebase"
import { AuthContext } from "../../context/AuthContext"
import { collection, query, getDocs, where } from "firebase/firestore"
import * as XLSX from "xlsx"
import {
  FileDownload,
  TrendingUp,
  AccountBalance,
  Assessment,
  PieChart as PieChartIcon,
  MonetizationOn,
  DateRange,
  Search,
} from "@mui/icons-material"
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
  Cell,
} from "recharts"
import toast from "react-hot-toast"

const Reports = () => {
  const { currentUser } = useContext(AuthContext)
  const [reportData, setReportData] = useState({
    prestamos: [],
    pagos: [],
    stats: {
      montoTotal: 0,
      montoPagado: 0,
      montoPendiente: 0,
      prestamosActivos: 0,
      prestamosCompletados: 0,
    },
    graphData: [],
  })
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  })
  const [loading, setLoading] = useState(true)

  const formatMoney = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0)
  }

  const fetchReportData = async () => {
    if (!currentUser) return

    try {
      setLoading(true)

      // Obtener préstamos
      const loansQuery = query(collection(db, "loans"), where("adminId", "==", currentUser.uid))
      const loansSnapshot = await getDocs(loansQuery)
      const prestamos = loansSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      // Obtener pagos
      const paymentsQuery = query(collection(db, "payments"), where("adminId", "==", currentUser.uid))
      const paymentsSnapshot = await getDocs(paymentsQuery)
      const pagos = paymentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      // Filtrar por fecha
      const filteredPagos = pagos.filter((pago) => {
        if (!dateRange.startDate || !dateRange.endDate) return true
        const pagoDate = new Date(pago.paymentDate)
        const startDate = new Date(dateRange.startDate)
        const endDate = new Date(dateRange.endDate)
        endDate.setHours(23, 59, 59)
        return pagoDate >= startDate && pagoDate <= endDate
      })

      // Calcular estadísticas
      const montoTotal = prestamos.reduce((sum, loan) => sum + (loan.totalPayment || 0), 0)
      const montoPagado = prestamos.reduce((sum, loan) => sum + (loan.paidAmount || 0), 0)
      const montoPendiente = montoTotal - montoPagado
      const prestamosActivos = prestamos.filter((loan) => loan.status === "active").length
      const prestamosCompletados = prestamos.filter((loan) => loan.status === "completed").length

      // Preparar datos para gráficos
      const monthlyData = {}
      filteredPagos.forEach((pago) => {
        const date = new Date(pago.paymentDate)
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`

        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = { name: monthYear, pagos: 0, montoTotal: 0 }
        }
        monthlyData[monthYear].pagos += pago.amount || 0
      })

      prestamos.forEach((prestamo) => {
        const date = new Date(prestamo.createdAt)
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`

        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = { name: monthYear, pagos: 0, montoTotal: 0 }
        }
        monthlyData[monthYear].montoTotal += prestamo.totalPayment || 0
      })

      setReportData({
        prestamos,
        pagos: filteredPagos,
        stats: { montoTotal, montoPagado, montoPendiente, prestamosActivos, prestamosCompletados },
        graphData: Object.values(monthlyData).sort((a, b) => {
          const [monthA, yearA] = a.name.split("/")
          const [monthB, yearB] = b.name.split("/")
          return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1)
        }),
      })
    } catch (error) {
      console.error("Error al cargar datos:", error)
      toast.error("Error al cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReportData()
  }, [currentUser, dateRange])

  const generateExcel = () => {
    try {
      const reportRows = reportData.pagos.map((pago) => ({
        "Nombre del Deudor": pago.debtorName || "N/A",
        "Fecha de Pago": new Date(pago.paymentDate).toLocaleDateString("es-CO"),
        "Monto Préstamo": formatMoney(pago.totalLoanAmount),
        "Valor Pagado": formatMoney(pago.amount),
        "Saldo Restante": formatMoney(pago.remainingAfterPayment),
        "Método de Pago":
          pago.paymentMethod === "cash" ? "Efectivo" : pago.paymentMethod === "transfer" ? "Transferencia" : "Tarjeta",
        Referencia: pago.reference || "-",
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(reportRows)

      ws["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }]

      XLSX.utils.book_append_sheet(wb, ws, "Reporte de Pagos")
      const fileName = `reporte_pagos_${new Date().toLocaleDateString("es-CO").replace(/\//g, "-")}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success("Reporte exportado exitosamente")
    } catch (error) {
      console.error("Error al generar Excel:", error)
      toast.error("Error al generar el reporte")
    }
  }

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="bg-white rounded-xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl">
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-lg bg-${color}-100`}>
          <Icon className={`text-${color}-600 text-3xl`} />
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className={`text-2xl font-bold text-${color}-700 mt-1`}>{value}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Encabezado */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Reportes Financieros</h1>
              <p className="text-gray-600">Visualiza el comportamiento de tus préstamos y pagos</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="flex gap-2 flex-1 bg-white rounded-lg shadow-sm">
                <div className="relative flex-1">
                  <DateRange className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-l-lg border-0 focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div className="relative flex-1">
                  <DateRange className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-r-lg border-0 focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>
              <button
                onClick={generateExcel}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors shadow-sm"
              >
                <FileDownload /> Exportar
              </button>
            </div>
          </div>
        </div>

        {/* Tarjetas de Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
          <StatCard
            icon={MonetizationOn}
            title="Total Préstamos"
            value={formatMoney(reportData.stats.montoTotal)}
            color="yellow"
          />
          <StatCard
            icon={AccountBalance}
            title="Total Cobrado"
            value={formatMoney(reportData.stats.montoPagado)}
            color="green"
          />
          <StatCard
            icon={TrendingUp}
            title="Por Cobrar"
            value={formatMoney(reportData.stats.montoPendiente)}
            color="red"
          />
          <StatCard
            icon={Assessment}
            title="Préstamos Activos"
            value={reportData.stats.prestamosActivos}
            color="blue"
          />
          <StatCard
            icon={PieChartIcon}
            title="Completados"
            value={reportData.stats.prestamosCompletados}
            color="purple"
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-6">Tendencia Mensual</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reportData.graphData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fill: "#6b7280" }} stroke="#d1d5db" />
                  <YAxis tickFormatter={(value) => `$${value / 1000}k`} tick={{ fill: "#6b7280" }} stroke="#d1d5db" />
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    formatter={(value) => formatMoney(value)}
                  />
                  <Legend wrapperStyle={{ paddingTop: "1rem" }} />
                  <Line
                    type="monotone"
                    dataKey="montoTotal"
                    name="Préstamos Otorgados"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: "#f59e0b", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pagos"
                    name="Pagos Recibidos"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-6">Distribución de Préstamos</h3>
            <div className="h-80 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Activos", value: reportData.stats.prestamosActivos },
                      { name: "Completados", value: reportData.stats.prestamosCompletados },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell key="active" fill="#f59e0b" />
                    <Cell key="completed" fill="#10b981" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Legend align="right" verticalAlign="middle" layout="vertical" wrapperStyle={{ right: -20 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tabla de Pagos Recientes */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-xl font-semibold">Últimos Pagos</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar pagos..."
                className="pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {["Deudor", "Monto", "Método", "Fecha", "Referencia"].map((header, index) => (
                    <th
                      key={index}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportData.pagos.slice(0, 5).map((pago, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pago.debtorName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {formatMoney(pago.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          pago.paymentMethod === "cash"
                            ? "bg-green-100 text-green-800"
                            : pago.paymentMethod === "transfer"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {pago.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(pago.paymentDate).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pago.reference || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-600"></div>
              <span className="text-gray-700">Generando reportes...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Reports

