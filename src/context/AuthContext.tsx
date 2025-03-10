import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      try {
        // Check for existing token and user data in localStorage
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        console.log('Stored credentials:', { 
          hasToken: !!storedToken, 
          hasUser: !!storedUser 
        });

        if (!storedToken || !storedUser) {
          console.log('No stored credentials found');
          setIsLoading(false);
          return;
        }

        // Parse stored user first to validate JSON
        let parsedUser: User;
        try {
          parsedUser = JSON.parse(storedUser);
          // Set initial state with stored data
          setToken(storedToken);
          setUser(parsedUser);
        } catch (e) {
          console.error('Failed to parse stored user:', e);
          throw new Error('Invalid stored user data');
        }

        // Validate token with the backend
        console.log('Validating token with backend...');
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/validate`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        console.log('Validation response status:', response.status);

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Validation failed:', {
            status: response.status,
            statusText: response.statusText,
            data: errorData
          });
          throw new Error('Token validation failed');
        }

        const data = await response.json();
        console.log('Validation response data:', data);

        if (data.valid === false) {
          throw new Error('Token is invalid');
        }

        // If we get here, the token is valid
        // Keep using the stored data unless the server explicitly provides new data
        if (data.token) {
          console.log('Updating token from server');
          localStorage.setItem('token', data.token);
          setToken(data.token);
        }

        if (data.user) {
          console.log('Updating user data from server');
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        }

      } catch (error) {
        console.error('Authentication error:', error);
        // Only clear auth data if it's an actual auth error
        if (error instanceof Error && 
            (error.message.includes('token') || error.message.includes('auth'))) {
          console.log('Clearing auth data due to validation error');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, []);

  const login = (newToken: string, newUser: User) => {
    console.log('Logging in with new credentials');
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    console.log('Logging out...');
    // First clear local state
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Then notify the server
    const currentToken = token; // Capture the token before it's cleared
    if (currentToken) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      }).catch(error => {
        console.warn('Logout request failed:', error);
      });
    }
  };

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token,
    isLoading,
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext; 