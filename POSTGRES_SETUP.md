# PostgreSQL Setup Guide

## Overview
ApplySafe now uses PostgreSQL instead of MongoDB for reliable user tracking and data persistence.

## Local Development Setup

### 1. Install PostgreSQL
**Mac:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### 2. Create Database and User

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE applysafe;

# Create user
CREATE USER applysafe_user WITH PASSWORD 'your_secure_password';

# Grant privileges
ALTER ROLE applysafe_user SET client_encoding TO 'utf8';
ALTER ROLE applysafe_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE applysafe_user SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE applysafe TO applysafe_user;

# Exit
\q
```

### 3. Update .env File

```bash
DATABASE_URL=postgres://applysafe_user:your_secure_password@localhost:5432/applysafe
```

### 4. Start Server

```bash
cd backend
npm start
```

The server will automatically create the `users` table on startup.

---

## Production Deployment (Railway, Render, Heroku)

### Option 1: Railway.app
1. Create account at https://railway.app
2. Create new PostgreSQL plugin
3. Copy the database URL to `DATABASE_URL` env var
4. Deploy backend

### Option 2: Render.com
1. Create account at https://render.com
2. Create new PostgreSQL database
3. Copy connection string to `DATABASE_URL`
4. Deploy backend

### Option 3: Heroku
1. `heroku addons:create heroku-postgresql:hobby-dev`
2. `heroku config` to get DATABASE_URL
3. Deploy

---

## Available Endpoints

### User Tracking
- `GET /api/admin/users` - Get all users with stats
- `GET /api/user/stats/:email` - Get specific user stats
- `POST /api/user/activity` - Log user activity (scan, sync, etc.)
- `GET /api/admin/stats` - Get overall dashboard stats

### Authentication
- `POST /api/auth/email` - Email sign-in
- `POST /api/auth/google` - Google OAuth sign-in

---

## User Model Fields

```javascript
{
  id: integer,
  email: string (unique),
  name: string,
  picture: string,
  authProvider: 'google' | 'email',
  createdAt: timestamp,
  lastLogin: timestamp,
  loginCount: number,
  lastSyncDate: timestamp,
  totalScans: number,
  totalJobsAnalyzed: number,
  subscriptionStatus: 'free' | 'trial' | 'paid',
  trialStartDate: timestamp,
  isPremium: boolean,
  activityLog: JSON array
}
```

---

## Troubleshooting

### Connection Failed
- Check PostgreSQL is running: `psql postgres`
- Verify DATABASE_URL is correct
- Check firewall/network access

### Table Errors
- Server will auto-create tables on startup
- Manually sync: `sequelize db:migrate`

### Reset Database
```bash
psql postgres
DROP DATABASE applysafe;
CREATE DATABASE applysafe;
GRANT ALL PRIVILEGES ON DATABASE applysafe TO applysafe_user;
```

---

## Switching from MongoDB
All user data is now in PostgreSQL. Previous MongoDB data is not automatically migrated - you can manually export and import if needed.
