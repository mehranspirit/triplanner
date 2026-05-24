import React from 'react';
import { Event, EventType } from '@/types/eventTypes';
import ActivityFormModal from './EventFormModals/ActivityFormModal';
import ArrivalFormModal from './EventFormModals/ArrivalFormModal';
import BusFormModal from './EventFormModals/BusFormModal';
import DepartureFormModal from './EventFormModals/DepartureFormModal';
import DestinationFormModal from './EventFormModals/DestinationFormModal';
import FlightFormModal from './EventFormModals/FlightFormModal';
import RentalCarFormModal from './EventFormModals/RentalCarFormModal';
import StayFormModal from './EventFormModals/StayFormModal';
import TrainFormModal from './EventFormModals/TrainFormModal';

interface EventFormModalRouterProps {
  modalType: EventType | null;
  editingEvent: Event | null;
  onClose: () => void;
  onSave: (event: any) => void | Promise<void>;
}

const EventFormModalRouter: React.FC<EventFormModalRouterProps> = ({
  modalType,
  editingEvent,
  onClose,
  onSave,
}) => {
  const commonProps = {
    isOpen: Boolean(modalType),
    onClose,
    onSave,
    eventToEdit: editingEvent as any,
  };

  switch (modalType) {
    case 'arrival':
      return <ArrivalFormModal {...commonProps} />;
    case 'stay':
      return <StayFormModal {...commonProps} />;
    case 'rental_car':
      return <RentalCarFormModal {...commonProps} />;
    case 'flight':
      return <FlightFormModal {...commonProps} />;
    case 'activity':
      return <ActivityFormModal {...commonProps} />;
    case 'bus':
      return <BusFormModal {...commonProps} />;
    case 'train':
      return <TrainFormModal {...commonProps} />;
    case 'destination':
      return <DestinationFormModal {...commonProps} />;
    case 'departure':
      return <DepartureFormModal {...commonProps} />;
    default:
      return null;
  }
};

export default EventFormModalRouter;
