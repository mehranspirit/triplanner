const mongoose = require('mongoose');

const dreamTripSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  targetDate: {
    year: {
      type: Number,
      required: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    }
  },
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
      enum: ['viewer', 'editor'],
      default: 'viewer'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  ideas: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['transportation', 'accommodation', 'activities', 'arts-culture', 'food-drink', 'entertainment', 'places'],
      required: true
    },
    subCategory: {
      type: String,
      required: true
    },
    location: {
      name: {
        type: String,
        trim: true
      },
      lat: Number,
      lng: Number
    },
    sources: [{
      type: String,
      trim: true
    }],
    notes: {
      type: String,
      trim: true
    },
    priority: {
      type: Number,
      min: 1,
      max: 3,
      default: 2
    },
    images: [{
      url: {
        type: String,
        trim: true
      },
      caption: {
        type: String,
        trim: true
      }
    }],
    position: {
      x: {
        type: Number,
        default: 0
      },
      y: {
        type: Number,
        default: 0
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  thumbnailUrl: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
dreamTripSchema.index({ owner: 1 });
dreamTripSchema.index({ 'collaborators.user': 1 });
dreamTripSchema.index({ tags: 1 });
dreamTripSchema.index({ isPublic: 1 });

// Virtual for getting the total number of ideas
dreamTripSchema.virtual('ideaCount').get(function() {
  return this.ideas.length;
});

// Method to check if a user has access to this dream trip
dreamTripSchema.methods.hasAccess = function(userId) {
  return this.owner.toString() === userId.toString() ||
    this.collaborators.some(c => c.user.toString() === userId.toString());
};

// Method to check if a user can edit this dream trip
dreamTripSchema.methods.canEdit = function(userId) {
  return this.owner.toString() === userId.toString() ||
    this.collaborators.some(c => 
      c.user.toString() === userId.toString() && c.role === 'editor'
    );
};

const DreamTrip = mongoose.model('DreamTrip', dreamTripSchema);

module.exports = DreamTrip; 