import * as React from 'react';
import { Event } from '../types/eventTypes';

interface EventContextType {
  events: Event[];
  addEvent: (event: Event) => void;
  updateEvent: (eventId: string, event: Event) => void;
  deleteEvent: (eventId: string) => void;
}

const EventContext = React.createContext<EventContextType | undefined>(undefined);

interface EventProviderProps {
  children: React.ReactNode;
  initialEvents?: Event[];
}

export const EventProvider: React.FC<EventProviderProps> = ({ children, initialEvents = [] }) => {
  const [events, setEvents] = React.useState<Event[]>(initialEvents);

  const addEvent = (event: Event) => {
    setEvents(prev => [...prev, event]);
  };

  const updateEvent = (eventId: string, event: Event) => {
    setEvents(prev => prev.map(e => e.id === eventId ? event : e));
  };

  const deleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  return (
    <EventContext.Provider value={{ events, addEvent, updateEvent, deleteEvent }}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => {
  const context = React.useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}; 