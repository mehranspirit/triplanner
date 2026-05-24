const WeatherSnapshot = require('../models/WeatherSnapshot');
const FlightStatusSnapshot = require('../models/FlightStatusSnapshot');
const Notification = require('../models/Notification');
const { generateAiText, hasConfiguredAiProvider } = require('./aiProvider');

const SEVERITIES = new Set(['info', 'warning', 'critical']);
const ASSISTANT_ACTION_TARGETS = new Set(['event', 'checklist', 'add_event', 'today', 'expenses', 'ai_import']);
const TODAY_ACTION_TARGETS = new Set(['event', 'checklist', 'today']);
const CHECKLIST_SCOPES = new Set(['shared', 'personal']);
const BACKUP_EVENT_TYPES = new Set(['activity', 'destination']);

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

const asString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const asEnum = (value, allowedValues, fallback) => (
  typeof value === 'string' && allowedValues.has(value) ? value : fallback
);
const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const parseJsonObject = (responseText) => {
  const parsed = JSON.parse(responseText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI response JSON root must be an object');
  }
  return parsed;
};

const getEventName = (event) => {
  switch (event.type) {
    case 'flight':
      return event.flightNumber ? `Flight ${event.flightNumber}` : 'Flight';
    case 'stay':
      return event.accommodationName || 'Stay';
    case 'activity':
      return event.title || 'Activity';
    case 'destination':
      return event.placeName || 'Destination';
    case 'rental_car':
      return event.carCompany ? `${event.carCompany} rental car` : 'Rental car';
    default:
      return event.type;
  }
};

const compactEvent = (event) => ({
  id: event.id,
  type: event.type,
  name: getEventName(event),
  status: event.status,
  startDate: event.startDate,
  endDate: event.endDate,
  location: event.location?.address || event.address || event.airport || event.departureAirport || event.pickupLocation,
  bookingReference: event.bookingReference || event.reservationNumber,
  flightNumber: event.flightNumber,
  departureAirport: event.departureAirport,
  arrivalAirport: event.arrivalAirport,
});

const buildAssistantContext = async (trip) => {
  const [weatherSnapshots, flightStatusSnapshots, notifications] = await Promise.all([
    WeatherSnapshot.find({ tripId: trip._id }).sort({ fetchedAt: -1 }).limit(20).lean(),
    FlightStatusSnapshot.find({ tripId: trip._id }).sort({ fetchedAt: -1 }).limit(20).lean(),
    Notification.find({ tripId: trip._id, dismissedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  return {
    trip: {
      id: trip._id,
      name: trip.name,
      description: trip.description,
      startDate: trip.startDate,
      endDate: trip.endDate,
      timezone: trip.timezone,
    },
    events: (trip.events || []).map(compactEvent),
    weather: weatherSnapshots.map((snapshot) => ({
      eventId: snapshot.originalEventId || snapshot.eventId,
      role: snapshot.locationRole,
      locationName: snapshot.locationName,
      daily: (snapshot.daily || []).slice(0, 2),
    })),
    flightStatuses: flightStatusSnapshots.map((snapshot) => ({
      eventId: snapshot.eventId,
      flightNumber: snapshot.flightNumber,
      status: snapshot.status,
      departure: snapshot.departure,
      arrival: snapshot.arrival,
    })),
    notifications: notifications.map((notification) => ({
      type: notification.type,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      eventId: notification.eventId,
    })),
  };
};

const buildPrompt = (context) => `You are a practical travel assistant. Create a concise trip readiness briefing using only the structured context below.

Rules:
- Do not invent facts that are not in the context.
- Prioritize real travel risks: missing transport, weather, flight status, tight timing, missing confirmations, and open planning gaps.
- Every action must include a reason.
- Keep it concise and useful.
- Return only valid JSON.

Context:
${JSON.stringify(context, null, 2)}

Return this exact JSON shape:
{
  "summary": "2-4 sentence plain-language trip briefing",
  "topRisks": [
    {
      "title": "short risk title",
      "reason": "why this matters",
      "severity": "info|warning|critical",
      "actionLabel": "optional action label",
      "actionTarget": "event|checklist|add_event|today|expenses",
      "eventId": "optional event id"
    }
  ],
  "nextBestActions": [
    {
      "title": "short action title",
      "reason": "why this is the next best action",
      "actionLabel": "button label",
      "actionTarget": "event|checklist|add_event|ai_import|expenses",
      "eventId": "optional event id"
    }
  ],
  "suggestedChecklistItems": [
    {
      "text": "checklist item",
      "reason": "why it helps",
      "scope": "shared|personal",
      "dueDate": "optional YYYY-MM-DD"
    }
  ],
  "suggestedBackupEvents": [
    {
      "title": "backup idea",
      "reason": "why it fits",
      "eventType": "activity|destination",
      "date": "optional YYYY-MM-DD",
      "locationHint": "optional location"
    }
  ]
}`;

const normalizeBriefingRisk = (risk) => {
  const item = asObject(risk);
  const title = asString(item.title);
  const reason = asString(item.reason);
  if (!title || !reason) return null;

  return {
    title,
    reason,
    severity: asEnum(item.severity, SEVERITIES, 'info'),
    actionLabel: asString(item.actionLabel),
    actionTarget: asEnum(item.actionTarget, ASSISTANT_ACTION_TARGETS),
    eventId: asString(item.eventId),
  };
};

const normalizeBriefingAction = (action) => {
  const item = asObject(action);
  const title = asString(item.title);
  const reason = asString(item.reason);
  const actionLabel = asString(item.actionLabel);
  const actionTarget = asEnum(item.actionTarget, ASSISTANT_ACTION_TARGETS);
  if (!title || !reason || !actionLabel || !actionTarget) return null;

  return {
    title,
    reason,
    actionLabel,
    actionTarget,
    eventId: asString(item.eventId),
  };
};

const normalizeChecklistItem = (checklistItem) => {
  const item = asObject(checklistItem);
  const text = asString(item.text);
  const reason = asString(item.reason);
  if (!text || !reason) return null;

  return {
    text,
    reason,
    scope: asEnum(item.scope, CHECKLIST_SCOPES, 'shared'),
    dueDate: asString(item.dueDate),
  };
};

const normalizeBackupEvent = (backupEvent) => {
  const item = asObject(backupEvent);
  const title = asString(item.title);
  const reason = asString(item.reason);
  const eventType = asEnum(item.eventType, BACKUP_EVENT_TYPES);
  if (!title || !reason || !eventType) return null;

  return {
    title,
    reason,
    eventType,
    date: asString(item.date),
    locationHint: asString(item.locationHint),
  };
};

const normalizeBriefing = (briefing) => {
  const item = asObject(briefing);
  return {
    summary: asString(item.summary) || 'No briefing summary available.',
    topRisks: asArray(item.topRisks).map(normalizeBriefingRisk).filter(Boolean).slice(0, 5),
    nextBestActions: asArray(item.nextBestActions).map(normalizeBriefingAction).filter(Boolean).slice(0, 5),
    suggestedChecklistItems: asArray(item.suggestedChecklistItems).map(normalizeChecklistItem).filter(Boolean).slice(0, 8),
    suggestedBackupEvents: asArray(item.suggestedBackupEvents).map(normalizeBackupEvent).filter(Boolean).slice(0, 5),
  };
};

const getEventCountByType = (events) => events.reduce((counts, event) => ({
  ...counts,
  [event.type]: (counts[event.type] || 0) + 1,
}), {});

const buildDeterministicBriefing = (context) => {
  const eventCounts = getEventCountByType(context.events);
  const openNotifications = context.notifications.filter((notification) => notification.severity !== 'info');
  const flightRisks = context.flightStatuses.filter((snapshot) => {
    const departureDelay = Number(snapshot.departure?.delayMinutes || 0);
    const arrivalDelay = Number(snapshot.arrival?.delayMinutes || 0);
    return ['cancelled', 'delayed', 'diverted'].includes(String(snapshot.status || '').toLowerCase()) ||
      departureDelay >= 30 ||
      arrivalDelay >= 30;
  });
  const weatherRisks = context.weather.filter((snapshot) => (
    (snapshot.daily || []).some((day) => (
      Number(day.precipitationProbabilityMax || 0) >= 60 ||
      Number(day.temperatureMax || 0) >= 32 ||
      Number(day.windSpeedMax || 0) >= 35
    ))
  ));

  const topRisks = [
    ...openNotifications.map((notification) => ({
      title: notification.title,
      reason: notification.message,
      severity: notification.severity || 'warning',
      actionTarget: notification.eventId ? 'event' : 'checklist',
      eventId: notification.eventId,
    })),
    ...flightRisks.map((snapshot) => ({
      title: `${snapshot.flightNumber || 'Flight'} status needs attention`,
      reason: `Latest flight status is ${snapshot.status || 'updated'}. Check timing, terminal, gate, and backup options before departure.`,
      severity: String(snapshot.status || '').toLowerCase() === 'cancelled' ? 'critical' : 'warning',
      actionTarget: 'event',
      eventId: snapshot.eventId,
    })),
    ...weatherRisks.map((snapshot) => ({
      title: `Weather may affect ${snapshot.locationName || 'part of the trip'}`,
      reason: 'Forecast context shows rain, heat, or wind that may affect timing, packing, or backup plans.',
      severity: 'warning',
      actionTarget: 'checklist',
      eventId: snapshot.eventId,
    })),
  ].slice(0, 5);

  const nextBestActions = [];
  if (topRisks.length > 0) {
    nextBestActions.push({
      title: 'Review the top trip risks',
      reason: 'These are the highest-signal issues from notifications, weather, and flight status context.',
      actionLabel: 'Review risks',
      actionTarget: 'checklist',
    });
  }
  if (!eventCounts.stay) {
    nextBestActions.push({
      title: 'Add lodging details',
      reason: 'A stay event helps the app reason about daily plans, maps, weather, and transfers.',
      actionLabel: 'Add stay',
      actionTarget: 'add_event',
    });
  }
  if (!eventCounts.flight && !eventCounts.train && !eventCounts.rental_car) {
    nextBestActions.push({
      title: 'Add transportation',
      reason: 'Transportation anchors arrival/departure timing and route guidance.',
      actionLabel: 'Add transport',
      actionTarget: 'add_event',
    });
  }

  return normalizeBriefing({
    summary: `${context.trip.name} has ${context.events.length} scheduled event${context.events.length === 1 ? '' : 's'}. ${topRisks.length > 0 ? `I found ${topRisks.length} item${topRisks.length === 1 ? '' : 's'} that may need attention.` : 'No major AI-readable risks surfaced from the available context.'}`,
    topRisks,
    nextBestActions,
    suggestedChecklistItems: topRisks.length > 0 ? [{
      text: 'Review trip risks and backup options',
      reason: 'This keeps weather, flight, and planning issues from becoming day-of surprises.',
      scope: 'shared',
    }] : [],
    suggestedBackupEvents: [],
  });
};

const parseAssistantResponse = (responseText) => {
  try {
    return normalizeBriefing(parseJsonObject(responseText));
  } catch {
    return normalizeBriefing(parseJsonObject(extractJsonObject(responseText)));
  }
};

const parseDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const isSameLocalDay = (a, b) => (
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
);

const getTodayContext = (context, now = new Date()) => {
  const sortedEvents = [...context.events]
    .map((event) => ({ ...event, start: parseDate(event.startDate) }))
    .sort((a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0));
  const currentEvent = sortedEvents.find((event) => {
    const start = event.start;
    const end = parseDate(event.endDate) || start;
    return start && end && start <= now && end >= now;
  }) || null;
  const nextEvent = sortedEvents.find((event) => event.start && event.start > now) || null;
  const todaysEventIds = new Set(sortedEvents
    .filter((event) => event.start && isSameLocalDay(event.start, now))
    .map((event) => event.id));

  return {
    trip: context.trip,
    now: now.toISOString(),
    currentEvent,
    nextEvent,
    todaysEvents: sortedEvents.filter((event) => todaysEventIds.has(event.id)),
    weather: context.weather.filter((snapshot) => todaysEventIds.has(snapshot.eventId)),
    flightStatuses: context.flightStatuses.filter((snapshot) => (
      todaysEventIds.has(snapshot.eventId) ||
      snapshot.eventId === currentEvent?.id ||
      snapshot.eventId === nextEvent?.id
    )),
    notifications: context.notifications.slice(0, 8),
  };
};

const normalizeTodayAction = (action) => {
  const item = asObject(action);
  const title = asString(item.title);
  const reason = asString(item.reason);
  const actionLabel = asString(item.actionLabel);
  const actionTarget = asEnum(item.actionTarget, TODAY_ACTION_TARGETS);
  if (!title || !reason || !actionLabel || !actionTarget) return undefined;

  return {
    title,
    reason,
    actionLabel,
    actionTarget,
    eventId: asString(item.eventId),
  };
};

const normalizeWatchItem = (watchItem) => {
  const item = asObject(watchItem);
  const title = asString(item.title);
  const reason = asString(item.reason);
  if (!title || !reason) return null;

  return {
    title,
    reason,
    severity: asEnum(item.severity, SEVERITIES, 'info'),
    eventId: asString(item.eventId),
  };
};

const normalizeFallbackIdea = (fallbackIdea) => {
  const item = asObject(fallbackIdea);
  const title = asString(item.title);
  const reason = asString(item.reason);
  if (!title || !reason) return null;

  return { title, reason };
};

const normalizeReplanSuggestion = (suggestion) => {
  const item = asObject(suggestion);
  const title = asString(item.title);
  const reason = asString(item.reason);
  if (!title || !reason) return null;

  return {
    title,
    reason,
    severity: asEnum(item.severity, SEVERITIES, 'info'),
    suggestionType: asEnum(item.suggestionType, new Set(['timing', 'backup', 'transport', 'weather', 'flight', 'checklist']), 'backup'),
    actionLabel: asString(item.actionLabel),
    actionTarget: asEnum(item.actionTarget, TODAY_ACTION_TARGETS),
    eventId: asString(item.eventId),
  };
};

const normalizeReplanBriefing = (briefing) => {
  const item = asObject(briefing);
  return {
    summary: asString(item.summary) || 'No day replan suggestions available.',
    suggestions: asArray(item.suggestions).map(normalizeReplanSuggestion).filter(Boolean).slice(0, 6),
    fallbackIdeas: asArray(item.fallbackIdeas).map(normalizeFallbackIdea).filter(Boolean).slice(0, 4),
    suggestedChecklistItems: asArray(item.suggestedChecklistItems).map(normalizeChecklistItem).filter(Boolean).slice(0, 5),
    caveat: asString(item.caveat),
  };
};

const normalizeTodayBriefing = (briefing) => {
  const item = asObject(briefing);
  return {
    summary: asString(item.summary) || 'No Today briefing summary available.',
    nextAction: normalizeTodayAction(item.nextAction),
    watchItems: asArray(item.watchItems).map(normalizeWatchItem).filter(Boolean).slice(0, 5),
    fallbackIdeas: asArray(item.fallbackIdeas).map(normalizeFallbackIdea).filter(Boolean).slice(0, 4),
    collaboratorMessage: asString(item.collaboratorMessage),
  };
};

const buildTodayPrompt = (todayContext) => `You are an in-trip travel copilot. Create a concise briefing for what the traveler should pay attention to today.

Rules:
- Use only the structured context below.
- Focus on what matters now: current event, next event, transfer timing, weather, flight status, and active notifications.
- Do not invent reservations, places, or provider data.
- Return only valid JSON.

Context:
${JSON.stringify(todayContext, null, 2)}

Return this exact JSON shape:
{
  "summary": "1-3 sentence summary for today",
  "nextAction": {
    "title": "the next practical action",
    "reason": "why it matters now",
    "actionLabel": "short button label",
    "actionTarget": "event|checklist|today",
    "eventId": "optional event id"
  },
  "watchItems": [
    {
      "title": "thing to watch",
      "reason": "why it could affect the day",
      "severity": "info|warning|critical",
      "eventId": "optional event id"
    }
  ],
  "fallbackIdeas": [
    {
      "title": "backup idea",
      "reason": "why it fits today"
    }
  ],
  "collaboratorMessage": "optional short message the user could send to trip collaborators"
}`;

const buildDeterministicTodayBriefing = (todayContext) => {
  const watchItems = [
    ...todayContext.notifications
      .filter((notification) => notification.severity !== 'info')
      .map((notification) => ({
        title: notification.title,
        reason: notification.message,
        severity: notification.severity || 'warning',
        eventId: notification.eventId,
      })),
    ...todayContext.flightStatuses
      .filter((snapshot) => {
        const departureDelay = Number(snapshot.departure?.delayMinutes || 0);
        const arrivalDelay = Number(snapshot.arrival?.delayMinutes || 0);
        return ['cancelled', 'delayed', 'diverted'].includes(String(snapshot.status || '').toLowerCase()) ||
          departureDelay >= 30 ||
          arrivalDelay >= 30;
      })
      .map((snapshot) => ({
        title: `${snapshot.flightNumber || 'Flight'} status update`,
        reason: `Latest status is ${snapshot.status || 'updated'}. Check timing and airport details before moving.`,
        severity: String(snapshot.status || '').toLowerCase() === 'cancelled' ? 'critical' : 'warning',
        eventId: snapshot.eventId,
      })),
    ...todayContext.weather
      .filter((snapshot) => (snapshot.daily || []).some((day) => Number(day.precipitationProbabilityMax || 0) >= 60))
      .map((snapshot) => ({
        title: `Rain possible near ${snapshot.locationName || 'today event'}`,
        reason: 'The forecast may affect outdoor plans, walking time, or backup options.',
        severity: 'warning',
        eventId: snapshot.eventId,
      })),
  ].slice(0, 5);

  return normalizeTodayBriefing({
    summary: todayContext.todaysEvents.length > 0
      ? `You have ${todayContext.todaysEvents.length} event${todayContext.todaysEvents.length === 1 ? '' : 's'} today. ${todayContext.nextEvent ? `Next up: ${todayContext.nextEvent.name}.` : 'No later events are scheduled.'}`
      : 'No events are scheduled for today.',
    nextAction: todayContext.nextEvent ? {
      title: `Prepare for ${todayContext.nextEvent.name}`,
      reason: 'This is the next scheduled trip event.',
      actionLabel: 'Review event',
      actionTarget: 'event',
      eventId: todayContext.nextEvent.id,
    } : undefined,
    watchItems,
    fallbackIdeas: [],
    collaboratorMessage: watchItems.length > 0
      ? `Heads up: ${watchItems[0].title}. ${watchItems[0].reason}`
      : undefined,
  });
};

const parseTodayResponse = (responseText) => {
  try {
    return normalizeTodayBriefing(parseJsonObject(responseText));
  } catch {
    return normalizeTodayBriefing(parseJsonObject(extractJsonObject(responseText)));
  }
};

const buildReplanPrompt = (todayContext) => `You are a careful in-trip travel assistant. Suggest review-only changes the traveler could consider for today.

Rules:
- Use only the structured context below.
- Do not auto-change the itinerary.
- Focus on weather, flight status, transfer risk, missing confirmations, and realistic backups.
- If no replan is needed, say so.
- Return only valid JSON.

Context:
${JSON.stringify(todayContext, null, 2)}

Return this exact JSON shape:
{
  "summary": "1-3 sentence review of whether today needs replanning",
  "suggestions": [
    {
      "title": "specific change to consider",
      "reason": "why this change may help",
      "severity": "info|warning|critical",
      "suggestionType": "timing|backup|transport|weather|flight|checklist",
      "actionLabel": "optional button label",
      "actionTarget": "event|checklist|today",
      "eventId": "optional event id"
    }
  ],
  "fallbackIdeas": [
    {
      "title": "backup idea",
      "reason": "why it fits today"
    }
  ],
  "suggestedChecklistItems": [
    {
      "text": "checklist item",
      "reason": "why it helps",
      "scope": "shared|personal"
    }
  ],
  "caveat": "optional caveat if more data is needed"
}`;

const buildDeterministicReplanBriefing = (todayContext) => {
  const suggestions = [];
  const fallbackIdeas = [];
  const suggestedChecklistItems = [];

  todayContext.notifications
    .filter((notification) => notification.severity !== 'info')
    .slice(0, 3)
    .forEach((notification) => {
      suggestions.push({
        title: notification.title,
        reason: notification.message,
        severity: notification.severity || 'warning',
        suggestionType: 'checklist',
        actionLabel: notification.eventId ? 'Review event' : 'Open checklist',
        actionTarget: notification.eventId ? 'event' : 'checklist',
        eventId: notification.eventId,
      });
    });

  todayContext.flightStatuses
    .filter((snapshot) => {
      const departureDelay = Number(snapshot.departure?.delayMinutes || 0);
      const arrivalDelay = Number(snapshot.arrival?.delayMinutes || 0);
      return ['cancelled', 'delayed', 'diverted'].includes(String(snapshot.status || '').toLowerCase()) ||
        departureDelay >= 30 ||
        arrivalDelay >= 30;
    })
    .slice(0, 3)
    .forEach((snapshot) => {
      suggestions.push({
        title: `${snapshot.flightNumber || 'Flight'} may affect today's timing`,
        reason: `Latest flight status is ${snapshot.status || 'updated'}. Review downstream timing and backup options.`,
        severity: String(snapshot.status || '').toLowerCase() === 'cancelled' ? 'critical' : 'warning',
        suggestionType: 'flight',
        actionLabel: 'Review flight',
        actionTarget: 'event',
        eventId: snapshot.eventId,
      });
    });

  todayContext.weather
    .filter((snapshot) => (snapshot.daily || []).some((day) => Number(day.precipitationProbabilityMax || 0) >= 60))
    .slice(0, 3)
    .forEach((snapshot) => {
      suggestions.push({
        title: `Build a rain backup near ${snapshot.locationName || 'today event'}`,
        reason: 'Rain probability is high enough that outdoor plans may need a flexible alternative.',
        severity: 'warning',
        suggestionType: 'weather',
        actionLabel: 'Open checklist',
        actionTarget: 'checklist',
        eventId: snapshot.eventId,
      });
      fallbackIdeas.push({
        title: 'Indoor backup stop',
        reason: `Use this as a flexible option near ${snapshot.locationName || 'today’s route'} if weather disrupts outdoor plans.`,
      });
      suggestedChecklistItems.push({
        text: 'Pick an indoor rain backup for today',
        reason: 'High rain probability may affect outdoor plans.',
        scope: 'shared',
      });
    });

  return normalizeReplanBriefing({
    summary: suggestions.length > 0
      ? `I found ${suggestions.length} reason${suggestions.length === 1 ? '' : 's'} to review today's plan before you head out.`
      : 'I do not see an obvious reason to replan today from the available context.',
    suggestions,
    fallbackIdeas,
    suggestedChecklistItems,
    caveat: todayContext.todaysEvents.length === 0 ? 'No events are scheduled for today in the current itinerary.' : undefined,
  });
};

const parseReplanResponse = (responseText) => {
  try {
    return normalizeReplanBriefing(parseJsonObject(responseText));
  } catch {
    return normalizeReplanBriefing(parseJsonObject(extractJsonObject(responseText)));
  }
};

const normalizeTripAnswer = (answer) => ({
  answer: asString(asObject(answer).answer) || 'I could not answer that from the available trip context.',
  supportingFacts: asArray(asObject(answer).supportingFacts).map(asString).filter(Boolean).slice(0, 6),
  relatedEventIds: asArray(asObject(answer).relatedEventIds).map(asString).filter(Boolean).slice(0, 6),
  caveat: asString(asObject(answer).caveat),
});

const buildAskPrompt = ({ context, question }) => `You are answering questions about a user's trip using only the structured context below.

Rules:
- Answer only from the context. If the context does not contain the answer, say what is missing.
- Do not invent reservations, times, places, weather, flight status, or checklist state.
- Be concise and practical.
- Include supporting facts from the context.
- Return only valid JSON.

Question:
${question}

Trip context:
${JSON.stringify(context, null, 2)}

Return this exact JSON shape:
{
  "answer": "direct answer in plain language",
  "supportingFacts": ["fact from context", "fact from context"],
  "relatedEventIds": ["optional event id"],
  "caveat": "optional caveat if data is missing or stale"
}`;

const buildDeterministicTripAnswer = ({ context, question }) => {
  const normalizedQuestion = question.toLowerCase();
  const relatedEvents = context.events.filter((event) => (
    normalizedQuestion.includes(String(event.type || '').toLowerCase()) ||
    normalizedQuestion.includes(String(event.name || '').toLowerCase()) ||
    (event.location && normalizedQuestion.includes(String(event.location).toLowerCase()))
  )).slice(0, 5);

  if (normalizedQuestion.includes('flight')) {
    const flights = context.events.filter((event) => event.type === 'flight');
    return normalizeTripAnswer({
      answer: flights.length > 0
        ? `I found ${flights.length} flight event${flights.length === 1 ? '' : 's'} in this trip.`
        : 'I do not see any flight events in the structured trip context.',
      supportingFacts: flights.map((event) => `${event.name}: ${event.departureAirport || 'departure unknown'} to ${event.arrivalAirport || 'arrival unknown'}`),
      relatedEventIds: flights.map((event) => event.id),
      caveat: context.flightStatuses.length === 0 ? 'No live flight status snapshots are available in the current context.' : undefined,
    });
  }

  if (normalizedQuestion.includes('weather') || normalizedQuestion.includes('rain')) {
    return normalizeTripAnswer({
      answer: context.weather.length > 0
        ? `I found weather context for ${context.weather.length} trip location${context.weather.length === 1 ? '' : 's'}.`
        : 'I do not see weather snapshots in the current trip context.',
      supportingFacts: context.weather.slice(0, 5).map((snapshot) => {
        const forecast = snapshot.daily?.[0];
        return `${snapshot.locationName || 'Location'}: ${forecast?.condition || 'forecast available'}${typeof forecast?.precipitationProbabilityMax === 'number' ? `, ${forecast.precipitationProbabilityMax}% rain` : ''}`;
      }),
      relatedEventIds: context.weather.map((snapshot) => snapshot.eventId),
    });
  }

  if (normalizedQuestion.includes('next')) {
    const upcoming = [...context.events]
      .filter((event) => event.startDate && new Date(event.startDate) > new Date())
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const nextEvent = upcoming[0];
    return normalizeTripAnswer({
      answer: nextEvent
        ? `The next event I can see is ${nextEvent.name}.`
        : 'I do not see any future event in the structured trip context.',
      supportingFacts: nextEvent ? [`${nextEvent.name} starts ${nextEvent.startDate || 'at an unknown time'}`] : [],
      relatedEventIds: nextEvent ? [nextEvent.id] : [],
    });
  }

  return normalizeTripAnswer({
    answer: relatedEvents.length > 0
      ? `I found ${relatedEvents.length} possibly related event${relatedEvents.length === 1 ? '' : 's'}, but I need more specific context to answer confidently.`
      : 'I could not answer that from the available structured trip context.',
    supportingFacts: relatedEvents.map((event) => `${event.name}: ${event.startDate || 'date unknown'}`),
    relatedEventIds: relatedEvents.map((event) => event.id),
    caveat: 'Try asking about flights, weather, next events, lodging, or a specific event name.',
  });
};

const parseTripAnswer = (responseText) => {
  try {
    return normalizeTripAnswer(parseJsonObject(responseText));
  } catch {
    return normalizeTripAnswer(parseJsonObject(extractJsonObject(responseText)));
  }
};

const generateTripAssistantBriefing = async ({ trip }) => {
  if (!hasConfiguredAiProvider()) {
    throw new Error('AI provider API key is not configured');
  }

  const context = await buildAssistantContext(trip);
  const aiResponse = await generateAiText({
    prompt: buildPrompt(context),
    temperature: 0.2,
    topK: 1,
    topP: 0.2,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
  });
  const responseText = aiResponse.text;

  let briefing;
  if (!responseText) {
    console.warn('AI assistant briefing returned empty text; using deterministic fallback');
    briefing = buildDeterministicBriefing(context);
  } else try {
    briefing = parseAssistantResponse(responseText);
  } catch (error) {
    console.warn('AI assistant briefing returned malformed JSON; using deterministic fallback', {
      message: error.message,
      responseLength: responseText.length,
    });
    briefing = buildDeterministicBriefing(context);
  }

  return {
    provider: aiResponse.provider,
    model: aiResponse.model,
    generatedAt: new Date().toISOString(),
    briefing,
  };
};

const generateTripTodayBriefing = async ({ trip }) => {
  const context = await buildAssistantContext(trip);
  const todayContext = getTodayContext(context);
  if (!hasConfiguredAiProvider()) {
    return {
      model: 'deterministic',
      generatedAt: new Date().toISOString(),
      briefing: buildDeterministicTodayBriefing(todayContext),
    };
  }

  const aiResponse = await generateAiText({
    prompt: buildTodayPrompt(todayContext),
    temperature: 0.2,
    topK: 1,
    topP: 0.2,
    maxOutputTokens: 1536,
    responseMimeType: 'application/json',
  });
  const responseText = aiResponse.text;

  let briefing;
  if (!responseText) {
    console.warn('AI Today briefing returned empty text; using deterministic fallback');
    briefing = buildDeterministicTodayBriefing(todayContext);
  } else try {
    briefing = parseTodayResponse(responseText);
  } catch (error) {
    console.warn('AI Today briefing returned malformed JSON; using deterministic fallback', {
      message: error.message,
      responseLength: responseText.length,
    });
    briefing = buildDeterministicTodayBriefing(todayContext);
  }

  return {
    provider: aiResponse.provider,
    model: aiResponse.model,
    generatedAt: new Date().toISOString(),
    briefing,
  };
};

const generateTripReplanBriefing = async ({ trip }) => {
  const context = await buildAssistantContext(trip);
  const todayContext = getTodayContext(context);
  if (!hasConfiguredAiProvider()) {
    return {
      model: 'deterministic',
      generatedAt: new Date().toISOString(),
      briefing: buildDeterministicReplanBriefing(todayContext),
    };
  }

  const aiResponse = await generateAiText({
    prompt: buildReplanPrompt(todayContext),
    temperature: 0.2,
    topK: 1,
    topP: 0.2,
    maxOutputTokens: 1536,
    responseMimeType: 'application/json',
  });
  const responseText = aiResponse.text;

  let briefing;
  if (!responseText) {
    console.warn('AI replan briefing returned empty text; using deterministic fallback');
    briefing = buildDeterministicReplanBriefing(todayContext);
  } else try {
    briefing = parseReplanResponse(responseText);
  } catch (error) {
    console.warn('AI replan briefing returned malformed JSON; using deterministic fallback', {
      message: error.message,
      responseLength: responseText.length,
    });
    briefing = buildDeterministicReplanBriefing(todayContext);
  }

  return {
    provider: aiResponse.provider,
    model: aiResponse.model,
    generatedAt: new Date().toISOString(),
    briefing,
  };
};

const answerTripQuestion = async ({ trip, question }) => {
  const trimmedQuestion = String(question || '').trim();
  if (!trimmedQuestion) {
    throw new Error('Question is required');
  }

  const context = await buildAssistantContext(trip);
  if (!hasConfiguredAiProvider()) {
    return {
      model: 'deterministic',
      generatedAt: new Date().toISOString(),
      question: trimmedQuestion,
      result: buildDeterministicTripAnswer({ context, question: trimmedQuestion }),
    };
  }

  const aiResponse = await generateAiText({
    prompt: buildAskPrompt({ context, question: trimmedQuestion }),
    temperature: 0.2,
    topK: 1,
    topP: 0.2,
    maxOutputTokens: 1536,
    responseMimeType: 'application/json',
  });
  const responseText = aiResponse.text;

  let answer;
  if (!responseText) {
    console.warn('AI trip answer returned empty text; using deterministic fallback');
    answer = buildDeterministicTripAnswer({ context, question: trimmedQuestion });
  } else try {
    answer = parseTripAnswer(responseText);
  } catch (error) {
    console.warn('AI trip answer returned malformed JSON; using deterministic fallback', {
      message: error.message,
      responseLength: responseText.length,
    });
    answer = buildDeterministicTripAnswer({ context, question: trimmedQuestion });
  }

  return {
    provider: aiResponse.provider,
    model: aiResponse.model,
    generatedAt: new Date().toISOString(),
    question: trimmedQuestion,
    result: answer,
  };
};

module.exports = {
  buildAssistantContext,
  generateTripAssistantBriefing,
  generateTripTodayBriefing,
  generateTripReplanBriefing,
  answerTripQuestion,
  __test: {
    buildDeterministicBriefing,
    buildDeterministicTodayBriefing,
    buildDeterministicReplanBriefing,
    buildDeterministicTripAnswer,
    normalizeBriefing,
    normalizeTodayBriefing,
    normalizeReplanBriefing,
    normalizeTripAnswer,
    parseAssistantResponse,
    parseTodayResponse,
    parseReplanResponse,
    parseTripAnswer,
  },
};
