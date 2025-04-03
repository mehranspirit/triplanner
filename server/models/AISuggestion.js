const mongoose = require('mongoose');

const aiSuggestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  places: [{
    type: String,
    required: true
  }],
  activities: [{
    type: String,
    required: true
  }],
  suggestions: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AISuggestion', aiSuggestionSchema); 