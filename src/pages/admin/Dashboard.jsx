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
      const tasaInteres = parseFloat(loan.interestRate) || 0;
      
      if (loan.isIndefinite) {
        // Para préstamos indefinidos, calculamos los meses transcurridos
        const startDate = new Date(loan.startDate);
        const today = new Date();
        let mesesTranscurridos = (today.getFullYear() - startDate.getFullYear()) * 12;
        mesesTranscurridos += today.getMonth() - startDate.getMonth();
        
        // Ajuste por día del mes
        if (today.getDate() < startDate.getDate()) {
          mesesTranscurridos--;
        }

        // Asegurarnos de que no sea negativo
        mesesTranscurridos = Math.max(0, mesesTranscurridos);
        
        // Calcular interés mensual y multiplicar por los meses transcurridos
        const interesMensual = (monto * tasaInteres) / 100;
        const interesTotal = interesMensual * mesesTranscurridos;
        
        return interesTotal;

      } else {
        // Para préstamos a plazo fijo
        const termino = parseInt(loan.term) || 0;
        const interesMensual = (monto * tasaInteres) / 100;
        const interesTotal = interesMensual * termino;
        
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Panel de Control Financiero</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Capital Prestado */}
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600 uppercase tracking-wide">Capital Prestado</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {formatMoney(stats.capitalPrestado)}
              </p>
              <div className="mt-2 flex items-center text-sm text-yellow-700">
                <DollarSign className="w-4 h-4 mr-1" />
                <span>Sin intereses</span>
              </div>
            </div>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <DollarSign className="text-yellow-600 w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Intereses Totales */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 uppercase tracking-wide">Intereses Totales</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {formatMoney(stats.interesesTotales)}
              </p>
              <div className="mt-2 flex items-center text-sm text-green-700">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span>Cobrados: {formatMoney(stats.interesesGanados)}</span>
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <Calculator className="text-green-600 w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Total con Intereses */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Total Esperado</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {formatMoney(stats.capitalPrestado + stats.interesesTotales)}
              </p>
              <div className="mt-2 flex items-center text-sm text-blue-700">
                <Building2 className="w-4 h-4 mr-1" />
                <span>Capital + Intereses</span>
              </div>
            </div>
            <div className="bg-blue-100 p-4 rounded-lg">
              <Building2 className="text-blue-600 w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Préstamos Activos */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide">Préstamos Activos</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {stats.prestamosActivos}
              </p>
              <div className="mt-2 flex items-center text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                <span>En buen estado</span>
              </div>
            </div>
            <div className="bg-emerald-100 p-4 rounded-lg">
              <CheckCircle2 className="text-emerald-600 w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Préstamos Vencidos */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600 uppercase tracking-wide">Préstamos Vencidos</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {stats.prestamosVencidos}
              </p>
              <div className="mt-2 flex items-center text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 mr-1" />
                <span>Requieren atención</span>
              </div>
            </div>
            <div className="bg-red-100 p-4 rounded-lg">
              <AlertTriangle className="text-red-600 w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Intereses Cobrados */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600 uppercase tracking-wide">Intereses Cobrados</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {formatMoney(stats.interesesGanados)}
              </p>
              <div className="mt-2 flex items-center text-sm text-purple-700">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span>Ganancias realizadas</span>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <TrendingUp className="text-purple-600 w-8 h-8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
