# Proactive Travel Assistant Plan

## Purpose

TripPlanner already has many of the right building blocks for a useful travel app: structured events, AI parsing, maps, notes, shared and personal checklists, expenses, collaborators, activity logs, dream trip ideas, and offline sync.

The next product step is to move from passive trip storage to proactive assistance. The app should help users understand what needs attention, prepare before travel, stay oriented during a trip, and recover from missing or conflicting details.

The north star is:

> TripPlanner should answer "what should I do next to make this trip smoother?"

## Product Principles

1. **Structured data is the source of truth.**
   AI can parse, summarize, and suggest, but deterministic code should validate dates, overlaps, missing fields, expenses, and reminders.

2. **Proactivity starts in the UI before notifications.**
   A good in-app "Needs Attention" system is more important than push notifications at first.

3. **Every suggestion should have a reason and an action.**
   Avoid generic tips. Each insight should explain why it appears and what the user can do next.

4. **Do not auto-save uncertain AI output.**
   AI-parsed reservations and suggestions should go through preview, validation, and explicit user acceptance.

5. **In-trip mode must work offline.**
   The most valuable trip assistance happens while users are traveling, when connectivity may be unreliable.

## Ideal Real-Trip Experience

This roadmap is focused on real trips, not abstract trip planning. The ideal app should support the whole lifecycle from an idea to a finished trip.

### 1. Inspiration To Draft Plan

User interaction:

- User creates a Costa Rica dream trip.
- User adds beaches, rainforest, food, wildlife, and family-friendly ideas.
- User invites a collaborator.

Ideal app behavior:

- Groups ideas by region and trip style.
- Asks for missing constraints: dates, budget, pace, travelers, must-do items.
- Suggests a rough trip shape: arrival city, lodging regions, major travel days, open days.
- Identifies what is still undecided.

Current gap:

- Dream trips work well as an idea board, but they do not yet convert ideas into a planning checklist or executable itinerary.

### 2. Booking Import

User interaction:

- User pastes or imports a flight receipt, hotel confirmation, rental car booking, and tour email.

Ideal app behavior:

- Extracts candidate events.
- Shows a review screen before saving.
- Detects duplicates.
- Validates required fields.
- Fills booking references, dates, times, and provider names.
- Geocodes addresses when possible.
- Preserves import history without storing sensitive raw text by default.

Current gap:

- AI parsing exists, but it is not yet a safe travel inbox with review, validation, duplicate detection, and import audit history.

### 3. Active Planning

User interaction:

- User opens the trip after importing bookings.

Ideal app behavior:

- Shows a Command Center with:
  - next event,
  - missing lodging nights,
  - unconfirmed activities,
  - empty days,
  - missing addresses,
  - pending group decisions,
  - suggested next actions.

Current gap:

- Trip detail shows stored events and tools, but it does not yet compute trip health or next-best actions.

### 4. Pre-Trip Preparation

User interaction:

- Trip is 45 days, 14 days, then 2 days away.

Ideal app behavior:

- Suggests checklist items based on destination, dates, flight, lodging, rental car, and collaborators.
- Adds due dates and shared/personal scope.
- Reminds users to download offline maps, confirm documents, check baggage, add insurance, and settle pre-trip purchases.

Current gap:

- Checklist is flexible but manual. It does not yet generate contextual prep tasks, assignments, or due dates.

### 5. Travel Day

User interaction:

- User is at SFO, then lands in San Jose, Costa Rica.

Ideal app behavior:

- Today view shows:
  - flight number and confirmation,
  - next event,
  - hotel check-in time,
  - address and navigation,
  - baggage notes,
  - offline sync status,
  - transport gap from airport to lodging.

Current gap:

- Useful data is present across events, notes, maps, checklist, and offline status, but there is no dedicated in-trip assistant surface.

### 6. During The Trip

User interaction:

- Weather changes.
- The group has an empty afternoon.
- A collaborator adds a restaurant.
- Expenses accumulate.

Ideal app behavior:

- Suggests rainy-day alternatives.
- Finds nearby activities that fit the time gap.
- Warns if travel time makes a plan unrealistic.
- Shows who paid recently and who should pay next.
- Keeps today-critical data available offline.

Current gap:

- Suggestions are mostly user-triggered. Weather, opening hours, routing, group preferences, and expense balance are not yet connected into proactive guidance.

### 7. Wrap-Up

User interaction:

- Trip ends.

Ideal app behavior:

- Prompts final settlements.
- Exports itinerary and expenses.
- Saves highlights.
- Learns from accepted/rejected suggestions for future trips.

Current gap:

- Exports and settlements exist, but there is no post-trip assistant loop or preference learning.

## Deployment Context

TripPlanner currently uses:

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** MongoDB

These deployment choices should shape the architecture.

### Vercel Frontend

Vercel should host the React/Vite frontend and PWA shell only.

Implications:

- Do not put private API keys in `VITE_*` environment variables. Vite env vars are bundled into browser code.
- Frontend should call Render backend APIs for AI, imports, reminders, and sensitive external services.
- `VITE_API_URL` is fine because it is public routing configuration.
- The service worker and IndexedDB can support offline trip access, but cannot run reliable scheduled background jobs.
- Push notification subscription setup can start in the frontend, but send logic belongs on the backend.

### Render Backend

Render should own server-side orchestration:

- Authenticated API endpoints.
- Gemini and other external service calls.
- AI prompt templates and schema validation.
- Import history.
- Notification generation.
- Reminder scheduling.
- MongoDB writes and migrations.

Render-specific guidance:

- For scheduled reminders, prefer a **Render Cron Job** or **Background Worker** over relying only on `setInterval` inside the web service.
- If using in-process cron in the web service, guard jobs with MongoDB locks so duplicate reminders are not sent if the service scales.
- If using a free/sleeping Render service, do not depend on the web process being awake for time-sensitive reminders.
- Keep long-running AI/import processing off the request path when possible; use a queued job pattern once imports become heavier.

### MongoDB

MongoDB should store the assistant memory and operational state.

Recommended new collections:

- `travelimports`
- `notifications`
- `reminders`
- `insightdismissals`
- `suggestionfeedback`
- `userpreferences`
- optional `insightsnapshots`

Recommended indexing:

- `travelimports`: `{ tripId: 1, createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`
- `notifications`: `{ userId: 1, readAt: 1, createdAt: -1 }`
- `reminders`: `{ status: 1, fireAt: 1 }`, `{ userId: 1, tripId: 1 }`
- `insightdismissals`: `{ userId: 1, tripId: 1, insightKey: 1 }` unique
- `suggestionfeedback`: `{ userId: 1, tripId: 1, createdAt: -1 }`

Use TTL indexes only for disposable debug logs, not for user-visible travel history.

## Current App Assets

### Trip And Event Data

Relevant files:

- `src/types/eventTypes.ts`
- `server/models/Trip.js`
- `src/components/TripDetails/NewTripDetails.tsx`
- `src/components/TripDetails/hooks.ts`

Current strengths:

- Rich event types: arrival, departure, stay, destination, flight, train, rental car, bus, activity.
- Events include dates, times, notes, locations, status, source, confirmation fields, and collaborators.
- Trip details already support event CRUD, maps, export, AI parsing, AI suggestions, checklists, notes, and expenses.

Current gaps:

- Event date/time fields are inconsistent across event types.
- Timezone is not first-class.
- Some trip-level fields in frontend types, such as weather, budget, documents, photos, and settings, are not fully implemented in backend/UI.
- The app does not currently compute trip health, missing information, itinerary conflicts, or next-best actions.

### AI Capabilities

Relevant files:

- `src/services/aiService.ts`
- `src/components/TripDetails/NewTripDetails.tsx`
- `src/components/TripDetails/AISuggestionsModal.tsx`
- `src/components/DreamTripAISuggestionsModal.tsx`
- `server/routes/aiSuggestions.js`
- `server/models/AISuggestion.js`

Current strengths:

- Gemini can generate trip suggestions, dream trip suggestions, destination suggestions, and parse text into events.
- Recent changes added JSON mode and parser debug logging.
- Suggestion history exists for prose suggestions.

Current gaps:

- Gemini is called from the browser, exposing the API key.
- AI event parsing saves events immediately instead of presenting a review screen.
- Structured destination suggestions use delimiter parsing instead of schema validation.
- Parsed events default to weak location data when geocoding is missing.
- AI history does not cover all structured parse/suggestion flows.

### Checklists And Notes

Relevant files:

- `src/components/TripDetails/TripChecklist.tsx`
- `src/components/TripNotes.tsx`
- `server/routes/notes.js`
- `server/models/Trip.js`
- `src/services/offlineService.ts`
- `src/services/networkAwareApi.ts`

Current strengths:

- Shared and personal checklist bins.
- Notes support rich text and edit history.
- Offline cache and sync queue support notes and checklist updates.

Current gaps:

- Checklist items are user-created only.
- No due dates, assignments, generated task suggestions, or reminder metadata.
- Notes are not mined for action items.

### Expenses And Settlements

Relevant files:

- `src/pages/ExpensesPage.tsx`
- `src/components/expenses/ExpenseDashboard.tsx`
- `src/components/expenses/SettlementManagement.tsx`
- `src/context/ExpenseContext.tsx`
- `server/models/Expense.js`
- `server/models/Settlement.js`
- `server/routes/expenses.js`

Current strengths:

- Expense splitting, summaries, settlements, and debt simplification.
- Offline expense support.

Current gaps:

- Trip budget is not connected to actual expenses.
- No proactive budget pacing, "who should pay next", receipt parsing, or settlement reminders.

### Maps, Calendar, And Offline

Relevant files:

- `src/components/TripMap.tsx`
- `src/components/Calendar.tsx`
- `src/components/CalendarMap.tsx`
- `src/components/OfflineIndicator.tsx`
- `src/services/offlineService.ts`
- `src/services/networkAwareApi.ts`

Current strengths:

- Trip map, calendar view, geocoding/route caches, PWA service worker, offline cache, and sync queue.

Current gaps:

- Routing data is not used to warn about impossible or tight transfers.
- Offline status is surfaced, but not integrated into a broader in-trip assistant experience.
- No "today" view optimized for travel day usage.

## Target Architecture

The proactive assistant architecture should be built around these concepts:

1. **Trip data foundation**
   Normalize event time, timezone, location quality, and validation so the app can reason reliably.

2. **Insight engine**
   Turn structured trip data into deterministic warnings, suggestions, and next actions.

3. **Trip Command Center**
   Put the user's current priorities at the top of the trip detail page.

4. **Travel Inbox**
   Make email/text/PDF import a reviewable workflow instead of an immediate AI save.

5. **Smart prep system**
   Generate checklist suggestions, due dates, and preparation tasks from trip context.

6. **In-trip assistant**
   Provide an offline-friendly Today view for real travel moments.

7. **External context adapters**
   Add flight status, weather, places, routing, currency, and travel requirement services only where they power a clear user interaction.

8. **Reminder and notification layer**
   Use Render jobs and MongoDB state to remind users at the right time.

9. **Server-side AI orchestration**
   Move Gemini and future AI calls behind the Render backend with schema validation, redaction, rate limiting, and model fallback.

The first three concepts can be implemented mostly in the frontend with existing data. Travel Inbox, reminders, external services, and server-side AI should be backend-led on Render with MongoDB persistence.

## Phase 0: Deployment And Data Foundation

### Goal

Prepare the codebase and deployment architecture for assistant features without changing major user flows yet.

### Tasks

1. Document environment boundaries:
   - Vercel owns public frontend configuration.
   - Render owns secrets and external API keys.
   - MongoDB stores operational assistant state.

2. Add backend configuration placeholders for:
   - Gemini API key.
   - geocoding/places service key.
   - weather service key.
   - notification/email service key.
   - optional flight status service key.

3. Add MongoDB models or placeholders for:
   - `TravelImport`
   - `Notification`
   - `Reminder`
   - `InsightDismissal`
   - `SuggestionFeedback`
   - `UserPreference`

4. Add indexes for the above collections.

5. Add a basic server-side service folder structure:
   - `server/services/ai/`
   - `server/services/imports/`
   - `server/services/insights/`
   - `server/services/notifications/`
   - `server/services/external/`

6. Add a lightweight job-lock utility backed by MongoDB for future Render cron/background workers.

7. Add privacy rules for debug logging:
   - redact card numbers,
   - redact ticket numbers,
   - redact passport numbers,
   - redact frequent flyer numbers,
   - avoid storing raw import text by default.

### Acceptance Criteria

- Secrets are planned for Render, not Vercel.
- MongoDB has a clear place for assistant state.
- Future scheduled jobs can be made idempotent.
- Privacy constraints are documented before import history is persisted.

## Phase 1: Insight Engine

### Goal

Create a deterministic engine that reads trip data and emits actionable insights.

This should be the foundation for the Command Center, in-trip assistant, reminders, and future AI summaries.

### Proposed Location

Frontend first:

- `src/services/tripInsights.ts`
- `src/types/insightTypes.ts`

Later, shared/backend:

- `server/services/tripInsights.js`
- or a shared package if the project is reorganized.

### Input Shape

```ts
interface TripInsightInput {
  trip: Trip;
  events: Event[];
  checklist?: {
    shared: ChecklistBin[];
    personal: ChecklistBin[];
  };
  expenses?: Expense[];
  settlements?: Settlement[];
  sync?: {
    isOnline: boolean;
    pendingCount: number;
  };
  currentUser?: User;
  now: Date;
}
```

### Output Shape

```ts
type TripInsightType =
  | 'missing_info'
  | 'conflict'
  | 'suggestion'
  | 'reminder'
  | 'budget'
  | 'sync'
  | 'collaboration';

type TripInsightSeverity = 'info' | 'warning' | 'critical';

interface TripInsight {
  id: string;
  type: TripInsightType;
  severity: TripInsightSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionTarget?: string;
  source: {
    kind: 'trip' | 'event' | 'checklist' | 'expense' | 'settlement' | 'sync';
    id?: string;
  };
  dismissible: boolean;
  createdAt: string;
}
```

### Initial Insight Rules

#### Event Completeness

Tasks:

- Detect events missing location/address.
- Detect arrival/departure/flight/train/bus/rental events missing booking reference.
- Detect lodging events missing check-in/check-out time.
- Detect activities and destinations missing start/end time.
- Detect events with placeholder coordinates `{ lat: 0, lng: 0 }`.

Examples:

- "Flight UA2312 is missing a terminal or gate."
- "Hotel stay is missing check-in time."
- "Dinner reservation has no address."

#### Itinerary Conflicts

Tasks:

- Detect overlapping events.
- Detect travel events that end after the next event starts.
- Detect checkout after departure.
- Detect check-in gaps that need plans.
- Detect missing lodging nights between arrival and departure.

Examples:

- "You land at 7:15 AM and your next event starts at 7:30 AM."
- "No stay is scheduled for the night of Jun 18."

#### Planning Gaps

Tasks:

- Detect full empty days.
- Detect long open gaps during active trip days.
- Detect trips with only transportation and no lodging.
- Detect trips with lodging and no transportation.
- Detect too many `exploring` events close to trip start.

Examples:

- "Jun 20 has no planned activities."
- "Three exploring events still need confirmation."

#### Checklist And Prep

Tasks:

- Detect incomplete shared checklist items before trip start.
- Detect personal checklist items due soon once due dates exist.
- Detect no checklist for upcoming international trip.

Examples:

- "Trip starts in 10 days and 4 shared checklist items are incomplete."

#### Expenses And Settlements

Tasks:

- Detect pending settlements.
- Detect expense imbalance.
- Detect actual spend approaching budget once budget exists.
- Suggest "who should pay next" based on balances.

Examples:

- "Fatima has paid most of the shared expenses. Mehran should pay next."

#### Offline And Sync

Tasks:

- Detect pending sync operations.
- Detect trip opened offline with stale cache.
- Surface sync failures when retry metadata exists.

Examples:

- "2 offline changes are waiting to sync."

### Phase 1 Implementation Tasks

1. Add insight types.
2. Add `generateTripInsights(input)` service.
3. Add unit tests for date overlap and missing information rules.
4. Add helper functions for event time normalization.
5. Add a simple insight renderer component.
6. Wire insights into trip details using existing trip data only.
7. Add local dismiss state for insight cards.

### Acceptance Criteria

- Trip detail can show a list of deterministic insights.
- Insights include severity, reason, and action.
- No AI calls are required.
- Existing event CRUD behavior is unchanged.

## Phase 2: Trip Command Center

### Goal

Make the trip detail page immediately answer:

- What is next?
- What needs attention?
- What can I do now?

### Proposed Location

- `src/components/TripDetails/TripCommandCenter.tsx`
- Used by `src/components/TripDetails/NewTripDetails.tsx`

### UI Sections

#### Now

Shown when the trip is active or starts soon.

Data:

- Current event, if any.
- Next event.
- Time until next event.
- Current offline/sync status.

#### Next

Shown for upcoming trips and active trips.

Data:

- Next scheduled event.
- Confirmation/reference fields.
- Address/location.
- Checklist or prep item connected to the event.

#### Needs Attention

Data:

- Critical/warning insights from the insight engine.
- Missing information.
- Conflict warnings.
- Pending settlements.
- Incomplete checklist items.

#### Suggested Actions

Examples:

- Paste a confirmation email.
- Add lodging.
- Generate ideas for empty day.
- Add ground transport.
- Invite collaborator.
- Create prep checklist.

### Phase 2 Implementation Tasks

1. Build `TripCommandCenter` with props:

   ```ts
   interface TripCommandCenterProps {
     trip: Trip;
     insights: TripInsight[];
     canEdit: boolean;
     onAddEvent?: () => void;
     onOpenAIImport?: () => void;
     onOpenChecklist?: () => void;
     onOpenExpenses?: () => void;
   }
   ```

2. Add `getNextEvent(events, now)` helper.
3. Add `getCurrentEvent(events, now)` helper.
4. Add insight grouping by severity.
5. Add action routing from insight to existing UI.
6. Place Command Center near the top of `NewTripDetails`.
7. Keep it visually compact and collapsible on mobile.

### Acceptance Criteria

- Users see the next event and highest priority issues without opening modals.
- Insights are actionable.
- No new backend dependency is required.

## Phase 3: Travel Import Workflow

### Goal

Turn AI parsing into a safe Travel Inbox for emails, reservation text, PDFs, and later screenshots.

Current behavior:

1. User pastes text.
2. Gemini parses.
3. Events are saved immediately.

Target behavior:

1. User pastes/imports text.
2. Gemini extracts candidate events.
3. App validates and enriches candidate events.
4. User reviews, edits, selects, and saves.
5. App stores import result for debugging and audit.

### Real Trip Example

A user pastes a United receipt for SFO to SJO and SJO to SFO.

Ideal app response:

- "I found 2 flights for your Costa Rica trip."
- "Flight 1 looks like your arrival to San Jose on Jun 18 at 07:15."
- "Flight 2 looks like your departure from San Jose on Jun 27 at 08:45."
- "Confirmation number B9YEB7 applies to both."
- "No duplicate flights found."
- "Add both events?"

The app should show editable candidate events before saving. It should not create events silently.

### Proposed Frontend Components

- `src/components/TripDetails/TravelImportModal.tsx`
- `src/components/TripDetails/ParsedEventReviewCard.tsx`
- `src/services/travelImportService.ts`

### Proposed Backend Components

- `server/routes/ai.js`
- `server/routes/imports.js`
- `server/services/ai/geminiClient.js`
- `server/services/imports/parseTravelText.js`
- `server/services/imports/validateParsedEvents.js`
- `server/models/TravelImport.js`

The frontend can keep a temporary parser for early UI work, but the target state is server-side parsing on Render.

### Candidate Event Shape

```ts
interface ParsedEventCandidate {
  tempId: string;
  type: EventType;
  fields: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    duplicateEventIds: string[];
  };
  selected: boolean;
}
```

### Validation Tasks

- Validate required fields by event type.
- Validate dates are parseable.
- Validate times are HH:mm.
- Validate event is inside trip date range or explain why not.
- Detect likely duplicate events.
- Detect overlap with existing events.
- Detect placeholder location.

### Duplicate Detection

Start with heuristic matching:

- Same event type.
- Same date.
- Same time or close time.
- Same flight/train/bus number.
- Same booking reference.
- Same accommodation name.
- Same place/activity title.

### UX Tasks

1. Replace current AI parse modal save behavior.
2. Show parsed candidate events in a review list.
3. Let user edit fields before saving.
4. Let user deselect low-confidence candidates.
5. Show validation warnings inline.
6. Save all selected events in a batch.
7. Handle partial save failures without losing the review state.

### Backend Model Later

```ts
TravelImport {
  tripId: ObjectId;
  userId: ObjectId;
  sourceType: 'email_text' | 'pdf_text' | 'manual_text';
  sourceHash: string;
  status: 'parsed' | 'failed' | 'accepted' | 'partially_accepted';
  model: string;
  parsedEvents: object[];
  validationErrors: string[];
  createdEventIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

Do not store raw sensitive travel emails by default. Store raw text only behind an explicit debug/admin setting, and redact payment/ticket details.

### MongoDB Persistence Tasks

1. Store import status and parsed candidate metadata.
2. Store a source hash for deduplication without saving raw source text.
3. Store created event IDs after user acceptance.
4. Store validation errors and model errors.
5. Add indexes for trip/user lookup.
6. Add optional TTL only for redacted debug traces, not import history.

### Render Backend Tasks

1. Move Gemini parsing endpoint to Render.
2. Add request authentication and per-user rate limiting.
3. Validate Gemini output before sending it to Vercel frontend.
4. Add model fallback config.
5. Add redacted server logs.
6. Return structured errors for quota, malformed JSON, and validation failure.

### Acceptance Criteria

- AI parsing no longer auto-saves events.
- User can inspect and edit parsed events.
- Invalid candidates are blocked or clearly warned.
- Duplicate candidates are detected before saving.
- Render owns Gemini API calls and secrets in the target implementation.

## Phase 4: Date, Time, And Timezone Normalization

### Goal

Make itinerary reasoning reliable.

Current issue:

Events use mixed fields:

- `startDate`
- `endDate`
- `date`
- `time`
- `checkIn`
- `checkOut`
- `departureDate`
- `arrivalDate`
- `pickupTime`
- `dropoffTime`

### Proposed Additions

Add normalized computed helpers first:

- `getEventStart(event): Date | null`
- `getEventEnd(event): Date | null`
- `getEventDisplayTime(event): string`
- `getTripTimezone(trip): string`

Later persist canonical fields:

```ts
interface Event {
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
}
```

### Tasks

1. [ ] Audit all event types and their current date/time fields.
2. [x] Add normalization helpers in `src/utils/eventTime.ts`.
3. [ ] Replace ad hoc date parsing in insights, calendar, and command center.
4. [x] Add trip-level timezone setting.
5. [ ] Add per-event timezone override later.
6. [ ] Add migration/backfill path for existing events if canonical fields are persisted.

### Acceptance Criteria

- Insight engine can compare all event types consistently.
- Calendar and command center use the same time helpers.
- Timezone assumptions are explicit.

## Phase 5: Smart Prep System

### Goal

Generate actionable checklist suggestions based on trip context.

This is where the app starts feeling like a planner instead of a repository. The user should not have to remember every travel-prep task manually.

### Proposed Location

- `src/services/prepSuggestions.ts`
- later `server/services/prepSuggestions.js`

### Inputs

- Destination/trip name.
- Trip dates and duration.
- Event types.
- International vs domestic.
- Lodging/transportation status.
- Collaborators.
- Season/month.
- Existing checklist items.
- Existing documents once documents are implemented.

### Output Shape

```ts
interface PrepSuggestion {
  id: string;
  title: string;
  reason: string;
  category:
    | 'documents'
    | 'packing'
    | 'transport'
    | 'lodging'
    | 'money'
    | 'health'
    | 'offline'
    | 'collaboration';
  scope: 'shared' | 'personal';
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
}
```

### Initial Suggestions

- Add passport check for international trips.
- Download offline maps.
- Confirm hotel check-in.
- Add ground transport after arrival.
- Check baggage allowance for flights.
- Add travel insurance document.
- Create packing list before departure.
- Invite collaborators when trip has one owner and many shared expenses.
- Settle pending balances after trip completion.

### Real Trip Examples

For a Costa Rica trip with international flights:

- "Check passport validity."
- "Download offline map for San Jose and your lodging area."
- "Check United baggage allowance for SFO to SJO."
- "Add airport transfer from SJO to lodging."
- "Confirm hotel check-in time."
- "Save travel insurance and emergency contact details."
- "Add local currency/payment plan."
- "Create shared packing checklist."

For a road trip:

- "Add rental car confirmation."
- "Check driver's license and insurance."
- "Add fuel/parking budget."
- "Download route maps."

For a group trip:

- "Invite Fatima as collaborator."
- "Assign shared prep items."
- "Create expense split before departure."

### Tasks

1. [x] Add deterministic prep suggestion service.
2. [x] Add "Suggested checklist items" panel in Trip Checklist.
3. [x] Let users accept suggestions into shared/personal checklist.
4. [x] Deduplicate against existing checklist items.
5. [ ] Add due dates to checklist items.
6. [ ] Add assignments later.
7. [ ] Persist accepted/dismissed prep suggestions in MongoDB once the backend model exists.
8. [ ] Use Render backend for AI-generated custom prep lists after deterministic suggestions exist.

### Acceptance Criteria

- Upcoming trips can generate contextual prep items.
- Users can accept/dismiss suggestions.
- Accepted suggestions become normal checklist items.
- Suggestions are not repeatedly shown after dismissal.

## Phase 6: In-Trip Assistant

### Goal

Create a travel-day interface optimized for active trips.

This view should answer "what do I need right now?" It must work well on mobile and remain useful offline.

### Proposed Route/UI

Options:

- Add a section inside trip details.
- Add `/trips/:id/today`.
- Add a floating "Today" entry point when a trip is active.

### In-Trip View Sections

#### Today

- Current event.
- Next event.
- Timeline for the day.
- Addresses and confirmation numbers.
- Transit buffer warnings.
- Offline availability status.

#### Need Before You Go

- Open checklist items.
- Missing documents.
- Offline sync state.
- Weather or travel requirement warnings once services are added.

#### Useful Details

- Hotel address.
- Booking references.
- Flight numbers.
- Emergency notes.
- Collaborators.
- Local emergency contacts once configured.

#### Expense Snapshot

- Recent expenses.
- Who paid last.
- Current balances.

### Real Trip Examples

At SFO:

- "Next: UA2312 to San Jose, departs 11:36 PM."
- "Confirmation: B9YEB7."
- "International boarding reminder: be at gate at least 30 minutes before departure."
- "Offline copies of today and tomorrow are available."

After landing in Costa Rica:

- "You arrive at 7:15 AM. Hotel check-in starts at 3:00 PM."
- "Suggested next action: add airport transfer or morning activity."
- "You have no lodging address saved. Add it now?"

During the trip:

- "Rain likely this afternoon. Outdoor waterfall hike may need a backup."
- "You have a 40-minute transfer before dinner. Traffic may make this tight."

### Tasks

1. [x] Build `InTripAssistant` component.
2. [x] Reuse insight engine for warnings.
3. [x] Reuse event time normalization.
4. [x] Add active trip detection.
5. [ ] Add offline-first data access.
6. [ ] Add quick actions for navigation, copy address, copy confirmation number, add expense, open checklist.
7. [x] Add a route such as `/trips/:id/today` or a prominent "Today" tab in trip details.
8. [ ] Cache the next 48 hours of critical trip data in IndexedDB.
9. [x] Add "copy confirmation" and "open maps" mobile affordances.

### Acceptance Criteria

- During an active trip, the app surfaces today-specific information.
- The view remains useful offline.
- It avoids AI dependency for critical travel facts.
- The user can get to critical details in one tap from the trip page.

## Phase 7: Notifications And Reminders

### Goal

Notify users about important trip actions without requiring them to open the app.

This should come after insights exist.

For the current deployment, reminders should be generated by Render and persisted in MongoDB. Vercel should only display notifications and manage browser push subscriptions.

### Backend Models

```ts
Notification {
  userId: ObjectId;
  tripId?: ObjectId;
  eventId?: string;
  type: string;
  title: string;
  message: string;
  readAt?: Date;
  actionUrl?: string;
  createdAt: Date;
}
```

```ts
Reminder {
  userId: ObjectId;
  tripId: ObjectId;
  eventId?: string;
  insightId?: string;
  fireAt: Date;
  channel: 'in_app' | 'email' | 'push';
  status: 'scheduled' | 'sent' | 'dismissed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}
```

### Scheduler Options

With Render:

- Preferred starting point: **Render Cron Job** that runs a reminder generation script every few minutes.
- Alternative: **Render Background Worker** for queue-style processing.
- Avoid depending only on frontend timers or service workers for important reminders.
- Initial cron command: `npm run reminders:generate` from the `server` directory.

Use MongoDB to make jobs idempotent:

- Store reminder state.
- Use unique keys for generated reminders.
- Use a simple MongoDB lock so repeated cron runs do not duplicate work.

More scalable later:

- BullMQ + Redis if the app needs high-volume job queues.
- External workflow scheduler if reminders become complex.
- Web Push plus email fallback for critical reminders.

### Initial Reminder Types

- Trip starts soon.
- Flight/train/bus/rental event coming up.
- Lodging check-in/check-out.
- Missing lodging night.
- Incomplete checklist before trip start.
- Pending settlements after trip end.
- Offline sync failures.

### Tasks

1. [x] Add notification model.
2. [x] Add reminder model.
3. [x] Add notification API endpoints.
4. [x] Add in-app notification UI on the Vercel frontend.
5. [x] Add Render Cron Job for reminder generation.
6. [x] Add MongoDB idempotency keys and job locks.
7. [x] Generate reminders from insight engine.
8. [x] Add user notification preferences.
9. Add email/push later.
10. [x] Retire generated in-app notifications when the underlying itinerary issue is resolved.

### Initial MongoDB Indexes

- `notifications`: `{ userId: 1, readAt: 1, createdAt: -1 }`
- `reminders`: `{ status: 1, fireAt: 1 }`
- `reminders`: `{ userId: 1, tripId: 1 }`
- `reminders`: `{ uniqueKey: 1 }` unique

### Acceptance Criteria

- App can show unread in-app notifications.
- Reminder jobs are idempotent.
- Users can dismiss or mark notifications as read.
- Reminder generation does not depend on the Vercel frontend being open.

## Phase 8: Server-Side AI Orchestration

### Goal

Move AI calls off the client and centralize parsing, validation, logging, and fallback behavior.

### Why

- Protect Gemini API key.
- Avoid exposing billing quota to the browser.
- Add validation before response reaches UI.
- Log failures safely.
- Support model fallback.
- Redact sensitive travel text.

### Proposed Endpoints

- `POST /api/ai/parse-events`
- `POST /api/ai/generate-trip-suggestions`
- `POST /api/ai/generate-prep-suggestions`
- `POST /api/ai/summarize-trip-readiness`

These should be hosted on the Render backend.

### Tasks

1. [x] Add backend AI service wrapper.
2. [x] Move Gemini API key to server env.
3. Add structured response validation with `zod`.
4. Add error mapping for quota, model errors, malformed JSON, safety blocks.
5. Add redacted debug logging.
6. [x] Update frontend `aiService.ts` to call backend endpoints.
7. Add model fallback config.
8. Add rate limiting per user.
9. Add MongoDB persistence for AI parse/import attempts.
10. Remove `VITE_GEMINI_API_KEY` from Vercel once migration is complete.

### Render Environment Variables

Examples:

- `GEMINI_API_KEY`
- `AI_MODEL_PRIMARY`
- `AI_MODEL_FALLBACK`
- `AI_DEBUG_LOGGING_ENABLED`
- `AI_RAW_IMPORT_STORAGE_ENABLED`

Do not expose these as Vercel `VITE_*` variables.

### Acceptance Criteria

- Browser no longer contains Gemini API key.
- AI responses are validated server-side.
- Parser failures include actionable error details.
- Existing UI behavior still works after migration.

## Phase 9: Contextual Suggestions And Personalization

### Goal

Use trip context and user behavior to suggest better actions.

### Inputs

- Accepted/rejected AI suggestions.
- Likes/dislikes on exploring events.
- Dream trip ideas and priorities.
- Existing activities and notes.
- Expenses and category preferences.
- Collaborator behavior.

### Suggestions

- Fill empty day with nearby activities.
- Suggest restaurants near lodging.
- Suggest rainy-day alternatives once weather exists.
- Suggest transportation between far-apart events.
- Suggest lower-cost alternatives if budget is tight.
- Suggest follow-up actions based on recently added events.

### Tasks

1. Persist accepted/rejected structured suggestions.
2. Add preference signals model.
3. Add context builder for AI prompts.
4. Add deterministic filters before showing suggestions.
5. Add feedback UI on suggestions.

### Acceptance Criteria

- Suggestions improve based on user actions.
- Rejected suggestions are not repeatedly shown.
- Suggestions explain why they are relevant.

## Phase 10: External Context Services

### Goal

Add external services that improve specific real-trip interactions.

Do not add services just because they are interesting. Each service should support a user-facing assistant behavior.

### Recommended Service Categories

#### Flight Status

Possible providers:

- FlightAware
- Cirium
- AeroDataBox
- Aviationstack

User experience unlocked:

- Gate and terminal updates.
- Delay alerts.
- Check-in reminders.
- Connection or arrival timing warnings.

Implementation tasks:

1. Add provider abstraction in `server/services/external/flights/`.
2. Store flight status snapshots in MongoDB.
3. Match flight status to event flight number/date.
4. Generate insights and reminders from status changes.
5. Avoid polling every flight too frequently; poll only upcoming active flights.

#### Maps, Places, And Geocoding

Possible providers:

- Google Places
- Mapbox
- OpenStreetMap/Nominatim
- Foursquare

User experience unlocked:

- Address resolution.
- Location quality warnings.
- Nearby suggestions.
- Opening hours.
- "This is too far away" itinerary warnings.

Implementation tasks:

1. Add server-side geocoding endpoint.
2. Add location quality status to events.
3. Geocode parsed/imported events before review when possible.
4. Cache geocoding results in MongoDB.
5. Add opening-hours data only after location matching is reliable.

#### Routing And Transit

Possible providers:

- Google Directions
- Mapbox Directions
- Rome2Rio
- Local GTFS/transit feeds where available

User experience unlocked:

- Transfer buffer warnings.
- Ground transport suggestions after airport arrival.
- Transit time estimates between events.
- "This day is too packed" warnings.

Implementation tasks:

1. Add route estimate adapter.
2. Cache route estimates by origin/destination/mode.
3. Use route estimates in insight engine.
4. Surface warnings in Command Center and Today view.

#### Weather

Possible providers:

- OpenWeather
- Tomorrow.io
- WeatherAPI
- Apple WeatherKit

User experience unlocked:

- Rainy-day alternatives.
- Heat/cold packing reminders.
- Outdoor activity warnings.
- Weather-aware daily briefing.

Implementation tasks:

1. Add weather adapter on Render.
2. Cache forecast by location/date.
3. Connect weather to activity/location events.
4. Generate weather insights only for upcoming/active trip days.

#### Documents, Email, And OCR

Possible providers/tools:

- Gmail API
- Microsoft Graph
- PDF text extraction
- OCR service for screenshots

User experience unlocked:

- Travel Inbox.
- Automatic reservation import.
- Document vault.
- Confirmation extraction from PDFs/screenshots.

Implementation tasks:

1. Start with manual paste/upload.
2. Add PDF text extraction.
3. Add OCR for images/screenshots.
4. Add Gmail/Outlook integrations only after permission and privacy design is clear.

#### Currency And Payments

Possible providers:

- ExchangeRate.host or similar exchange-rate API
- Wise
- Stripe
- Plaid
- Venmo deep links

User experience unlocked:

- Budget conversion.
- Spend pacing.
- "Who should pay next?"
- Easier settlement flows.

Implementation tasks:

1. Add exchange rate lookup and caching.
2. Connect trip budget to expenses.
3. Add budget pacing insight.
4. Add settlement reminders.
5. Consider payment deep links later.

#### Travel Requirements And Advisories

Possible providers:

- Sherpa
- IATA Timatic partners
- Government travel advisory feeds

User experience unlocked:

- Passport/visa/health requirement reminders.
- Destination-specific entry rules.
- Pre-trip warnings.

Implementation tasks:

1. Start with deterministic "international trip" checklist suggestions.
2. Add travel requirement provider later.
3. Store requirement checks as timestamped snapshots.
4. Surface only high-confidence requirements and link to source.

### Service Integration Principles

1. Keep all provider secrets on Render.
2. Cache provider responses in MongoDB to control cost and latency.
3. Add provider-specific rate limits.
4. Design adapters so providers can be swapped.
5. Always show source and last-updated time for volatile data like flights and weather.
6. Do not block core itinerary access if a provider is down.

## Cross-Cutting Technical Tasks

### Data Quality

- Add validation for event required fields.
- Add location quality status.
- Add duplicate detection helper.
- Add canonical event time helpers.
- Add trip timezone.

### Security And Privacy

- Move AI keys server-side.
- Redact payment card numbers, ticket numbers, passport numbers, and frequent flyer numbers from logs.
- Avoid storing raw travel confirmation text by default.
- Add explicit debug mode for raw AI parser traces.

### Testing

Add tests for:

- Event time normalization.
- Overlap detection.
- Missing lodging night detection.
- Duplicate event detection.
- Insight generation.
- Checklist suggestion deduplication.
- AI response schema validation.

### Observability

Add structured logs for:

- AI parse attempts.
- Validation failures.
- Import accept/reject actions.
- Reminder generation.
- Notification send failures.
- Sync queue failures.

## Milestone Plan

### Milestone 0: Assistant Foundation

Scope:

- Deployment boundary documentation.
- MongoDB model stubs for assistant state.
- Event time helper plan.
- Privacy/redaction rules.
- Render service folder structure.

Estimated effort: small to medium.

Outcome:

- The app has a clear backend/frontend boundary for assistant work.

### Milestone 1: Command Center MVP

Scope:

- Insight types.
- `generateTripInsights`.
- Missing info rules.
- Overlap rules.
- Next/current event helpers.
- Command Center UI.

Estimated effort: medium.

Outcome:

- Trip detail page feels proactive immediately.

### Milestone 2: Travel Inbox MVP

Scope:

- Replace auto-save parser flow.
- Candidate event review cards.
- Validation warnings.
- Duplicate detection.
- Batch save selected events.
- Travel import model on MongoDB.
- Render endpoint for server-side parsing if AI migration is included in this milestone.

Estimated effort: medium.

Outcome:

- Reservation import becomes safer and more trustworthy.

### Milestone 3: Event Time Foundation

Scope:

- Event time helpers.
- Trip timezone setting. Completed locally with editable `trip.timezone`.
- Use helpers in insights and Command Center. In progress; Command Center now formats with the trip timezone.

Estimated effort: medium.

Outcome:

- Reliable itinerary checks and in-trip logic.

### Milestone 4: Smart Prep Checklist And Planning Nudges

Scope:

- Prep suggestion service.
- Suggested checklist UI.
- Accept/dismiss suggestions.
- Due dates.
- Suggested ground transport after arrivals.
- Suggested fill-in actions for empty days.

Estimated effort: medium.

Outcome:

- Trip planning becomes task-oriented.

### Milestone 5: In-Trip Assistant

Scope:

- Today view.
- Offline-first event/checklist/confirmation details.
- Quick actions.
- Insight warnings.
- Next 48 hours critical data cache.

Estimated effort: medium to large.

Outcome:

- App becomes useful during the trip, not just before it.

### Milestone 6: Notifications On Render

Scope:

- Notification/reminder models.
- Render Cron Job or Background Worker.
- MongoDB job locks/idempotency keys.
- In-app notification UI.

Estimated effort: medium to large.

Outcome:

- Assistant can reach out proactively.

### Milestone 7: Server-Side AI Migration

Scope:

- Server-side Gemini wrapper.
- AI endpoint migration.
- Schema validation.
- Redacted logging.
- Per-user rate limiting.

Estimated effort: medium to large.

Outcome:

- AI becomes safer, cheaper to control, and easier to debug.

### Milestone 8: External Context Services

Scope:

- Weather adapter.
- Geocoding/places adapter.
- Routing estimates.
- Optional flight status provider.
- Service response caching in MongoDB.

Estimated effort: large, best split by provider.

Outcome:

- The assistant can respond to real-world changes and location context.

## Recommended First Sprint

Build Milestone 0, Milestone 1, and the first half of Milestone 2.

### Sprint Tasks

- [x] Add docs/config notes for Vercel public env vs Render secret env.
- [x] Add `TripInsight` types.
- [x] Add `eventTime` helpers.
- [x] Add `generateTripInsights`.
- [x] Implement missing-field insights.
- [x] Implement overlap insights.
- [x] Implement next/current event helpers.
- [x] Add `TripCommandCenter`.
- [x] Wire Command Center into `NewTripDetails`.
- [x] Change AI parse flow to show candidates before saving.
- [x] Add candidate validation for required fields.
- [x] Add duplicate detection helper.
- [x] Create MongoDB `TravelImport` model if import history is included in the sprint.
- [x] Tighten round-trip flight parsing prompt and warn when a multi-flight receipt returns only one candidate.
- [x] Update flight receipt parsing to create full flight-segment events so origin departures appear in the trip timeline.
- [x] Persist Travel Import parse status and accepted event IDs without storing raw pasted text.
- [x] Add a Command Center nudge to plan ground transport after flight arrivals.
- [x] Add local per-trip dismissal for Command Center insights.
- [x] Route Command Center insight actions to the relevant event editor or add-event modal.

### Definition Of Done

- Opening a trip shows next event and top warnings.
- Pasted reservation text no longer creates events without review.
- Users can accept selected parsed events.
- Insights and parser validation are deterministic and testable.
- No new frontend secret is required on Vercel.

## Open Decisions

1. Should the Command Center be always visible or collapsible after trip start?
2. Should dismissed insights persist locally first or in the backend immediately?
3. Should Travel Import store raw source text, redacted text, or only hashes?
4. Should notifications start as in-app only?
5. Should AI server migration happen before or after parser review UI?
6. Should trip timezone be selected manually, inferred from first destination, or both?
7. Should Render reminders use Cron Jobs first or a Background Worker?
8. Which external service should be integrated first: geocoding, weather, or flight status?
9. Should email inbox integrations wait until manual paste/PDF import is mature?

## Suggested Priority

1. Deployment/data foundation.
2. Event time normalization helpers.
3. Insight engine.
4. Command Center.
5. Travel Inbox parser review flow.
6. Smart prep checklist.
7. In-trip assistant.
8. Notifications on Render.
9. Server-side AI migration.
10. External context services.

This order maximizes product impact while reducing architectural risk. It also avoids making AI or notifications responsible for behavior that deterministic trip data should handle.
