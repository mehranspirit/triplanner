import React from 'react';
import { Sparkles } from 'lucide-react';
import { TripHealthSummary } from '@/types/tripHealthTypes';
import { cn } from '@/lib/utils';

interface TripHealthSummaryCardProps {
  summary: TripHealthSummary;
  isLoading?: boolean;
}

const scoreTone = (score: number) => {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

const ringColor = (score: number) => {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 50) return 'stroke-amber-500';
  return 'stroke-rose-500';
};

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 72 72" aria-hidden="true">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-slate-100"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={cn('transition-all duration-500', ringColor(score))}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-slate-900">{score}</span>
      </div>
    </div>
  );
};

const TripHealthSummaryCard: React.FC<TripHealthSummaryCardProps> = ({ summary, isLoading = false }) => {
  const isFullyReady = summary.headlineScore >= 100 && summary.openIssueCount === 0;

  return (
  <div className={cn(
    'rounded-2xl border p-4 shadow-sm',
    isFullyReady
      ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white'
      : 'border-slate-200 bg-gradient-to-br from-white to-slate-50',
  )}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <ScoreRing score={summary.headlineScore} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Planning readiness
          </p>
          <p className="mt-1 text-lg font-bold text-slate-950">
            {isLoading ? 'Checking…' : `${summary.headlineScore}% ready`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isLoading
              ? 'Reviewing schedule, lodging, transport, and decisions.'
              : summary.openIssueCount === 0
                ? isFullyReady
                  ? 'Looking good — no open planning issues.'
                  : 'No issues detected.'
                : `${summary.openIssueCount} open issue${summary.openIssueCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      <div
        className={cn(
          'rounded-full border px-3 py-1 text-xs font-semibold',
          scoreTone(summary.headlineScore),
        )}
      >
        {isLoading
          ? 'Updating'
          : summary.headlineScore >= 80
            ? 'On track'
            : summary.headlineScore >= 50
              ? 'Needs work'
              : 'At risk'}
      </div>
    </div>

    {isFullyReady && !isLoading && (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-white/70 px-3 py-2 text-xs text-emerald-800">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span>Trip health is in great shape. Keep confirming draft options as plans firm up.</span>
      </div>
    )}

    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Logistics</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900">{summary.logisticsScore}%</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Content</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900">{summary.contentScore}%</p>
      </div>
    </div>
  </div>
  );
};

export default TripHealthSummaryCard;
