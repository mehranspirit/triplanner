import { TripDetailsTab, tripDetailsTabKey } from '@/types/tripDetailsTabTypes';

const isTripDetailsTab = (value: string | null): value is TripDetailsTab => (
  value === 'itinerary' || value === 'calendar'
);

export const loadTripDetailsTab = (tripId: string): TripDetailsTab => {
  if (typeof localStorage === 'undefined' || !tripId) return 'itinerary';

  const stored = localStorage.getItem(tripDetailsTabKey(tripId));
  if (stored === 'bookings') return 'itinerary';
  return isTripDetailsTab(stored) ? stored : 'itinerary';
};

export const saveTripDetailsTab = (tripId: string, tab: TripDetailsTab) => {
  if (typeof localStorage === 'undefined' || !tripId) return;
  localStorage.setItem(tripDetailsTabKey(tripId), tab);
};
