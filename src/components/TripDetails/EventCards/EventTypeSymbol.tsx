import React from 'react';
import {
  FaBus,
  FaCar,
  FaHotel,
  FaMapMarkerAlt,
  FaMountain,
  FaPlane,
  FaTrain,
} from 'react-icons/fa';
import { Event } from '@/types/eventTypes';
import { cn } from '@/lib/utils';

interface EventTypeSymbolProps {
  event: Event;
  className?: string;
  iconClassName?: string;
}

const EventTypeSymbol: React.FC<EventTypeSymbolProps> = ({
  event,
  className,
  iconClassName = 'h-3.5 w-3.5',
}) => {
  const base = cn(iconClassName);

  let icon: React.ReactNode;
  switch (event.type) {
    case 'flight':
      icon = <FaPlane className={cn(base, 'text-sky-600')} />;
      break;
    case 'arrival':
      icon = <FaPlane className={cn(base, 'rotate-45 text-sky-600')} />;
      break;
    case 'departure':
      icon = <FaPlane className={cn(base, '-rotate-45 text-sky-600')} />;
      break;
    case 'train':
      icon = <FaTrain className={cn(base, 'text-slate-600')} />;
      break;
    case 'bus':
      icon = <FaBus className={cn(base, 'text-slate-600')} />;
      break;
    case 'rental_car':
      icon = <FaCar className={cn(base, 'text-orange-600')} />;
      break;
    case 'stay':
      icon = <FaHotel className={cn(base, 'text-amber-600')} />;
      break;
    case 'destination':
      icon = <FaMapMarkerAlt className={cn(base, 'text-emerald-600')} />;
      break;
    case 'activity':
      icon = <FaMountain className={cn(base, 'text-indigo-600')} />;
      break;
    default:
      icon = <FaMapMarkerAlt className={cn(base, 'text-slate-500')} />;
  }

  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', className)}>
      {icon}
    </span>
  );
};

export default EventTypeSymbol;
