import React from 'react';
import { Event, EventType } from '@/types/eventTypes';
import ActivityDestinationGlance from '@/components/TripDetails/EventCards/glances/ActivityDestinationGlance';
import StayBlockGlance from '@/components/TripDetails/EventCards/glances/StayBlockGlance';
import MultidayEndGlance from '@/components/TripDetails/EventCards/glances/MultidayEndGlance';
import MultidayMiddleGlance from '@/components/TripDetails/EventCards/glances/MultidayMiddleGlance';
import TransportRouteGlance from '@/components/TripDetails/EventCards/glances/TransportRouteGlance';
import { EventGlanceContentProps } from '@/components/TripDetails/EventCards/glances/EventGlanceContentProps';

type EventGlanceLayoutComponent = React.FC<EventGlanceContentProps>;

const EVENT_GLANCE_LAYOUTS: Partial<Record<EventType, EventGlanceLayoutComponent>> = {
  flight: TransportRouteGlance,
  train: TransportRouteGlance,
  bus: TransportRouteGlance,
  rental_car: TransportRouteGlance,
  stay: StayBlockGlance,
  activity: ActivityDestinationGlance,
  destination: ActivityDestinationGlance,
  arrival: ActivityDestinationGlance,
  departure: ActivityDestinationGlance,
};

export const resolveEventGlanceLayout = (
  event: Event,
  multidayRole?: EventGlanceContentProps['multidayRole'],
): EventGlanceLayoutComponent => {
  if (multidayRole === 'middle') return MultidayMiddleGlance;
  if (multidayRole === 'end') return MultidayEndGlance;
  return EVENT_GLANCE_LAYOUTS[event.type] ?? ActivityDestinationGlance;
};

export const EventGlanceContent: React.FC<EventGlanceContentProps> = (props) => {
  const Layout = resolveEventGlanceLayout(props.event, props.multidayRole);
  return <Layout {...props} />;
};

export default EventGlanceContent;
