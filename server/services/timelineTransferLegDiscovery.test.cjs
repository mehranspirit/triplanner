const test = require('node:test');
const assert = require('node:assert/strict');
const { sortEventsByStart } = require('../utils/eventTime');
const {
  shouldSkipInboundTimelineLeg,
  resolvePreviousTimelineEvent,
  getTimelineDayLegTimes,
  groupEventsByTimelineDateKeys,
  getMultidayEventDayRole,
} = require('../utils/timelineTransferLegLogic');
const { __test: discoveryTest } = require('./timelineTransferLegDiscovery');

const makeActivity = (id, startDate, endDate, lat, lng) => ({
  id,
  type: 'activity',
  status: 'confirmed',
  title: id,
  startDate,
  endDate,
  location: { lat, lng, address: `${id} address` },
});

const makeStay = (id, checkIn, checkOut, lat, lng) => ({
  id,
  type: 'stay',
  status: 'confirmed',
  accommodationName: 'Hotel Example',
  checkIn,
  checkInTime: '15:00',
  checkOut,
  checkOutTime: '11:00',
  location: { lat, lng, address: 'Hotel address' },
});

const makeFlight = (id, startDate, endDate, arrivalLat, arrivalLng) => ({
  id,
  type: 'flight',
  status: 'confirmed',
  airline: 'Example Air',
  flightNumber: 'EX123',
  departureAirport: 'JFK',
  arrivalAirport: 'LAX',
  startDate,
  endDate,
  departureTime: '08:00',
  arrivalTime: '11:00',
  arrivalLocation: {
    lat: arrivalLat,
    lng: arrivalLng,
    address: 'LAX',
  },
  departureLocation: {
    lat: 40.6413,
    lng: -73.7781,
    address: 'JFK',
  },
});

const resolveFirstLegOnDay = (events, dayKey) => {
  const itineraryEvents = events.filter((event) => event.status !== 'alternative');
  const sortedEvents = sortEventsByStart(itineraryEvents);
  const grouped = groupEventsByTimelineDateKeys(itineraryEvents);
  const dayEvents = grouped[dayKey] || [];

  if (dayEvents.length === 0) return null;

  return resolvePreviousTimelineEvent(
    sortedEvents,
    sortEventsByStart(dayEvents),
    0,
    sortEventsByStart(dayEvents)[0],
    dayKey,
  );
};

test('shouldSkipInboundTimelineLeg skips middle and checkout stay days', () => {
  const stay = makeStay('stay-1', '2026-06-01', '2026-06-04', 40.7128, -74.006);

  assert.equal(getMultidayEventDayRole(stay, '2026-06-02'), 'middle');
  assert.equal(shouldSkipInboundTimelineLeg(stay, '2026-06-02'), true);
  assert.equal(shouldSkipInboundTimelineLeg(stay, '2026-06-04'), true);
  assert.equal(shouldSkipInboundTimelineLeg(stay, '2026-06-01'), false);
});

test('getTimelineDayLegTimes marks middle-day hotel departures as flexible', () => {
  const stay = makeStay('stay-1', '2026-06-01', '2026-06-04', 40.7128, -74.006);
  const activity = makeActivity(
    'museum',
    '2026-06-02T11:00:00',
    '2026-06-02T13:00:00',
    40.758,
    -73.9855,
  );

  const legTimes = getTimelineDayLegTimes(stay, activity, '2026-06-02');
  assert.ok(legTimes);
  assert.equal(legTimes.flexibleDeparture, true);
});

test('resolvePreviousTimelineEvent skips inbound legs to middle stay days', () => {
  const priorActivity = makeActivity(
    'dinner',
    '2026-06-01T19:00:00',
    '2026-06-01T21:00:00',
    40.7128,
    -74.006,
  );
  const stay = makeStay('stay-1', '2026-06-01', '2026-06-04', 40.758, -73.9855);

  assert.equal(resolveFirstLegOnDay([priorActivity, stay], '2026-06-02'), null);
  assert.equal(resolveFirstLegOnDay([priorActivity, stay], '2026-06-04'), null);
});

test('resolvePreviousTimelineEvent bridges sparse check-in days', () => {
  const priorStay = makeStay('stay-old', '2026-05-30', '2026-06-01', 40.7128, -74.006);
  const checkIn = makeStay('stay-new', '2026-06-03', '2026-06-06', 40.758, -73.9855);

  const resolved = resolveFirstLegOnDay([priorStay, checkIn], '2026-06-03');
  assert.ok(resolved);
  assert.equal(resolved.previousEvent.id, 'stay-old');
});

test('resolvePreviousTimelineEvent bridges sparse flight days', () => {
  const priorActivity = makeActivity(
    'dinner',
    '2026-06-01T19:00:00',
    '2026-06-01T21:00:00',
    40.7128,
    -74.006,
  );
  const flight = makeFlight(
    'outbound',
    '2026-06-03T09:00:00',
    '2026-06-03T12:00:00',
    33.9416,
    -118.4085,
  );

  const resolved = resolveFirstLegOnDay([priorActivity, flight], '2026-06-03');
  assert.ok(resolved);
  assert.equal(resolved.previousEvent.id, 'dinner');
});

test('resolvePreviousTimelineEvent bridges checkout stay to rental drop-off', () => {
  const stay = {
    ...makeStay('stay-1', '2026-06-24', '2026-06-26', 10.4312, -84.7043),
    checkOutTime: '12:00',
  };
  const rental = {
    id: 'rental-1',
    type: 'rental_car',
    status: 'confirmed',
    date: '2026-06-17',
    pickupTime: '10:00',
    dropoffDate: '2026-06-27',
    dropoffTime: '09:00',
    location: { lat: 10.4312, lng: -84.7043, address: 'Pickup' },
    departureLocation: { lat: 10.4312, lng: -84.7043, address: 'Pickup' },
    arrivalLocation: { lat: 9.9939, lng: -84.2088, address: 'SJO' },
  };
  const flight = makeFlight(
    'flight-1',
    '2026-06-27T08:45:00',
    '2026-06-27T14:30:00',
    37.6213,
    -122.3790,
  );
  flight.departureTime = '08:45';
  flight.departureLocation = { lat: 9.9939, lng: -84.2088, address: 'SJO' };

  const resolved = resolveFirstLegOnDay([stay, rental, flight], '2026-06-27');
  assert.ok(resolved);
  assert.equal(resolved.previousEvent.id, 'stay-1');
});

test('getTimelineDayLegTimes handles checkout stay to pre-checkout activity', () => {
  const stay = makeStay('stay-1', '2026-06-18', '2026-06-21', 9.3919, -84.1420);
  const activity = makeActivity(
    'tour',
    '2026-06-21T09:00:00',
    '2026-06-21T11:30:00',
    9.4123,
    -84.1550,
  );

  const legTimes = getTimelineDayLegTimes(stay, activity, '2026-06-21');
  assert.ok(legTimes);
  assert.equal(legTimes.flexibleDeparture, true);
});

test('getDistanceKm filters short hops', () => {
  const nearA = { lat: 40.7128, lng: -74.006 };
  const nearB = { lat: 40.7138, lng: -74.005 };
  assert.ok(discoveryTest.getDistanceKm(nearA, nearB) < 2);
});
