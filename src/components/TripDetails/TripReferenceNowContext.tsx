import React, { createContext, useContext } from 'react';
import { TripSimulatedDateState } from './hooks/useTripSimulatedDate';

const TripReferenceNowContext = createContext<TripSimulatedDateState | null>(null);

export const TripReferenceNowProvider: React.FC<{
  value: TripSimulatedDateState;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <TripReferenceNowContext.Provider value={value}>
    {children}
  </TripReferenceNowContext.Provider>
);

export const useTripReferenceNow = () => {
  const context = useContext(TripReferenceNowContext);
  if (!context) {
    return {
      referenceNow: new Date(),
      simulatedDateKey: null,
      setSimulatedDateKey: () => undefined,
      isSimulating: false,
      isUiTestTrip: false,
      tripStartDate: undefined,
      tripEndDate: undefined,
    } satisfies TripSimulatedDateState;
  }
  return context;
};
