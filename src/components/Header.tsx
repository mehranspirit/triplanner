import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import Avatar from './Avatar';

const ADMIN_EMAIL = 'mehran.rajaian@gmail.com';

const Header: React.FC = () => {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isMainAdmin = !isLoading && user?.email === ADMIN_EMAIL;
  const isAdmin = !isLoading && (user?.isAdmin || isMainAdmin);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getTabClassName = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
      : "text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium";
  };

  const getMobileTabClassName = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "bg-indigo-50 border-indigo-500 text-indigo-700 block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
      : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium";
  };

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/trips" className="flex items-center space-x-2">
                <Logo width={32} height={32} className="flex-shrink-0" />
                <span className="text-xl sm:text-2xl font-bold text-indigo-600">Triplanner</span>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/trips"
                className={getTabClassName('/trips')}
              >
                My Trips
              </Link>
              <Link
                to="/calendar"
                className={getTabClassName('/calendar')}
              >
                Calendar
              </Link>
              <Link
                to="/dream-trips"
                className={getTabClassName('/dream-trips')}
              >
                Dream Trips
              </Link>
              <Link
                to="/activity-log"
                className={getTabClassName('/activity-log')}
              >
                Activity Log
              </Link>
              <Link
                to="/dream-trips"
                className={getTabClassName('/dream-trips')}
              >
                Dream Trips
              </Link>
              {isAdmin && (
                <Link
                  to="/users"
                  className={getTabClassName('/users')}
                >
                  Users
                </Link>
              )}
            </div>
          </div>

          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <div className="ml-3 relative">
              <div>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <span className="sr-only">Open user menu</span>
                  <Avatar 
                    key={`header-avatar-${user?.photoUrl || 'default'}`}
                    photoUrl={user?.photoUrl || null}
                    name={user?.name || ''} 
                    size="sm"
                    className="cursor-pointer"
                  />
                </button>
              </div>

              {isMenuOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                  <div className="px-4 py-2 text-sm text-gray-700">
                    {user?.name}
                  </div>
                  <div className="border-t border-gray-100"></div>
                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? (
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`sm:hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-96' : 'max-h-0 overflow-hidden'}`}>
        <div className="pt-2 pb-3 space-y-1">
          <Link
            to="/trips"
            className={getMobileTabClassName('/trips')}
            onClick={() => setIsMenuOpen(false)}
          >
            My Trips
          </Link>
          <Link
            to="/calendar"
            className={getMobileTabClassName('/calendar')}
            onClick={() => setIsMenuOpen(false)}
          >
            Calendar
          </Link>
          <Link
            to="/dream-trips"
            className={getMobileTabClassName('/dream-trips')}
            onClick={() => setIsMenuOpen(false)}
          >
            Dream Trips
          </Link>
          <Link
            to="/activity-log"
            className={getMobileTabClassName('/activity-log')}
            onClick={() => setIsMenuOpen(false)}
          >
            Activity Log
          </Link>
          <Link
            to="/dream-trips"
            className={getMobileTabClassName('/dream-trips')}
            onClick={() => setIsMenuOpen(false)}
          >
            Dream Trips
          </Link>
          {isAdmin && (
            <Link
              to="/users"
              className={getMobileTabClassName('/users')}
              onClick={() => setIsMenuOpen(false)}
            >
              Users
            </Link>
          )}
        </div>
        <div className="pt-4 pb-3 border-t border-gray-200">
          <div className="flex items-center px-4">
            <div className="flex-shrink-0">
              <Avatar 
                key={`header-mobile-avatar-${user?.photoUrl || 'default'}`}
                photoUrl={user?.photoUrl || null}
                name={user?.name || ''} 
                size="md"
              />
            </div>
            <div className="ml-3">
              <div className="text-base font-medium text-gray-800">
                {user?.name}
              </div>
              <div className="text-sm font-medium text-gray-500">
                {user?.email}
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <Link
              to="/profile"
              className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              onClick={() => setIsMenuOpen(false)}
            >
              Profile Settings
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 