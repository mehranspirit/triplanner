export const UI_TEST_TRIP_NAME_MARKER = '(UI Test)';

export const isUiTestTrip = (trip: { name?: string | null } | null | undefined) => (
  Boolean(trip?.name?.includes(UI_TEST_TRIP_NAME_MARKER))
);

export const getTripSimulatedDateStorageKey = (tripId: string) => `tripSimulatedDate:${tripId}`;

/** Parse yyyy-MM-dd as local noon so "today" logic is stable across timezones. */
export const parseSimulatedDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
};
