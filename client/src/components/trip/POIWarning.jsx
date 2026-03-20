import { useTrip } from '../../context/TripContext';

export default function POIWarning() {
  const { currentTrip } = useTrip();

  if (currentTrip?.poiSource !== 'llm') return null;

  return (
    <p className="poi-source-warning">
      Los lugares de esta ruta fueron generados por IA y podr&iacute;an no ser exactos. Verifica antes de visitarlos.
    </p>
  );
}
