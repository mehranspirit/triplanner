const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  method: {
    type: String,
    enum: ['cash', 'bank_transfer', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
settlementSchema.index({ tripId: 1 });
settlementSchema.index({ fromUserId: 1 });
settlementSchema.index({ toUserId: 1 });
settlementSchema.index({ status: 1 });
settlementSchema.index({ date: 1 });

// Add a compound index for unique settlements
settlementSchema.index({ tripId: 1, fromUserId: 1, toUserId: 1, date: 1 }, { unique: true });

// Add a pre-save middleware to validate the settlement
settlementSchema.pre('save', function(next) {
  if (this.fromUserId.toString() === this.toUserId.toString()) {
    next(new Error('Cannot settle with yourself'));
    return;
  }
  next();
});

const Settlement = mongoose.model('Settlement', settlementSchema);

module.exports = Settlement; 