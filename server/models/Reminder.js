const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  eventId: { type: String, trim: true },
  insightId: { type: String, trim: true },
  type: {
    type: String,
    enum: ['event_upcoming', 'prep_due', 'missing_info', 'transport_gap', 'custom'],
    required: true
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  scheduledFor: { type: Date, required: true, index: true },
  sentAt: { type: Date },
  dismissedAt: { type: Date },
  dedupeKey: { type: String, required: true, trim: true, index: true }
}, { timestamps: true });

reminderSchema.index({ userId: 1, tripId: 1, dedupeKey: 1 }, { unique: true });
reminderSchema.index({ scheduledFor: 1, sentAt: 1, dismissedAt: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
