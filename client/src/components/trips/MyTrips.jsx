import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { loadTrips, deleteTrip as apiDeleteTrip } from '../../services/trips';
import TripCard from './TripCard';

export default function MyTrips() {
  const { isAuthenticated, getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) return;
      const data = await loadTrips(token);
      setTrips(data);
    } catch (error) {
      console.error('Error al cargar viajes:', error);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTrips();
    }
  }, [isAuthenticated, fetchTrips]);

  const handleDelete = useCallback(async (id) => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await apiDeleteTrip(id, token);
      showToast('Viaje eliminado', 'success');
      fetchTrips();
    } catch (error) {
      showToast('No se pudo eliminar el viaje', 'error');
    }
  }, [getAccessToken, showToast, fetchTrips]);

  if (!isAuthenticated) return null;

  return (
    <section className="my-trips">
      <div className="section-header">
        <h2>Mis Viajes</h2>
      </div>
      {loading && trips.length === 0 ? (
        <p>Cargando viajes...</p>
      ) : trips.length === 0 ? (
        <p className="no-trips-msg">
          A&uacute;n no tienes viajes guardados. &iexcl;Genera y guarda tu primera ruta!
        </p>
      ) : (
        <div className="trips-grid">
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
