const mongoose = require('mongoose');

const geocodingResultSchema = new mongoose.Schema({
  provider: { type: String, required: true, trim: true, default: 'nominatim' },
  query: { type: String, required: true, trim: true },
  normalizedQuery: { type: String, required: true, trim: true, lowercase: true, index: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  displayName: { type: String, trim: true },
  confidence: { type: Number, min: 0, max: 1, default: 0.7 },
  raw: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

geocodingResultSchema.index({ provider: 1, normalizedQuery: 1 }, { unique: true });

module.exports = mongoose.model('GeocodingResult', geocodingResultSchema);
