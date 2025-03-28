import React from 'react';
import { FlightEvent } from '@/types';

interface FlightFieldsProps {
  eventData: Partial<FlightEvent>;
  onChange: <T extends FlightEvent>(field: keyof T, value: string) => void;
}

const FlightFields: React.FC<FlightFieldsProps> = ({ eventData, onChange }) => {
  return (
    <>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Airline (optional)</label>
        <input
          type="text"
          value={eventData.airline || ''}
          onChange={(e) => onChange<FlightEvent>('airline', e.target.value)}
          className="input"
          placeholder="Enter airline name"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Flight Number (optional)</label>
        <input
          type="text"
          value={eventData.flightNumber || ''}
          onChange={(e) => onChange<FlightEvent>('flightNumber', e.target.value)}
          className="input"
          placeholder="Enter flight number"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Departure Airport (optional)</label>
        <input
          type="text"
          value={eventData.departureAirport || ''}
          onChange={(e) => onChange<FlightEvent>('departureAirport', e.target.value)}
          className="input"
          placeholder="Enter departure airport"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Arrival Airport (optional)</label>
        <input
          type="text"
          value={eventData.arrivalAirport || ''}
          onChange={(e) => onChange<FlightEvent>('arrivalAirport', e.target.value)}
          className="input"
          placeholder="Enter arrival airport"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Departure Time (optional)</label>
        <input
          type="time"
          value={eventData.departureTime || ''}
          onChange={(e) => onChange<FlightEvent>('departureTime', e.target.value)}
          className="input"
          placeholder="Enter departure time"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Arrival Time (optional)</label>
        <input
          type="time"
          value={eventData.arrivalTime || ''}
          onChange={(e) => onChange<FlightEvent>('arrivalTime', e.target.value)}
          className="input"
          placeholder="Enter arrival time"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Terminal (optional)</label>
        <input
          type="text"
          value={eventData.terminal || ''}
          onChange={(e) => onChange<FlightEvent>('terminal', e.target.value)}
          className="input"
          placeholder="Enter terminal"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Gate (optional)</label>
        <input
          type="text"
          value={eventData.gate || ''}
          onChange={(e) => onChange<FlightEvent>('gate', e.target.value)}
          className="input"
          placeholder="Enter gate"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Booking Reference (optional)</label>
        <input
          type="text"
          value={eventData.bookingReference || ''}
          onChange={(e) => onChange<FlightEvent>('bookingReference', e.target.value)}
          className="input"
          placeholder="Enter booking reference"
        />
      </div>
    </>
  );
};

export default FlightFields; 