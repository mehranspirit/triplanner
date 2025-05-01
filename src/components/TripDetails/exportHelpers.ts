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

// Helper to sort events chronologically
const sortEvents = (events: Event[]): Event[] => {
  return [...events].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });
};

// Main function to generate HTML content
export const generateHtmlItinerary = (
  trip: Trip,
  eventThumbnails: { [key: string]: string }
): string => {
  if (!trip) return '';

  // Helper Functions (kept internal to this generation logic)
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'arrival':
      case 'departure':
      case 'flight':
        return '✈️';
      case 'stay':
        return '🏨';
      case 'destination':
        return '📍';
      case 'train':
        return '🚂';
      case 'rental_car':
        return '🚗';
      case 'bus':
        return '🚌';
      case 'activity':
        return '🏔️';
      default:
        return '📅';
    }
  };

  const getEventTitle = (event: Event): string => {
    const encodeText = (text: string | undefined | null) => {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    switch (event.type) {
      case 'arrival':
      case 'departure': {
        const e = event as ArrivalDepartureEvent;
        return `${event.type === 'arrival' ? 'Arrival at' : 'Departure from'} ${encodeText(e.airport || 'Airport')}`;
      }
      case 'stay': {
        const e = event as StayEvent;
        return encodeText(e.accommodationName || 'Accommodation');
      }
      case 'destination': {
        const e = event as DestinationEvent;
        return encodeText(e.placeName || 'Destination');
      }
      case 'flight': {
        const e = event as FlightEvent;
        return encodeText(`${e.airline || ''} ${e.flightNumber || 'Flight'}`.trim());
      }
      case 'train': {
        const e = event as TrainEvent;
        return encodeText(`${e.trainOperator || ''} ${e.trainNumber || 'Train'}`.trim());
      }
      case 'rental_car': {
        const e = event as RentalCarEvent;
        return encodeText(`${e.pickupLocation || ''} to ${e.dropoffLocation || ''}`);
      }
      case 'bus': {
        const e = event as BusEvent;
        return encodeText(`${e.busOperator || ''} ${e.busNumber || 'Bus'}`.trim());
      }
      case 'activity': {
        const e = event as ActivityEvent;
        return encodeText(`${e.title || 'Activity'} - ${e.activityType || ''}`.replace(/ - $/, ''));
      }
      default:
        return 'Event';
    }
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

  const getEventDetails = (event: Event): [string, string][] => {
    switch (event.type) {
      case 'arrival':
      case 'departure': {
        const e = event as ArrivalDepartureEvent;
        return [
          ['Time', e.time],
          ['Airport', e.airport],
          ['Airline', e.airline],
          ['Flight', e.flightNumber],
          ['Terminal', e.terminal],
          ['Gate', e.gate],
          ['Booking Ref', e.bookingReference]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'stay': {
        const e = event as StayEvent;
        return [
          ['Accommodation', e.accommodationName],
          ['Check-in', e.checkIn],
          ['Check-out', e.checkOut],
          ['Address', e.address],
          ['Reservation', e.reservationNumber],
          ['Contact', e.contactInfo]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'destination': {
        const e = event as DestinationEvent;
        return [
          ['Place', e.placeName],
          ['Address', e.address],
          ['Description', e.description],
          ['Opening Hours', e.openingHours]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'flight': {
        const e = event as FlightEvent;
        return [
          ['Airline', e.airline],
          ['Flight', e.flightNumber],
          ['Departure Airport', e.departureAirport],
          ['Departure Time', e.departureTime],
          ['Arrival Airport', e.arrivalAirport],
          ['Arrival Time', e.arrivalTime],
          ['Terminal', e.terminal],
          ['Gate', e.gate],
          ['Booking Ref', e.bookingReference]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'train': {
        const e = event as TrainEvent;
        return [
          ['Operator', e.trainOperator],
          ['Train Number', e.trainNumber],
          ['Departure Station', e.departureStation],
          ['Departure Time', e.departureTime],
          ['Arrival Station', e.arrivalStation],
          ['Arrival Time', e.arrivalTime],
          ['Carriage', e.carriageNumber],
          ['Seat', e.seatNumber],
          ['Booking Ref', e.bookingReference]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'rental_car': {
        const e = event as RentalCarEvent;
        return [
          ['Company', e.carCompany],
          ['Car Type', e.carType],
          ['Pickup Location', e.pickupLocation],
          ['Pickup Time', e.pickupTime],
          ['Dropoff Location', e.dropoffLocation],
          ['Dropoff Time', e.dropoffTime],
          ['Dropoff Date', e.dropoffDate],
          ['License Plate', e.licensePlate],
          ['Booking Ref', e.bookingReference]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'bus': {
        const e = event as BusEvent;
        return [
          ['Operator', e.busOperator],
          ['Bus Number', e.busNumber],
          ['Departure Station', e.departureStation],
          ['Departure Time', e.departureTime],
          ['Arrival Station', e.arrivalStation],
          ['Arrival Time', e.arrivalTime],
          ['Seat', e.seatNumber],
          ['Booking Ref', e.bookingReference]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      case 'activity': {
        const e = event as ActivityEvent;
        return [
          ['Title', e.title],
          ['Type', e.activityType],
          ['Address', e.address],
          ['Description', e.description]
        ].filter((item): item is [string, string] => !!item[1]);
      }
      default:
        return [];
    }
  };

  // Data Preparation
  const confirmedEvents = trip.events.filter((event: Event) => event.status === 'confirmed');
  const sortedEvents = sortEvents(confirmedEvents);
  const eventsByDate: Record<string, Event[]> = {};
  sortedEvents.forEach((event: Event) => {
    const dateString = event.date.split('T')[0];
    if (!eventsByDate[dateString]) {
      eventsByDate[dateString] = [];
    }
    eventsByDate[dateString].push(event);
  });

  // HTML Generation
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${trip.name || 'Trip'} - Itinerary</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .date-header {
            background-color: #EEF2FF;
            padding: 10px 15px;
            margin: 20px 0 10px;
            border-radius: 6px;
            font-weight: 500;
            color: #3730A3;
          }
          .event-card {
            border: 1px solid #E5E7EB;
            border-radius: 8px;
            padding: 0;
            margin-bottom: 15px;
            background-color: white;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            position: relative;
          }
          .event-thumbnail {
            position: absolute;
            top: 15px;
            right: 15px;
            width: 100px;
            height: 100px;
            object-fit: cover;
            border-radius: 6px;
            border: 1px solid #E5E7EB;
          }
          .event-content {
            padding: 15px;
            padding-right: 130px; /* Space for thumbnail */
          }
          .event-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
          }
          .event-icon {
            font-size: 24px;
            display: flex;
            align-items: center;
          }
          .event-type {
            color: #4F46E5;
            font-weight: 500;
            text-transform: capitalize;
          }
          .event-title {
            font-weight: 600;
            color: #111827;
            margin: 5px 0;
            font-size: 1.1em;
          }
          .event-details {
            color: #6B7280;
            font-size: 0.9em;
            margin-top: 10px;
          }
          .event-detail-item {
            display: flex;
            margin-bottom: 4px;
          }
          .event-detail-label {
            font-weight: 500;
            min-width: 100px;
            color: #4B5563;
          }
          .event-detail-value {
            color: #6B7280;
          }
          .event-notes {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #E5E7EB;
            color: #6B7280;
            font-style: italic;
            font-size: 0.85em;
            line-height: 1.4;
          }
          a {
            color: #4F46E5;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          @media print {
            body {
              padding: 0;
            }
            .event-card {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .date-header {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <h1 style="text-align: center; color: #111827; margin-bottom: 30px;">
          ${trip.name || 'Trip'} Itinerary
        </h1>
        ${Object.entries(eventsByDate)
          .map(([dateString, events]) => {
            return `
              <div class="date-header">
                ${formatDateForExport(dateString)}
              </div>
              ${events.map(event => {
                const thumbnail = event.thumbnailUrl || eventThumbnails[event.id] || DEFAULT_THUMBNAILS[event.type as EventType] || DEFAULT_THUMBNAILS.default;
                
                return `
                  <div class="event-card">
                    <div class="event-content">
                      <img src="${thumbnail}" alt="${event.type}" class="event-thumbnail">
                      <div class="event-header">
                        <span class="event-icon" style="font-size: 24px;">${getEventIcon(event.type)}</span>
                        <span class="event-type">${event.type.replace('_', ' ')}</span>
                      </div>
                      <div class="event-title">${getEventTitle(event)}</div>
                      ${event.type === 'destination' && (event as DestinationEvent).description ? 
                        `<div class="event-details truncate-text">${processText((event as DestinationEvent).description)}</div>` : ''}
                      <div class="event-details">
                        ${getEventDetails(event).map(([label, value]) => 
                          `<div class="event-detail-item">
                            <span class="event-detail-label">${label}:</span>
                            <span class="event-detail-value">${processText(value)}</span>
                          </div>`
                        ).join('')}
                      </div>
                      ${event.notes ? `<div class="event-notes">${processText(event.notes)}</div>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            `;
          }).join('')}
      </body>
    </html>
  `;

  return htmlContent;
};

// Function to trigger the export
export const exportHtml = (trip: Trip, eventThumbnails: { [key: string]: string }) => {
  const htmlContent = generateHtmlItinerary(trip, eventThumbnails);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Clean up the URL object after a delay
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
