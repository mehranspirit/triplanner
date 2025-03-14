require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function listUsersWithLocalPhotos() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users with photoUrl starting with /uploads/
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

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the function
listUsersWithLocalPhotos(); 