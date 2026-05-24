import { useEffect, useRef } from 'react';
import { useTrip } from '../../context/TripContext';
import TripHeader from './TripHeader';
import POIWarning from './POIWarning';
import WeatherWidget from './WeatherWidget';
import MapView from './MapView';
import PlacesPanel from './PlacesPanel';
import CandidateReview from './CandidateReview';
import TripSkeleton from './TripSkeleton';

export default function TripResult() {
  const { currentTrip, isGenerating, stage } = useTrip();
  const wrapperRef = useRef(null);
  const lastTripKeyRef = useRef(null);
  const scrolledForGenerationRef = useRef(false);

  // Scroll to skeleton as soon as generation starts so the user sees feedback
  // without having to scroll down manually.
  useEffect(() => {
    if (isGenerating && !scrolledForGenerationRef.current && wrapperRef.current) {
      scrolledForGenerationRef.current = true;
      wrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isGenerating]);

  // Re-scroll once the real trip arrives. Key off origin coords so route/weather
  // updates on the same trip don't re-trigger the scroll.
  useEffect(() => {
    if (!currentTrip || !wrapperRef.current) return;
    const key = `${currentTrip.origin_lat},${currentTrip.origin_lng},${currentTrip.city || ''}`;
    if (key === lastTripKeyRef.current) return;
    lastTripKeyRef.current = key;
    wrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentTrip]);

  useEffect(() => {
    if (!currentTrip && !isGenerating) {
      lastTripKeyRef.current = null;
      scrolledForGenerationRef.current = false;
    }
  }, [currentTrip, isGenerating]);

  if (!currentTrip && isGenerating) {
    return (
      <section className="trip-result" ref={wrapperRef}>
        <TripSkeleton />
      </section>
    );
  }

  if (!currentTrip) return null;

  return (
    <section className="trip-result" ref={wrapperRef}>
      <TripHeader />
      <WeatherWidget />
      <POIWarning />
      <div className="trip-grid">
        <MapView />
        {stage === 'candidates' ? <CandidateReview /> : <PlacesPanel />}
      </div>
    </section>
  );
}
