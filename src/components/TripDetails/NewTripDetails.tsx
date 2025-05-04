import React, { useState, useEffect } from 'react';
import { useTripDetails } from './hooks';
// import EventCard from './EventCard'; // Placeholder
import { Button } from '@/components/ui/button'; // Assuming Shadcn UI Button
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"; // Assuming Shadcn UI Card
import { Event, EventType } from '@/types/eventTypes'; // Import EventType
import { EVENT_TYPES } from '@/eventTypes/registry'; // Correct import name
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInView } from 'react-intersection-observer';
import { parse, format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Import icons
import { FaPlane, FaTrain, FaBus, FaCar, FaHotel, FaMapMarkerAlt, FaMountain } from 'react-icons/fa';

// Import the new specific modals
import ArrivalFormModal from './EventFormModals/ArrivalFormModal';
import StayFormModal from './EventFormModals/StayFormModal';
import RentalCarFormModal from './EventFormModals/RentalCarFormModal';
import FlightFormModal from './EventFormModals/FlightFormModal';
// TODO: Import modals for other event types (Activity, Bus, Train, Destination, Departure)
import ActivityFormModal from './EventFormModals/ActivityFormModal';
import BusFormModal from './EventFormModals/BusFormModal';
import TrainFormModal from './EventFormModals/TrainFormModal';
import DestinationFormModal from './EventFormModals/DestinationFormModal';
import DepartureFormModal from './EventFormModals/DepartureFormModal';

const EventIcon: React.FC<{ type: EventType }> = ({ type }) => {
  const { ref, inView, entry } = useInView({
    threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    trackVisibility: true,
    delay: 100,
    rootMargin: '-15% 0px -15% 0px', // Increased the center trigger area
  });

  const getIcon = () => {
    switch (type) {
      case 'flight':
        return <FaPlane className="w-8 h-8 text-blue-500 transform rotate-0" />;
      case 'arrival':
        return <FaPlane className="w-8 h-8 text-green-500 transform rotate-45" />;
      case 'departure':
        return <FaPlane className="w-8 h-8 text-red-500 transform -rotate-45" />;
      case 'train':
        return <FaTrain className="w-8 h-8 text-green-500" />;
      case 'bus':
        return <FaBus className="w-8 h-8 text-purple-500" />;
      case 'rental_car':
        return <FaCar className="w-8 h-8 text-red-500" />;
      case 'stay':
        return <FaHotel className="w-8 h-8 text-yellow-500" />;
      case 'destination':
        return <FaMapMarkerAlt className="w-8 h-8 text-pink-500" />;
      case 'activity':
        return <FaMountain className="w-8 h-8 text-indigo-500" />;
      default:
        return <FaMapMarkerAlt className="w-8 h-8 text-gray-500" />;
    }
  };

  // Calculate animation state based on intersection ratio and viewport position
  const getAnimationState = () => {
    if (!entry) return { opacity: 0, translateX: -48, scale: 0.75 };
    
    const viewportHeight = window.innerHeight;
    const elementTop = entry.boundingClientRect.top;
    const elementHeight = entry.boundingClientRect.height;
    const elementCenter = elementTop + (elementHeight / 2);
    const viewportCenter = viewportHeight / 2;
    const distanceFromCenter = Math.abs(elementCenter - viewportCenter);
    const maxDistance = viewportHeight * 0.4;
    
    // Calculate progress based on distance from center
    const centerProgress = Math.max(0, 1 - (distanceFromCenter / maxDistance));
    
    const isScrollingDown = entry.boundingClientRect.top < 0;
    
    if (isScrollingDown) {
      // Scrolling down: fade in, move right, then fade out
      if (centerProgress < 0.2) {
        // Initial fade in
        const fadeInProgress = centerProgress / 0.2;
        return { 
          opacity: fadeInProgress, 
          translateX: -48, 
          scale: 0.75 + (0.25 * fadeInProgress)
        };
      } else if (centerProgress < 0.8) {
        // Full opacity movement
        const moveProgress = (centerProgress - 0.2) / 0.6;
        return { 
          opacity: 1, 
          translateX: -48 + (48 * moveProgress), 
          scale: 1
        };
      } else {
        // Final fade out
        const fadeOutProgress = (centerProgress - 0.8) / 0.2;
        return { 
          opacity: 1 - fadeOutProgress, 
          translateX: 0, 
          scale: 1
        };
      }
    } else {
      // Scrolling up: reverse animation
      if (centerProgress > 0.8) {
        // Initial fade in
        const fadeInProgress = (centerProgress - 0.8) / 0.2;
        return { 
          opacity: fadeInProgress, 
          translateX: 0, 
          scale: 1
        };
      } else if (centerProgress > 0.2) {
        // Full opacity movement
        const moveProgress = (centerProgress - 0.2) / 0.6;
        return { 
          opacity: 1, 
          translateX: -48 * moveProgress, 
          scale: 1
        };
      } else {
        // Final fade out
        const fadeOutProgress = centerProgress / 0.2;
        return { 
          opacity: 1 - fadeOutProgress, 
          translateX: -48, 
          scale: 0.75 + (0.25 * fadeOutProgress)
        };
      }
    }
  };

  const animationState = getAnimationState();

  return (
    <div
      ref={ref}
      className="absolute -left-24 top-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center"
      style={{
        opacity: animationState.opacity,
        transform: `translateX(${animationState.translateX}px) scale(${animationState.scale})`,
        transition: 'all 0.3s ease-out',
      }}
    >
      <div className="relative">
        {getIcon()}
        {/* Glow effect */}
        <div 
          className="absolute inset-0 rounded-full bg-current opacity-20 blur-md"
          style={{ 
            opacity: animationState.opacity * 0.2,
            transition: 'opacity 0.3s ease-out'
          }}
        ></div>
      </div>
    </div>
  );
};

const NewTripDetails: React.FC = () => {
  const {
    trip,
    loading,
    error,
    tripThumbnail,
    eventThumbnails, // Get event thumbnails
    addEvent, // Function to add event
    updateEvent, // Function to update event
    deleteEvent, // Function to delete event
    handleExportHTML,
    canEdit,
    // isOwner, // If needed for more granular control
    // user, // If needed
  } = useTripDetails();

  const [modalType, setModalType] = useState<EventType | null>(null); // State to track which modal to show
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isCondensedView, setIsCondensedView] = useState(false);

  const handleAddEventClick = (type: EventType) => {
    setEditingEvent(null);
    setModalType(type);
  };

  const handleEditEventClick = (event: Event) => {
    setEditingEvent(event);
    setModalType(event.type); // Open the modal corresponding to the event type
    // setIsModalOpen(true); // No longer needed
  };

  const handleCloseModal = () => {
    setModalType(null); // Close by clearing the type
    setEditingEvent(null);
  };

  const handleSaveEvent = async (eventData: Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'> | Event) => {
    console.log('handleSaveEvent called with data:', eventData);
    try {
      if ('id' in eventData && editingEvent && eventData.id === editingEvent.id) {
        console.log('Updating existing event:', eventData.id);
        // We are editing an existing event
        const eventToUpdate = { ...editingEvent, ...eventData } as Event;
        console.log('Combined event data for update:', eventToUpdate);
        const updatedEvent = await updateEvent(eventToUpdate);
        console.log('Event updated, result:', updatedEvent);
        
        // Update the local state immediately
        if (trip && updatedEvent) {
          const updatedEvents = trip.events.map(event => 
            event.id === updatedEvent.id ? updatedEvent : event
          );
          trip.events = updatedEvents;
          console.log('Local state updated with event:', updatedEvent.id);
        }
      } else {
        console.log('Adding new event of type:', eventData.type);
        // We are adding a new event
        const newEvent = await addEvent(eventData as Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>);
        console.log('New event added, result:', newEvent);
        
        // Update the local state immediately
        if (trip && newEvent) {
          trip.events = [...trip.events, newEvent];
          console.log('Local state updated with new event:', newEvent.id);
        }
      }
      
      // Close the modal
      console.log('Closing modal after save');
      handleCloseModal();
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Failed to save event. Please try again.');
    }
  };
  
  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteEvent(eventId);
        // Update the local state immediately
        if (trip) {
          const updatedEvents = trip.events.filter(event => event.id !== eventId);
          trip.events = updatedEvents;
        }
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Failed to delete event. Please try again.');
      }
    } 
  };

  if (loading) return <div className="p-4">Loading trip details...</div>; // TODO: Add a proper spinner
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>; // TODO: Add a proper error component
  if (!trip) return <div className="p-4">Trip not found.</div>;

  // Sort events by startDate, earliest first
  const sortedEvents = [...trip.events].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  // Define which event types can be added from the dropdown
  // Adjust this array as needed
  const addableEventTypes: EventType[] = [
    'arrival', 'departure', 'stay', 'flight', 'train', 'bus', 'rental_car', 'activity', 'destination'
  ];

  // Update the CondensedEventCard component to include icons
  const CondensedEventCard: React.FC<{ event: Event; thumbnail: string }> = ({ event, thumbnail }) => {
    const registryItem = EVENT_TYPES[event.type];
    if (!registryItem) return null;

    const getEventIcon = () => {
      switch (event.type) {
        case 'flight':
          return <FaPlane className="w-4 h-4 text-blue-500" />;
        case 'arrival':
          return <FaPlane className="w-4 h-4 text-green-500 transform rotate-45" />;
        case 'departure':
          return <FaPlane className="w-4 h-4 text-red-500 transform -rotate-45" />;
        case 'train':
          return <FaTrain className="w-4 h-4 text-green-500" />;
        case 'bus':
          return <FaBus className="w-4 h-4 text-purple-500" />;
        case 'rental_car':
          return <FaCar className="w-4 h-4 text-red-500" />;
        case 'stay':
          return <FaHotel className="w-4 h-4 text-yellow-500" />;
        case 'destination':
          return <FaMapMarkerAlt className="w-4 h-4 text-pink-500" />;
        case 'activity':
          return <FaMountain className="w-4 h-4 text-indigo-500" />;
        default:
          return <FaMapMarkerAlt className="w-4 h-4 text-gray-500" />;
      }
    };

    return (
      <div className="flex items-center space-x-3 p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
        <div className="w-12 h-12 flex-shrink-0 relative">
          <img 
            src={thumbnail} 
            alt={event.type} 
            className="w-full h-full object-cover rounded-md"
          />
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
            {getEventIcon()}
          </div>
        </div>
        <div className="flex-grow min-w-0">
          <h3 className="text-sm font-medium truncate">
            {(() => {
              switch (event.type) {
                case 'activity':
                  return (event as any).title;
                case 'destination':
                  return (event as any).placeName;
                case 'stay':
                  return (event as any).accommodationName;
                case 'flight':
                  return `${(event as any).airline || 'Flight'} ${(event as any).flightNumber || ''}`;
                case 'train':
                  return `${(event as any).trainOperator || 'Train'} ${(event as any).trainNumber || ''}`;
                case 'bus':
                  return `${(event as any).busOperator || 'Bus'} ${(event as any).busNumber || ''}`;
                case 'rental_car':
                  return `${(event as any).carCompany || 'Rental Car'}`;
                case 'arrival':
                  return `Arrival at ${(event as any).airport}`;
                case 'departure':
                  return `Departure from ${(event as any).airport}`;
                default:
                  return event.type;
              }
            })()}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {format(new Date(event.startDate), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="relative p-0 h-48 md:h-64"> {/* Adjust height as needed */}
          {tripThumbnail && (
            <img
              src={tripThumbnail}
              alt={`${trip.name} cover`}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-4 md:p-6">
            <CardTitle className="text-2xl md:text-3xl font-bold text-white">{trip.name}</CardTitle>
            <CardDescription className="text-gray-200">{trip.description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-4">
          {/* Display other trip details like dates, collaborators etc. */} 
          {(() => {
            // Helper function to parse date string without timezone conversion
            const parseDateString = (dateStr: string) => {
              if (!dateStr) return null;
              const [year, month, day] = dateStr.split('-').map(Number);
              return new Date(year, month - 1, day);
            };

            // Calculate trip dates based on events
            const eventDates = sortedEvents.map(event => {
              let startDate = '';
              let endDate = '';
              
              switch (event.type) {
                case 'activity':
                case 'destination':
                  startDate = (event as any).startDate;
                  endDate = (event as any).endDate;
                  break;
                case 'arrival':
                case 'departure':
                  startDate = (event as any).date;
                  endDate = (event as any).date;
                  break;
                case 'stay':
                  startDate = (event as any).checkIn;
                  endDate = (event as any).checkOut;
                  break;
                case 'rental_car':
                  startDate = (event as any).date;
                  endDate = (event as any).dropoffDate;
                  break;
                case 'bus':
                  startDate = (event as any).departureDate || (event as any).date;
                  endDate = (event as any).arrivalDate || (event as any).date;
                  break;
                default:
                  startDate = (event as any).startDate || (event as any).date || '';
                  endDate = (event as any).endDate || (event as any).date || '';
              }
              
              return { startDate, endDate };
            });

            const validDates = eventDates.filter(d => d.startDate && d.endDate);
            if (validDates.length === 0) {
              const tripStartDate = parseDateString(trip.startDate);
              const tripEndDate = parseDateString(trip.endDate);
              return (
                <>
                  <p><strong>Start Date:</strong> {tripStartDate ? format(tripStartDate, 'MMMM do, yyyy') : 'N/A'}</p>
                  <p><strong>End Date:</strong> {tripEndDate ? format(tripEndDate, 'MMMM do, yyyy') : 'N/A'}</p>
                </>
              );
            }

            const earliestStartDate = validDates.reduce((earliest, current) => {
              const currentDate = parseDateString(current.startDate);
              const earliestDate = parseDateString(earliest.startDate);
              return currentDate && earliestDate && currentDate < earliestDate ? current : earliest;
            }).startDate;

            const latestEndDate = validDates.reduce((latest, current) => {
              const currentDate = parseDateString(current.endDate);
              const latestDate = parseDateString(latest.endDate);
              return currentDate && latestDate && currentDate > latestDate ? current : latest;
            }).endDate;

            const startDate = parseDateString(earliestStartDate);
            const endDate = parseDateString(latestEndDate);

            return (
              <>
                <p><strong>Start Date:</strong> {startDate ? format(startDate, 'MMMM do, yyyy') : 'N/A'}</p>
                <p><strong>End Date:</strong> {endDate ? format(endDate, 'MMMM do, yyyy') : 'N/A'}</p>
              </>
            );
          })()}
          {/* TODO: Display Collaborators */} 
        </CardContent>
        <CardFooter className="flex justify-between p-4 md:p-6 bg-gray-50">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>Add Event</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Select Event Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {addableEventTypes.map((type) => {
                  const eventSpec = EVENT_TYPES[type];
                  return (
                    <DropdownMenuItem key={type} onClick={() => handleAddEventClick(type)}>
                      {eventSpec?.icon && <span className="mr-2">{eventSpec.icon}</span>}
                      {/* Capitalize first letter */} 
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" onClick={handleExportHTML}>Export to HTML</Button>
          {/* Add Export to PDF Button here if needed */}
        </CardFooter>
      </Card>

      <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl md:text-2xl font-semibold">Events</h2>
        <div className="flex items-center space-x-2">
          <Switch
            id="view-mode"
            checked={isCondensedView}
            onCheckedChange={setIsCondensedView}
          />
          <Label htmlFor="view-mode">Compact View</Label>
        </div>
      </div>
      
      {sortedEvents.length === 0 ? (
          <p className="text-gray-500">No events added yet.</p>
      ) : (
        <div className="relative">
          {/* Timeline line - only show in full view */}
          {!isCondensedView && (
          <div className="absolute left-32 top-0 bottom-0 w-0.5 bg-gray-200"></div>
          )}
          
          <div className={isCondensedView ? "space-y-1" : "space-y-8"}>
            {(() => {
              // Group events by date
              const groupedEvents = sortedEvents.reduce((groups, event) => {
                let dateKey = '';
                switch (event.type) {
                  case 'activity':
                    dateKey = (event as any).startDate;
                    break;
                  case 'arrival':
                  case 'departure':
                    dateKey = (event as any).date;
                    break;
                  case 'stay':
                    dateKey = (event as any).checkIn;
                    break;
                  case 'rental_car':
                    dateKey = (event as any).date;
                    break;
                  case 'bus':
                    dateKey = (event as any).departureDate || (event as any).date;
                    break;
                  default:
                    dateKey = (event as any).startDate || (event as any).date || '';
                }
                if (!groups[dateKey]) {
                  groups[dateKey] = [];
                }
                groups[dateKey].push(event);
                return groups;
              }, {} as Record<string, typeof sortedEvents>);

              return Object.entries(groupedEvents).map(([dateKey, events]) => (
                <div key={dateKey} className="relative">
                  {/* Date header - smaller in condensed view */}
                  <div className={isCondensedView ? "mb-1" : "sticky top-4 left-0 w-28 text-right pr-4 z-10"}>
                    <div className={cn(
                      "inline-block bg-white px-2 py-1 rounded border border-gray-200",
                      isCondensedView ? "text-sm" : "shadow-sm"
                    )}>
                      <div className={cn(
                        "font-semibold text-gray-800",
                        isCondensedView ? "text-sm" : "text-lg"
                      )}>
                        {(() => {
                          const parsed = parse(dateKey, 'yyyy-MM-dd', new Date());
                          return !isNaN(parsed.getTime()) ? format(parsed, 'MMM d, yyyy') : dateKey;
                        })()}
                      </div>
                      {!isCondensedView && (
                      <div className="text-sm font-medium text-gray-500">
                        {new Date(dateKey).toLocaleDateString(undefined, {
                          weekday: 'short'
                        })}
                      </div>
                      )}
                    </div>
                  </div>

                  {/* Events for this date */}
                  <div className={isCondensedView ? "ml-0" : "ml-40"}>
                    {events.map((event) => {
                      const registryItem = EVENT_TYPES[event.type];
                      if (!registryItem) return <div key={event.id}>Unknown event type: {event.type}</div>;
                      
                      const EventCardComponent = registryItem.cardComponent;
                      const thumbnail = eventThumbnails[event.id] || registryItem.defaultThumbnail;

                      if (!EventCardComponent) return <div key={event.id}>No card component for {event.type}</div>;

                      return (
                        <div key={event.id} className={cn(
                          "relative",
                          isCondensedView ? "mb-1" : "mb-8 group"
                        )}>
                          {/* Animated icon - only show in full view */}
                          {!isCondensedView && <EventIcon type={event.type} />}
                          
                          {/* Timeline dot - only show in full view */}
                          {!isCondensedView && (
                          <div className="absolute -left-12 w-8 h-8 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-blue-500 border-4 border-white shadow-md group-hover:scale-110 transition-transform duration-300"></div>
                          </div>
                          )}
                          
                          {/* Event card */}
                          {isCondensedView ? (
                            <CondensedEventCard event={event} thumbnail={thumbnail} />
                          ) : (
                          <EventCardComponent 
                            event={event} 
                            thumbnail={thumbnail}
                            onEdit={canEdit ? () => handleEditEventClick(event) : undefined}
                            onDelete={canEdit ? () => handleDeleteEvent(event.id) : undefined}
                          />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Render Specific EventFormModals conditionally */}
      {modalType === 'arrival' && (
          <ArrivalFormModal 
              isOpen={!!modalType} // Open if modalType is set
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any} // Cast needed, or ensure type match
          />
      )}
       {modalType === 'stay' && (
          <StayFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any} // Cast needed
          />
      )}
      {modalType === 'rental_car' && (
          <RentalCarFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any} // Cast needed
          />
      )}
       {modalType === 'flight' && (
          <FlightFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any} // Cast needed
          />
      )}
      {/* TODO: Add conditional rendering for other modal types */}
      {modalType === 'activity' && (
          <ActivityFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}
      {modalType === 'bus' && (
          <BusFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}
       {modalType === 'train' && (
          <TrainFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}
       {modalType === 'destination' && (
          <DestinationFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}
       {modalType === 'departure' && (
          <DepartureFormModal 
              isOpen={!!modalType}
              onClose={handleCloseModal} 
              onSave={handleSaveEvent} 
              eventToEdit={editingEvent as any}
          />
      )}
    </div>
  );
};

export default NewTripDetails;
