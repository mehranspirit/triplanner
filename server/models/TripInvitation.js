const mongoose = require('mongoose');

const tripInvitationSchema = new mongoose.Schema({
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  role: {
    type: String,
    enum: ['editor', 'viewer'],
    default: 'viewer',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  revokedAt: Date,
  expiresAt: {
    type: Date,
    required: true
  },
  acceptedUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acceptedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

tripInvitationSchema.index({ trip: 1, role: 1, status: 1 });

module.exports = mongoose.model('TripInvitation', tripInvitationSchema);
