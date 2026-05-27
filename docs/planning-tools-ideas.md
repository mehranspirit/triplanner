# Planning Tools Ideas

Companion to the [Proactive Travel Assistant Plan](./proactive-travel-assistant-plan.md). For phased implementation tasks, see [Trip Health & Collaborative Decisions Plan](./trip-health-and-decisions-plan.md).

This doc captures product ideas for **pre-trip and active planning** — tools in the same spirit as **Explore AI suggestions**, but broader than activity generation alone.

## North star

> Help users answer: **“What should I do next to make this trip ready?”**

Planning tools should feel like a copilot, not a blank itinerary editor. Each suggestion should include **why it appeared** and **one clear action** (see product principles in the main plan).

## Design principles

1. **Structured data is the source of truth.** Use deterministic rules for dates, gaps, overlaps, lodging coverage, and money. Use AI for ideas, wording, and open-ended questions.
2. **Do not auto-save uncertain AI output.** Preview → validate → explicit accept (same pattern as Explore suggestions and location confirmation).
3. **Proactivity in the UI first.** A planning panel or sidebar beats notifications for pre-trip work.
4. **Reuse existing building blocks** before building parallel systems.

---

## What we already have

| Tool | Role in planning | Notes |
|------|------------------|-------|
| **Explore suggestions** | Keyword-driven AI activities/destinations | `ExploreSuggestionsModal` |
| **AI import / parse** | Turn receipts/emails into draft events | Travel import dialog |
| **Trip insights** | Rule-based needs attention | Overlaps, missing refs, locations, weather, etc. — `tripInsights.ts` |
| **Prep suggestions** | Contextual checklist items | International flight, rental car, etc. — `prepSuggestions.ts` |
| **Dream trips** | Idea board before a real itinerary | Does not yet convert to executable plan |
| **Review locations** | Resolve map pins with user confirmation | Geocoding UX |
| **Checklist, notes, expenses, collaborators** | Group planning infrastructure | Manual today |
| **Ask My Trip** | Free-form Q&A over trip context | **Backend + UI exist but disconnected** — `TripCommandCenter`, `POST /api/trips/:tripId/ask` |
| **AI trip briefing** | Synthesized readiness view | **Partially orphaned** — was in Command Center |
| **Proactive context cards** | Phase-aware “relevant now” | Stronger during trip than pure planning |

### Main planning gap today

Tools exist in isolation. Nothing ties them into a single **“what should I do next?”** workflow during the planning phase. Command Center-style planning UI was replaced by timeline + proactive sidebar + Today panel, without re-homing all assistant features.

---

## High-leverage ideas

### 1. Trip health / completeness score

Single **planning readiness** view that aggregates deterministic checks into one score (or grouped tracks). **Empty days, lodging gaps, and transport gaps are core dimensions of trip health** — not separate top-level features. Each issue surfaces in the health panel with **multiple resolution options** so users can fix, defer, or intentionally dismiss.

#### Health dimensions

| Dimension | What we check | Contributes to |
|-----------|---------------|----------------|
| **Schedule coverage** | Empty or under-planned calendar days | Content readiness |
| **Lodging coverage** | Nights without a stay spanning them | Logistics readiness |
| **Transport continuity** | Missing or tight ground links after flights/trains; long gaps between distant events | Logistics readiness |
| **Location quality** | Unresolved or inferred map pins | Logistics readiness |
| **Booking completeness** | Missing confirmation refs on bookable events | Logistics readiness |
| **Decision state** | Open decision sets with no winner; exploring options not in any set | Content readiness |

Score can be **one headline number** plus **sub-scores** for logistics vs content (see open questions).

#### Issue model

Each health issue is a structured object, not just a string:

```ts
{
  id: string;
  type: 'empty_day' | 'lodging_gap' | 'transport_gap' | 'location' | 'booking_ref' | 'exploring_event' | ...;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  reason: string;           // why this appeared
  affectedDates?: string[];
  relatedEventIds?: string[];
  resolutionOptions: ResolutionOption[];
}

ResolutionOption {
  id: string;
  label: string;          // primary button text
  action: 'navigate' | 'create_event' | 'edit_event' | 'ai_suggest' | 'dismiss' | 'extend_stay' | ...;
  payload?: Record<string, unknown>;
}
```

Dismissals are **typed** (e.g. `intentional_rest_day`, `staying_with_friends`) and stored per trip so dismissed issues do not reduce the score again unless underlying data changes.

---

#### Empty days (schedule coverage)

**Detection:**

- Calendar day within trip bounds with zero scheduled events, or
- Only `exploring` placeholders and no confirmed anchor (flight, stay check-in, etc.)

**Resolution options:**

| Option | Action | Notes |
|--------|--------|-------|
| **Suggest activities for this day** | Open scoped Explore modal (`date` + area from adjacent events/stays) | Reuses Explore AI pipeline |
| **Add event manually** | Open add-event menu with date pre-filled | |
| **Mark as rest / travel day** | Dismiss with `intentional_rest_day`; optional note | Counts as resolved for health |
| **Block for later planning** | Dismiss with `planning_deferred`; re-surfaces N days before trip | |
| **Move an event here** | Navigate to timeline day; highlight draggable candidates | Optional v2 |

---

#### Lodging gaps

**Detection:**

- Night within trip bounds not covered by any stay’s check-in → check-out range
- Events in region A on dates where nearest stay is region B (optional v2: distance-based)
- Gap between consecutive stays (checkout day ≠ next check-in, orphan night)

**Resolution options:**

| Option | Action | Notes |
|--------|--------|-------|
| **Add stay for these nights** | Create stay event with check-in/out pre-filled from gap | Primary fix |
| **Extend existing stay** | Edit adjacent stay: push check-out or pull check-in | When gap is at start/end of stay |
| **Not staying overnight here** | Dismiss with `day_trip` or `red_eye` | e.g. overnight transport counts as “covered” if train/flight spans night |
| **Staying with friends / host** | Dismiss with `alternate_lodging`; optional free-text label | |
| **Already booked, not added yet** | Shortcut to AI import or add stay manually | Links to import inbox |

---

#### Transport gaps

**Detection (pre-trip; reuse InTripAssistant transfer logic where possible):**

- Flight/train/bus arrives but no plausible ground transport or next event within reasonable time/distance
- **Tight connection:** gap &lt; threshold (e.g. 90 min international, 45 min domestic) between arrival and next commitment
- **Long dead zone:** multi-hour gap with no events between distant endpoints (informational)
- Missing rental pickup after airport arrival when next activity is far from airport

**Resolution options:**

| Option | Action | Notes |
|--------|--------|-------|
| **Add ground transport** | Create rental car / train / bus with times seeded from arrival | Pre-fill from flight endpoint |
| **Add buffer / buffer note** | Create short `activity` or note event (“Airport customs buffer”) | For tight connection warnings |
| **Reschedule next event** | Edit downstream event start time | When user accepts tight gap |
| **Connection is fine** | Dismiss with `connection_ok` + optional reason | User override |
| **Using rideshare / taxi** | Dismiss with `ad_hoc_ground_transport` | No structured event required |
| **Suggest transfer options** | AI or static tips (informational card) | v2; no auto-save |

**Severity guide:**

- Missing ground transport when next event is far → **warning**
- Tight international connection → **critical**
- Long empty afternoon → **info** (optional, not always shown)

---

#### Other health issues (same pattern)

| Type | Example resolutions |
|------|---------------------|
| **Location** | Review location (confirm dialog), Search on Google (card quick action), Dismiss if map optional |
| **Booking ref** | Edit event, Paste from import inbox |
| **Exploring event** | Confirm, Delete, Replace with AI suggestion, **Add to decision set**, **Vote** |

---

#### UI behavior

- **Trip health panel** lists issues grouped by dimension (or sorted by severity).
- Each row: title, reason, **primary resolution** + **“More options”** menu for alternates and dismissals.
- Timeline shows **lightweight chips** for empty days / lodging / transport on affected dates; chip opens same issue with resolutions (no duplicate logic).
- Progress ring or bar updates when issue is fixed or intentionally dismissed.

**Implementation:** Mostly deterministic in `tripHealth.ts` (new) extending patterns from `tripInsights.ts`. AI only for “Suggest activities for this day” and optional transfer tips.

**UI home:** Planning panel (primary), proactive sidebar card when phase is `before`, timeline chips.

**Related plan:** Phase 1 Insight Engine, Phase 2 Trip Command Center.

---

### 2. Empty-day filler (scoped Explore — resolution path)

Not a standalone surface. Invoked from **trip health** or timeline chip via **“Suggest activities for this day”**.

**Inputs:** Date, geographic context from nearby events/stays, trip keywords, pace preference, existing bookings.

**Implementation:** Reuse Explore suggestion pipeline scoped to **date + area** instead of whole-trip keywords.

**User flow:** Health issue → scoped Explore modal → batch add selected suggestions → empty-day issue auto-clears when day has confirmed content (or user chose rest day).

---

### 3. Lodging gap detector (health issue source)

Rules feed **trip health**; no separate detector UI.

- Compare stay check-in/check-out to trip night range
- Flag orphan nights between stays
- Optional v2: region mismatch when events and stays disagree geographically

Resolution options: see **Lodging gaps** under Trip health above.

---

### 4. Transport chain checker (health issue source)

Rules feed **trip health**; shares logic with **InTripAssistant** transfer summaries.

- After flight/train lands: rental / next event / dismiss paths
- Tight connection and missing ground transport severities

Resolution options: see **Transport gaps** under Trip health above.

---

### 5. Smart prep checklist generator

Expand `prepSuggestions` into a first-class planning feature:

- Destination country → visa, passport expiry, vaccines (informational)
- Trip length, kids, rental car, international arrival → timed tasks
- Due dates relative to trip start (“Book eSIM 7 days before”, “Online check-in 24h before”)

**UX:** Suggest → user accepts → creates checklist items with due dates and shared/personal scope.

**Related plan:** Phase 4 Pre-Trip Preparation.

---

### 6. Dream trip → real trip converter

Close the inspiration → itinerary gap:

- Cluster dream cards by region or theme
- “Promote to exploring event” on a specific day
- “Build draft week from pinned ideas” — AI or rule-based day blocks
- Preserve links back to source dream item

**Related plan:** Ideal experience §1 Inspiration To Draft Plan.

---

### 7. Import inbox (travel parser 2.0)

Dedicated **import queue** instead of one-shot parse modal:

- Parsed candidates with confidence
- Duplicate detection against existing events
- Missing required fields highlighted
- Geocode / location preview before save
- Import history and status (parsed, needs_review, applied, duplicate)

**Related plan:** Phase 3 Travel Import Workflow.

---

### 8. Ask My Trip (re-wire)

Free-form planning questions over structured context:

- “Do we have lodging every night?”
- “What’s open on day 4?”
- “Which flights still need confirmation numbers?”

**Status:** `answerTripQuestion` API and `AskMyTripCard` UI exist; not mounted in current trip details layout.

**UI options:** Today panel section, Planning panel, trip menu item.

---

### 9. Collaborative decision tools

Help groups **pick between exploring options** without endless chat threads. The first and most obvious use case: **vote on alternative exploring events** for the same planning slot (dinner options, hotel candidates, activity A vs B).

#### What already exists

| Piece | Status |
|-------|--------|
| `status: 'exploring'` | Default for AI suggestions; dashed card styling |
| `status: 'alternative'` | In Trip schema + violet map markers; **not used in NewTripDetails UI** |
| `likes` / `dislikes` per event | Stored on event; **vote API works** (`POST/DELETE .../events/:id/vote`) |
| Vote rules | Only on `exploring` events; one vote per user (like **or** dislike); activity log |
| Explore suggestions | Batch-adds competing options as separate exploring events |
| New trip UI | **No vote buttons** — voting UI lives in deprecated `OldTripDetails` only |

So the backend primitive is there; what’s missing is **grouping**, **surfacing**, and **closing** a decision.

---

#### Core concept: decision sets

A **decision set** is a lightweight group: “we need to choose one of these for X.”

```ts
DecisionSet {
  id: string;
  tripId: string;
  title: string;              // "Saturday dinner", "Monteverde lodging"
  slot?: {
    date?: string;            // YYYY-MM-DD
    startTime?: string;
    endTime?: string;
    label?: string;           // free-text slot description
  };
  optionEventIds: string[];   // exploring (or alternative) events in contention
  status: 'open' | 'decided' | 'deferred';
  winnerEventId?: string;
  decidedAt?: string;
  decidedBy?: string;
  createdBy: string;
  createdAt: string;
  comparisonOverview?: DecisionComparisonOverview;  // cached AI + deterministic merge; see below
}
```

```ts
DecisionComparisonOverview {
  generatedAt: string;
  generatedBy: 'ai' | 'deterministic';
  model?: string;
  stale: boolean;              // true when options/votes changed since generatedAt
  summary: string;             // 1–2 sentence group-level takeaway
  dimensions: ComparisonDimension[];
  optionSummaries: OptionSummary[];
  tradeoffs: string[];         // cross-option tensions ("A is cheaper but farther")
  missingInfo: string[];       // gaps in structured data AI could not infer
  softRecommendation?: {
    eventId: string;
    label: string;             // event display name
    reason: string;
    confidence: 'low' | 'medium' | 'high';
    caveats: string[];
  };
}

ComparisonDimension {
  key: string;                 // 'cost' | 'location' | 'time' | 'effort' | 'weather' | ...
  label: string;               // human label
  values: Array<{
    eventId: string;
    display: string;           // cell text for this option
    highlight?: 'best' | 'worst' | 'neutral';
  }>;
}

OptionSummary {
  eventId: string;
  bestFor: string[];           // "Families", "Short walk from hotel"
  watchOuts: string[];         // "No price listed", "30 min drive"
  oneLiner: string;            // single-line pitch
}
```

Events optionally reference `decisionSetId` (or store option list only on the set — prefer **set owns option ids** to avoid orphan fields).

**Auto-suggest sets (v1 heuristic, no ML):**

- Same calendar day + same `activityType` or both `destination`/`activity` + overlapping time window
- Multiple `stay` events with overlapping check-in/out ranges
- User explicitly clicks **“Compare as alternatives”** on 2+ selected exploring events

Manual creation is always available: **“Start a group decision”** from multi-select or from Explore batch add (“Add as alternatives for Saturday dinner”).

---

#### Voting model (extend existing likes/dislikes)

Keep **per-event** like/dislike — do not invent a second vote store.

| Vote | Meaning |
|------|---------|
| **Like** | “I’m in favor of this option” |
| **Dislike** | “I’d rather not do this one” |
| **No vote** | Neutral / haven’t looked yet |

**Aggregate display per option:**

- Like count, dislike count
- Who voted (avatars + names — reuse collaborator list)
- Current user’s vote state

**Optional v2:** ranked choice or “pick top 2” — only if like/dislike feels too coarse in practice.

**Rules:**

- Voting only while option is `exploring` (matches existing API)
- Collaborators + owner can vote; viewers read-only
- Offline: queue vote like other trip mutations; show pending state

---

#### AI comparison overview

The comparison view should include an **AI-generated overview** that helps the group understand tradeoffs **before** voting — not a wall of prose. Output is **structured JSON**, rendered into scannable UI blocks, grounded only in event fields + trip context (votes, weather for that day, distance from stay if coords exist).

**Principles:**

- **Structured first** — tables, bullets, badges; not a single chat paragraph
- **Grounded** — cite only data present on options; `missingInfo` when price/time/location absent
- **Non-binding** — soft recommendation never auto-confirms; votes remain authoritative
- **Refreshable** — regenerate when options change; mark stale when votes/options edit
- **Deterministic fallback** — if AI unavailable, build overview from sorted facts + vote tallies only

**UI layout (comparison view top section):**

```
┌─────────────────────────────────────────────────────────┐
│  Saturday dinner · 3 options · 2/4 voted                │
│  AI overview                          [Regenerate ↻]    │
├─────────────────────────────────────────────────────────┤
│  Summary                                                │
│  "Three walkable options near your hotel; Option B     │
│   leads on votes and has the clearest reservation path."│
├─────────────────────────────────────────────────────────┤
│  Compare at a glance                                    │
│  ┌──────────┬────────────┬────────────┬────────────┐  │
│  │          │ Option A   │ Option B ★ │ Option C   │  │
│  ├──────────┼────────────┼────────────┼────────────┤  │
│  │ Cost     │ —          │ $$         │ $          │  │
│  │ Distance │ 0.4 mi     │ 0.8 mi     │ 1.2 mi     │  │
│  │ Time     │ 7:00 PM    │ 7:30 PM    │ 6:30 PM    │  │
│  │ Votes    │ 1 like     │ 2 likes    │ 0          │  │
│  │ Weather  │ Clear      │ Clear      │ Clear      │  │
│  └──────────┴────────────┴────────────┴────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Tradeoffs                                              │
│  • B is most popular but pricier than C                 │
│  • A is closest but no booking ref yet                    │
├─────────────────────────────────────────────────────────┤
│  Per option                                             │
│  [Option B card]  Best for: …  Watch out: …           │
│  [Option A card]  …                                     │
├─────────────────────────────────────────────────────────┤
│  Suggested pick (optional)                              │
│  Option B — best balance of group votes and timing      │
│  Caveat: confirm reservation window                     │
└─────────────────────────────────────────────────────────┘
│  … option rows with vote controls below …               │
```

**Dimension rows (typical by event type):**

| Event types | Dimensions to compare |
|-------------|---------------------|
| Activity / destination | Time, cost, location/distance from anchor stay, duration, weather that day, votes |
| Stay | Nightly cost, check-in/out fit, area, location quality, votes |
| Restaurant-ish activity | Cost, distance, time, dietary notes from `notes`, votes |

Distance/weather cells: **deterministic precompute** where possible; AI fills gaps and writes `oneLiner` / `bestFor` / `watchOuts`.

**Vote integration:**

- Vote counts appear in the comparison table (deterministic, not AI-guessed)
- Summary may reference leading option **only when** vote data is in context
- If nobody voted yet, overview emphasizes factual tradeoffs; omit “group prefers…”

**Generation triggers:**

| Trigger | Behavior |
|---------|----------|
| Open comparison view (first time) | Auto-generate if no cache or stale |
| Option added/removed/edited | Mark overview stale; banner “Options changed — refresh overview” |
| User clicks **Regenerate** | Force new AI call |
| Vote cast | Update vote column only (no full regen); optional one-line summary tweak in v2 |

**API:**

```
POST /api/trips/:tripId/decisions/:id/comparison-overview
  → { overview: DecisionComparisonOverview, provider, model }

GET  /api/trips/:tripId/decisions/:id
  → includes comparisonOverview if cached
```

**Prompt input (structured context only):**

- Decision set title + slot
- Per option: compact event (name, type, times, cost, address, notes, status, likes/dislikes user ids + counts)
- Trip anchor: nearby confirmed stay that night, weather snapshot for slot date
- Explicit instruction: return JSON matching schema; no facts outside context

**Parsing:** Reuse assistant briefing patterns (`extractJsonObject`, enum normalization, deterministic fallback builder).

**softRecommendation rules:**

- Must reference a valid `eventId` from the set
- Must include ≥1 caveat when confidence is not `high` or when `missingInfo` non-empty
- UI label: **“Suggested pick”** not “Winner” — confirm still manual

---

#### Decision set UI

**Comparison view** (primary surface):

- **Top:** AI comparison overview panel (collapsible after first read)
- **Below:** Header: decision title, date/slot, “3 options · 2 of 4 voted”
- Row or card per option: thumbnail, name, time, cost, location, like/dislike controls, vote tallies
- Sort: likes desc → fewest dislikes → soonest event time (user override)
- Actions on each row: Edit, Remove from set, Open in maps
- Link from overview dimension cell → scroll to option row

**Timeline integration:**

- Exploring events in an open set show a **“In decision: Saturday dinner”** chip
- Collapsed group on timeline: one row “3 dinner options (2 likes leading)” expandable to options
- Map: exploring = green; options in same set could share a **violet ring** or badge number

**Proactive / trip health:**

- New health dimension or sub-issue: **“Open group decisions”**
- `N decisions waiting for a pick` with link to comparison view
- Resolution options below

---

#### Closing a decision (resolution options)

When the group is ready to commit:

| Resolution | Effect |
|------------|--------|
| **Confirm winner** | Chosen event → `status: 'confirmed'`; remove from set as decided winner |
| **Archive other options** | Losers → `status: 'alternative'` (keep on trip, hidden from default timeline) or delete |
| **Keep exploring** | Set → `deferred`; no status change on options |
| **Add another option** | Explore scoped to slot, or manual add → append to `optionEventIds` |
| **Split the difference** | Confirm two non-conflicting options (e.g. lunch **and** dinner — rare; split set) |
| **No decision needed** | Dissolve set; leave events as independent exploring items |

**Confirm winner flow:**

1. Editor (or owner-only — TBD) picks **Confirm this one**
2. Prompt: “What should happen to the other options?”
   - Archive as alternatives (default)
   - Delete others
   - Keep as exploring (decision dissolved, all stay candidates)
3. Set `status: 'decided'`, store `winnerEventId`, log activity

**Tie-breaking:**

- Show “It’s a tie” when top like counts equal
- Options: revote, owner breaks tie, random (fun), extend deadline

---

#### Permissions

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| Vote | ✓ | ✓ | — |
| Create / edit set | ✓ | ✓ | — |
| Confirm winner | ✓ | ✓ (or owner-only) | — |
| Delete others | ✓ | ✓ | — |

---

#### Flows

**Explore → alternatives**

1. User runs Explore for “Saturday dinner” keywords  
2. Selects 3 suggestions  
3. Checkbox: **“Add as alternatives in one decision”** (default on when 2+ selected)  
4. Creates decision set + 3 exploring events with votes at zero  

**Retrofit existing trip**

1. Trip health: “4 exploring events on Sat Jun 14 — group for voting?”  
2. User confirms → auto-set or manual pick which events belong together  

**Chat-free async planning**

- Collaborators vote over days  
- Optional: notify when “everyone has voted” or “new option added” (notification system)  
- Activity log: `decision_created`, `event_like`, `decision_closed`, `winner_confirmed`

---

#### Data & API (sketch)

```
GET    /api/trips/:tripId/decisions
POST   /api/trips/:tripId/decisions          { title, slot, optionEventIds }
PATCH  /api/trips/:tripId/decisions/:id      { title, slot, add/remove options, status }
POST   /api/trips/:tripId/decisions/:id/confirm { winnerEventId, loserAction: 'archive' | 'delete' | 'keep_exploring' }
POST   /api/trips/:tripId/decisions/:id/comparison-overview   → generate or refresh AI overview

POST   /api/trips/:tripId/events/:eventId/vote   (existing)
DELETE /api/trips/:tripId/events/:eventId/vote   (existing)
```

Decision sets can live as embedded array on `Trip` (like events) for v1.

---

#### Phased implementation

| Phase | Scope |
|-------|--------|
| **v0** | Re-wire like/dislike on exploring event cards in NewTripDetails (API already exists) |
| **v1** | Manual decision sets + comparison view + confirm winner / archive losers |
| **v1.5** | AI comparison overview (structured table + per-option summaries + deterministic fallback) |
| **v2** | Auto-suggest sets from heuristics; trip health “open decisions”; timeline grouping |
| **v3** | Notifications, tie-break UX, ranked voting if needed |

---

#### Open questions

- Use `alternative` status for **archived losers** vs a separate `archivedAt` / soft-hide flag?
- Should **one event** belong to **at most one** open decision set?
- Confirm winner: **owner-only** or any editor?
- Show dislikes prominently or only likes (avoid pile-on negativity)?
- Count **exploring events not in any set** toward trip health separately from open decisions?
- Regenerate AI overview **automatically** on every vote, or only on option edits?
- Include **softRecommendation** in v1.5 or wait until groups ask for it?
- Cache overview on **decision set document** vs generate stateless each open?

---

### 10. Budget-aware planning

Connect expenses to itinerary planning:

- Rough spend by category (lodging, transport, activities) from events + logged expenses
- Trip budget target vs projected total
- “You’re over on activities — swap or cut?” with links to exploring events

---

## Medium effort, high delight

| Idea | Why it helps planning |
|------|------------------------|
| **Template trips** | “7 days Costa Rica family” → editable starter itinerary |
| **Pace slider** | Relaxed / moderate / packed → AI packs empty days accordingly |
| **Constraint wizard** | Must-dos, avoid flying, max drive time → filters suggestions |
| **Calendar heatmap** | Visual density per day; drag to rebalance |
| **Region map planning** | Drop “want to visit” pins; auto-cluster into days |
| **Booking link stash** | Save URLs/screenshots → parse when ready |
| **Compare stays** | Side-by-side two hotel options before confirming one |
| **Weather-informed scheduling** | “Rain likely Thu → consider moving hike to Wed” (weather snapshots exist) |

---

## Suggested build order

Prioritized for impact vs reuse of existing code:

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 1 | **Trip health v1** (empty days + lodging + transport + dismissals) | Single planning hub; detectors feed one issue list with resolution options |
| 2 | **Scoped Explore from health** | “Suggest activities for this day” as primary empty-day resolution |
| 3 | **Re-wire Ask My Trip** | Low cost; flexible planning Q&A over same structured context |
| 4 | **Import inbox** | Natural resolution path for “already booked, not added yet” |
| 5 | **Dream → draft itinerary** | Differentiator; closes inspiration loop |
| 6 | **Collaborative decisions v0–v1.5** | Vote UI + decision sets + structured AI comparison overview |
| 7 | **Smart prep checklist v2** | Extends existing `prepSuggestions` |
| 8 | **Budget-aware planning** | Needs expense + event cost fields wired together |

---

## Possible UI homes

Without adding more top-level clutter:

1. **Planning panel** (new trip menu item) — trip health score, grouped issues, resolution actions, Ask My Trip, prep checklist suggestions
2. **Proactive sidebar** — phase `before`: “Trip health” card with top unresolved issue + link to panel
3. **Timeline annotations** — chips on empty days, lodging gaps, tight transfers; open same issue + resolution menu as health panel
4. **Merge with insights** — extend `tripInsights.ts` types or add `tripHealth.ts` that produces issues with `resolutionOptions[]`; avoid duplicate overlap/location rules

---

## Open questions

- Should **trip health** be a single score or separate tracks (logistics vs content vs group readiness)? *Proposal: show both sub-scores; logistics includes lodging + transport + locations + booking refs.*
- Which **dismiss reasons** are permanent vs re-open when data changes (e.g. rest day vs “planning deferred”)?
- Should **transport “connection is fine”** require a minimum stated gap or always trust user override?
- Should **empty-day AI** default to activities, destinations, or both when opened from health?
- How much **dream trip** promotion is manual vs AI-generated?
- Should **Ask My Trip** share context with Today briefing or stay planning-only?
- Store dismissals on **trip document** vs **localStorage** for collaborator visibility?

---

## References

- [Proactive Travel Assistant Plan](./proactive-travel-assistant-plan.md) — phases, architecture, lifecycle
- `src/services/tripInsights.ts` — current insight rules (candidate to merge or extend for health issues)
- `src/services/prepSuggestions.ts` — checklist suggestion rules
- `src/components/TripDetails/ExploreSuggestionsModal.tsx` — AI activity generation (scoped by date for empty-day resolution)
- `src/components/TripDetails/InTripAssistant.tsx` — transfer timing logic (reuse for transport gap detection)
- `src/components/TripDetails/TripCommandCenter.tsx` — Ask My Trip + AI briefing (not currently mounted)
- `server/index.js` — `POST/DELETE .../events/:eventId/vote` (exploring events only)
- `src/components/_deprecated/OldTripDetails.tsx` — reference voting UI to port
- `src/components/TripMap.tsx` — `alternative` status marker styling
- `server/services/assistantBriefing.js` — briefing, `answerTripQuestion`, JSON parse/normalize patterns for comparison overview
