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
import { 
  Add, 
  Edit, 
  Delete, 
  Phone, 
  Email, 
  LocationOn,
  WhatsApp 
} from '@mui/icons-material';
import toast from 'react-hot-toast';

const Debtors = () => {
  const { currentUser } = useContext(AuthContext);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    identification: ''
  });

  // Función para enviar mensaje por WhatsApp
  const openWhatsAppModal = (debtor) => {
    setSelectedDebtor(debtor);
    // Mensaje predeterminado
    setWhatsappMessage(`Hola ${debtor.name}, le recordamos que tiene un saldo pendiente de pago.`);
    setIsWhatsAppModalOpen(true);
  };

// Modifica la función sendWhatsAppMessage:
const sendWhatsAppMessage = () => {
  if (!selectedDebtor) return;
  
  // Limpiar el número de teléfono y agregar prefijo
  let cleanPhone = selectedDebtor.phone.replace(/[^0-9]/g, '');
  
  // Si el número no empieza con 57, agregarlo
  if (!cleanPhone.startsWith('57')) {
    cleanPhone = '57' + cleanPhone;
  }
  
  // Añadir el + al inicio
  const phoneWithPrefix = '+' + cleanPhone;
  
  // Crear la URL de WhatsApp
  const whatsappUrl = `https://wa.me/${phoneWithPrefix}?text=${encodeURIComponent(whatsappMessage)}`;
  
  // Abrir WhatsApp
  window.open(whatsappUrl, '_blank');
  
  // Cerrar el modal
  setIsWhatsAppModalOpen(false);
  setSelectedDebtor(null);
  setWhatsappMessage('');
};

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
        ...doc.data()
      }));
      setDebtors(debtorsData);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los deudores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
  
      // Validar y formatear el número de teléfono
      let phoneNumber = formData.phone.replace(/[^0-9]/g, '');
      if (!phoneNumber.startsWith('57')) {
        phoneNumber = '57' + phoneNumber;
      }
  
      const debtorData = {
        ...formData,
        phone: phoneNumber, // Guardamos el número ya formateado
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
        email: '',
        address: '',
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
      email: debtor.email,
      address: debtor.address,
      identification: debtor.identification
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Deudores</h1>
        <button
          onClick={() => {
            setSelectedDebtor(null);
            setFormData({
              name: '',
              phone: '',
              email: '',
              address: '',
              identification: ''
            });
            setIsModalOpen(true);
          }}
          className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <Add className="mr-2" /> Nuevo Deudor
        </button>
      </div>

      {/* Lista de Deudores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {debtors.map((debtor) => (
          <div key={debtor.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold">{debtor.name}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(debtor)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit />
                </button>
                <button
                  onClick={() => handleDelete(debtor.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Delete />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="flex items-center text-gray-600">
                <Phone className="mr-2" /> {debtor.phone}
              </p>
              
             
            </div>
            <div className="mt-4">
              <button
                onClick={() => openWhatsAppModal(debtor)}
                className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <WhatsApp className="mr-2" />
                Enviar WhatsApp
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Formulario */}
      {isModalOpen && (
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
                      email: '',
                      address: '',
                      identification: ''
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de WhatsApp */}
      {isWhatsAppModalOpen && selectedDebtor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Enviar Mensaje de WhatsApp</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje para {selectedDebtor.name}
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
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Enviar WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Debtors;