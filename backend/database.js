const { Sequelize } = require('sequelize');
// Sequelize requires the 'pg' dialect module dynamically at runtime, which
// Vercel's static file tracer can't detect. Requiring it explicitly here
// forces the tracer to bundle it into the serverless function.
require('pg');
require('pg-hstore');
require('dotenv').config();

// Create connection to PostgreSQL (Supabase)
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
    dialectOptions: process.env.DATABASE_URL
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {}
  }
);

module.exports = sequelize;
