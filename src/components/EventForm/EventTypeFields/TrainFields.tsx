import React from 'react';
import { TrainEvent } from '@/types';

interface TrainFieldsProps {
  eventData: Partial<TrainEvent>;
  onChange: <T extends TrainEvent>(field: keyof T, value: string) => void;
}

const TrainFields: React.FC<TrainFieldsProps> = ({ eventData, onChange }) => {
  return (
    <>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Train Operator (optional)</label>
        <input
          type="text"
          value={eventData.trainOperator || ''}
          onChange={(e) => onChange<TrainEvent>('trainOperator', e.target.value)}
          className="input"
          placeholder="Enter train operator"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Train Number (optional)</label>
        <input
          type="text"
          value={eventData.trainNumber || ''}
          onChange={(e) => onChange<TrainEvent>('trainNumber', e.target.value)}
          className="input"
          placeholder="Enter train number"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Departure Station</label>
        <input
          type="text"
          value={eventData.departureStation || ''}
          onChange={(e) => onChange<TrainEvent>('departureStation', e.target.value)}
          className="input"
          required
          placeholder="Enter departure station"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Arrival Station</label>
        <input
          type="text"
          value={eventData.arrivalStation || ''}
          onChange={(e) => onChange<TrainEvent>('arrivalStation', e.target.value)}
          className="input"
          required
          placeholder="Enter arrival station"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Departure Time</label>
        <input
          type="time"
          value={eventData.departureTime || ''}
          onChange={(e) => onChange<TrainEvent>('departureTime', e.target.value)}
          className="input"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Arrival Time</label>
        <input
          type="time"
          value={eventData.arrivalTime || ''}
          onChange={(e) => onChange<TrainEvent>('arrivalTime', e.target.value)}
          className="input"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Carriage Number (optional)</label>
        <input
          type="text"
          value={eventData.carriageNumber || ''}
          onChange={(e) => onChange<TrainEvent>('carriageNumber', e.target.value)}
          className="input"
          placeholder="Enter carriage number"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Seat Number (optional)</label>
        <input
          type="text"
          value={eventData.seatNumber || ''}
          onChange={(e) => onChange<TrainEvent>('seatNumber', e.target.value)}
          className="input"
          placeholder="Enter seat number"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Booking Reference (optional)</label>
        <input
          type="text"
          value={eventData.bookingReference || ''}
          onChange={(e) => onChange<TrainEvent>('bookingReference', e.target.value)}
          className="input"
          placeholder="Enter booking reference"
        />
      </div>
    </>
  );
};

export default TrainFields; 