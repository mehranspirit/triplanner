import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingAnimation from '../LoadingAnimation';
import { getPostAuthRedirectPath } from '../../utils/tripInvite';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');

        if (!token) {
          throw new Error('No token received');
        }

        // Validate the token and get user data
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/validate`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Token validation failed');
        }

        const data = await response.json();
        login(token, data.user);

        const returnUrl = getPostAuthRedirectPath(location.state as { from?: { pathname?: string; search?: string } });
        navigate(returnUrl, { replace: true });
      } catch (error) {
        console.error('Authentication error:', error);
        navigate('/login', { 
          replace: true,
          state: { error: 'Authentication failed. Please try again.' }
        });
      }
    };

    handleCallback();
  }, [navigate, location, login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-500/20 to-purple-500/20">
      <div className="text-center">
        <LoadingAnimation />
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback; 