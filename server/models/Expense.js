const mongoose = require('mongoose');

const splitDetailsSchema = new mongoose.Schema({
  equal: {
    splitCount: Number
  },
  percentage: {
    value: Number
  },
  shares: {
    value: Number,
    totalShares: Number
  },
  custom: {
    amount: Number
  }
}, { _id: false });

const expenseParticipantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  share: {
    type: Number,
    required: true,
    min: 0
  },
  splitDetails: {
    type: splitDetailsSchema,
    required: true
  },
  settled: {
    type: Boolean,
    default: false
  }
});

const expenseSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
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
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  splitMethod: {
    type: String,
    enum: ['equal', 'custom', 'percentage', 'shares'],
    required: true
  },
  participants: [expenseParticipantSchema],
  category: {
    type: String,
    trim: true
  },
  receipt: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
expenseSchema.index({ tripId: 1 });
expenseSchema.index({ paidBy: 1 });
expenseSchema.index({ date: 1 });

// Add a pre-save middleware to validate participant shares
expenseSchema.pre('save', function(next) {
  try {
    if (this.splitMethod === 'equal') {
      const share = this.amount / this.participants.length;
      this.participants.forEach(participant => {
        participant.share = share;
      });
    } else if (this.splitMethod === 'percentage') {
      const totalPercentage = this.participants.reduce((sum, p) => sum + (p.splitDetails.percentage?.value || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.1) {
        throw new Error('Total percentage must equal 100');
      }
      // Calculate actual shares based on percentages
      this.participants.forEach(participant => {
        const percentage = participant.splitDetails.percentage?.value || 0;
        participant.share = (this.amount * percentage) / 100;
      });
    } else if (this.splitMethod === 'shares') {
      const totalShares = this.participants.reduce((sum, p) => sum + (p.splitDetails.shares?.value || 0), 0);
      if (totalShares <= 0) {
        throw new Error('Total shares must be greater than 0');
      }
      // Calculate actual shares based on share ratio
      this.participants.forEach(participant => {
        const shareValue = participant.splitDetails.shares?.value || 0;
        participant.share = (this.amount * shareValue) / totalShares;
      });
    } else if (this.splitMethod === 'custom') {
      // For custom splits, validate that the sum equals the total amount
      const totalShare = this.participants.reduce((sum, p) => sum + (p.splitDetails.custom?.amount || 0), 0);
      if (Math.abs(totalShare - this.amount) > 0.01) {
        throw new Error('Total shares must equal the expense amount');
      }
      // Set the final share to the custom amount
      this.participants.forEach(participant => {
        participant.share = participant.splitDetails.custom?.amount || 0;
      });
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense; 