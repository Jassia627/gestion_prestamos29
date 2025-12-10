import { useState, useEffect, useContext, useMemo } from 'react';
import { db } from '../../config/firebase';
import { AuthContext } from '../../context/AuthContext';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { 
  DollarSign, 
  Calculator,
  Building2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp 
} from 'lucide-react';
import { formatMoney } from '../../utils/formatters';

const Dashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState([]); // Guardamos los préstamos crudos
  const [stats, setStats] = useState({
    capitalPrestado: 0,
    interesesTotales: 0,
    interesesGanados: 0,
    prestamosActivos: 0,
    prestamosVencidos: 0
  });

  // Memoizar la query de préstamos
  const loansQuery = useMemo(() => {
    if (!currentUser) return null;
    return query(
      collection(db, 'loans'),
      where('adminId', '==', currentUser.uid)
    );
  }, [currentUser]);

  const calcularInteresesPrestamo = (loan) => {
    try {
      const monto = parseFloat(loan.amount) || 0;
      // La tasa de interés ya viene guardada según la frecuencia (diaria, semanal o mensual)
      const tasaInteres = parseFloat(loan.interestRate) || 0;
      const paymentFrequency = loan.paymentFrequency || 'monthly';
      const periodInterestRate = tasaInteres / 100;
      
      if (loan.isIndefinite) {
        // Para préstamos indefinidos, calculamos según frecuencia
        const startDate = new Date(loan.startDate);
        const today = new Date();
        let interesTotal = 0;
        
        if (paymentFrequency === 'daily') {
          const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
          const daysElapsed = Math.max(0, daysDiff);
          const interesDiario = monto * periodInterestRate;
          interesTotal = interesDiario * daysElapsed;
        } else if (paymentFrequency === 'weekly') {
          const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
          const weeksElapsed = Math.max(0, Math.floor(daysDiff / 7));
          const interesSemanal = monto * periodInterestRate;
          interesTotal = interesSemanal * weeksElapsed;
        } else {
          // Mensual (por defecto)
          let mesesTranscurridos = (today.getFullYear() - startDate.getFullYear()) * 12;
          mesesTranscurridos += today.getMonth() - startDate.getMonth();
          if (today.getDate() < startDate.getDate()) {
            mesesTranscurridos--;
          }
          mesesTranscurridos = Math.max(0, mesesTranscurridos);
          const interesMensual = monto * periodInterestRate;
          interesTotal = interesMensual * mesesTranscurridos;
        }
        
        return interesTotal;

      } else {
        // Para préstamos a plazo fijo
        // El término ya está en la unidad correcta (días, semanas o meses)
        const termino = parseInt(loan.term) || 0;
        // La tasa ya es para el período correspondiente
        const interesPorPeriodo = monto * periodInterestRate;
        const interesTotal = interesPorPeriodo * termino;
        
        return interesTotal;
      }
    } catch (error) {
      console.error('Error calculando intereses:', error);
      return 0;
    }
  };

// En el useEffect
useEffect(() => {
  const fetchData = async () => {
      if (!currentUser || !loansQuery) return;

      try {
          setLoading(true);
          const querySnapshot = await getDocs(loansQuery);
          const loansData = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
          }));

          let totalCapital = 0;
          let totalIntereses = 0;
          let totalInteresesCobrados = 0;
          let prestamosActivos = 0;
          let prestamosVencidos = 0;

          loansData.forEach(loan => {
              if (loan.status === 'active') {
                  prestamosActivos++;
                  
                  // Sumar capital
                  const capital = parseFloat(loan.amount) || 0;
                  totalCapital += capital;

                  // Calcular y sumar intereses
                  const intereses = calcularInteresesPrestamo(loan);
                  totalIntereses += intereses;

                  // Verificar si está vencido
                  if (loan.nextPaymentDate && new Date(loan.nextPaymentDate) < new Date()) {
                      prestamosVencidos++;
                  }
              }

              // Calcular intereses cobrados
              if (loan.paidAmount > 0) {
                  const montoPagado = parseFloat(loan.paidAmount);
                  const capitalPagado = Math.min(montoPagado, parseFloat(loan.amount));
                  totalInteresesCobrados += montoPagado - capitalPagado;
              }
          });

          setStats({
              capitalPrestado: totalCapital,
              interesesTotales: totalIntereses,
              interesesGanados: totalInteresesCobrados,
              prestamosActivos: prestamosActivos,
              prestamosVencidos: prestamosVencidos
          });

      } catch (error) {
          console.error('Error al cargar datos:', error);
      } finally {
          setLoading(false);
      }
  };

  fetchData();
}, [currentUser, loansQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-200 border-t-yellow-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando datos financieros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        {/* Header Mejorado - Optimizado para móvil */}
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-400 bg-clip-text text-transparent mb-1 sm:mb-2">
                Panel de Control
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm md:text-base">Resumen financiero de tus préstamos</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white rounded-lg shadow-sm border border-gray-200 w-fit">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm font-medium text-gray-700">Sistema Activo</span>
            </div>
          </div>
        </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-6 mb-6 sm:mb-8">
        {/* Capital Prestado */}
        <div className="group relative bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-yellow-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4 sm:p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-0.5 sm:mb-1">Capital Prestado</p>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1 break-words leading-tight">
                  {formatMoney(stats.capitalPrestado)}
                </p>
                <div className="flex items-center text-[9px] sm:text-[10px] md:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 flex-shrink-0" />
                  <span className="truncate">Sin intereses</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl shadow-lg flex-shrink-0">
                <DollarSign className="text-white w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Intereses Totales */}
        <div className="group relative bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4 sm:p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-green-600 uppercase tracking-wider mb-0.5 sm:mb-1">Intereses Totales</p>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1 break-words leading-tight">
                  {formatMoney(stats.interesesTotales)}
                </p>
                <div className="flex items-center text-[9px] sm:text-[10px] md:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 flex-shrink-0" />
                  <span className="truncate">Cobrados: {formatMoney(stats.interesesGanados)}</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-400 to-green-500 p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl shadow-lg flex-shrink-0">
                <Calculator className="text-white w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Total con Intereses */}
        <div className="group relative bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4 sm:p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-blue-600 uppercase tracking-wider mb-0.5 sm:mb-1">Total Esperado</p>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1 break-words leading-tight">
                  {formatMoney(stats.capitalPrestado + stats.interesesTotales)}
                </p>
                <div className="flex items-center text-[9px] sm:text-[10px] md:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 flex-shrink-0" />
                  <span className="truncate">Capital + Intereses</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-400 to-blue-500 p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl shadow-lg flex-shrink-0">
                <Building2 className="text-white w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Préstamos Activos */}
        <div className="group relative bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4 sm:p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-0.5 sm:mb-1">Préstamos Activos</p>
                <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 mb-0.5 sm:mb-1 leading-tight">
                  {stats.prestamosActivos}
                </p>
                <div className="flex items-center text-[9px] sm:text-[10px] md:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 flex-shrink-0" />
                  <span className="truncate">En buen estado</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl shadow-lg flex-shrink-0">
                <CheckCircle2 className="text-white w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Préstamos Vencidos */}
        <div className="group relative bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-br from-red-400/10 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4 sm:p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-red-600 uppercase tracking-wider mb-0.5 sm:mb-1">Préstamos Vencidos</p>
                <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 mb-0.5 sm:mb-1 leading-tight">
                  {stats.prestamosVencidos}
                </p>
                <div className="flex items-center text-[9px] sm:text-[10px] md:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 flex-shrink-0" />
                  <span className="truncate">Requieren atención</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-400 to-red-500 p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl shadow-lg flex-shrink-0">
                <AlertTriangle className="text-white w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Intereses Cobrados */}
        <div className="group relative bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="relative p-4 sm:p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-purple-600 uppercase tracking-wider mb-0.5 sm:mb-1">Intereses Cobrados</p>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-1 break-words leading-tight">
                  {formatMoney(stats.interesesGanados)}
                </p>
                <div className="flex items-center text-[9px] sm:text-[10px] md:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 flex-shrink-0" />
                  <span className="truncate">Ganancias realizadas</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-400 to-purple-500 p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl shadow-lg flex-shrink-0">
                <TrendingUp className="text-white w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Resumen Adicional - Optimizado para móvil */}
      <div className="mt-4 sm:mt-6 md:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {/* Resumen de Rentabilidad */}
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 text-white">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg md:text-xl font-bold">Rentabilidad</h2>
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 opacity-80 flex-shrink-0" />
          </div>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-yellow-100 text-xs sm:text-sm md:text-base">Tasa de Retorno</span>
              <span className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold">
                {stats.capitalPrestado > 0 
                  ? ((stats.interesesGanados / stats.capitalPrestado) * 100).toFixed(2)
                  : '0.00'}%
              </span>
            </div>
            <div className="h-2 sm:h-2.5 bg-yellow-400/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min((stats.interesesGanados / (stats.capitalPrestado || 1)) * 100, 100)}%` 
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Resumen de Estado */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-200">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Estado General</h2>
            <div className="flex gap-2">
              <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${stats.prestamosVencidos > 0 ? 'bg-red-500' : 'bg-green-500'} animate-pulse flex-shrink-0`}></div>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 md:space-y-4">
            <div className="flex items-center justify-between p-2 sm:p-2.5 md:p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600 font-medium text-xs sm:text-sm md:text-base">Préstamos Totales</span>
              <span className="text-base sm:text-lg md:text-xl font-bold text-gray-900">{stats.prestamosActivos + stats.prestamosVencidos}</span>
            </div>
            <div className="flex items-center justify-between p-2 sm:p-2.5 md:p-3 bg-emerald-50 rounded-lg">
              <span className="text-emerald-700 font-medium text-xs sm:text-sm md:text-base">En Buen Estado</span>
              <span className="text-base sm:text-lg md:text-xl font-bold text-emerald-700">{stats.prestamosActivos}</span>
            </div>
            {stats.prestamosVencidos > 0 && (
              <div className="flex items-center justify-between p-2 sm:p-2.5 md:p-3 bg-red-50 rounded-lg">
                <span className="text-red-700 font-medium text-xs sm:text-sm md:text-base">Requieren Atención</span>
                <span className="text-base sm:text-lg md:text-xl font-bold text-red-700">{stats.prestamosVencidos}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default Dashboard;
