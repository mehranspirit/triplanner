const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  id: String,
  type: {
    type: String,
    enum: ['arrival', 'stay', 'destination', 'departure', 'flight', 'train', 'rental_car', 'bus', 'activity'],
    required: true
  },
  // Activity fields
  title: String,
  activityType: String,
  thumbnailUrl: String,
  date: String,
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  notes: String,
  status: {
    type: String,
    enum: ['confirmed', 'exploring', 'alternative'],
    default: 'confirmed'
  },
  likes: [String], // User IDs of users who liked this event
  dislikes: [String], // User IDs of users who disliked this event
  source: String,
  // Shared fields used by multiple event types (stay, destination, activity)
  address: String,
  description: String,
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
  checkIn: String,
  checkInTime: String, // HH:mm format
  checkOut: String,
  checkOutTime: String, // HH:mm format
  reservationNumber: String,
  contactInfo: String,
  // Destination fields
  placeName: String,
  openingHours: String,
  // Flight fields
  departureAirport: String,
  arrivalAirport: String,
  departureTime: String,
  arrivalTime: String,
  terminal: String,
  gate: String,
  bookingReference: String,
  cost: { type: Number, default: undefined },
  // Train fields
  trainOperator: String,
  trainNumber: String,
  departureStation: String,
  arrivalStation: String,
  carriageNumber: String,
  seatNumber: String,
  bookingReference: String,
  cost: { type: Number, default: undefined },
  // Rental Car fields
  carCompany: String,
  carType: String,
  pickupLocation: String,
  dropoffLocation: String,
  pickupTime: String,
  dropoffTime: String,
  dropoffDate: String,
  licensePlate: String,
  cost: { type: Number, default: undefined },
  // Bus fields
  busOperator: String,
  busNumber: String,
  departureStation: String,
  arrivalStation: String,
  departureDate: String,
  arrivalDate: String,
  departureTime: String,
  arrivalTime: String,
  seatNumber: String,
  bookingReference: String,
  cost: { type: Number, default: undefined },
  // Creator and modifier information
  createdBy: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    email: String,
    photoUrl: String
  },
  updatedBy: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    email: String,
    photoUrl: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  },
  // Activity fields
  startDate: String, // YYYY-MM-DD
  startTime: String, // HH:mm
  endDate: String,   // YYYY-MM-DD
  endTime: String,   // HH:mm
  cost: { type: Number, default: undefined },
});

const noteEditSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  user: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: String,
    email: String,
    photoUrl: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const tripNoteSchema = new mongoose.Schema({
  content: {
    type: String,
    default: ''
  },
  edits: [noteEditSchema],
  lastEditedBy: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    email: String,
    photoUrl: String
  },
  lastEditedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const tripSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  description: String,
  note: tripNoteSchema,
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
          email: ret.owner.email,
          photoUrl: ret.owner.photoUrl
        };
      }
      if (ret.collaborators) {
        ret.collaborators = ret.collaborators.map(c => ({
          ...c,
          user: {
            _id: c.user._id,
            name: c.user.name,
            email: c.user.email,
            photoUrl: c.user.photoUrl
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