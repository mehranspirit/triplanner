# Trip View Modes — Standard vs Immersive Map

Companion docs: [Planning Tools Ideas](./planning-tools-ideas.md), [Proactive Travel Assistant Plan](./proactive-travel-assistant-plan.md), [Trip Health & Collaborative Decisions Plan](./trip-health-and-decisions-plan.md), [Trip Details Design Overhaul](./trip-details-design-overhaul.md).

This doc defines a **single toggle** between the current trip details experience and an **immersive map-first view**. The standard view is unchanged. Map view reuses the same trip data, panels, and modals.

---

## North star

> **Standard view** stays the planning home users already know. **Map view** is a full-viewport map with a unified sheet for the itinerary and every trip tool — one tap away, nothing removed.

---

## Scope (locked)

| In scope | Out of scope (v1) |
|----------|-------------------|
| `/trips/:id` — `NewTripDetails` only | `/trips/:tripId/activity-log` |
| One toggle: **Standard** ↔ **Map** | Dream trips (`/trips/dream/:id`) |
| All current panels reachable in map view | Trip list page changes |
| Per-trip toggle persistence (`localStorage`) | Cross-device preference sync |
| **Standard view: zero code changes** | Phase switcher (Plan / Travel / Wrap-up) |
| Expenses via existing **`/trips/:id/expenses`** route (Tools menu link) | In-trip `money` panel / route removal |

---

## Product decisions (locked)

| Decision | Choice |
|----------|--------|
| **Views** | Two only: **Standard** (current) and **Map** (immersive map-first) |
| **Toggle** | One control — segmented `Standard \| Map` in toolbar; floater chip in map view to return |
| **Standard view** | **No changes** — hero, toolbar, timeline, sidebar, existing panel sheets |
| **Map view chrome** | No app header, no hero, no toolbar — floaters only (trip chip, toggle, map controls) |
| **Auto-enter map on travel** | **No** — optional **one-time suggest** on first day of trip; user choice persisted |
| **Mobile panels** | **Unified sheet** — panel content **replaces** sheet body (not a second sheet stack) |
| **Desktop map view** | Map ~60% left + **right rail** shows timeline or active panel content |
| **Panel `map`** | Focuses / fits root map (no duplicate map panel) |
| **Expenses (v1)** | Tools menu → navigate to **`/trips/:tripId/expenses`** (unchanged route) |
| **Geocode fallback** | If &lt;2 geocoded events: **allow map view** + persistent banner + link to review locations |
| **Map tiles** | **MapTiler** via Leaflet; OSM fallback if key missing or tile errors |
| **Time (v1)** | Device local timezone for “today” map filter |
| **Permissions** | `canEdit` gates edit CTAs; viewers get map view + read-only panels |
| **Persistence** | `tripMapView:${tripId}` boolean (+ optional global default); sheet snap not persisted |

---

## The two views

### Standard (default)

Exactly what exists today:

- App header + trip hero + toolbar + timeline + proactive sidebar (desktop)
- Menu → `TripPanelHost` sheets (`today`, `notifications`, `planning`, `checklist`, `notes`, `map`)
- Add event, AI import, modals — unchanged

The only addition in standard view is the **view toggle** (e.g. toolbar segment or map icon) so users can discover map view.

### Map (immersive map-first)

| Layer | Content |
|-------|---------|
| **L0 — Map canvas** | Full-viewport `TripMap` (MapTiler), pin tap → preview card |
| **L1 — Unified sheet / rail** | Timeline (default) **or** any panel body when opened |
| **L2 — Floaters** | Trip name chip, Standard/Map toggle, map filter (Today / All trip), Tools button |
| **L3 — Tools menu** | Full menu parity with current toolbar dropdown (see below) |
| **L4 — Modals** | Event form, import, decisions, location confirm — **unchanged**, always on top |

**Rule:** Opening an **L4 modal** collapses the sheet to **peek** so map context remains visible underneath.

---

## Unified sheet (mobile) — Idea B

One bottom sheet, three snap heights. **One body at a time.**

| Snap | Height | Body |
|------|--------|------|
| **Peek** | ~88px | Now / next summary (compact `TodayView`) or trip hint |
| **Half** | ~50vh | Panel content (Today, notifications, checklist…) **or** timeline scroll |
| **Full** | ~88vh | Full timeline or dense panels (planning, notes) |

### Sheet content modes

```ts
type MapSheetContent =
  | { type: 'timeline' }
  | { type: 'panel'; panel: TripPanel; options?: TripPanelOptions };
```

- **Default:** `{ type: 'timeline' }`
- **User opens Today from Tools:** swap body to `InTripAssistant` content at **half** snap
- **User closes panel / taps timeline in Tools:** restore timeline body
- **No second `TripSheet` dialog** for panels in map view on mobile

### Panel → default snap

| Panel | Snap | Notes |
|-------|------|-------|
| `today` | Half | `InTripAssistant` |
| `notifications` | Half | |
| `checklist` | Half | |
| `planning` | Full | Health + decisions need space |
| `notes` | Full | Editor |
| `map` | — | Focus root map; sheet → peek |

Refactor path: extract **panel content components** from `TripPanelHost` (already mostly separate); map view hosts content inside `MapBottomSheet`, standard view keeps existing `TripSheet` wrapper until a later unify pass.

---

## Desktop map view

| Region | Role |
|--------|------|
| **Left ~60%** | Root map, filters, pin preview |
| **Right ~40%** | **Rail:** timeline default; swaps to panel content when opened (same components as mobile sheet body) |

No bottom sheet drag on desktop. Toggle and Tools remain as floaters over the map or in a slim top bar on the rail.

---

## Tools menu (map view)

Replaces the toolbar dropdown in map view. Must expose **everything** the current menu offers:

| Section | Items |
|---------|--------|
| **Travel day** | Today, Notifications |
| **Plan** | Planning, Checklist, Notes, Import inbox |
| **Explore** | AI suggestions, Review locations, Map (focus root) |
| **Money** | **Expenses and settlements** → `/trips/:tripId/expenses` |
| **Add** | Add event, Import booking (editors only) |

Non-panel actions (import modal, explore modal, review locations, add event) open **L4 modals** as today.

Condensed timeline toggle lives in Tools (map view only affects timeline body when shown).

---

## Toggle UX

| Pattern | Location |
|---------|----------|
| **Segmented control** | Standard toolbar: `Standard \| Map` |
| **Floater** | Map view: chip “Standard view” or icon |
| **Persistence** | `tripMapView:${tripId}` in `localStorage` |
| **URL (optional)** | `?view=map` for share/deep link |
| **First-travel suggest** | Once per trip, if auto-detected “on trip” and user never chose map: soft prompt “Try map view?” — **does not switch** until confirmed; key `tripMapView:suggest:${tripId}` |

---

## Map tiles — MapTiler

Replace default OSM in `TripMap.tsx` when map view is active (or globally — standard map panel benefits too).

```bash
# .env
VITE_MAPTILER_API_KEY=your_key_here
```

| Context | Style | Map ID |
|---------|-------|--------|
| Default | Streets | `streets-v2` |
| Optional v1.1 | Outdoor when trip is in progress | `outdoor-v2` |

No user-facing phase switcher required — optional subtle style swap from `getTripBounds()` is fine.

```ts
// src/config/mapTiles.ts
export function getMapTilerTileUrl(style: 'streets' | 'outdoor', apiKey: string) {
  const mapId = style === 'outdoor' ? 'outdoor-v2' : 'streets-v2';
  return `https://api.maptiler.com/maps/${mapId}/{z}/{x}/{y}.png?key=${apiKey}`;
}
```

**Fallback:** missing key or `tileerror` → OSM for session. Keep MapTiler attribution visible in map view corner.

**Leaflet note:** Only pass `subdomains` prop for OSM URLs, not MapTiler.

---

## Layer stack

```
L0  Map canvas (map view only)
L1  Unified sheet (mobile) / right rail (desktop)
L2  Floaters: chip, toggle, map filter, Tools
L3  Tools menu sheet (full-screen menu list)
L4  Modals (event form, import, decisions, …)
L5  Toasts
```

| Event | Behavior |
|-------|----------|
| Open panel from Tools | Swap L1 body; set snap per panel table |
| Open L4 modal | L1 → peek |
| Close panel | L1 → timeline body |
| Toggle to Standard | Unmount map shell; restore current `NewTripDetails` layout |

---

## Architecture (target)

```
App.tsx
  └─ AuthenticatedLayout (hide header when map view active)

NewTripDetails
  ├─ useMapView(tripId) → boolean + setMapView
  ├─ if (!mapView) → existing JSX unchanged
  └─ if (mapView) → MapTripView
        ├─ TripMap (root, MapTiler)
        ├─ MapBottomSheet (mobile) / MapSideRail (desktop)
        │     └─ MapSheetBody → timeline | PanelContent*
        ├─ MapFloaters (chip, toggle, filter, Tools)
        ├─ ToolsMenuSheet
        └─ (L4 modals remain siblings on NewTripDetails — shared)
```

### New modules (planned)

| Module | Path |
|--------|------|
| Hook | `src/components/TripDetails/hooks/useMapView.ts` |
| Preferences | `src/utils/mapViewPreferences.ts` |
| Map shell | `src/components/TripDetails/map/MapTripView.tsx` |
| Bottom sheet | `src/components/TripDetails/map/MapBottomSheet.tsx` |
| Side rail | `src/components/TripDetails/map/MapSideRail.tsx` |
| Sheet body router | `src/components/TripDetails/map/MapSheetBody.tsx` |
| Panel contents | Extract from `TripPanelHost` → `panels/*Content.tsx` |
| Floaters | `src/components/TripDetails/map/MapFloaters.tsx` |
| Tools menu | `src/components/TripDetails/map/ToolsMenuSheet.tsx` |
| Pin preview | `src/components/TripDetails/map/EventMapPreview.tsx` |
| Today peek | `src/components/TripDetails/map/TodayPeek.tsx` |
| Tiles config | `src/config/mapTiles.ts` |
| Chrome context | `src/context/MapViewChromeContext.tsx` (hide app header) |

Standard-view files (`TripDetailsHero`, `TripTimeline`, etc.) are **not modified** except adding the toggle control to `TripDetailsToolbar`.

---

## Geocode & empty states

| State | Behavior |
|-------|----------|
| &lt;2 geocoded events | **Allow map view** — show banner on map (“Add locations…”) + link to review locations; pins may be sparse |
| No events | Map view allowed; peek “No stops yet”; Tools still works |
| Map tiles fail | OSM fallback; static message if both fail |
| Loading | Map skeleton + peek skeleton |

---

## Travel suggest (not auto-enter)

On first visit while trip is in progress (`getTripBounds` includes today):

1. If `tripMapView:${tripId}` unset and `tripMapView:suggest:${tripId}` unset
2. Show dismissible prompt: “Try map view for a full-screen map of your trip?”
3. **Switch** only if user confirms
4. Set suggest key either way; never auto-toggle on subsequent visits

---

## Implementation phases

### Phase IMV-1: Toggle + map shell

| ID | Task |
|----|------|
| IMV-1.1 | `useMapView` + `mapViewPreferences.ts` (`tripMapView:${tripId}`) |
| IMV-1.2 | `MapViewChromeContext` — hide app header in map view |
| IMV-1.3 | `MapTripView` — full-viewport `TripMap`, no sheet yet |
| IMV-1.4 | Toggle in `TripDetailsToolbar` only; standard layout untouched |
| IMV-1.5 | Floater chip to return to Standard |

**Acceptance:** Toggle on/off; standard view pixel-identical aside from toggle; header hides in map view.

---

### Phase IMV-2: Sheet + timeline

| ID | Task |
|----|------|
| IMV-2.1 | `MapBottomSheet` — peek / half / full |
| IMV-2.2 | Timeline as default sheet body (reuse `TripTimeline`) |
| IMV-2.3 | `MapSideRail` desktop 60/40 split |
| IMV-2.4 | `TodayPeek` in peek snap |
| IMV-2.5 | Map filter: Today / All trip |
| IMV-2.6 | Pin tap → `EventMapPreview` |
| IMV-2.7 | `mapTiles.ts` + MapTiler in `TripMap` |

**Acceptance:** Map + itinerary usable mobile and desktop; MapTiler renders with fallback.

---

### Phase IMV-3: Panels in unified sheet

| ID | Task |
|----|------|
| IMV-3.1 | Extract panel content components from `TripPanelHost` |
| IMV-3.2 | `MapSheetBody` — timeline vs panel router |
| IMV-3.3 | Wire all panels: `today`, `notifications`, `planning`, `checklist`, `notes` |
| IMV-3.4 | `map` panel action → focus root map |
| IMV-3.5 | `ToolsMenuSheet` — full menu parity including `/expenses` link |
| IMV-3.6 | L4 modal open → sheet peek |
| IMV-3.7 | First-travel suggest prompt |

**Acceptance:** Every toolbar menu item works in map view; no duplicate panel dialogs on mobile.

---

### Phase IMV-4: Polish

| ID | Task |
|----|------|
| IMV-4.1 | Geocode gate or banner |
| IMV-4.2 | Tile error fallback chain |
| IMV-4.3 | `prefers-reduced-motion` on sheet |
| IMV-4.4 | Optional outdoor tile style when trip in progress |
| IMV-4.5 | `?view=map` deep link |
| IMV-4.6 | a11y: sheet labels, focus on panel open |

---

## Visual polish backlog (unchanged direction)

Parallel UX improvements — not blocked on map view.

| ID | Task |
|----|------|
| VP-1 | Shared trip surface tokens |
| VP-2 | Event-type color map (timeline, map pins) |
| VP-10 | Toasts replace inline success banners |
| VP-11 | Timeline “now” marker |

Expenses visual polish stays on **`ExpensesPage`** until a future in-trip money panel initiative.

---

## Future (explicitly deferred)

| Item | Notes |
|------|-------|
| Plan / Travel / Wrap-up phase switcher | Replaced by single map toggle for v1 |
| In-trip `money` panel | Keep `/expenses` route for now |
| Auto map view on travel day | Suggest only |
| Cross-device view prefs | MongoDB profile later |
| Phase-aware docks, chrome matrix | Superseded by this doc |
| Activity log view modes | Out of scope |

---

## Success metrics

| Metric | Target |
|--------|--------|
| Map view adoption | % trip sessions toggled to map at least once |
| Return to standard | Users can switch back without confusion |
| Tool parity | Zero support tickets for “can’t find X in map view” |
| Planning regression | No change to events added / decisions in standard view |

---

## Related files

| File | Role |
|------|------|
| `NewTripDetails.tsx` | Branch: standard (unchanged) vs `MapTripView` |
| `TripDetailsToolbar.tsx` | Add Standard \| Map toggle |
| `TripPanelHost.tsx` | Standard view only (v1); source for panel content extraction |
| `TripMap.tsx` | Root map + MapTiler |
| `TripTimeline.tsx` | Sheet/rail body |
| `ExpensesPage.tsx` | Unchanged; linked from Tools menu |
| `App.tsx` | Map view chrome context for header |
| `tripStatus.ts` | `getTripBounds()` for travel suggest + optional tile style |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-27 | Initial doc (multi-axis Plan / Travel / Wrap-up × layout × chrome) |
| 2026-05-27 | MapTiler, TVM phases, full state matrix |
| 2026-05-28 | **Simplified:** single Standard ↔ Map toggle; unified mobile sheet; standard view frozen; expenses stay on `/expenses`; no auto-enter map |
