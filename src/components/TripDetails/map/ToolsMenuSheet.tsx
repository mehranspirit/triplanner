import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain, FaPlane, FaTrain } from 'react-icons/fa';
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  CreditCard,
  FileText,
  MapIcon,
  MapPin,
  Plus,
  Sparkles,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { EVENT_TYPES } from '@/eventTypes/registry';
import { EventType } from '@/types/eventTypes';
import { cn } from '@/lib/utils';
import type { ToolsMenuSheetProps } from './toolsMenuSheetTypes';

const eventIconForType = (type: EventType) => {
  if (type === 'flight') return <FaPlane className="mr-2 h-4 w-4 text-blue-500" />;
  if (type === 'arrival') return <FaPlane className="mr-2 h-4 w-4 rotate-45 text-green-500" />;
  if (type === 'departure') return <FaPlane className="mr-2 h-4 w-4 -rotate-45 text-red-500" />;
  if (type === 'train') return <FaTrain className="mr-2 h-4 w-4 text-green-500" />;
  if (type === 'bus') return <FaBus className="mr-2 h-4 w-4 text-purple-500" />;
  if (type === 'rental_car') return <FaCar className="mr-2 h-4 w-4 text-red-500" />;
  if (type === 'stay') return <FaHotel className="mr-2 h-4 w-4 text-yellow-500" />;
  if (type === 'destination') return <FaMapMarkerAlt className="mr-2 h-4 w-4 text-pink-500" />;
  if (type === 'activity') return <FaMountain className="mr-2 h-4 w-4 text-indigo-500" />;
  return <Plus className="mr-2 h-4 w-4" />;
};

const MenuSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-1">
    <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
    <div className="space-y-1">{children}</div>
  </div>
);

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
}> = ({ icon, label, onClick, disabled, trailing }) => (
  <button
    type="button"
    disabled={disabled}
    className={cn(
      'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-800 transition-colors',
      disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-100',
    )}
    onClick={onClick}
  >
    {icon}
    <span className="min-w-0 flex-1">{label}</span>
    {trailing}
  </button>
);

const ToolsMenuSheet: React.FC<ToolsMenuSheetProps> = ({
  open,
  tripId,
  canEdit,
  addableEventTypes,
  unreadNotificationCount,
  isImprovingLocations,
  improveLocationsLabel,
  onOpenChange,
  onOpenAIImport,
  onAddEvent,
  onOpenExploreSuggestions,
  onImproveLocations,
  onOpenPanel,
  onOpenNotifications,
}) => {
  const navigate = useNavigate();

  const closeAndRun = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  if (!open) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]">
      <button
        type="button"
        className="pointer-events-auto absolute inset-0 bg-slate-950/40"
        aria-label="Close tools menu"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[min(85vh,720px)] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-20 lg:w-80 lg:rounded-3xl"
        role="dialog"
        aria-label="Trip tools menu"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-teal-500" />
            <h2 className="text-sm font-semibold text-slate-950">Tools</h2>
          </div>
          <button
            type="button"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close tools menu"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {canEdit && (
            <MenuSection title="Add">
              <MenuItem
                icon={<Sparkles className="h-4 w-4 text-blue-500" />}
                label="Import booking with AI"
                onClick={() => closeAndRun(onOpenAIImport)}
              />
              <MenuItem
                icon={<Sparkles className="h-4 w-4 text-amber-500" />}
                label="Suggest activities with AI"
                onClick={() => closeAndRun(onOpenExploreSuggestions)}
              />
              {addableEventTypes.map((type) => {
                const eventType = EVENT_TYPES[type];
                if (!eventType) return null;
                return (
                  <MenuItem
                    key={type}
                    icon={eventIconForType(type)}
                    label={type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                    onClick={() => closeAndRun(() => onAddEvent(type))}
                  />
                );
              })}
            </MenuSection>
          )}

          <MenuSection title="Travel day">
            <MenuItem
              icon={<CalendarDays className="h-4 w-4 text-blue-500" />}
              label="Today"
              onClick={() => closeAndRun(() => onOpenPanel('today'))}
            />
            <MenuItem
              icon={<Bell className="h-4 w-4 text-amber-500" />}
              label="Notifications"
              onClick={() => closeAndRun(onOpenNotifications)}
              trailing={
                unreadNotificationCount > 0 ? (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                    {unreadNotificationCount}
                  </span>
                ) : null
              }
            />
          </MenuSection>

          <MenuSection title="Plan">
            <MenuItem
              icon={<ClipboardList className="h-4 w-4 text-blue-500" />}
              label="Planning"
              onClick={() => closeAndRun(() => onOpenPanel('planning'))}
            />
            <MenuItem
              icon={<CheckSquare className="h-4 w-4 text-green-500" />}
              label="Checklist"
              onClick={() => closeAndRun(() => onOpenPanel('checklist'))}
            />
            <MenuItem
              icon={<FileText className="h-4 w-4 text-purple-500" />}
              label="Notes"
              onClick={() => closeAndRun(() => onOpenPanel('notes'))}
            />
            <MenuItem
              icon={<Sparkles className="h-4 w-4 text-blue-500" />}
              label="Import inbox"
              onClick={() => closeAndRun(onOpenAIImport)}
            />
          </MenuSection>

          <MenuSection title="Explore">
            {canEdit && (
              <>
                <MenuItem
                  icon={<Sparkles className="h-4 w-4 text-blue-500" />}
                  label="AI suggestions"
                  onClick={() => closeAndRun(onOpenExploreSuggestions)}
                />
                <MenuItem
                  icon={<MapPin className="h-4 w-4 text-teal-500" />}
                  label={isImprovingLocations ? (improveLocationsLabel || 'Reviewing...') : 'Review locations'}
                  disabled={isImprovingLocations}
                  onClick={() => closeAndRun(onImproveLocations)}
                />
              </>
            )}
            <MenuItem
              icon={<MapIcon className="h-4 w-4 text-blue-500" />}
              label="Map"
              onClick={() => closeAndRun(() => onOpenPanel('map'))}
            />
          </MenuSection>

          <MenuSection title="Money">
            <MenuItem
              icon={<CreditCard className="h-4 w-4 text-emerald-600" />}
              label="Expenses and settlements"
              onClick={() => closeAndRun(() => navigate(`/trips/${tripId}/expenses`))}
            />
          </MenuSection>

          <MenuSection title="Trip">
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-500">
              <Users className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Collaborators, export, and trip settings are in the header menu</span>
            </div>
          </MenuSection>
        </div>
      </div>
    </div>
  );
};

export default ToolsMenuSheet;
