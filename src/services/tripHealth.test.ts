import { describe, expect, it } from 'vitest';
import {
  buildEmptyDayIssueKey,
  buildLodgingGapIssueKey,
  computeTripHealth,
  filterDismissedIssues,
  isIssueDismissed,
} from './tripHealth';
import { detectEmptyDays } from './tripHealth/detectors/emptyDays';
import { detectLodgingGaps } from './tripHealth/detectors/lodgingGaps';
import { detectTransportGaps } from './tripHealth/detectors/transportGaps';
import {
  detectBookingRefIssues,
  detectExploringEvents,
  detectLocationIssues,
} from './tripHealth/detectors/migratedInsights';
import {
  detectOpenDecisions,
  detectOrphanExploringEvents,
} from './tripHealth/detectors/decisions';
import { buildOpenDecisionIssueKey } from './tripHealth/issueKeys';
import { DecisionSet } from '@/types/decisionTypes';
import { HealthDismissal, TripHealthIssue } from '@/types/tripHealthTypes';
import { Event, Trip, User } from '@/types/eventTypes';

const owner: User = { _id: 'u1', name: 'Owner', email: 'owner@test.com' };

const baseTrip = (overrides: Partial<Trip> = {}): Trip => ({
  _id: 'trip-1',
  name: 'Test trip',
  startDate: '2026-06-01',
  endDate: '2026-06-05',
  events: [],
  owner,
  collaborators: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  isPublic: false,
  status: 'planning',
  tags: [],
  ...overrides,
});

const sampleIssue = (issueKey: string): TripHealthIssue => ({
  id: issueKey,
  issueKey,
  type: 'empty_day',
  dimension: 'schedule',
  severity: 'info',
  title: 'Empty day',
  reason: 'No events scheduled',
  affectedDates: [issueKey.replace('empty_day:', '')],
  resolutionOptions: [],
});

const dismissal = (issueKey: string, reason: HealthDismissal['reason'] = 'intentional_rest_day'): HealthDismissal => ({
  issueKey,
  reason,
  dismissedAt: '2026-01-01T00:00:00.000Z',
  dismissedBy: owner,
});

describe('tripHealth dismissals', () => {
  it('hides dismissed issues by issueKey', () => {
    const issues = [
      sampleIssue(buildEmptyDayIssueKey('2026-06-02')),
      sampleIssue(buildEmptyDayIssueKey('2026-06-03')),
    ];

    const filtered = filterDismissedIssues(issues, [
      dismissal(buildEmptyDayIssueKey('2026-06-02')),
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].issueKey).toBe(buildEmptyDayIssueKey('2026-06-03'));
  });

  it('does not hide issues when dismissal key differs after underlying data changes', () => {
    const dismissedKey = buildEmptyDayIssueKey('2026-06-02');
    const newKey = buildEmptyDayIssueKey('2026-06-04');

    expect(isIssueDismissed(newKey, [dismissal(dismissedKey)])).toBe(false);
    expect(buildLodgingGapIssueKey('2026-06-02', '2026-06-03')).not.toBe(dismissedKey);
  });

  it('reopens planning_deferred dismissals inside reopen window', () => {
    const issueKey = buildEmptyDayIssueKey('2026-06-02');
    const deferredDismissal: HealthDismissal = {
      ...dismissal(issueKey, 'planning_deferred'),
      reopenBeforeTripDays: 7,
    };

    const beforeWindow = filterDismissedIssues(
      [sampleIssue(issueKey)],
      [deferredDismissal],
      new Date('2026-05-20T12:00:00.000Z'),
      '2026-06-01',
    );
    expect(beforeWindow).toHaveLength(0);

    const insideWindow = filterDismissedIssues(
      [sampleIssue(issueKey)],
      [deferredDismissal],
      new Date('2026-05-26T12:00:00.000Z'),
      '2026-06-01',
    );
    expect(insideWindow).toHaveLength(1);
  });
});

describe('empty day detector', () => {
  it('flags days without scheduled events', () => {
    const trip = baseTrip();
    const events: Event[] = [{
      id: 'e1',
      type: 'activity',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      startTime: '10:00',
      endTime: '12:00',
      status: 'confirmed',
      createdBy: owner,
      updatedBy: owner,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Event];

    const issues = detectEmptyDays(trip, events);
    expect(issues.some((issue) => issue.issueKey === buildEmptyDayIssueKey('2026-06-02'))).toBe(true);
    expect(issues.some((issue) => issue.issueKey === buildEmptyDayIssueKey('2026-06-01'))).toBe(false);
  });

  it('flags under-planned days with only exploring events', () => {
    const trip = baseTrip({ startDate: '2026-06-01', endDate: '2026-06-02' });
    const events: Event[] = [{
      id: 'e1',
      type: 'activity',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      startTime: '10:00',
      endTime: '12:00',
      status: 'exploring',
      createdBy: owner,
      updatedBy: owner,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Event];

    const issues = detectEmptyDays(trip, events);
    expect(issues.some((issue) => issue.title.includes('Under-planned'))).toBe(true);
    expect(issues.some((issue) => issue.issueKey === buildEmptyDayIssueKey('2026-06-02'))).toBe(true);
  });
});

describe('lodging gap detector', () => {
  it('flags missing stay when trip has travel but no lodging', () => {
    const trip = baseTrip({ startDate: '', endDate: '' });
    const events: Event[] = [{
      id: 'flight-1',
      type: 'flight',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      departureTime: '08:00',
      arrivalTime: '14:00',
      status: 'confirmed',
      createdBy: owner,
      updatedBy: owner,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Event];

    const issues = detectLodgingGaps({ ...trip, events }, events);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toBe('No stay added');
  });

  it('flags missing stay for arrival events without explicit trip dates', () => {
    const trip = baseTrip({ startDate: '', endDate: '' });
    const events: Event[] = [{
      id: 'arrival-1',
      type: 'arrival',
      startDate: '2026-06-03',
      endDate: '2026-06-03',
      date: '2026-06-03',
      time: '18:00',
      airport: 'CDG',
      status: 'confirmed',
      createdBy: owner,
      updatedBy: owner,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Event];

    const issues = detectLodgingGaps({ ...trip, events }, events);
    expect(issues.some((issue) => issue.title === 'No stay added')).toBe(true);
  });

  it('detects uncovered nights between stays', () => {
    const trip = baseTrip({ startDate: '2026-06-01', endDate: '2026-06-06' });
    const events: Event[] = [
      {
        id: 'stay-1',
        type: 'stay',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        checkIn: '2026-06-01',
        checkOut: '2026-06-03',
        checkInTime: '15:00',
        checkOutTime: '11:00',
        accommodationName: 'Hotel A',
        status: 'confirmed',
        createdBy: owner,
        updatedBy: owner,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as Event,
      {
        id: 'stay-2',
        type: 'stay',
        startDate: '2026-06-05',
        endDate: '2026-06-06',
        checkIn: '2026-06-05',
        checkOut: '2026-06-06',
        checkInTime: '15:00',
        checkOutTime: '11:00',
        accommodationName: 'Hotel B',
        status: 'confirmed',
        createdBy: owner,
        updatedBy: owner,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as Event,
    ];

    const issues = detectLodgingGaps(trip, events);
    expect(issues.some((issue) => issue.issueKey === buildLodgingGapIssueKey('2026-06-03', '2026-06-05'))).toBe(true);
  });

  it('treats overnight transport as lodging coverage', () => {
    const trip = baseTrip({ startDate: '2026-06-01', endDate: '2026-06-04' });
    const events: Event[] = [{
      id: 'train-1',
      type: 'train',
      startDate: '2026-06-02',
      endDate: '2026-06-03',
      departureTime: '22:00',
      arrivalTime: '06:00',
      status: 'confirmed',
      createdBy: owner,
      updatedBy: owner,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Event];

    const issues = detectLodgingGaps(trip, events);
    expect(issues.some((issue) => issue.affectedDates?.includes('2026-06-02'))).toBe(false);
  });
});

describe('transport gap detector', () => {
  it('flags missing ground transport after flight arrival', () => {
    const events: Event[] = [{
      id: 'flight-1',
      type: 'flight',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      departureTime: '08:00',
      arrivalTime: '14:00',
      status: 'confirmed',
      createdBy: owner,
      updatedBy: owner,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Event];

    const issues = detectTransportGaps(events);
    expect(issues.some((issue) => issue.issueKey === 'transport_gap:missing:flight-1')).toBe(true);
  });

  it('flags tight connection below threshold', () => {
    const events: Event[] = [
      {
        id: 'flight-1',
        type: 'flight',
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        departureTime: '08:00',
        arrivalTime: '10:00',
        departureAirport: 'JFK',
        arrivalAirport: 'LHR',
        status: 'confirmed',
        createdBy: owner,
        updatedBy: owner,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as Event,
      {
        id: 'activity-1',
        type: 'activity',
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        startTime: '11:00',
        endTime: '12:00',
        status: 'confirmed',
        createdBy: owner,
        updatedBy: owner,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as Event,
    ];

    const issues = detectTransportGaps(events);
    expect(issues.some((issue) => issue.issueKey === 'transport_gap:tight:flight-1')).toBe(true);
  });
});

describe('decision health detectors', () => {
  const exploringEvent = (id: string, date: string, title: string): Event => ({
    id,
    type: 'activity',
    title,
    startDate: date,
    endDate: date,
    startTime: '18:00',
    endTime: '20:00',
    status: 'exploring',
    createdBy: owner,
    updatedBy: owner,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as Event);

  const sampleDecision = (overrides: Partial<DecisionSet> = {}): DecisionSet => ({
    id: 'decision-1',
    tripId: 'trip-1',
    title: 'Saturday dinner',
    optionEventIds: ['explore-1', 'explore-2'],
    status: 'open',
    createdBy: owner,
    createdAt: '2026-01-01T00:00:00.000Z',
    slot: { date: '2026-06-02' },
    ...overrides,
  });

  it('creates open_decision issues for open decision sets', () => {
    const events = [
      exploringEvent('explore-1', '2026-06-02', 'Bistro A'),
      exploringEvent('explore-2', '2026-06-02', 'Bistro B'),
    ];
    const issues = detectOpenDecisions([sampleDecision()], events);

    expect(issues).toHaveLength(1);
    expect(issues[0].issueKey).toBe(buildOpenDecisionIssueKey('decision-1'));
    expect(issues[0].type).toBe('open_decision');
    expect(issues[0].resolutionOptions.some((option) => option.action === 'open_decision')).toBe(true);
    expect(issues[0].resolutionOptions.some((option) => option.action === 'defer_decision')).toBe(true);
  });

  it('does not duplicate exploring issues for events already in a decision set', () => {
    const events = [
      exploringEvent('explore-1', '2026-06-02', 'Bistro A'),
      exploringEvent('explore-2', '2026-06-02', 'Bistro B'),
      exploringEvent('explore-3', '2026-06-03', 'Museum'),
    ];

    const orphanIssues = detectOrphanExploringEvents(events, [sampleDecision()]);
    expect(orphanIssues).toHaveLength(1);
    expect(orphanIssues[0].relatedEventIds).toEqual(['explore-3']);
  });

  it('suggests grouping same-day orphan exploring events', () => {
    const events = [
      exploringEvent('explore-1', '2026-06-02', 'Bistro A'),
      exploringEvent('explore-2', '2026-06-02', 'Bistro B'),
    ];

    const orphanIssues = detectOrphanExploringEvents(events, []);
    expect(orphanIssues).toHaveLength(2);
    expect(orphanIssues[0].resolutionOptions.some((option) => option.action === 'create_decision')).toBe(true);
  });

  it('includes open decisions in computeTripHealth', () => {
    const events = [
      exploringEvent('explore-1', '2026-06-02', 'Bistro A'),
      exploringEvent('explore-2', '2026-06-02', 'Bistro B'),
    ];
    const trip = baseTrip({ events, decisions: [sampleDecision()] });
    const result = computeTripHealth({ trip });

    expect(result.issues.some((issue) => issue.type === 'open_decision')).toBe(true);
    expect(result.issues.some((issue) => issue.type === 'exploring_event')).toBe(false);
  });
});

describe('migrated insight detectors', () => {
  it('detects exploring events as decision issues', () => {
    const events: Event[] = [{
      id: 'explore-1',
      type: 'destination',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      startTime: '10:00',
      endTime: '12:00',
      placeName: 'Museum',
      status: 'exploring',
      createdBy: owner,
      updatedBy: owner,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Event];

    expect(detectExploringEvents(events)).toHaveLength(1);
  });

  it('detects missing booking references', () => {
    const events: Event[] = [{
      id: 'stay-1',
      type: 'stay',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      checkInTime: '15:00',
      checkOutTime: '11:00',
      accommodationName: 'Hotel',
      status: 'confirmed',
      createdBy: owner,
      updatedBy: owner,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Event];

    expect(detectBookingRefIssues(events)).toHaveLength(1);
  });

  it('detects location attention for mapless events', () => {
    const events: Event[] = [{
      id: 'activity-1',
      type: 'activity',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      startTime: '10:00',
      endTime: '12:00',
      status: 'confirmed',
      createdBy: owner,
      updatedBy: owner,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Event];

    expect(detectLocationIssues(events).length).toBeGreaterThan(0);
  });
});

describe('computeTripHealth integration', () => {
  it('returns perfect score when trip has no gaps', () => {
    const trip = baseTrip({
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      events: [{
        id: 'e1',
        type: 'activity',
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        startTime: '10:00',
        endTime: '12:00',
        status: 'confirmed',
        location: {
          lat: 48.8566,
          lng: 2.3522,
          quality: 'exact',
          source: 'manual',
        },
        createdBy: owner,
        updatedBy: owner,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as Event],
    });
    const result = computeTripHealth({ trip, dismissals: [] });
    expect(result.summary.headlineScore).toBe(100);
  });

  it('lowers score when issues are present', () => {
    const trip = baseTrip({
      events: [{
        id: 'explore-1',
        type: 'activity',
        startDate: '2026-06-02',
        endDate: '2026-06-02',
        startTime: '10:00',
        endTime: '12:00',
        status: 'exploring',
        createdBy: owner,
        updatedBy: owner,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as Event],
    });

    const result = computeTripHealth({ trip });
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.summary.headlineScore).toBeLessThan(100);
  });
});
