import * as React from 'react';

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
  login: (token: string, user: User) => void;
  logout: () => void;
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

  React.useEffect(() => {
    const validateToken = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        console.log('AuthProvider - Stored credentials:', { 
          hasToken: !!storedToken, 
          hasUser: !!storedUser,
          storedUser: storedUser ? JSON.parse(storedUser) : null
        });

        if (!storedToken || !storedUser) {
          console.log('No stored credentials found');
          setIsLoading(false);
          return;
        }

        let parsedUser: User;
        try {
          parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
        } catch (e) {
          console.error('Failed to parse stored user:', e);
          throw new Error('Invalid stored user data');
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
        }

      } catch (error) {
        console.error('Authentication error:', error);
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

  const login = (newToken: string, newUser: User) => {
    console.log('AuthProvider - Login:', { newUser });
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    console.log('AuthProvider - Logout');
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    const currentToken = token;
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
    console.log('AuthProvider - Updating user:', { 
      current: user,
      updated: updatedUser,
      timestamp: new Date().toISOString()
    });
    
    // Create a new user object to ensure React detects the change
    const newUser = { ...updatedUser };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
    
    // Verify the update
    console.log('AuthProvider - User updated:', {
      newState: newUser,
      timestamp: new Date().toISOString()
    });
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