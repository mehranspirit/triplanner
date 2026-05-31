/**
 * Seed a comprehensive Pacific Northwest road-trip test dataset for UI testing.
 *
 * Run from project root:
 *   node server/scripts/seedPacificNorthwestTestTrip.js
 *
 * Options:
 *   --force   Replace an existing trip with the same name for this user
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const crypto = require('crypto');
const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const User = require('../models/User');

const USER_EMAIL = 'mehran.rajaian@gmail.com';
const TRIP_NAME = 'Pacific Northwest Road Trip (UI Test)';
const TRIP_START = '2026-05-25';
const TRIP_END = '2026-06-05';
const TIMEZONE = 'America/Los_Angeles';

const loc = (lat, lng, address) => ({
  lat,
  lng,
  address,
  quality: 'exact',
  source: 'manual',
  confidence: 1,
});

const SEA_AIRPORT = loc(47.4502, -122.3088, 'Seattle-Tacoma International Airport, WA');
const PDX_AIRPORT = loc(45.5898, -122.5951, 'Portland International Airport, OR');
const KING_ST_STATION = loc(47.5982, -122.3297, 'King Street Station, Seattle, WA');
const PORTLAND_UNION = loc(45.5288, -122.6765, 'Portland Union Station, OR');

const id = () => crypto.randomUUID();

const iso = (date, time) => `${date}T${time}:00`;

function buildEvents(userSnapshot, now) {
  const meta = () => ({
    createdBy: userSnapshot,
    updatedBy: userSnapshot,
    createdAt: now,
    updatedAt: now,
  });

  return [
    {
      id: id(),
      type: 'flight',
      status: 'confirmed',
      source: 'manual',
      airline: 'United Airlines',
      flightNumber: 'UA 784',
      departureAirport: 'SFO',
      arrivalAirport: 'SEA',
      terminal: '3',
      gate: 'F12',
      bookingReference: 'PNW2026',
      startDate: iso('2026-05-25', '07:00'),
      endDate: iso('2026-05-25', '09:35'),
      departureLocation: loc(37.6213, -122.3790, 'San Francisco International Airport, CA'),
      arrivalLocation: SEA_AIRPORT,
      notes: 'Window seat requested. First leg of the PNW road trip.',
      cost: 248,
      ...meta(),
    },
    {
      id: id(),
      type: 'arrival',
      status: 'confirmed',
      source: 'manual',
      airport: 'SEA',
      airline: 'United Airlines',
      flightNumber: 'UA 784',
      terminal: '3',
      gate: 'F12',
      date: '2026-05-25',
      time: '09:35',
      startDate: iso('2026-05-25', '09:35'),
      endDate: iso('2026-05-25', '09:35'),
      location: SEA_AIRPORT,
      notes: 'Land, collect bags, and head to the rental counter.',
      ...meta(),
    },
    {
      id: id(),
      type: 'rental_car',
      status: 'confirmed',
      source: 'manual',
      carCompany: 'National',
      carType: 'Mid-size SUV',
      pickupLocation: 'Seattle-Tacoma International Airport',
      dropoffLocation: 'Portland International Airport',
      date: '2026-05-25',
      pickupTime: '10:30',
      dropoffDate: '2026-06-05',
      dropoffTime: '13:00',
      startDate: iso('2026-05-25', '10:30'),
      endDate: iso('2026-06-05', '13:00'),
      departureLocation: SEA_AIRPORT,
      arrivalLocation: PDX_AIRPORT,
      bookingReference: 'NAT-44821',
      licensePlate: 'WA 7KP204',
      notes: 'Unlimited mileage. All-wheel drive for Olympic Peninsula loops.',
      cost: 689,
      ...meta(),
    },
    {
      id: id(),
      type: 'stay',
      status: 'confirmed',
      source: 'manual',
      accommodationName: 'The Edgewater Hotel',
      address: '2411 Alaskan Way, Seattle, WA 98121',
      checkIn: '2026-05-25',
      checkInTime: '15:00',
      checkOut: '2026-05-27',
      checkOutTime: '11:00',
      startDate: iso('2026-05-25', '15:00'),
      endDate: iso('2026-05-27', '11:00'),
      location: loc(47.6126, -122.3534, 'The Edgewater Hotel, Seattle, WA'),
      reservationNumber: 'EDGE-99201',
      contactInfo: '+1 (206) 728-7000',
      description: 'Waterfront stay near Pike Place Market.',
      cost: 418,
      ...meta(),
    },
    {
      id: id(),
      type: 'activity',
      status: 'confirmed',
      source: 'manual',
      title: 'Pike Place Market food walk',
      activityType: 'Food & Drink',
      startDate: '2026-05-25',
      startTime: '18:30',
      endDate: '2026-05-25',
      endTime: '21:00',
      location: loc(47.6095, -122.3425, 'Pike Place Market, Seattle, WA'),
      notes: 'Clam chowder, Rachel the pig, and sunset on the waterfront.',
      cost: 65,
      ...meta(),
    },
    {
      id: id(),
      type: 'destination',
      status: 'confirmed',
      source: 'manual',
      placeName: 'Space Needle & Seattle Center',
      startDate: '2026-05-26',
      startTime: '10:00',
      endDate: '2026-05-26',
      endTime: '12:30',
      location: loc(47.6205, -122.3493, 'Space Needle, Seattle, WA'),
      openingHours: 'Daily 10:00–21:00',
      description: 'Timed entry booked for the observation deck.',
      ...meta(),
    },
    {
      id: id(),
      type: 'activity',
      status: 'confirmed',
      source: 'manual',
      title: 'Kayak on Lake Union',
      activityType: 'Outdoors',
      startDate: '2026-05-26',
      startTime: '14:00',
      endDate: '2026-05-26',
      endTime: '16:30',
      location: loc(47.6301, -122.3322, 'Lake Union, Seattle, WA'),
      notes: 'Rent tandem kayaks near the Wooden Boat Center.',
      cost: 89,
      ...meta(),
    },
    {
      id: id(),
      type: 'destination',
      status: 'exploring',
      source: 'manual',
      placeName: 'San Juan Islands day ferry',
      startDate: '2026-05-26',
      startTime: '08:00',
      endDate: '2026-05-26',
      endTime: '20:00',
      location: loc(47.7987, -122.3965, 'Anacortes Ferry Terminal, WA'),
      description: 'Alternative day trip if weather is clear.',
      notes: 'Exploring option — compare with in-city plans.',
      ...meta(),
    },
    {
      id: id(),
      type: 'activity',
      status: 'confirmed',
      source: 'manual',
      title: 'Drive Seattle to Port Angeles',
      activityType: 'Driving',
      startDate: '2026-05-27',
      startTime: '08:30',
      endDate: '2026-05-27',
      endTime: '12:30',
      location: loc(48.1181, -123.4307, 'Port Angeles, WA'),
      notes: 'Take the Edmonds–Kingston ferry shortcut if queues are short.',
      ...meta(),
    },
    {
      id: id(),
      type: 'stay',
      status: 'confirmed',
      source: 'manual',
      accommodationName: 'Red Lion Hotel Port Angeles Harbor',
      address: '221 N Lincoln St, Port Angeles, WA 98362',
      checkIn: '2026-05-27',
      checkInTime: '16:00',
      checkOut: '2026-05-29',
      checkOutTime: '10:00',
      startDate: iso('2026-05-27', '16:00'),
      endDate: iso('2026-05-29', '10:00'),
      location: loc(48.1181, -123.4307, 'Red Lion Hotel Port Angeles Harbor, WA'),
      reservationNumber: 'RL-PA-4410',
      cost: 276,
      ...meta(),
    },
    {
      id: id(),
      type: 'destination',
      status: 'confirmed',
      source: 'manual',
      placeName: 'Hurricane Ridge',
      startDate: '2026-05-28',
      startTime: '09:00',
      endDate: '2026-05-28',
      endTime: '12:00',
      location: loc(48.0754, -123.7167, 'Hurricane Ridge, Olympic National Park, WA'),
      description: 'Alpine meadows and Strait of Juan de Fuca views.',
      ...meta(),
    },
    {
      id: id(),
      type: 'bus',
      status: 'confirmed',
      source: 'manual',
      busOperator: 'Clallam Transit',
      busNumber: '14',
      departureStation: 'Port Angeles Transit Center',
      arrivalStation: 'Forks Transit Center',
      departureDate: '2026-05-28',
      departureTime: '14:00',
      arrivalDate: '2026-05-28',
      arrivalTime: '15:30',
      startDate: iso('2026-05-28', '14:00'),
      endDate: iso('2026-05-28', '15:30'),
      departureLocation: loc(48.1181, -123.4307, 'Port Angeles Transit Center, WA'),
      arrivalLocation: loc(47.9509, -124.3855, 'Forks Transit Center, WA'),
      seatNumber: '12A',
      bookingReference: 'CLT-9021',
      cost: 18,
      notes: 'Scenic hop toward the Hoh Rain Forest.',
      ...meta(),
    },
    {
      id: id(),
      type: 'activity',
      status: 'confirmed',
      source: 'manual',
      title: 'Hoh Rain Forest walk',
      activityType: 'Hiking',
      startDate: '2026-05-28',
      startTime: '16:00',
      endDate: '2026-05-28',
      endTime: '18:30',
      location: loc(47.8593, -123.9354, 'Hoh Rain Forest Visitor Center, WA'),
      notes: 'Hall of Mosses + Spruce Nature Trail loop.',
      ...meta(),
    },
    {
      id: id(),
      type: 'train',
      status: 'confirmed',
      source: 'manual',
      trainOperator: 'Amtrak Cascades',
      trainNumber: '504',
      departureStation: 'Seattle King Street Station',
      arrivalStation: 'Portland Union Station',
      departureDate: '2026-05-29',
      departureTime: '11:40',
      arrivalDate: '2026-05-29',
      arrivalTime: '15:20',
      startDate: iso('2026-05-29', '11:40'),
      endDate: iso('2026-05-29', '15:20'),
      departureTime: '11:40',
      arrivalTime: '15:20',
      departureLocation: KING_ST_STATION,
      arrivalLocation: PORTLAND_UNION,
      carriageNumber: '4',
      seatNumber: '14C',
      bookingReference: 'AMT-77331',
      cost: 42,
      notes: 'Park the rental near the station; continue by car in Portland.',
      ...meta(),
    },
    {
      id: id(),
      type: 'stay',
      status: 'confirmed',
      source: 'manual',
      accommodationName: 'The Nines, a Luxury Collection Hotel',
      address: '525 SW Morrison St, Portland, OR 97204',
      checkIn: '2026-05-29',
      checkInTime: '17:00',
      checkOut: '2026-06-01',
      checkOutTime: '11:00',
      startDate: iso('2026-05-29', '17:00'),
      endDate: iso('2026-06-01', '11:00'),
      location: loc(45.5220, -122.6777, 'The Nines Hotel, Portland, OR'),
      reservationNumber: 'NINES-2201',
      cost: 512,
      ...meta(),
    },
    {
      id: id(),
      type: 'activity',
      status: 'confirmed',
      source: 'manual',
      title: 'Columbia River Gorge scenic drive',
      activityType: 'Driving',
      startDate: '2026-05-30',
      startTime: '08:30',
      endDate: '2026-05-30',
      endTime: '15:30',
      location: loc(45.5762, -122.1154, 'Columbia River Gorge, OR'),
      notes: 'Historic Columbia River Highway east from Portland.',
      ...meta(),
    },
    {
      id: id(),
      type: 'destination',
      status: 'confirmed',
      source: 'manual',
      placeName: 'Multnomah Falls',
      startDate: '2026-05-30',
      startTime: '10:30',
      endDate: '2026-05-30',
      endTime: '12:00',
      location: loc(45.5762, -122.1154, 'Multnomah Falls, OR'),
      openingHours: 'Visitor plaza open dawn–dusk',
      ...meta(),
    },
    {
      id: id(),
      type: 'destination',
      status: 'exploring',
      source: 'manual',
      placeName: 'Willamette Valley wine loop',
      startDate: '2026-05-31',
      startTime: '10:00',
      endDate: '2026-05-31',
      endTime: '17:00',
      location: loc(45.0462, -123.0228, 'Willamette Valley, OR'),
      description: 'Alternative to a city day — tasting rooms in Dundee Hills.',
      ...meta(),
    },
    {
      id: id(),
      type: 'activity',
      status: 'confirmed',
      source: 'manual',
      title: 'Powell\'s City of Books',
      activityType: 'Culture',
      startDate: '2026-05-31',
      startTime: '11:00',
      endDate: '2026-05-31',
      endTime: '13:30',
      location: loc(45.5232, -122.6816, 'Powell\'s Books, Portland, OR'),
      ...meta(),
    },
    {
      id: id(),
      type: 'stay',
      status: 'confirmed',
      source: 'manual',
      accommodationName: 'Surfsand Resort',
      address: '148 West Gower Ave, Cannon Beach, OR 97110',
      checkIn: '2026-06-01',
      checkInTime: '15:00',
      checkOut: '2026-06-03',
      checkOutTime: '11:00',
      startDate: iso('2026-06-01', '15:00'),
      endDate: iso('2026-06-03', '11:00'),
      location: loc(45.8910, -123.9615, 'Surfsand Resort, Cannon Beach, OR'),
      reservationNumber: 'SURF-1188',
      cost: 398,
      ...meta(),
    },
    {
      id: id(),
      type: 'destination',
      status: 'confirmed',
      source: 'manual',
      placeName: 'Haystack Rock',
      startDate: '2026-06-02',
      startTime: '07:30',
      endDate: '2026-06-02',
      endTime: '09:30',
      location: loc(45.8760, -123.9725, 'Haystack Rock, Cannon Beach, OR'),
      description: 'Low-tide walk and puffin spotting.',
      ...meta(),
    },
    {
      id: id(),
      type: 'activity',
      status: 'exploring',
      source: 'manual',
      title: 'Sunset bonfire on the beach',
      activityType: 'Relaxation',
      startDate: '2026-06-02',
      startTime: '19:00',
      endDate: '2026-06-02',
      endTime: '21:00',
      location: loc(45.8910, -123.9615, 'Cannon Beach, OR'),
      notes: 'Check local fire restrictions before committing.',
      ...meta(),
    },
    {
      id: id(),
      type: 'activity',
      status: 'confirmed',
      source: 'manual',
      title: 'Coastal drive to Portland',
      activityType: 'Driving',
      startDate: '2026-06-03',
      startTime: '09:00',
      endDate: '2026-06-03',
      endTime: '12:30',
      location: loc(45.5898, -122.5951, 'Portland, OR'),
      notes: 'US-26 inland or US-101 south then I-5 — long driving leg for timeline testing.',
      ...meta(),
    },
    {
      id: id(),
      type: 'destination',
      status: 'alternative',
      source: 'manual',
      placeName: 'Mount Hood Timberline Lodge',
      startDate: '2026-06-04',
      startTime: '09:00',
      endDate: '2026-06-04',
      endTime: '14:00',
      location: loc(45.3311, -121.7113, 'Timberline Lodge, Mount Hood, OR'),
      description: 'Optional alpine detour before the flight home.',
      ...meta(),
    },
    {
      id: id(),
      type: 'departure',
      status: 'confirmed',
      source: 'manual',
      airport: 'PDX',
      airline: 'Alaska Airlines',
      flightNumber: 'AS 812',
      terminal: 'B',
      gate: 'B7',
      date: '2026-06-05',
      time: '14:30',
      startDate: iso('2026-06-05', '14:30'),
      endDate: iso('2026-06-05', '14:30'),
      location: PDX_AIRPORT,
      notes: 'Return rental before entering security.',
      ...meta(),
    },
    {
      id: id(),
      type: 'flight',
      status: 'confirmed',
      source: 'manual',
      airline: 'Alaska Airlines',
      flightNumber: 'AS 812',
      departureAirport: 'PDX',
      arrivalAirport: 'SFO',
      terminal: 'B',
      gate: 'B7',
      bookingReference: 'PNWRET26',
      startDate: iso('2026-06-05', '16:15'),
      endDate: iso('2026-06-05', '18:05'),
      departureLocation: PDX_AIRPORT,
      arrivalLocation: loc(37.6213, -122.3790, 'San Francisco International Airport, CA'),
      cost: 198,
      notes: 'Nonstop home after the road trip loop.',
      ...meta(),
    },
  ];
}

async function main() {
  const force = process.argv.includes('--force');

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Check your .env file.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const user = await User.findOne({ email: USER_EMAIL });
  if (!user) {
    console.error(`User not found: ${USER_EMAIL}`);
    process.exit(1);
  }

  const existing = await Trip.findOne({ owner: user._id, name: TRIP_NAME });
  if (existing && !force) {
    console.error(`Trip already exists (${existing._id}). Re-run with --force to replace it.`);
    process.exit(1);
  }

  if (existing && force) {
    await Trip.deleteOne({ _id: existing._id });
    console.log(`Removed existing trip ${existing._id}`);
  }

  const now = new Date();
  const userSnapshot = {
    _id: user._id,
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl || undefined,
  };

  const events = buildEvents(userSnapshot, now);
  const exploringDestinations = events.filter(
    (event) => event.type === 'destination' && event.status === 'exploring',
  );

  const trip = new Trip({
    name: TRIP_NAME,
    description:
      'UI test road trip through Seattle, the Olympic Peninsula, Portland, and the Oregon coast. '
      + 'Includes every event type, multiday stays, transfer legs, and exploring options.',
    timezone: TIMEZONE,
    startDate: TRIP_START,
    endDate: TRIP_END,
    thumbnailUrl: '/images/thumbnails/destination.jpg',
    owner: user._id,
    collaborators: [],
    isPublic: false,
    events,
    decisions: exploringDestinations.length >= 2
      ? [{
        id: id(),
        title: 'Saturday day trip',
        slot: {
          date: '2026-05-26',
          startTime: '08:00',
          endTime: '20:00',
          label: 'Sat May 26',
        },
        optionEventIds: exploringDestinations.map((event) => event.id),
        status: 'open',
        createdBy: userSnapshot,
        createdAt: now,
      }]
      : [],
  });

  const saved = await trip.save();
  console.log(`Created trip "${saved.name}" (${saved._id})`);
  console.log(`  Owner: ${user.email}`);
  console.log(`  Dates: ${TRIP_START} → ${TRIP_END}`);
  console.log(`  Events: ${saved.events.length}`);
  console.log(`  Decisions: ${saved.decisions?.length ?? 0}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
