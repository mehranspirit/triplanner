const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  inAppEnabled: { type: Boolean, default: true },
  disabledTypes: [{
    type: String,
    enum: ['insight', 'reminder', 'prep', 'sync', 'system']
  }]
}, { timestamps: true });

notificationPreferenceSchema.index({ userId: 1, tripId: 1 }, { unique: true });

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
