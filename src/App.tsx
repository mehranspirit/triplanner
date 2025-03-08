import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TripProvider } from './context/TripContext';
import TripList from './components/TripList';
import TripDetails from './components/TripDetails';

function App() {
  return (
    <TripProvider>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <h1 className="text-3xl font-bold text-gray-900">Trip Planner</h1>
            </div>
          </header>
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<TripList />} />
              <Route path="/trip/:id" element={<TripDetails />} />
            </Routes>
          </main>
        </div>
      </Router>
    </TripProvider>
  );
}

export default App; 