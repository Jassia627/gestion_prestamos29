import { useState, useEffect, useContext } from 'react';
import { db } from '../../config/firebase';
import { AuthContext } from '../../context/AuthContext';
import { 
  collection, 
  addDoc, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  where 
} from 'firebase/firestore';
import { Search, Add, Edit, Delete, WhatsApp } from '@mui/icons-material';
import toast from 'react-hot-toast';

const Debtors = () => {
  const { currentUser } = useContext(AuthContext);
  const [debtors, setDebtors] = useState([]);
  const [filteredDebtors, setFilteredDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    identification: ''
  });

  // Función para filtrar deudores
  const filterDebtors = (searchText) => {
    const filtered = debtors.filter(debtor => 
      debtor.name.toLowerCase().includes(searchText.toLowerCase()) ||
      debtor.phone.includes(searchText) ||
      (debtor.identification && debtor.identification.includes(searchText))
    );
    setFilteredDebtors(filtered);
  };

  // Cargar deudores
  useEffect(() => {
    fetchDebtors();
  }, [currentUser]);

  const fetchDebtors = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'debtors'),
        where('adminId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const debtorsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        totalPrestado: 0,
        prestamosActivos: 0
      }));

      // Cargar préstamos para cada deudor
      const loansQuery = query(
        collection(db, 'loans'),
        where('adminId', '==', currentUser.uid)
      );
      const loansSnapshot = await getDocs(loansQuery);
      
      loansSnapshot.docs.forEach(doc => {
        const loan = doc.data();
        const debtor = debtorsData.find(d => d.id === loan.debtorId);
        if (debtor) {
          debtor.totalPrestado += Number(loan.amount) || 0;
          if (loan.status === 'active') {
            debtor.prestamosActivos++;
          }
        }
      });

      setDebtors(debtorsData);
      setFilteredDebtors(debtorsData);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los deudores');
    } finally {
      setLoading(false);
    }
  };

  // Funciones para WhatsApp
  const openWhatsAppModal = (debtor) => {
    setSelectedDebtor(debtor);
    setWhatsappMessage(`Hola ${debtor.name}, le recordamos que tiene un saldo pendiente de pago.`);
    setIsWhatsAppModalOpen(true);
  };

  const sendWhatsAppMessage = () => {
    if (!selectedDebtor) return;
    
    let cleanPhone = selectedDebtor.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone.startsWith('57')) {
      cleanPhone = '57' + cleanPhone;
    }
    
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
    
    setIsWhatsAppModalOpen(false);
    setSelectedDebtor(null);
    setWhatsappMessage('');
  };

  // Funciones CRUD
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
  
      let phoneNumber = formData.phone.replace(/[^0-9]/g, '');
      if (!phoneNumber.startsWith('57')) {
        phoneNumber = '57' + phoneNumber;
      }
  
      const debtorData = {
        ...formData,
        phone: phoneNumber,
        adminId: currentUser.uid,
        createdAt: new Date().toISOString()
      };

      if (selectedDebtor) {
        await updateDoc(doc(db, 'debtors', selectedDebtor.id), debtorData);
        toast.success('Deudor actualizado exitosamente');
      } else {
        await addDoc(collection(db, 'debtors'), debtorData);
        toast.success('Deudor agregado exitosamente');
      }

      setIsModalOpen(false);
      setSelectedDebtor(null);
      setFormData({
        name: '',
        phone: '',
        identification: ''
      });
      fetchDebtors();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar la operación');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (debtor) => {
    setSelectedDebtor(debtor);
    setFormData({
      name: debtor.name,
      phone: debtor.phone,
      identification: debtor.identification || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!currentUser) return;
    
    if (window.confirm('¿Está seguro de eliminar este deudor?')) {
      try {
        await deleteDoc(doc(db, 'debtors', id));
        toast.success('Deudor eliminado exitosamente');
        fetchDebtors();
      } catch (error) {
        toast.error('Error al eliminar el deudor');
      }
    }
  };

  // JSX para el modal de WhatsApp
  const WhatsAppModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Enviar Mensaje de WhatsApp</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje para {selectedDebtor?.name}
            </label>
            <textarea
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              rows="4"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setIsWhatsAppModalOpen(false);
                setSelectedDebtor(null);
                setWhatsappMessage('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={sendWhatsAppMessage}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-500 hover:bg-green-600"
            >
              Enviar WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // JSX para el modal de formulario
  const FormModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">
          {selectedDebtor ? 'Editar Deudor' : 'Nuevo Deudor'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre Completo
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
              required
            />
          </div>

          

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setSelectedDebtor(null);
                setFormData({
                  name: '',
                  phone: '',
                  identification: ''
                });
              }}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
            >
              {loading ? 'Guardando...' : (selectedDebtor ? 'Actualizar' : 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header y Controles */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Gestión de Deudores</h1>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Buscador */}
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
              placeholder="Buscar por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                filterDebtors(e.target.value);
              }}
            />
          </div>

          {/* Botón Nuevo Deudor */}
          <button
            onClick={() => {
              setSelectedDebtor(null);
              setIsModalOpen(true);
            }}
            className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center whitespace-nowrap"
          >
            <Add className="mr-2" /> Nuevo Deudor
          </button>
        </div>
      </div>

      {/* Lista de Deudores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDebtors.map((debtor) => (
          <div key={debtor.id} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Cabecera de la tarjeta */}
            <div className="p-4 bg-yellow-50 border-b">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-gray-900">{debtor.name}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(debtor)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(debtor.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Cuerpo de la tarjeta */}
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Teléfono:</span>
                <span className="font-medium">{debtor.phone}</span>
              </div>
              
              {debtor.identification && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Identificación:</span>
                  <span className="font-medium">{debtor.identification}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Prestado:</span>
                <span className="font-medium text-yellow-600">
                  {new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    minimumFractionDigits: 0
                  }).format(debtor.totalPrestado)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Préstamos Activos:</span>
                <span className="font-medium text-green-600">{debtor.prestamosActivos}</span>
              </div>

              {/* Botón de WhatsApp */}
              <button
                onClick={() => openWhatsAppModal(debtor)}
                className="mt-4 w-full bg-green-500 text-white rounded-lg py-2 px-4 flex items-center justify-center hover:bg-green-600 transition-colors"
              >
                <WhatsApp className="mr-2" />
                Enviar WhatsApp
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Mensaje cuando no hay resultados */}
      {filteredDebtors.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-gray-500">No se encontraron deudores que coincidan con la búsqueda</p>
        </div>
      )}

      {/* Spinner de carga */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
        </div>
      )}

      {/* Modal de WhatsApp */}
      {isWhatsAppModalOpen && selectedDebtor && <WhatsAppModal />}

      {/* Modal de Formulario */}
      {isModalOpen && <FormModal />}
    </div>
  );
};

export default Debtors;