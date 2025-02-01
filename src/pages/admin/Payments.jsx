import { useState, useEffect, useContext } from "react"
import { db } from "../../config/firebase"
import { AuthContext } from "../../context/AuthContext"
import { collection, addDoc, query, getDocs, doc, updateDoc, where } from "firebase/firestore"
import { Add, Menu, Close } from "@mui/icons-material"
import toast from "react-hot-toast"

const Payments = () => {
  const { currentUser } = useContext(AuthContext)
  const [loading, setLoading] = useState(true)
  const [loans, setLoans] = useState([])
  const [filteredLoans, setFilteredLoans] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [modalFilters, setModalFilters] = useState({
    searchTerm: "",
    dateFilter: "",
    description: "",
  })

  const [formData, setFormData] = useState({
    loanId: "",
    amount: "",
    paymentDate: "",
    paymentMethod: "cash",
    reference: "",
  })

  const formatMoney = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0)
  }

  const fetchData = async () => {
    if (!currentUser) return

    try {
      setLoading(true)

      const debtorsQuery = query(collection(db, "debtors"), where("adminId", "==", currentUser.uid))
      const debtorsSnapshot = await getDocs(debtorsQuery)
      const debtorsMap = {}
      debtorsSnapshot.docs.forEach((doc) => {
        debtorsMap[doc.id] = { id: doc.id, ...doc.data() }
      })

      const loansQuery = query(
        collection(db, "loans"),
        where("adminId", "==", currentUser.uid),
        where("status", "==", "active"),
      )
      const loansSnapshot = await getDocs(loansQuery)
      const loansData = loansSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        debtorName: debtorsMap[doc.data().debtorId]?.name || "Deudor no encontrado",
        debtorPhone: debtorsMap[doc.data().debtorId]?.phone || "",
      }))

      setLoans(loansData)
      setFilteredLoans(loansData) // Corrected typo here
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentUser])

  const filterLoans = () => {
    let filtered = [...loans]

    if (modalFilters.searchTerm) {
      const searchLower = modalFilters.searchTerm.toLowerCase().trim()
      filtered = filtered.filter(
        (loan) =>
          loan.debtorName.toLowerCase().includes(searchLower) ||
          (loan.description && loan.description.toLowerCase().includes(searchLower)),
      )
    }

    if (modalFilters.dateFilter) {
      const filterDate = new Date(modalFilters.dateFilter).toLocaleDateString()
      filtered = filtered.filter((loan) => {
        const loanDate = new Date(loan.startDate).toLocaleDateString()
        return loanDate === filterDate
      })
    }

    if (modalFilters.description) {
      const descLower = modalFilters.description.toLowerCase().trim()
      filtered = filtered.filter((loan) => loan.description && loan.description.toLowerCase().includes(descLower))
    }

    setFilteredLoans(filtered)
  }

  useEffect(() => {
    filterLoans()
  }, [modalFilters, loans])
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser) return

    try {
      setLoading(true)
      const loan = loans.find((l) => l.id === formData.loanId)

      if (!loan) {
        toast.error("Préstamo no encontrado")
        return
      }

      const paymentAmount = Number.parseFloat(formData.amount)

      if (paymentAmount > loan.remainingAmount) {
        toast.error("El monto del pago excede la deuda pendiente")
        return
      }

      const newRemainingAmount = loan.remainingAmount - paymentAmount
      const newPaidAmount = (loan.paidAmount || 0) + paymentAmount

      const paymentData = {
        ...formData,
        adminId: currentUser.uid,
        debtorId: loan.debtorId,
        debtorName: loan.debtorName,
        amount: paymentAmount,
        totalLoanAmount: loan.totalPayment,
        remainingAfterPayment: newRemainingAmount,
        createdAt: new Date().toISOString(),
      }

      await addDoc(collection(db, "payments"), paymentData)

      const newStatus = newRemainingAmount <= 0 ? "completed" : "active"
      await updateDoc(doc(db, "loans", loan.id), {
        remainingAmount: newRemainingAmount,
        paidAmount: newPaidAmount,
        status: newStatus,
        lastPaymentDate: formData.paymentDate,
      })

      toast.success("Pago registrado exitosamente")
      setIsModalOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al procesar el pago")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      loanId: "",
      amount: "",
      paymentDate: "",
      paymentMethod: "cash",
      reference: "",
    })
    setModalFilters({
      searchTerm: "",
      dateFilter: "",
      description: "",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8">
      {/* Header con menú responsive */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-xl md:text-2xl font-bold">Gestión de Pagos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-yellow-600 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg flex items-center text-sm md:text-base"
          >
            <Add className="mr-1 md:mr-2" />
            <span className="hidden md:inline">Nuevo Pago</span>
            <span className="md:hidden">Pago</span>
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden bg-gray-100 p-2 rounded-lg"
          >
            {isMobileMenuOpen ? <Close /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre"
          value={modalFilters.searchTerm}
          onChange={(e) => setModalFilters((prev) => ({ ...prev, searchTerm: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <input
          type="date"
          value={modalFilters.dateFilter}
          onChange={(e) => setModalFilters((prev) => ({ ...prev, dateFilter: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <input
          type="text"
          placeholder="Buscar por descripción"
          value={modalFilters.description}
          onChange={(e) => setModalFilters((prev) => ({ ...prev, description: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Modal adaptado para móvil */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white rounded-lg p-4 md:p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg md:text-xl font-bold mb-4 md:mb-6">Registrar Nuevo Pago</h2>

            {/* Filtros */}
            <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
              {/* ... (mantener el contenido de los filtros igual) ... */}
            </div>

            {/* Formulario de pago adaptativo */}
            <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {/* Selección de préstamo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 md:mb-2">Seleccionar Préstamo</label>
                  <select
                    value={formData.loanId}
                    onChange={(e) => {
                      const loan = loans.find((l) => l.id === e.target.value)
                      setFormData((prev) => ({
                        ...prev,
                        loanId: e.target.value,
                      }))
                      if (loan) {
                        toast.success(`Monto pendiente: ${formatMoney(loan.remainingAmount)}`)
                      }
                    }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm md:text-base"
                    required
                  >
                    <option value="">Seleccione un préstamo</option>
                    {filteredLoans.map((loan) => (
                      <option key={loan.id} value={loan.id}>
                        {loan.debtorName} - {formatMoney(loan.remainingAmount)}
                        {loan.description ? ` - ${loan.description}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Monto y Fecha en la misma fila en desktop */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto del Pago</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">$</span>
                    </div>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm md:text-base"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        paymentDate: e.target.value,
                      }))
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm md:text-base"
                    required
                  />
                </div>

                {/* Método de pago y Referencia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        paymentMethod: e.target.value,
                      }))
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm md:text-base"
                    required
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia (opcional)</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reference: e.target.value,
                      }))
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm md:text-base"
                    placeholder="Número de transferencia..."
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-2 md:gap-3 mt-4 md:mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    resetForm()
                  }}
                  className="px-3 md:px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 md:px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 md:w-5 md:h-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                      <span className="text-sm">Procesando...</span>
                    </div>
                  ) : (
                    "Registrar Pago"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla responsiva */}
      {filteredLoans.length > 0 ? (
        <div className="bg-white rounded-lg shadow">
          {/* Vista móvil: Cards */}
          <div className="md:hidden space-y-4 p-4">
            {filteredLoans.map((loan) => (
              <div
                key={loan.id}
                className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    loanId: loan.id,
                  }))
                  setIsModalOpen(true)
                  toast.success(`Préstamo seleccionado: ${loan.debtorName}`)
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{loan.debtorName}</h3>
                    <p className="text-sm text-gray-500">{loan.debtorPhone}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    Activo
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Monto Pendiente</p>
                    <p className="font-medium text-yellow-600">{formatMoney(loan.remainingAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Fecha Inicio</p>
                    <p>{new Date(loan.startDate).toLocaleDateString()}</p>
                  </div>
                  {loan.description && (
                    <div className="col-span-2 mt-2">
                      <p className="text-gray-500">Descripción</p>
                      <p className="text-gray-900">{loan.description}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Vista desktop: Tabla */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deudor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto Pendiente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Inicio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLoans.map((loan) => (
                  <tr
                    key={loan.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        loanId: loan.id,
                      }))
                      setIsModalOpen(true)
                      toast.success(`Préstamo seleccionado: ${loan.debtorName}`)
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{loan.debtorName}</div>
                      <div className="text-sm text-gray-500">{loan.debtorPhone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 line-clamp-2">{loan.description || "-"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-yellow-600">{formatMoney(loan.remainingAmount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{new Date(loan.startDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Activo
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">
            {modalFilters.searchTerm || modalFilters.dateFilter || modalFilters.description
              ? "No se encontraron préstamos que coincidan con los filtros"
              : "No hay préstamos activos"}
          </p>
        </div>
      )}
    </div>
  )
}

export default Payments

