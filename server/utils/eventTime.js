const DEFAULT_TIME = '00:00';

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const parseEventDateTime = (dateValue, timeValue) => {
  if (!dateValue) return null;
  const normalized = String(dateValue).includes('T')
    ? dateValue
    : `${dateValue}T${timeValue || DEFAULT_TIME}:00`;
  const date = new Date(normalized);
  return isValidDate(date) ? date : null;
};

const getEventStart = (event) => {
  switch (event.type) {
    case 'arrival':
    case 'departure':
      return parseEventDateTime(event.date || event.startDate, event.time);
    case 'stay':
      return parseEventDateTime(event.checkIn || event.startDate, event.checkInTime);
    case 'rental_car':
      return parseEventDateTime(event.date || event.startDate, event.pickupTime);
    case 'flight':
    case 'train':
    case 'bus':
      return parseEventDateTime(event.startDate || event.departureDate, event.departureTime);
    case 'activity':
    case 'destination':
      return parseEventDateTime(event.startDate, event.startTime);
    default:
      return parseEventDateTime(event.startDate);
  }
};

const getEventEnd = (event) => {
  switch (event.type) {
    case 'arrival':
    case 'departure':
      return parseEventDateTime(event.date || event.endDate || event.startDate, event.time);
    case 'stay':
      return parseEventDateTime(event.checkOut || event.endDate, event.checkOutTime);
    case 'rental_car':
      return parseEventDateTime(event.dropoffDate || event.endDate, event.dropoffTime);
    case 'flight':
    case 'train':
    case 'bus':
      return parseEventDateTime(event.endDate || event.arrivalDate, event.arrivalTime);
    case 'activity':
    case 'destination':
      return parseEventDateTime(event.endDate || event.startDate, event.endTime);
    default:
      return parseEventDateTime(event.endDate || event.startDate);
  }
};

const sortEventsByStart = (events) => [...events].sort((left, right) => {
  const startA = getEventStart(left)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const startB = getEventStart(right)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return startA - startB;
});

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameLocalDay = (left, right) => getDateKey(left) === getDateKey(right);

module.exports = {
  getEventStart,
  getEventEnd,
  sortEventsByStart,
  getDateKey,
  isSameLocalDay,
};
