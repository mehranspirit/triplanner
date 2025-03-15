/**
 * Migration script to add creator information to existing events
 * 
 * This script:
 * 1. Finds all trips in the database
 * 2. For each trip, finds all events
 * 3. For each event, looks up the creator from the activity log
 * 4. Updates the event with creator information
 * 
 * Run with: node server/scripts/migrateEventCreators.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Activity = require('../models/Activity');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function migrateEventCreators() {
  try {
    console.log('Starting event creator migration...');
    
    // Get all trips
    const trips = await Trip.find({});
    console.log(`Found ${trips.length} trips to process`);
    
    let totalEvents = 0;
    let updatedEvents = 0;
    let skippedEvents = 0;
    
    // Process each trip
    for (const trip of trips) {
      console.log(`Processing trip: ${trip.name} (${trip._id})`);
      
      // Skip if no events
      if (!trip.events || trip.events.length === 0) {
        console.log('  No events found, skipping');
        continue;
      }
      
      totalEvents += trip.events.length;
      let tripModified = false;
      
      // Process each event in the trip
      for (const event of trip.events) {
        // Skip if already has creator info
        if (event.createdBy && event.createdBy._id) {
          console.log(`  Event ${event.id} already has creator info, skipping`);
          skippedEvents++;
          continue;
        }
        
        // Find the creation activity for this event
        const activity = await Activity.findOne({
          trip: trip._id,
          actionType: 'event_create',
          'details.eventId': event.id
        }).populate('user', 'name email');
        
        if (activity) {
          // Set creator info from activity
          event.createdBy = {
            _id: activity.user._id,
            name: activity.user.name,
            email: activity.user.email
          };
          event.createdAt = activity.createdAt;
          
          // Set updater info (same as creator initially)
          event.updatedBy = {
            _id: activity.user._id,
            name: activity.user.name,
            email: activity.user.email
          };
          event.updatedAt = activity.createdAt;
          
          console.log(`  Updated event ${event.id} with creator: ${activity.user.name}`);
          updatedEvents++;
          tripModified = true;
        } else {
          // If no activity found, use trip owner as fallback
          const owner = await User.findById(trip.owner, 'name email');
          
          if (owner) {
            event.createdBy = {
              _id: owner._id,
              name: owner.name,
              email: owner.email
            };
            event.createdAt = trip.createdAt;
            
            // Set updater info (same as creator initially)
            event.updatedBy = {
              _id: owner._id,
              name: owner.name,
              email: owner.email
            };
            event.updatedAt = trip.createdAt;
            
            console.log(`  No activity found for event ${event.id}, using trip owner as fallback: ${owner.name}`);
            updatedEvents++;
            tripModified = true;
          } else {
            console.log(`  No activity or owner found for event ${event.id}, skipping`);
            skippedEvents++;
          }
        }
      }
      
      // Save the trip if modified
      if (tripModified) {
        await trip.save();
        console.log(`  Saved trip ${trip.name} with updated events`);
      }
    }
    
    console.log('\nMigration complete:');
    console.log(`Total events processed: ${totalEvents}`);
    console.log(`Events updated: ${updatedEvents}`);
    console.log(`Events skipped: ${skippedEvents}`);
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the migration
migrateEventCreators()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration script failed:', err);
    process.exit(1);
  }); 