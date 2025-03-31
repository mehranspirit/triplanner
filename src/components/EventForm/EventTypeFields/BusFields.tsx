import React from 'react';
import { BusEvent } from '@/types';

interface BusFieldsProps {
  eventData: Partial<BusEvent>;
  onChange: (data: Partial<BusEvent>) => void;
}

const BusFields: React.FC<BusFieldsProps> = ({ eventData, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ [name]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="busOperator" className="block text-sm font-medium text-gray-700">
          Bus Operator (optional)
        </label>
        <input
          type="text"
          id="busOperator"
          name="busOperator"
          value={eventData.busOperator || ''}
          onChange={handleChange}
          required={false}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="busNumber" className="block text-sm font-medium text-gray-700">
          Bus Number (optional)
        </label>
        <input
          type="text"
          id="busNumber"
          name="busNumber"
          value={eventData.busNumber || ''}
          onChange={handleChange}
          required={false}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="departureStation" className="block text-sm font-medium text-gray-700">
          Departure Station
        </label>
        <input
          type="text"
          id="departureStation"
          name="departureStation"
          value={eventData.departureStation || ''}
          onChange={handleChange}
          required={true}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="arrivalStation" className="block text-sm font-medium text-gray-700">
          Arrival Station
        </label>
        <input
          type="text"
          id="arrivalStation"
          name="arrivalStation"
          value={eventData.arrivalStation || ''}
          onChange={handleChange}
          required={true}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="departureTime" className="block text-sm font-medium text-gray-700">
          Departure Time
        </label>
        <input
          type="time"
          id="departureTime"
          name="departureTime"
          value={eventData.departureTime || ''}
          onChange={handleChange}
          required={true}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="arrivalTime" className="block text-sm font-medium text-gray-700">
          Arrival Time (optional)
        </label>
        <input
          type="time"
          id="arrivalTime"
          name="arrivalTime"
          value={eventData.arrivalTime || ''}
          onChange={handleChange}
          required={false}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="seatNumber" className="block text-sm font-medium text-gray-700">
          Seat Number (optional)
        </label>
        <input
          type="text"
          id="seatNumber"
          name="seatNumber"
          value={eventData.seatNumber || ''}
          onChange={handleChange}
          required={false}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="bookingReference" className="block text-sm font-medium text-gray-700">
          Booking Reference (optional)
        </label>
        <input
          type="text"
          id="bookingReference"
          name="bookingReference"
          value={eventData.bookingReference || ''}
          onChange={handleChange}
          required={false}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
    </div>
  );
};

export default BusFields; 