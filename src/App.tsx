import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Header from './components/Header';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import TripList from './components/TripList';
import TripDetails from './components/TripDetails';
import UserProfile from './components/UserProfile';
import { UserList } from './components/UserList';

const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
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
            
            {/* Protected routes */}
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
              path="/trip/:id"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <TripDetails />
                  </AuthenticatedLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <AuthenticatedLayout>
                    <UserList />
                  </AuthenticatedLayout>
                </ProtectedRoute>
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
            
            {/* Redirect root to trips */}
            <Route path="/" element={<Navigate to="/trips" replace />} />
          </Routes>
        </TripProvider>
      </AuthProvider>
    </Router>
  );
};

export default App; 