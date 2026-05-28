import { TripPanel } from '../hooks/useTripPanelManager';
import { MapSheetSnap } from '../map/MapBottomSheet';

export const panelCopy: Record<TripPanel, { title: string; description: string; className?: string }> = {
  notifications: {
    title: 'Trip notifications',
    description: 'Reminder and attention items for this trip.',
  },
  today: {
    title: 'Today',
    description: 'Current day assistant, briefings, and replanning.',
  },
  checklist: {
    title: 'Trip checklist',
    description: 'Shared and personal preparation tasks.',
    className: 'md:w-[430px]',
  },
  notes: {
    title: 'Trip notes',
    description: 'Shared rich text notes for this trip.',
    className: 'md:w-[430px]',
  },
  map: {
    title: 'Trip map',
    description: 'Map view of trip events.',
    className: 'md:w-[560px]',
  },
  planning: {
    title: 'Planning',
    description: 'Trip health, open decisions, and planning readiness.',
    className: 'md:w-[480px]',
  },
};

export const panelGroups: Array<{
  label: string;
  panels: Array<{ id: TripPanel; label: string }>;
}> = [
  {
    label: 'Travel Day',
    panels: [
      { id: 'today', label: 'Today' },
      { id: 'notifications', label: 'Alerts' },
    ],
  },
  {
    label: 'Plan',
    panels: [
      { id: 'planning', label: 'Planning' },
      { id: 'checklist', label: 'Checklist' },
      { id: 'notes', label: 'Notes' },
    ],
  },
  {
    label: 'Explore',
    panels: [
      { id: 'map', label: 'Map' },
    ],
  },
];

export const getPanelSheetSnap = (panel: TripPanel): MapSheetSnap => {
  if (panel === 'planning' || panel === 'notes') return 'full';
  if (panel === 'map') return 'peek';
  return 'half';
};
