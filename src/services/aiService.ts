import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  Event, 
  DestinationEvent, 
  StayEvent, 
  ArrivalDepartureEvent,
  FlightEvent,
  TrainEvent,
  RentalCarEvent,
  BusEvent
} from '@/types/eventTypes';
import { v4 as uuidv4 } from 'uuid';

interface AISuggestionRequest {
  places: string[];
  activities: string[];
  startDate: string;
  endDate: string;
}

interface DreamTripSuggestionRequest {
  places: string[];
  activities: string[];
  customPrompt: string;
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

export const generateAISuggestions = async (request: AISuggestionRequest): Promise<string> => {
  const prompt = `Generate travel suggestions for a trip from ${request.startDate} to ${request.endDate}.
Places to visit: ${request.places.join(', ')}
Interested in: ${request.activities.join(', ')}

Please provide detailed suggestions for activities and experiences that would be enjoyable during this trip. Include:
1. Specific attractions or locations to visit
2. Recommended activities based on the interests
3. Tips for timing and duration of activities
4. Any seasonal considerations
5. Practical advice for visiting these places

Format the response in a clear, easy-to-read way with sections and bullet points.`;

  try {
    // Configure generation parameters for more dynamic responses
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
    const text = response.text();
    
    if (!text) {
      throw new Error('Empty response from AI');
    }
    
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

${request.customPrompt ? `Additional requirements: ${request.customPrompt}\n` : ''}
Please provide detailed suggestions for a dream trip that would be perfect for these preferences. Include:
1. Specific destinations and locations that match the interests
2. Unique and memorable activities based on the preferences
3. Best times to visit these places
4. Special experiences or hidden gems
5. Practical tips for planning this dream trip
6. Estimated budget considerations
7. How to make this trip extra special

Format the response in a clear, easy-to-read way with sections and bullet points. Make it inspiring and exciting!`;

  try {
    // Configure generation parameters for more creative responses
    const generationConfig = {
      temperature: 1.0, // Higher temperature for more creative responses
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
    const text = response.text();
    
    if (!text) {
      throw new Error('Empty response from AI');
    }
    
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
      return `Car rental from ${e.pickupLocation} to ${e.dropoffLocation} on ${formatDate(e.date)}${e.carCompany ? ` from ${e.carCompany}` : ''}${e.carType ? ` (${e.carType})` : ''}${e.pickupTime ? ` - Pickup: ${e.pickupTime}` : ''}${e.dropoffTime ? `, Dropoff: ${e.dropoffTime}` : ''}`;
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
  confirmedEvents: Event[],
  tripDates: { startDate: string; endDate: string },
  user: { _id: string; name: string; email: string; photoUrl: string | null; }
): Promise<DestinationEvent[]> => {
  const prompt = `Based on the following confirmed events in the trip from ${tripDates.startDate} to ${tripDates.endDate}, suggest exactly 3 diverse destinations to visit:

Current Confirmed Events (in chronological order):
${confirmedEvents.map(e => formatEventForPrompt(e)).join('\n')}

You must provide exactly 3 suggestions in this specific order:
1. A cultural attraction (museum, historical site, theater, etc.)
2. An outdoor activity or location (hiking trail, viewpoint, etc.)
3. A local experience (market, neighborhood, food destination, etc.)

For each suggestion, consider the existing events' schedule and suggest a logical date to visit between ${tripDates.startDate} and ${tripDates.endDate}. Avoid scheduling conflicts with confirmed events.

For each suggestion, use exactly this format with no deviations:
SUGGESTION_START
PLACE_NAME: [Full name of the place]
ADDRESS: [Complete address]
SUGGESTED_DATE: [YYYY-MM-DD format - Choose a logical date based on the schedule]
DESCRIPTION: [Rich description including historical/cultural context]
HOURS: [Opening hours]
TIPS: [Practical visitor information]
NOTES: [Cost information and booking requirements]
SUGGESTION_END

Ensure each suggestion is wrapped with SUGGESTION_START and SUGGESTION_END markers.
Make sure SUGGESTED_DATE is in YYYY-MM-DD format and makes sense with the existing schedule.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    const response = await result.response;
    const text = response.text();
    
    // Parse the response using the explicit markers
    const suggestionMatches = text.match(/SUGGESTION_START([\s\S]*?)SUGGESTION_END/g);
    
    if (!suggestionMatches || suggestionMatches.length !== 3) {
      console.error('Invalid number of suggestions:', suggestionMatches?.length);
      console.log('Raw response:', text);
      throw new Error('Failed to generate exactly 3 suggestions. Retrying...');
    }

    const suggestions = suggestionMatches.map((suggestionText, index) => {
      // Remove the markers
      const cleanText = suggestionText
        .replace('SUGGESTION_START', '')
        .replace('SUGGESTION_END', '')
        .trim();

      // Parse fields
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

      // Determine category based on index
      const categories = ['Cultural Attraction', 'Outdoor Activity', 'Local Experience'];
      const categoryNote = `Category: ${categories[index]}\n\n`;

      // Validate and format the suggested date
      let suggestedDate = fields.SUGGESTED_DATE || '';
      if (!suggestedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // If date is invalid, use trip start date as fallback
        console.warn('Invalid suggested date format:', suggestedDate);
        suggestedDate = tripDates.startDate;
      }

      const event: DestinationEvent = {
        id: uuidv4(),
        type: 'destination',
        date: suggestedDate,
        placeName: fields.PLACE_NAME || 'Suggested Destination',
        address: fields.ADDRESS || '',
        description: fields.DESCRIPTION || '',
        openingHours: fields.HOURS || '',
        notes: `✨ AI-Generated Suggestion\n${categoryNote}${fields.TIPS || ''}\n\n${fields.NOTES || ''}`,
        status: 'exploring',
        source: 'other',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        location: { lat: 0, lng: 0 }, // Will be set by geocoding
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

      return event;
    });

    return suggestions;
  } catch (error) {
    console.error('Error generating destination suggestions:', error);
    throw new Error('Failed to generate destination suggestions. Please try again.');
  }
}; 