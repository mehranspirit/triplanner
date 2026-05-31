# Trip Details Design Overhaul — Depth & Layout

Companion docs: [Trip View Modes Plan](./trip-view-modes-plan.md), [Planning Tools Ideas](./planning-tools-ideas.md), [Proactive Travel Assistant Plan](./proactive-travel-assistant-plan.md).

This doc defines a **four-phase visual and layout polish** for the Standard trip details screen (`NewTripDetails`). It complements the completed **Map view** work (IMV-1 … IMV-4) and the visual polish backlog items **VP-1**, **VP-11** in the trip view modes plan.

**Design research:** Patterns were benchmarked via [Mobbin](https://mobbin.com) against Mindtrip, Kayak Trips, Tripadvisor Trips, Wanderlog, Transit, and Navan (May 2026).

---

## North star

> **Standard view** feels like a calm **trip command center** — scannable itinerary, clear hierarchy, subtle depth. **Map view** remains the **travel-day** surface; Standard view optimizes for planning and overview.

### Recommended product lane

| Surface | Primary lane | Reference apps |
|---------|--------------|----------------|
| **Standard view** | Trip command center — hero, collaboration, day navigation, rich timeline | Tripadvisor, Navan, Kayak |
| **Map view** | Travel day first — map + sheet, now/next context | Transit, Uber, Wanderlog (already implemented) |

---

## Scope

| In scope | Out of scope |
|----------|--------------|
| `/trips/:id` — Standard layout in `NewTripDetails` | Dream trips |
| Elevation tokens, timeline, toolbar, hero, sidebar | Activity log page |
| Optional desktop split (timeline + mini-map) | Full 3-column AI chat (Mindtrip-style) |
| Calendar tab (P2) | Replacing `/trips/:id/expenses` |
| Map view polish only where it shares tokens | Cross-app design system beyond trip surfaces |

**Relationship to Map view:** Map view is **not redesigned** in this initiative except where shared tokens (shadows, chips, row density) apply to both surfaces.

---

## Elevation model (VP-1)

All phases share one hierarchy. Avoid ad-hoc shadows per component.

| Tier | Role | Examples | Tailwind direction |
|------|------|----------|------------------|
| **L0** | Canvas | Page background | Gradient `from-slate-100 via-slate-50/80 to-slate-100` |
| **L1** | Content | Event cards, sidebar sections | `shadow-sm shadow-slate-900/5`, hover `shadow-md` |
| **L2** | Floating chrome | Toolbar, sticky day headers, day strip | `shadow-lg shadow-slate-900/8`, `backdrop-blur-md` |
| **L3** | Overlays | Panels, dropdowns, map preview | Existing modal/sheet stack (unchanged) |

**Colored shadows:** Primary CTAs only (e.g. `shadow-blue-600/20` on Add Event).

**File (planned):** `src/styles/tripSurfaces.ts` or Tailwind `@layer` utilities — `trip-surface`, `trip-shadow-rest`, `trip-shadow-float`.

---

## Mobbin benchmarks (summary)

| Pattern | Who does it well | Triplanner today | Target phase |
|---------|------------------|------------------|--------------|
| Split itinerary + map | Kayak, Tripadvisor | Map only in Map view | P1 |
| Horizontal day pills | Tripadvisor | Scroll-only timeline | P1 |
| Row-based itinerary rows | Mindtrip, Kayak | Condensed mode (partial) | P0 |
| Day collapse + distance labels | Mindtrip, Wanderlog | Day headers only | P1 |
| Progress meters | Tripadvisor | Health banner (scattered) | P0 |
| Itinerary / Calendar / Bookings tabs | Mindtrip, Kayak | Single timeline | P2 |
| Hero → compact workspace | Navan, Tripadvisor | Static hero | P3 |
| Map + bottom sheet “now” | Transit, Uber | Map view (done) | — |

---

## Phase overview

| Phase | Name | Effort | User-visible outcome |
|-------|------|--------|----------------------|
| **P0** | Surface & scan | Small | Cards and days feel layered; timeline easier to scan |
| **P1** | Navigate the trip | Medium | Jump by day; optional map beside timeline on desktop |
| **P2** | Multiple lenses | Medium–large | Calendar view; booking status on transport/stay |
| **P3** | Command center | Medium | Collapsing hero; “Relevant now” dock; toolbar progress |

Phases are **sequential** but each is shippable independently.

---

## Phase P0 — Surface & scan

**Goal:** Maximum visual improvement with minimal layout change. Implements **VP-1** (shared tokens) and sets up **VP-11** (timeline “now” marker).

### Tasks

| ID | Task | Files (primary) |
|----|------|-----------------|
| P0-1 | Add `tripSurfaces` elevation tokens | `src/styles/tripSurfaces.ts` |
| P0-2 | Page canvas gradient (L0) | `NewTripDetails.tsx` |
| P0-3 | Event card depth + hover lift | `EventCardShell.tsx`, condensed card |
| P0-4 | Day header float (L2) + “today” glow | `TripTimeline.tsx` |
| P0-5 | Timeline spine dot emphasis; active-day dot | `TripTimeline.tsx` |
| P0-6 | Proactive sidebar elevation aligned with L1/L2 | `ProactiveTripContext.tsx` |
| P0-7 | Toolbar segment inset shadow (Standard \| Map) | `TripDetailsToolbar.tsx` |
| P0-8 | **Progress chip** in toolbar: locations on map (e.g. `8/12`) | `TripDetailsToolbar.tsx`, `NewTripDetails.tsx` |
| P0-9 | Map view: apply same tokens to floaters where shared | `MapTripView.tsx`, `EventMapPreview.tsx` |

### Compact row mode (P0 stretch)

| ID | Task | Notes |
|----|------|-------|
| P0-10 | Default **compact rows on mobile**, rich cards on `lg+` | Mindtrip-style row: thumb + title + time + actions |
| P0-11 | Row actions: Details · Map focus · Directions (icon buttons) | Reuse map deep link / `getGoogleMapsSearchUrl` |

### Acceptance

- [x] One shadow language across hero stats, toolbar, cards, day headers, sidebar
- [x] Timeline reads as primary content; hero does not overpower scroll area
- [x] Sticky day headers sit clearly above cards while scrolling
- [x] Toolbar shows location progress when &lt;100% geocoded
- [x] No regression to Map view toggle or panel flows

---

## Phase P1 — Navigate the trip

**Goal:** Help users **move through long itineraries** and see **place + plan** together on desktop.

### Tasks

| ID | Task | Files (primary) |
|----|------|-----------------|
| P1-1 | **Day strip** under toolbar — pills for each trip day + “Today” | New `TripDayStrip.tsx`, `NewTripDetails.tsx` |
| P1-2 | Day filter: active pill filters timeline events | `TripTimeline.tsx` |
| P1-3 | Tap pill → filter by day; **All days** shows full itinerary | `TripDayStrip.tsx`, `TripTimeline.tsx` |
| P1-4 | **Desktop split toggle**: Timeline \| Timeline + mini-map | `NewTripDetails.tsx`, embed `TripMap` (non-immersive) |
| P1-5 | List ↔ map selection sync (click event → highlight pin; pin → scroll) | `TripMap.tsx`, timeline refs |
| P1-6 | Optional **distance / leg time** between consecutive stops | `TripTimeline.tsx`, routing util or heuristic |
| P1-7 | Persist split preference `tripSplitMap:${tripId}` | `mapViewPreferences.ts` or sibling |

### UX notes

- Day strip hidden when trip has no dated events (show “Unscheduled” single state).
- Split view is **desktop only** (`lg+`); mobile keeps Map view toggle for full map.
- Mini-map uses same bookend-flight and pin-fit rules as Map view.

### Acceptance

- [x] User can jump to any day in ≤2 taps
- [x] Active day pill updates while scrolling
- [x] Desktop split: selecting an event focuses map pin; map tap scrolls timeline
- [x] Split preference survives reload

---

## Phase P2 — Multiple lenses

**Goal:** Add **Calendar** and **booking status** without duplicating Map view or panels.

### Tasks

| ID | Task | Files (primary) |
|----|------|-----------------|
| P2-1 | **Tab bar** under toolbar: Itinerary \| Calendar \| Bookings | New `TripDetailsTabs.tsx` |
| P2-2 | **Calendar tab** — week/day grid of events (Mindtrip-inspired) | New `TripCalendarView.tsx` |
| P2-3 | Calendar ↔ timeline selection sync | Shared event selection state |
| P2-4 | **Bookings tab** — filter to flight/stay/rental with confirmation chips | New `TripBookingsView.tsx` |
| P2-5 | Status chips on cards: Confirmed · Exploring · Booked · Needs location | Event cards + row mode |
| P2-6 | Tab persistence `tripDetailsTab:${tripId}` | preferences util |

### Out of scope for P2

- Full booking management (PNR edits, rebooking) — display and deep-link to event edit only.
- Calendar drag-and-drop reschedule (defer to planning-tools backlog).

### Acceptance

- [x] Three tabs work on mobile and desktop; default remains Itinerary
- [x] Calendar shows all dated events; empty days visible in week view
- [x] Bookings tab lists transport + stay with clear status
- [x] Map view and Tools menu unchanged

---

## Phase P3 — Command center

**Goal:** Standard view feels like a **trip HQ** — compact chrome, proactive dock, collaboration forward.

### Tasks

| ID | Task | Files (primary) |
|----|------|-----------------|
| P3-1 | **Collapsing hero** — full hero → compact bar on scroll | `TripDetailsHero.tsx`, scroll hook |
| P3-2 | Compact bar: name, dates, status, collaborators, Map toggle | New `TripCompactHeader.tsx` |
| P3-3 | **Relevant now** dock redesign — phase label, cards, quick actions | `ProactiveTripContext.tsx` |
| P3-4 | Quick actions row: Add · Import · Map · Expenses | Dock + toolbar dedupe review |
| P3-5 | During active trip: pin Today briefing + next event at top of dock | `InTripAssistant` surfacing |
| P3-6 | Hero stat rail: expenses, health score, open issues (horizontal) | `TripDetailsHero.tsx` |
| P3-7 | Invite / share prominence (Tripadvisor pattern) | Hero or compact bar |

### Acceptance

- [ ] After ~120px scroll, hero compresses; toolbar + day strip remain usable
- [ ] Proactive dock surfaces ≤5 cards + quick actions without crowding timeline
- [ ] Active-trip users see next event within one glance of dock
- [ ] Collaboration entry point visible without opening Menu

---

## Architecture (Standard view)

```
NewTripDetails
├── TripDetailsHero (P3: collapse)
├── TripCompactHeader (P3, sticky when collapsed)
├── TripDetailsToolbar (+ progress chip P0, tabs P2)
├── TripDayStrip (P1)
├── [ Split layout P1 ]
│   ├── main: TripDetailsTabs body
│   │   ├── TripTimeline (default)
│   │   ├── TripCalendarView (P2)
│   │   └── TripBookingsView (P2)
│   └── aside: ProactiveTripContext (P3 dock)
│   └── optional: TripMap mini (P1)
└── TripPanelHost (unchanged)
```

Map view branch remains separate (`MapTripView`); shares tokens from P0.

---

## Success metrics

| Metric | Target |
|--------|--------|
| Time to find a specific day | ↓ with day strip (qualitative / session replay) |
| Map view adoption | Unchanged or ↑ (split map does not cannibalize Map view) |
| Location review completion | ↑ via toolbar progress chip |
| Support / confusion | No increase in “can’t find X” after tab addition |

---

## Dependencies & risks

| Risk | Mitigation |
|------|------------|
| Split map + Map view redundancy | Split is desktop-only, optional, off by default |
| Calendar tab scope creep | Read-only grid in P2; drag reschedule later |
| Hero collapse jank | `prefers-reduced-motion` → instant compact, no animation |
| Shadow overload | Strict L0–L3 token use; no shadow on inline chips |

---

## Related backlog (not in this doc)

| ID | Source | Notes |
|----|--------|-------|
| VP-2 | trip-view-modes-plan | Event-type color map (timeline + pins) |
| VP-10 | trip-view-modes-plan | Toasts replace inline success banners |
| VP-11 | trip-view-modes-plan | Timeline “now” marker — start in P0 |
| Expenses polish | — | Stays on `ExpensesPage` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-29 | Initial four-phase plan (P0–P3) from Mobbin research and elevation hierarchy |
| 2026-05-29 | **P0 shipped** — `tripSurfaces` tokens, canvas gradient, card/day/toolbar polish, location progress chip, compact mobile rows |
| 2026-05-29 | **P1 shipped** — day strip, scroll-spy, desktop split map with list↔map sync |
| 2026-05-29 | **P2 shipped** — Itinerary/Calendar/Bookings tabs, status chips, tab persistence |
