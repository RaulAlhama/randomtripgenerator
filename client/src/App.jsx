import { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SavedProvider, useSaved } from './context/SavedContext';
import { RoutesProvider } from './context/RoutesContext';
import { useTrip } from './context/TripContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BottomNav from './components/layout/BottomNav';
import TrustBand from './components/layout/TrustBand';
import Hero from './components/hero/Hero';
import CityLanding from './components/hero/CityLanding';
import LegalPage from './components/layout/LegalPage';
import InspirationCarousel from './components/carousel/InspirationCarousel';
import SavedRoutes from './components/trips/SavedRoutes';
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

// /ciudad/* pages: the server injects window.__CITY__ alongside the page's SEO
// content. Without this the app booted its generic homepage on all 48 city URLs,
// so someone who searched "qué visitar en Toledo" from their sofa landed on a
// screen asking for their GPS position.
function cityFromPage() {
  const c = window.__CITY__;
  if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number' || !c.name) return null;
  return c;
}

// /privacidad and /terminos: real URLs that render the legal document as a page.
function legalFromPage() {
  const l = window.__LEGAL__;
  return l === 'privacidad' || l === 'terminos' ? l : null;
}


function AppShell() {
  const { saved } = useSaved();
  const { openSavedRoute } = useTrip();
  // null = closed; otherwise { view, location, radiusKm, sharedSlug } for the
  // deck overlay. A /r/:slug URL opens the shared route directly on load.
  const [explore, setExplore] = useState(() => {
    const slug = sharedSlugFromPath();
    return slug ? { view: 'sitios', location: null, radiusKm: null, sharedSlug: slug } : null;
  });
  // Which bottom-nav section is showing.
  const [tab, setTab] = useState('explorar');
  const exploreOpen = explore !== null;
  // Read once: the page identity doesn't change without a navigation.
  const [city] = useState(cityFromPage);
  const [legal] = useState(legalFromPage);
  // The server answers 404 for URLs that don't exist and flags it here, so the
  // app says so instead of silently showing the homepage under a 404 status.
  const [notFound] = useState(() => window.__NOTFOUND__ === true);

  const openExplore = (view, opts = {}) => {
    track('explore_opened', { view: view || 'sitios' });
    setExplore({ view: view || 'sitios', location: opts.location || null, radiusKm: opts.radiusKm || null });
  };

  const closeExplore = () => {
    // Leaving a shared route: drop /r/:slug so refresh/share-from-here point home.
    if (explore?.sharedSlug) window.history.replaceState(null, '', '/');
    setExplore(null);
  };

  // Reopen a route from the "Rutas" tab: load it into trip state first, then show
  // the overlay with `preloaded` so it renders that route instead of generating
  // a new one.
  const openSavedRouteInOverlay = (route) => {
    openSavedRoute(route);
    setExplore({ view: 'sitios', location: null, radiusKm: null, preloaded: true });
  };

  return (
    <div className="container has-bottom-nav">
      <Header />
      <main>
        {tab === 'explorar' && (legal ? (
          <LegalPage which={legal} />
        ) : city ? (
          <>
            <CityLanding city={city} onExplore={openExplore} />
            <TrustBand />
          </>
        ) : (
          <>
            {notFound && (
              <p className="notfound-notice" role="status">
                Esa página no existe. Te dejamos en la portada.
              </p>
            )}
            <Hero onExplore={openExplore} />
            <TrustBand />
            <InspirationCarousel onExplore={openExplore} />
          </>
        ))}

        {tab === 'rutas' && (
          <div className="tab-view">
            <ErrorBoundary>
              <SavedRoutes onOpenRoute={openSavedRouteInOverlay} onExplore={openExplore} />
            </ErrorBoundary>
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
            preloaded={explore.preloaded || false}
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
            {/* RoutesProvider wraps TripProvider: building a route saves it. */}
            <RoutesProvider>
              <TripProvider>
                <SavedProvider>
                  <AppShell />
                  <Toast />
                </SavedProvider>
              </TripProvider>
            </RoutesProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
