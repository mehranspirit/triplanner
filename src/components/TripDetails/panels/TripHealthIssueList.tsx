import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import { cn } from '@/lib/utils';
import {
  categorySeverityDotClassName,
  groupTripHealthIssues,
  severityBadgeClassName,
} from './tripHealthCategories';
import TripHealthIssueRow from './TripHealthIssueRow';

interface TripHealthIssueListProps {
  issues: TripHealthIssue[];
  canEdit: boolean;
  isLoading?: boolean;
  onExecuteResolution: (
    action: TripHealthIssue['resolutionOptions'][number]['action'],
    payload?: Record<string, unknown>,
  ) => void;
}

const TripHealthIssueList: React.FC<TripHealthIssueListProps> = ({
  issues,
  canEdit,
  isLoading = false,
  onExecuteResolution,
}) => {
  if (isLoading && issues.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        Checking trip health…
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-8 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        <p className="mt-2 text-sm font-medium text-emerald-900">All clear</p>
        <p className="mt-1 text-xs text-emerald-700">
          Schedule, lodging, transport, locations, bookings, and decisions all look good.
        </p>
      </div>
    );
  }

  const groups = groupTripHealthIssues(issues);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.dimension} aria-labelledby={`health-category-${group.dimension}`}>
          <div
            id={`health-category-${group.dimension}`}
            className="mb-2 flex items-start gap-3"
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1',
                group.meta.iconClassName,
              )}
            >
              {group.meta.renderIcon('h-5 w-5')}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900">{group.meta.label}</h4>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {group.issues.length}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    severityBadgeClassName(group.highestSeverity),
                  )}
                >
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full', categorySeverityDotClassName(group.highestSeverity))}
                    aria-hidden="true"
                  />
                  {group.highestSeverity}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{group.meta.description}</p>
            </div>
          </div>

          <ul className="space-y-2 border-l-2 border-slate-100 pl-3 ml-5">
            {group.issues.map((issue) => (
              <TripHealthIssueRow
                key={issue.id}
                issue={issue}
                canEdit={canEdit}
                onExecuteResolution={onExecuteResolution}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default TripHealthIssueList;
