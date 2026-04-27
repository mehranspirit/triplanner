const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', index: true },
  eventId: { type: String, trim: true },
  dedupeKey: { type: String, required: true, trim: true, index: true },
  type: {
    type: String,
    enum: ['insight', 'reminder', 'prep', 'sync', 'system'],
    required: true,
    default: 'insight'
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    required: true,
    default: 'info'
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  actionLabel: { type: String, trim: true },
  actionTarget: {
    type: String,
    enum: ['trip', 'event', 'checklist', 'expenses', 'today', 'ai_import', 'add_event'],
    default: 'trip'
  },
  scheduledFor: { type: Date },
  readAt: { type: Date },
  dismissedAt: { type: Date }
}, { timestamps: true });

notificationSchema.index({ userId: 1, tripId: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ userId: 1, readAt: 1, dismissedAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
