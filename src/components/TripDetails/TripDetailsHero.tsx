import React from 'react';
import { format } from 'date-fns';
import { CalendarDays, Clock3, CreditCard, Users } from 'lucide-react';
import { CollaboratorAvatars } from './CollaboratorAvatars';
import TripActions from './TripActions';
import { Trip } from '@/types/eventTypes';
import { ExpenseSummary } from '@/types/expenseTypes';
import { cn } from '@/lib/utils';
import { getTripStatusSummary } from '@/services/tripStatus';
import { ItineraryExportOptions } from './exportHelpers';

interface TripDetailsHeroProps {
  trip: Trip;
  tripThumbnail: string;
  currentUserId?: string;
  isOwner: boolean;
  canEdit: boolean;
  descriptionHtml: string;
  expenseSummary?: ExpenseSummary | null;
  onExport: (options: ItineraryExportOptions) => void;
  onTripUpdate: (trip: Trip) => Promise<void>;
}

const formatDateRange = (startDate?: string | Date | null, endDate?: string | Date | null) => {
  if (!startDate && !endDate) return 'Dates not set';

  try {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const sameYear = start.getFullYear() === end.getFullYear();
      return `${format(start, sameYear ? 'MMM d' : 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
    }
    if (start && !Number.isNaN(start.getTime())) return format(start, 'MMM d, yyyy');
    if (end && !Number.isNaN(end.getTime())) return format(end, 'MMM d, yyyy');
  } catch {
    // Fall through to raw dates.
  }

  return [startDate, endDate].filter(Boolean).join(' - ');
};

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: Math.abs(amount) >= 100 ? 0 : 2,
    }).format(Math.abs(amount));
  } catch {
    return `${currency} ${Math.abs(amount).toFixed(2)}`;
  }
};

const getUserCostStat = (summary: ExpenseSummary | null | undefined, currentUserId?: string) => {
  if (!summary || !currentUserId) {
    return 'No expenses yet';
  }

  if (summary.perCurrencyBalances && Object.keys(summary.perCurrencyBalances).length > 0) {
    const balances = Object.entries(summary.perCurrencyBalances)
      .map(([currency, currencyBalances]) => ({
        currency,
        balance: Number(currencyBalances[currentUserId]) || 0,
      }))
      .filter(({ balance }) => Math.abs(balance) >= 0.01);

    if (balances.length === 0) return 'Settled up';
    if (balances.length > 1) return `${balances.length} balances`;

    const [{ currency, balance }] = balances;
    return balance < 0
      ? `You owe ${formatCurrency(balance, currency)}`
      : `Owed ${formatCurrency(balance, currency)}`;
  }

  const balance = Number(summary.perPersonBalances?.[currentUserId]) || 0;
  if (Math.abs(balance) < 0.01) return 'Settled up';

  return balance < 0
    ? `You owe ${formatCurrency(balance, summary.currency || 'USD')}`
    : `Owed ${formatCurrency(balance, summary.currency || 'USD')}`;
};

const TripStat = ({
  icon,
  label,
  value,
  accent = 'text-slate-600',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100', accent)}>
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  </div>
);

const TripDetailsHero: React.FC<TripDetailsHeroProps> = ({
  trip,
  tripThumbnail,
  currentUserId,
  isOwner,
  canEdit,
  descriptionHtml,
  expenseSummary,
  onExport,
  onTripUpdate,
}) => {
  const collaborators = trip.collaborators.filter((collaborator): collaborator is { user: typeof trip.owner; role: 'viewer' | 'editor' } =>
    typeof collaborator === 'object' && collaborator !== null && 'user' in collaborator && 'role' in collaborator
  );
  const collaboratorCount = collaborators.length + 1;
  const tripStatus = getTripStatusSummary(trip);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 md:rounded-[2rem] md:shadow-2xl">
      <div className="relative h-[132px] w-full overflow-hidden sm:h-[190px] md:h-[240px]">
        <img
          src={trip.thumbnailUrl || tripThumbnail}
          alt={trip.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-slate-950/10" />

        <div className="absolute right-4 top-4 z-20">
          <TripActions
            trip={trip}
            isOwner={isOwner}
            canEdit={canEdit}
            onExport={onExport}
            onTripUpdate={onTripUpdate}
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 p-4 text-white md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="mb-1 hidden text-xs font-semibold uppercase tracking-[0.24em] text-blue-100 sm:block">Trip workspace</p>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg sm:text-3xl md:text-4xl">{trip.name}</h1>
              {descriptionHtml && (
                <p
                  className="mt-2 hidden max-w-3xl text-sm leading-6 text-white/90 drop-shadow-md sm:block md:text-base"
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              )}
            </div>
            <CollaboratorAvatars
              owner={trip.owner}
              collaborators={collaborators}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      </div>

      <div className="hidden gap-3 bg-slate-50/80 p-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        <TripStat
          icon={<CalendarDays className="h-4 w-4" />}
          label="Dates"
          value={formatDateRange(tripStatus.start, tripStatus.end)}
          accent="text-blue-600"
        />
        <TripStat
          icon={<Clock3 className="h-4 w-4" />}
          label="Itinerary"
          value={`${trip.events.length} event${trip.events.length === 1 ? '' : 's'}`}
          accent="text-teal-600"
        />
        <TripStat
          icon={<CreditCard className="h-4 w-4" />}
          label="Your cost"
          value={getUserCostStat(expenseSummary, currentUserId)}
          accent="text-emerald-600"
        />
        <TripStat
          icon={<Users className="h-4 w-4" />}
          label="Collaborators"
          value={`${collaboratorCount} traveler${collaboratorCount === 1 ? '' : 's'}`}
          accent="text-violet-600"
        />
      </div>
    </section>
  );
};

export default TripDetailsHero;
