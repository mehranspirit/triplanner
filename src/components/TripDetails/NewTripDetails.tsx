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
import { parse, format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getDefaultThumbnail } from './thumbnailHelpers';

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

// Import TripActions component
import TripActions from './TripActions';

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
    isOwner, 
    user,
    fetchTrip
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
    console.log('NewTripDetails handleSaveEvent called with data:', eventData);
    try {
    if ('id' in eventData && editingEvent && eventData.id === editingEvent.id) {
        console.log('NewTripDetails: Updating existing event:', eventData.id);
        // We are editing an existing event
        const eventToUpdate = { ...editingEvent, ...eventData } as Event;
        console.log('NewTripDetails: Combined event data for update:', eventToUpdate);
        const updatedEvent = await updateEvent(eventToUpdate);
        console.log('NewTripDetails: Event updated successfully, result:', updatedEvent);
        
        // Update the local state immediately
        if (trip && updatedEvent) {
          const updatedEvents = trip.events.map(event => 
            event.id === updatedEvent.id ? updatedEvent : event
          );
          trip.events = updatedEvents;
          console.log('NewTripDetails: Local state updated with updated event:', updatedEvent.id);
        }
    } else {
        console.log('NewTripDetails: Adding new event of type:', eventData.type);
        // We are adding a new event
        const newEvent = await addEvent(eventData as Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>);
        console.log('NewTripDetails: New event added successfully, result:', newEvent);
        
        // Update the local state immediately
        if (trip && newEvent) {
          trip.events = [...trip.events, newEvent];
          console.log('NewTripDetails: Local state updated with new event:', newEvent.id);
        }
      }
      
      // Close the modal
      console.log('NewTripDetails: Closing modal after successful save');
      handleCloseModal();
    } catch (error) {
      console.error('NewTripDetails: Error saving event:', error);
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

  const handleStatusChange = async (event: Event, newStatus: 'confirmed' | 'exploring') => {
    try {
      const updatedEvent = { ...event, status: newStatus };
      await updateEvent(updatedEvent);
      
      // Update the local state immediately
      if (trip) {
        const updatedEvents = trip.events.map(e => 
          e.id === event.id ? { ...e, status: newStatus } : e
        );
        trip.events = updatedEvents;
      }
    } catch (error) {
      console.error('Error updating event status:', error);
      alert('Failed to update event status. Please try again.');
    }
  };

  if (loading) return <div className="p-4">Loading trip details...</div>; // TODO: Add a proper spinner
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>; // TODO: Add a proper error component
  if (!trip) return <div className="p-4">Trip not found.</div>;

  // Sort events by startDate, earliest first
  const sortedEvents = [...trip.events].sort((a, b) => {
    // First compare by date
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    
    // If dates are the same, compare by time
    // Extract time parts for comparison
    const timeA = a.startDate ? a.startDate.split('T')[1] || '00:00:00' : '00:00:00';
    const timeB = b.startDate ? b.startDate.split('T')[1] || '00:00:00' : '00:00:00';
    
    return timeA.localeCompare(timeB);
  });

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
          return <FaPlane className="w-5 h-5 text-blue-500" />;
        case 'arrival':
          return <FaPlane className="w-5 h-5 text-green-500 transform rotate-45" />;
        case 'departure':
          return <FaPlane className="w-5 h-5 text-red-500 transform -rotate-45" />;
        case 'train':
          return <FaTrain className="w-5 h-5 text-green-500" />;
        case 'bus':
          return <FaBus className="w-5 h-5 text-purple-500" />;
        case 'rental_car':
          return <FaCar className="w-5 h-5 text-red-500" />;
        case 'stay':
          return <FaHotel className="w-5 h-5 text-yellow-500" />;
        case 'destination':
          return <FaMapMarkerAlt className="w-5 h-5 text-pink-500" />;
        case 'activity':
          return <FaMountain className="w-5 h-5 text-indigo-500" />;
        default:
          return <FaMapMarkerAlt className="w-5 h-5 text-gray-500" />;
      }
    };

    return (
      <div className="flex items-center space-x-3 p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
        <div className="w-16 h-16 flex-shrink-0 relative">
          <img 
            src={thumbnail} 
            alt={event.type} 
            className="w-full h-full object-cover rounded-md"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-500/10 to-gray-900/50 rounded-md"></div>
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-md">
            {getEventIcon()}
          </div>
        </div>
        <div className="flex-grow min-w-0">
          <h3 className="text-sm font-medium line-clamp-1">
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
          <div className="text-xs text-gray-500 mt-0.5">
            {(() => {
              try {
                // Handle different date fields based on event type
                let dateToFormat = '';
                let timeToShow = '';
                switch (event.type) {
                  case 'bus':
                  case 'train':
                    dateToFormat = event.startDate?.split('T')[0] || '';
                    timeToShow = event.startDate?.split('T')[1]?.substring(0, 5) || '';
                    break;
                  case 'arrival':
                  case 'departure':
                    dateToFormat = (event as any).date || '';
                    timeToShow = (event as any).time || '';
                    break;
                  case 'stay':
                    dateToFormat = (event as any).checkIn || '';
                    timeToShow = (event as any).checkInTime || '';
                    break;
                  default: 
                    dateToFormat = (event.startDate?.split('T')[0]) || '';
                    timeToShow = event.startDate?.split('T')[1]?.substring(0, 5) || '';
                }
                
                if (!dateToFormat) return 'Date not available';
                
                const date = parse(dateToFormat, 'yyyy-MM-dd', new Date());
                const formattedDate = !isNaN(date.getTime()) ? format(date, 'MMM d, yyyy') : 'Invalid date';
                
                // Add time if available
                return timeToShow ? `${formattedDate} at ${timeToShow}` : formattedDate;
              } catch (error) {
                console.error('Error formatting date for event:', event.type, error);
                return 'Date error';
              }
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header with Trip Info and Actions */}
      <div className="relative">
        {/* Background Image with Overlay */}
        <div className="w-full h-[200px] md:h-[250px] relative rounded-lg overflow-hidden">
          <img
            src={trip.thumbnailUrl || tripThumbnail}
            alt={trip.name}
              className="w-full h-full object-cover"
            />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
          
          {/* Trip Actions */}
          <div className="absolute top-4 right-4 z-10">
            <TripActions
              trip={trip}
              isOwner={isOwner}
              canEdit={canEdit}
              onExport={handleExportHTML}
              onTripUpdate={async (updatedTrip) => {
                try {
                  // Fetch updated trip data to refresh the UI with server data
                  await fetchTrip();
                  return Promise.resolve();
                } catch (error) {
                  console.error('Error updating trip:', error);
                  return Promise.reject(error);
                }
              }}
            />
          </div>
          
          {/* Trip Title */}
          <div className="absolute bottom-6 left-6 right-6 text-white z-10">
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">{trip.name}</h1>
            {trip.description && (
              <p className="mt-2 text-lg text-white/90 drop-shadow-md">
                {trip.description}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Add Event & View Options */}
      <div className="flex justify-between items-center">
        <div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Add Event
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Add New Event</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {addableEventTypes.map(type => {
                  const eventType = EVENT_TYPES[type];
                  if (!eventType) return null;
                  return (
                    <DropdownMenuItem 
                      key={type} 
                      onClick={() => handleAddEventClick(type)}
                    >
                      {eventType.icon && (
                        <span className="mr-2">{eventType.icon}</span>
                      )}
                      {/* Use a simple label or create label from event type */}
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="condensed-view" className="cursor-pointer">Condensed View</Label>
          <Switch
            id="condensed-view"
            checked={isCondensedView}
            onCheckedChange={setIsCondensedView}
          />
        </div>
      </div>

      {/* Events Timeline */}
      <div className="bg-white shadow-sm rounded-lg p-4 md:p-6">
        <h2 className="text-xl font-semibold mb-4">Trip Timeline</h2>
      
        <div className="mt-4 space-y-6">
          {sortedEvents.length === 0 ? (
            <p className="text-gray-500">No events added yet.</p>
          ) : (
            <div className="relative">
              <div className="space-y-6">
                {(() => {
                  // Group events by date
                  const groupedEvents = sortedEvents.reduce((groups, event) => {
                    let dateKey = '';
                    switch (event.type) {
                      case 'activity':
                        dateKey = (event as any).startDate?.split('T')[0];
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
                      case 'train':
                        dateKey = (event as any).startDate?.split('T')[0];
                        break;
                      default:
                        dateKey = ((event as any).startDate?.split('T')[0]) || (event as any).date || '';
                    }
                    if (!dateKey) {
                      console.warn(`No valid date found for event of type ${event.type}`, event);
                      return groups;
                    }
                    if (!groups[dateKey]) {
                      groups[dateKey] = [];
                    }
                    groups[dateKey].push(event);
                    return groups;
                  }, {} as Record<string, typeof sortedEvents>);

                  return Object.entries(groupedEvents).map(([dateKey, events]) => (
                    <div key={dateKey} className="relative">
                      <div className="sticky top-0 bg-white z-10 py-2 mb-4">
                        <div className="text-sm font-medium text-gray-500">
                          {format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d, yyyy')}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {events
                          .sort((a, b) => {
                            const timeA = a.startDate ? a.startDate.split('T')[1] || '00:00:00' : '00:00:00';
                            const timeB = b.startDate ? b.startDate.split('T')[1] || '00:00:00' : '00:00:00';
                            return timeA.localeCompare(timeB);
                          })
                          .map((event) => {
                            const registryItem = EVENT_TYPES[event.type];
                            if (!registryItem) return <div key={event.id}>Unknown event type: {event.type}</div>;
                            
                            const EventCardComponent = registryItem.cardComponent;
                            const thumbnail = eventThumbnails[event.id] || registryItem.defaultThumbnail;

                            if (!EventCardComponent) return <div key={event.id}>No card component for {event.type}</div>;

                            return (
                              <div key={event.id} className="relative">
                                {isCondensedView ? (
                                  <CondensedEventCard event={event} thumbnail={thumbnail} />
                                ) : (
                                  <EventCardComponent 
                                    event={event} 
                                    thumbnail={thumbnail}
                                    onEdit={canEdit ? () => handleEditEventClick(event) : undefined}
                                    onDelete={canEdit ? () => handleDeleteEvent(event.id) : undefined}
                                    onStatusChange={canEdit ? (newStatus) => handleStatusChange(event, newStatus) : undefined}
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
        </div>
      </div>

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
