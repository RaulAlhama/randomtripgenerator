import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { TripProvider, useTrip } from './context/TripContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HowItWorks from './components/layout/HowItWorks';
import Hero from './components/hero/Hero';
import StatusCard from './components/ui/StatusCard';
import InspirationCarousel from './components/carousel/InspirationCarousel';
import TripResult from './components/trip/TripResult';
import MyTrips from './components/trips/MyTrips';
import Toast from './components/ui/Toast';

function AppShell() {
  const { currentTrip, isGenerating } = useTrip();
  const hasActiveTrip = Boolean(currentTrip || isGenerating);

  return (
    <div className={`container${hasActiveTrip ? ' has-trip' : ''}`}>
      <Header />
      <main>
        <Hero />
        <StatusCard />
        <ErrorBoundary>
          <TripResult />
        </ErrorBoundary>
        {!hasActiveTrip && (
          <>
            <HowItWorks />
            <InspirationCarousel />
            <MyTrips />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <TripProvider>
            <AppShell />
            <Toast />
          </TripProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
