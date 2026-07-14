const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    set(value) {
      this.setDataValue('email', value.toLowerCase());
    }
  },
  name: DataTypes.STRING,
  picture: DataTypes.STRING,
  googleId: DataTypes.STRING,
  authProvider: { type: DataTypes.ENUM('google', 'email'), defaultValue: 'email' },
  stripeCustomerId: DataTypes.STRING,
  subscriptionStatus: { type: DataTypes.ENUM('free', 'trial', 'active', 'paid'), defaultValue: 'free' },
  isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
  trialStartDate: DataTypes.DATE,
  lastLogin: DataTypes.DATE,
  loginCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastSyncDate: DataTypes.DATE,
  totalScans: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalJobsAnalyzed: { type: DataTypes.INTEGER, defaultValue: 0 },
  activityLog: { type: DataTypes.JSONB, defaultValue: [] }
});

module.exports = User;
