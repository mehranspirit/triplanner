import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

interface MapViewChromeContextValue {
  hideAppChrome: boolean;
  setMapViewActive: (active: boolean) => void;
}

const MapViewChromeContext = createContext<MapViewChromeContextValue | null>(null);

export const MapViewChromeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hideAppChrome, setHideAppChrome] = useState(false);

  const setMapViewActive = useCallback((active: boolean) => {
    setHideAppChrome(active);
  }, []);

  const value = useMemo(
    () => ({ hideAppChrome, setMapViewActive }),
    [hideAppChrome, setMapViewActive],
  );

  return (
    <MapViewChromeContext.Provider value={value}>
      {children}
    </MapViewChromeContext.Provider>
  );
};

export const useMapViewChrome = () => {
  const context = useContext(MapViewChromeContext);
  if (!context) {
    throw new Error('useMapViewChrome must be used within MapViewChromeProvider');
  }
  return context;
};

export const useMapViewChromeOptional = () => useContext(MapViewChromeContext);
