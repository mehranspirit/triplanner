const mongoose = require('mongoose');

const travelImportSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sourceType: {
    type: String,
    enum: ['email_text', 'pdf_text', 'manual_text', 'image_text'],
    default: 'manual_text'
  },
  sourceHash: {
    type: String,
    trim: true
  },
  sourceTitle: {
    type: String,
    trim: true,
    maxlength: 140
  },
  sourceExcerpt: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['parsed', 'needs_review', 'missing_info', 'duplicate', 'failed', 'accepted', 'partially_accepted', 'dismissed', 'unsupported'],
    required: true,
    default: 'parsed'
  },
  duplicateOfImportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelImport'
  },
  model: {
    type: String,
    trim: true
  },
  parsedEvents: [{
    type: mongoose.Schema.Types.Mixed
  }],
  validationErrors: [{
    type: String,
    trim: true
  }],
  createdEventIds: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

travelImportSchema.index({ tripId: 1, createdAt: -1 });
travelImportSchema.index({ userId: 1, createdAt: -1 });
travelImportSchema.index({ sourceHash: 1, tripId: 1 });

module.exports = mongoose.model('TravelImport', travelImportSchema);
