const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  picture: String,
  googleId: String,
  stripeCustomerId: String,
  subscriptionStatus: { type: String, default: 'free' },
  trialStartDate: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
