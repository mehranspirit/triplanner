import * as React from 'react';
import { offlineService } from '../services/offlineService';

interface User {
  _id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  photoUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: User) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const initRef = React.useRef(false);

  React.useEffect(() => {
    // Prevent duplicate initialization in React Strict Mode
    if (initRef.current) return;
    initRef.current = true;
    
    const validateToken = async () => {
      let storedToken: string | null = null;
      let parsedUser: User | null = null;
      
      try {
        storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (!storedToken || !storedUser) {
          setIsLoading(false);
          return;
        }

        try {
          parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          if (parsedUser) {
            await offlineService.ensureCacheForUser(parsedUser._id);
          }
        } catch (e) {
          console.error('Failed to parse stored user:', e);
          throw new Error('Invalid stored user data');
        }

        // Check offline status BEFORE making network request
        if (!navigator.onLine) {
          setToken(storedToken);
          setUser(parsedUser);
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/validate`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Token validation failed');
        }

        const data = await response.json();

        if (data.valid === false) {
          throw new Error('Token is invalid');
        }

        if (data.token) {
          localStorage.setItem('token', data.token);
          setToken(data.token);
        }

        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
          await offlineService.ensureCacheForUser(data.user._id);
        }

      } catch (error: any) {
        console.error('Authentication error:', error);
        
        // Handle offline scenarios gracefully
        if (!navigator.onLine) {
          // Keep existing stored credentials when offline
          if (storedToken && parsedUser) {
            setToken(storedToken);
            setUser(parsedUser);
          }
          setIsLoading(false);
          return;
        }
        
        // Only clear credentials for actual auth errors when online
        if (error instanceof Error && 
            (error.message.includes('token') || error.message.includes('auth'))) {
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

  const login = async (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    await offlineService.ensureCacheForUser(newUser._id);
  };

  const logout = async () => {
    const currentToken = token;
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    await offlineService.clearCache();
    
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

  const updateUser = (updatedUser: User) => {
    const newUser = { ...updatedUser };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const value = {
    user,
    token,
    login,
    logout,
    updateUser,
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