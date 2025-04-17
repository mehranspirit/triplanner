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

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

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
  allEvents: Event[],
  tripDates: { startDate: string; endDate: string },
  user: { _id: string; name: string; email: string; photoUrl: string | null; }
): Promise<DestinationEvent[]> => {
  console.log('\n=== AI SERVICE: STARTING DESTINATION GENERATION ===');
  console.log('Trip dates:', tripDates);
  console.log('Total events:', allEvents.length);
  
  // Get existing AI-suggested events (from both confirmed and exploring)
  const aiSuggestions = allEvents.filter(e => {
    const isAISuggestion = e.source === 'other' && e.notes?.includes('AI-Generated Suggestion');
    if (isAISuggestion) {
      console.log('Found existing AI suggestion:', {
        id: e.id,
        type: e.type,
        name: (e as any).placeName || 'N/A',
        date: e.date,
        status: e.status
      });
    }
    return isAISuggestion;
  });

  console.log('\nTotal existing AI suggestions:', aiSuggestions.length);
  
  const existingAISuggestions = aiSuggestions.map(e => {
    const formatted = formatEventForPrompt(e);
    console.log('Formatted existing suggestion:', formatted);
    return formatted;
  });

  // Separate confirmed and exploring events for the prompt
  const confirmedEvents = allEvents.filter(e => e.status === 'confirmed');
  const exploringEvents = allEvents.filter(e => e.status === 'exploring' && !aiSuggestions.includes(e));

  console.log('\n=== PREPARING AI PROMPT ===');
  console.log('Confirmed events:', confirmedEvents.length);
  console.log('Exploring events:', exploringEvents.length);
  
  const prompt = `Based on the following events in our trip from ${tripDates.startDate} to ${tripDates.endDate}, suggest 3 new and diverse destinations to visit.

Confirmed Events (in chronological order):
${confirmedEvents.map(e => formatEventForPrompt(e)).join('\n')}

${exploringEvents.length > 0 ? `
Currently Exploring These Options:
${exploringEvents.map(e => formatEventForPrompt(e)).join('\n')}
` : ''}

${existingAISuggestions.length > 0 ? `
=== IMPORTANT: Previously AI-Generated Destinations ===
${existingAISuggestions.join('\n')}

IMPORTANT: You must NOT suggest any destinations already in the trip. Ensure your new suggestions are possibly in different areas and offer different types of experiences.
` : ''}

You must provide exactly 3 NEW suggestions in this specific order:
1. A cultural attraction (museum, historical site, theater, etc.) - MUST be different from any existing suggestions
2. An outdoor activity or location (hiking trail, viewpoint, etc.) - MUST be different from any existing suggestions
3. A local experience (neighborhood, food destination, market, etc.) - MUST be different from any existing suggestions

For each suggestion, consider:
- Ensure timing doesn't conflict with existing events
- Focus on unique experiences not mentioned in any previous suggestions

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

  console.log('\nPrompt preview (first 500 chars):', prompt.substring(0, 500) + '...');

  try {
    console.log('\n=== GENERATING NEW SUGGESTIONS ===');
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