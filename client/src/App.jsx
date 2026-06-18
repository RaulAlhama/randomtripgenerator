import { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { TripProvider, useTrip } from './context/TripContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HowItWorks from './components/layout/HowItWorks';
import TrustBand from './components/layout/TrustBand';
import Hero from './components/hero/Hero';
import StatusCard from './components/ui/StatusCard';
import InspirationCarousel from './components/carousel/InspirationCarousel';
import TripResult from './components/trip/TripResult';
import MyTrips from './components/trips/MyTrips';
import Toast from './components/ui/Toast';
import ExploreMode from './components/explore/ExploreMode';
import './styles/explore.css';

function AppShell() {
  const { currentTrip, isGenerating } = useTrip();
  // null = closed; otherwise { view, location, radiusKm } for the deck overlay.
  const [explore, setExplore] = useState(null);
  const exploreOpen = explore !== null;
  const hasActiveTrip = Boolean(currentTrip || isGenerating);

  return (
    <div className={`container${hasActiveTrip && !exploreOpen ? ' has-trip' : ''}`}>
      <Header />
      <main>
        <Hero
          onExplore={(view, opts = {}) =>
            setExplore({ view: view || 'sitios', location: opts.location || null, radiusKm: opts.radiusKm || null })
          }
        />
        {/* While explore mode is open it owns the trip state — keep the
            page-level trip UI unmounted so two Leaflet maps never coexist. */}
        {!exploreOpen && (
          <>
            <StatusCard />
            <ErrorBoundary>
              <TripResult />
            </ErrorBoundary>
          </>
        )}
        {(!hasActiveTrip || exploreOpen) && (
          <>
            <TrustBand />
            <HowItWorks />
            <InspirationCarousel />
            <MyTrips />
          </>
        )}
      </main>
      <Footer />
      {exploreOpen && (
        <ErrorBoundary>
          <ExploreMode
            initialView={explore.view}
            initialLocation={explore.location}
            initialRadiusKm={explore.radiusKm}
            onClose={() => setExplore(null)}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <TripProvider>
              <AppShell />
              <Toast />
            </TripProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
