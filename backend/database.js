const { Sequelize } = require('sequelize');
require('dotenv').config();

// Create connection to PostgreSQL
const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/applysafe',
  {
    dialect: 'postgres',
    logging: false, // Set to console.log to see SQL queries
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }
);

// Test connection
sequelize.authenticate()
  .then(() => console.log('✅ PostgreSQL connection successful'))
  .catch(err => console.error('❌ PostgreSQL connection failed:', err.message));

module.exports = sequelize;
