import React, { RefObject } from 'react';
import { ArrivalDepartureEvent } from '@/types';

interface ArrivalFieldsProps {
  eventData: Partial<ArrivalDepartureEvent>;
  onChange: <T extends ArrivalDepartureEvent>(field: keyof T, value: string) => void;
  airportSuggestions: Array<{ name: string; iata: string }>;
  showAirportSuggestions: boolean;
  onAirportSelect: (airport: { name: string }) => void;
  onAirportInputChange: (query: string) => void;
  airportInputRef: RefObject<HTMLInputElement>;
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
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Time *</label>
          <input
            type="time"
            value={eventData.time || ''}
            onChange={(e) => onChange('time', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Airport *</label>
          <div className="relative" ref={airportInputRef}>
            <input
              type="text"
              value={eventData.airport || ''}
              onChange={(e) => {
                onChange('airport', e.target.value);
                onAirportInputChange(e.target.value);
              }}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
              placeholder="Start typing airport name..."
            />
            {showAirportSuggestions && airportSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-auto shadow-lg">
                {airportSuggestions.map((airport, index) => (
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Flight Number (Optional)</label>
          <input
            type="text"
            value={eventData.flightNumber || ''}
            onChange={(e) => onChange('flightNumber', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="e.g., AA123"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Airline (Optional)</label>
          <input
            type="text"
            value={eventData.airline || ''}
            onChange={(e) => onChange('airline', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="e.g., American Airlines"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Terminal (Optional)</label>
          <input
            type="text"
            value={eventData.terminal || ''}
            onChange={(e) => onChange('terminal', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter terminal number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Gate (Optional)</label>
          <input
            type="text"
            value={eventData.gate || ''}
            onChange={(e) => onChange('gate', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter gate number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Booking Reference (Optional)</label>
          <input
            type="text"
            value={eventData.bookingReference || ''}
            onChange={(e) => onChange('bookingReference', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter booking reference"
          />
        </div>
      </div>
    </>
  );
};

export default ArrivalFields; 