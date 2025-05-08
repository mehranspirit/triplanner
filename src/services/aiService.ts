import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  Event, 
  DestinationEvent, 
  StayEvent, 
  ArrivalDepartureEvent,
  FlightEvent,
  TrainEvent,
  RentalCarEvent,
  BusEvent,
  EventType,
  ActivityEvent,
  User
} from '@/types/eventTypes';
import { v4 as uuidv4 } from 'uuid';

interface AISuggestionRequest {
  places: string[];
  activities: string[];
  tripDates: {
    startDate: string;
    endDate: string;
  };
}

interface DreamTripSuggestionRequest {
  places: string[];
  activities: string[];
  customPrompt: string;
}

interface TextEventParseRequest {
  text: string;
  trip: {
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    events: Event[];
  };
  user: {
    _id: string;
    name: string;
    email: string;
    photoUrl: string | null;
  };
}

interface ParsedEventData {
  type: EventType;
  fields: Record<string, any>;
  confidence: number;
  reasoning: string;
}

interface ParsedResponse {
  type: 'single' | 'multiple';
  events: ParsedEventData[];
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export const generateAISuggestions = async (request: AISuggestionRequest): Promise<string> => {
  // Format dates for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Ensure dates are in correct order
  const startDate = new Date(request.tripDates.startDate);
  const endDate = new Date(request.tripDates.endDate);
  const [earlierDate, laterDate] = startDate <= endDate 
    ? [request.tripDates.startDate, request.tripDates.endDate]
    : [request.tripDates.endDate, request.tripDates.startDate];

  const prompt = `Generate travel suggestions for a trip from ${formatDate(earlierDate)} to ${formatDate(laterDate)}.
Places to visit: ${request.places.join(', ')}
Interested in: ${request.activities.join(', ')}

Please provide detailed suggestions for activities and experiences in a clear, organized format. Include:

1. Overview
- Brief introduction to the destination
- Best time to visit
- How many days recommended

2. Must-See Attractions
- Name and description of each attraction
- Recommended duration
- Best time to visit
- Practical tips

3. Recommended Activities
- Detailed activity descriptions
- Duration and difficulty level where applicable
- Best time for each activity
- Required equipment or preparation

4. Local Experiences
- Cultural activities
- Food and dining recommendations
- Local customs and etiquette
- Hidden gems

5. Practical Information
- Transportation tips
- Accommodation suggestions
- Safety considerations
- Money-saving tips

Format the response in clear sections with proper spacing. Use simple dashes (-) for bullet points. Do not use asterisks or other special formatting characters.`;

  // Log the full prompt
  // console.log('AI Suggestion Prompt:', {
  //   tripDates: {
  //     startDate: formatDate(earlierDate),
  //     endDate: formatDate(laterDate)
  //   },
  //   places: request.places,
  //   activities: request.activities,
  //   fullPrompt: prompt
  // });

  try {
    // Configure generation parameters for cleaner formatting
    const generationConfig = {
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    };

    // Generate content with Gemini
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    let text = response.text();
    
    if (!text) {
      throw new Error('Empty response from AI');
    }

    // Clean up the response
    text = text
      // Remove any asterisks
      .replace(/\*/g, '')
      // Remove any double asterisks
      .replace(/\*\*/g, '')
      // Ensure consistent bullet points and remove extra bullets before dashed items
      .replace(/[•●■]/g, '-')
      .replace(/\s*[•●■-]\s*-\s*/g, '- ')
      // Remove any multiple dashes
      .replace(/--+/g, '-')
      // Ensure proper spacing after section numbers
      .replace(/(\d+\.)\s*([A-Z])/g, '$1 $2')
      // Remove any extra newlines
      .replace(/\n{3,}/g, '\n\n')
      // Ensure proper spacing after bullet points
      .replace(/\n-\s*/g, '\n- ')
      // Add extra indentation for subcategories while keeping the dash
      .replace(/\n\s*-\s+(Duration:|Best time|Practical|Recommended)/g, '\n    - $1')
      // Clean up any remaining formatting artifacts
      .replace(/^\s*-\s*([A-Z][^:]+):\s*$/gm, '$1:');
    
    return text;
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate suggestions. Please try again later.');
  }
};

export const generateDreamTripSuggestions = async (request: DreamTripSuggestionRequest): Promise<string> => {
  const basePrompt = `Generate dream trip suggestions based on the following preferences:
Places of interest: ${request.places.join(', ')}
Activities of interest: ${request.activities.join(', ')}

${request.customPrompt ? `Additional requirements: ${request.customPrompt}\n\n` : ''}
Please provide detailed suggestions for a dream trip in the following structured format:

1. Dream Destination Overview
- Introduction to why this destination is perfect
- Best seasons to visit
- Recommended duration
- Unique selling points

2. Signature Experiences
- Must-do activities and attractions
- Hidden gems and unique opportunities
- Special seasonal events
- Photography spots and viewpoints

3. Luxury & Special Experiences
- High-end accommodations
- Fine dining recommendations
- VIP tours and exclusive access
- Wellness and spa experiences

4. Adventure & Activities
- Outdoor activities and adventures
- Cultural experiences
- Local workshops and classes
- Private guides and experts

5. Planning & Logistics
- Best ways to reach the destination
- Local transportation options
- Recommended trip flow
- Booking tips and contacts

Format the response in clear sections with proper spacing. Use simple dashes (-) for bullet points. Do not use asterisks or other special formatting characters. For subcategories, use indented dashes.`;

  try {
    // Configure generation parameters for cleaner formatting
    const generationConfig = {
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    };

    // Generate content with Gemini
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: basePrompt }] }],
      generationConfig,
    });

    const response = await result.response;
    let text = response.text();
    
    if (!text) {
      throw new Error('Empty response from AI');
    }
    
    // Clean up the response using the same formatting strategy
    text = text
      // Remove any asterisks
      .replace(/\*/g, '')
      // Remove any double asterisks
      .replace(/\*\*/g, '')
      // Ensure consistent bullet points and remove extra bullets before dashed items
      .replace(/[•●■]/g, '-')
      .replace(/\s*[•●■-]\s*-\s*/g, '- ')
      // Remove any multiple dashes
      .replace(/--+/g, '-')
      // Ensure proper spacing after section numbers
      .replace(/(\d+\.)\s*([A-Z])/g, '$1 $2')
      // Remove any extra newlines
      .replace(/\n{3,}/g, '\n\n')
      // Ensure proper spacing after bullet points
      .replace(/\n-\s*/g, '\n- ')
      // Add extra indentation for subcategories while keeping the dash
      .replace(/\n\s*-\s+(Duration:|Best time|Practical|Recommended|Price|Location|Hours|Tips|Details|When|Where|Cost|Contact|Booking|Note):/g, '\n    - $1')
      // Clean up any remaining formatting artifacts
      .replace(/^\s*-\s*([A-Z][^:]+):\s*$/gm, '$1:');
    
    return text;
  } catch (error) {
    console.error('Error generating dream trip suggestions:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate dream trip suggestions. Please try again later.');
  }
};

const formatEventForPrompt = (event: Event): string => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (time?: string) => time ? ` at ${time}` : '';

  switch (event.type) {
    case 'stay': {
      const e = event as StayEvent;
      return `Stay at ${e.accommodationName}${e.address ? ` in ${e.address}` : ''} from ${formatDate(e.startDate)} to ${formatDate(e.endDate)}${e.checkInTime ? ` (Check-in: ${e.checkInTime})` : ''}${e.checkOutTime ? ` (Check-out: ${e.checkOutTime})` : ''}`;
    }
    case 'destination': {
      const e = event as DestinationEvent;
      return `Visit to ${e.placeName}${e.address ? ` at ${e.address}` : ''} from ${formatDate(e.startDate)} to ${formatDate(e.endDate)}${e.openingHours ? ` (Hours: ${e.openingHours})` : ''}`;
    }
    case 'arrival': {
      const e = event as ArrivalDepartureEvent;
      return `Arrival at ${e.airport}${formatTime(e.time)} on ${formatDate(e.startDate)}${e.flightNumber ? ` - Flight ${e.flightNumber}` : ''}${e.airline ? ` by ${e.airline}` : ''}`;
    }
    case 'departure': {
      const e = event as ArrivalDepartureEvent;
      return `Departure from ${e.airport}${formatTime(e.time)} on ${formatDate(e.startDate)}${e.flightNumber ? ` - Flight ${e.flightNumber}` : ''}${e.airline ? ` by ${e.airline}` : ''}`;
    }
    case 'flight': {
      const e = event as FlightEvent;
      return `Flight from ${e.departureAirport} to ${e.arrivalAirport} from ${formatDate(e.startDate)} to ${formatDate(e.endDate)}${e.airline ? ` by ${e.airline}` : ''}${e.flightNumber ? ` (${e.flightNumber})` : ''}${e.departureTime ? ` - Departure: ${e.departureTime}` : ''}${e.arrivalTime ? `, Arrival: ${e.arrivalTime}` : ''}`;
    }
    case 'train': {
      const e = event as TrainEvent;
      return `Train from ${e.departureStation} to ${e.arrivalStation} from ${formatDate(e.startDate)} to ${formatDate(e.endDate)}${e.trainOperator ? ` by ${e.trainOperator}` : ''}${e.trainNumber ? ` (${e.trainNumber})` : ''}${e.departureTime ? ` - Departure: ${e.departureTime}` : ''}${e.arrivalTime ? `, Arrival: ${e.arrivalTime}` : ''}`;
    }
    case 'rental_car': {
      const e = event as RentalCarEvent;
      return `Car rental from ${e.pickupLocation} to ${e.dropoffLocation} from ${formatDate(e.startDate)} to ${formatDate(e.endDate)}${e.carCompany ? ` from ${e.carCompany}` : ''}${e.carType ? ` (${e.carType})` : ''}${e.pickupTime ? ` - Pickup: ${e.pickupTime}` : ''}${e.dropoffTime ? `, Dropoff: ${e.dropoffTime}` : ''}`;
    }
    case 'bus': {
      const e = event as BusEvent;
      return `Bus from ${e.departureStation} to ${e.arrivalStation} from ${formatDate(e.startDate)} to ${formatDate(e.endDate)}${e.busOperator ? ` by ${e.busOperator}` : ''}${e.busNumber ? ` (${e.busNumber})` : ''}${e.departureTime ? ` - Departure: ${e.departureTime}` : ''}${e.arrivalTime ? `, Arrival: ${e.arrivalTime}` : ''}`;
    }
    case 'activity': {
      const e = event as ActivityEvent;
      return `Activity: ${e.title}${e.address ? ` at ${e.address}` : ''} from ${formatDate(e.startDate)} to ${formatDate(e.endDate)}${e.activityType ? ` (Type: ${e.activityType})` : ''}`;
    }
    default:
      return `${event.type} from ${formatDate(event.startDate)} to ${formatDate(event.endDate)}`;
  }
};

export const generateDestinationSuggestions = async (
  existingEvents: Event[],
  tripDates: { startDate: string; endDate: string },
  user: User
): Promise<Event[]> => {
  try {
    // Filter out existing AI suggestions
    const nonAISuggestions = existingEvents.filter(event => !(event as any).isAISuggestion);
    
    // Format existing events for the prompt
    const formattedEvents = nonAISuggestions.map(formatEventForPrompt).join('\n\n');

    const prompt = `Generate exactly 3 new event suggestions for a trip, following these rules:
1. Generate in this order: cultural destination, outdoor activity, local experience
2. Each suggestion must include:
   - A descriptive title/name
   - A detailed description
   - A relevant image URL (Must start with https://images.unsplash.com/ or https://source.unsplash.com/ Check they return HTTP 200.)
   - Start date and time (in YYYY-MM-DD and HH:mm format)
   - End date and time (in YYYY-MM-DD and HH:mm format)
   - Address (if applicable)
   - Activity type (for activities)
   - Opening hours (for destinations)
3. All dates must be between ${tripDates.startDate} and ${tripDates.endDate}
4. All dates must be in YYYY-MM-DD format
5. All times must be in HH:mm format
6. Do not overlap with existing events
7. Ensure suggestions are diverse and complement each other

Existing events:
${formattedEvents}

Format each suggestion like this:
SUGGESTION_START
type: [ONLY either "activity" or "destination"]
title/placeName: [name]
description: [detailed description]
imageUrl: [a relevant image URL]
startDate: YYYY-MM-DD
startTime: HH:mm
endDate: YYYY-MM-DD
endTime: HH:mm
address: [full address]
activityType: [for activities only]
openingHours: [for destinations only]
SUGGESTION_END`;

    // Log the prompt
    //console.log('AI Suggestion Prompt:', prompt);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2000
      }
    });

    const response = await result.response;
    const content = response.text();
    
    // Log the raw AI response
    //console.log('Raw AI Response:', content);
    
    if (!content) throw new Error('No response from AI');

    // Parse suggestions
    const suggestions: Event[] = [];
    const suggestionBlocks = content.split('SUGGESTION_START').slice(1);

    // Log the parsed suggestion blocks
    //console.log('Parsed Suggestion Blocks:', suggestionBlocks);

    for (const block of suggestionBlocks) {
      const suggestionContent = block.split('SUGGESTION_END')[0].trim();
      const lines = suggestionContent.split('\n').map((line: string) => line.trim());
      
      const fields: Record<string, string> = {};
      lines.forEach((line: string) => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          fields[key.trim()] = valueParts.join(':').trim();
        }
      });

      // Log the parsed fields for each suggestion
      //console.log('Parsed Fields for Suggestion:', fields);

      // Create base event
      const baseEvent = {
        id: uuidv4(),
        type: fields.type as 'activity' | 'destination',
        startDate: fields.startDate,
        endDate: fields.endDate,
        startTime: fields.startTime,
        endTime: fields.endTime,
        description: fields.description,
        isAISuggestion: true,
        createdBy: user,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: user,
        status: 'exploring' as const,
        likes: [],
        dislikes: [],
        //thumbnailUrl: fields.imageUrl
      };

      if (fields.type === 'activity') {
        suggestions.push({
          ...baseEvent,
          title: fields['title/placeName'],
          activityType: fields.activityType,
          address: fields.address
        } as unknown as ActivityEvent);
      } else {
        suggestions.push({
          ...baseEvent,
          placeName: fields['title/placeName'],
          address: fields.address,
          openingHours: fields.openingHours
        } as unknown as DestinationEvent);
      }
    }

    // Log the final suggestions
    //console.log('Final Generated Suggestions:', suggestions);

    return suggestions;
  } catch (error) {
    console.error('Error generating suggestions:', error);
    throw error;
  }
};

export const parseEventFromText = async (request: TextEventParseRequest): Promise<Event | Event[]> => {
  const prompt = `Parse the following text and extract travel event details. The text could be either a natural language description or an email containing reservation details. The events is related to this trip with the following info:

Trip Context:
- Name: ${request.trip.name}
- Description: ${request.trip.description}
- Date Range: ${request.trip.startDate} to ${request.trip.endDate}
- Current Events: ${request.trip.events.map(formatEventForPrompt).join('\n')}

Important Date/Time Rules:
1. All dates must be in YYYY-MM-DD format
2. All times must be in HH:mm format
3. For single-day events, startDate and endDate should be the same
4. For multi-day events (like stays), use the appropriate start and end dates

Possible Event Types and Their Required Fields:

1. arrival:
   Required:
   - airport (string)
   - date (YYYY-MM-DD)
   - time (HH:mm)
   Optional:
   - flightNumber (string)
   - airline (string)
   - terminal (string)
   - gate (string)
   - bookingReference (string)

2. departure:
   Required:
   - airport (string)
   - date (YYYY-MM-DD)
   - time (HH:mm)
   Optional:
   - flightNumber (string)
   - airline (string)
   - terminal (string)
   - gate (string)
   - bookingReference (string)

3. stay:
   Required:
   - accommodationName (string)
   - checkIn (YYYY-MM-DD)
   - checkInTime (HH:mm)
   - checkOut (YYYY-MM-DD)
   - checkOutTime (HH:mm)
   Optional:
   - address (string)
   - reservationNumber (string)
   - contactInfo (string)

4. destination:
   Required:
   - placeName (string)
   - startDate (YYYY-MM-DD)
   - startTime (HH:mm)
   - endDate (YYYY-MM-DD)
   - endTime (HH:mm)
   Optional:
   - address (string)
   - description (string)

5. flight:
   Required:
   - departureAirport (string)
   - arrivalAirport (string)
   - departureDate (YYYY-MM-DD)
   - departureTime (HH:mm)
   - arrivalDate (YYYY-MM-DD)
   - arrivalTime (HH:mm)
   Optional:
   - airline (string)
   - flightNumber (string)
   - terminal (string)
   - gate (string)
   - bookingReference (string)

6. train:
   Required:
   - departureStation (string)
   - arrivalStation (string)
   - departureDate (YYYY-MM-DD)
   - departureTime (HH:mm)
   - arrivalDate (YYYY-MM-DD)
   - arrivalTime (HH:mm)
   Optional:
   - trainNumber (string)
   - trainOperator (string)
   - carriageNumber (string)
   - seatNumber (string)
   - bookingReference (string)

7. rental_car:
   Required:
   - pickupLocation (string)
   - dropoffLocation (string)
   - date (YYYY-MM-DD) (pickup date)
   - pickupTime (HH:mm)
   - dropoffDate (YYYY-MM-DD)
   - dropoffTime (HH:mm)
   Optional:
   - carCompany (string)
   - carType (string)
   - licensePlate (string)
   - bookingReference (string)

8. bus:
   Required:
   - departureStation (string)
   - arrivalStation (string)
   - departureDate (YYYY-MM-DD)
   - departureTime (HH:mm)
   - arrivalDate (YYYY-MM-DD)
   - arrivalTime (HH:mm)
   Optional:
   - busOperator (string)
   - busNumber (string)
   - seatNumber (string)
   - bookingReference (string)

9. activity:
   Required:
   - title (string)
   - activityType (string)
   - startDate (YYYY-MM-DD)
   - startTime (HH:mm)
   - endDate (YYYY-MM-DD)
   - endTime (HH:mm)
   Optional:
   - address (string)
   - description (string)

Common fields for all events:
- status: 'confirmed' | 'exploring' (default to 'confirmed')
- source: 'manual' | 'google_places' | 'google_flights' | 'booking.com' | 'airbnb' | 'expedia' | 'tripadvisor' | 'other' (default to 'other')
- location?: { lat: number, lng: number, address?: string }
- notes?: string
- thumbnailUrl?: string

Important flight related Event Rules:
1. For text or reservation containing flights TO or FROM the trip destination:
   - Create "arrival" events for flights TO the destination. for these events use the airport we're flying to as the airport field.
   - Create "departure" events for flights FROM the destination. for these events use the airport we're flying from as the airport field.
   - DO NOT create additional "flight" events for these cases

2. For flights WITHIN the trip dates and between locations during the trip:
   - Create ONLY a "flight" event
   - DO NOT create "arrival" or "departure" events for these cases

3. If you are parsing an Arrival and a Departure from the same text or reservation, DO NOT create additional Flight events.

NOW THIS IS THE ACTUAL TEXT TO PARSE:
${request.text}

Return the response in this exact JSON format:
{
  "type": "single" | "multiple", (based on how many events you detected in the text. Return flights with both arrival to and departure from the trip destination are also multiple events)
  "events": [{
    "type": "one of: arrival, departure, stay, destination, flight, train, rental_car, bus, activity",
    "fields": {
      // All fields matching the type's interface, including required and any detected optional fields
      // Dates must be in YYYY-MM-DD format
      // Times must be in HH:mm format
      // Include status (default to 'confirmed')
      // Include source (default to 'other')
    },
    "confidence": 0-1 score of confidence in the parsing,
    "reasoning": "explanation of why this type was chosen and how the fields were extracted"
  }]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 1024,
      },
    });

    const response = await result.response;
    const text = response.text();
    
    if (!text) {
      throw new Error('Empty response from AI');
    }

    // Log the raw response
    //console.log('Raw AI response:', text);

    // Clean up the response text
    const cleanText = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()
      .replace(/^[^{]*({.*})[^}]*$/s, '$1')
      .replace(/\\"/g, '"');

    const parsed = JSON.parse(cleanText) as ParsedResponse;
    
    if (!parsed.type || !parsed.events || !Array.isArray(parsed.events)) {
      throw new Error('Invalid response format from AI');
    }

    // Convert the parsed events into actual Event objects
    const events = parsed.events.map((eventData: ParsedEventData) => {
      if (!eventData.type || !eventData.fields || typeof eventData.confidence !== 'number') {
        throw new Error('Invalid event format in AI response');
      }

      // Create base event with user information
      const baseEvent: Partial<Event> = {
        id: uuidv4(),
        type: eventData.type,
        status: 'confirmed',
        source: 'other' as const,
        location: { lat: 0, lng: 0 },
        notes: `Parsed from text`,
        createdBy: {
          _id: request.user._id,
          name: request.user.name,
          email: request.user.email,
          photoUrl: request.user.photoUrl
        },
        updatedBy: {
          _id: request.user._id,
          name: request.user.name,
          email: request.user.email,
          photoUrl: request.user.photoUrl
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likes: [],
        dislikes: []
      };

      // Process event-specific fields and construct startDate/endDate
      let event: Event;
      
      switch (eventData.type) {
        case 'arrival':
        case 'departure': {
          const { date, time, airport, ...rest } = eventData.fields;
          event = {
            ...baseEvent,
            ...rest,
            startDate: `${date}T${time}:00`,
            endDate: `${date}T${time}:00`,
            date,
            time,
            airport,
          } as ArrivalDepartureEvent;
          break;
        }
        case 'stay': {
          const { checkIn, checkInTime, checkOut, checkOutTime, accommodationName, ...rest } = eventData.fields;
          event = {
            ...baseEvent,
            ...rest,
            startDate: `${checkIn}T${checkInTime}:00`,
            endDate: `${checkOut}T${checkOutTime}:00`,
            checkIn,
            checkInTime,
            checkOut,
            checkOutTime,
            accommodationName,
          } as StayEvent;
          break;
        }
        case 'destination': {
          const { startDate, startTime, endDate, endTime, placeName, ...rest } = eventData.fields;
          event = {
            ...baseEvent,
            ...rest,
            startDate: `${startDate}T${startTime}:00`,
            endDate: `${endDate}T${endTime}:00`,
            startTime,
            endTime,
            placeName,
          } as DestinationEvent;
          break;
        }
        case 'activity': {
          const { startDate, startTime, endDate, endTime, title, activityType, ...rest } = eventData.fields;
          event = {
            ...baseEvent,
            ...rest,
            startDate: `${startDate}T${startTime}:00`,
            endDate: `${endDate}T${endTime}:00`,
            startTime,
            endTime,
            title,
            activityType,
          } as ActivityEvent;
          break;
        }
        case 'flight': {
          const { departureDate, departureTime, arrivalDate, arrivalTime, departureAirport, arrivalAirport, ...rest } = eventData.fields;
          event = {
            ...baseEvent,
            ...rest,
            startDate: `${departureDate}T${departureTime}:00`,
            endDate: `${arrivalDate}T${arrivalTime}:00`,
            departureTime,
            arrivalTime,
            departureAirport,
            arrivalAirport,
          } as FlightEvent;
          break;
        }
        case 'train': {
          const { departureDate, departureTime, arrivalDate, arrivalTime, departureStation, arrivalStation, ...rest } = eventData.fields;
          event = {
            ...baseEvent,
            ...rest,
            startDate: `${departureDate}T${departureTime}:00`,
            endDate: `${arrivalDate}T${arrivalTime}:00`,
            departureTime,
            arrivalTime,
            departureStation,
            arrivalStation,
          } as TrainEvent;
          break;
        }
        case 'bus': {
          const { departureDate, departureTime, arrivalDate, arrivalTime, departureStation, arrivalStation, ...rest } = eventData.fields;
          event = {
            ...baseEvent,
            ...rest,
            startDate: `${departureDate}T${departureTime}:00`,
            endDate: `${arrivalDate}T${arrivalTime}:00`,
            departureTime,
            arrivalTime,
            departureStation,
            arrivalStation,
          } as BusEvent;
          break;
        }
        case 'rental_car': {
          const { date, pickupTime, dropoffDate, dropoffTime, pickupLocation, dropoffLocation, ...rest } = eventData.fields;
          event = {
            ...baseEvent,
            ...rest,
            startDate: `${date}T${pickupTime}:00`,
            endDate: `${dropoffDate}T${dropoffTime}:00`,
            date,
            pickupTime,
            dropoffDate,
            dropoffTime,
            pickupLocation,
            dropoffLocation,
          } as RentalCarEvent;
          break;
        }
        default:
          throw new Error(`Unsupported event type: ${eventData.type}`);
      }

      return event;
    });

    // If there's only one event, return it directly
    // If there are multiple events (like arrival and departure from the same flight booking),
    // return the array of events
    return parsed.type === 'single' ? events[0] : events;
  } catch (error) {
    console.error('Error parsing event from text:', error);
    throw new Error('Failed to parse event details. Please try again or enter details manually.');
  }
};

// Update the event creation to use startDate and endDate
const createEvent = (e: any): Event => {
  const suggestedDate = e.SUGGESTED_DATE || new Date().toISOString().split('T')[0];
  const suggestedTime = e.SUGGESTED_TIME || '12:00';

  return {
    id: uuidv4(),
    type: e.type,
    startDate: `${suggestedDate}T${suggestedTime}:00`,
    endDate: `${suggestedDate}T${suggestedTime}:00`,
    notes: e.notes,
    status: 'exploring',
    source: 'other',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    location: {
      lat: 0,
      lng: 0,
      address: e.address
    },
    createdBy: {
      _id: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
      photoUrl: 'https://example.com/photo.jpg'
    },
    updatedBy: {
      _id: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
      photoUrl: 'https://example.com/photo.jpg'
    }
  };
};

// Update the example events to use startDate and endDate
const exampleEvents = {
  activity: {
    type: 'activity' as const,
    title: 'Hiking',
    activityType: 'outdoor',
    address: '123 Mountain Trail',
    description: 'Scenic mountain hike',
    startDate: '2024-07-01T09:00:00',
    startTime: '09:00',
    endDate: '2024-07-01T17:00:00',
    endTime: '17:00',
    notes: 'Bring water and snacks',
    status: 'exploring' as const,
    source: 'other' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    location: {
      lat: 0,
      lng: 0,
      address: '123 Mountain Trail'
    },
    createdBy: {
      _id: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
      photoUrl: 'https://example.com/photo.jpg'
    },
    updatedBy: {
      _id: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
      photoUrl: 'https://example.com/photo.jpg'
    }
  } as ActivityEvent,
  destination: {
    type: 'destination' as const,
    placeName: 'Eiffel Tower',
    address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
    description: 'Famous landmark',
    openingHours: '9:00-23:00',
    startDate: '2024-07-01T10:00:00',
    startTime: '10:00',
    endDate: '2024-07-01T12:00:00',
    endTime: '12:00',
    notes: 'Book tickets in advance',
    status: 'exploring' as const,
    source: 'other' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    location: {
      lat: 48.8584,
      lng: 2.2945,
      address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France'
    },
    createdBy: {
      _id: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
      photoUrl: 'https://example.com/photo.jpg'
    },
    updatedBy: {
      _id: 'user123',
      name: 'John Doe',
      email: 'john@example.com',
      photoUrl: 'https://example.com/photo.jpg'
    }
  } as DestinationEvent
}; 