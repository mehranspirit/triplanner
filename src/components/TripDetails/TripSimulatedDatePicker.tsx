import React from 'react';
import { CalendarClock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTripReferenceNow } from './TripReferenceNowContext';

const TripSimulatedDatePicker: React.FC = () => {
  const {
    isUiTestTrip,
    simulatedDateKey,
    setSimulatedDateKey,
    isSimulating,
    tripStartDate,
    tripEndDate,
  } = useTripReferenceNow();

  if (!isUiTestTrip) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs shadow-sm',
        isSimulating
          ? 'border-violet-200 bg-violet-50/90 text-violet-950'
          : 'border-slate-200 bg-white/90 text-slate-700',
      )}
    >
      <CalendarClock className="h-3.5 w-3.5 shrink-0 text-violet-600" />
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 font-medium">Simulate today</span>
        <Input
          type="date"
          value={simulatedDateKey ?? ''}
          min={tripStartDate?.slice(0, 10)}
          max={tripEndDate?.slice(0, 10)}
          onChange={(event) => {
            const next = event.target.value;
            setSimulatedDateKey(next || null);
          }}
          className="h-8 min-w-0 flex-1 rounded-full border-slate-200 bg-white px-3 text-xs"
        />
      </label>
      {isSimulating && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 rounded-full px-2 text-xs text-violet-800 hover:bg-violet-100"
          onClick={() => setSimulatedDateKey(null)}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
};

export default TripSimulatedDatePicker;
