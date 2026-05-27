import React from 'react';
import {
  FaBus,
  FaCar,
  FaHotel,
  FaMapMarkerAlt,
  FaMountain,
  FaPlane,
} from 'react-icons/fa';
import { CalendarDays, Sparkles, Ticket } from 'lucide-react';
import { TripHealthDimension, TripHealthIssue, TripHealthSeverity } from '@/types/tripHealthTypes';
import { cn } from '@/lib/utils';

export interface TripHealthCategoryMeta {
  dimension: TripHealthDimension;
  label: string;
  description: string;
  iconClassName: string;
  renderIcon: (className?: string) => React.ReactNode;
}

export const TRIP_HEALTH_CATEGORY_ORDER: TripHealthDimension[] = [
  'schedule',
  'lodging',
  'transport',
  'location',
  'booking',
  'decisions',
];

const CATEGORY_META: Record<TripHealthDimension, Omit<TripHealthCategoryMeta, 'dimension'>> = {
  schedule: {
    label: 'Schedule',
    description: 'Open days, overlaps, and date conflicts',
    iconClassName: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
    renderIcon: (className = 'h-4 w-4') => (
      <CalendarDays className={cn(className, 'text-indigo-600')} aria-hidden="true" />
    ),
  },
  lodging: {
    label: 'Lodging',
    description: 'Missing stays and gaps between accommodations',
    iconClassName: 'bg-amber-50 text-amber-600 ring-amber-100',
    renderIcon: (className = 'h-4 w-4') => (
      <FaHotel className={cn(className, 'text-yellow-500')} aria-hidden="true" />
    ),
  },
  transport: {
    label: 'Transport',
    description: 'Ground connections and tight transfers',
    iconClassName: 'bg-blue-50 text-blue-600 ring-blue-100',
    renderIcon: (className = 'h-4 w-4') => (
      <FaPlane className={cn(className, 'text-blue-500')} aria-hidden="true" />
    ),
  },
  location: {
    label: 'Locations',
    description: 'Map pins that need review or confirmation',
    iconClassName: 'bg-pink-50 text-pink-600 ring-pink-100',
    renderIcon: (className = 'h-4 w-4') => (
      <FaMapMarkerAlt className={cn(className, 'text-pink-500')} aria-hidden="true" />
    ),
  },
  booking: {
    label: 'Bookings',
    description: 'Missing confirmation or reservation references',
    iconClassName: 'bg-teal-50 text-teal-700 ring-teal-100',
    renderIcon: (className = 'h-4 w-4') => (
      <Ticket className={cn(className, 'text-teal-600')} aria-hidden="true" />
    ),
  },
  decisions: {
    label: 'Decisions',
    description: 'Exploring options that still need a choice',
    iconClassName: 'bg-violet-50 text-violet-700 ring-violet-100',
    renderIcon: (className = 'h-4 w-4') => (
      <Sparkles className={cn(className, 'text-violet-600')} aria-hidden="true" />
    ),
  },
};

export const getTripHealthCategoryMeta = (dimension: TripHealthDimension): TripHealthCategoryMeta => ({
  dimension,
  ...CATEGORY_META[dimension],
});

/** Optional per-issue icon when a row benefits from a subtype hint within its category. */
export const getTripHealthIssueIcon = (issue: TripHealthIssue, className = 'h-3.5 w-3.5') => {
  switch (issue.type) {
    case 'lodging_gap':
      return <FaHotel className={cn(className, 'text-yellow-500')} aria-hidden="true" />;
    case 'transport_gap':
      return <FaCar className={cn(className, 'text-red-500')} aria-hidden="true" />;
    case 'empty_day':
    case 'schedule_conflict':
      return <FaMountain className={cn(className, 'text-indigo-500')} aria-hidden="true" />;
    case 'location':
      return <FaMapMarkerAlt className={cn(className, 'text-pink-500')} aria-hidden="true" />;
    case 'booking_ref':
      return <Ticket className={cn(className, 'text-teal-600')} aria-hidden="true" />;
    case 'exploring_event':
    case 'open_decision':
      return <Sparkles className={cn(className, 'text-violet-600')} aria-hidden="true" />;
    default:
      return <FaBus className={cn(className, 'text-slate-500')} aria-hidden="true" />;
  }
};

const SEVERITY_RANK: Record<TripHealthSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const getHighestSeverity = (issues: TripHealthIssue[]): TripHealthSeverity => (
  issues.reduce<TripHealthSeverity>((highest, issue) => (
    SEVERITY_RANK[issue.severity] < SEVERITY_RANK[highest] ? issue.severity : highest
  ), 'info')
);

export interface TripHealthIssueGroup {
  dimension: TripHealthDimension;
  meta: TripHealthCategoryMeta;
  issues: TripHealthIssue[];
  highestSeverity: TripHealthSeverity;
}

export const groupTripHealthIssues = (issues: TripHealthIssue[]): TripHealthIssueGroup[] => {
  const grouped = new Map<TripHealthDimension, TripHealthIssue[]>();

  issues.forEach((issue) => {
    grouped.set(issue.dimension, [...(grouped.get(issue.dimension) || []), issue]);
  });

  return TRIP_HEALTH_CATEGORY_ORDER
    .map((dimension) => {
      const categoryIssues = grouped.get(dimension);
      if (!categoryIssues?.length) return null;

      const sortedIssues = [...categoryIssues].sort((left, right) => {
        const severityDiff = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
        if (severityDiff !== 0) return severityDiff;
        return (left.affectedDates?.[0] ?? left.title).localeCompare(right.affectedDates?.[0] ?? right.title);
      });

      return {
        dimension,
        meta: getTripHealthCategoryMeta(dimension),
        issues: sortedIssues,
        highestSeverity: getHighestSeverity(sortedIssues),
      };
    })
    .filter((group): group is TripHealthIssueGroup => group !== null);
};

export const severityBadgeClassName = (severity: TripHealthSeverity): string => {
  switch (severity) {
    case 'critical':
      return 'bg-rose-100 text-rose-800';
    case 'warning':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

export const categorySeverityDotClassName = (severity: TripHealthSeverity): string => {
  switch (severity) {
    case 'critical':
      return 'bg-rose-500';
    case 'warning':
      return 'bg-amber-500';
    default:
      return 'bg-slate-300';
  }
};
