const mongoose = require('mongoose');

const locationPointSchema = {
  lat: Number,
  lng: Number,
  address: String,
  quality: {
    type: String,
    enum: ['exact', 'inferred', 'unresolved', 'missing'],
    default: undefined,
  },
  source: {
    type: String,
    enum: ['manual', 'geocoded', 'imported', 'unknown', 'google_places'],
    default: undefined,
  },
  query: String,
  confidence: Number,
  placeId: String,
  confirmedAt: String,
  confirmedBy: String,
};

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
  location: locationPointSchema,
  departureLocation: locationPointSchema,
  arrivalLocation: locationPointSchema,
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

const ChecklistItemSchema = new mongoose.Schema({
  id: String,
  text: String,
  completed: Boolean,
}, { _id: false });

const ChecklistBinSchema = new mongoose.Schema({
  id: String,
  title: String,
  items: [ChecklistItemSchema],
}, { _id: false });

const tripSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  description: String,
  timezone: {
    type: String,
    trim: true,
    default: undefined
  },
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
  },
  checklistShared: [ChecklistBinSchema],
  checklistPersonal: {
    type: Map,
    of: [ChecklistBinSchema],
    default: {},
  },
  healthDismissals: [{
    issueKey: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'intentional_rest_day',
        'planning_deferred',
        'day_trip',
        'red_eye',
        'alternate_lodging',
        'overnight_transport',
        'connection_ok',
        'ad_hoc_ground_transport',
        'location_optional',
        'booking_not_required',
        'other',
      ],
    },
    note: String,
    dismissedAt: {
      type: Date,
      default: Date.now,
    },
    dismissedBy: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: String,
      email: String,
      photoUrl: String,
    },
    reopenBeforeTripDays: Number,
  }],
  decisions: [{
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slot: {
      date: String,
      endDate: String,
      startTime: String,
      endTime: String,
      label: String,
    },
    optionEventIds: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['open', 'decided', 'deferred'],
      default: 'open',
    },
    winnerEventId: String,
    decidedAt: Date,
    decidedBy: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: String,
      email: String,
      photoUrl: String,
    },
    createdBy: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: String,
      email: String,
      photoUrl: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    comparisonOverview: {
      generatedAt: Date,
      generatedBy: {
        type: String,
        enum: ['ai', 'deterministic'],
      },
      model: String,
      stale: {
        type: Boolean,
        default: false,
      },
      summary: String,
      context: {
        comparisonType: String,
        slotLabel: String,
        referenceLabel: String,
        referenceDescription: String,
        staticMapUrl: String,
      },
      dimensions: [{
        key: String,
        label: String,
        values: [{
          eventId: String,
          display: String,
          highlight: {
            type: String,
            enum: ['best', 'worst', 'neutral'],
          },
        }],
      }],
      optionSummaries: [{
        eventId: String,
        bestFor: [String],
        watchOuts: [String],
        oneLiner: String,
      }],
      tradeoffs: [String],
      missingInfo: [String],
      softRecommendation: {
        eventId: String,
        label: String,
        reason: String,
        confidence: {
          type: String,
          enum: ['low', 'medium', 'high'],
        },
        caveats: [String],
      },
    },
  }],
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