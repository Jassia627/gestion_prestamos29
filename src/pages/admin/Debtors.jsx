import { useState, useEffect, useContext, useMemo, useCallback, memo } from 'react';
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
import { Search, Plus, Edit, Trash2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatMoney } from '../../utils/formatters';
import { useDebounce } from '../../hooks/useDebounce';

const FormModal = memo(({ isOpen, onClose, onSubmit, formData, setFormData, loading, selectedDebtor }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {selectedDebtor ? 'Editar Deudor' : 'Nuevo Deudor'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-600">Nombre Completo</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-600">Teléfono</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-600">Identificación (Opcional)</label>
            <input
              type="text"
              value={formData.identification}
              onChange={(e) => setFormData(prev => ({ ...prev, identification: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </div>
              ) : selectedDebtor ? 'Actualizar' : 'Crear Deudor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

const Debtors = () => {
  const { currentUser } = useContext(AuthContext);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    identification: ''
  });

  // Memoizar la query de deudores
  const debtorsQuery = useMemo(() => {
    if (!currentUser) return null;
    return query(
      collection(db, 'debtors'),
      where('adminId', '==', currentUser.uid)
    );
  }, [currentUser]);

  // Memoizar la query de préstamos
  const loansQuery = useMemo(() => {
    if (!currentUser) return null;
    return query(
      collection(db, 'loans'),
      where('adminId', '==', currentUser.uid)
    );
  }, [currentUser]);

  useEffect(() => {
    const fetchDebtors = async () => {
      if (!currentUser || !debtorsQuery || !loansQuery) return;

      try {
        setLoading(true);
        const querySnapshot = await getDocs(debtorsQuery);
        const debtorsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          totalPrestado: 0,
          prestamosActivos: 0
        }));

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
      } catch (error) {
        toast.error('Error al cargar los deudores');
      } finally {
        setLoading(false);
      }
    };

    fetchDebtors();
  }, [currentUser, debtorsQuery, loansQuery]);

  // Memoizar el filtrado de deudores
  const filteredDebtors = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return debtors;
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return debtors.filter(debtor => 
      debtor.name.toLowerCase().includes(searchLower) ||
      debtor.phone.includes(debouncedSearchTerm) ||
      (debtor.identification && debtor.identification.includes(debouncedSearchTerm))
    );
  }, [debtors, debouncedSearchTerm]);

  const openWhatsAppModal = useCallback((debtor) => {
    setSelectedDebtor(debtor);
    setWhatsappMessage(`Hola ${debtor.name}, le recordamos que tiene un saldo pendiente de pago.`);
    setIsWhatsAppModalOpen(true);
  }, []);

  const sendWhatsAppMessage = useCallback(() => {
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
  }, [selectedDebtor, whatsappMessage]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
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
      setFormData({ name: '', phone: '', identification: '' });
      setSelectedDebtor(null);
      
      // Refetch data
      const querySnapshot = await getDocs(debtorsQuery);
      const debtorsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        totalPrestado: 0,
        prestamosActivos: 0
      }));
      setDebtors(debtorsData);
    } catch (error) {
      toast.error('Error al procesar la operación');
    } finally {
      setLoading(false);
    }
  }, [currentUser, formData, selectedDebtor, debtorsQuery]);

  const handleEdit = useCallback((debtor) => {
    setSelectedDebtor(debtor);
    setFormData({
      name: debtor.name,
      phone: debtor.phone,
      identification: debtor.identification || ''
    });
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (window.confirm('¿Está seguro de eliminar este deudor?')) {
      try {
        await deleteDoc(doc(db, 'debtors', id));
        toast.success('Deudor eliminado exitosamente');
        setDebtors(prev => prev.filter(d => d.id !== id));
      } catch (error) {
        toast.error('Error al eliminar el deudor');
      }
    }
  }, []);

  const WhatsAppModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Enviar Mensaje</h2>
          <button
            onClick={() => setIsWhatsAppModalOpen(false)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-5">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-600">Mensaje para {selectedDebtor?.name}</label>
            <textarea
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              rows="4"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsWhatsAppModalOpen(false)}
              className="px-5 py-2.5 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={sendWhatsAppMessage}
              className="px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
            >
              Enviar WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Gestión de Deudores</h1>
          <p className="text-gray-500">Administra tus deudores y préstamos activos</p>
        </div>
        
        <div className="flex flex-col xs:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition-all"
              placeholder="Buscar deudor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Nuevo Deudor
          </button>
        </div>
      </div>

      {/* Lista de Deudores */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredDebtors.map((debtor) => (
          <div key={debtor.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="p-5 border-b border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{debtor.name}</h3>
                  {debtor.identification && (
                    <p className="text-sm text-gray-500 mt-1">ID: {debtor.identification}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(debtor)}
                    className="p-2 text-gray-400 hover:text-yellow-600 rounded-lg hover:bg-yellow-50 transition-colors"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(debtor.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contacto</p>
                  <p className="font-medium">{debtor.phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Total Prestado</p>
                  <p className="font-semibold text-yellow-600">
                    {formatMoney(debtor.totalPrestado)}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Préstamos Activos</p>
                  <p className="font-semibold text-green-600">{debtor.prestamosActivos}</p>
                </div>
              </div>

              <button
                onClick={() => openWhatsAppModal(debtor)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Enviar Recordatorio
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredDebtors.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="inline-block p-4 bg-yellow-50 rounded-full mb-4">
            <Search className="w-12 h-12 text-yellow-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No se encontraron deudores</h3>
          <p className="text-gray-500">Intenta con otro término de búsqueda o crea un nuevo deudor</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent"></div>
        </div>
      )}

      {/* Modals */}
      {isWhatsAppModalOpen && <WhatsAppModal />}
      <FormModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDebtor(null);
          setFormData({ name: '', phone: '', identification: '' });
        }}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        loading={loading}
        selectedDebtor={selectedDebtor}
      />
    </div>
  );
};

export default Debtors;