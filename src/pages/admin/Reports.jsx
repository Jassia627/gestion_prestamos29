import { useState, useEffect, useContext, useMemo } from "react"
import { db } from "../../config/firebase"
import { AuthContext } from "../../context/AuthContext"
import { collection, query, getDocs, where } from "firebase/firestore"
import * as XLSX from "xlsx"
import {
  Download,
  TrendingUp,
  Building2,
  BarChart3,
  PieChart as PieChartIcon,
  DollarSign,
  Calendar,
  Search,
} from "lucide-react"
import toast from "react-hot-toast"
import { formatMoney } from "../../utils/formatters"

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
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("payments") // "payments", "loans" o "summary"

  // Memoizar queries
  const loansQuery = useMemo(() => {
    if (!currentUser) return null;
    return query(collection(db, "loans"), where("adminId", "==", currentUser.uid));
  }, [currentUser]);

  const paymentsQuery = useMemo(() => {
    if (!currentUser) return null;
    return query(collection(db, "payments"), where("adminId", "==", currentUser.uid));
  }, [currentUser]);

  const fetchReportData = async () => {
    if (!currentUser) return

    try {
      setLoading(true)

      if (!loansQuery || !paymentsQuery) return;

      // Obtener deudores
      const debtorsQuery = query(collection(db, "debtors"), where("adminId", "==", currentUser.uid))
      const debtorsSnapshot = await getDocs(debtorsQuery)
      const debtorsMap = {}
      debtorsSnapshot.docs.forEach((doc) => {
        debtorsMap[doc.id] = { id: doc.id, ...doc.data() }
      })

      // Obtener préstamos
      const loansSnapshot = await getDocs(loansQuery)
      const prestamos = loansSnapshot.docs.map((doc) => {
        const loan = { id: doc.id, ...doc.data() }
        const debtor = debtorsMap[loan.debtorId]
        return {
          ...loan,
          debtorName: debtor ? debtor.name : "Deudor no encontrado",
        }
      })

      // Obtener pagos
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

      setReportData({
        prestamos,
        pagos: filteredPagos,
        stats: { montoTotal, montoPagado, montoPendiente, prestamosActivos, prestamosCompletados },
        graphData: [],
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
  }, [currentUser, dateRange, loansQuery, paymentsQuery])

  const generateExcel = (type = "payments") => {
    try {
      let reportRows = []
      let fileName = ""
      let sheetName = ""

      if (type === "summary") {
        const filteredPagos = reportData.pagos.filter((pago) => {
          if (!dateRange.startDate || !dateRange.endDate) return true
          const pagoDate = new Date(pago.paymentDate)
          const startDate = new Date(dateRange.startDate)
          const endDate = new Date(dateRange.endDate)
          endDate.setHours(23, 59, 59)
          return pagoDate >= startDate && pagoDate <= endDate
        })

        const totalIntereses = filteredPagos.reduce((sum, pago) => sum + (parseFloat(pago.interestPayment) || 0), 0)
        const totalCapital = filteredPagos.reduce((sum, pago) => sum + (parseFloat(pago.capitalPayment) || 0), 0)
        const totalGeneral = filteredPagos.reduce((sum, pago) => sum + (parseFloat(pago.amount) || 0), 0)

        const interesesEfectivo = filteredPagos.filter(p => p.paymentMethod === "cash").reduce((sum, pago) => sum + (parseFloat(pago.interestPayment) || 0), 0)
        const interesesTransferencia = filteredPagos.filter(p => p.paymentMethod === "transfer").reduce((sum, pago) => sum + (parseFloat(pago.interestPayment) || 0), 0)
        const interesesTarjeta = filteredPagos.filter(p => p.paymentMethod === "card").reduce((sum, pago) => sum + (parseFloat(pago.interestPayment) || 0), 0)

        const capitalEfectivo = filteredPagos.filter(p => p.paymentMethod === "cash").reduce((sum, pago) => sum + (parseFloat(pago.capitalPayment) || 0), 0)
        const capitalTransferencia = filteredPagos.filter(p => p.paymentMethod === "transfer").reduce((sum, pago) => sum + (parseFloat(pago.capitalPayment) || 0), 0)
        const capitalTarjeta = filteredPagos.filter(p => p.paymentMethod === "card").reduce((sum, pago) => sum + (parseFloat(pago.capitalPayment) || 0), 0)

        const totalEfectivo = filteredPagos.filter(p => p.paymentMethod === "cash").reduce((sum, pago) => sum + (parseFloat(pago.amount) || 0), 0)
        const totalTransferencia = filteredPagos.filter(p => p.paymentMethod === "transfer").reduce((sum, pago) => sum + (parseFloat(pago.amount) || 0), 0)
        const totalTarjeta = filteredPagos.filter(p => p.paymentMethod === "card").reduce((sum, pago) => sum + (parseFloat(pago.amount) || 0), 0)

        reportRows = [
          {
            "Concepto": "Intereses",
            "Total Recaudado": formatMoney(totalIntereses),
            "Efectivo": formatMoney(interesesEfectivo),
            "Transferencia": formatMoney(interesesTransferencia),
            "Tarjeta": formatMoney(interesesTarjeta),
          },
          {
            "Concepto": "Capital",
            "Total Recaudado": formatMoney(totalCapital),
            "Efectivo": formatMoney(capitalEfectivo),
            "Transferencia": formatMoney(capitalTransferencia),
            "Tarjeta": formatMoney(capitalTarjeta),
          },
          {
            "Concepto": "TOTAL GENERAL",
            "Total Recaudado": formatMoney(totalGeneral),
            "Efectivo": formatMoney(totalEfectivo),
            "Transferencia": formatMoney(totalTransferencia),
            "Tarjeta": formatMoney(totalTarjeta),
          },
        ]
        fileName = `reporte_recaudacion_${new Date().toLocaleDateString("es-CO").replace(/\//g, "-")}.xlsx`
        sheetName = "Resumen de Recaudación"
      } else if (type === "payments") {
        const filteredPagos = reportData.pagos.filter((pago) => {
          if (!searchTerm) return true
          const searchLower = searchTerm.toLowerCase()
          return (
            (pago.debtorName && pago.debtorName.toLowerCase().includes(searchLower)) ||
            (pago.reference && pago.reference.toLowerCase().includes(searchLower))
          )
        })

        reportRows = filteredPagos.map((pago) => ({
          "Nombre del Deudor": pago.debtorName || "N/A",
          "Fecha de Pago": new Date(pago.paymentDate).toLocaleDateString("es-CO"),
          "Tipo de Pago": pago.paymentType === "interests" ? "Intereses" : pago.paymentType === "capital" ? "Capital" : "N/A",
          "Pago a Intereses": pago.interestPayment ? formatMoney(pago.interestPayment) : "$0",
          "Abono a Capital": pago.capitalPayment ? formatMoney(pago.capitalPayment) : "$0",
          "Valor Total Pagado": formatMoney(pago.amount),
          "Monto Préstamo": formatMoney(pago.totalLoanAmount || 0),
          "Saldo Restante": formatMoney(pago.remainingAfterPayment || 0),
          "Método de Pago":
            pago.paymentMethod === "cash" ? "Efectivo" : pago.paymentMethod === "transfer" ? "Transferencia" : "Tarjeta",
          Referencia: pago.reference || "-",
        }))
        fileName = `reporte_pagos_${new Date().toLocaleDateString("es-CO").replace(/\//g, "-")}.xlsx`
        sheetName = "Reporte de Pagos"
      } else {
        const filteredPrestamos = reportData.prestamos.filter((prestamo) => {
          if (!searchTerm) return true
          const searchLower = searchTerm.toLowerCase()
          return (
            (prestamo.debtorName && prestamo.debtorName.toLowerCase().includes(searchLower)) ||
            (prestamo.description && prestamo.description.toLowerCase().includes(searchLower))
          )
        })

        reportRows = filteredPrestamos.map((prestamo) => ({
          "Nombre del Deudor": prestamo.debtorName || "N/A",
          "Fecha de Creación": new Date(prestamo.createdAt).toLocaleDateString("es-CO"),
          "Fecha de Inicio": new Date(prestamo.startDate).toLocaleDateString("es-CO"),
          "Monto del Préstamo": formatMoney(prestamo.amount),
          "Tasa de Interés": `${prestamo.interestRate}% ${prestamo.paymentFrequency === 'daily' ? 'diario' : prestamo.paymentFrequency === 'weekly' ? 'semanal' : 'mensual'}`,
          "Frecuencia de Pago": prestamo.paymentFrequency === 'daily' ? 'Diaria' : prestamo.paymentFrequency === 'weekly' ? 'Semanal' : 'Mensual',
          "Plazo": prestamo.isIndefinite ? "Indefinido" : `${prestamo.term} ${prestamo.paymentFrequency === 'daily' ? 'días' : prestamo.paymentFrequency === 'weekly' ? 'semanas' : 'meses'}`,
          "Total a Pagar": formatMoney(prestamo.totalPayment || 0),
          "Monto Pagado": formatMoney(prestamo.paidAmount || 0),
          "Capital Pagado": formatMoney(prestamo.paidCapital || 0),
          "Intereses Pagados": formatMoney(prestamo.paidInterest || 0),
          "Saldo Pendiente": formatMoney(prestamo.remainingAmount || 0),
          "Estado": prestamo.status === "active" ? "Activo" : prestamo.status === "completed" ? "Completado" : "Vencido",
          "Descripción": prestamo.description || "-",
        }))
        fileName = `reporte_prestamos_${new Date().toLocaleDateString("es-CO").replace(/\//g, "-")}.xlsx`
        sheetName = "Reporte de Préstamos"
      }

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(reportRows)

      ws["!cols"] = Array(Object.keys(reportRows[0] || {}).length).fill({ wch: 20 })

      XLSX.utils.book_append_sheet(wb, ws, sheetName)
      XLSX.writeFile(wb, fileName)
      toast.success(`Reporte de ${type === "payments" ? "pagos" : "préstamos"} exportado exitosamente`)
    } catch (error) {
      console.error("Error al generar Excel:", error)
      toast.error("Error al generar el reporte")
    }
  }

  const StatCard = ({ icon: Icon, title, value, color }) => {
    const getColorClasses = (color) => {
      const colors = {
        yellow: {
          text: "text-yellow-600",
          gradient: "from-yellow-400 to-yellow-500",
          hover: "from-yellow-400/10 to-yellow-600/5"
        },
        green: {
          text: "text-green-600",
          gradient: "from-green-400 to-green-500",
          hover: "from-green-400/10 to-green-600/5"
        },
        red: {
          text: "text-red-600",
          gradient: "from-red-400 to-red-500",
          hover: "from-red-400/10 to-red-600/5"
        },
        blue: {
          text: "text-blue-600",
          gradient: "from-blue-400 to-blue-500",
          hover: "from-blue-400/10 to-blue-600/5"
        },
        purple: {
          text: "text-purple-600",
          gradient: "from-purple-400 to-purple-500",
          hover: "from-purple-400/10 to-purple-600/5"
        }
      };
      return colors[color] || colors.yellow;
    };
    
    const colorClasses = getColorClasses(color);
    
    return (
    <div className="group relative bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100">
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses.hover} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
      <div className="relative p-4 sm:p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-[9px] sm:text-[10px] md:text-xs font-semibold ${colorClasses.text} uppercase tracking-wider mb-0.5 sm:mb-1`}>{title}</p>
            <p className={`text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold ${colorClasses.text} mb-0.5 sm:mb-1 break-words leading-tight`}>
              {value}
            </p>
          </div>
          <div className={`bg-gradient-to-br ${colorClasses.gradient} p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl shadow-lg flex-shrink-0`}>
            <Icon className="text-white w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </div>
        </div>
      </div>
    </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-200 border-t-yellow-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Generando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        {/* Header Mejorado - Optimizado para móvil */}
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-400 bg-clip-text text-transparent mb-1 sm:mb-2">
                Reportes Financieros
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm md:text-base">Visualiza el comportamiento de tus préstamos y pagos</p>
            </div>
          </div>

          {/* Filtros y Exportar */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex gap-2 flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
              <div className="relative flex-1">
                <Calendar className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full pl-8 sm:pl-10 pr-2 sm:pr-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm border-0 focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full pl-8 sm:pl-10 pr-2 sm:pr-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm border-0 focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tarjetas de Estadísticas - Grid 2 columnas en móvil */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <StatCard
            icon={DollarSign}
            title="Total Préstamos"
            value={formatMoney(reportData.stats.montoTotal)}
            color="yellow"
          />
          <StatCard
            icon={Building2}
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
            icon={BarChart3}
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

        {/* Tabs para Pagos, Préstamos y Resumen */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden border border-gray-100 mb-6 sm:mb-8">
          <div className="border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("payments")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === "payments"
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Pagos
                </button>
                <button
                  onClick={() => setActiveTab("loans")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === "loans"
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Préstamos
                </button>
                <button
                  onClick={() => setActiveTab("summary")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === "summary"
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Resumen Recaudación
                </button>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64 pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 text-xs sm:text-sm rounded-lg border border-gray-300 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
                <button
                  onClick={() => generateExcel(activeTab)}
                  className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors shadow-sm text-xs sm:text-sm font-medium"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Exportar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Pagos */}
          {activeTab === "payments" && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {["Deudor", "Fecha", "Tipo", "Pago Intereses", "Abono Capital", "Total", "Método", "Referencia"].map((header, index) => (
                      <th
                        key={index}
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.pagos
                    .filter((pago) => {
                      if (!searchTerm) return true
                      const searchLower = searchTerm.toLowerCase()
                      return (
                        (pago.debtorName && pago.debtorName.toLowerCase().includes(searchLower)) ||
                        (pago.reference && pago.reference.toLowerCase().includes(searchLower))
                      )
                    })
                    .map((pago, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                          {pago.debtorName || "N/A"}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {new Date(pago.paymentDate).toLocaleDateString("es-CO")}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                              pago.paymentType === "interests"
                                ? "bg-blue-100 text-blue-800"
                                : pago.paymentType === "capital"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {pago.paymentType === "interests" ? "Intereses" : pago.paymentType === "capital" ? "Capital" : "N/A"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-blue-600 font-medium">
                          {pago.interestPayment ? formatMoney(pago.interestPayment) : "$0"}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-purple-600 font-medium">
                          {pago.capitalPayment ? formatMoney(pago.capitalPayment) : "$0"}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-green-600 font-medium">
                          {formatMoney(pago.amount)}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                              pago.paymentMethod === "cash"
                                ? "bg-green-100 text-green-800"
                                : pago.paymentMethod === "transfer"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {pago.paymentMethod === "cash" ? "Efectivo" : pago.paymentMethod === "transfer" ? "Transferencia" : "Tarjeta"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {pago.reference || "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {reportData.pagos.filter((pago) => {
                if (!searchTerm) return true
                const searchLower = searchTerm.toLowerCase()
                return (
                  (pago.debtorName && pago.debtorName.toLowerCase().includes(searchLower)) ||
                  (pago.reference && pago.reference.toLowerCase().includes(searchLower))
                )
              }).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron pagos
                </div>
              )}
            </div>
          )}

          {/* Tabla de Préstamos */}
          {activeTab === "loans" && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {["Deudor", "Fecha Inicio", "Monto", "Interés", "Frecuencia", "Plazo", "Total", "Pagado", "Capital Pagado", "Intereses Pagados", "Pendiente", "Estado"].map((header, index) => (
                      <th
                        key={index}
                        className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.prestamos
                    .filter((prestamo) => {
                      if (!searchTerm) return true
                      const searchLower = searchTerm.toLowerCase()
                      return (
                        (prestamo.debtorName && prestamo.debtorName.toLowerCase().includes(searchLower)) ||
                        (prestamo.description && prestamo.description.toLowerCase().includes(searchLower))
                      )
                    })
                    .map((prestamo, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                          {prestamo.debtorName || "N/A"}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {new Date(prestamo.startDate).toLocaleDateString("es-CO")}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                          {formatMoney(prestamo.amount)}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm">
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                            {prestamo.interestRate}% {prestamo.paymentFrequency === 'daily' ? 'diario' : prestamo.paymentFrequency === 'weekly' ? 'semanal' : 'mensual'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {prestamo.paymentFrequency === 'daily' ? 'Diaria' : prestamo.paymentFrequency === 'weekly' ? 'Semanal' : 'Mensual'}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {prestamo.isIndefinite ? "Indefinido" : `${prestamo.term} ${prestamo.paymentFrequency === 'daily' ? 'días' : prestamo.paymentFrequency === 'weekly' ? 'semanas' : 'meses'}`}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-yellow-600">
                          {formatMoney(prestamo.totalPayment || 0)}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-green-600">
                          {formatMoney(prestamo.paidAmount || 0)}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-purple-600">
                          {formatMoney(prestamo.paidCapital || 0)}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-blue-600">
                          {formatMoney(prestamo.paidInterest || 0)}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-red-600">
                          {formatMoney(prestamo.remainingAmount || 0)}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                              prestamo.status === "active"
                                ? "bg-green-100 text-green-800"
                                : prestamo.status === "completed"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {prestamo.status === "active" ? "Activo" : prestamo.status === "completed" ? "Completado" : "Vencido"}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {reportData.prestamos.filter((prestamo) => {
                if (!searchTerm) return true
                const searchLower = searchTerm.toLowerCase()
                return (
                  (prestamo.debtorName && prestamo.debtorName.toLowerCase().includes(searchLower)) ||
                  (prestamo.description && prestamo.description.toLowerCase().includes(searchLower))
                )
              }).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No se encontraron préstamos
                </div>
              )}
            </div>
          )}

          {/* Tabla de Resumen de Recaudación */}
          {activeTab === "summary" && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Concepto
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Recaudado
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Por Método de Pago
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const filteredPagos = reportData.pagos.filter((pago) => {
                      if (!dateRange.startDate || !dateRange.endDate) return true
                      const pagoDate = new Date(pago.paymentDate)
                      const startDate = new Date(dateRange.startDate)
                      const endDate = new Date(dateRange.endDate)
                      endDate.setHours(23, 59, 59)
                      return pagoDate >= startDate && pagoDate <= endDate
                    })

                    // Calcular totales
                    const totalIntereses = filteredPagos.reduce((sum, pago) => sum + (parseFloat(pago.interestPayment) || 0), 0)
                    const totalCapital = filteredPagos.reduce((sum, pago) => sum + (parseFloat(pago.capitalPayment) || 0), 0)
                    const totalGeneral = filteredPagos.reduce((sum, pago) => sum + (parseFloat(pago.amount) || 0), 0)

                    // Calcular por método de pago
                    const porMetodo = {
                      cash: filteredPagos.filter(p => p.paymentMethod === "cash").reduce((sum, pago) => sum + (parseFloat(pago.amount) || 0), 0),
                      transfer: filteredPagos.filter(p => p.paymentMethod === "transfer").reduce((sum, pago) => sum + (parseFloat(pago.amount) || 0), 0),
                      card: filteredPagos.filter(p => p.paymentMethod === "card").reduce((sum, pago) => sum + (parseFloat(pago.amount) || 0), 0),
                    }

                    return (
                      <>
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              Intereses
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-blue-600">
                            {formatMoney(totalIntereses)}
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                            <div className="flex flex-col gap-1">
                              <span>Efectivo: {formatMoney(filteredPagos.filter(p => p.paymentMethod === "cash").reduce((sum, pago) => sum + (parseFloat(pago.interestPayment) || 0), 0))}</span>
                              <span>Transferencia: {formatMoney(filteredPagos.filter(p => p.paymentMethod === "transfer").reduce((sum, pago) => sum + (parseFloat(pago.interestPayment) || 0), 0))}</span>
                              <span>Tarjeta: {formatMoney(filteredPagos.filter(p => p.paymentMethod === "card").reduce((sum, pago) => sum + (parseFloat(pago.interestPayment) || 0), 0))}</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              Capital
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-purple-600">
                            {formatMoney(totalCapital)}
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                            <div className="flex flex-col gap-1">
                              <span>Efectivo: {formatMoney(filteredPagos.filter(p => p.paymentMethod === "cash").reduce((sum, pago) => sum + (parseFloat(pago.capitalPayment) || 0), 0))}</span>
                              <span>Transferencia: {formatMoney(filteredPagos.filter(p => p.paymentMethod === "transfer").reduce((sum, pago) => sum + (parseFloat(pago.capitalPayment) || 0), 0))}</span>
                              <span>Tarjeta: {formatMoney(filteredPagos.filter(p => p.paymentMethod === "card").reduce((sum, pago) => sum + (parseFloat(pago.capitalPayment) || 0), 0))}</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50 transition-colors bg-yellow-50">
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-gray-900">
                            <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">
                              TOTAL GENERAL
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-bold text-yellow-600 text-lg">
                            {formatMoney(totalGeneral)}
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 font-medium">
                            <div className="flex flex-col gap-1">
                              <span>Efectivo: {formatMoney(porMetodo.cash)}</span>
                              <span>Transferencia: {formatMoney(porMetodo.transfer)}</span>
                              <span>Tarjeta: {formatMoney(porMetodo.card)}</span>
                            </div>
                          </td>
                        </tr>
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Reports

