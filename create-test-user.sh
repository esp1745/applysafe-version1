#!/bin/bash

# Direct MongoDB User Creation for Testing

echo "📝 Creating test user directly in MongoDB..."
echo ""

cd /Users/esparancetuyishime/Documents/APPLYSAFE-VERSION-1/backend

node << 'ENDSCRIPT'
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {});
    console.log('✅ Connected to MongoDB');
    
    // Create test user
    const testUser = new User({
      email: 'esparancet@gmail.com',
      name: 'Esparance Tuyishime',
      picture: 'https://lh3.googleusercontent.com/a-/test-avatar',
      googleId: 'google-123456789',
      subscriptionStatus: 'free',
      trialStartDate: new Date(),
      activityLog: []
    });
    
    // Save user
    await testUser.save();
    console.log('✅ Test user created successfully!');
    console.log('');
    console.log('User details:');
    console.log('  Email:', testUser.email);
    console.log('  Name:', testUser.name);
    console.log('  ID:', testUser._id);
    console.log('  Subscription:', testUser.subscriptionStatus);
    console.log('');
    
    // Query to verify
    const findUser = await User.findById(testUser._id);
    if (findUser) {
      console.log('✅ User verified in database!');
      console.log('');
      console.log('Now you can:');
      console.log('1. Sign in with this email in the extension');
      console.log('2. Check MongoDB Cluster1 → Collections → users');
      console.log('3. See the test user created');
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestUser();
ENDSCRIPT
