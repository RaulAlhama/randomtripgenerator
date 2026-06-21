import { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { TripProvider, useTrip } from './context/TripContext';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SavedProvider, useSaved } from './context/SavedContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BottomNav from './components/layout/BottomNav';
import HowItWorks from './components/layout/HowItWorks';
import TrustBand from './components/layout/TrustBand';
import Hero from './components/hero/Hero';
import StatusCard from './components/ui/StatusCard';
import InspirationCarousel from './components/carousel/InspirationCarousel';
import TripResult from './components/trip/TripResult';
import MyTrips from './components/trips/MyTrips';
import SavedView from './components/saved/SavedView';
import ProfileView from './components/profile/ProfileView';
import Toast from './components/ui/Toast';
import ExploreMode from './components/explore/ExploreMode';
import './styles/explore.css';

// "Rutas" tab: saved trips for logged-in users; otherwise a friendly empty
// state that points back to exploring (MyTrips renders null when not authed).
function RoutesTab({ onExplore }) {
  const { authEnabled, isAuthenticated } = useAuth();
  if (authEnabled && isAuthenticated) return <MyTrips />;
  return (
    <section className="saved-view">
      <h2 className="saved-view-title">Tus rutas</h2>
      <div className="saved-empty">
        <div className="saved-empty-icon" aria-hidden="true">🧭</div>
        <p className="saved-empty-title">Aún no has creado ninguna ruta</p>
        <p className="saved-empty-sub">
          Genera una ruta a pie con los mejores sitios a tu alrededor y aparecerá aquí.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => onExplore('sitios')}>
          Generar mi ruta
        </button>
      </div>
    </section>
  );
}

function AppShell() {
  const { currentTrip, isGenerating } = useTrip();
  const { saved } = useSaved();
  // null = closed; otherwise { view, location, radiusKm } for the deck overlay.
  const [explore, setExplore] = useState(null);
  // Which bottom-nav section is showing.
  const [tab, setTab] = useState('explorar');
  const exploreOpen = explore !== null;
  const hasActiveTrip = Boolean(currentTrip || isGenerating);

  const openExplore = (view, opts = {}) =>
    setExplore({ view: view || 'sitios', location: opts.location || null, radiusKm: opts.radiusKm || null });

  return (
    <div className={`container has-bottom-nav${hasActiveTrip && !exploreOpen ? ' has-trip' : ''}`}>
      <Header />
      <main>
        {tab === 'explorar' && (
          <>
            <Hero onExplore={openExplore} />
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
                <InspirationCarousel onExplore={openExplore} />
              </>
            )}
          </>
        )}

        {tab === 'rutas' && (
          <div className="tab-view">
            <RoutesTab onExplore={openExplore} />
          </div>
        )}

        {tab === 'guardados' && (
          <div className="tab-view">
            <ErrorBoundary>
              <SavedView />
            </ErrorBoundary>
          </div>
        )}

        {tab === 'perfil' && (
          <div className="tab-view">
            <ErrorBoundary>
              <ProfileView />
            </ErrorBoundary>
          </div>
        )}
      </main>
      <Footer />

      <BottomNav active={tab} onChange={setTab} savedCount={saved.length} />

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
              <SavedProvider>
                <AppShell />
                <Toast />
              </SavedProvider>
            </TripProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
