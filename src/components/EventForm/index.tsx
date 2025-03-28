import React, { RefObject } from 'react';
import { Event, EventType, ArrivalDepartureEvent, StayEvent, DestinationEvent, FlightEvent, TrainEvent, RentalCarEvent } from '../../types';
import ArrivalFields from './EventTypeFields/ArrivalFields';
import StayFields from './EventTypeFields/StayFields';
import DestinationFields from './EventTypeFields/DestinationFields';
import FlightFields from './EventTypeFields/FlightFields';
import TrainFields from './EventTypeFields/TrainFields';
import RentalCarFields from './EventTypeFields/RentalCarFields';

interface EventFormProps {
  eventType: EventType;
  eventData: Partial<Event>;
  isEditingEvent: string | null;
  onEventDataChange: (data: Partial<Event>) => void;
  onAirportInputChange: (query: string) => void;
  onAirportSelect: (airport: { name: string }) => void;
  airportSuggestions: Array<{ name: string; iata: string }>;
  showAirportSuggestions: boolean;
  airportInputRef: RefObject<HTMLInputElement>;
}

const EventForm: React.FC<EventFormProps> = ({
  eventType,
  eventData,
  isEditingEvent,
  onEventDataChange,
  onAirportInputChange,
  onAirportSelect,
  airportSuggestions,
  showAirportSuggestions,
  airportInputRef
}) => {
  const handleChange = <T extends Event>(field: keyof T, value: any) => {
    onEventDataChange({ ...eventData, [field]: value } as Partial<Event>);
  };

  const commonFields = (
    <>
      {['stay', 'destination'].includes(eventType) && (
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Thumbnail URL (optional)</label>
          <input
            type="url"
            value={eventData.thumbnailUrl || ''}
            onChange={(e) => handleChange('thumbnailUrl', e.target.value)}
            className="input"
            placeholder="Enter image URL or leave empty"
          />
        </div>
      )}
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Date</label>
        <input
          type="date"
          value={eventData.date?.split('T')[0] || ''}
          onChange={(e) => handleChange('date', e.target.value)}
          className="input"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Status</label>
        <select
          value={eventData.status || 'confirmed'}
          onChange={(e) => handleChange('status', e.target.value)}
          className="input"
        >
          <option value="confirmed">Confirmed</option>
          <option value="exploring">Exploring</option>
        </select>
      </div>
      {eventData.status === 'exploring' && (
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
              value={eventData.source || ''}
              onChange={(e) => handleChange('source', e.target.value)}
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
          value={eventData.location?.address || ''}
          onChange={(e) => handleChange('location', { ...eventData.location, address: e.target.value })}
          className="input"
          placeholder="Enter location"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Notes (optional)</label>
        <textarea
          value={eventData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          className="input"
          placeholder="Enter any notes"
        />
      </div>
    </>
  );

  const renderEventTypeFields = () => {
    switch (eventType) {
      case 'arrival':
      case 'departure':
        return (
          <ArrivalFields
            eventData={eventData as Partial<ArrivalDepartureEvent>}
            onChange={handleChange}
            airportSuggestions={airportSuggestions}
            showAirportSuggestions={showAirportSuggestions}
            onAirportSelect={onAirportSelect}
            onAirportInputChange={onAirportInputChange}
            airportInputRef={airportInputRef}
          />
        );
      case 'stay':
        return (
          <StayFields
            eventData={eventData as Partial<StayEvent>}
            onChange={handleChange}
          />
        );
      case 'destination':
        return (
          <DestinationFields
            eventData={eventData as Partial<DestinationEvent>}
            onChange={handleChange}
          />
        );
      case 'flight':
        return (
          <FlightFields
            eventData={eventData as Partial<FlightEvent>}
            onChange={handleChange}
          />
        );
      case 'train':
        return (
          <TrainFields
            eventData={eventData as Partial<TrainEvent>}
            onChange={handleChange}
          />
        );
      case 'rental_car':
        return (
          <RentalCarFields
            eventData={eventData as Partial<RentalCarEvent>}
            onChange={handleChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {commonFields}
      {renderEventTypeFields()}
    </>
  );
};

export default EventForm; 