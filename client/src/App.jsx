import { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SavedProvider, useSaved } from './context/SavedContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BottomNav from './components/layout/BottomNav';
import TrustBand from './components/layout/TrustBand';
import Hero from './components/hero/Hero';
import InspirationCarousel from './components/carousel/InspirationCarousel';
import MyTrips from './components/trips/MyTrips';
import SavedView from './components/saved/SavedView';
import ProfileView from './components/profile/ProfileView';
import Toast from './components/ui/Toast';
import ExploreMode from './components/explore/ExploreMode';
import { track } from './services/analytics';
import './styles/explore.css';

// /r/:slug = a shared route link; open it straight into the route view.
function sharedSlugFromPath() {
  const m = window.location.pathname.match(/^\/r\/([A-Za-z0-9_-]{4,16})$/);
  return m ? m[1] : null;
}

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
  const { saved } = useSaved();
  // null = closed; otherwise { view, location, radiusKm, sharedSlug } for the
  // deck overlay. A /r/:slug URL opens the shared route directly on load.
  const [explore, setExplore] = useState(() => {
    const slug = sharedSlugFromPath();
    return slug ? { view: 'sitios', location: null, radiusKm: null, sharedSlug: slug } : null;
  });
  // Which bottom-nav section is showing.
  const [tab, setTab] = useState('explorar');
  const exploreOpen = explore !== null;

  const openExplore = (view, opts = {}) => {
    track('explore_opened', { view: view || 'sitios' });
    setExplore({ view: view || 'sitios', location: opts.location || null, radiusKm: opts.radiusKm || null });
  };

  const closeExplore = () => {
    // Leaving a shared route: drop /r/:slug so refresh/share-from-here point home.
    if (explore?.sharedSlug) window.history.replaceState(null, '', '/');
    setExplore(null);
  };

  return (
    <div className="container has-bottom-nav">
      <Header />
      <main>
        {tab === 'explorar' && (
          <>
            <Hero onExplore={openExplore} />
            <TrustBand />
            <InspirationCarousel onExplore={openExplore} />
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
            sharedSlug={explore.sharedSlug || null}
            onClose={closeExplore}
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
