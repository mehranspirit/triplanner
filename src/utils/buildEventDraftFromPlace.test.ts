import { describe, expect, it } from 'vitest';
import {
  buildEventDraftFromPlace,
  inferActivityTypeFromPlaceTypes,
  inferPlaceEventType,
  isLodgingPlace,
} from './buildEventDraftFromPlace';

const samplePlace = {
  placeId: 'abc123',
  name: 'Louvre Museum',
  formattedAddress: 'Paris, France',
  lat: 48.8606,
  lng: 2.3376,
  types: ['museum', 'tourist_attraction', 'point_of_interest'],
};

describe('buildEventDraftFromPlace helpers', () => {
  it('infers destination for museums and attractions', () => {
    expect(inferPlaceEventType(['museum', 'point_of_interest'])).toBe('destination');
    expect(inferActivityTypeFromPlaceTypes(['museum'])).toBe('Culture');
  });

  it('infers activity for dining places', () => {
    expect(inferPlaceEventType(['restaurant', 'food'])).toBe('activity');
    expect(inferActivityTypeFromPlaceTypes(['restaurant', 'cafe'])).toBe('Dining');
  });

  it('flags lodging places', () => {
    expect(isLodgingPlace(['lodging', 'point_of_interest'])).toBe(true);
    expect(isLodgingPlace(['restaurant'])).toBe(false);
  });

  it('builds a draft destination event with google_places metadata', () => {
    const draft = buildEventDraftFromPlace({
      place: samplePlace,
      eventType: 'destination',
      date: '2026-06-01',
      status: 'exploring',
    });

    expect(draft.type).toBe('destination');
    if (draft.type === 'destination') {
      expect(draft.placeName).toBe('Louvre Museum');
    }
    expect(draft.startDate).toBe('2026-06-01');
    expect(draft.status).toBe('exploring');
    expect(draft.source).toBe('google_places');
    expect(draft.location?.placeId).toBe('abc123');
    expect(draft.location?.source).toBe('google_places');
  });

  it('builds a draft activity event with inferred activity type', () => {
    const draft = buildEventDraftFromPlace({
      place: {
        ...samplePlace,
        name: 'Cafe de Flore',
        types: ['cafe', 'restaurant'],
      },
      eventType: 'activity',
      date: '2026-06-02',
    });

    expect(draft.type).toBe('activity');
    if (draft.type === 'activity') {
      expect(draft.title).toBe('Cafe de Flore');
      expect(draft.activityType).toBe('Dining');
    }
  });

  it('includes website, hours, and contact info on destination drafts', () => {
    const draft = buildEventDraftFromPlace({
      place: {
        ...samplePlace,
        website: 'https://louvre.fr',
        openingHours: 'Mon: 9:00 AM – 6:00 PM',
        contactInfo: '+33 1 40 20 50 50 · https://louvre.fr',
      },
      eventType: 'destination',
      date: '2026-06-01',
    });

    if (draft.type === 'destination') {
      expect(draft.openingHours).toBe('Mon: 9:00 AM – 6:00 PM');
      expect(draft.contactInfo).toContain('https://louvre.fr');
    }
  });

  it('stores activity hours in notes', () => {
    const draft = buildEventDraftFromPlace({
      place: {
        ...samplePlace,
        name: 'Local Cafe',
        types: ['cafe'],
        openingHours: 'Mon: 8:00 AM – 4:00 PM',
        contactInfo: 'https://cafe.example',
        website: 'https://cafe.example',
      },
      eventType: 'activity',
      date: '2026-06-03',
    });

    if (draft.type === 'activity') {
      expect(draft.notes).toContain('Mon: 8:00 AM – 4:00 PM');
      expect(draft.contactInfo).toBe('https://cafe.example');
    }
  });
});
