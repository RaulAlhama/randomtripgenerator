import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Hero from './components/hero/Hero';
import StatusCard from './components/ui/StatusCard';
import InspirationCarousel from './components/carousel/InspirationCarousel';
import TripResult from './components/trip/TripResult';
import MyTrips from './components/trips/MyTrips';
import Toast from './components/ui/Toast';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <TripProvider>
          <div className="container">
            <Header />
            <main>
              <Hero />
              <StatusCard />
              <InspirationCarousel />
              <TripResult />
              <MyTrips />
            </main>
            <Footer />
          </div>
          <Toast />
        </TripProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
