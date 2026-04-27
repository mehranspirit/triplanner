const mongoose = require('mongoose');

const weatherDaySchema = new mongoose.Schema({
  date: { type: String, required: true },
  weatherCode: Number,
  condition: String,
  precipitationProbabilityMax: Number,
  precipitationSum: Number,
  temperatureMin: Number,
  temperatureMax: Number,
  windSpeedMax: Number
}, { _id: false });

const weatherSnapshotSchema = new mongoose.Schema({
  provider: { type: String, default: 'open-meteo', index: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  eventId: { type: String, required: true },
  originalEventId: { type: String, index: true },
  eventType: String,
  eventName: String,
  locationRole: {
    type: String,
    enum: ['event', 'departure', 'arrival'],
    default: 'event'
  },
  date: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  locationName: String,
  timezone: String,
  daily: [weatherDaySchema],
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  raw: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

weatherSnapshotSchema.index(
  { provider: 1, tripId: 1, eventId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model('WeatherSnapshot', weatherSnapshotSchema);
