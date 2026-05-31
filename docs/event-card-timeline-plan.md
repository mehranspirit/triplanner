# Event Card & Timeline Visual Hierarchy Plan

Phased plan for redesigning timeline event cards: **glanceable condensed cards**, a **read-only detail sheet**, and the **existing edit form** — plus a unified, tiered action system.

Mobbin-style references: Wanderlog / TripIt (timeline rows), Airbnb Trips (lodging blocks), Google Travel (chip metadata), Apple Wallet (transport passes), Citymapper (A→B route cards).

---

## North star

> Scan the day in seconds. Tap for context and actions. Edit only when intentional.

### Target interaction model

```
Timeline (condensed card)
    ↓ tap
Detail sheet (read-only + actions)
    ↓ Edit
Edit form modal (existing EventFormModalRouter)
```

### Target action tiers

| Tier | Surface | Examples |
|------|---------|----------|
| **Urgent badge** | Timeline card only | Needs location, tight connection |
| **Primary** | Detail sheet | Directions, Open in Maps, Add to calendar, Share |
| **Status** | Detail sheet | Mark confirmed / Move to exploring + votes |
| **Secondary** | Detail sheet overflow | Type-specific (track flight, copy booking ref) |
| **Destructive** | Detail sheet overflow | Delete |
| **Edit** | Detail sheet footer | Opens edit form |

Timeline cards should **not** host maps, edit, status toggle, calendar, or share. Those live on the detail sheet.

---

## Current state (problems)

| Area | Today | Issue |
|------|-------|-------|
| **Hierarchy** | Toolbar toggles condensed ↔ full cards | Two timeline modes, no read-only middle layer |
| **Card tap / Info** | Opens edit form directly | Skips detail; mislabeled affordance |
| **Full cards** | Label-heavy rows (`Start:`, `Location:`) | Hard to scan; ~600 lines duplicated per type |
| **Exploring state** | Dashed borders, dot grid, desaturated photo | Visually loud in a list |
| **Actions (full)** | Vertical `w-10` icon popover, hover-only on desktop | Undiscoverable; duplicated in Flight/Stay/Bus/etc. |
| **Actions (condensed)** | Vertical Info / Maps / Review stack | Inconsistent with full cards |
| **Status toggle** | Buried in ⋮ with calendar & share | Should be a primary sheet action |
| **Multiday** | Separate `MultidaySpanChip` / `MultidayEndpointCard` | Different visual language from other cards |

### Key files today

- `src/components/TripDetails/timeline/TripTimeline.tsx` — condensed vs full routing
- `src/components/TripDetails/EventCards/*` — per-type full cards
- `src/components/TripDetails/EventCards/EventCardActions.tsx` — shared ⋮ popover (Activity only)
- `src/components/TripDetails/NewTripDetails.tsx` — `handleEditEventClick` → `EventFormModalRouter`

---

## Design principles (locked)

1. **Time-first** — time on the timeline rail or a dedicated column; not repeated as labeled rows inside the card body.
2. **Title + chips** — glance row is title + 2–4 chips (status, cost, weather, booked); no `Label: value` rows in condensed view.
3. **Type accent** — 4px left color bar + small icon; retire shouting `ACTIVITY` / `FLIGHT` text badges on thumbnails.
4. **Quiet exploring** — amber left bar + muted title + small pill; no dashed double-border / dot grid.
5. **Progressive disclosure** — notes, description, contact, booking details in detail sheet; not on timeline.
6. **One action system** — `buildEventActions()` registry; no per-card popover duplication.
7. **Mobile-first** — condensed is the timeline default everywhere; detail sheet on tap.

### Type accent colors (proposed)

| Type | Accent |
|------|--------|
| Activity | Indigo |
| Flight | Sky |
| Stay | Amber |
| Rental | Orange |
| Train / Bus | Slate |
| Destination | Emerald |

### Condensed card glance layout (target)

```
▌ [thumb]  Tabacon Hot Springs
▌          9:00–11:00 · La Fortuna
▌          Confirmed · $85 · ☀ 82°              ›
```

Optional timeline footer (from existing data): `↳ 22 min drive to lunch`

---

## Architecture (target)

```
EventCardShell (shared layout)
├── TypeAccentBar
├── MediaSlot          — thumb | route strip | stay block
├── GlanceHeader       — title + EventStatusChip + chips
├── ContextLine        — optional drive / flight status / health
└── ChevronHint

EventDetailSheet
├── EventDetailHeader
├── QuickActionGrid    — primary labeled buttons
├── DetailBody         — type-specific read-only fields
├── VoteStatusBlock    — exploring events
├── ContextBlocks      — weather, flight status, transfer leg
└── FooterBar          — Edit | overflow ⋯

buildEventActions(event, handlers) → EventAction[]
EventActionMenu          — labeled overflow (sheet)
EventTypeLayouts         — route / stay / default glance slots
```

---

## Phased implementation

### Phase EC-0 — Interaction model & foundations

**Goal:** Establish condensed → sheet → edit navigation before visual polish.

| ID | Task | Notes |
|----|------|-------|
| EC-0.1 | Add `EventDetailSheet` component (shell) | Half-sheet on mobile; side panel or centered dialog on desktop. Props: `event`, `open`, `onClose`, handlers. |
| EC-0.2 | Add `buildEventActions()` + `EventAction` types | Registry in `src/utils/eventActions.ts` or `EventCards/eventActions.ts`. Standard actions for all types; type-specific via `EVENT_TYPES` extension hook. |
| EC-0.3 | Wire condensed card tap → sheet (not edit) | `CondensedEventCard` / timeline: `onOpenDetail(event)`. Remove Info → edit shortcut. |
| EC-0.4 | Wire sheet **Edit** footer → `handleEditEventClick` | Explicit edit only from sheet footer. |
| EC-0.5 | Wire sheet **Delete** → existing delete flow | Confirm dialog; close sheet on success. |
| EC-0.6 | Wire sheet **status toggle** → `onStatusChange` | Prominent button for exploring → confirmed. |
| EC-0.7 | State in `NewTripDetails` | `detailEventId: string \| null` alongside existing edit modal state. |

**Exit criteria:** Tap condensed card opens sheet; Edit opens form; no regression to multiday chips opening edit directly (may still do until EC-4).

---

### Phase EC-1 — Condensed card visual refresh

**Goal:** Make the timeline default card glanceable.

| ID | Task | Notes |
|----|------|-------|
| EC-1.1 | Extract `EventGlanceCard` from `CondensedEventCard` | Shared shell: accent bar, thumb, title, meta row, chevron. |
| EC-1.2 | Chip metadata row | Reuse/extend `EventStatusChip`. Add optional chips: cost, weather (day), booked ref indicator, vote summary. |
| EC-1.3 | Time display as range | `9:00–11:00` not separate Start/End rows. Helper per event type. |
| EC-1.4 | Softer exploring treatment | Remove dashed borders / dot grid from condensed path. Amber accent + pill only. |
| EC-1.5 | Remove condensed right-rail action buttons | Maps / Info / Review → sheet only. Exception: urgent location badge (icon on card, tap → sheet scrolled to location). |
| EC-1.6 | Make condensed the default timeline mode | Invert or remove `isCondensedView` toggle default to `true`; consider renaming toggle to “Compact / Comfortable” later. |

**Exit criteria:** Timeline readable at a glance; no action icons on condensed cards except urgent badges.

---

### Phase EC-2 — Detail sheet actions & content ✅

**Goal:** Single home for all event actions.

| ID | Task | Notes |
|----|------|-------|
| EC-2.1 | `QuickActionGrid` in sheet | 2×2 labeled buttons: Directions, Maps, Calendar, Share. Use `buildEventActions()` filter `tier: primary`. |
| EC-2.2 | `EventActionOverflow` menu | Labeled ⋯ menu: edit, status, type-specific, delete (separated). Replace icon-only vertical popover pattern. |
| EC-2.3 | `VoteStatusBlock` for exploring events | Votes + **Mark confirmed** primary CTA. |
| EC-2.4 | Read-only detail body | Notes, description, contact, booking ref, type fields — migrated from full card bodies. |
| EC-2.5 | Type-specific sheet sections | Flight: terminals/gates/status. Stay: check-in/out, nights. Rental: pickup/drop-off. |
| EC-2.6 | Context blocks | Surface existing data: `TimelineLegConnector` summary (drive to next), weather snapshot, flight status. |

**Exit criteria:** All actions reachable from sheet; full cards no longer needed for actions or deep reading.

**Implemented:** `EventDetailBody`, `EventDetailContextBlocks`, `eventDetailContent.ts` helpers; context wired from `NewTripDetails` (weather, flight status, outbound transfer leg).

---

### Phase EC-3 — Type-specific glance layouts ✅

**Goal:** Transport and stays read correctly in one glance — in condensed card and sheet header.

| ID | Task | Notes |
|----|------|-------|
| EC-3.1 | `TransportRouteGlance` | A→B strip for flight, train, bus, rental (pickup→drop-off). Times under endpoints. |
| EC-3.2 | `StayBlockGlance` | Lodging name, night count, check-in→check-out line. |
| EC-3.3 | `ActivityDestinationGlance` | Default title + location + time range (current condensed shape, refined). |
| EC-3.4 | Integrate into `EventGlanceCard` via type registry | Extend `EVENT_TYPES` or parallel `glanceComponent` map. |

**Exit criteria:** Flight card glance shows `SJO → LAX · 8:45 AM` not six labeled rows.

**Implemented:** `TransportRouteGlance`, `StayBlockGlance`, `ActivityDestinationGlance`, `eventGlanceLayouts.tsx` registry; helpers in `eventGlance.ts`.

---

### Phase EC-4 — Timeline & multiday integration ✅

**Goal:** Timeline structure supports scanning; multiday uses same visual language.

| ID | Task | Notes |
|----|------|-------|
| EC-4.1 | Time rail (optional column) | Time labels on spine left of cards; remove time from card body when rail present. |
| EC-4.2 | Context line under glance card | “22 min drive to next” from existing transfer leg data. |
| EC-4.3 | Unify multiday middle/end | `MultidaySpanChip` / `MultidayEndpointCard` → use `EventGlanceCard` variants; tap → sheet. |
| EC-4.4 | Multiday stay start | Stay block glance on check-in day. |
| EC-4.5 | Health / notification dots on card | Single dot or chip when event has open health issue or notification. |

**Exit criteria:** One card system for single-day, multiday middle, and multiday end.

**Implemented:** `EventTimelineRailTime`, `EventGlanceOutboundLine`, `MultidayMiddleGlance`, `MultidayEndGlance`, `EventGlanceAttentionChips`; condensed timeline always uses glance cards + time rail.

---

### Phase EC-5 — Legacy cleanup & desktop polish ✅

**Goal:** Remove duplicated full-card UI; optional desktop enhancements.

| ID | Task | Notes |
|----|------|-------|
| EC-5.1 | Stop rendering full `EventCardComponent` in timeline | Timeline always uses `EventGlanceCard` (+ multiday variants). |
| EC-5.2 | Delete or archive per-type full card bodies | Keep thin wrappers if needed for sheet detail sections; remove timeline-specific layout from Activity/Flight/Stay/etc. |
| EC-5.3 | Remove `EventCardActions` vertical popover | Superseded by sheet. |
| EC-5.4 | Remove duplicated desktop/mobile Popover blocks | Flight, Stay, Bus, Train, Rental, Destination, Arrival, Departure. |
| EC-5.5 | Remove `isCondensedView` toggle (or hide in settings) | Compact timeline is the only mode. |
| EC-5.6 | *(Optional)* Desktop hover strip | `Directions · Edit` fade on hover; sheet still opens on click. |
| EC-5.7 | *(Optional)* Mobile swipe actions | Swipe → Directions / Edit; max 2 targets. |

**Exit criteria:** No timeline full cards; no ⋮ popovers on cards; significant LOC reduction in `EventCards/`.

**Implemented:** Timeline always glance cards; removed 12 legacy card files (~200KB), `EventCardActions`, `MultidayTimelineCards`, `cardComponent` from registry, condensed toggle from toolbar and map tools menu.

---

## `buildEventActions()` sketch

```ts
type EventActionTier = 'primary' | 'status' | 'secondary' | 'destructive';
type EventActionSurface = 'sheet-primary' | 'sheet-overflow' | 'sheet-footer';

interface EventAction {
  id: string;
  label: string;
  icon: LucideIcon;
  tier: EventActionTier;
  surfaces: EventActionSurface[];
  visible?: (ctx: EventActionContext) => boolean;
  handler: () => void;
}
```

### Standard actions (all types)

| Action | Sheet primary | Overflow | Footer |
|--------|---------------|----------|--------|
| Get directions | ✓ | | |
| Open in Maps | ✓ | | |
| Add to calendar | ✓ | ✓ | |
| Share | ✓ | ✓ | |
| Mark confirmed / Move to exploring | status block | ✓ | |
| Edit | | ✓ | ✓ |
| Delete | | ✓ (destructive) | |

### Type-specific (examples)

| Type | Actions |
|------|---------|
| Flight | Track flight, Departure airport, Arrival airport |
| Stay | Copy confirmation, Open booking link |
| Rental | Pickup map, Drop-off map |
| Activity / Destination | Review location (when `needs_location`) |

---

## Detail sheet layout (target)

```
┌─────────────────────────────────────────┐
│ ─── drag handle ───                     │
│ ▌ [hero / route / stay block]           │
│ Title                                   │
│ Sat Jun 27 · 9:00–11:00 AM              │
│ La Fortuna · Confirmed                  │
├─────────────────────────────────────────┤
│ [Directions]  [Open in Maps]            │
│ [Add to Cal]  [Share]                   │
├─────────────────────────────────────────┤
│ ↳ 22 min drive to Airport drop-off      │
│ ☀ 82° · 20% rain                        │
├─────────────────────────────────────────┤
│ Notes, booking ref, votes…              │
├─────────────────────────────────────────┤
│ [ ✓ Mark as confirmed ]   (exploring)   │
├─────────────────────────────────────────┤
│ [Edit]                    [⋯ More]      │
└─────────────────────────────────────────┘
```

---

## Out of scope (this plan)

- Trip view modes / map-first layout ([separate doc](./trip-view-modes-plan.md))
- New event types or form field changes
- Drag-and-drop reorder on timeline
- Offline action queue changes
- AI-generated card content

---

## Dependencies

| Phase | Depends on |
|-------|------------|
| EC-0 | — |
| EC-1 | EC-0.3 (sheet navigation) |
| EC-2 | EC-0.1, EC-0.2 |
| EC-3 | EC-1.1 |
| EC-4 | EC-1, EC-3 |
| EC-5 | EC-2, EC-4 |

EC-0 and EC-1 can overlap partially. EC-5 should not start until sheet is feature-complete.

---

## Success metrics

- Timeline card height reduced ~40% vs current full card average
- All user-facing actions reachable in ≤2 taps from timeline (tap card → tap action)
- Zero hover-only actions on mobile
- Per-type card files reduced to detail-section helpers (not standalone timeline layouts)
- Edit form opened only via explicit Edit control, not card tap

---

## Suggested implementation order (sprints)

| Sprint | Phases | Deliverable |
|--------|--------|-------------|
| 1 | EC-0 | Sheet opens on tap; edit/delete/status wired |
| 2 | EC-1 + EC-2.1–2.3 | Glance cards + primary actions in sheet |
| 3 | EC-2.4–2.6 + EC-3 | Full sheet content + transport/stay glances |
| 4 | EC-4 | Time rail, multiday unification, context lines |
| 5 | EC-5 | Remove legacy full cards and popovers |

---

## Task checklist (copy for tracking)

```
EC-0  Interaction model & foundations
  [x] EC-0.1 EventDetailSheet shell
  [x] EC-0.2 buildEventActions registry
  [x] EC-0.3 Condensed tap → sheet
  [x] EC-0.4 Sheet Edit → form
  [x] EC-0.5 Sheet Delete
  [x] EC-0.6 Sheet status toggle
  [x] EC-0.7 NewTripDetails detailEventId state

EC-1  Condensed card visual refresh
  [x] EC-1.1 EventGlanceCard extraction
  [x] EC-1.2 Chip metadata row
  [x] EC-1.3 Time as range
  [x] EC-1.4 Softer exploring
  [x] EC-1.5 Remove condensed action rail
  [x] EC-1.6 Condensed default

EC-2  Detail sheet actions & content
  [ ] EC-2.1 QuickActionGrid
  [ ] EC-2.2 EventActionOverflow
  [ ] EC-2.3 VoteStatusBlock
  [ ] EC-2.4 Read-only detail body
  [ ] EC-2.5 Type-specific sheet sections
  [ ] EC-2.6 Context blocks

EC-3  Type-specific glance layouts
  [ ] EC-3.1 TransportRouteGlance
  [ ] EC-3.2 StayBlockGlance
  [ ] EC-3.3 ActivityDestinationGlance
  [ ] EC-3.4 Type registry integration

EC-4  Timeline & multiday integration
  [ ] EC-4.1 Time rail
  [ ] EC-4.2 Context line (drive to next)
  [ ] EC-4.3 Multiday middle/end unification
  [ ] EC-4.4 Multiday stay start
  [ ] EC-4.5 Health/notification indicators

EC-5  Legacy cleanup & desktop polish
  [x] EC-5.1 Stop rendering full cards in timeline
  [x] EC-5.2 Archive full card timeline layouts
  [x] EC-5.3 Remove EventCardActions popover
  [x] EC-5.4 Remove duplicated Popover blocks
  [x] EC-5.5 Remove condensed toggle
  [ ] EC-5.6 (Optional) Desktop hover strip
  [ ] EC-5.7 (Optional) Mobile swipe actions
```
