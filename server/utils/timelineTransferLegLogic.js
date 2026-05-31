const { createTimelineTransferLegLogic, MIN_TRANSFER_DISTANCE_KM } = require('../../shared/timelineTransferLegLogic.cjs');
const {
  getEventStart,
  getEventEnd,
  isSameLocalDay,
} = require('./eventTime');

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const eachDayOfInterval = ({ start, end }) => {
  const days = [];
  const cursor = startOfDay(start);
  const rangeEnd = startOfDay(end);

  while (cursor <= rangeEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const MULTIDAY_EVENT_TYPES = new Set(['stay', 'rental_car']);

const parseTimelineDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getEventTimelineDateKeys = (event) => {
  const start = getEventStart(event);
  if (!start) return [];

  if (!MULTIDAY_EVENT_TYPES.has(event.type)) {
    return [formatDateKey(startOfDay(start))];
  }

  const end = getEventEnd(event);
  if (!end) {
    return [formatDateKey(startOfDay(start))];
  }

  const rangeStart = startOfDay(start <= end ? start : end);
  const rangeEnd = startOfDay(start <= end ? end : start);

  return eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map(
    (date) => formatDateKey(date),
  );
};

const eventOccursOnDayKey = (event, dayKey) => getEventTimelineDateKeys(event).includes(dayKey);

const getMultidayEventDayRole = (event, dayKey) => {
  if (!MULTIDAY_EVENT_TYPES.has(event.type)) return null;

  const keys = getEventTimelineDateKeys(event);
  if (!keys.includes(dayKey)) return null;
  if (keys.length === 1) return 'single';

  const startKey = keys[0];
  const endKey = keys[keys.length - 1];

  if (dayKey === startKey && dayKey === endKey) return 'single';
  if (dayKey === startKey) return 'start';
  if (dayKey === endKey) return 'end';
  return 'middle';
};

const groupEventsByTimelineDateKeys = (events) => (
  events.reduce((groups, event) => {
    getEventTimelineDateKeys(event).forEach((dateKey) => {
      if (!groups[dateKey]) groups[dateKey] = [];
      if (!groups[dateKey].some((existing) => existing.id === event.id)) {
        groups[dateKey].push(event);
      }
    });
    return groups;
  }, {})
);

const timelineTransferLegLogic = createTimelineTransferLegLogic({
  getEventStart,
  getEventEnd,
  isSameLocalDay,
  parseTimelineDateKey,
  startOfDay,
  getMultidayEventDayRole,
  eventOccursOnDayKey,
});

module.exports = {
  MIN_TRANSFER_DISTANCE_KM,
  groupEventsByTimelineDateKeys,
  getMultidayEventDayRole,
  getEventTimelineDateKeys,
  ...timelineTransferLegLogic,
};
