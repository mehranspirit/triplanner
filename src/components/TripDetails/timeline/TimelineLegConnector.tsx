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

interface TimelineLegConnectorProps {
  transfer: TransferSummary;
  drivingLeg?: TimelineTransferLeg | null;
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
    transfer.distanceKm >= 50
    && transfer.gapMinutes < driveMinutes + 45
  ) {
    return 'long';
  }

  return 'ok';
};

const TimelineLegConnector: React.FC<TimelineLegConnectorProps> = ({ transfer, drivingLeg }) => {
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

  return (
    <div className="relative py-1 pl-1">
      <a
        href={getDirectionsUrl(transfer.fromPoint, transfer.toPoint)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          severityStyles[severity],
        )}
        title="Open driving directions in Google Maps"
      >
        <Navigation className="h-3 w-3 shrink-0 opacity-70" />
        <span>{label}{hint}</span>
      </a>
    </div>
  );
};

export default TimelineLegConnector;
