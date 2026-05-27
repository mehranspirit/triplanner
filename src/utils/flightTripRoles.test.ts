import { describe, expect, it } from 'vitest';
import { Event } from '@/types/eventTypes';
import {
  buildFlightRoleMap,
  isRoundTripPair,
  shouldCheckArrivalGroundTransport,
} from '@/utils/flightTripRoles';
import { detectTransportGaps } from '@/services/tripHealth/detectors/transportGaps';

const owner = { _id: 'u1', name: 'Owner', email: 'owner@test.com' };

const flight = (overrides: Partial<Event> & { id: string }): Event => ({
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
  ...overrides,
} as Event);

describe('flightTripRoles', () => {
  it('detects round-trip airport pairs', () => {
    const outbound = flight({
      id: 'outbound',
      departureAirport: 'JFK',
      arrivalAirport: 'CDG',
    });
    const returnFlight = flight({
      id: 'return',
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      departureAirport: 'CDG',
      arrivalAirport: 'JFK',
    });

    expect(isRoundTripPair(outbound, returnFlight)).toBe(true);
  });

  it('classifies outbound and return legs on a round trip', () => {
    const events = [
      flight({ id: 'outbound', departureAirport: 'JFK', arrivalAirport: 'CDG' }),
      flight({
        id: 'return',
        startDate: '2026-06-10',
        endDate: '2026-06-10',
        departureAirport: 'CDG',
        arrivalAirport: 'JFK',
      }),
    ];

    const roles = buildFlightRoleMap(events);
    expect(roles.get('outbound')?.leg).toBe('outbound');
    expect(roles.get('outbound')?.needsArrivalGroundTransport).toBe(true);
    expect(roles.get('outbound')?.needsDepartureGroundTransport).toBe(false);
    expect(roles.get('return')?.leg).toBe('return');
    expect(roles.get('return')?.needsArrivalGroundTransport).toBe(false);
    expect(roles.get('return')?.needsDepartureGroundTransport).toBe(true);
  });

  it('treats short-gap flight chains as connections', () => {
    const events = [
      flight({
        id: 'leg-1',
        departureAirport: 'JFK',
        arrivalAirport: 'ORD',
        arrivalTime: '10:00',
      }),
      flight({
        id: 'leg-2',
        departureAirport: 'ORD',
        arrivalAirport: 'CDG',
        departureTime: '12:00',
        arrivalTime: '18:00',
      }),
    ];

    const roles = buildFlightRoleMap(events);
    expect(roles.get('leg-1')?.leg).toBe('connection');
    expect(shouldCheckArrivalGroundTransport(events[0], events, roles)).toBe(false);
    expect(roles.get('leg-2')?.leg).toBe('outbound');
    expect(shouldCheckArrivalGroundTransport(events[1], events, roles)).toBe(true);
  });
});

describe('transport gaps with flight roles', () => {
  it('only flags outbound arrival and return departure on a round trip', () => {
    const events = [
      flight({ id: 'outbound', departureAirport: 'JFK', arrivalAirport: 'CDG' }),
      flight({
        id: 'return',
        startDate: '2026-06-10',
        endDate: '2026-06-10',
        departureAirport: 'CDG',
        arrivalAirport: 'JFK',
      }),
    ];

    const issues = detectTransportGaps(events);
    expect(issues.some((issue) => issue.issueKey === 'transport_gap:missing:outbound')).toBe(true);
    expect(issues.some((issue) => issue.issueKey === 'transport_gap:missing:return')).toBe(false);
    expect(issues.some((issue) => issue.issueKey === 'transport_gap:missing_departure:return')).toBe(true);
  });
});
