import React, { useState, useRef } from 'react';
import { EventType, Event, ArrivalDepartureEvent, StayEvent, DestinationEvent } from '../../../types';
import { getEventTypeConfig } from '../../../config/eventTypes';
import ArrivalFields from './EventTypeFields/ArrivalFields';
import StayFields from './EventTypeFields/StayFields';
import DestinationFields from './EventTypeFields/DestinationFields';

interface EventFormProps {
  eventType: EventType;
  eventData: Partial<Event>;
  onSubmit: (event: Event) => void;
  onCancel: () => void;
  isEditing: boolean;
}

const EventForm: React.FC<EventFormProps> = ({
  eventType,
  eventData,
  onSubmit,
  onCancel,
  isEditing
}) => {
  const [formData, setFormData] = useState<Partial<Event>>(eventData);
  const [airportSuggestions, setAirportSuggestions] = useState<Array<{ name: string; iata: string }>>([]);
  const [showAirportSuggestions, setShowAirportSuggestions] = useState(false);
  const airportInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

  const handleChange = <T extends Event>(field: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAirportInputChange = async (value: string) => {
    if (value.length < 2) {
      setAirportSuggestions([]);
      return;
    }
    try {
      const response = await fetch(`https://api.api-ninjas.com/v1/airports?name=${value}`, {
        headers: {
          'X-Api-Key': import.meta.env.VITE_API_NINJAS_KEY
        }
      });
      const data = await response.json();
      const airports = data
        .filter((airport: any) => airport.iata && airport.name)
        .map((airport: any) => ({
          name: `${airport.name} (${airport.iata})`,
          iata: airport.iata
        }));
      setAirportSuggestions(airports);
      setShowAirportSuggestions(true);
    } catch (error) {
      console.error('Error fetching airports:', error);
    }
  };

  const handleAirportSelect = (airport: { name: string; iata: string }) => {
    if (eventType === 'arrival' || eventType === 'departure') {
      handleChange<ArrivalDepartureEvent>('airport', airport.name);
    }
    setShowAirportSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as Event);
  };

  const eventTypeConfig = getEventTypeConfig(eventType);

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Date</label>
        <input
          type="date"
          value={formData.date?.split('T')[0] || ''}
          onChange={(e) => handleChange<Event>('date', e.target.value)}
          className="input"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Status</label>
        <select
          value={formData.status || 'confirmed'}
          onChange={(e) => handleChange<Event>('status', e.target.value)}
          className="input"
        >
          <option value="confirmed">Confirmed</option>
          <option value="exploring">Exploring</option>
        </select>
      </div>

      {formData.status === 'exploring' && (
        <>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Exploring events</span> can be voted on by all trip members.
              You and other collaborators will be able to like or dislike this event
              after it's added to help decide which options to confirm.
            </p>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Source (optional)</label>
            <input
              type="text"
              value={formData.source || ''}
              onChange={(e) => handleChange<Event>('source', e.target.value)}
              className="input"
              placeholder="Where did you find this idea?"
            />
          </div>
        </>
      )}

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Location (optional)</label>
        <input
          type="text"
          value={formData.location?.address || ''}
          onChange={(e) => handleChange<Event>('location', { ...formData.location, address: e.target.value })}
          className="input"
          placeholder="Enter location"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Notes (optional)</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => handleChange<Event>('notes', e.target.value)}
          className="input"
          placeholder="Enter any notes"
        />
      </div>

      {/* Event type-specific fields */}
      {(eventType === 'arrival' || eventType === 'departure') && (
        <ArrivalFields
          eventData={formData as Partial<ArrivalDepartureEvent>}
          onChange={handleChange}
          airportSuggestions={airportSuggestions}
          showAirportSuggestions={showAirportSuggestions}
          onAirportSelect={handleAirportSelect}
          onAirportInputChange={handleAirportInputChange}
          airportInputRef={airportInputRef}
        />
      )}

      {eventType === 'stay' && (
        <StayFields
          eventData={formData as Partial<StayEvent>}
          onChange={handleChange}
        />
      )}

      {eventType === 'destination' && (
        <DestinationFields
          eventData={formData as Partial<DestinationEvent>}
          onChange={handleChange}
        />
      )}

      <div className="flex justify-end space-x-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {isEditing ? 'Save Changes' : 'Add Event'}
        </button>
      </div>
    </form>
  );
};

export default EventForm; 