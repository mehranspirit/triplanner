const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  id: String,
  type: {
    type: String,
    enum: ['arrival', 'stays', 'destinations', 'departure'],
    required: true
  },
  thumbnailUrl: String,
  date: String,
  location: String,
  notes: String,
  // Arrival/Departure fields
  flightNumber: String,
  airline: String,
  time: String,
  airport: String,
  terminal: String,
  gate: String,
  bookingReference: String,
  // Stays fields
  accommodationName: String,
  address: String,
  checkIn: String,
  checkOut: String,
  reservationNumber: String,
  contactInfo: String,
  // Destinations fields
  placeName: String,
  description: String,
  openingHours: String
});

const tripSchema = new mongoose.Schema({
  id: String,
  name: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  notes: String,
  events: [eventSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Trip', tripSchema); 