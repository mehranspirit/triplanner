const mongoose = require('mongoose');

const jobLockSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  lockedUntil: { type: Date, required: true, index: true },
  owner: { type: String, required: true, trim: true },
  lastStartedAt: { type: Date },
  lastFinishedAt: { type: Date },
  lastStatus: { type: String, enum: ['running', 'success', 'failed'], default: 'running' },
  lastError: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('JobLock', jobLockSchema);
