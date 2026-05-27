import { describe, expect, it } from 'vitest';
import {
  formatPerNightCost,
  getOptionSlotAlignment,
  getOptionSlotAlignmentLabel,
} from '@/utils/decisionHelpers';
import { DecisionSet } from '@/types/decisionTypes';
import { Event } from '@/types/eventTypes';

const baseDecision = (slot: DecisionSet['slot']): DecisionSet => ({
  id: 'dec-1',
  tripId: 'trip-1',
  title: 'Test',
  status: 'open',
  optionEventIds: [],
  slot,
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: { _id: 'u1', name: 'Test', email: 'test@test.com' },
});

describe('getOptionSlotAlignment', () => {
  it('flags activities outside the decision slot', () => {
    const decision = baseDecision({ date: '2026-06-10', endDate: '2026-06-10' });
    const event = {
      id: 'a1',
      type: 'activity',
      status: 'exploring',
      startDate: '2026-06-12',
    } as unknown as Event;

    expect(getOptionSlotAlignment(decision, event)).toBe('misaligned');
    expect(getOptionSlotAlignmentLabel('misaligned')).toBe('Outside decision slot');
  });

  it('detects partial stay overlap', () => {
    const decision = baseDecision({ date: '2026-06-10', endDate: '2026-06-15' });
    const event = {
      id: 's1',
      type: 'stay',
      status: 'exploring',
      checkIn: '2026-06-08',
      checkOut: '2026-06-12',
    } as unknown as Event;

    expect(getOptionSlotAlignment(decision, event)).toBe('partial');
  });

  it('marks aligned stays fully inside the slot', () => {
    const decision = baseDecision({ date: '2026-06-10', endDate: '2026-06-15' });
    const event = {
      id: 's2',
      type: 'stay',
      status: 'exploring',
      checkIn: '2026-06-10',
      checkOut: '2026-06-14',
    } as unknown as Event;

    expect(getOptionSlotAlignment(decision, event)).toBe('aligned');
  });
});

describe('formatPerNightCost', () => {
  it('formats per-night cost for stays', () => {
    expect(formatPerNightCost(600, 3)).toBe('$200.00/night');
  });

  it('returns null when nights are invalid', () => {
    expect(formatPerNightCost(600, 0)).toBeNull();
  });
});
