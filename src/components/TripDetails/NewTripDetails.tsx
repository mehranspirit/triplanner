import React, { useState } from 'react';
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
    // Type guard to check if 'id' exists, determining if it's an update or add
    if ('id' in eventData && editingEvent && eventData.id === editingEvent.id) {
        // We are editing an existing event
        await updateEvent({ ...editingEvent, ...eventData } as Event); // Merge updates onto existing event structure
    } else {
        // We are adding a new event
        // The eventData should conform to the Omit type here based on modal logic
        await addEvent(eventData as Omit<Event, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'likes' | 'dislikes'>);
    }
    // Note: No need to call handleCloseModal here, as the modal's internal onSubmit calls it.
    // If the modal didn't close automatically on save, we would call handleCloseModal();
  };
  
  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      await deleteEvent(eventId);
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
          <p><strong>Start Date:</strong> {new Date(trip.startDate).toLocaleDateString()}</p>
          <p><strong>End Date:</strong> {new Date(trip.endDate).toLocaleDateString()}</p>
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

      <h2 className="text-xl md:text-2xl font-semibold">Events</h2>
      
      {sortedEvents.length === 0 ? (
          <p className="text-gray-500">No events added yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedEvents.map((event) => {
              const registryItem = EVENT_TYPES[event.type]; 
              if (!registryItem) return <div key={event.id}>Unknown event type: {event.type}</div>;
              
              const EventCardComponent = registryItem.cardComponent;
              const thumbnail = eventThumbnails[event.id] || registryItem.defaultThumbnail; // Use specific or default thumbnail

              if (!EventCardComponent) return <div key={event.id}>No card component for {event.type}</div>;

              return (
                  <EventCardComponent 
                      key={event.id} 
                      event={event} 
                      thumbnail={thumbnail}
                      onEdit={canEdit ? () => handleEditEventClick(event) : undefined} // Pass edit handler if allowed
                      onDelete={canEdit ? () => handleDeleteEvent(event.id) : undefined} // Pass delete handler if allowed
                  />
              );
          })} 
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
