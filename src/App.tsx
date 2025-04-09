import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import { ExpenseProvider } from './context/ExpenseContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import Header from './components/Header';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import TripList from './components/TripList';
import TripDetails from './components/TripDetails';
import UserProfile from './components/UserProfile';
import { UserList } from './components/UserList';
import Calendar from './components/Calendar';
import { Link, NavLink } from 'react-router-dom';
import ActivityLogPage from './pages/ActivityLogPage';
import AuthCallback from './components/auth/AuthCallback';
import ExpensesPage from './pages/ExpensesPage';
import { DreamTripsPage } from './pages/DreamTripsPage';
import DreamTripDetails from './components/DreamTripDetails';

const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-7xl mx-auto py-4 px-4 sm:py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

const ExpensesPageWrapper: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  return (
    <ExpenseProvider tripId={tripId!}>
      <ExpensesPage />
    </ExpenseProvider>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <TripProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
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
                    <TripDetails />
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
      </AuthProvider>
    </Router>
  );
};

export default App; 