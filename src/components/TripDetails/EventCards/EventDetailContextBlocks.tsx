import React from 'react';
import { CloudSun, Navigation } from 'lucide-react';
import { FaPlane } from 'react-icons/fa';
import { Event } from '@/types/eventTypes';
import { FlightStatusSnapshot } from '@/types/flightStatusTypes';
import { cn } from '@/lib/utils';
import { getEventDisplayName } from '@/utils/eventTime';
import { OutboundTransferContext } from '@/utils/eventDetailContent';
import {
  formatCachedDrivingLegLabel,
  formatTransferLegLabel,
  getDirectionsUrl,
  TransferSummary,
} from '@/utils/transferAnalysis';
import {
  LONG_TRANSFER_DISTANCE_KM,
  LONG_TRANSFER_EXTRA_BUFFER_MINUTES,
} from '@/constants/tripHealthThresholds';
import { TimelineTransferLeg } from '@/types/timelineTransferLegTypes';

interface EventDetailContextBlocksProps {
  event: Event;
  weatherLabel?: string | null;
  flightStatus?: FlightStatusSnapshot | null;
  outboundTransfer?: OutboundTransferContext | null;
}

const getTransferSeverity = (
  transfer: TransferSummary,
  drivingLeg?: TimelineTransferLeg | null,
): TransferSummary['severity'] => {
  if (transfer.flexibleDeparture) return 'ok';

  if (drivingLeg?.status !== 'ok' || !drivingLeg.driveDurationSeconds) {
    return transfer.severity;
  }

  const driveMinutes = Math.ceil(drivingLeg.driveDurationSeconds / 60);
  if (
    transfer.gapMinutes < transfer.tightThresholdMinutes
    || transfer.gapMinutes < driveMinutes
  ) {
    return 'tight';
  }

  if (
    transfer.distanceKm >= LONG_TRANSFER_DISTANCE_KM
    && transfer.gapMinutes < driveMinutes + LONG_TRANSFER_EXTRA_BUFFER_MINUTES
  ) {
    return 'long';
  }

  return 'ok';
};

const severityStyles: Record<TransferSummary['severity'], string> = {
  ok: 'border-slate-200 bg-slate-50 text-slate-700',
  tight: 'border-rose-200 bg-rose-50 text-rose-800',
  long: 'border-amber-200 bg-amber-50 text-amber-800',
  missing: 'border-slate-200 bg-slate-50 text-slate-600',
};

const OutboundTransferBlock: React.FC<{ context: OutboundTransferContext }> = ({ context }) => {
  const { transfer, drivingLeg, nextEvent } = context;
  const severity = getTransferSeverity(transfer, drivingLeg);
  const legLabel = drivingLeg?.status === 'ok'
    && drivingLeg.driveDistanceLabel
    && drivingLeg.driveDurationLabel
    ? formatCachedDrivingLegLabel(drivingLeg.driveDistanceLabel, drivingLeg.driveDurationLabel)
    : formatTransferLegLabel(transfer);

  return (
    <a
      href={getDirectionsUrl(transfer.fromPoint, transfer.toPoint)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors hover:opacity-90',
        severityStyles[severity],
      )}
    >
      <Navigation className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
      <span>
        <span className="font-medium">{legLabel}</span>
        {' '}
        to {getEventDisplayName(nextEvent)}
      </span>
    </a>
  );
};

const FlightStatusBlock: React.FC<{ snapshot: FlightStatusSnapshot }> = ({ snapshot }) => {
  const departureParts = [
    snapshot.departure?.terminal ? `Terminal ${snapshot.departure.terminal}` : null,
    snapshot.departure?.gate ? `Gate ${snapshot.departure.gate}` : null,
    typeof snapshot.departure?.delayMinutes === 'number' && snapshot.departure.delayMinutes > 0
      ? `${snapshot.departure.delayMinutes} min delay`
      : null,
  ].filter(Boolean);
  const arrivalDelay = typeof snapshot.arrival?.delayMinutes === 'number' && snapshot.arrival.delayMinutes > 0
    ? `${snapshot.arrival.delayMinutes} min arrival delay`
    : null;
  const details = [snapshot.status, ...departureParts, arrivalDelay].filter(Boolean).join(' · ');

  return (
    <div className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-sm text-violet-900">
      <FaPlane className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
      <span>
        <span className="font-medium">Flight status:</span>
        {' '}
        {details || 'No status details available yet'}
      </span>
    </div>
  );
};

const EventDetailContextBlocks: React.FC<EventDetailContextBlocksProps> = ({
  event,
  weatherLabel,
  flightStatus,
  outboundTransfer,
}) => {
  const showWeather = Boolean(weatherLabel);
  const showFlight = event.type === 'flight' && flightStatus;
  const showTransfer = Boolean(outboundTransfer);

  if (!showWeather && !showFlight && !showTransfer) return null;

  return (
    <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
      {showWeather && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
          <CloudSun className="h-4 w-4 shrink-0 text-sky-600" />
          <span>
            <span className="font-medium">Forecast:</span>
            {' '}
            {weatherLabel}
          </span>
        </div>
      )}

      {showFlight && flightStatus && (
        <FlightStatusBlock snapshot={flightStatus} />
      )}

      {showTransfer && outboundTransfer && (
        <OutboundTransferBlock context={outboundTransfer} />
      )}
    </div>
  );
};

export default EventDetailContextBlocks;
