const { randomUUID } = require('crypto');
const { generateAiText, getModelName } = require('./aiProvider');

const extractJsonObject = (text) => {
  const stripped = text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain a complete JSON object');
  }

  return stripped.slice(start, end + 1);
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? dateStr : date.toISOString().split('T')[0];
};

const formatTime = (timeStr) => {
  return timeStr ? ` at ${timeStr}` : '';
};

const DATE_FIELD_NAMES = [
  'date',
  'checkIn',
  'checkOut',
  'startDate',
  'endDate',
  'departureDate',
  'arrivalDate',
  'dropoffDate',
];

const hasExplicitYearInText = (text) => /\b(?:19|20)\d{2}\b/.test(text);

const getDateParts = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

const createDate = ({ year, month, day }) => {
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateOnly = (dateValue, endOfDay = false) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
};

const getTripDateRange = (trip) => {
  const start = getDateOnly(trip.startDate);
  const end = getDateOnly(trip.endDate, true);
  if (!start || !end) return null;
  return { start, end };
};

const formatDateParts = ({ year, month, day }) => (
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const getEventDateWindow = (fields) => {
  const parsedDates = DATE_FIELD_NAMES
    .map((field) => getDateParts(fields[field]))
    .filter(Boolean)
    .map(createDate)
    .filter(Boolean);

  if (parsedDates.length === 0) return null;

  return {
    start: new Date(Math.min(...parsedDates.map((date) => date.getTime()))),
    end: new Date(Math.max(...parsedDates.map((date) => date.getTime()))),
  };
};

const isWithinRange = (window, range) => (
  window && window.start >= range.start && window.end <= range.end
);

const normalizeYearlessDatesToTripRange = ({ eventData, trip, text }) => {
  const range = getTripDateRange(trip);
  if (!range || hasExplicitYearInText(text) || !eventData.fields) {
    return eventData;
  }

  const currentWindow = getEventDateWindow(eventData.fields);
  if (!currentWindow || isWithinRange(currentWindow, range)) {
    return eventData;
  }

  const tripStartYear = range.start.getFullYear();
  const tripEndYear = range.end.getFullYear();
  const candidateYears = Array.from(
    { length: tripEndYear - tripStartYear + 3 },
    (_, index) => tripStartYear - 1 + index,
  );

  const bestYear = candidateYears.find((year) => {
    const candidateFields = { ...eventData.fields };
    DATE_FIELD_NAMES.forEach((field) => {
      const parts = getDateParts(candidateFields[field]);
      if (parts) {
        candidateFields[field] = formatDateParts({ ...parts, year });
      }
    });

    return isWithinRange(getEventDateWindow(candidateFields), range);
  });

  if (!bestYear) {
    return eventData;
  }

  const fields = { ...eventData.fields };
  DATE_FIELD_NAMES.forEach((field) => {
    const parts = getDateParts(fields[field]);
    if (parts) {
      fields[field] = formatDateParts({ ...parts, year: bestYear });
    }
  });

  return {
    ...eventData,
    fields,
    reasoning: `${eventData.reasoning || ''} Dates omitted a year in the source text, so the year was inferred from the trip date range.`.trim(),
  };
};

const formatEventForPrompt = (event) => {
  switch (event.type) {
    case 'stay':
      return `Stay at ${event.accommodationName}${event.address ? ` in ${event.address}` : ''} from ${formatDate(event.startDate)} to ${formatDate(event.endDate)}${event.checkInTime ? ` (Check-in: ${event.checkInTime})` : ''}${event.checkOutTime ? ` (Check-out: ${event.checkOutTime})` : ''}`;
    case 'destination':
      return `Visit to ${event.placeName}${event.address ? ` at ${event.address}` : ''} from ${formatDate(event.startDate)} to ${formatDate(event.endDate)}${event.openingHours ? ` (Hours: ${event.openingHours})` : ''}`;
    case 'arrival':
      return `Arrival at ${event.airport}${formatTime(event.time)} on ${formatDate(event.startDate)}${event.flightNumber ? ` - Flight ${event.flightNumber}` : ''}${event.airline ? ` by ${event.airline}` : ''}`;
    case 'departure':
      return `Departure from ${event.airport}${formatTime(event.time)} on ${formatDate(event.startDate)}${event.flightNumber ? ` - Flight ${event.flightNumber}` : ''}${event.airline ? ` by ${event.airline}` : ''}`;
    case 'flight':
      return `Flight from ${event.departureAirport} to ${event.arrivalAirport} from ${formatDate(event.startDate)} to ${formatDate(event.endDate)}${event.airline ? ` by ${event.airline}` : ''}${event.flightNumber ? ` (${event.flightNumber})` : ''}${event.departureTime ? ` - Departure: ${event.departureTime}` : ''}${event.arrivalTime ? `, Arrival: ${event.arrivalTime}` : ''}`;
    case 'train':
      return `Train from ${event.departureStation} to ${event.arrivalStation} from ${formatDate(event.startDate)} to ${formatDate(event.endDate)}${event.trainOperator ? ` by ${event.trainOperator}` : ''}${event.trainNumber ? ` (${event.trainNumber})` : ''}${event.departureTime ? ` - Departure: ${event.departureTime}` : ''}${event.arrivalTime ? `, Arrival: ${event.arrivalTime}` : ''}`;
    case 'rental_car':
      return `Car rental from ${event.pickupLocation} to ${event.dropoffLocation} from ${formatDate(event.startDate)} to ${formatDate(event.endDate)}${event.carCompany ? ` from ${event.carCompany}` : ''}${event.carType ? ` (${event.carType})` : ''}${event.pickupTime ? ` - Pickup: ${event.pickupTime}` : ''}${event.dropoffTime ? `, Dropoff: ${event.dropoffTime}` : ''}`;
    case 'bus':
      return `Bus from ${event.departureStation} to ${event.arrivalStation} from ${formatDate(event.startDate)} to ${formatDate(event.endDate)}${event.busOperator ? ` by ${event.busOperator}` : ''}${event.busNumber ? ` (${event.busNumber})` : ''}${event.departureTime ? ` - Departure: ${event.departureTime}` : ''}${event.arrivalTime ? `, Arrival: ${event.arrivalTime}` : ''}`;
    case 'activity':
      return `Activity: ${event.title}${event.address ? ` at ${event.address}` : ''} from ${formatDate(event.startDate)} to ${formatDate(event.endDate)}${event.activityType ? ` (Type: ${event.activityType})` : ''}`;
    default:
      return `${event.type} from ${formatDate(event.startDate)} to ${formatDate(event.endDate)}`;
  }
};

const buildPrompt = ({ text, trip }) => `Parse the following text and extract travel event details. The text could be either a natural language description or an email containing reservation details. The events is related to this trip with the following info:

Trip Context:
- Name: ${trip.name}
- Description: ${trip.description || ''}
- Date Range: ${trip.startDate || ''} to ${trip.endDate || ''}
- Current Events: ${(trip.events || []).map(formatEventForPrompt).join('\n')}

Important Date/Time Rules:
1. All dates must be in YYYY-MM-DD format
2. All times must be in HH:mm format
3. For single-day events, startDate and endDate should be the same
4. For multi-day events (like stays), use the appropriate start and end dates
5. If the text includes month/day dates without a year, infer the year from the trip date range. Do not use the current calendar year unless it matches the trip.

Possible Event Types and Their Required Fields:

1. arrival:
   Required:
   - airport (string)
   - date (YYYY-MM-DD)
   - time (HH:mm)
   Optional: flightNumber, airline, terminal, gate, bookingReference

2. departure:
   Required:
   - airport (string)
   - date (YYYY-MM-DD)
   - time (HH:mm)
   Optional: flightNumber, airline, terminal, gate, bookingReference

3. stay:
   Required:
   - accommodationName (string)
   - checkIn (YYYY-MM-DD)
   - checkInTime (HH:mm)
   - checkOut (YYYY-MM-DD)
   - checkOutTime (HH:mm)
   Optional: address, reservationNumber, contactInfo, cost

4. destination:
   Required:
   - placeName (string)
   - startDate (YYYY-MM-DD)
   - startTime (HH:mm)
   - endDate (YYYY-MM-DD)
   - endTime (HH:mm)
   Optional: address, description

5. flight:
   Required:
   - departureAirport (string)
   - arrivalAirport (string)
   - departureDate (YYYY-MM-DD)
   - departureTime (HH:mm)
   - arrivalDate (YYYY-MM-DD)
   - arrivalTime (HH:mm)
   Optional: airline, flightNumber, terminal, gate, bookingReference, cost

6. train:
   Required: departureStation, arrivalStation, departureDate, departureTime, arrivalDate, arrivalTime
   Optional: trainNumber, trainOperator, carriageNumber, seatNumber, bookingReference, cost

7. rental_car:
   Required: pickupLocation, dropoffLocation, date, pickupTime, dropoffDate, dropoffTime
   Optional: carCompany, carType, licensePlate, bookingReference, cost

8. bus:
   Required: departureStation, arrivalStation, departureDate, departureTime, arrivalDate, arrivalTime
   Optional: busOperator, busNumber, seatNumber, bookingReference, cost

9. activity:
   Required: title, activityType, startDate, startTime, endDate, endTime
   Optional: address, description, cost

Common fields for all events:
- status: 'confirmed' | 'exploring' (default to 'confirmed')
- source: 'manual' | 'google_places' | 'google_flights' | 'booking.com' | 'airbnb' | 'expedia' | 'tripadvisor' | 'other' (default to 'other')
- location?: { lat: number, lng: number, address?: string }
- notes?: string
- thumbnailUrl?: string

Important flight related Event Rules:
1. For airline reservation receipts with scheduled flight segments:
   - Create one "flight" event for each scheduled flight segment.
   - Include both departure and arrival details for each segment.
   - This is important because the user's next real-world action is often departing from their origin airport, not only arriving at the trip destination.
   - DO NOT reduce an airline segment to only an "arrival" or "departure" event when the receipt contains complete flight departure and arrival details.
   - If a receipt contains multiple numbered flight segments, parse every segment that matches the trip.
   - A round-trip receipt usually has at least two "flight" events.

2. Use "arrival" or "departure" only when the text describes a standalone arrival/departure checkpoint without enough details to create a full flight event.

3. Do not stop after the first flight segment. If the text says "Flight 1 of 2" and "Flight 2 of 2", evaluate both segments and include both if they are relevant.

NOW THIS IS THE ACTUAL TEXT TO PARSE:
${text}

Return only valid JSON. Do not include markdown, comments, or explanatory text outside the JSON.
Use this exact JSON shape. For round-trip flight receipts, return "multiple" and include one full flight event per segment:
{
  "type": "multiple",
  "events": [{
    "type": "flight",
    "fields": {
      "departureAirport": "San Francisco, CA, US (SFO)",
      "arrivalAirport": "San José, CR (SJO)",
      "departureDate": "2026-06-17",
      "departureTime": "23:36",
      "arrivalDate": "2026-06-18",
      "arrivalTime": "07:15",
      "flightNumber": "UA2312",
      "airline": "United",
      "bookingReference": "B9YEB7"
    },
    "confidence": 0.95,
    "reasoning": "explanation of why this type was chosen and how the fields were extracted"
  }]
}`;

const buildBaseEvent = (type, user) => ({
  id: randomUUID(),
  type,
  status: 'confirmed',
  source: 'other',
  location: { lat: 0, lng: 0 },
  notes: 'Parsed from text',
  createdBy: {
    _id: user._id,
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl || null,
  },
  updatedBy: {
    _id: user._id,
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl || null,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  likes: [],
  dislikes: [],
});

const toNumberIfPresent = (value) => (value !== undefined ? Number(value) : undefined);

const toEvent = (eventData, user) => {
  if (!eventData.type || !eventData.fields || typeof eventData.confidence !== 'number') {
    throw new Error('Invalid event format in AI response');
  }

  const baseEvent = buildBaseEvent(eventData.type, user);
  const fields = eventData.fields;

  switch (eventData.type) {
    case 'arrival':
    case 'departure': {
      const { date, time, airport, ...rest } = fields;
      return { ...baseEvent, ...rest, startDate: `${date}T${time}:00`, endDate: `${date}T${time}:00`, date, time, airport };
    }
    case 'stay': {
      const { checkIn, checkInTime, checkOut, checkOutTime, accommodationName, cost, ...rest } = fields;
      return { ...baseEvent, ...rest, startDate: `${checkIn}T${checkInTime}:00`, endDate: `${checkOut}T${checkOutTime}:00`, checkIn, checkInTime, checkOut, checkOutTime, accommodationName, ...(cost !== undefined ? { cost: toNumberIfPresent(cost) } : {}) };
    }
    case 'destination': {
      const { startDate, startTime, endDate, endTime, placeName, ...rest } = fields;
      return { ...baseEvent, ...rest, startDate: `${startDate}T${startTime}:00`, endDate: `${endDate}T${endTime}:00`, startTime, endTime, placeName };
    }
    case 'activity': {
      const { startDate, startTime, endDate, endTime, title, activityType, cost, ...rest } = fields;
      return { ...baseEvent, ...rest, startDate: `${startDate}T${startTime}:00`, endDate: `${endDate}T${endTime}:00`, startTime, endTime, title, activityType, ...(cost !== undefined ? { cost: toNumberIfPresent(cost) } : {}) };
    }
    case 'flight': {
      const { departureDate, departureTime, arrivalDate, arrivalTime, departureAirport, arrivalAirport, cost, ...rest } = fields;
      return { ...baseEvent, ...rest, startDate: `${departureDate}T${departureTime}:00`, endDate: `${arrivalDate}T${arrivalTime}:00`, departureTime, arrivalTime, departureAirport, arrivalAirport, ...(cost !== undefined ? { cost: toNumberIfPresent(cost) } : {}) };
    }
    case 'train': {
      const { departureDate, departureTime, arrivalDate, arrivalTime, departureStation, arrivalStation, cost, ...rest } = fields;
      return { ...baseEvent, ...rest, startDate: `${departureDate}T${departureTime}:00`, endDate: `${arrivalDate}T${arrivalTime}:00`, departureTime, arrivalTime, departureStation, arrivalStation, ...(cost !== undefined ? { cost: toNumberIfPresent(cost) } : {}) };
    }
    case 'bus': {
      const { departureDate, departureTime, arrivalDate, arrivalTime, departureStation, arrivalStation, cost, ...rest } = fields;
      return { ...baseEvent, ...rest, startDate: `${departureDate}T${departureTime}:00`, endDate: `${arrivalDate}T${arrivalTime}:00`, departureTime, arrivalTime, departureStation, arrivalStation, ...(cost !== undefined ? { cost: toNumberIfPresent(cost) } : {}) };
    }
    case 'rental_car': {
      const { date, pickupTime, dropoffDate, dropoffTime, pickupLocation, dropoffLocation, cost, ...rest } = fields;
      return { ...baseEvent, ...rest, startDate: `${date}T${pickupTime}:00`, endDate: `${dropoffDate}T${dropoffTime}:00`, date, pickupTime, dropoffDate, dropoffTime, pickupLocation, dropoffLocation, ...(cost !== undefined ? { cost: toNumberIfPresent(cost) } : {}) };
    }
    default:
      throw new Error(`Unsupported event type: ${eventData.type}`);
  }
};

const parseEventText = async ({ text, trip, user }) => {
  const aiResponse = await generateAiText({
    prompt: buildPrompt({ text, trip }),
    temperature: 0.1,
    topK: 1,
    topP: 0.1,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
  });
  const responseText = aiResponse.text;

  if (!responseText) {
    throw new Error('Empty response from AI');
  }

  const parsed = JSON.parse(extractJsonObject(responseText));
  if (!parsed.type || !Array.isArray(parsed.events)) {
    throw new Error('Invalid response format from AI');
  }

  const events = parsed.events
    .map((eventData) => normalizeYearlessDatesToTripRange({ eventData, trip, text }))
    .map((eventData) => toEvent(eventData, user));
  return {
    provider: aiResponse.provider,
    model: aiResponse.model,
    events,
  };
};

module.exports = {
  MODEL_NAME: getModelName(),
  parseEventText,
};
