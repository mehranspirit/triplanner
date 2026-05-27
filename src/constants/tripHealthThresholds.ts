/** Minimum connection buffer after international flight arrival (minutes). */
export const INTERNATIONAL_CONNECTION_TIGHT_MINUTES = 90;

/** Minimum connection buffer after domestic flight / train / bus arrival (minutes). */
export const DOMESTIC_CONNECTION_TIGHT_MINUTES = 45;

/** Hours after arrival to look for ground transport events. */
export const GROUND_TRANSPORT_LOOKUP_HOURS = 12;

/** Minimum distance (km) before transfer analysis applies. */
export const MIN_TRANSFER_DISTANCE_KM = 2;

/** Average urban driving speed for travel time estimates (km/h). */
export const AVERAGE_URBAN_SPEED_KMH = 40;

/** Fixed buffer added to estimated drive time (minutes). */
export const TRANSFER_BUFFER_MINUTES = 15;

/** Distance (km) that triggers a long-transfer informational issue. */
export const LONG_TRANSFER_DISTANCE_KM = 50;

/** Extra buffer (minutes) before long transfer becomes a warning. */
export const LONG_TRANSFER_EXTRA_BUFFER_MINUTES = 45;
