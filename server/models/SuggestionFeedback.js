const mongoose = require('mongoose');

const suggestionFeedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  suggestionId: { type: String, required: true },
  suggestionType: {
    type: String,
    enum: ['assistant_checklist_item', 'assistant_action', 'assistant_backup_event'],
    required: true
  },
  status: {
    type: String,
    enum: ['accepted', 'dismissed'],
    required: true
  },
  scope: {
    type: String,
    enum: ['shared', 'personal'],
    default: 'personal'
  },
  title: String,
  reason: String,
  payload: mongoose.Schema.Types.Mixed,
  acceptedAt: Date,
  dismissedAt: Date
}, { timestamps: true });

suggestionFeedbackSchema.index(
  { userId: 1, tripId: 1, suggestionId: 1 },
  { unique: true }
);

module.exports = mongoose.model('SuggestionFeedback', suggestionFeedbackSchema);
