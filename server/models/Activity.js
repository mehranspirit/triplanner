const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ActivitySchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trip: {
    type: Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  event: {
    type: String,
    required: false
  },
  actionType: {
    type: String,
    enum: ['trip_create', 'trip_update', 'trip_delete', 'event_create', 'event_update', 'event_delete', 'collaborator_add', 'collaborator_remove', 'collaborator_role_change'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  details: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for faster queries
ActivitySchema.index({ user: 1, createdAt: -1 });
ActivitySchema.index({ trip: 1, createdAt: -1 });

const Activity = mongoose.model('Activity', ActivitySchema);

module.exports = Activity; 