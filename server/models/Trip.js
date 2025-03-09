const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  id: String,
  type: {
    type: String,
    enum: ['arrival', 'stay', 'destination', 'departure'],
    required: true
  },
  thumbnailUrl: String,
  date: String,
  location: String,
  notes: String,
  // Arrival/Departure fields
  flightNumber: String,
  airline: String,
  time: String,
  airport: String,
  terminal: String,
  gate: String,
  bookingReference: String,
  // Stay fields
  accommodationName: String,
  address: String,
  checkIn: String,
  checkOut: String,
  reservationNumber: String,
  contactInfo: String,
  // Destination fields
  placeName: String,
  description: String,
  openingHours: String
});

const tripSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  notes: String,
  events: [eventSchema],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['editor', 'viewer'],
      default: 'viewer'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  shareableLink: {
    type: String,
    sparse: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret._id = ret._id;
      delete ret.__v;
      if (ret.owner) {
        ret.owner = {
          _id: ret.owner._id,
          name: ret.owner.name,
          email: ret.owner.email
        };
      }
      if (ret.collaborators) {
        ret.collaborators = ret.collaborators.map(c => ({
          ...c,
          user: {
            _id: c.user._id,
            name: c.user.name,
            email: c.user.email
          }
        }));
      }
    }
  }
});

// Method to check if a user has access to this trip
tripSchema.methods.hasAccess = function(userId) {
  if (this.owner.equals(userId)) return 'owner';
  const collaborator = this.collaborators.find(c => c.user.equals(userId));
  return collaborator ? collaborator.role : (this.isPublic ? 'viewer' : null);
};

module.exports = mongoose.model('Trip', tripSchema); 