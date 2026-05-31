import React from 'react';
import { format } from 'date-fns';
import { CollaboratorAvatars } from './CollaboratorAvatars';
import TripActions from './TripActions';
import { Trip } from '@/types/eventTypes';
import { ExpenseSummary } from '@/types/expenseTypes';
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
  onOpenExpenses?: () => void;
}

const formatDateRange = (startDate?: string | Date | null, endDate?: string | Date | null) => {
  if (!startDate && !endDate) return 'Dates not set';

  try {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const sameYear = start.getFullYear() === end.getFullYear();
      return `${format(start, sameYear ? 'MMM d' : 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
    }
    if (start && !Number.isNaN(start.getTime())) return format(start, 'MMM d, yyyy');
    if (end && !Number.isNaN(end.getTime())) return format(end, 'MMM d, yyyy');
  } catch {
    // Fall through to raw dates.
  }

  return [startDate, endDate].filter(Boolean).join(' – ');
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

const getUserCostLabel = (summary: ExpenseSummary | null | undefined, currentUserId?: string) => {
  if (!summary || !currentUserId) return null;

  if (summary.perCurrencyBalances && Object.keys(summary.perCurrencyBalances).length > 0) {
    const balances = Object.entries(summary.perCurrencyBalances)
      .map(([currency, currencyBalances]) => ({
        currency,
        balance: Number(currencyBalances[currentUserId]) || 0,
      }))
      .filter(({ balance }) => Math.abs(balance) >= 0.01);

    if (balances.length === 0) return null;
    if (balances.length > 1) return `${balances.length} expense balances`;

    const [{ currency, balance }] = balances;
    return balance < 0
      ? `You owe ${formatCurrency(balance, currency)}`
      : `Owed ${formatCurrency(balance, currency)}`;
  }

  const balance = Number(summary.perPersonBalances?.[currentUserId]) || 0;
  if (Math.abs(balance) < 0.01) return null;

  return balance < 0
    ? `You owe ${formatCurrency(balance, summary.currency || 'USD')}`
    : `Owed ${formatCurrency(balance, summary.currency || 'USD')}`;
};

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
  onOpenExpenses,
}) => {
  const collaborators = trip.collaborators.filter((collaborator): collaborator is { user: typeof trip.owner; role: 'viewer' | 'editor' } =>
    typeof collaborator === 'object' && collaborator !== null && 'user' in collaborator && 'role' in collaborator
  );
  const tripStatus = getTripStatusSummary(trip);
  const eventCount = trip.events.filter((event) => event.status !== 'alternative').length;
  const costLabel = getUserCostLabel(expenseSummary, currentUserId);

  const metadataItems: React.ReactNode[] = [
    <span key="dates">{formatDateRange(tripStatus.start, tripStatus.end)}</span>,
    <span key="events">{eventCount} event{eventCount === 1 ? '' : 's'}</span>,
  ];

  if (costLabel) {
    metadataItems.push(
      onOpenExpenses ? (
        <button
          key="cost"
          type="button"
          className="underline decoration-white/40 underline-offset-2 transition-colors hover:text-white hover:decoration-white/80"
          onClick={onOpenExpenses}
        >
          {costLabel}
        </button>
      ) : (
        <span key="cost">{costLabel}</span>
      ),
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 md:rounded-[2rem] md:shadow-2xl">
      <div className="relative h-[132px] w-full overflow-hidden sm:h-[190px] md:h-[220px]">
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
              <p className="mb-1 hidden text-xs font-semibold uppercase tracking-[0.24em] text-blue-100 sm:block">
                Trip workspace
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-lg sm:text-3xl md:text-4xl">
                {trip.name}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-white/85 drop-shadow-md">
                {metadataItems.map((item, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span className="text-white/50" aria-hidden>·</span>}
                    {item}
                  </React.Fragment>
                ))}
              </p>
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
    </section>
  );
};

export default TripDetailsHero;
