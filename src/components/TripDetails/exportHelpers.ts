import { 
  Trip, 
  Event, 
  EventType, 
  ArrivalDepartureEvent, 
  StayEvent, 
  DestinationEvent, 
  FlightEvent,
  TrainEvent,
  RentalCarEvent,
  BusEvent,
  ActivityEvent 
} from '@/types/eventTypes';
import { DEFAULT_THUMBNAILS } from './thumbnailHelpers'; // Assuming default thumbnails are here
import { getEventDisplayName, getEventStart, sortEventsByStart } from '@/utils/eventTime';
import { EXPLORING_EVENT_UI_LABEL } from '@/utils/eventStatusLabels';

const getExportDateKey = (event: Event): string => {
  const start = getEventStart(event);
  if (!start) return '';
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
};

export type ItineraryExportMode = 'detailed' | 'compact';

export interface ItineraryExportOptions {
  mode: ItineraryExportMode;
  excludeAlternatives?: boolean;
}

const getExportStyles = (mode: ItineraryExportMode): string => {
  if (mode === 'compact') {
    return `
          body {
            background: #f1f5f9;
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.35;
            margin: 0 auto;
            max-width: 880px;
            padding: 16px;
          }
          .page-shell {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
            padding: 18px;
          }
          .trip-kicker,
          .timeline-label {
            color: #1d4ed8;
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.14em;
            margin: 0;
            text-transform: uppercase;
          }
          .trip-title {
            color: #020617;
            font-size: 1.55rem;
            line-height: 1.15;
            margin: 2px 0 0;
          }
          .trip-description {
            color: #475569;
            font-size: 0.86rem;
            margin: 6px 0 0;
            max-width: 680px;
          }
          .timeline-header {
            align-items: center;
            display: flex;
            gap: 10px;
            justify-content: space-between;
            margin: 16px 0 12px;
          }
          .timeline-title {
            color: #020617;
            font-size: 1.15rem;
            margin: 0;
          }
          .event-count {
            background: #f1f5f9;
            border-radius: 999px;
            color: #475569;
            font-size: 0.78rem;
            font-weight: 600;
            padding: 4px 9px;
            white-space: nowrap;
          }
          .date-group {
            border-left: 1px solid #bfdbfe;
            margin-left: 10px;
            padding: 0 0 8px 18px;
            position: relative;
          }
          .date-header {
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
            display: inline-flex;
            gap: 8px;
            margin: 0 0 8px -29px;
            padding: 5px 10px;
          }
          .date-dot,
          .timeline-point {
            background: #cbd5e1;
            border-radius: 999px;
          }
          .date-dot {
            height: 9px;
            width: 9px;
          }
          .date-weekday {
            color: #0f172a;
            font-size: 0.78rem;
            font-weight: 800;
            margin: 0;
          }
          .date-value {
            color: #64748b;
            font-size: 0.68rem;
            margin: 0;
          }
          .event-card {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
            margin-bottom: 8px;
            overflow: hidden;
            position: relative;
          }
          .event-card.exploring {
            background-color: #f7f2e8;
            background-image: repeating-linear-gradient(-45deg, transparent, transparent 11px, rgba(168, 152, 120, 0.1) 11px, rgba(168, 152, 120, 0.1) 12px);
            border: 2px dashed #d6d3d1;
          }
          .timeline-point {
            border: 2px solid #ffffff;
            box-shadow: 0 0 0 2px #f1f5f9;
            height: 9px;
            left: -23px;
            position: absolute;
            top: 18px;
            width: 9px;
          }
          .event-thumbnail {
            border-radius: 10px;
            flex: 0 0 64px;
            height: 64px;
            object-fit: cover;
            width: 64px;
          }
          .event-content {
            display: flex;
            gap: 10px;
            padding: 10px;
          }
          .event-body {
            min-width: 0;
          }
          .event-header {
            align-items: center;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-bottom: 4px;
          }
          .event-icon {
            align-items: center;
            background: #f8fafc;
            border-radius: 999px;
            display: flex;
            height: 26px;
            justify-content: center;
            width: 26px;
          }
          .event-type,
          .status-badge,
          .time-chip {
            border-radius: 999px;
            font-size: 0.66rem;
            font-weight: 700;
            padding: 2px 6px;
          }
          .event-type {
            background: #eff6ff;
            color: #1d4ed8;
            text-transform: capitalize;
          }
          .status-badge {
            background: #dcfce7;
            color: #166534;
          }
          .status-badge.exploring {
            background: #ede4d3;
            color: #44403c;
          }
          .time-chip {
            background: #f1f5f9;
            color: #475569;
          }
          .event-title {
            color: #020617;
            font-size: 0.95rem;
            font-weight: 800;
            margin: 0;
          }
          .event-details {
            color: #64748b;
            display: grid;
            font-size: 0.78rem;
            gap: 3px 10px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            margin-top: 6px;
          }
          .event-detail-item {
            display: flex;
            gap: 4px;
            min-width: 0;
          }
          .event-detail-label {
            color: #334155;
            font-weight: 700;
            white-space: nowrap;
          }
          .event-detail-value {
            color: #64748b;
            min-width: 0;
          }
          .event-notes,
          .event-description {
            border-top: 1px solid #e2e8f0;
            color: #475569;
            font-size: 0.78rem;
            line-height: 1.35;
            margin-top: 7px;
            padding-top: 6px;
          }
          .event-notes {
            font-style: italic;
          }
          a {
            color: #1d4ed8;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          @media (max-width: 640px) {
            body {
              padding: 12px;
            }
            .page-shell {
              padding: 18px;
            }
            .event-content {
              flex-direction: column;
            }
            .event-thumbnail {
              height: 150px;
              width: 100%;
            }
            .event-details {
              grid-template-columns: 1fr;
            }
          }
          @media print {
            @page {
              margin: 0.45in;
            }
            body {
              background: #ffffff;
              padding: 0;
              max-width: none;
            }
            .page-shell {
              border: 0;
              border-radius: 0;
              box-shadow: none;
              padding: 0;
            }
            .trip-title {
              font-size: 1.35rem;
            }
            .timeline-header {
              margin: 12px 0 8px;
            }
            .date-group {
              padding-bottom: 6px;
            }
            .date-header {
              margin-bottom: 6px;
            }
            .event-card {
              margin-bottom: 6px;
            }
            .event-content {
              padding: 8px;
            }
            .event-card,
            .date-header {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
    `;
  }

  return `
          body {
            background: #f1f5f9;
            color: #0f172a;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.5;
            margin: 0 auto;
            max-width: 960px;
            padding: 24px;
          }
          .page-shell {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 24px;
            box-shadow: 0 16px 48px rgba(15, 23, 42, 0.1);
            padding: 28px;
          }
          .trip-kicker,
          .timeline-label {
            color: #1d4ed8;
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.14em;
            margin: 0;
            text-transform: uppercase;
          }
          .trip-title {
            color: #020617;
            font-size: 2rem;
            line-height: 1.2;
            margin: 4px 0 0;
          }
          .trip-description {
            color: #475569;
            font-size: 0.95rem;
            margin: 10px 0 0;
            max-width: 720px;
          }
          .timeline-header {
            align-items: center;
            display: flex;
            gap: 12px;
            justify-content: space-between;
            margin: 24px 0 16px;
          }
          .timeline-title {
            color: #020617;
            font-size: 1.35rem;
            margin: 0;
          }
          .event-count {
            background: #f1f5f9;
            border-radius: 999px;
            color: #475569;
            font-size: 0.85rem;
            font-weight: 600;
            padding: 6px 12px;
            white-space: nowrap;
          }
          .date-group {
            border-left: 2px solid #bfdbfe;
            margin-left: 12px;
            padding: 0 0 14px 24px;
            position: relative;
          }
          .date-header {
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            box-shadow: 0 2px 4px rgba(15, 23, 42, 0.06);
            display: inline-flex;
            gap: 10px;
            margin: 0 0 12px -36px;
            padding: 8px 14px;
          }
          .date-dot,
          .timeline-point {
            background: #cbd5e1;
            border-radius: 999px;
          }
          .date-dot {
            height: 11px;
            width: 11px;
          }
          .date-weekday {
            color: #0f172a;
            font-size: 0.88rem;
            font-weight: 800;
            margin: 0;
          }
          .date-value {
            color: #64748b;
            font-size: 0.78rem;
            margin: 0;
          }
          .event-card {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
            margin-bottom: 14px;
            overflow: hidden;
            position: relative;
          }
          .event-card.exploring {
            background-color: #f7f2e8;
            background-image: repeating-linear-gradient(-45deg, transparent, transparent 11px, rgba(168, 152, 120, 0.1) 11px, rgba(168, 152, 120, 0.1) 12px);
            border: 2px dashed #d6d3d1;
          }
          .timeline-point {
            border: 2px solid #ffffff;
            box-shadow: 0 0 0 2px #f1f5f9;
            height: 11px;
            left: -30px;
            position: absolute;
            top: 24px;
            width: 11px;
          }
          .event-thumbnail {
            border-radius: 12px;
            flex: 0 0 96px;
            height: 96px;
            object-fit: cover;
            width: 96px;
          }
          .event-content {
            display: flex;
            gap: 14px;
            padding: 16px;
          }
          .event-body {
            min-width: 0;
          }
          .event-header {
            align-items: center;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 6px;
          }
          .event-icon {
            align-items: center;
            background: #f8fafc;
            border-radius: 999px;
            display: flex;
            height: 32px;
            justify-content: center;
            width: 32px;
          }
          .event-type,
          .status-badge,
          .time-chip {
            border-radius: 999px;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 8px;
          }
          .event-type {
            background: #eff6ff;
            color: #1d4ed8;
            text-transform: capitalize;
          }
          .status-badge {
            background: #dcfce7;
            color: #166534;
          }
          .status-badge.exploring {
            background: #ede4d3;
            color: #44403c;
          }
          .time-chip {
            background: #f1f5f9;
            color: #475569;
          }
          .event-title {
            color: #020617;
            font-size: 1.1rem;
            font-weight: 800;
            margin: 0;
          }
          .event-details {
            color: #64748b;
            display: grid;
            font-size: 0.85rem;
            gap: 5px 14px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            margin-top: 10px;
          }
          .event-detail-item {
            display: flex;
            gap: 5px;
            min-width: 0;
          }
          .event-detail-label {
            color: #334155;
            font-weight: 700;
            white-space: nowrap;
          }
          .event-detail-value {
            color: #64748b;
            min-width: 0;
          }
          .event-notes,
          .event-description {
            border-top: 1px solid #e2e8f0;
            color: #475569;
            font-size: 0.85rem;
            line-height: 1.45;
            margin-top: 10px;
            padding-top: 8px;
          }
          .event-notes {
            font-style: italic;
          }
          a {
            color: #1d4ed8;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          @media (max-width: 640px) {
            body {
              padding: 16px;
            }
            .page-shell {
              padding: 22px;
            }
            .event-content {
              flex-direction: column;
            }
            .event-thumbnail {
              height: 180px;
              width: 100%;
            }
            .event-details {
              grid-template-columns: 1fr;
            }
          }
          @media print {
            @page {
              margin: 0.6in;
            }
            body {
              background: #ffffff;
              padding: 0;
              max-width: none;
            }
            .page-shell {
              border: 0;
              border-radius: 0;
              box-shadow: none;
              padding: 0;
            }
            .event-card,
            .date-header {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
  `;
};

// Main function to generate HTML content
export const generateHtmlItinerary = (
  trip: Trip,
  eventThumbnails: { [key: string]: string },
  mode: ItineraryExportMode = 'detailed',
  excludeAlternatives = false,
): string => {
  if (!trip) return '';

  // Helper Functions (kept internal to this generation logic)
  const encodeText = (text: string | undefined | null) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'flight':
        return `<span style="color: #3B82F6;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 576 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M480 192H365.71L260.61 8.06A16.014 16.014 0 0 0 246.71 0h-65.5c-10.63 0-18.3 10.17-15.38 20.39L214.86 192H112l-43.2-57.6c-3.02-4.03-7.77-6.4-12.8-6.4H16.01C5.6 128-2.04 137.78.49 147.88L32 256 .49 364.12C-2.04 374.22 5.6 384 16.01 384H56c5.04 0 9.78-2.37 12.8-6.4L112 320h102.86l-49.03 171.6c-2.92 10.22 4.75 20.4 15.38 20.4h65.5c5.74 0 11.04-3.08 13.89-8.06L365.71 320H480c35.35 0 96-28.65 96-64s-60.65-64-96-64z"></path></svg></span>`;
      case 'arrival':
        return `<span style="color: #10B981; transform: rotate(45deg); display: inline-block;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 576 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M480 192H365.71L260.61 8.06A16.014 16.014 0 0 0 246.71 0h-65.5c-10.63 0-18.3 10.17-15.38 20.39L214.86 192H112l-43.2-57.6c-3.02-4.03-7.77-6.4-12.8-6.4H16.01C5.6 128-2.04 137.78.49 147.88L32 256 .49 364.12C-2.04 374.22 5.6 384 16.01 384H56c5.04 0 9.78-2.37 12.8-6.4L112 320h102.86l-49.03 171.6c-2.92 10.22 4.75 20.4 15.38 20.4h65.5c5.74 0 11.04-3.08 13.89-8.06L365.71 320H480c35.35 0 96-28.65 96-64s-60.65-64-96-64z"></path></svg></span>`;
      case 'departure':
        return `<span style="color: #EF4444; transform: rotate(-45deg); display: inline-block;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 576 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M480 192H365.71L260.61 8.06A16.014 16.014 0 0 0 246.71 0h-65.5c-10.63 0-18.3 10.17-15.38 20.39L214.86 192H112l-43.2-57.6c-3.02-4.03-7.77-6.4-12.8-6.4H16.01C5.6 128-2.04 137.78.49 147.88L32 256 .49 364.12C-2.04 374.22 5.6 384 16.01 384H56c5.04 0 9.78-2.37 12.8-6.4L112 320h102.86l-49.03 171.6c-2.92 10.22 4.75 20.4 15.38 20.4h65.5c5.74 0 11.04-3.08 13.89-8.06L365.71 320H480c35.35 0 96-28.65 96-64s-60.65-64-96-64z"></path></svg></span>`;
      case 'stay':
        return `<span style="color: #EAB308;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 576 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M560 64c8.84 0 16-7.16 16-16V16c0-8.84-7.16-16-16-16H16C7.16 0 0 7.16 0 16v32c0 8.84 7.16 16 16 16h15.98v384H16c-8.84 0-16 7.16-16 16v32c0 8.84 7.16 16 16 16h240v-80c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v80h240c8.84 0 16-7.16 16-16v-32c0-8.84-7.16-16-16-16h-16V64h16zm-304 44.8c0-6.4 6.4-12.8 12.8-12.8h38.4c6.4 0 12.8 6.4 12.8 12.8v38.4c0 6.4-6.4 12.8-12.8 12.8h-38.4c-6.4 0-12.8-6.4-12.8-12.8v-38.4zm0 96c0-6.4 6.4-12.8 12.8-12.8h38.4c6.4 0 12.8 6.4 12.8 12.8v38.4c0 6.4-6.4 12.8-12.8 12.8h-38.4c-6.4 0-12.8-6.4-12.8-12.8v-38.4zm-128-96c0-6.4 6.4-12.8 12.8-12.8h38.4c6.4 0 12.8 6.4 12.8 12.8v38.4c0 6.4-6.4 12.8-12.8 12.8h-38.4c-6.4 0-12.8-6.4-12.8-12.8v-38.4zM128 204.8c0-6.4 6.4-12.8 12.8-12.8h38.4c6.4 0 12.8 6.4 12.8 12.8v38.4c0 6.4-6.4 12.8-12.8 12.8h-38.4c-6.4 0-12.8-6.4-12.8-12.8v-38.4zm128 192c0-6.4 6.4-12.8 12.8-12.8h38.4c6.4 0 12.8 6.4 12.8 12.8v38.4c0 6.4-6.4 12.8-12.8 12.8h-38.4c-6.4 0-12.8-6.4-12.8-12.8v-38.4zm-128 0c0-6.4 6.4-12.8 12.8-12.8h38.4c6.4 0 12.8 6.4 12.8 12.8v38.4c0 6.4-6.4 12.8-12.8 12.8h-38.4c-6.4 0-12.8-6.4-12.8-12.8v-38.4zm384-96c0-6.4 6.4-12.8 12.8-12.8h38.4c6.4 0 12.8 6.4 12.8 12.8v38.4c0 6.4-6.4 12.8-12.8 12.8h-38.4c-6.4 0-12.8-6.4-12.8-12.8v-38.4zm0-96c0-6.4 6.4-12.8 12.8-12.8h38.4c6.4 0 12.8 6.4 12.8 12.8v38.4c0 6.4-6.4 12.8-12.8 12.8h-38.4c-6.4 0-12.8-6.4-12.8-12.8v-38.4zm0 192c0-6.4 6.4-12.8 12.8-12.8h38.4c6.4 0 12.8 6.4 12.8 12.8v38.4c0 6.4-6.4 12.8-12.8 12.8h-38.4c-6.4 0-12.8-6.4-12.8-12.8v-38.4z"></path></svg></span>`;
      case 'destination':
        return `<span style="color: #EC4899;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 384 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"></path></svg></span>`;
      case 'train':
        return `<span style="color: #10B981;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M448 96v256c0 51.815-61.624 96-130.022 96l62.98 49.721C386.905 502.417 383.562 512 376 512H72c-7.578 0-10.892-9.594-4.957-14.279L130.022 448C61.82 448 0 403.954 0 352V96C0 42.981 64 0 128 0h192c65 0 128 42.981 128 96zm-48 136V120c0-13.255-10.745-24-24-24H72c-13.255 0-24 10.745-24 24v112c0 13.255 10.745 24 24 24h304c13.255 0 24-10.745 24-24zm-176 64c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56z"></path></svg></span>`;
      case 'rental_car':
        return `<span style="color: #EF4444;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M499.99 176h-59.87l-16.64-41.6C406.38 91.63 365.57 64 319.5 64h-127c-46.06 0-86.88 27.63-103.99 70.4L71.87 176H12.01C4.2 176-1.53 183.34.37 190.91l6 24C7.7 220.25 12.5 224 18.01 224h20.07C24.65 235.73 16 252.78 16 272v48c0 16.12 6.16 30.67 16 41.93V416c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32v-32h256v32c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32v-54.07c9.84-11.25 16-25.8 16-41.93v-48c0-19.22-8.65-36.27-22.07-48H494c5.51 0 10.31-3.75 11.64-9.09l6-24c1.89-7.57-3.84-14.91-11.65-14.91zm-352.06-17.83c7.29-18.22 24.94-30.17 44.57-30.17h127c19.63 0 37.28 11.95 44.57 30.17L384 208H128l19.93-49.83zM96 319.8c-19.2 0-32-12.76-32-31.9S76.8 256 96 256s48 28.71 48 47.85-28.8 15.95-48 15.95zm320 0c-19.2 0-48 3.19-48-15.95S396.8 256 416 256s32 12.76 32 31.9-12.8 31.9-32 31.9z"></path></svg></span>`;
      case 'bus':
        return `<span style="color: #A855F7;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M488 128h-8V80c0-44.8-99.2-80-224-80S32 35.2 32 80v48h-8c-13.25 0-24 10.74-24 24v80c0 13.25 10.75 24 24 24h8v160c0 17.67 14.33 32 32 32v32c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32v-32h192v32c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32v-32h6.4c16 0 25.6-12.8 25.6-25.6V256h8c13.25 0 24-10.75 24-24v-80c0-13.26-10.75-24-24-24zM112 400c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32zm16-112c-17.67 0-32-14.33-32-32V128c0-17.67 14.33-32 32-32h256c17.67 0 32 14.33 32 32v128c0 17.67-14.33 32-32 32H128zm272 112c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32z"></path></svg></span>`;
      case 'activity':
        return `<span style="color: #6366F1;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 640 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M634.92 462.7l-288-448C341.03 5.54 330.89 0 320 0s-21.03 5.54-26.92 14.7l-288 448a32.001 32.001 0 0 0-1.17 32.64A32.004 32.004 0 0 0 32 512h576c11.71 0 22.48-6.39 28.09-16.67a31.983 31.983 0 0 0-1.17-32.63zM320 91.18L405.39 224H320l-64 64-38.06-38.06L320 91.18z"></path></svg></span>`;
      default:
        return `<span style="color: #6B7280;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" height="1.25em" width="1.25em" xmlns="http://www.w3.org/2000/svg"><path d="M148 288h-40c-6.6 0-12-5.4-12-12v-40c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12zm108-12v-40c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12zm96 0v-40c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12zm-96 96v-40c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12zm-96 0v-40c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12zm192 0v-40c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12zm96-260v352c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V112c0-26.5 21.5-48 48-48h48V12c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v52h128V12c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v52h48c26.5 0 48 21.5 48 48zm-48 346V160H48v298c0 3.3 2.7 6 6 6h340c3.3 0 6-2.7 6-6z"></path></svg></span>`;
    }
  };

  const getEventTitle = (event: Event): string => {
    return encodeText(getEventDisplayName(event));
  };

  const formatDateForExport = (dateString: string) => {
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTimelineDateForExport = (dateString: string) => {
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return {
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
      date: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
  };

  const processText = (text: string | undefined | null): string => {
    if (!text) return '';
    try {
      const decodedText = decodeURIComponent(text);
      return decodedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\n/g, '<br>');
    } catch (e) {
      console.warn('Failed to decode text for export:', text, e);
      return text; // Return original text if decoding fails
    }
  };

  const getTimeSummary = (event: Event) => {
    const start = getEventStart(event);
    if (!start) return '';
    return start.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getEventDetails = (event: Event): [string, string][] => {
    const formatDateTime = (date?: string, time?: string) => {
      if (!date) return '';
      
      // If the date string contains a time component (ISO format), extract it
      let datePart = date;
      let timePart = time;
      
      if (date.includes('T')) {
        const [d, t] = date.split('T');
        datePart = d;
        timePart = t.substring(0, 5); // Get HH:mm part
      }
      
      const formattedDate = formatDateForExport(datePart);
      if (!timePart) return formattedDate;
      
      // Handle time in 24-hour format (HH:mm)
      const [hours, minutes] = timePart.split(':').map(Number);
      const timeString = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      return `${formattedDate} at ${timeString}`;
    };

    switch (event.type) {
      case 'arrival':
      case 'departure': {
        const e = event as ArrivalDepartureEvent;
        return [
          ['Date', formatDateTime(e.date || e.startDate)],
          ['Time', e.time],
          ['Airport', e.airport],
          ['Airline', e.airline],
          ['Flight', e.flightNumber],
          ['Terminal', e.terminal],
          ['Gate', e.gate],
          ['Booking Ref', e.bookingReference],
          ['Status', e.status]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'stay': {
        const e = event as StayEvent;
        return [
          ['Check-in Date', formatDateTime(e.checkIn || e.startDate, e.checkInTime)],
          ['Check-out Date', formatDateTime(e.checkOut || e.endDate, e.checkOutTime)],
          ['Accommodation', e.accommodationName],
          ['Address', e.address],
          ['Reservation', e.reservationNumber],
          ['Contact', e.contactInfo],
          ['Status', e.status]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'destination': {
        const e = event as DestinationEvent;
        return [
          ['Date', formatDateTime(e.startDate, e.startTime)],
          ['End Date', formatDateTime(e.endDate, e.endTime)],
          ['Place', e.placeName],
          ['Address', e.address],
          ['Opening Hours', e.openingHours],
          ['Status', e.status]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'flight': {
        const e = event as FlightEvent;
        return [
          ['Airline', e.airline],
          ['Flight', e.flightNumber],
          ['Departure Airport', e.departureAirport],
          ['Departure', formatDateTime(e.startDate, e.departureTime)],
          ['Arrival Airport', e.arrivalAirport],
          ['Arrival', formatDateTime(e.endDate, e.arrivalTime)],
          ['Terminal', e.terminal],
          ['Gate', e.gate],
          ['Booking Ref', e.bookingReference],
          ['Status', e.status]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'train': {
        const e = event as TrainEvent;
        return [
          ['Operator', e.trainOperator],
          ['Train Number', e.trainNumber],
          ['Departure Station', e.departureStation],
          ['Departure', formatDateTime(e.startDate, e.departureTime)],
          ['Arrival Station', e.arrivalStation],
          ['Arrival', formatDateTime(e.endDate, e.arrivalTime)],
          ['Carriage', e.carriageNumber],
          ['Seat', e.seatNumber],
          ['Booking Ref', e.bookingReference],
          ['Status', e.status]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'rental_car': {
        const e = event as RentalCarEvent;
        return [
          ['Company', e.carCompany],
          ['Car Type', e.carType],
          ['Pickup Location', e.pickupLocation],
          ['Pickup', formatDateTime(e.startDate, e.pickupTime)],
          ['Dropoff Location', e.dropoffLocation],
          ['Dropoff', formatDateTime(e.endDate, e.dropoffTime)],
          ['License Plate', e.licensePlate],
          ['Booking Ref', e.bookingReference],
          ['Status', e.status]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'bus': {
        const e = event as BusEvent;
        return [
          ['Operator', e.busOperator],
          ['Bus Number', e.busNumber],
          ['Departure Station', e.departureStation],
          ['Departure', formatDateTime(e.startDate, e.departureTime)],
          ['Arrival Station', e.arrivalStation],
          ['Arrival', formatDateTime(e.endDate, e.arrivalTime)],
          ['Seat', e.seatNumber],
          ['Booking Ref', e.bookingReference],
          ['Status', e.status]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'activity': {
        const e = event as ActivityEvent;
        return [
          ['Date', formatDateTime(e.startDate, e.startTime)],
          ['End Date', formatDateTime(e.endDate, e.endTime)],
          ['Title', e.title],
          ['Type', e.activityType],
          ['Address', e.address],
          ['Status', e.status]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      default:
        return [];
    }
  };

  // Data Preparation
  const exportEvents = excludeAlternatives
    ? trip.events.filter((event) => event.status !== 'alternative')
    : trip.events;
  const sortedEvents = sortEventsByStart(exportEvents);
  const eventsByDate: Record<string, Event[]> = {};
  sortedEvents.forEach((event: Event) => {
    const dateKey = getExportDateKey(event);

    if (dateKey) {
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    } else {
      console.warn('Event has no valid date:', event);
    }
  });

  // HTML Generation
  const isCompact = mode === 'compact';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${encodeText(trip.name || 'Trip')} - Itinerary</title>
        <style>
          ${getExportStyles(mode)}
        </style>
      </head>
      <body>
        <main class="page-shell">
        <header>
          <p class="trip-kicker">Trip itinerary${isCompact ? ' · compact' : ''}</p>
          <h1 class="trip-title">${encodeText(trip.name || 'Trip')}</h1>
          ${!isCompact && trip.description ? `<p class="trip-description">${processText(trip.description)}</p>` : ''}
        </header>
        <section class="timeline-header">
          <div>
            <p class="timeline-label">Main itinerary</p>
            <h2 class="timeline-title">Trip Timeline</h2>
          </div>
          <span class="event-count">${sortedEvents.length} event${sortedEvents.length === 1 ? '' : 's'}</span>
        </section>
        ${Object.entries(eventsByDate)
          .map(([dateString, events]) => {
            const dateParts = formatTimelineDateForExport(dateString);
            return `
              <div class="date-group">
              <div class="date-header">
                <span class="date-dot"></span>
                <div>
                  <p class="date-weekday">${dateParts.weekday}</p>
                  <p class="date-value">${dateParts.date}</p>
                </div>
              </div>
              ${sortEventsByStart(events).map(event => {
                const thumbnail = encodeText(event.thumbnailUrl || eventThumbnails[event.id] || DEFAULT_THUMBNAILS[event.type as EventType] || DEFAULT_THUMBNAILS.default);
                const details = isCompact
                  ? getEventDetails(event).filter(([label]) => label !== 'Status').slice(0, 4)
                  : getEventDetails(event);
                const statusClass = event.status === 'exploring'
                  ? 'status-badge exploring'
                  : event.status === 'alternative'
                    ? 'status-badge exploring'
                    : 'status-badge';
                const eventClass = event.status === 'exploring' || event.status === 'alternative'
                  ? 'event-card exploring'
                  : 'event-card';
                const statusLabel = event.status === 'exploring'
                  ? EXPLORING_EVENT_UI_LABEL
                  : event.status === 'alternative'
                    ? 'Alternative'
                    : 'Confirmed';
                
                return `
                  <article class="${eventClass}">
                    <span class="timeline-point"></span>
                    <div class="event-content">
                      ${!isCompact ? `<img src="${thumbnail}" alt="${event.type}" class="event-thumbnail">` : ''}
                      <div class="event-body">
                      <div class="event-header">
                        <span class="event-icon">${getEventIcon(event.type)}</span>
                        <span class="event-type">${event.type.replace('_', ' ')}</span>
                        <span class="${statusClass}">${statusLabel}</span>
                        ${getTimeSummary(event) ? `<span class="time-chip">${getTimeSummary(event)}</span>` : ''}
                      </div>
                      <h3 class="event-title">${getEventTitle(event)}</h3>
                      ${!isCompact && event.type === 'destination' && (event as DestinationEvent).description ? 
                        `<div class="event-description">${processText((event as DestinationEvent).description)}</div>` : ''}
                      ${!isCompact && event.type === 'activity' && (event as ActivityEvent).description ? 
                        `<div class="event-description">${processText((event as ActivityEvent).description)}</div>` : ''}
                      ${details.length > 0 ? `
                      <div class="event-details">
                        ${details.map(([label, value]) => 
                          `<div class="event-detail-item">
                            <span class="event-detail-label">${label}:</span>
                            <span class="event-detail-value">${processText(value)}</span>
                          </div>`
                        ).join('')}
                      </div>` : ''}
                      ${!isCompact && event.notes ? `<div class="event-notes">${processText(event.notes)}</div>` : ''}
                    </div>
                    </div>
                  </article>
                `;
              }).join('')}
              </div>
            `;
          }).join('')}
        </main>
      </body>
    </html>
  `;

  return htmlContent;
};

// Function to trigger the export
export const exportHtml = (
  trip: Trip,
  eventThumbnails: { [key: string]: string },
  options: ItineraryExportOptions | ItineraryExportMode = 'detailed',
) => {
  const normalized: ItineraryExportOptions = typeof options === 'string'
    ? { mode: options }
    : options;
  const htmlContent = generateHtmlItinerary(
    trip,
    eventThumbnails,
    normalized.mode,
    normalized.excludeAlternatives,
  );
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Clean up the URL object after a delay
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};