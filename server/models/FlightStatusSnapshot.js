const mongoose = require('mongoose');

const flightEndpointSchema = new mongoose.Schema({
  airportName: String,
  airportIata: String,
  airportIcao: String,
  scheduledLocal: String,
  scheduledUtc: String,
  revisedLocal: String,
  revisedUtc: String,
  actualLocal: String,
  actualUtc: String,
  terminal: String,
  gate: String,
  delayMinutes: Number
}, { _id: false });

const flightStatusSnapshotSchema = new mongoose.Schema({
  provider: { type: String, default: 'aerodatabox', index: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  eventId: { type: String, required: true, index: true },
  flightNumber: { type: String, required: true, index: true },
  dateLocal: { type: String, required: true },
  status: String,
  codeshareStatus: String,
  departure: flightEndpointSchema,
  arrival: flightEndpointSchema,
  aircraft: mongoose.Schema.Types.Mixed,
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  raw: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

flightStatusSnapshotSchema.index(
  { provider: 1, tripId: 1, eventId: 1, dateLocal: 1 },
  { unique: true }
);

module.exports = mongoose.model('FlightStatusSnapshot', flightStatusSnapshotSchema);
