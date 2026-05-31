const mongoose = require('mongoose');

const timelineTransferLegSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  fromEventId: { type: String, required: true },
  toEventId: { type: String, required: true },
  dayKey: { type: String, required: true },
  locationKey: { type: String, required: true },
  originLat: { type: Number, required: true },
  originLng: { type: Number, required: true },
  destinationLat: { type: Number, required: true },
  destinationLng: { type: Number, required: true },
  driveDistanceMeters: Number,
  driveDurationSeconds: Number,
  driveDistanceLabel: String,
  driveDurationLabel: String,
  status: {
    type: String,
    enum: ['ok', 'unavailable'],
    default: 'unavailable',
  },
  provider: { type: String, default: 'google_distance_matrix' },
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
}, {
  timestamps: true,
});

timelineTransferLegSchema.index(
  { tripId: 1, fromEventId: 1, toEventId: 1, dayKey: 1, locationKey: 1 },
  { unique: true },
);

module.exports = mongoose.model('TimelineTransferLeg', timelineTransferLegSchema);
