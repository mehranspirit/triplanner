# Trip Health & Collaborative Decisions — Implementation Plan

Companion docs: [Planning Tools Ideas](./planning-tools-ideas.md), [Proactive Travel Assistant Plan](./proactive-travel-assistant-plan.md).

## Product decisions (locked for this plan)

| Decision | Choice |
|----------|--------|
| **Primary UI** | New **Planning** trip panel **and** proactive sidebar card (phase `before`) |
| **Dismissals** | Stored on **trip document** in MongoDB (collaborators share state) |
| **Health v1 scope** | **Full dimensions** — schedule, lodging, transport, location, booking refs, exploring/decisions (integrated with decision sets) |
| **Confirm winner** | Any **editor** (same as create/vote permissions) |

## North star

One **Planning** surface that answers: *What’s wrong with this trip?* and *What can we do about it?* — with deterministic detection, explicit resolution paths, and group decisions for exploring options.

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│  NewTripDetails                                                  │
│  ├─ TripDetailsToolbar → open Planning panel                     │
│  ├─ ProactiveTripContext → "Trip health" card (phase before)    │
│  ├─ TripTimeline → issue chips → Planning panel (deep link)     │
│  └─ PlanningPanel / DecisionComparisonView                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
  tripHealth.ts      tripHealthDismissals   decisionSets (Trip)
  (client compute)   (Trip.healthDismissals) (Trip.decisions[])
         │                  │                  │
         └──────────────────┴──────────────────┘
                            │
              resolutionDispatcher.ts
              (maps action → existing handlers)
                            │
    Explore modal / add event / edit event / location queue /
    import dialog / decision comparison / dismiss API
```

### Shared types (`src/types/tripHealthTypes.ts`)

- `TripHealthIssue`, `ResolutionOption`, `ResolutionAction`
- `TripHealthSummary` — headline score + `logisticsScore` + `contentScore`
- `HealthDismissal` — `{ issueKey, reason, note?, dismissedAt, dismissedBy }`
- `DecisionSet`, `DecisionComparisonOverview` — per planning-tools-ideas.md

### Client vs server

| Concern | v1 approach |
|---------|-------------|
| Issue detection | **Client-side** `computeTripHealth()` — fast, offline-friendly, matches `tripInsights` today |
| Dismissals | **Server** — `PATCH /api/trips/:id/health-dismissals` or embedded on trip save |
| Decision sets | **Server** — embedded `decisions[]` on Trip document |
| Comparison overview | **Server** — `POST .../decisions/:id/comparison-overview` (AI) |
| Votes | **Existing** — `POST/DELETE .../events/:eventId/vote` |

### Relationship to `tripInsights.ts`

- **Phase TH-2:** Port existing insight generators into `tripHealth.ts` as issue producers with `resolutionOptions[]`.
- **Phase TH-3:** Deprecate duplicate surfaces — Planning panel replaces scattered insight cards for planning phase; Today panel keeps in-trip insights only.
- Insight IDs map to stable `issueKey` for dismissals (e.g. `missing-location-{eventId}`).

---

## Phase TH-0: Foundations

**Goal:** Types, panel shell, dismissal persistence, resolution dispatcher stub.

### Tasks

| ID | Task | Owner notes |
|----|------|-------------|
| TH-0.1 | Add `src/types/tripHealthTypes.ts` and `src/types/decisionTypes.ts` | Export from types index if applicable |
| TH-0.2 | Add `healthDismissals[]` to Trip schema (`server/models/Trip.js`) + TypeScript `Trip` type | Fields: `issueKey`, `reason`, `note?`, `dismissedAt`, `dismissedBy` |
| TH-0.3 | API: `GET/PATCH /api/trips/:tripId/health-dismissals` | Auth: owner/editor write; merge dismissals; validate `reason` enum |
| TH-0.4 | Add `'planning'` to `TripPanel` in `useTripPanelManager.ts` | Toolbar + mobile FAB + `TripPanelHost` |
| TH-0.5 | Create `PlanningPanel.tsx` shell — score placeholder, empty issue list, loading state | Wire `openPanel('planning')` from toolbar |
| TH-0.6 | Create `resolutionDispatcher.ts` — `executeResolution(action, payload, context)` | Context: trip, handlers from NewTripDetails |
| TH-0.7 | Create `tripHealth.ts` skeleton — `computeTripHealth(input) → { summary, issues }` | Input: trip, dismissals, decisions, now |
| TH-0.8 | Unit tests for dismissal filtering — dismissed issue hidden until data changes | Test issueKey regeneration when dates/events change |

### Acceptance

- Planning panel opens from trip menu; shows “No issues” or loading.
- Dismissal saves to trip and survives refresh; visible to collaborators.

---

## Phase TH-1: Trip health detectors

**Goal:** All v1 issue types detected client-side.

### TH-1A — Schedule coverage (empty days)

| ID | Task |
|----|------|
| TH-1A.1 | `detectEmptyDays(trip, events)` — days in trip bounds with no events |
| TH-1A.2 | Variant: only exploring events, no confirmed anchor → under-planned day |
| TH-1A.3 | Issue template: `empty_day:{date}`, severity info, resolution options per ideas doc |
| TH-1A.4 | Dismiss reasons: `intentional_rest_day`, `planning_deferred` (+ optional `reopenBeforeTripDays`) |

### TH-1B — Lodging gaps

| ID | Task |
|----|------|
| TH-1B.1 | `detectLodgingGaps` — iterate nights; check stay check-in/out coverage |
| TH-1B.2 | Detect gap between consecutive stays (orphan night) |
| TH-1B.3 | Issue `lodging_gap:{startDate}:{endDate}` with related stay/event ids when inferrable |
| TH-1B.4 | Resolutions: add stay (pre-filled), extend adjacent stay, dismiss (`day_trip`, `alternate_lodging`, `overnight_transport`) |
| TH-1B.5 | Treat spanning flight/train as night coverage when arrival/departure times cross midnight (rule doc + test) |

### TH-1C — Transport gaps

| ID | Task |
|----|------|
| TH-1C.1 | Extract `getTransferSummary` / travel estimate from `InTripAssistant.tsx` → `src/utils/transferAnalysis.ts` |
| TH-1C.2 | `detectTransportGaps` — for each flight/train/bus arrival, find next event; classify missing / tight / ok |
| TH-1C.3 | Thresholds config: intl tight ≤90m, domestic ≤45m (constants file) |
| TH-1C.4 | Issue types: `transport_gap:missing`, `transport_gap:tight` with related event ids |
| TH-1C.5 | Resolutions: add rental/train/bus (pre-fill), buffer note event, edit next event, dismiss (`connection_ok`, `ad_hoc_ground_transport`) |

### TH-1D — Migrate existing insights

| ID | Task |
|----|------|
| TH-1D.1 | Port location issues from `eventHasLocationAttention` → `location:{eventId}` with Review location / Google search resolutions |
| TH-1D.2 | Port booking ref missing → `booking_ref:{eventId}` |
| TH-1D.3 | Port time overlap / conflict insights if present in `tripInsights.ts` |
| TH-1D.4 | Port exploring-count / unstructured exploring → split into `exploring_event:{id}` and `open_decision:{decisionId}` (after CD-1) |
| TH-1D.5 | Map legacy dismissed insight localStorage keys → migration banner (one-time) |

### TH-1E — Scoring

| ID | Task |
|----|------|
| TH-1E.1 | `logisticsScore` — weighted open issues: critical=10, warning=5, info=2; max 100 |
| TH-1E.2 | `contentScore` — schedule + exploring/decision issues |
| TH-1E.3 | Headline score — average or min of sub-scores (document choice in code comment) |

### Acceptance

- `computeTripHealth` returns issues for a fixture trip covering each type.
- Dismissals filter correctly; changing event data re-opens issue (new `issueKey` or hash of underlying fields).

---

## Phase TH-2: Planning panel UI & resolutions

**Goal:** Full Planning panel with working resolution paths.

### Tasks

| ID | Task |
|----|------|
| TH-2.1 | `TripHealthSummaryCard` — dual sub-scores + progress ring |
| TH-2.2 | `TripHealthIssueList` — group by dimension; sort severity then date |
| TH-2.3 | `TripHealthIssueRow` — title, reason, primary CTA, “More options” dropdown |
| TH-2.4 | Wire `executeResolution` actions: | |
| | `create_event` → open add modal with prefill (type, dates, transport seed) | |
| | `edit_event` → `handleEditEventClick` | |
| | `ai_suggest` → scoped Explore (TH-3) | |
| | `review_location` → `locationConfirmQueue.startUnresolvedReview([event])` | |
| | `open_import` → Travel import dialog | |
| | `open_decision` → Decision comparison view | |
| | `dismiss` → PATCH health-dismissals | |
| TH-2.5 | `PlanningPanel` sections: Health → Open decisions (link CD) → optional Ask My Trip slot (future) |
| TH-2.6 | Deep link: `openPanel('planning', { issueId })` scroll/highlight issue |

### Acceptance

- User can resolve empty day via dismiss (rest day) and see score update.
- User can jump from lodging gap → add stay with dates pre-filled.
- User can jump from transport gap → add rental with pickup time seeded.

---

## Phase TH-3: Scoped Explore & timeline chips

**Goal:** Empty-day resolution via AI; surface issues on timeline.

### Tasks

| ID | Task |
|----|------|
| TH-3.1 | Extend `ExploreSuggestionsModal` — props: `scopedDate?`, `locationBias?`, `defaultKeywords?` |
| TH-3.2 | Server: optional date hint in `generateAISuggestions` prompt (if not already) |
| TH-3.3 | `TripTimeline` — chips on days with open health issues (empty day, lodging, transport) |
| TH-3.4 | Chip click → open Planning panel with issue focused (or inline popover with primary + more options) |
| TH-3.5 | Proactive sidebar — `Trip health` card: top issue + score + “Open planning” |

### Acceptance

- “Suggest activities for this day” opens Explore scoped to that date/area.
- Timeline shows chip on empty day; click resolves or opens planning.

---

## Phase CD-0: Vote UI (quick win)

**Goal:** Restore voting before full decision sets.

| ID | Task |
|----|------|
| CD-0.1 | Port vote handlers from `OldTripDetails.tsx` → `useEventVotes.ts` hook |
| CD-0.2 | `EventVoteControls` component — like/dislike, counts, voter avatars (tooltip) |
| CD-0.3 | Add to exploring **activity**, **destination**, **stay** cards (desktop menu + mobile) |
| CD-0.4 | Optimistic update + `api.voteEvent` / remove vote; offline queue via existing sync |
| CD-0.5 | Activity log already server-side — verify entries appear |

### Acceptance

- Collaborators can vote on exploring events from NewTripDetails; counts persist.

---

## Phase CD-1: Decision sets (data + API)

**Goal:** Persist decision groups on trip.

| ID | Task |
|----|------|
| CD-1.1 | Add `decisions[]` to Trip schema — `DecisionSet` shape + `comparisonOverview` subdoc |
| CD-1.2 | Routes: `GET/POST /api/trips/:tripId/decisions` | |
| CD-1.3 | `PATCH /api/trips/:tripId/decisions/:decisionId` — title, slot, add/remove options, defer | |
| CD-1.4 | `POST .../decisions/:decisionId/confirm` — winnerEventId, loserAction enum | |
| CD-1.5 | Confirm flow: winner → `confirmed`; losers → `alternative` (default) or delete | |
| CD-1.6 | Validate: option ids exist, exploring status, user access | |
| CD-1.7 | Activity log: `decision_created`, `decision_closed`, `winner_confirmed` | |
| CD-1.8 | Client types + `api.ts` methods | |

### Acceptance

- Create decision with 2+ option event ids via API; confirm winner; losers archived as `alternative`.

---

## Phase CD-2: Decision comparison UI

**Goal:** Manual create/compare/close decisions.

| ID | Task |
|----|------|
| CD-2.1 | `DecisionComparisonView.tsx` — modal or Planning sub-route | |
| CD-2.2 | Create flow: multi-select exploring events → “Compare as alternatives” → title/slot form | |
| CD-2.3 | Explore add flow: checkbox “Add as alternatives in one decision” when 2+ selected | |
| CD-2.4 | Option rows: card + `EventVoteControls` + edit/remove from set | |
| CD-2.5 | Confirm winner dialog — loser action radio (archive / delete / keep exploring) | |
| CD-2.6 | Tie detection UI — equal like counts → revote prompt / owner note (editors can still confirm) | |
| CD-2.7 | Timeline chip: “In decision: {title}” on member events | |
| CD-2.8 | Map: show `alternative` events (violet) toggle or hide by default | |

### Acceptance

- End-to-end: Explore 3 dinners → decision set → vote → confirm one → others archived.

---

## Phase CD-3: AI comparison overview

**Goal:** Structured AI overview in comparison view.

| ID | Task |
|----|------|
| CD-3.1 | `server/services/decisionComparison.js` — build context, prompt, parse JSON | |
| CD-3.2 | Reuse `assistantBriefing.js` helpers — `extractJsonObject`, enum normalize | |
| CD-3.3 | Deterministic fallback builder — facts table + vote column only | |
| CD-3.4 | Precompute distance (haversine) from anchor stay; weather cell from snapshots | |
| CD-3.5 | `POST .../comparison-overview` — cache on decision set; set `stale: false` | |
| CD-3.6 | Mark stale on PATCH decision options; vote updates table client-side without regen | |
| CD-3.7 | `ComparisonOverviewPanel.tsx` — summary, table, tradeoffs, per-option cards, suggested pick | |
| CD-3.8 | Collapse overview after first view (local preference) | |

### Acceptance

- Opening comparison generates overview; table matches event data; regenerate works; AI off → deterministic fallback.

---

## Phase CD-4: Health ↔ decisions integration

**Goal:** Full-dimension health includes decisions (per product decision).

| ID | Task |
|----|------|
| CD-4.1 | `detectOpenDecisions` — `status: 'open'` decision sets → issue `open_decision:{id}` | |
| CD-4.2 | `detectOrphanExploring` — exploring events not in any open set (optional warning) | |
| CD-4.3 | Health resolutions: “Open comparison”, “Confirm winner”, “Add option”, “Defer decision” | |
| CD-4.4 | Auto-suggest decision grouping (v2): heuristic same-day exploring → health suggestion “Group for vote?” | |
| CD-4.5 | Timeline collapsed group (v2): single row for 3 options | |

### Acceptance

- Planning panel shows open decision as health issue; click opens comparison.

---

## Phase TH/CD-5: Polish & release

| ID | Task |
|----|------|
| P-1 | Loading/error states for AI overview and health recompute | |
| P-2 | Empty states: 100% health celebration (subtle) | |
| P-3 | Permissions: viewers see Planning read-only (issues + votes, no dismiss/confirm) | |
| P-4 | Export: optionally hide `alternative` events from HTML itinerary | |
| P-5 | Docs: update planning-tools-ideas open questions with resolved decisions | |
| P-6 | Manual test script / QA checklist (below) | |

---

## Suggested implementation order

Work can proceed in parallel after TH-0:

```
TH-0 ─┬─ TH-1 ── TH-2 ── TH-3
      │
      └─ CD-0 ── CD-1 ── CD-2 ── CD-3 ── CD-4
                                      │
                                      └── TH/CD-5
```

**Critical path for “full dimensions” release:** TH-0 → TH-1 → CD-0 → CD-1 → CD-2 → CD-4 → TH-2 → TH-3 → CD-3 → P-*

CD-3 (AI overview) can ship immediately after CD-2; not blocking health UI.

---

## QA checklist (manual)

### Trip health

- [ ] Empty day detected; rest-day dismiss persists for collaborators; score updates
- [ ] Lodging gap between stays; add stay prefill; extend stay opens edit
- [ ] Transport tight connection after intl flight; dismiss connection_ok
- [ ] Location issue → Review location flow
- [ ] Booking ref issue → edit event
- [ ] Timeline chip → planning deep link

### Decisions

- [ ] Vote on exploring card; counts for 2 collaborators
- [ ] Create decision from 3 Explore suggestions
- [ ] Comparison view sort by likes
- [ ] AI overview generates; stale banner after edit option
- [ ] Confirm winner; losers `alternative`; timeline hides archived by default
- [ ] Open decision appears in trip health

---

## Open questions (non-blocking / v2)

- **Deferred planning dismiss** — re-open N days before trip: default 7 or 14?
- **Dislikes in UI** — show prominently or hide behind “details”?
- **One event per open decision set** — enforce at API level? (recommended: yes)
- **Notifications** when vote added / decision closed — defer to v3
- **Ranked-choice voting** — defer until like/dislike proves insufficient

---

## File map (expected new/changed)

| Path | Purpose |
|------|---------|
| `src/types/tripHealthTypes.ts` | Health issue + resolution types |
| `src/types/decisionTypes.ts` | Decision set + overview types |
| `src/services/tripHealth.ts` | Detectors + score |
| `src/services/resolutionDispatcher.ts` | Action router |
| `src/utils/transferAnalysis.ts` | Shared transfer math |
| `src/components/TripDetails/planning/PlanningPanel.tsx` | Main panel |
| `src/components/TripDetails/planning/TripHealth*.tsx` | Summary + issue list |
| `src/components/TripDetails/decisions/*` | Comparison view + overview |
| `src/components/TripDetails/EventVoteControls.tsx` | Vote UI |
| `src/hooks/useEventVotes.ts` | Vote mutations |
| `server/routes/decisions.js` | Decision CRUD + overview |
| `server/services/decisionComparison.js` | AI overview |
| `server/models/Trip.js` | `healthDismissals`, `decisions` |

---

## References

- [Planning Tools Ideas](./planning-tools-ideas.md)
- `src/services/tripInsights.ts` — migration source
- `src/components/TripDetails/InTripAssistant.tsx` — transfer logic source
- `src/components/_deprecated/OldTripDetails.tsx` — vote UI reference
- `server/index.js` — vote endpoints
