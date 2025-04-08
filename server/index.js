require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Trip = require('./models/Trip');
const authRoutes = require('./routes/auth');
const activitiesRoutes = require('./routes/activities');
const aiSuggestionsRoutes = require('./routes/aiSuggestions');
const expenseRoutes = require('./routes/expenses');
const auth = require('./middleware/auth');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, uploadToS3, getS3Url, getKeyFromUrl } = require('./utils/s3Config');
const checkS3Connectivity = require('./utils/ensureUploadsDir');
const { logActivity } = require('./utils/activityLogger');
const { generatePDF, generateHTML } = require('./utils/exportUtils');
const jwt = require('jsonwebtoken');
const passport = require('./config/passport');
const session = require('express-session');
const dreamTripsRouter = require('./routes/dreamTrips');

// Helper function to get a human-readable event name
const getEventName = (event) => {
  switch (event.type) {
    case 'stay':
      return event.accommodationName || 'Stay';
    case 'destination':
      return event.placeName || 'Destination';
    case 'arrival':
      return `Arrival at ${event.airport || 'airport'}`;
    case 'departure':
      return `Departure from ${event.airport || 'airport'}`;
    case 'flight':
      return 'Flight';
    case 'train':
      return 'Train';
    case 'rental_car':
      return 'Rental Car';
    case 'bus':
      return 'Bus';
    default:
      return event.type.charAt(0).toUpperCase() + event.type.slice(1);
  }
};

const ADMIN_EMAIL = 'mehran.rajaian@gmail.com';

// Check S3 connectivity
checkS3Connectivity().then(connected => {
  if (!connected) {
    console.warn('⚠️ Warning: S3 connectivity check failed. File uploads may not work correctly.');
  }
});

const app = express();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:5000'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Log all requests
app.use((req, res, next) => {
  console.log('Incoming request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  next();
});

// Photo upload endpoint
app.post('/api/users/profile/photo', auth, uploadToS3.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get the current user
    const user = await User.findById(req.user._id);
    if (!user) {
      // Delete the uploaded file from S3 if user not found
      try {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: req.file.key
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));
      } catch (deleteError) {
        console.error('Error deleting file from S3:', deleteError);
      }
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old photo from S3 if it exists
    if (user.photoUrl && user.photoUrl.includes(process.env.AWS_BUCKET_NAME)) {
      try {
        const oldPhotoKey = getKeyFromUrl(user.photoUrl);
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: oldPhotoKey
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));
      } catch (deleteError) {
        console.error('Error deleting old photo from S3:', deleteError);
      }
    }

    // Update user's photoUrl with S3 URL
    user.photoUrl = req.file.location;
    await user.save();

    console.log('Photo uploaded successfully to S3:', {
      s3Key: req.file.key,
      photoUrl: user.photoUrl
    });

    res.json({ 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        photoUrl: user.photoUrl
      }
    });
  } catch (error) {
    // Delete the uploaded file from S3 if there was an error
    if (req.file) {
      try {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: req.file.key
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));
      } catch (deleteError) {
        console.error('Error deleting file from S3:', deleteError);
      }
    }
    console.error('Error uploading photo to S3:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mount auth routes
app.use('/api/auth', authRoutes);

// Mount activities routes
app.use('/api/activities', activitiesRoutes);

// Mount AI suggestions routes
app.use('/api', aiSuggestionsRoutes);

// Mount expense routes
app.use('/api', expenseRoutes);

// Register routes
app.use('/api/trips/dream', dreamTripsRouter);

// Add role change endpoint directly in index.js
app.patch('/api/users/:userId/role', auth, async (req, res) => {
  try {
    console.log('Role change request received:', {
      requestUser: {
        id: req.user._id,
        email: req.user.email,
        isAdmin: req.user.isAdmin
      },
      params: req.params,
      body: req.body,
      headers: req.headers
    });

    // Check if the current user is the main admin
    if (req.user.email !== ADMIN_EMAIL) {
      console.log('Permission denied: User is not main admin');
      return res.status(403).json({ message: 'Only the main admin can change user roles' });
    }

    const { userId } = req.params;
    const { isAdmin } = req.body;

    console.log('Finding user to update:', { userId });
    // Find the user to update
    const userToUpdate = await User.findById(userId);
    
    if (!userToUpdate) {
      console.log('User not found:', { userId });
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user to update:', {
      id: userToUpdate._id,
      email: userToUpdate.email,
      currentIsAdmin: userToUpdate.isAdmin,
      newIsAdmin: isAdmin
    });

    // Don't allow changing the main admin's role
    if (userToUpdate.email === ADMIN_EMAIL) {
      console.log('Attempted to change main admin role');
      return res.status(403).json({ message: 'Cannot change the main admin\'s role' });
    }

    // Update the user's role
    userToUpdate.isAdmin = isAdmin;
    await userToUpdate.save();

    console.log('Successfully updated user role:', {
      id: userToUpdate._id,
      email: userToUpdate.email,
      newIsAdmin: userToUpdate.isAdmin
    });

    res.json({ 
      message: 'User role updated successfully',
      user: {
        _id: userToUpdate._id,
        email: userToUpdate.email,
        name: userToUpdate.name,
        isAdmin: userToUpdate.isAdmin
      }
    });
  } catch (error) {
    console.error('Error updating user role:', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body,
      requestParams: req.params,
      requestUser: req.user
    });
    res.status(500).json({ message: 'Error updating user role' });
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // Initialize admin user
    await User.initializeAdmin();
  })
  .catch(err => console.error('Could not connect to MongoDB:', err));

// Protected Routes
app.get('/api/trips', auth, async (req, res) => {
  try {
    console.log('Fetching trips for user:', {
      userId: req.user._id,
      email: req.user.email
    });

    const trips = await Trip.find({
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    })
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .lean()
      .exec();

    console.log('Raw trips before transform:', JSON.stringify(trips.map(trip => ({
      _id: trip._id,
      owner: trip.owner,
      collaborators: trip.collaborators
    })), null, 2));

    // Transform the response to ensure consistent _id usage
    const transformedTrips = trips.map(trip => ({
      ...trip,
      _id: trip._id.toString(),
      owner: {
        _id: trip.owner._id.toString(),
        name: trip.owner.name,
        email: trip.owner.email,
        photoUrl: trip.owner.photoUrl || null
      },
      collaborators: trip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email,
          photoUrl: c.user.photoUrl || null
        }
      }))
    }));

    console.log('Transformed trips:', JSON.stringify(transformedTrips.map(trip => ({
      _id: trip._id,
      owner: trip.owner,
      collaborators: trip.collaborators
    })), null, 2));

    res.json(transformedTrips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/trips', auth, async (req, res) => {
  try {
    console.log('Creating trip with data:', req.body);
    console.log('User:', req.user);

    const trip = new Trip({
      ...req.body,
      owner: req.user._id,
      events: [],
      collaborators: [],
      isPublic: false,
      description: req.body.description || '',
      startDate: req.body.startDate || null,
      endDate: req.body.endDate || null
    });

    const savedTrip = await trip.save();
    console.log('Saved trip before population:', savedTrip.toObject());

    // Fully populate the owner with all necessary fields
    const populatedTrip = await Trip.findById(savedTrip._id)
      .populate({
        path: 'owner',
        select: 'name email _id'
      })
      .lean()
      .exec();
    
    console.log('Populated trip before transform:', populatedTrip);
    
    // Manual transform to ensure correct format
    const transformedTrip = {
      ...populatedTrip,
      _id: populatedTrip._id.toString(),
      owner: {
        _id: populatedTrip.owner._id.toString(),
        name: populatedTrip.owner.name,
        email: populatedTrip.owner.email
      },
      events: populatedTrip.events || [],
      collaborators: populatedTrip.collaborators || [],
      description: populatedTrip.description || '',
      startDate: populatedTrip.startDate || null,
      endDate: populatedTrip.endDate || null,
      isPublic: populatedTrip.isPublic || false,
      thumbnailUrl: populatedTrip.thumbnailUrl || null,
      createdAt: populatedTrip.createdAt.toISOString(),
      updatedAt: populatedTrip.updatedAt.toISOString()
    };

    // Remove MongoDB-specific fields
    delete transformedTrip.__v;
    delete transformedTrip.id;
    delete transformedTrip.owner.id;
    
    console.log('Final transformed trip:', JSON.stringify(transformedTrip, null, 2));
    
    // Log activity
    await logActivity({
      userId: req.user._id,
      tripId: savedTrip._id,
      actionType: 'trip_create',
      description: `Created trip "${savedTrip.name}"`,
      details: {
        tripName: savedTrip.name,
        tripDescription: savedTrip.description
      }
    });
    
    res.status(201).json(transformedTrip);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/trips/:id', auth, async (req, res) => {
  try {
    console.log('GET /api/trips/:id request received:', {
      tripId: req.params.id,
      userId: req.user._id
    });

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error('Invalid trip ID format:', req.params.id);
      return res.status(400).json({ message: 'Invalid trip ID format' });
    }

    // Find the trip and populate owner and collaborators
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl');
    
    if (!trip) {
      console.log('Trip not found:', req.params.id);
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has access (owner, editor, or viewer)
    const tripModel = await Trip.findById(req.params.id);
    const accessRole = tripModel.hasAccess(req.user._id);
    if (!accessRole) {
      console.log('User not authorized:', {
        tripOwner: trip.owner._id,
        requestingUser: req.user._id
      });
      return res.status(403).json({ message: 'You do not have access to this trip' });
    }

    console.log('Trip found and access granted:', {
      tripId: trip._id,
      owner: trip.owner._id,
      requestingUser: req.user._id,
      accessRole
    });

    // Process events to ensure createdBy and updatedBy have photoUrl
    if (trip.events && trip.events.length > 0) {
      // Get all unique user IDs from events
      const userIds = new Set();
      trip.events.forEach(event => {
        if (event.createdBy && event.createdBy._id) {
          userIds.add(event.createdBy._id.toString());
        }
        if (event.updatedBy && event.updatedBy._id) {
          userIds.add(event.updatedBy._id.toString());
        }
      });

      // Fetch user data for all these IDs
      const users = await User.find({ 
        _id: { $in: Array.from(userIds) } 
      }, 'name email photoUrl').lean();

      // Create a map for quick lookup
      const userMap = {};
      users.forEach(user => {
        userMap[user._id.toString()] = user;
      });

      // Update event creator/updater info
      trip.events = trip.events.map(event => {
        const eventObj = event.toObject ? event.toObject() : event;
        
        if (eventObj.createdBy && eventObj.createdBy._id) {
          const userId = eventObj.createdBy._id.toString();
          const user = userMap[userId];
          if (user) {
            eventObj.createdBy = {
              _id: userId,
              name: user.name,
              email: user.email,
              photoUrl: user.photoUrl || null
            };
          }
        }
        
        if (eventObj.updatedBy && eventObj.updatedBy._id) {
          const userId = eventObj.updatedBy._id.toString();
          const user = userMap[userId];
          if (user) {
            eventObj.updatedBy = {
              _id: userId,
              name: user.name,
              email: user.email,
              photoUrl: user.photoUrl || null
            };
          }
        }
        
        return eventObj;
      });
    }

    const transformedTrip = {
      ...trip.toObject(),
      _id: trip._id.toString(),
      owner: {
        _id: trip.owner._id.toString(),
        name: trip.owner.name,
        email: trip.owner.email,
        photoUrl: trip.owner.photoUrl || null
      },
      collaborators: trip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email,
          photoUrl: c.user.photoUrl || null
        }
      }))
    };

    // Remove any 'id' fields that might have been added
    delete transformedTrip.id;
    delete transformedTrip.owner.id;
    transformedTrip.collaborators.forEach(c => delete c.user.id);

    res.json(transformedTrip);
  } catch (error) {
    console.error('Error fetching trip:', {
      error: error.message,
      stack: error.stack,
      tripId: req.params.id,
      userId: req.user._id
    });
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/trips/:id', auth, async (req, res) => {
  try {
    console.log('Updating trip with data:', JSON.stringify(req.body, null, 2));
    
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has access to modify this trip
    const access = trip.hasAccess(req.user._id);
    if (!access || (access !== 'owner' && access !== 'editor')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const changedFields = [];
    
    // Update basic trip fields
    if (req.body.name && req.body.name !== trip.name) {
      changedFields.push('name');
      trip.name = req.body.name;
    }
    
    if (req.body.description !== trip.description) {
      changedFields.push('description');
      trip.description = req.body.description;
    }
    
    if (req.body.thumbnailUrl !== trip.thumbnailUrl) {
      changedFields.push('thumbnailUrl');
      trip.thumbnailUrl = req.body.thumbnailUrl;
    }
    
    if (req.body.isPublic !== undefined && req.body.isPublic !== trip.isPublic) {
      changedFields.push('isPublic');
      trip.isPublic = req.body.isPublic;
    }

    // Handle events update
    if (req.body.events && JSON.stringify(req.body.events) !== JSON.stringify(trip.events)) {
      console.log('Event data received:', JSON.stringify(req.body.events, null, 2));
      changedFields.push('events');
      
      // Find added, updated, and deleted events
      const oldEvents = trip.events || [];
      const newEvents = req.body.events || [];
      
      console.log('Event comparison:', {
        oldCount: oldEvents.length,
        newCount: newEvents.length,
        oldIds: oldEvents.map(e => e.id),
        newIds: newEvents.map(e => e.id)
      });
      
      // Find deleted events
      const deletedEvents = oldEvents.filter(oldEvent => 
        !newEvents.some(newEvent => newEvent.id === oldEvent.id)
      );
      
      // Log deleted events
      for (const deletedEvent of deletedEvents) {
        const eventName = getEventName(deletedEvent);
        await logActivity({
          userId: req.user._id,
          tripId: trip._id,
          eventId: deletedEvent.id,
          actionType: 'event_delete',
          description: `Deleted the ${eventName} from "${trip.name}"`,
          details: {
            eventName: eventName,
            date: deletedEvent.date
          }
        }).catch(err => console.error('Error logging event deletion activity:', err));
      }

      // Update the events array
      trip.events = newEvents.map(newEvent => {
        const oldEvent = oldEvents.find(e => e.id === newEvent.id);
        
        // For existing events
        if (oldEvent) {
          console.log('Updating existing event:', {
            id: newEvent.id,
            type: newEvent.type,
            oldData: oldEvent,
            newData: newEvent
          });
          
          // Log the event edit activity
          const eventName = getEventName(newEvent);
          const changedFields = [];
          const fieldChanges = {};
          
          // Compare fields to determine what changed
          if (newEvent.date !== oldEvent.date) {
            changedFields.push('date');
            fieldChanges.date = { old: oldEvent.date, new: newEvent.date };
          }
          if (newEvent.status !== oldEvent.status) {
            changedFields.push('status');
            fieldChanges.status = { old: oldEvent.status, new: newEvent.status };
          }
          if (newEvent.notes !== oldEvent.notes) {
            changedFields.push('notes');
            fieldChanges.notes = { old: oldEvent.notes, new: newEvent.notes };
          }
          if (newEvent.thumbnailUrl !== oldEvent.thumbnailUrl) {
            changedFields.push('thumbnail');
            fieldChanges.thumbnail = { old: oldEvent.thumbnailUrl, new: newEvent.thumbnailUrl };
          }
          
          // Only log activity if fields actually changed
          if (changedFields.length > 0) {
            // Filter out any field changes where old and new are both empty/undefined/null
            const actualChanges = {};
            for (const [field, change] of Object.entries(fieldChanges)) {
              // Convert undefined/null to empty string for comparison
              const oldValue = change.old === undefined || change.old === null ? '' : change.old;
              const newValue = change.new === undefined || change.new === null ? '' : change.new;
              
              if (oldValue !== newValue) {
                actualChanges[field] = {
                  old: oldValue,
                  new: newValue
                };
              }
            }
            
            // Only log if there are actual changes
            if (Object.keys(actualChanges).length > 0) {
              logActivity({
                userId: req.user._id,
                tripId: trip._id,
                eventId: newEvent.id,
                actionType: 'event_update',
                description: `Updated the ${eventName} in "${trip.name}"`,
                details: {
                  changedFields: Object.keys(actualChanges),
                  fieldChanges: actualChanges,
                  date: newEvent.date
                }
              }).catch(err => console.error('Error logging event update activity:', err));
            }
          }
          
          return {
            ...oldEvent.toObject(),
            ...newEvent,
            createdBy: oldEvent.createdBy,
            createdAt: oldEvent.createdAt,
            updatedBy: {
              _id: req.user._id,
              name: req.user.name,
              email: req.user.email
            },
            updatedAt: new Date()
          };
        }
        
        // For new events
        console.log('Creating new event:', newEvent);
        const eventName = getEventName(newEvent);
        
        // Log new event creation
        logActivity({
          userId: req.user._id,
          tripId: trip._id,
          eventId: newEvent.id,
          actionType: 'event_create',
          description: `Added a new ${eventName} to "${trip.name}"`,
          details: {
            date: newEvent.date,
            ...(newEvent.type === 'arrival' || newEvent.type === 'departure' ? {
              airport: newEvent.airport || '',
              airline: newEvent.airline || '',
              flightNumber: newEvent.flightNumber || '',
              terminal: newEvent.terminal || '',
              gate: newEvent.gate || '',
              time: newEvent.time || '',
              bookingReference: newEvent.bookingReference || ''
            } : {})
          }
        }).catch(err => console.error('Error logging event creation activity:', err));

        return {
          ...newEvent,
          createdBy: {
            _id: req.user._id,
            name: req.user.name,
            email: req.user.email
          },
          updatedBy: {
            _id: req.user._id,
            name: req.user.name,
            email: req.user.email
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

      // Mark the events array as modified
      trip.markModified('events');
      console.log('Final events array:', JSON.stringify(trip.events, null, 2));
    }

    // Save the updated trip
    const updatedTrip = await trip.save();
    console.log('Saved trip data:', JSON.stringify(updatedTrip, null, 2));

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error updating trip:', {
      error: error.message,
      stack: error.stack
    });
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/trips/:id', auth, async (req, res) => {
  try {
    console.log('Delete request received:', {
      tripId: req.params.id,
      userId: req.user._id,
      userIdType: typeof req.user._id
    });
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error('Invalid trip ID format:', req.params.id);
      return res.status(400).json({ message: 'Invalid trip ID format' });
    }

    // First check if the trip exists and if the user has permission
    const trip = await Trip.findById(req.params.id).populate('owner', 'name email');
    
    if (!trip) {
      console.log('Trip not found:', req.params.id);
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if the user is the owner
    if (!trip.owner._id.equals(req.user._id)) {
      console.log('User not authorized:', {
        tripOwner: trip.owner._id,
        requestingUser: req.user._id
      });
      return res.status(403).json({ message: 'You are not authorized to delete this trip' });
    }

    // If we get here, the user is authorized to delete the trip
    const deletedTrip = await Trip.findByIdAndDelete(req.params.id);
    
    console.log('Trip successfully deleted:', {
      tripId: deletedTrip._id,
      owner: deletedTrip.owner
    });
    
    // Log activity
    await logActivity({
      userId: req.user._id,
      tripId: deletedTrip._id,
      actionType: 'trip_delete',
      description: `Deleted trip "${deletedTrip.name}"`,
      details: {
        tripName: deletedTrip.name,
        tripDescription: deletedTrip.description
      }
    });
    
    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip:', {
      error: error.message,
      stack: error.stack,
      tripId: req.params.id,
      userId: req.user._id
    });
    res.status(500).json({ message: error.message || 'Failed to delete trip' });
  }
});

app.post('/api/trips/:id/collaborators', auth, async (req, res) => {
  try {
    const { email, role } = req.body;
    
    // Find the user by email
    const collaboratorUser = await User.findOne({ email });
    if (!collaboratorUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the trip
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user is the owner
    if (!trip.owner._id.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only the trip owner can add collaborators' });
    }

    // Check if user is already a collaborator
    if (trip.collaborators.some(c => c.user._id.equals(collaboratorUser._id))) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    // Add the collaborator
    trip.collaborators.push({
      user: collaboratorUser._id,
      role: role || 'viewer'
    });

    // Save and populate the updated trip
    const updatedTrip = await trip.save();
    const populatedTrip = await Trip.findById(updatedTrip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl');

    // Log activity
    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      actionType: 'collaborator_add',
      description: `Added ${collaboratorUser.name} as a ${role || 'viewer'} to trip "${trip.name}"`,
      details: {
        tripName: trip.name,
        collaboratorId: collaboratorUser._id,
        collaboratorName: collaboratorUser.name,
        collaboratorEmail: collaboratorUser.email,
        role: role || 'viewer'
      }
    });

    res.json(populatedTrip);
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ message: error.message });
  }
});

// Remove a collaborator from a trip
app.delete('/api/trips/:id/collaborators/:userId', auth, async (req, res) => {
  try {
    console.log('Remove collaborator request received:', {
      tripId: req.params.id,
      collaboratorId: req.params.userId,
      requestingUserId: req.user._id
    });

    // Find the trip
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      console.log('Trip not found:', req.params.id);
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user is the owner
    if (!trip.owner._id.equals(req.user._id)) {
      console.log('Remove collaborator permission denied:', {
        tripOwner: trip.owner._id,
        requestingUser: req.user._id
      });
      return res.status(403).json({ message: 'Only the trip owner can remove collaborators' });
    }

    // Check if the collaborator exists
    const collaboratorIndex = trip.collaborators.findIndex(c => 
      c.user._id.toString() === req.params.userId
    );

    if (collaboratorIndex === -1) {
      console.log('Collaborator not found:', {
        tripId: req.params.id,
        collaboratorId: req.params.userId
      });
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    // Store collaborator info before removing
    const collaborator = trip.collaborators[collaboratorIndex];
    const collaboratorUser = await User.findById(req.params.userId);
    const collaboratorName = collaboratorUser ? collaboratorUser.name : 'Unknown user';

    // Remove the collaborator
    trip.collaborators.splice(collaboratorIndex, 1);

    // Save and populate the updated trip
    const updatedTrip = await trip.save();
    const populatedTrip = await Trip.findById(updatedTrip._id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');

    console.log('Collaborator removed successfully:', {
      tripId: populatedTrip._id,
      collaboratorId: req.params.userId,
      remainingCollaborators: populatedTrip.collaborators.length
    });

    // Log activity
    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      actionType: 'collaborator_remove',
      description: `Removed ${collaboratorName} from trip "${trip.name}"`,
      details: {
        tripName: trip.name,
        collaboratorId: req.params.userId,
        collaboratorName,
        role: collaborator.role
      }
    });

    res.json(populatedTrip);
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ message: error.message });
  }
});

// Leave a trip (self-removal)
app.post('/api/trips/:id/leave', auth, async (req, res) => {
  try {
    console.log('Leave trip request received:', {
      tripId: req.params.id,
      userId: req.user._id
    });

    // Find the trip
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      console.log('Trip not found:', req.params.id);
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check that the user is not the owner
    if (trip.owner._id.equals(req.user._id)) {
      console.log('Owner attempted to leave their own trip:', {
        tripId: req.params.id,
        ownerId: req.user._id
      });
      return res.status(403).json({ message: 'The owner cannot leave their own trip' });
    }

    // Find the user's collaborator entry
    const collaboratorIndex = trip.collaborators.findIndex(c => 
      c.user._id.toString() === req.user._id.toString()
    );

    if (collaboratorIndex === -1) {
      console.log('User is not a collaborator:', {
        tripId: req.params.id,
        userId: req.user._id
      });
      return res.status(404).json({ message: 'You are not a collaborator on this trip' });
    }

    // Remove the user from collaborators
    trip.collaborators.splice(collaboratorIndex, 1);

    // Save the updated trip
    await trip.save();

    console.log('Successfully left trip:', {
      tripId: req.params.id,
      userId: req.user._id
    });

    res.json({ message: 'Successfully left the trip' });
  } catch (error) {
    console.error('Error leaving trip:', {
      error: error.message,
      stack: error.stack,
      tripId: req.params.id,
      userId: req.user._id
    });
    res.status(500).json({ message: 'Failed to leave trip' });
  }
});

// Generate a share link for a trip
app.post('/api/trips/:id/share', auth, async (req, res) => {
  try {
    console.log('Generate share link request received:', {
      tripId: req.params.id,
      userId: req.user._id
    });

    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      console.log('Trip not found:', req.params.id);
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has edit access (owner or editor)
    const accessRole = trip.hasAccess(req.user._id);
    console.log('Share access check:', {
      tripId: trip._id,
      userId: req.user._id,
      accessRole
    });

    if (!accessRole || (accessRole === 'viewer')) {
      console.log('Share permission denied:', {
        tripId: trip._id,
        userId: req.user._id,
        accessRole
      });
      return res.status(403).json({ message: 'You do not have permission to share this trip' });
    }

    // Generate a unique share token
    const shareToken = require('crypto').randomBytes(32).toString('hex');
    const shareableLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/trips/${trip._id}/shared/${shareToken}`;
    console.log('Generated share link:', shareableLink);

    trip.shareableLink = shareableLink;
    trip.isPublic = true;

    const updatedTrip = await trip.save();
    console.log('Share link saved successfully:', {
      tripId: updatedTrip._id,
      shareableLink: updatedTrip.shareableLink
    });

    res.json({ shareableLink: updatedTrip.shareableLink });
  } catch (error) {
    console.error('Error generating share link:', {
      error: error.message,
      stack: error.stack,
      tripId: req.params.id,
      userId: req.user._id
    });
    res.status(500).json({ message: error.message });
  }
});

// Revoke a share link for a trip
app.delete('/api/trips/:id/share', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has edit access (owner or editor)
    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole || (accessRole === 'viewer')) {
      return res.status(403).json({ message: 'You do not have permission to revoke share link' });
    }

    trip.shareableLink = undefined;
    trip.isPublic = false;

    await trip.save();
    res.json({ message: 'Share link revoked successfully' });
  } catch (error) {
    console.error('Error revoking share link:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete user endpoint
app.delete('/api/users/:id', auth, async (req, res) => {
  try {
    console.log('Delete user request received:', {
      targetUserId: req.params.id,
      requestingUserId: req.user._id,
      requestingUserEmail: req.user.email,
      isAdmin: req.user.isAdmin
    });

    // Allow admins to delete any account, but regular users can only delete their own
    if (!req.user.isAdmin && req.params.id !== req.user._id.toString()) {
      console.log('Delete user request denied:', {
        reason: 'Unauthorized - not admin and not own account',
        targetUserId: req.params.id,
        requestingUserId: req.user._id
      });
      return res.status(403).json({ message: 'You can only delete your own account' });
    }

    // Find and delete the user
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      console.log('Delete user failed:', {
        reason: 'User not found',
        targetUserId: req.params.id
      });
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('User deleted:', {
      userId: deletedUser._id,
      email: deletedUser.email,
      name: deletedUser.name,
      deletedBy: req.user.isAdmin ? 'admin' : 'self'
    });

    // Delete all trips owned by this user
    const deleteTripsResult = await Trip.deleteMany({ owner: req.params.id });
    console.log('Deleted user trips:', {
      userId: deletedUser._id,
      tripsDeleted: deleteTripsResult.deletedCount
    });

    // Remove user from collaborators in all trips
    const updateCollabsResult = await Trip.updateMany(
      { 'collaborators.user': req.params.id },
      { $pull: { collaborators: { user: req.params.id } } }
    );
    console.log('Removed user from collaborations:', {
      userId: deletedUser._id,
      tripsUpdated: updateCollabsResult.modifiedCount
    });

    res.json({ 
      message: 'User and associated data deleted successfully',
      deletedData: {
        tripsDeleted: deleteTripsResult.deletedCount,
        collaborationsRemoved: updateCollabsResult.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error deleting user:', {
      error: error.message,
      stack: error.stack,
      userId: req.params.id,
      requestingUser: req.user._id
    });
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
app.put('/api/users/profile', auth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // Verify current password if provided
    if (currentPassword) {
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
    }

    // Update user fields while preserving email
    user.name = name;
    
    // Update password if provided
    if (newPassword) {
      user.password = newPassword;
    }

    await user.save();

    res.json({ 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        photoUrl: user.photoUrl
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: error.message });
  }
});

// Export trip as PDF (GET method with auth middleware)
app.get('/api/trips/:id/export/pdf', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has access to this trip
    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole) {
      return res.status(403).json({ message: 'You do not have permission to access this trip' });
    }

    // Generate PDF
    const pdf = await generatePDF(trip);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${trip.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.pdf"`);
    
    // Send PDF
    res.send(pdf);
  } catch (error) {
    console.error('Error exporting trip as PDF:', error);
    res.status(500).json({ message: 'Failed to export trip as PDF' });
  }
});

// Export trip as PDF (POST method with token in body)
app.post('/api/trips/:id/export/pdf', async (req, res) => {
  try {
    // Get token from request body
    const token = req.body.token;
    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid authentication token' });
    }

    // Find trip
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has access to this trip
    const accessRole = trip.hasAccess(user._id);
    if (!accessRole) {
      return res.status(403).json({ message: 'You do not have permission to access this trip' });
    }

    // Generate PDF
    const pdf = await generatePDF(trip);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${trip.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_itinerary.pdf"`);
    
    // Send PDF
    res.send(pdf);
  } catch (error) {
    console.error('Error exporting trip as PDF:', error);
    res.status(500).json({ message: 'Failed to export trip as PDF' });
  }
});

// Export trip as HTML (GET method with auth middleware)
app.get('/api/trips/:id/export/html', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has access to this trip
    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole) {
      return res.status(403).json({ message: 'You do not have permission to access this trip' });
    }

    // Generate HTML
    const html = await generateHTML(trip);
    
    // Send HTML
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error exporting trip as HTML:', error);
    res.status(500).json({ message: 'Failed to export trip as HTML' });
  }
});

// Export trip as HTML (POST method with token in body)
app.post('/api/trips/:id/export/html', async (req, res) => {
  try {
    // Get token from request body
    const token = req.body.token;
    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid authentication token' });
    }

    // Find trip
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has access to this trip
    const accessRole = trip.hasAccess(user._id);
    if (!accessRole) {
      return res.status(403).json({ message: 'You do not have permission to access this trip' });
    }

    // Generate HTML
    const html = await generateHTML(trip);
    
    // Send HTML
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error exporting trip as HTML:', error);
    res.status(500).json({ message: 'Failed to export trip as HTML' });
  }
});

// Vote on an event (like or dislike)
app.post('/api/trips/:id/events/:eventId/vote', auth, async (req, res) => {
  try {
    const { id, eventId } = req.params;
    const { voteType } = req.body;
    
    if (!['like', 'dislike'].includes(voteType)) {
      return res.status(400).json({ message: 'Invalid vote type. Must be "like" or "dislike".' });
    }
    
    const trip = await Trip.findById(id);
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    // Check if user has access to the trip
    const userId = req.user.id;
    const isOwner = trip.owner.toString() === userId;
    const isCollaborator = trip.collaborators.some(collab => collab.user.toString() === userId);
    
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Find the event in the trip
    const eventIndex = trip.events.findIndex(e => e.id === eventId);
    
    if (eventIndex === -1) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const event = trip.events[eventIndex];
    
    // Only allow voting on exploring events
    if (event.status !== 'exploring') {
      return res.status(400).json({ message: 'Can only vote on exploring events' });
    }
    
    // Initialize likes and dislikes arrays if they don't exist
    if (!event.likes) event.likes = [];
    if (!event.dislikes) event.dislikes = [];
    
    // Remove any existing votes by this user
    event.likes = event.likes.filter(id => id !== userId);
    event.dislikes = event.dislikes.filter(id => id !== userId);
    
    // Add the new vote
    if (voteType === 'like') {
      event.likes.push(userId);
    } else {
      event.dislikes.push(userId);
    }
    
    // Update the event in the trip
    trip.events[eventIndex] = event;
    
    // Mark the trip as modified
    trip.markModified('events');
    
    // Save the trip
    await trip.save();
    
    // Get event name
    const eventName = getEventName(event);
    
    // Log the activity
    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      eventId: eventId,
      actionType: voteType === 'like' ? 'event_like' : 'event_dislike',
      description: `${voteType === 'like' ? 'Liked' : 'Disliked'} the event "${eventName}" in "${trip.name}"`,
      details: { 
        eventName: eventName,
        voteType
      }
    });
    
    return res.status(200).json(trip);
  } catch (error) {
    console.error('Error voting on event:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove a vote from an event
app.delete('/api/trips/:id/events/:eventId/vote', auth, async (req, res) => {
  try {
    const { id, eventId } = req.params;
    
    const trip = await Trip.findById(id);
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    // Check if user has access to the trip
    const userId = req.user.id;
    const isOwner = trip.owner.toString() === userId;
    const isCollaborator = trip.collaborators.some(collab => collab.user.toString() === userId);
    
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Find the event in the trip
    const eventIndex = trip.events.findIndex(e => e.id === eventId);
    
    if (eventIndex === -1) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const event = trip.events[eventIndex];
    
    // Only allow removing votes from exploring events
    if (event.status !== 'exploring') {
      return res.status(400).json({ message: 'Can only remove votes from exploring events' });
    }
    
    // Initialize likes and dislikes arrays if they don't exist
    if (!event.likes) event.likes = [];
    if (!event.dislikes) event.dislikes = [];
    
    // Remove any existing votes by this user
    event.likes = event.likes.filter(id => id !== userId);
    event.dislikes = event.dislikes.filter(id => id !== userId);
    
    // Update the event in the trip
    trip.events[eventIndex] = event;
    
    // Mark the trip as modified
    trip.markModified('events');
    
    // Save the trip
    await trip.save();
    
    // Get event name
    const eventName = getEventName(event);
    
    // Log the activity
    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      eventId: eventId,
      actionType: 'event_vote_remove',
      description: `Removed vote from the event "${eventName}" in "${trip.name}"`,
      details: { 
        eventName: eventName
      }
    });
    
    return res.status(200).json(trip);
  } catch (error) {
    console.error('Error removing vote from event:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 