import React from 'react';
import { Event } from '@/types/eventTypes';
import { renderTextWithLinks } from '@/components/TripDetails/EventCards/utils';
import {
  getEventDetailNotes,
  getEventDetailSections,
  type DetailSection,
} from '@/utils/eventDetailContent';

interface EventDetailBodyProps {
  event: Event;
  currency?: string;
}

const DetailSectionBlock: React.FC<{ section: DetailSection }> = ({ section }) => (
  <div className="space-y-2">
    {section.title && (
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {section.title}
      </p>
    )}
    <dl className="space-y-2">
      {section.rows.map((row) => (
        <div key={`${section.title ?? 'section'}-${row.label}`}>
          <dt className="text-xs text-slate-500">{row.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">{row.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);

const EventDetailBody: React.FC<EventDetailBodyProps> = ({ event, currency = 'USD' }) => {
  const sections = getEventDetailSections(event, currency);
  const { description, notes } = getEventDetailNotes(event);

  if (sections.length === 0 && !description && !notes) return null;

  return (
    <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
      {sections.map((section) => (
        <DetailSectionBlock key={section.title ?? section.rows[0]?.label} section={section} />
      ))}

      {description && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Description
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {renderTextWithLinks(description)}
          </p>
        </div>
      )}

      {notes && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Notes
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {renderTextWithLinks(notes)}
          </p>
        </div>
      )}
    </div>
  );
};

export default EventDetailBody;
