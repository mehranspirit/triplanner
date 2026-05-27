export function buildEmptyDayIssueKey(date: string): string {
  return `empty_day:${date}`;
}

export function buildMissingStayIssueKey(tripId: string): string {
  return `lodging_gap:missing_stay:${tripId}`;
}

export function buildLodgingGapIssueKey(startDate: string, endDate: string): string {
  return `lodging_gap:${startDate}:${endDate}`;
}

export function buildTransportGapIssueKey(
  kind: 'missing' | 'missing_departure' | 'tight',
  eventId: string,
): string {
  return `transport_gap:${kind}:${eventId}`;
}

export function buildLocationIssueKey(eventId: string): string {
  return `location:${eventId}`;
}

export function buildBookingRefIssueKey(eventId: string): string {
  return `booking_ref:${eventId}`;
}

export function buildExploringEventIssueKey(eventId: string): string {
  return `exploring_event:${eventId}`;
}

export function buildOpenDecisionIssueKey(decisionId: string): string {
  return `open_decision:${decisionId}`;
}

export function parseOpenDecisionIssueKey(issueKey: string): string | null {
  if (!issueKey.startsWith('open_decision:')) return null;
  return issueKey.slice('open_decision:'.length) || null;
}

export function buildScheduleConflictIssueKey(kind: string, id: string): string {
  return `schedule_conflict:${kind}:${id}`;
}
