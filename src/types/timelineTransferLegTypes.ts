export interface TimelineTransferLeg {
  fromEventId: string;
  toEventId: string;
  dayKey: string;
  driveDistanceMeters: number | null;
  driveDurationSeconds: number | null;
  driveDistanceLabel: string | null;
  driveDurationLabel: string | null;
  status: 'ok' | 'unavailable';
  gapMinutes?: number | null;
}

export interface TripTimelineLegsResponse {
  provider: string;
  configured: boolean;
  legs: TimelineTransferLeg[];
  diagnostics?: {
    status: string;
    message: string;
    discoveredLegs: number;
    cachedLegs: number;
    fetchedLegs: number;
  };
}

export const buildTimelineLegKey = (
  fromEventId: string,
  toEventId: string,
  dayKey: string,
) => `${fromEventId}:${toEventId}:${dayKey}`;
