import { describe, expect, it } from 'vitest';
import { Trip } from '@/types/eventTypes';
import { buildInTripAssistantContent } from '@/utils/inTripAssistantContent';

const makeActivity = (id: string, startDate: string): Trip['events'][number] => ({
  id,
  type: 'activity',
  status: 'confirmed',
  startDate,
  title: `Activity ${id}`,
} as unknown as Trip['events'][number]);

describe('inTripAssistantContent', () => {
  it('returns an on-track hero when today has events but nothing urgent', () => {
    const today = new Date();
    const laterToday = new Date(today.getTime() + 4 * 60 * 60 * 1000);

    const content = buildInTripAssistantContent({
      trip: {
        _id: 'trip-1',
        events: [makeActivity('1', laterToday.toISOString())],
      } as unknown as Trip,
      now: today,
    });

    expect(content.hero.source).toBe('on_track');
    expect(content.hero.title).toBe("You're on track");
    expect(content.attentionItems).toHaveLength(0);
  });

  it('returns empty-state hero when no events are scheduled today', () => {
    const content = buildInTripAssistantContent({
      trip: {
        _id: 'trip-1',
        events: [makeActivity('1', '2030-01-01T10:00:00.000Z')],
      } as unknown as Trip,
      now: new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00.000Z`),
    });

    expect(content.hero.source).toBe('empty');
    expect(content.hero.title).toBe('Nothing scheduled today');
  });

  it('prefers AI next action for the hero when provided', () => {
    const content = buildInTripAssistantContent({
      trip: { _id: 'trip-1', events: [] } as unknown as Trip,
      todayBriefing: {
        summary: 'Summary',
        watchItems: [],
        fallbackIdeas: [],
        nextAction: {
          title: 'Check in now',
          reason: 'Hotel opens at 3 PM',
          actionLabel: 'Open stay',
          actionTarget: 'event',
          eventId: 'stay-1',
        },
      },
    });

    expect(content.hero.source).toBe('ai');
    expect(content.hero.title).toBe('Check in now');
    expect(content.hero.eventId).toBe('stay-1');
  });

  it('includes tomorrow preview after the last event ends', () => {
    const today = new Date();
    const todayMorning = new Date(today);
    todayMorning.setHours(9, 0, 0, 0);
    const todayLate = new Date(today);
    todayLate.setHours(10, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const content = buildInTripAssistantContent({
      trip: {
        _id: 'trip-1',
        events: [
          makeActivity('today', todayMorning.toISOString()),
          makeActivity('tomorrow', tomorrow.toISOString()),
        ],
      } as unknown as Trip,
      now: todayLate,
    });

    expect(content.tomorrowPreview?.eventId).toBe('tomorrow');
  });
});
