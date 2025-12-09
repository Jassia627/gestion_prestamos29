import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Hook personalizado para queries de Firestore con caché
 * @param {string} collectionName - Nombre de la colección
 * @param {Array} conditions - Array de condiciones where
 * @param {string} userId - ID del usuario (para filtrar por adminId)
 * @param {boolean} enabled - Si la query debe ejecutarse
 * @returns {Object} { data, loading, error, refetch }
 */
export const useFirestoreQuery = (collectionName, conditions = [], userId = null, enabled = true) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoizar la query para evitar recrearla en cada render
  const firestoreQuery = useMemo(() => {
    if (!enabled) return null;
    
    let q = collection(db, collectionName);
    
    // Agregar filtro por userId si se proporciona
    if (userId) {
      q = query(q, where('adminId', '==', userId));
    }
    
    // Agregar condiciones adicionales
    conditions.forEach(condition => {
      q = query(q, where(condition.field, condition.operator, condition.value));
    });
    
    return q;
  }, [collectionName, userId, enabled, JSON.stringify(conditions)]);

  const fetchData = async () => {
    if (!firestoreQuery) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const querySnapshot = await getDocs(firestoreQuery);
      const docsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setData(docsData);
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled && firestoreQuery) {
      fetchData();
    }
  }, [firestoreQuery, enabled]);

  return { data, loading, error, refetch: fetchData };
};

