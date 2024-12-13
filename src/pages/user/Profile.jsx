import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

const Profile = () => {
  const { currentUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [originalData, setOriginalData] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setOriginalData(data);
        }
      } catch (error) {
        toast.error('Error al cargar los datos del usuario');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchUserData();
    }
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), userData);
      setOriginalData(userData);
      toast.success('Perfil actualizado exitosamente');
      setIsEditing(false);
    } catch (error) {
      toast.error('Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCancel = () => {
    setUserData(originalData);
    setIsEditing(false);
  };

  const hasChanges = () => {
    return JSON.stringify(userData) !== JSON.stringify(originalData);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 text-2xl font-bold">
              {userData.firstName?.[0]}{userData.lastName?.[0]}
            </div>
            <div className="text-white">
              <h1 className="text-3xl font-semibold">Perfil</h1>
              <p className="text-yellow-200 text-sm">Gestiona tu información personal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="bg-white text-yellow-600 px-4 py-2 rounded-lg shadow-md hover:bg-yellow-50 transition duration-150">
            {isEditing ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  type="text"
                  name="firstName"
                  value={userData.firstName}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={`w-full p-3 border rounded-lg transition duration-150 ${
                    isEditing
                      ? 'focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
                      : 'bg-gray-100'
                  }`}
                />
              </div>

              {/* Apellido */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Apellido</label>
                <input
                  type="text"
                  name="lastName"
                  value={userData.lastName}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={`w-full p-3 border rounded-lg transition duration-150 ${
                    isEditing
                      ? 'focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
                      : 'bg-gray-100'
                  }`}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={userData.email}
                  disabled
                  className="w-full p-3 border rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                <input
                  type="tel"
                  name="phone"
                  value={userData.phone || ''}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={`w-full p-3 border rounded-lg transition duration-150 ${
                    isEditing
                      ? 'focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500'
                      : 'bg-gray-100'
                  }`}
                />
              </div>
            </div>

            {/* Save Button */}
            {isEditing && (
              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !hasChanges()}
                  className={`px-6 py-2 bg-yellow-600 text-white rounded-lg shadow-md hover:bg-yellow-700 transition duration-150 ${
                    saving || !hasChanges() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                      Guardando...
                    </span>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
