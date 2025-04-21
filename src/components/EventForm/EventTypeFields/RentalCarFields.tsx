import React from 'react';
import { RentalCarEvent } from '../../../types/eventTypes';

interface RentalCarFieldsProps {
  eventData: Partial<RentalCarEvent>;
  onChange: <T extends RentalCarEvent>(field: keyof T, value: string) => void;
}

const RentalCarFields: React.FC<RentalCarFieldsProps> = ({ eventData, onChange }) => {
  return (
    <>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Car Company (optional)</label>
        <input
          type="text"
          value={eventData.carCompany || ''}
          onChange={(e) => onChange<RentalCarEvent>('carCompany', e.target.value)}
          className="input"
          placeholder="Enter car rental company"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Pickup Location (optional)</label>
        <input
          type="text"
          value={eventData.pickupLocation || ''}
          onChange={(e) => onChange<RentalCarEvent>('pickupLocation', e.target.value)}
          className="input"
          placeholder="Enter pickup location"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Dropoff Location (optional)</label>
        <input
          type="text"
          value={eventData.dropoffLocation || ''}
          onChange={(e) => onChange<RentalCarEvent>('dropoffLocation', e.target.value)}
          className="input"
          placeholder="Enter dropoff location"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Pickup Time (optional)</label>
        <input
          type="time"
          value={eventData.pickupTime || ''}
          onChange={(e) => onChange<RentalCarEvent>('pickupTime', e.target.value)}
          className="input"
          placeholder="Enter pickup time"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Dropoff Date (optional)</label>
        <input
          type="date"
          value={eventData.dropoffDate || ''}
          onChange={(e) => onChange<RentalCarEvent>('dropoffDate', e.target.value)}
          className="input"
          placeholder="Enter dropoff date"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Dropoff Time (optional)</label>
        <input
          type="time"
          value={eventData.dropoffTime || ''}
          onChange={(e) => onChange<RentalCarEvent>('dropoffTime', e.target.value)}
          className="input"
          placeholder="Enter dropoff time"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Car Type (optional)</label>
        <input
          type="text"
          value={eventData.carType || ''}
          onChange={(e) => onChange<RentalCarEvent>('carType', e.target.value)}
          className="input"
          placeholder="Enter car type"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">License Plate (optional)</label>
        <input
          type="text"
          value={eventData.licensePlate || ''}
          onChange={(e) => onChange<RentalCarEvent>('licensePlate', e.target.value)}
          className="input"
          placeholder="Enter license plate"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Booking Reference (optional)</label>
        <input
          type="text"
          value={eventData.bookingReference || ''}
          onChange={(e) => onChange<RentalCarEvent>('bookingReference', e.target.value)}
          className="input"
          placeholder="Enter booking reference"
        />
      </div>
    </>
  );
};

export default RentalCarFields; 