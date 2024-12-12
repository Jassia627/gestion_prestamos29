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
import { Add, Edit, Delete, Phone, Email, LocationOn } from '@mui/icons-material';
import toast from 'react-hot-toast';

const Debtors = () => {
  const { currentUser } = useContext(AuthContext);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    identification: ''
  });
  const [editingId, setEditingId] = useState(null);

  // Cargar deudores del usuario actual
  const fetchDebtors = async () => {
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

  useEffect(() => {
    if (currentUser) {
      fetchDebtors();
    }
  }, [currentUser]);

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const debtorData = {
        ...formData,
        adminId: currentUser.uid,
        createdAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'debtors', editingId), debtorData);
        toast.success('Deudor actualizado exitosamente');
      } else {
        await addDoc(collection(db, 'debtors'), debtorData);
        toast.success('Deudor agregado exitosamente');
      }

      setIsModalOpen(false);
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        identification: ''
      });
      setEditingId(null);
      fetchDebtors();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar la operación');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar deudor
  const handleDelete = async (id) => {
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Deudores</h1>
        <button
          onClick={() => setIsModalOpen(true)}
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
                  onClick={() => {
                    setFormData(debtor);
                    setEditingId(debtor.id);
                    setIsModalOpen(true);
                  }}
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
           
              <p className="flex items-center text-gray-600">
                <LocationOn className="mr-2" /> {debtor.address}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Editar Deudor' : 'Nuevo Deudor'}
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
            
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  required
                />
              </div>
            
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormData({
                      name: '',
                      phone: '',
                      email: '',
                      address: '',
                      identification: '',
                    });
                    setEditingId(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Debtors;