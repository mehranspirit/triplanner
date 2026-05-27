import React from 'react';
import { TripHealthIssue } from '@/types/tripHealthTypes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { getTripHealthIssueIcon, severityBadgeClassName } from './tripHealthCategories';

interface TripHealthIssueRowProps {
  issue: TripHealthIssue;
  canEdit: boolean;
  onExecuteResolution: (
    action: TripHealthIssue['resolutionOptions'][number]['action'],
    payload?: Record<string, unknown>,
  ) => void;
}

const TripHealthIssueRow: React.FC<TripHealthIssueRowProps> = ({
  issue,
  canEdit,
  onExecuteResolution,
}) => {
  const primaryOption = issue.resolutionOptions.find((option) => option.isPrimary)
    ?? issue.resolutionOptions[0];
  const secondaryOptions = issue.resolutionOptions.filter(
    (option) => option.id !== primaryOption?.id,
  );

  return (
    <li
      id={`health-issue-${issue.id}`}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-100">
          {getTripHealthIssueIcon(issue, 'h-4 w-4')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{issue.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{issue.reason}</p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                severityBadgeClassName(issue.severity),
              )}
            >
              {issue.severity}
            </span>
          </div>
          {canEdit && (primaryOption || secondaryOptions.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {primaryOption && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => onExecuteResolution(primaryOption.action, primaryOption.payload)}
                >
                  {primaryOption.label}
                </Button>
              )}
              {secondaryOptions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full px-3 text-xs"
                    >
                      More options
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {secondaryOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onClick={() => onExecuteResolution(option.action, option.payload)}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

export default TripHealthIssueRow;
