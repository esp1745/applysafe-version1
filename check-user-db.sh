#!/bin/bash

# Check user in database and subscription status

echo "🔍 Checking user in database..."
echo ""

cd /Users/esparancetuyishime/Documents/APPLYSAFE-VERSION-1/backend

node << 'ENDSCRIPT'
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {});
    console.log('✅ Connected to MongoDB');
    console.log('');
    
    // Check for both emails
    const email1 = 'esparance7@gmail.com';
    const email2 = 'esparancet@gmail.com';
    
    console.log('📧 Searching for users...');
    console.log('');
    
    // Find user 1
    const user1 = await User.findOne({ email: email1 });
    if (user1) {
      console.log('✅ User 1 FOUND:');
      console.log('  Email:', user1.email);
      console.log('  Name:', user1.name);
      console.log('  Subscription Status:', user1.subscriptionStatus);
      console.log('  Created:', user1.createdAt);
      console.log('  Trial Start:', user1.trialStartDate);
      console.log('  ID:', user1._id);
    } else {
      console.log('❌ User 1 NOT FOUND: ' + email1);
    }
    
    console.log('');
    
    // Find user 2
    const user2 = await User.findOne({ email: email2 });
    if (user2) {
      console.log('✅ User 2 FOUND:');
      console.log('  Email:', user2.email);
      console.log('  Name:', user2.name);
      console.log('  Subscription Status:', user2.subscriptionStatus);
      console.log('  Created:', user2.createdAt);
      console.log('  Trial Start:', user2.trialStartDate);
      console.log('  ID:', user2._id);
    } else {
      console.log('❌ User 2 NOT FOUND: ' + email2);
    }
    
    console.log('');
    
    // Count all users
    const allUsers = await User.find({});
    console.log('📊 Total users in database:', allUsers.length);
    if (allUsers.length > 0) {
      console.log('');
      console.log('All users:');
      allUsers.forEach(u => {
        console.log(`  - ${u.email} (${u.subscriptionStatus})`);
      });
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUser();
ENDSCRIPT
