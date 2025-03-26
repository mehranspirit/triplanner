import React from 'react';
import { DestinationEvent } from '@/types';

interface DestinationFieldsProps {
  eventData: Partial<DestinationEvent>;
  onChange: <T extends DestinationEvent>(field: keyof T, value: string) => void;
}

const DestinationFields: React.FC<DestinationFieldsProps> = ({
  eventData,
  onChange
}) => {
  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Place Name *</label>
          <input
            type="text"
            value={eventData.placeName}
            onChange={(e) => onChange('placeName', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter place name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Address</label>
          <input
            type="text"
            value={eventData.address || ''}
            onChange={(e) => onChange('address', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter address"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={eventData.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            rows={3}
            placeholder="Enter description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Opening Hours</label>
          <input
            type="text"
            value={eventData.openingHours || ''}
            onChange={(e) => onChange('openingHours', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter opening hours"
          />
        </div>
      </div>
    </>
  );
};

export default DestinationFields; 