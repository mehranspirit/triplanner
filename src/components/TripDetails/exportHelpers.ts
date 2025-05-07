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
import { FaPlane, FaTrain, FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain } from 'react-icons/fa';

// Helper function to get event date
const getEventDate = (event: Event): string | undefined => {
  switch (event.type) {
    case 'stay':
      return (event as StayEvent).checkIn || event.startDate;
    case 'arrival':
    case 'departure':
      return (event as ArrivalDepartureEvent).date || event.startDate;
    case 'rental_car':
      return (event as RentalCarEvent).date || event.startDate;
    default:
      return event.startDate;
  }
};

// Helper to sort events chronologically
const sortEvents = (events: Event[]): Event[] => {
  return [...events].sort((a, b) => {
    const dateA = getEventDate(a);
    const dateB = getEventDate(b);
    if (!dateA || !dateB) return 0;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
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
  const confirmedEvents = trip.events.filter((event: Event) => event.status === 'confirmed');
  const sortedEvents = sortEvents(confirmedEvents);
  const eventsByDate: Record<string, Event[]> = {};
  sortedEvents.forEach((event: Event) => {
    const dateString = getEventDate(event);
    
    // Extract date part and normalize format
    if (dateString) {
      const datePart = dateString.includes('T') ? dateString.split('T')[0] : dateString;
      if (!eventsByDate[datePart]) {
        eventsByDate[datePart] = [];
      }
      eventsByDate[datePart].push(event);
    } else {
      console.warn('Event has no valid date:', event);
    }
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
            font-size: 0.875rem;
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
            min-width: 120px;
            color: #4B5563;
          }
          .event-detail-value {
            color: #6B7280;
            flex: 1;
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
          .event-description {
            margin-top: 8px;
            color: #4B5563;
            font-size: 0.9em;
            line-height: 1.5;
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
                const details = getEventDetails(event);
                
                return `
                  <div class="event-card">
                    <div class="event-content">
                      <img src="${thumbnail}" alt="${event.type}" class="event-thumbnail">
                      <div class="event-header">
                        <span class="event-icon">${getEventIcon(event.type)}</span>
                        <span class="event-type">${event.type.replace('_', ' ')}</span>
                      </div>
                      <div class="event-title">${getEventTitle(event)}</div>
                      ${event.type === 'destination' && (event as DestinationEvent).description ? 
                        `<div class="event-description">${processText((event as DestinationEvent).description)}</div>` : ''}
                      ${event.type === 'activity' && (event as ActivityEvent).description ? 
                        `<div class="event-description">${processText((event as ActivityEvent).description)}</div>` : ''}
                      <div class="event-details">
                        ${details.map(([label, value]) => 
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