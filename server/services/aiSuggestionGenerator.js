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

const extractTripLocationHints = (events = []) => {
  const hints = new Set();

  for (const event of events) {
    if (event.type === 'stay') {
      if (event.accommodationName) hints.add(event.accommodationName);
      if (event.address) hints.add(event.address);
    }
    if (event.type === 'destination') {
      if (event.placeName) hints.add(event.placeName);
      if (event.address) hints.add(event.address);
    }
    if (event.type === 'activity') {
      if (event.title) hints.add(event.title);
      if (event.address) hints.add(event.address);
    }
    if (event.location?.address) hints.add(event.location.address);
    if (event.airport) hints.add(event.airport);
    if (event.departureAirport) hints.add(event.departureAirport);
    if (event.arrivalAirport) hints.add(event.arrivalAirport);
  }

  return [...hints];
};

const extractDatePart = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const normalizeTimePart = (value, fallback = '09:00') => {
  if (!value) return fallback;
  const match = String(value).trim().match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : fallback;
};

const normalizeSuggestionSchedule = ({ startDate, startTime, endDate, endTime }) => {
  const startDay = extractDatePart(startDate);
  if (!startDay) {
    return null;
  }

  let endDay = extractDatePart(endDate);
  const normalizedStartTime = normalizeTimePart(startTime, '09:00');
  let normalizedEndTime = normalizeTimePart(endTime, '17:00');

  if (!endDay || endDay < startDay) {
    endDay = startDay;
  }

  const dayDiff = Math.round(
    (new Date(`${endDay}T12:00:00`).getTime() - new Date(`${startDay}T12:00:00`).getTime())
    / (24 * 60 * 60 * 1000)
  );
  if (dayDiff === 1 && normalizedEndTime <= normalizedStartTime) {
    endDay = startDay;
  }

  if (endDay === startDay && normalizedEndTime <= normalizedStartTime) {
    const [hours, minutes] = normalizedStartTime.split(':').map(Number);
    normalizedEndTime = `${String(Math.min(hours + 2, 23)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return {
    date: startDay,
    startDate: startDay,
    endDate: endDay,
    startTime: normalizedStartTime,
    endTime: normalizedEndTime,
  };
};

const generateDestinationSuggestions = async ({
  existingEvents = [],
  tripDates,
  keywords = [],
  scopedDate,
  scopedEndDate,
  user,
}) => {
  const normalizedKeywords = keywords
    .map(keyword => String(keyword || '').trim())
    .filter(Boolean);

  if (normalizedKeywords.length === 0) {
    throw new Error('At least one activity or destination keyword is required');
  }

  const normalizedScopedEnd = scopedEndDate && scopedEndDate !== scopedDate
    ? scopedEndDate
    : undefined;
  const hasScopedRange = Boolean(scopedDate && normalizedScopedEnd);
  const hasScopedDay = Boolean(scopedDate && !hasScopedRange);

  const tripStart = tripDates.startDate?.slice(0, 10) || tripDates.startDate;
  const tripEnd = tripDates.endDate?.slice(0, 10) || tripDates.endDate;
  let effectiveStart = tripStart;
  let effectiveEnd = tripEnd;

  if (scopedDate) {
    effectiveStart = scopedDate;
    effectiveEnd = normalizedScopedEnd || scopedDate;
  }

  if (tripStart && effectiveStart < tripStart) effectiveStart = tripStart;
  if (tripEnd && effectiveEnd > tripEnd) effectiveEnd = tripEnd;

  const scopedDayHint = hasScopedRange
    ? `Focus suggestions within ${scopedDate} to ${normalizedScopedEnd}. Spread the three suggestions across appropriate days in that window when it makes sense, or keep them on the best-fit days inside the range.`
    : hasScopedDay
      ? `Focus suggestions on ${scopedDate}. All three suggestions should be scheduled on ${scopedDate} unless the slot truly spans multiple days.`
      : 'Spread suggestions across open days when possible.';

  const dateWindowLabel = hasScopedRange
    ? `${scopedDate} to ${normalizedScopedEnd}`
    : hasScopedDay
      ? scopedDate
      : `${effectiveStart} to ${effectiveEnd}`;

  const nonAiSuggestions = existingEvents.filter(event => !event.isAISuggestion);
  const formattedEvents = nonAiSuggestions.map(formatEventForPrompt).join('\n\n');
  const locationHints = extractTripLocationHints(nonAiSuggestions);
  const keywordList = normalizedKeywords.join(', ');
  const locationContext = locationHints.length > 0
    ? locationHints.join(', ')
    : 'Infer the destination from the existing itinerary';

  const prompt = `Generate exactly 3 concrete trip event suggestions based on the user's interests.

User interests/keywords: ${keywordList}
Trip dates: ${tripDates.startDate} to ${tripDates.endDate}
Target scheduling window: ${dateWindowLabel}
${hasScopedRange ? `Target date range: ${scopedDate} to ${normalizedScopedEnd}` : ''}
${hasScopedDay ? `Target day: ${scopedDate}` : ''}
Trip location context: ${locationContext}

Rules:
1. Each suggestion must be type "activity" or "destination" only.
2. Prefer real venues, parks, tour operators, museums, trails, or businesses that match the keywords and trip location.
3. Include practical details whenever possible: full street address, phone and/or website, opening hours, and booking/reservation notes.
4. Use "unknown" only when a field truly cannot be determined.
5. All event dates must fall within ${effectiveStart} and ${effectiveEnd}, and also within the overall trip dates.
6. All dates must be YYYY-MM-DD and all times must be HH:mm (24-hour).
7. Most activities and destinations are single-day: set endDate equal to startDate unless the event truly spans multiple days.
8. Do not overlap with existing events.
9. ${scopedDayHint}

Existing events:
${formattedEvents || 'None yet'}

Format each suggestion exactly like this:
SUGGESTION_START
type: [activity or destination]
title/placeName: [real venue or activity name]
description: [why it fits the keyword and what to expect]
startDate: YYYY-MM-DD
startTime: HH:mm
endDate: YYYY-MM-DD
endTime: HH:mm
address: [full street address with city]
contactInfo: [phone and/or website]
openingHours: [hours or "unknown"]
notes: [booking tips, price range, or reservation guidance]
activityType: [for activities only]
cost: [optional numeric estimate in local currency, or "unknown"]
SUGGESTION_END`;

  const { text } = await generateAiText({
    prompt,
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 5000,
  });

  if (!text) throw new Error('No response from AI');

  const parseCost = (value) => {
    if (!value || value.toLowerCase() === 'unknown') return undefined;
    const parsed = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return text.split('SUGGESTION_START').slice(1).map((block) => {
    const suggestionContent = block.split('SUGGESTION_END')[0].trim();
    const fields = {};
    suggestionContent.split('\n').map(line => line.trim()).forEach((line) => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) fields[key.trim()] = valueParts.join(':').trim();
    });

    const contactInfo = fields.contactInfo && fields.contactInfo.toLowerCase() !== 'unknown'
      ? fields.contactInfo
      : undefined;
    const openingHours = fields.openingHours && fields.openingHours.toLowerCase() !== 'unknown'
      ? fields.openingHours
      : undefined;
    const notes = fields.notes && fields.notes.toLowerCase() !== 'unknown'
      ? fields.notes
      : undefined;
    const address = fields.address && fields.address.toLowerCase() !== 'unknown'
      ? fields.address
      : undefined;
    const cost = parseCost(fields.cost);
    const schedule = normalizeSuggestionSchedule({
      startDate: fields.startDate,
      startTime: fields.startTime,
      endDate: fields.endDate,
      endTime: fields.endTime,
    });

    if (!schedule) {
      return null;
    }

    const baseEvent = {
      id: randomUUID(),
      type: fields.type,
      date: schedule.date,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      description: fields.description,
      address,
      contactInfo,
      notes,
      ...(cost !== undefined ? { cost } : {}),
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
        activityType: fields.activityType || normalizedKeywords[0],
      };
    }

    return {
      ...baseEvent,
      placeName: fields['title/placeName'],
      openingHours,
    };
  }).filter(event => event && (event.type === 'activity' || event.type === 'destination'));
};

module.exports = {
  generateTravelSuggestions,
  generateDreamTripSuggestions,
  generateDestinationSuggestions,
};
