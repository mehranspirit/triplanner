const { randomUUID } = require('crypto');
const { generateAiText } = require('./aiProvider');

const cleanSuggestionText = (text) => text
  .replace(/\*/g, '')
  .replace(/\*\*/g, '')
  .replace(/[•●■]/g, '-')
  .replace(/\s*[•●■-]\s*-\s*/g, '- ')
  .replace(/--+/g, '-')
  .replace(/(\d+\.)\s*([A-Z])/g, '$1 $2')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/\n-\s*/g, '\n- ')
  .replace(/\n\s*-\s+(Duration:|Best time|Practical|Recommended|Price|Location|Hours|Tips|Details|When|Where|Cost|Contact|Booking|Note):/g, '\n    - $1')
  .replace(/^\s*-\s*([A-Z][^:]+):\s*$/gm, '$1:');

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime())
    ? dateStr
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const generateTravelSuggestions = async ({ places = [], activities = [], tripDates }) => {
  const startDate = new Date(tripDates.startDate);
  const endDate = new Date(tripDates.endDate);
  const [earlierDate, laterDate] = startDate <= endDate
    ? [tripDates.startDate, tripDates.endDate]
    : [tripDates.endDate, tripDates.startDate];

  const prompt = `Generate travel suggestions for a trip from ${formatDate(earlierDate)} to ${formatDate(laterDate)}.
Places to visit: ${places.join(', ')}
Interested in: ${activities.join(', ')}

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

  const { text } = await generateAiText({
    prompt,
    temperature: 0.9,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
  });

  if (!text) throw new Error('Empty response from AI');
  return cleanSuggestionText(text);
};

const generateDreamTripSuggestions = async ({ places = [], activities = [], customPrompt = '' }) => {
  const prompt = `Generate dream trip suggestions based on the following preferences:
Places of interest: ${places.join(', ')}
Activities of interest: ${activities.join(', ')}

${customPrompt ? `Additional requirements: ${customPrompt}\n\n` : ''}
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

  const { text } = await generateAiText({
    prompt,
    temperature: 0.9,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
  });

  if (!text) throw new Error('Empty response from AI');
  return cleanSuggestionText(text);
};

const formatEventForPrompt = (event) => {
  const eventStart = event.startDate || event.date || event.checkIn || event.departureDate || 'unknown date';
  const eventEnd = event.endDate || event.checkOut || event.arrivalDate || event.dropoffDate || eventStart;
  const name = event.title || event.placeName || event.accommodationName || event.flightNumber || event.type;
  return `${event.type}: ${name} from ${eventStart} to ${eventEnd}`;
};

const generateDestinationSuggestions = async ({ existingEvents = [], tripDates, user }) => {
  const nonAiSuggestions = existingEvents.filter(event => !event.isAISuggestion);
  const formattedEvents = nonAiSuggestions.map(formatEventForPrompt).join('\n\n');

  const prompt = `Generate exactly 3 new event suggestions for a trip, following these rules:
1. Generate in this order: cultural destination, outdoor activity, local experience
2. Each suggestion must include a descriptive title/name, detailed description, start/end date and time, and address.
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
startDate: YYYY-MM-DD
startTime: HH:mm
endDate: YYYY-MM-DD
endTime: HH:mm
address: [full address]
activityType: [for activities only]
openingHours: [for destinations only]
SUGGESTION_END`;

  const { text } = await generateAiText({
    prompt,
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2000,
  });

  if (!text) throw new Error('No response from AI');

  return text.split('SUGGESTION_START').slice(1).map((block) => {
    const suggestionContent = block.split('SUGGESTION_END')[0].trim();
    const fields = {};
    suggestionContent.split('\n').map(line => line.trim()).forEach((line) => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) fields[key.trim()] = valueParts.join(':').trim();
    });

    const baseEvent = {
      id: randomUUID(),
      type: fields.type,
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
      status: 'exploring',
      likes: [],
      dislikes: [],
    };

    if (fields.type === 'activity') {
      return {
        ...baseEvent,
        title: fields['title/placeName'],
        activityType: fields.activityType,
        address: fields.address,
      };
    }

    return {
      ...baseEvent,
      placeName: fields['title/placeName'],
      address: fields.address,
      openingHours: fields.openingHours,
    };
  }).filter(event => event.type === 'activity' || event.type === 'destination');
};

module.exports = {
  generateTravelSuggestions,
  generateDreamTripSuggestions,
  generateDestinationSuggestions,
};
