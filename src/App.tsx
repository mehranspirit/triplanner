import React from 'react';
import { registerSW } from 'virtual:pwa-register';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TripProvider, useTrip } from './context/TripContext';
import { ExpenseProvider } from './context/ExpenseContext';
import { EventProvider } from './contexts/EventContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import Header from './components/Header';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import TripList from './components/TripList';
import UserProfile from './components/UserProfile';
import { UserList } from './components/UserList';
import Calendar from './components/Calendar';
import { Link, NavLink } from 'react-router-dom';
import ActivityLogPage from './pages/ActivityLogPage';
import AuthCallback from './components/auth/AuthCallback';
import ExpensesPage from './pages/ExpensesPage';
import { DreamTripsPage } from './pages/DreamTripsPage';
import DreamTripDetails from './components/DreamTripDetails';
import NewTripDetails from './components/TripDetails/NewTripDetails';
import TripInviteAccept from './components/TripInviteAccept';
import { OfflineIndicator } from './components/OfflineIndicator';
import { networkAwareApi } from './services/networkAwareApi';
import { MapViewChromeProvider, useMapViewChromeOptional } from './context/MapViewChromeContext';

// Import the registry first
import './eventTypes/registry';

// Then import all specific event type specs to trigger registration
import './eventTypes/flightSpec';
import './eventTypes/staySpec';
import './eventTypes/activitySpec';
import './eventTypes/trainSpec';
import './eventTypes/busSpec';
import './eventTypes/rentalCarSpec';
import './eventTypes/destinationSpec';
import './eventTypes/arrivalSpec';
import './eventTypes/departureSpec';

const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mapChrome = useMapViewChromeOptional();

  return (
    <div className="min-h-screen bg-gray-100">
      {!mapChrome?.hideAppChrome && <Header />}
      <main className={mapChrome?.hideAppChrome ? 'min-h-screen' : 'max-w-7xl mx-auto py-4 px-4 sm:py-6 sm:px-6 lg:px-8'}>
        {children}
      </main>
    </div>
  );
};

const ExpensesPageWrapper: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { state } = useTrip();
  const trip = state.trips.find(t => t._id === tripId);

  if (state.loading) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        <p className="text-sm text-gray-600">Loading trip expenses...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Trip not found</h2>
        <p className="mt-2 text-sm text-gray-600">
          This trip may have been removed, or you may not have access to it.
        </p>
        <Link to="/trips" className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-800">
          Back to trips
        </Link>
      </div>
    );
  }

  return (
    <EventProvider initialEvents={trip.events}>
    <ExpenseProvider tripId={tripId!}>
      <ExpensesPage />
    </ExpenseProvider>
    </EventProvider>
  );
};

const App: React.FC = () => {
  const [isAppInitialized, setIsAppInitialized] = React.useState(false);
  const initRef = React.useRef(false);

  // Initialize app with cache-first strategy
  React.useEffect(() => {
    // Prevent duplicate initialization in React Strict Mode
    if (initRef.current) return;
    initRef.current = true;
    
    const initializeApp = async () => {
      try {
        
        // Add timeout safety mechanism
        const initTimeout = setTimeout(() => {
          console.warn('⚠️ App initialization timeout, continuing anyway...');
          setIsAppInitialized(true);
        }, 5000); // 5 second timeout
        
        // Register service worker via Vite PWA (icons + offline shell)
        registerSW({
          immediate: true,
          onNeedRefresh() {
            showUpdateAvailable();
          },
        });
        
        // Initialize network-aware API with cache (don't depend on service worker)
        await networkAwareApi.initializeAppWithCache();
        
        // Clear timeout since we completed successfully
        clearTimeout(initTimeout);
        setIsAppInitialized(true);
      } catch (error) {
        console.error('❌ App initialization failed:', error);
        // Always allow app to continue even if initialization fails
        setIsAppInitialized(true);
      }
    };

    initializeApp();
  }, []);

  const showUpdateAvailable = () => {
    // Simple update notification - could be enhanced with a toast/notification component
    if (window.confirm('A new version is available. Refresh to update?')) {
      window.location.reload();
    }
  };

  // Show minimal loading only during initial service worker setup
  if (!isAppInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing offline support...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <AuthProvider>
        <MapViewChromeProvider>
        <TripProvider>
          <OfflineIndicator />
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/trips/invite/:token" element={<TripInviteAccept />} />
            
            {/* Protected routes */}
            <Route
              path="/trips/dream/:id"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <DreamTripDetails />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips/:id"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <NewTripDetails />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <TripList />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <AuthenticatedLayout>
                    <UserList />
                  </AuthenticatedLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UserProfile />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <Calendar />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity-log"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <ActivityLogPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dream-trips"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <DreamTripsPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips/:tripId/activity-log"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <ActivityLogPage />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips/:tripId/expenses"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <ExpensesPageWrapper />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            
            {/* Redirect root to trips */}
            <Route path="/" element={<Navigate to="/trips" replace />} />
          </Routes>
        </TripProvider>
        </MapViewChromeProvider>
      </AuthProvider>
    </Router>
  );
};

export default App; 