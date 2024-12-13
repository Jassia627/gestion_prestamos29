import { useState, useEffect, useContext } from 'react';
import { db } from '../../config/firebase';
import { AuthContext } from '../../context/AuthContext';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { 
  AttachMoney, 
  Calculate,
  AccountBalance,
  CheckCircle,
  Warning,
  TrendingUp 
} from '@mui/icons-material';

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

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

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
        
        console.log(`Préstamo indefinido:
          Monto: ${monto}
          Tasa: ${tasaInteres}%
          Meses: ${mesesTranscurridos}
          Interés mensual: ${interesMensual}
          Interés total: ${interesTotal}`);
        
        return interesTotal;

      } else {
        // Para préstamos a plazo fijo
        const termino = parseInt(loan.term) || 0;
        const interesMensual = (monto * tasaInteres) / 100;
        const interesTotal = interesMensual * termino;
        
        console.log(`Préstamo fijo:
          Monto: ${monto}
          Tasa: ${tasaInteres}%
          Término: ${termino}
          Interés mensual: ${interesMensual}
          Interés total: ${interesTotal}`);
        
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
      if (!currentUser) return;

      try {
          setLoading(true);
          const q = query(
              collection(db, 'loans'),
              where('adminId', '==', currentUser.uid)
          );

          const querySnapshot = await getDocs(q);
          const loansData = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
          }));

          console.log('Préstamos cargados:', loansData);

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
}, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  // Mostrar los datos crudos en modo desarrollo
  console.log('Stats calculados:', stats);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Capital Prestado */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AttachMoney className="text-yellow-600 mr-4 text-4xl" />
            <div>
              <p className="text-gray-500 text-sm">Capital Prestado</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatMoney(stats.capitalPrestado)}
              </p>
              <p className="text-sm text-gray-500">Sin intereses</p>
            </div>
          </div>
        </div>

        {/* Intereses */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Calculate className="text-green-600 mr-4 text-4xl" />
            <div>
              <p className="text-gray-500 text-sm">Total Intereses</p>
              <p className="text-2xl font-bold text-green-600">
                {formatMoney(stats.interesesTotales)}
              </p>
              <p className="text-sm text-green-500">
                Cobrados: {formatMoney(stats.interesesGanados)}
              </p>
            </div>
          </div>
        </div>

        {/* Total con Intereses */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AccountBalance className="text-blue-600 mr-4 text-4xl" />
            <div>
              <p className="text-gray-500 text-sm">Total</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatMoney(stats.capitalPrestado + stats.interesesTotales)}
              </p>
              <p className="text-sm text-gray-500">Capital + Intereses</p>
            </div>
          </div>
        </div>
      </div>

      {/* Segunda fila */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Préstamos Activos */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CheckCircle className="text-green-600 mr-4 text-4xl" />
            <div>
              <p className="text-gray-500 text-sm">Préstamos Activos</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.prestamosActivos}
              </p>
              <p className="text-sm text-gray-500">En curso</p>
            </div>
          </div>
        </div>

        {/* Préstamos Vencidos */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Warning className="text-red-600 mr-4 text-4xl" />
            <div>
              <p className="text-gray-500 text-sm">Préstamos Vencidos</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.prestamosVencidos}
              </p>
              <p className="text-sm text-gray-500">Atrasados</p>
            </div>
          </div>
        </div>

        {/* Intereses Cobrados */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="text-purple-600 mr-4 text-4xl" />
            <div>
              <p className="text-gray-500 text-sm">Intereses Cobrados</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatMoney(stats.interesesGanados)}
              </p>
              <p className="text-sm text-gray-500">Ya pagados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Debug - Solo visible en desarrollo */}
     
    </div>
  );
};

export default Dashboard;
