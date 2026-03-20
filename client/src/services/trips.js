export async function saveTrip(tripData, token) {
  const response = await fetch('/api/trips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(tripData),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al guardar el viaje');
  }
  return response.json();
}

export async function loadTrips(token) {
  const response = await fetch('/api/trips', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al cargar los viajes');
  }
  return response.json();
}

export async function deleteTrip(id, token) {
  const response = await fetch(`/api/trips/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al eliminar el viaje');
  }
  return response.json();
}
