const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const UserData = sequelize.define('UserData', {
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  applications: { type: DataTypes.JSONB, defaultValue: [] },
  reminders: { type: DataTypes.JSONB, defaultValue: [] },
  scanHistory: { type: DataTypes.JSONB, defaultValue: [] },
  lastSync: DataTypes.DATE
});

module.exports = UserData;
