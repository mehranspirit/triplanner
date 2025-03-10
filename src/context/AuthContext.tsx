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

        if (!storedToken || !storedUser) {
          setIsLoading(false);
          return;
        }

        // Validate token with the backend
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/validate`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'Cache-Control': 'no-cache'
          },
          credentials: 'include' // Include cookies in the request
        });

        if (!response.ok) {
          throw new Error('Invalid token');
        }

        // Get the refreshed user data from the response
        const data = await response.json();
        
        // Update the token if a new one was provided
        const newToken = data.token || storedToken;
        
        // Update localStorage with potentially refreshed data
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(data.user || JSON.parse(storedUser)));

        // Update state with the latest data
        setToken(newToken);
        setUser(data.user || JSON.parse(storedUser));
      } catch (error) {
        console.warn('Token validation failed:', error);
        // Clear all auth data on validation failure
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    // Clear all auth data
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Call logout endpoint to invalidate the token on the server
    fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include'
    }).catch(error => {
      console.warn('Logout request failed:', error);
    });
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