const path = require('path');
// Load environment variables from the server directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Trip = require('../models/Trip');
const fs = require('fs');

async function checkLocalPhotos() {
  try {
    console.log('Environment variables loaded:', {
      mongoUri: process.env.MONGODB_URI ? 'Set' : 'Not set',
      nodeEnv: process.env.NODE_ENV
    });

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check users
    const users = await User.find({
      photoUrl: { $regex: '^/uploads/', $options: 'i' }
    });

    console.log(`\n===== Found ${users.length} users with local photos =====\n`);
    
    if (users.length > 0) {
      users.forEach((user, index) => {
        console.log(`${index + 1}. User: ${user.name} (${user.email})`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Photo URL: ${user.photoUrl}`);
        console.log('   ---');
      });
    } else {
      console.log('No users found with local photo storage.');
    }

    // Check trips for any fields that might contain photo URLs
    const trips = await Trip.find({
      $or: [
        { description: { $regex: '/uploads/', $options: 'i' } },
        { 'events.description': { $regex: '/uploads/', $options: 'i' } }
      ]
    });

    console.log(`\n===== Found ${trips.length} trips with potential local photos =====\n`);
    
    if (trips.length > 0) {
      trips.forEach((trip, index) => {
        console.log(`${index + 1}. Trip: ${trip.name}`);
        console.log(`   ID: ${trip._id}`);
        console.log('   ---');
      });
    } else {
      console.log('No trips found with local photo references.');
    }

    // Check local uploads directory
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      console.log('\n===== Local uploads directory exists =====');
      
      // Count files recursively
      let fileCount = 0;
      function countFiles(directory) {
        const files = fs.readdirSync(directory);
        files.forEach(file => {
          const fullPath = path.join(directory, file);
          if (fs.statSync(fullPath).isDirectory()) {
            countFiles(fullPath);
          } else {
            fileCount++;
            console.log(`   File: ${path.relative(uploadsDir, fullPath)}`);
          }
        });
      }
      
      try {
        countFiles(uploadsDir);
        console.log(`\n   Total files in uploads directory: ${fileCount}`);
      } catch (err) {
        console.log(`   Error reading directory: ${err.message}`);
      }
    } else {
      console.log('\n===== Local uploads directory does not exist =====');
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the function
checkLocalPhotos(); 