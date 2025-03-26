import React from 'react';
import { StayEvent } from '../../../../types';

interface StayFieldsProps {
  eventData: Partial<StayEvent>;
  onChange: (field: keyof StayEvent, value: string) => void;
}

const StayFields: React.FC<StayFieldsProps> = ({ eventData, onChange }) => {
  return (
    <>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Accommodation Name</label>
        <input
          type="text"
          value={eventData.accommodationName || ''}
          onChange={(e) => onChange('accommodationName', e.target.value)}
          className="input"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Check-in</label>
        <input
          type="date"
          value={eventData.checkIn?.split('T')[0] || ''}
          onChange={(e) => onChange('checkIn', e.target.value)}
          className="input"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Check-out</label>
        <input
          type="date"
          value={eventData.checkOut?.split('T')[0] || ''}
          onChange={(e) => onChange('checkOut', e.target.value)}
          className="input"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Address (optional)</label>
        <input
          type="text"
          value={eventData.address || ''}
          onChange={(e) => onChange('address', e.target.value)}
          className="input"
          placeholder="Enter address"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Reservation Number (optional)</label>
        <input
          type="text"
          value={eventData.reservationNumber || ''}
          onChange={(e) => onChange('reservationNumber', e.target.value)}
          className="input"
          placeholder="Enter reservation number"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Contact Info (optional)</label>
        <input
          type="text"
          value={eventData.contactInfo || ''}
          onChange={(e) => onChange('contactInfo', e.target.value)}
          className="input"
          placeholder="Enter contact information"
        />
      </div>
    </>
  );
};

export default StayFields; 