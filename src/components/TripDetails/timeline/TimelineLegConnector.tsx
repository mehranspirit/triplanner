import React from 'react';
import { Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimelineTransferLeg } from '@/types/timelineTransferLegTypes';
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

interface TimelineLegConnectorProps {
  transfer: TransferSummary;
  drivingLeg?: TimelineTransferLeg | null;
  variant?: 'rail' | 'inline';
  className?: string;
}

const severityStyles: Record<TransferSummary['severity'], string> = {
  ok: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
  tight: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
  long: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
  missing: 'border-slate-200 bg-slate-50 text-slate-600',
};

const getDisplaySeverity = (
  transfer: TransferSummary,
  drivingLeg?: TimelineTransferLeg | null,
): TransferSummary['severity'] => {
  if (transfer.flexibleDeparture) {
    return 'ok';
  }

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

const TimelineLegConnector: React.FC<TimelineLegConnectorProps> = ({
  transfer,
  drivingLeg,
  variant = 'rail',
  className,
}) => {
  const severity = getDisplaySeverity(transfer, drivingLeg);
  const label = drivingLeg?.status === 'ok'
    && drivingLeg.driveDistanceLabel
    && drivingLeg.driveDurationLabel
    ? formatCachedDrivingLegLabel(drivingLeg.driveDistanceLabel, drivingLeg.driveDurationLabel)
    : formatTransferLegLabel(transfer);

  const hint = severity === 'tight'
    ? ` · ${transfer.gapMinutes} min buffer`
    : severity === 'long'
      ? ' · long leg'
      : '';

  const link = (
    <a
      href={getDirectionsUrl(transfer.fromPoint, transfer.toPoint)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        severityStyles[severity],
      )}
      title="Open driving directions in Google Maps"
    >
      <Navigation className="h-3 w-3 shrink-0 opacity-70" />
      <span className="truncate">{label}{hint}</span>
    </a>
  );

  if (variant === 'inline') {
    return (
      <div className={cn('min-w-0 flex-1', className)}>
        {link}
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 gap-3 py-1', className)}>
      <div className="w-14 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {link}
      </div>
    </div>
  );
};

export default TimelineLegConnector;
