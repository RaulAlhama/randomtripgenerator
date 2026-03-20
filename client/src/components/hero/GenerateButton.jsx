import { useTrip } from '../../context/TripContext';

export default function GenerateButton() {
  const { isGenerating, generateTrip } = useTrip();

  return (
    <button
      className="btn btn-primary btn-glow"
      onClick={generateTrip}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <>
          <span className="spinner"></span>
          Generando...
        </>
      ) : (
        '✨ Generar Mi Ruta'
      )}
    </button>
  );
}
