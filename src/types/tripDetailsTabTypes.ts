export type TripDetailsTab = 'itinerary' | 'calendar';

export const tripDetailsTabKey = (tripId: string) => `tripDetailsTab:${tripId}`;
