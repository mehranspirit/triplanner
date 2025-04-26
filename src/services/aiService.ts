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
  ActivityEvent
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
  const prompt = `Generate travel suggestions for a trip from ${request.tripDates.startDate} to ${request.tripDates.endDate}.
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
      return `Stay at ${e.accommodationName} in ${e.address} from ${formatDate(e.date)} to ${formatDate(e.checkOut || e.date)}`;
    }
    case 'destination': {
      const e = event as DestinationEvent;
      return `Visit to ${e.placeName}${e.address ? ` at ${e.address}` : ''} on ${formatDate(e.date)}${e.openingHours ? ` (Hours: ${e.openingHours})` : ''}`;
    }
    case 'arrival': {
      const e = event as ArrivalDepartureEvent;
      return `Arrival at ${e.airport}${formatTime(e.time)} on ${formatDate(e.date)}${e.flightNumber ? ` - Flight ${e.flightNumber}` : ''}${e.airline ? ` by ${e.airline}` : ''}`;
    }
    case 'departure': {
      const e = event as ArrivalDepartureEvent;
      return `Departure from ${e.airport}${formatTime(e.time)} on ${formatDate(e.date)}${e.flightNumber ? ` - Flight ${e.flightNumber}` : ''}${e.airline ? ` by ${e.airline}` : ''}`;
    }
    case 'flight': {
      const e = event as FlightEvent;
      return `Flight from ${e.departureAirport} to ${e.arrivalAirport} on ${formatDate(e.date)}${e.airline ? ` by ${e.airline}` : ''}${e.flightNumber ? ` (${e.flightNumber})` : ''}${e.departureTime ? ` - Departure: ${e.departureTime}` : ''}${e.arrivalTime ? `, Arrival: ${e.arrivalTime}` : ''}`;
    }
    case 'train': {
      const e = event as TrainEvent;
      return `Train from ${e.departureStation} to ${e.arrivalStation} on ${formatDate(e.date)}${e.trainOperator ? ` by ${e.trainOperator}` : ''}${e.trainNumber ? ` (${e.trainNumber})` : ''}${e.departureTime ? ` - Departure: ${e.departureTime}` : ''}${e.arrivalTime ? `, Arrival: ${e.arrivalTime}` : ''}`;
    }
    case 'rental_car': {
      const e = event as RentalCarEvent;
      return `Car rental from ${e.pickupLocation} to ${e.dropoffLocation} on ${formatDate(e.date)}${e.carCompany ? ` from ${e.carCompany}` : ''}${e.carType ? ` (${e.carType})` : ''}${e.pickupTime ? ` - Pickup: ${e.pickupTime}` : ''}${e.dropoffTime ? `, Dropoff: ${e.dropoffTime}` : ''}${e.dropoffDate ? ` until ${formatDate(e.dropoffDate)}` : ''}`;
    }
    case 'bus': {
      const e = event as BusEvent;
      return `Bus from ${e.departureStation} to ${e.arrivalStation} on ${formatDate(e.date)}${e.busOperator ? ` by ${e.busOperator}` : ''}${e.busNumber ? ` (${e.busNumber})` : ''}${e.departureTime ? ` - Departure: ${e.departureTime}` : ''}${e.arrivalTime ? `, Arrival: ${e.arrivalTime}` : ''}`;
    }
    default:
      return `${event.type} on ${formatDate(event.date)}`;
  }
};

export const generateDestinationSuggestions = async (
  allEvents: Event[],
  tripDates: { startDate: string; endDate: string },
  user: { _id: string; name: string; email: string; photoUrl: string | null; }
): Promise<(DestinationEvent | ActivityEvent)[]> => {
  const aiSuggestions = allEvents.filter(e => {
    const isAISuggestion = e.source === 'other' && e.notes?.includes('AI-Generated Suggestion');
    if (isAISuggestion) {
      console.log('Found existing AI suggestion:', {
        id: e.id,
        type: e.type,
        name: (e as any).placeName || (e as any).title || 'N/A',
        date: e.date,
        status: e.status
      });
    }
    return isAISuggestion;
  });

  const existingAISuggestions = aiSuggestions.map(e => {
    const formatted = formatEventForPrompt(e);
    return formatted;
  });

  const confirmedEvents = allEvents.filter(e => e.status === 'confirmed');
  const exploringEvents = allEvents.filter(e => e.status === 'exploring' && !aiSuggestions.includes(e));
  
  const prompt = `Based on the following events in our trip from ${tripDates.startDate} to ${tripDates.endDate}, suggest 3 new and diverse experiences to enhance the trip.

Confirmed Events (in chronological order):
${confirmedEvents.map(e => formatEventForPrompt(e)).join('\n')}

${exploringEvents.length > 0 ? `
Currently Exploring These Options:
${exploringEvents.map(e => formatEventForPrompt(e)).join('\n')}
` : ''}

${existingAISuggestions.length > 0 ? `
=== IMPORTANT: Previously AI-Generated Suggestions ===
${existingAISuggestions.join('\n')}

IMPORTANT: You must NOT suggest any destinations or activities already in the trip. Ensure your new suggestions are possibly in different areas and offer different types of experiences.
` : ''}

You must provide exactly 3 NEW suggestions in this specific order:
1. A cultural destination (museum, historical site, theater, etc.) - MUST be different from any existing suggestions
2. An outdoor activity (hiking, kayaking, biking, etc.) - MUST be different from any existing suggestions
3. A local experience (either a destination or an activity e.g. food tour, cooking class, artisan workshop, etc.) - MUST be different from any existing suggestions

For each suggestion, consider:
- Ensure timing doesn't conflict with existing events
- Focus on unique experiences not mentioned in any previous suggestions

For each suggestion, use exactly this format with no deviations:
SUGGESTION_START
TYPE: [Either 'destination' or 'activity']
NAME: [Full name of the place or activity]
ADDRESS: [Complete address]
SUGGESTED_DATE: [YYYY-MM-DD format - Choose a logical date based on the schedule]
DESCRIPTION: [Rich description including historical/cultural context]
HOURS: [Opening hours or duration]
ACTIVITY_TYPE: [Only for activities: type of activity e.g., "Hiking", "Food Tour", "Workshop"]
TIPS: [Practical visitor information]
NOTES: [Cost information and booking requirements]
SUGGESTION_END

Ensure each suggestion is wrapped with SUGGESTION_START and SUGGESTION_END markers.
Make sure SUGGESTED_DATE is in YYYY-MM-DD format and makes sense with the existing schedule.
For activities, make sure to include the ACTIVITY_TYPE field.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.95,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    const response = await result.response;
    const text = response.text();
    
    const suggestionMatches = text.match(/SUGGESTION_START([\s\S]*?)SUGGESTION_END/g);
    
    if (!suggestionMatches || suggestionMatches.length !== 3) {
      console.error('Invalid number of suggestions:', suggestionMatches?.length);
      throw new Error('Failed to generate exactly 3 suggestions. Retrying...');
    }

    const suggestions = suggestionMatches.map((suggestionText, index) => {
      const cleanText = suggestionText
        .replace('SUGGESTION_START', '')
        .replace('SUGGESTION_END', '')
        .trim();

      const fields: Record<string, string> = {};
      const lines = cleanText.split('\n');
      
      let currentField = '';
      for (const line of lines) {
        const match = line.match(/^([A-Z_]+):\s*(.+)/);
        if (match) {
          currentField = match[1];
          fields[currentField] = match[2].trim();
        } else if (line.trim() && currentField) {
          fields[currentField] += '\n' + line.trim();
        }
      }

      const categories = ['Cultural Destination', 'Outdoor Activity', 'Local Experience'];
      const categoryNote = `Category: ${categories[index]}\n\n`;

      let suggestedDate = fields.SUGGESTED_DATE || '';
      if (!suggestedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.warn('Invalid suggested date format:', suggestedDate);
        suggestedDate = tripDates.startDate;
      }

      const baseEvent = {
        id: uuidv4(),
        date: suggestedDate,
        notes: `✨ AI-Generated Suggestion\n${categoryNote}${fields.TIPS || ''}\n\n${fields.NOTES || ''}`,
        status: 'exploring' as const,
        source: 'other' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        location: { lat: 0, lng: 0 },
        createdBy: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl
        },
        updatedBy: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl
        }
      };

      // Create either a destination or activity event based on the TYPE field
      if (fields.TYPE?.toLowerCase() === 'activity') {
        const activityEvent: ActivityEvent = {
          ...baseEvent,
          type: 'activity',
          title: fields.NAME || 'Suggested Activity',
          activityType: fields.ACTIVITY_TYPE || 'Activity',
          address: fields.ADDRESS || '',
          description: fields.DESCRIPTION || ''
        };
        return activityEvent;
      } else {
        const destinationEvent: DestinationEvent = {
          ...baseEvent,
          type: 'destination',
          placeName: fields.NAME || 'Suggested Destination',
          address: fields.ADDRESS || '',
          description: fields.DESCRIPTION || '',
          openingHours: fields.HOURS || ''
        };
        return destinationEvent;
      }
    });

    return suggestions;
  } catch (error) {
    console.error('Error generating suggestions:', error);
    throw new Error('Failed to generate suggestions. Please try again.');
  }
};

export const parseEventFromText = async (request: TextEventParseRequest): Promise<Event | Event[]> => {
  const prompt = `Parse the following text (I'll tell you when we get to the actual text that needs parsing) and extract travel event details. The text could be either a natural language description or an email containing reservation details. The events is related to this trip wit hthe following info:

Trip Context:
- Name: ${request.trip.name}
- Description: ${request.trip.description}
- Date Range: ${request.trip.startDate} to ${request.trip.endDate}
- Current Events: ${request.trip.events.map(formatEventForPrompt).join('\n')}


Possible Event Types and Their Required Fields:
1. arrival: (Use for flights TO the trip destination)
   Required:
   - date (YYYY-MM-DD format)
   - time (HH:mm format)
   - airport (string) (This is the airport we're flying to)
   Optional:
   - flightNumber (string)
   - airline (string)
   - terminal (string)
   - gate (string)
   - bookingReference (string)

2. departure: (Use for flights FROM the trip destination)
   Required:
   - date (YYYY-MM-DD format)
   - time (HH:mm format)
   - airport (string) (This is the airport we're flying from)
   Optional:
   - flightNumber (string)
   - airline (string)
   - terminal (string)
   - gate (string)
   - bookingReference (string)

3. flight: (Use for flights WITHIN the trip)
   Required:
   - date (YYYY-MM-DD format)
   - departureAirport (string)
   - arrivalAirport (string)
   Optional:
   - airline (string)
   - flightNumber (string)
   - departureTime (HH:mm format)
   - arrivalTime (HH:mm format)
   - terminal (string)
   - gate (string)
   - bookingReference (string)

4. stay:
   Required:
   - date (YYYY-MM-DD format)
   - accommodationName (string)
   - checkIn (YYYY-MM-DD format)
   - checkOut (YYYY-MM-DD format)
   Optional:
   - address (string)
   - reservationNumber (string)
   - contactInfo (string)

5. destination (places or spots to visit)
   Required:
   - date (YYYY-MM-DD format)
   - placeName (string)
   Optional:
   - address (string)
   - description (string)
   - openingHours (string)

6. train:
   Required:
   - date (YYYY-MM-DD format)
   Optional:
   - trainNumber (string)
   - trainOperator (string)
   - departureStation (string)
   - arrivalStation (string)
   - departureTime (HH:mm format)
   - arrivalTime (HH:mm format)
   - carriageNumber (string)
   - seatNumber (string)
   - bookingReference (string)

7. rental_car:
   Required:
   - date (YYYY-MM-DD format)
   Optional:
   - carCompany (string)
   - pickupLocation (string)
   - dropoffLocation (string)
   - pickupTime (HH:mm format)
   - dropoffTime (HH:mm format)
   - dropoffDate (YYYY-MM-DD format)
   - carType (string)
   - bookingReference (string)
   - licensePlate (string)

8. bus:
   Required:
   - date (YYYY-MM-DD format)
   Optional:
   - busNumber (string)
   - busOperator (string)
   - departureStation (string)
   - arrivalStation (string)
   - departureTime (HH:mm format)
   - arrivalTime (HH:mm format)
   - seatNumber (string)
   - bookingReference (string)

9. activity: (things to do or activities to participate in e.g. hiking, biking, tours, etc.)
   Required:
   - date (YYYY-MM-DD format)
   - title (string)
   - activityType (string)
   Optional:
   - description (string)
   - address (string)

Common fields for all events:
- status: 'confirmed' | 'exploring'
- source: 'manual' | 'google_places' | 'google_flights' | 'booking.com' | 'airbnb' | 'expedia' | 'tripadvisor' | 'other'
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
    "type": "one of: arrival, departure, stay, destination, flight, train, rental_car, bus",
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
    console.log('Raw AI response:', text);

    // Clean up the response text
    const cleanText = text
      // Remove any markdown code block markers
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      // Remove any leading/trailing whitespace
      .trim()
      // Ensure the text starts with { and ends with }
      .replace(/^[^{]*({.*})[^}]*$/s, '$1')
      // Unescape quotes
      .replace(/\\"/g, '"');

    //console.log('Cleaned response:', cleanText);

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
        date: '', // Will be set based on specific event type
        status: 'confirmed',
        source: 'other' as const,
        location: { lat: 0, lng: 0 },
        //notes: `Parsed from text with ${Math.round(eventData.confidence * 100)}% confidence\n\nReasoning: ${eventData.reasoning}`,
        notes: 'Parsed from text',
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
        updatedAt: new Date().toISOString()
      };

      // Merge the AI-parsed fields with the base event
      let event: Event;
      
      if (eventData.type === 'stay') {
        const address = eventData.fields.address || '';
        event = {
          ...baseEvent,
          ...eventData.fields,
          address: address,
          location: address ? {
            lat: 0, // These will be updated by geocoding
            lng: 0,
            address: address
          } : undefined
        } as StayEvent;
      } else {
        event = {
          ...baseEvent,
          ...eventData.fields,
        } as Event;
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