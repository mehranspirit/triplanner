import React from 'react';
import { DestinationEvent } from '../../../../types';

interface DestinationFieldsProps {
  eventData: Partial<DestinationEvent>;
  onChange: (field: keyof DestinationEvent, value: string) => void;
}

const DestinationFields: React.FC<DestinationFieldsProps> = ({ eventData, onChange }) => {
  return (
    <>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Place Name</label>
        <input
          type="text"
          value={eventData.placeName || ''}
          onChange={(e) => onChange('placeName', e.target.value)}
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
        <label className="block text-gray-700 mb-2">Description (optional)</label>
        <textarea
          value={eventData.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          className="input"
          placeholder="Enter description"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Opening Hours (optional)</label>
        <input
          type="text"
          value={eventData.openingHours || ''}
          onChange={(e) => onChange('openingHours', e.target.value)}
          className="input"
          placeholder="Enter opening hours"
        />
      </div>
    </>
  );
};

export default DestinationFields; 