import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { Trip, Event, EventType, ArrivalDepartureEvent, StaysEvent, DestinationsEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';
import '../styles/TripDetails.css';

export default function TripDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, updateTrip, deleteTrip, addEvent, updateEvent, deleteEvent } = useTrip();
  const trip = state.trips.find((t) => t.id === id);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventType, setEventType] = useState<EventType>('arrival');
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState<string | null>(null);
  const [editedTrip, setEditedTrip] = useState({ 
    name: trip?.name || '', 
    thumbnailUrl: trip?.thumbnailUrl || '',
    notes: trip?.notes || '' 
  });
  const [eventData, setEventData] = useState({
    thumbnailUrl: '',
    date: '',
    location: '',
    notes: '',
    // Arrival/Departure fields
    flightNumber: '',
    airline: '',
    time: '',
    airport: '',
    terminal: '',
    gate: '',
    bookingReference: '',
    // Stays fields
    accommodationName: '',
    address: '',
    checkIn: '',
    checkOut: '',
    reservationNumber: '',
    contactInfo: '',
    // Destinations fields
    placeName: '',
    description: '',
    openingHours: '',
  });

  if (!trip) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Trip not found</h2>
        <button
          onClick={() => navigate('/')}
          className="mt-4 btn btn-primary"
        >
          Back to Trips
        </button>
      </div>
    );
  }

  const handleTripEdit = () => {
    setEditedTrip({ name: trip.name, thumbnailUrl: trip.thumbnailUrl, notes: trip.notes || '' });
    setIsEditingTrip(true);
  };

  const handleTripSave = () => {
    updateTrip({
      ...trip,
      name: editedTrip.name,
      thumbnailUrl: editedTrip.thumbnailUrl,
      notes: editedTrip.notes,
    });
    setIsEditingTrip(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let newEvent: Event;

    const baseEventData = {
      id: isEditingEvent || uuidv4(),
      type: eventType,
      thumbnailUrl: ['stays', 'destinations'].includes(eventType) ? eventData.thumbnailUrl : '',
      date: eventData.date,
      location: eventData.location || undefined,
      notes: eventData.notes || undefined,
    };

    switch (eventType) {
      case 'arrival':
      case 'departure':
        newEvent = {
          ...baseEventData,
          type: eventType,
          flightNumber: eventData.flightNumber,
          airline: eventData.airline,
          time: eventData.time,
          airport: eventData.airport,
          terminal: eventData.terminal || undefined,
          gate: eventData.gate || undefined,
          bookingReference: eventData.bookingReference || undefined,
        } as ArrivalDepartureEvent;
        break;
      case 'stays':
        newEvent = {
          ...baseEventData,
          type: 'stays',
          accommodationName: eventData.accommodationName,
          address: eventData.address,
          checkIn: eventData.checkIn,
          checkOut: eventData.checkOut,
          reservationNumber: eventData.reservationNumber || undefined,
          contactInfo: eventData.contactInfo || undefined,
        } as StaysEvent;
        break;
      case 'destinations':
        newEvent = {
          ...baseEventData,
          type: 'destinations',
          placeName: eventData.placeName,
          address: eventData.address,
          description: eventData.description,
          openingHours: eventData.openingHours || undefined,
        } as DestinationsEvent;
        break;
      default:
        return;
    }

    if (isEditingEvent) {
      updateEvent(trip.id, newEvent);
    } else {
      addEvent(trip.id, newEvent);
    }
    setIsModalOpen(false);
    setIsEditingEvent(null);
    setEventData({
      thumbnailUrl: '',
      date: '',
      location: '',
      flightNumber: '',
      airline: '',
      time: '',
      airport: '',
      terminal: '',
      gate: '',
      bookingReference: '',
      accommodationName: '',
      address: '',
      checkIn: '',
      checkOut: '',
      reservationNumber: '',
      contactInfo: '',
      placeName: '',
      description: '',
      openingHours: '',
      notes: '',
    });
  };

  const handleEditEvent = (event: Event) => {
    setEventType(event.type);
    setEventData({
      ...eventData,
      thumbnailUrl: event.thumbnailUrl || '',
      date: event.date || '',
      location: event.location || '',
      notes: event.notes || '',
      ...(event.type === 'arrival' || event.type === 'departure'
        ? {
            flightNumber: (event as ArrivalDepartureEvent).flightNumber || '',
            airline: (event as ArrivalDepartureEvent).airline || '',
            time: (event as ArrivalDepartureEvent).time || '',
            airport: (event as ArrivalDepartureEvent).airport || '',
            terminal: (event as ArrivalDepartureEvent).terminal || '',
            gate: (event as ArrivalDepartureEvent).gate || '',
            bookingReference: (event as ArrivalDepartureEvent).bookingReference || '',
          }
        : event.type === 'stays'
        ? {
            accommodationName: (event as StaysEvent).accommodationName || '',
            address: (event as StaysEvent).address || '',
            checkIn: (event as StaysEvent).checkIn || '',
            checkOut: (event as StaysEvent).checkOut || '',
            reservationNumber: (event as StaysEvent).reservationNumber || '',
            contactInfo: (event as StaysEvent).contactInfo || '',
          }
        : {
            placeName: (event as DestinationsEvent).placeName || '',
            address: (event as DestinationsEvent).address || '',
            description: (event as DestinationsEvent).description || '',
            openingHours: (event as DestinationsEvent).openingHours || '',
          }),
    });
    setIsEditingEvent(event.id);
    setIsModalOpen(true);
  };

  const renderEventForm = () => {
    const commonFields = (
      <>
        {['stays', 'destinations'].includes(eventType) && (
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Thumbnail URL (optional)</label>
            <input
              type="url"
              value={eventData.thumbnailUrl}
              onChange={(e) =>
                setEventData({ ...eventData, thumbnailUrl: e.target.value })
              }
              className="input"
              placeholder="Enter image URL or leave empty"
            />
          </div>
        )}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Date</label>
          <input
            type="datetime-local"
            value={eventData.date}
            onChange={(e) =>
              setEventData({ ...eventData, date: e.target.value })
            }
            className="input"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Location (optional)</label>
          <input
            type="text"
            value={eventData.location}
            onChange={(e) =>
              setEventData({ ...eventData, location: e.target.value })
            }
            className="input"
            placeholder="Enter location"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Notes (optional)</label>
          <textarea
            value={eventData.notes}
            onChange={(e) =>
              setEventData({ ...eventData, notes: e.target.value })
            }
            className="input"
            placeholder="Enter any notes"
          />
        </div>
      </>
    );

    switch (eventType) {
      case 'arrival':
      case 'departure':
        return (
          <>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Flight Number</label>
              <input
                type="text"
                value={eventData.flightNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, flightNumber: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Airline</label>
              <input
                type="text"
                value={eventData.airline}
                onChange={(e) =>
                  setEventData({ ...eventData, airline: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Airport</label>
              <input
                type="text"
                value={eventData.airport}
                onChange={(e) =>
                  setEventData({ ...eventData, airport: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Terminal (optional)</label>
              <input
                type="text"
                value={eventData.terminal}
                onChange={(e) =>
                  setEventData({ ...eventData, terminal: e.target.value })
                }
                className="input"
                placeholder="Enter terminal number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Gate (optional)</label>
              <input
                type="text"
                value={eventData.gate}
                onChange={(e) =>
                  setEventData({ ...eventData, gate: e.target.value })
                }
                className="input"
                placeholder="Enter gate number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Booking Reference (optional)</label>
              <input
                type="text"
                value={eventData.bookingReference}
                onChange={(e) =>
                  setEventData({ ...eventData, bookingReference: e.target.value })
                }
                className="input"
                placeholder="Enter booking reference"
              />
            </div>
          </>
        );
      case 'stays':
        return (
          <>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Accommodation Name</label>
              <input
                type="text"
                value={eventData.accommodationName}
                onChange={(e) =>
                  setEventData({ ...eventData, accommodationName: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Address</label>
              <input
                type="text"
                value={eventData.address}
                onChange={(e) =>
                  setEventData({ ...eventData, address: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Check-in</label>
              <input
                type="datetime-local"
                value={eventData.checkIn}
                onChange={(e) =>
                  setEventData({ ...eventData, checkIn: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Check-out</label>
              <input
                type="datetime-local"
                value={eventData.checkOut}
                onChange={(e) =>
                  setEventData({ ...eventData, checkOut: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Reservation Number (optional)</label>
              <input
                type="text"
                value={eventData.reservationNumber}
                onChange={(e) =>
                  setEventData({ ...eventData, reservationNumber: e.target.value })
                }
                className="input"
                placeholder="Enter reservation number"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Contact Info (optional)</label>
              <input
                type="text"
                value={eventData.contactInfo}
                onChange={(e) =>
                  setEventData({ ...eventData, contactInfo: e.target.value })
                }
                className="input"
                placeholder="Enter contact information"
              />
            </div>
          </>
        );
      case 'destinations':
        return (
          <>
            {commonFields}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Place Name</label>
              <input
                type="text"
                value={eventData.placeName}
                onChange={(e) =>
                  setEventData({ ...eventData, placeName: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Address</label>
              <input
                type="text"
                value={eventData.address}
                onChange={(e) =>
                  setEventData({ ...eventData, address: e.target.value })
                }
                className="input"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Description (optional)</label>
              <textarea
                value={eventData.description}
                onChange={(e) =>
                  setEventData({ ...eventData, description: e.target.value })
                }
                className="input"
                placeholder="Enter description"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Opening Hours (optional)</label>
              <input
                type="text"
                value={eventData.openingHours}
                onChange={(e) =>
                  setEventData({ ...eventData, openingHours: e.target.value })
                }
                className="input"
                placeholder="Enter opening hours"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          {isEditingTrip ? (
            <div className="space-y-4">
              <input
                type="text"
                value={editedTrip.name}
                onChange={(e) => setEditedTrip({ ...editedTrip, name: e.target.value })}
                className="input text-2xl font-bold"
                placeholder="Trip Name"
                required
              />
              <input
                type="url"
                value={editedTrip.thumbnailUrl}
                onChange={(e) => setEditedTrip({ ...editedTrip, thumbnailUrl: e.target.value })}
                className="input w-full"
                placeholder="Thumbnail URL (optional)"
              />
              <textarea
                value={editedTrip.notes}
                onChange={(e) => setEditedTrip({ ...editedTrip, notes: e.target.value })}
                className="input w-full"
                placeholder="Trip notes (optional)"
              />
              <div className="flex gap-2">
                <button onClick={handleTripSave} className="btn btn-primary">Save</button>
                <button onClick={() => setIsEditingTrip(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900">{trip.name}</h2>
                <button
                  onClick={handleTripEdit}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                </button>
              </div>
              <img
                src={trip.thumbnailUrl}
                alt={trip.name}
                className="mt-4 w-full max-w-2xl h-64 object-cover rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/800x400?text=No+Image';
                  target.onerror = null;
                }}
              />
              {trip.notes && (
                <p className="mt-4 text-gray-600">{trip.notes}</p>
              )}
            </>
          )}
        </div>
        <div>
          <button onClick={() => navigate('/')} className="btn btn-secondary mr-4">
            Back to Trips
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
          >
            Add Event
          </button>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Events</h3>
        <div className="space-y-4">
          {trip.events.map((event) => (
            <div key={event.id} className="card">
              <div className="flex">
                {['stays', 'destinations'].includes(event.type) && event.thumbnailUrl && (
                  <img
                    src={event.thumbnailUrl}
                    alt={event.type}
                    className="w-48 h-32 object-cover rounded-l-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/200x150?text=No+Image';
                      target.onerror = null;
                    }}
                  />
                )}
                <div className="p-4 flex-1">
                  <div className="flex justify-between">
                    <h4 className="text-lg font-semibold capitalize">
                      {event.type}
                    </h4>
                    <div>
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="text-blue-600 hover:text-blue-800 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteEvent(trip.id, event.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {event.type === 'arrival' || event.type === 'departure' ? (
                    <div className="mt-2">
                      <p>Flight: {(event as ArrivalDepartureEvent).airline} {(event as ArrivalDepartureEvent).flightNumber}</p>
                      <p>Airport: {(event as ArrivalDepartureEvent).airport}</p>
                      {event.location && <p>Location: {event.location}</p>}
                    </div>
                  ) : event.type === 'stays' ? (
                    <div className="mt-2">
                      <p>{(event as StaysEvent).accommodationName}</p>
                      <p>{(event as StaysEvent).address}</p>
                      {event.location && <p>Location: {event.location}</p>}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p>{(event as DestinationsEvent).placeName}</p>
                      <p>{(event as DestinationsEvent).address}</p>
                      {event.location && <p>Location: {event.location}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">
              {isEditingEvent ? 'Edit Event' : 'Add New Event'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className="input"
                  disabled={isEditingEvent !== null}
                >
                  <option value="arrival">Arrival</option>
                  <option value="stays">Stays</option>
                  <option value="destinations">Destinations</option>
                  <option value="departure">Departure</option>
                </select>
              </div>
              {renderEventForm()}
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsEditingEvent(null);
                    setEventData({
                      thumbnailUrl: '',
                      date: '',
                      location: '',
                      flightNumber: '',
                      airline: '',
                      time: '',
                      airport: '',
                      terminal: '',
                      gate: '',
                      bookingReference: '',
                      accommodationName: '',
                      address: '',
                      checkIn: '',
                      checkOut: '',
                      reservationNumber: '',
                      contactInfo: '',
                      placeName: '',
                      description: '',
                      openingHours: '',
                      notes: '',
                    });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditingEvent ? 'Save Changes' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 