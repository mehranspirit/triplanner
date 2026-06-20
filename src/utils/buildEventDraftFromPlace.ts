import { ActivityEvent, DestinationEvent, Event } from '@/types/eventTypes';
import { PlaceDetailsResult } from '@/types/geocodingTypes';

export type PlaceAddEventType = 'activity' | 'destination';

export const LODGING_PLACE_TYPES = new Set([
  'lodging',
  'hotel',
  'motel',
  'hostel',
  'guest_house',
  'bed_and_breakfast',
  'campground',
  'rv_park',
]);

export const DINING_PLACE_TYPES = new Set([
  'restaurant',
  'cafe',
  'bar',
  'bakery',
  'meal_takeaway',
  'meal_delivery',
  'food',
]);

export const SIGHTSEEING_PLACE_TYPES = new Set([
  'tourist_attraction',
  'museum',
  'park',
  'art_gallery',
  'church',
  'place_of_worship',
  'zoo',
  'aquarium',
  'amusement_park',
  'natural_feature',
  'point_of_interest',
]);

export const isLodgingPlace = (types: string[]): boolean => (
  types.some((type) => LODGING_PLACE_TYPES.has(type))
);

export const inferPlaceEventType = (types: string[]): PlaceAddEventType => {
  if (types.some((type) => DINING_PLACE_TYPES.has(type))) {
    return 'activity';
  }

  if (types.some((type) => SIGHTSEEING_PLACE_TYPES.has(type))) {
    return 'destination';
  }

  if (types.includes('shopping_mall') || types.includes('store')) {
    return 'activity';
  }

  return 'destination';
};

export const inferActivityTypeFromPlaceTypes = (types: string[]): string => {
  if (types.some((type) => DINING_PLACE_TYPES.has(type))) {
    return 'Dining';
  }

  if (types.some((type) => ['museum', 'art_gallery'].includes(type))) {
    return 'Culture';
  }

  if (types.some((type) => ['park', 'natural_feature', 'zoo', 'aquarium'].includes(type))) {
    return 'Outdoors';
  }

  if (types.includes('shopping_mall') || types.includes('store')) {
    return 'Shopping';
  }

  if (types.includes('night_club') || types.includes('bar')) {
    return 'Nightlife';
  }

  return 'Sightseeing';
};

export interface BuildEventFromPlaceOptions {
  place: PlaceDetailsResult;
  eventType: PlaceAddEventType;
  name?: string;
  activityType?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  status?: Event['status'];
}

type PlaceEventMeta = 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes';

export type NewPlaceEventPayload =
  | Omit<ActivityEvent, PlaceEventMeta>
  | Omit<DestinationEvent, PlaceEventMeta>;

export const buildPlaceRichEventFields = (
  place: Pick<PlaceDetailsResult, 'website' | 'openingHours' | 'contactInfo'>,
  eventType: PlaceAddEventType,
) => {
  const fields: {
    contactInfo?: string;
    openingHours?: string;
    description?: string;
    notes?: string;
  } = {};

  if (place.contactInfo) {
    fields.contactInfo = place.contactInfo;
  }

  if (eventType === 'destination' && place.openingHours) {
    fields.openingHours = place.openingHours;
  } else if (eventType === 'activity' && place.openingHours) {
    fields.notes = place.openingHours.startsWith('Hours')
      ? place.openingHours
      : `Hours:\n${place.openingHours}`;
  }

  if (eventType === 'activity' && place.website && !place.contactInfo?.includes(place.website)) {
    fields.description = place.website;
  }

  return fields;
};

export const buildEventDraftFromPlace = (
  options: BuildEventFromPlaceOptions,
): NewPlaceEventPayload => {
  const {
    place,
    eventType,
    date,
    startTime = '10:00',
    endTime = '12:00',
    status = 'exploring',
  } = options;

  const name = options.name?.trim() || place.name;
  const location = {
    lat: place.lat,
    lng: place.lng,
    address: place.formattedAddress,
    placeId: place.placeId,
    query: name,
    source: 'google_places' as const,
    quality: 'exact' as const,
    confidence: 0.95,
  };
  const richFields = buildPlaceRichEventFields(place, eventType);

  if (eventType === 'destination') {
    return {
      type: 'destination',
      placeName: name,
      startDate: date,
      endDate: date,
      startTime,
      endTime,
      address: place.formattedAddress,
      location,
      status,
      source: 'google_places',
      ...richFields,
    };
  }

  return {
    type: 'activity',
    title: name,
    activityType: options.activityType?.trim()
      || inferActivityTypeFromPlaceTypes(place.types),
    startDate: date,
    endDate: date,
    startTime,
    endTime,
    address: place.formattedAddress,
    location,
    status,
    source: 'google_places',
    ...richFields,
  };
};
