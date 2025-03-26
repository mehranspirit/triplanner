import React from 'react';
import { StayEvent } from '../../../types';

interface StayFieldsProps {
  eventData: Partial<StayEvent>;
  onChange: <T extends StayEvent>(field: keyof T, value: string) => void;
}

const StayFields: React.FC<StayFieldsProps> = ({ eventData, onChange }) => {
  console.log('Raw event createdBy:', eventData.createdBy);

  return (
    <>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Accommodation Name</label>
        <input
          type="text"
          value={eventData.accommodationName || ''}
          onChange={(e) => onChange<StayEvent>('accommodationName', e.target.value)}
          className="input"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Check-in Date</label>
        <input
          type="date"
          value={eventData.date?.split('T')[0] || ''}
          onChange={(e) => {
            onChange<StayEvent>('date', e.target.value);
            onChange<StayEvent>('checkIn' as keyof StayEvent, e.target.value);
          }}
          className="input"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Check-out Date</label>
        <input
          type="date"
          value={eventData.checkOut?.split('T')[0] || ''}
          onChange={(e) => onChange<StayEvent>('checkOut', e.target.value)}
          className="input"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Address (optional)</label>
        <input
          type="text"
          value={eventData.address || ''}
          onChange={(e) => onChange<StayEvent>('address', e.target.value)}
          className="input"
          placeholder="Enter address"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Reservation Number (optional)</label>
        <input
          type="text"
          value={eventData.reservationNumber || ''}
          onChange={(e) => onChange<StayEvent>('reservationNumber', e.target.value)}
          className="input"
          placeholder="Enter reservation number"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Contact Info (optional)</label>
        <input
          type="text"
          value={eventData.contactInfo || ''}
          onChange={(e) => onChange<StayEvent>('contactInfo', e.target.value)}
          className="input"
          placeholder="Enter contact information"
        />
      </div>
    </>
  );
};

export default StayFields; 