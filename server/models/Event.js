const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['arrival', 'departure', 'stay', 'destination', 'flight', 'train', 'rental_car', 'bus', 'activity']
  },
  title: String,  // For activity events
  activityType: String,  // For activity events
  date: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  notes: String,
  status: {
    type: String,
    enum: ['confirmed', 'exploring'],
    default: 'confirmed'
  },
  source: {
    type: String,
    enum: ['manual', 'google_places', 'google_flights', 'booking.com', 'airbnb', 'expedia', 'tripadvisor', 'other'],
    default: 'manual'
  },
  // Common fields for all events
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Fields for arrival/departure events
  time: String,
  airport: String,
  flightNumber: String,
  airline: String,
  terminal: String,
  gate: String,
  bookingReference: String,
  // Fields for stay events
  accommodationName: String,
  address: String,
  checkIn: String,
  checkOut: String,
  reservationNumber: String,
  contactInfo: String,
  // Fields for destination events
  placeName: String,
  description: String,
  openingHours: String,
  // Fields for flight events
  departureAirport: String,
  arrivalAirport: String,
  departureTime: String,
  arrivalTime: String,
  // Fields for train events
  trainNumber: String,
  trainOperator: String,
  departureStation: String,
  arrivalStation: String,
  carriageNumber: String,
  seatNumber: String,
  // Fields for rental car events
  carCompany: String,
  carType: String,
  pickupLocation: String,
  dropoffLocation: String,
  pickupTime: String,
  dropoffTime: String,
  dropoffDate: String,
  licensePlate: String,
  // Fields for bus events
  busNumber: String,
  busOperator: String
}, {
  timestamps: true
});

// Add indexes for common queries
eventSchema.index({ type: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ createdBy: 1 });

const Event = mongoose.model('Event', eventSchema);

module.exports = Event; 