import React from 'react';
import { ArrivalDepartureEvent } from '../../../../types';

interface ArrivalFieldsProps {
  eventData: Partial<ArrivalDepartureEvent>;
  onChange: (field: keyof ArrivalDepartureEvent, value: string) => void;
  airportSuggestions: Array<{ name: string; iata: string }>;
  showAirportSuggestions: boolean;
  onAirportSelect: (airport: { name: string; iata: string }) => void;
  onAirportInputChange: (value: string) => void;
  airportInputRef: React.RefObject<HTMLInputElement>;
}

const ArrivalFields: React.FC<ArrivalFieldsProps> = ({
  eventData,
  onChange,
  airportSuggestions,
  showAirportSuggestions,
  onAirportSelect,
  onAirportInputChange,
  airportInputRef
}) => {
  return (
    <>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Flight Number (optional)</label>
        <input
          type="text"
          value={eventData.flightNumber || ''}
          onChange={(e) => onChange('flightNumber', e.target.value)}
          className="input"
          placeholder="Enter flight number"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Airline (optional)</label>
        <input
          type="text"
          value={eventData.airline || ''}
          onChange={(e) => onChange('airline', e.target.value)}
          className="input"
          placeholder="Enter airline name"
        />
      </div>
      <div className="mb-4 relative" ref={airportInputRef}>
        <label className="block text-gray-700 mb-2">Airport</label>
        <input
          type="text"
          value={eventData.airport || ''}
          onChange={(e) => {
            onChange('airport', e.target.value);
            onAirportInputChange(e.target.value);
          }}
          className="input"
          required
          placeholder="Start typing airport name..."
        />
        {showAirportSuggestions && airportSuggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
            {airportSuggestions.map((airport) => (
              <li
                key={airport.iata}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onClick={() => onAirportSelect(airport)}
              >
                {airport.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Terminal (optional)</label>
        <input
          type="text"
          value={eventData.terminal || ''}
          onChange={(e) => onChange('terminal', e.target.value)}
          className="input"
          placeholder="Enter terminal number"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Gate (optional)</label>
        <input
          type="text"
          value={eventData.gate || ''}
          onChange={(e) => onChange('gate', e.target.value)}
          className="input"
          placeholder="Enter gate number"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Booking Reference (optional)</label>
        <input
          type="text"
          value={eventData.bookingReference || ''}
          onChange={(e) => onChange('bookingReference', e.target.value)}
          className="input"
          placeholder="Enter booking reference"
        />
      </div>
    </>
  );
};

export default ArrivalFields; 