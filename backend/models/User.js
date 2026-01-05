const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: String,
  picture: String,
  authProvider: { type: String, enum: ['google', 'email'], default: 'email' },
  subscriptionStatus: { type: String, enum: ['free', 'trial', 'paid'], default: 'free' },
  isPremium: { type: Boolean, default: false },
  trialStartDate: Date,
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date,
  loginCount: { type: Number, default: 0 },
  lastSyncDate: Date,
  totalScans: { type: Number, default: 0 },
  totalJobsAnalyzed: { type: Number, default: 0 },
  activityLog: [
    {
      action: String,
      timestamp: { type: Date, default: Date.now },
      details: mongoose.Schema.Types.Mixed
    }
  ]
});

module.exports = mongoose.model('User', userSchema);
